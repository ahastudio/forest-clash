package main

import (
	"errors"
	"sync"
)

var errAlreadyOnline = errors.New("이미 접속 중인 계정입니다")

// Player는 로그인한 접속 하나다. send는 막히지 않고 바로 돌아와야 한다(허브의 잠금 안에서 불린다).
type Player struct {
	account Account
	send    func(message any)
	match   *Match
	slot    int
	queued  bool
}

// Match는 두 사람이 겨루는 한 판이다. 판이 기록되면 finished가 된다.
type Match struct {
	players  [2]*Player
	reports  [2]*int
	finished bool
}

// Hub는 접속한 사람, 대기열, 진행 중인 판을 한 곳에서 관리한다.
// 모든 상태 변경은 하나의 잠금 안에서 일어나므로 접속마다 따로 불려도 안전하다.
type Hub struct {
	mutex  sync.Mutex
	store  Store
	online map[string]*Player
	queue  []*Player
	// recording은 저장소에 쓰는 중인 승패 기록의 수를 센다. Wait와 Close가 끝나기를 기다린다.
	recording sync.WaitGroup
	// closed는 Close가 불린 뒤 true다. 닫힌 허브는 승패를 따로 돌리지 않고 그 자리에서 기록한다.
	closed bool
}

func NewHub(store Store) *Hub {
	return &Hub{store: store, online: map[string]*Player{}}
}

// Login은 계정을 접속 상태로 올린다. 같은 계정이 이미 접속 중이면 거절한다.
// 같은 계정이 한 번에 하나만 접속하므로 대기열에서 자기 자신과 만나는 일이 없다.
// 저장소에 쓰는 동안 다른 사람의 입력 중계가 멈추지 않도록 허브의 잠금을 풀고 저장한다.
// 그 사이 같은 계정이 들어오지 못하게 접속 상태를 먼저 잡아 둔다.
func (hub *Hub) Login(sub, name string, send func(message any)) (*Player, error) {
	player := &Player{send: send}
	if err := hub.reserve(sub, player); err != nil {
		return nil, err
	}
	account, err := hub.store.Login(sub, name)
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	if err != nil {
		delete(hub.online, sub)
		return nil, err
	}
	player.account = account
	send(newReady(account))
	return player, nil
}

// reserve는 계정을 접속 상태로 잡는다. 이미 접속 중이면 거절한다.
func (hub *Hub) reserve(sub string, player *Player) error {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	if _, exists := hub.online[sub]; exists {
		return errAlreadyOnline
	}
	hub.online[sub] = player
	return nil
}

// Queue는 대기열에 넣고, 두 사람이 모였으면 짝을 지어 준다.
func (hub *Hub) Queue(player *Player) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	if player.match != nil && !player.match.finished {
		player.send(newError("대전 중에는 대기열에 들어갈 수 없습니다"))
		return
	}
	player.match = nil
	if !player.queued {
		player.queued = true
		hub.queue = append(hub.queue, player)
	}
	player.send(waitingMessage{Type: typeWaiting})
	hub.pairLocked()
}

// Cancel은 대기열에서 뺀다.
func (hub *Hub) Cancel(player *Player) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	hub.removeFromQueueLocked(player)
}

// Input은 내 입력을 상대에게 그대로 전달한다.
func (hub *Hub) Input(player *Player, frame, bits int) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	if frame < 0 || frame > maxInputFrame || bits < 0 || bits > maxInputBits {
		player.send(newError("입력 값이 올바르지 않습니다"))
		return
	}
	opponent := hub.opponentLocked(player)
	if opponent == nil {
		return
	}
	opponent.send(inputMessage{Type: typeInput, Frame: frame, Bits: bits})
}

// Report는 판이 끝났을 때 이긴 쪽을 보고받는다. 두 사람의 보고가 모이면 비교해서 같을 때만 기록한다.
func (hub *Hub) Report(player *Player, winner *int) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	match := player.match
	if match == nil || match.finished {
		player.send(newError("보고할 대전이 없습니다"))
		return
	}
	if winner == nil || (*winner != 0 && *winner != 1) {
		player.send(newError("이긴 쪽은 0 또는 1이어야 합니다"))
		return
	}
	match.reports[player.slot] = winner
	if match.reports[0] == nil || match.reports[1] == nil {
		return
	}
	if *match.reports[0] != *match.reports[1] {
		rejectMismatch(match)
		return
	}
	hub.recordLocked(match, *winner)
}

// rejectMismatch는 두 사람의 보고가 달라 기록하지 않고 판을 끝낸다.
func rejectMismatch(match *Match) {
	match.finished = true
	for _, participant := range match.players {
		participant.send(newError("두 사람의 결과가 달라 기록하지 않았습니다"))
	}
}

// Leave는 대전에서 나간다. 접속은 유지한다.
func (hub *Hub) Leave(player *Player) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	hub.leaveMatchLocked(player)
}

// Disconnect는 접속이 끊겼을 때 대기열, 대전, 접속 상태를 모두 정리한다.
func (hub *Hub) Disconnect(player *Player) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	hub.removeFromQueueLocked(player)
	hub.leaveMatchLocked(player)
	// 같은 계정은 한 번에 하나만 접속하므로 접속 상태에 남은 사람은 끊기는 이 사람뿐이다.
	delete(hub.online, player.account.Sub)
}

func (hub *Hub) pairLocked() {
	for len(hub.queue) >= 2 {
		first, second := hub.queue[0], hub.queue[1]
		hub.queue = hub.queue[2:]
		match := &Match{players: [2]*Player{first, second}}
		for slot, player := range match.players {
			player.queued = false
			player.slot = slot
			player.match = match
		}
		first.send(newMatched(0, second.account))
		second.send(newMatched(1, first.account))
	}
}

func (hub *Hub) removeFromQueueLocked(player *Player) {
	player.queued = false
	remaining := hub.queue[:0]
	for _, waiting := range hub.queue {
		if waiting != player {
			remaining = append(remaining, waiting)
		}
	}
	hub.queue = remaining
}

// opponentLocked는 같은 판에 아직 붙어 있는 상대를 돌려준다. 상대가 나갔거나 다른 판으로 갔으면 nil이다.
func (hub *Hub) opponentLocked(player *Player) *Player {
	match := player.match
	if match == nil {
		return nil
	}
	opponent := match.players[1-player.slot]
	if opponent.match != match {
		return nil
	}
	return opponent
}

// leaveMatchLocked는 판 도중에 나가면 남은 사람의 승으로 기록한다. 이미 기록된 판은 다시 기록하지 않는다.
// 나가는 사람이 이미 결과를 보고했다면 판은 끝난 것이므로 이탈로 기록하지 않는다.
// 보고하지 않은 상대가 보고를 미루는 것만으로 남은 쪽의 승리를 가져가지 못하게 한다.
func (hub *Hub) leaveMatchLocked(player *Player) {
	match := player.match
	if match == nil {
		return
	}
	// 판에 붙은 두 사람의 match는 함께 정해지고 함께 지워지므로, match가 남아 있으면 상대도 같은 판에 있다.
	opponent := match.players[1-player.slot]
	player.match = nil
	opponent.match = nil
	opponent.send(opponentLeftMessage{Type: typeOpponentLeft})
	if !match.finished && match.reports[player.slot] == nil {
		hub.recordLocked(match, opponent.slot)
	}
}

// outcome은 승패를 저장소에 쓴 결과다. 쓰지 못했으면 err가 있다.
type outcome struct {
	winner, loser Account
	err           error
}

// recordLocked는 판을 끝난 것으로 표시하고 승패를 저장소에 쓰는 일을 맡긴다.
// 디스크에 쓰는 동안 허브의 잠금을 쥐고 있으면 다른 사람의 입력 중계가 멈추므로 따로 돌린다.
// 같은 판이 두 번 기록되지 않게 기록이 끝나기 전에 먼저 끝난 것으로 표시한다.
// 허브가 닫힌 뒤에는 기다리는 쪽이 없으므로 따로 돌리지 않고 그 자리에서 쓴다.
func (hub *Hub) recordLocked(match *Match, winnerSlot int) {
	match.finished = true
	winnerSub, loserSub := match.players[winnerSlot].account.Sub, match.players[1-winnerSlot].account.Sub
	if hub.closed {
		hub.settleLocked(match, winnerSlot, writeOutcome(hub.store, winnerSub, loserSub))
		return
	}
	hub.recording.Add(1)
	go hub.record(match, winnerSlot, winnerSub, loserSub)
}

// writeOutcome은 승패를 저장소에 쓰고 그 결과를 묶어 돌려준다.
func writeOutcome(store Store, winnerSub, loserSub string) outcome {
	winner, loser, err := store.Record(winnerSub, loserSub)
	return outcome{winner: winner, loser: loser, err: err}
}

// record는 승패를 허브의 잠금 밖에서 저장소에 쓰고, 잠금을 잡은 뒤 결과를 알린다.
func (hub *Hub) record(match *Match, winnerSlot int, winnerSub, loserSub string) {
	defer hub.recording.Done()
	result := writeOutcome(hub.store, winnerSub, loserSub)
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	hub.settleLocked(match, winnerSlot, result)
}

// settleLocked는 저장한 결과를 두 사람에게 알린다. 쓰지 못했으면 판을 다시 기록할 수 있게 되돌린다.
func (hub *Hub) settleLocked(match *Match, winnerSlot int, result outcome) {
	if result.err != nil {
		match.finished = false
		for _, participant := range match.players {
			participant.send(newError("승패를 기록하지 못했습니다"))
		}
		return
	}
	winner, loser := match.players[winnerSlot], match.players[1-winnerSlot]
	winner.account, loser.account = result.winner, result.loser
	winner.send(newRecorded(result.winner))
	loser.send(newRecorded(result.loser))
}

// Wait는 저장소에 쓰는 중인 승패 기록이 모두 끝나기를 기다린다.
func (hub *Hub) Wait() {
	hub.recording.Wait()
}

// Close는 허브를 닫고 저장 중인 승패 기록이 끝나기를 기다린다. 서버를 끌 때 기록이 잘리지 않게 한다.
// 닫은 뒤에 끝나는 판은 그 자리에서 기록하므로, 기다리는 도중에 새 기록이 더해지는 일이 없다.
func (hub *Hub) Close() {
	hub.mutex.Lock()
	hub.closed = true
	hub.mutex.Unlock()
	hub.recording.Wait()
}

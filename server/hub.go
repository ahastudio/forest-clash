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
}

func NewHub(store Store) *Hub {
	return &Hub{store: store, online: map[string]*Player{}}
}

// Login은 계정을 접속 상태로 올린다. 같은 계정이 이미 접속 중이면 거절한다.
// 같은 계정이 한 번에 하나만 접속하므로 대기열에서 자기 자신과 만나는 일이 없다.
func (hub *Hub) Login(sub, name string, send func(message any)) (*Player, error) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	if _, exists := hub.online[sub]; exists {
		return nil, errAlreadyOnline
	}
	account, err := hub.store.Login(sub, name)
	if err != nil {
		return nil, err
	}
	player := &Player{account: account, send: send}
	hub.online[sub] = player
	send(newReady(account))
	return player, nil
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
	if frame < 0 || bits < 0 || bits > maxInputBits {
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
		match.finished = true
		for _, participant := range match.players {
			participant.send(newError("두 사람의 결과가 달라 기록하지 않았습니다"))
		}
		return
	}
	hub.recordLocked(match, *winner)
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
	if !match.finished {
		hub.recordLocked(match, opponent.slot)
	}
}

func (hub *Hub) recordLocked(match *Match, winnerSlot int) {
	winner, loser := match.players[winnerSlot], match.players[1-winnerSlot]
	winnerAccount, loserAccount, err := hub.store.Record(winner.account.Sub, loser.account.Sub)
	if err != nil {
		for _, participant := range match.players {
			participant.send(newError("승패를 기록하지 못했습니다"))
		}
		return
	}
	match.finished = true
	winner.account, loser.account = winnerAccount, loserAccount
	winner.send(newRecorded(winnerAccount))
	loser.send(newRecorded(loserAccount))
}

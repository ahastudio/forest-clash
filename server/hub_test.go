package main

import (
	"encoding/json"
	"errors"
	"sync"
	"testing"
)

// inbox는 서버가 한 사람에게 보낸 메시지를 JSON 모양으로 모아 둔다.
type inbox struct {
	mutex    sync.Mutex
	messages []map[string]any
}

func (box *inbox) send(message any) {
	content, _ := json.Marshal(message)
	var decoded map[string]any
	_ = json.Unmarshal(content, &decoded)
	box.mutex.Lock()
	defer box.mutex.Unlock()
	box.messages = append(box.messages, decoded)
}

func (box *inbox) types() []string {
	box.mutex.Lock()
	defer box.mutex.Unlock()
	types := make([]string, 0, len(box.messages))
	for _, message := range box.messages {
		types = append(types, message["type"].(string))
	}
	return types
}

func (box *inbox) last() map[string]any {
	box.mutex.Lock()
	defer box.mutex.Unlock()
	return box.messages[len(box.messages)-1]
}

func (box *inbox) count(messageType string) int {
	total := 0
	for _, found := range box.types() {
		if found == messageType {
			total++
		}
	}
	return total
}

type table struct {
	hub   *Hub
	store *FileStore
}

func newTable() table {
	store, _ := OpenFileStore("")
	return table{hub: NewHub(store), store: store}
}

func (arena table) join(t *testing.T, sub, name string) (*Player, *inbox) {
	t.Helper()
	box := &inbox{}
	player, err := arena.hub.Login(sub, name, box.send)
	if err != nil {
		t.Fatal(err)
	}
	return player, box
}

// matchedPair는 두 사람을 로그인시켜 대기열을 거쳐 짝을 짓는다. 먼저 들어온 사람이 slot 0이다.
func (arena table) matchedPair(t *testing.T) (first, second *Player, firstBox, secondBox *inbox) {
	t.Helper()
	first, firstBox = arena.join(t, "first", "첫째")
	second, secondBox = arena.join(t, "second", "둘째")
	arena.hub.Queue(first)
	arena.hub.Queue(second)
	return first, second, firstBox, secondBox
}

func winnerOf(slot int) *int { return &slot }

func TestLoginSendsReadyWithRecord(t *testing.T) {
	arena := newTable()
	_, box := arena.join(t, "sub-1", "하늘")
	ready := box.last()
	if ready["type"] != "ready" || ready["name"] != "하늘" || ready["wins"] != float64(0) || ready["losses"] != float64(0) {
		t.Fatalf("ready = %v", ready)
	}
}

func TestDisconnectOfSomeoneNotWaitingKeepsTheWaitingPlayerQueued(t *testing.T) {
	arena := newTable()
	waiting, waitingBox := arena.join(t, "waiting", "기다리는 사람")
	stranger, _ := arena.join(t, "stranger", "지나가는 사람")
	late, lateBox := arena.join(t, "late", "늦은 사람")
	arena.hub.Queue(waiting)
	arena.hub.Disconnect(stranger)
	arena.hub.Queue(late)
	if waitingBox.count("matched") != 1 || lateBox.count("matched") != 1 {
		t.Fatalf("기다리던 사람과 늦은 사람이 짝지어지지 않았다: %v, %v", waitingBox.types(), lateBox.types())
	}
}

func TestLoginRejectsDuplicateAccountUntilFirstDisconnects(t *testing.T) {
	arena := newTable()
	first, _ := arena.join(t, "sub-1", "하늘")
	if _, err := arena.hub.Login("sub-1", "하늘", (&inbox{}).send); !errors.Is(err, errAlreadyOnline) {
		t.Fatalf("중복 접속 오류 = %v", err)
	}
	arena.hub.Disconnect(first)
	if _, err := arena.hub.Login("sub-1", "하늘", (&inbox{}).send); err != nil {
		t.Fatalf("끊긴 뒤 다시 접속하지 못했다: %v", err)
	}
}

type failingStore struct{ Store }

func (failingStore) Login(string, string) (Account, error) {
	return Account{}, errors.New("저장소 오류")
}

func (failingStore) Record(string, string) (Account, Account, error) {
	return Account{}, Account{}, errors.New("저장소 오류")
}

func TestLoginReportsStoreFailure(t *testing.T) {
	hub := NewHub(failingStore{})
	if _, err := hub.Login("sub-1", "", (&inbox{}).send); err == nil {
		t.Fatal("저장소 오류가 알려지지 않았다")
	}
}

func TestQueueWaitsForSecondPlayerThenMatchesInOrder(t *testing.T) {
	arena := newTable()
	first, firstBox := arena.join(t, "first", "첫째")
	second, secondBox := arena.join(t, "second", "둘째")

	arena.hub.Queue(first)
	if firstBox.last()["type"] != "waiting" {
		t.Fatalf("대기 응답 = %v", firstBox.last())
	}
	arena.hub.Queue(second)

	firstMatch, secondMatch := firstBox.last(), secondBox.last()
	if firstMatch["type"] != "matched" || firstMatch["slot"] != float64(0) {
		t.Fatalf("먼저 들어온 사람 = %v", firstMatch)
	}
	if secondMatch["slot"] != float64(1) {
		t.Fatalf("나중에 들어온 사람 = %v", secondMatch)
	}
	opponent := firstMatch["opponent"].(map[string]any)
	if opponent["name"] != "둘째" {
		t.Fatalf("상대 정보 = %v", opponent)
	}
}

func TestQueueTwiceDoesNotMatchPlayerWithSelf(t *testing.T) {
	arena := newTable()
	player, box := arena.join(t, "only", "혼자")
	arena.hub.Queue(player)
	arena.hub.Queue(player)
	if box.count("matched") != 0 || box.count("waiting") != 2 {
		t.Fatalf("받은 메시지 = %v", box.types())
	}
}

func TestQueueIsRejectedWhileMatchIsRunning(t *testing.T) {
	arena := newTable()
	first, _, firstBox, _ := arena.matchedPair(t)
	arena.hub.Queue(first)
	if firstBox.last()["type"] != "error" {
		t.Fatalf("대전 중 대기열 응답 = %v", firstBox.last())
	}
}

func TestCancelRemovesPlayerFromQueue(t *testing.T) {
	arena := newTable()
	first, _ := arena.join(t, "first", "첫째")
	second, secondBox := arena.join(t, "second", "둘째")
	arena.hub.Queue(first)
	arena.hub.Cancel(first)
	arena.hub.Queue(second)
	if secondBox.count("matched") != 0 {
		t.Fatal("취소한 사람과 짝이 지어졌다")
	}
}

func TestInputIsRelayedToOpponentOnly(t *testing.T) {
	arena := newTable()
	first, _, firstBox, secondBox := arena.matchedPair(t)
	arena.hub.Input(first, 7, 33)
	relayed := secondBox.last()
	if relayed["type"] != "input" || relayed["frame"] != float64(7) || relayed["bits"] != float64(33) {
		t.Fatalf("상대가 받은 입력 = %v", relayed)
	}
	if firstBox.count("input") != 0 {
		t.Fatal("보낸 사람에게 입력이 돌아왔다")
	}
}

func TestInputRejectsOutOfRangeValues(t *testing.T) {
	arena := newTable()
	first, _, firstBox, secondBox := arena.matchedPair(t)
	arena.hub.Input(first, -1, 0)
	arena.hub.Input(first, 0, 256)
	arena.hub.Input(first, 0, -1)
	if firstBox.count("error") != 3 || secondBox.count("input") != 0 {
		t.Fatalf("첫째 = %v, 둘째 = %v", firstBox.types(), secondBox.types())
	}
}

func TestInputWithoutMatchIsIgnored(t *testing.T) {
	arena := newTable()
	player, box := arena.join(t, "alone", "혼자")
	arena.hub.Input(player, 1, 1)
	if len(box.types()) != 1 {
		t.Fatalf("받은 메시지 = %v", box.types())
	}
}

func TestMatchingReportsAreRecordedOnceForBoth(t *testing.T) {
	arena := newTable()
	first, second, firstBox, secondBox := arena.matchedPair(t)
	arena.hub.Report(first, winnerOf(1))
	if firstBox.count("recorded") != 0 {
		t.Fatal("한 사람의 보고만으로 기록되었다")
	}
	arena.hub.Report(second, winnerOf(1))

	winnerRecord, loserRecord := secondBox.last(), firstBox.last()
	if winnerRecord["type"] != "recorded" || winnerRecord["wins"] != float64(1) || winnerRecord["losses"] != float64(0) {
		t.Fatalf("이긴 사람이 받은 기록 = %v", winnerRecord)
	}
	if loserRecord["type"] != "recorded" || loserRecord["wins"] != float64(0) || loserRecord["losses"] != float64(1) {
		t.Fatalf("진 사람이 받은 기록 = %v", loserRecord)
	}

	arena.hub.Report(first, winnerOf(1))
	arena.hub.Report(second, winnerOf(1))
	if firstBox.count("recorded") != 1 || secondBox.count("recorded") != 1 {
		t.Fatal("같은 판이 두 번 기록되었다")
	}
}

func TestMismatchedReportsAreNotRecorded(t *testing.T) {
	arena := newTable()
	first, second, firstBox, secondBox := arena.matchedPair(t)
	arena.hub.Report(first, winnerOf(0))
	arena.hub.Report(second, winnerOf(1))
	if firstBox.count("recorded")+secondBox.count("recorded") != 0 {
		t.Fatal("어긋난 보고가 기록되었다")
	}
	if firstBox.last()["type"] != "error" || secondBox.last()["type"] != "error" {
		t.Fatal("어긋난 보고가 알려지지 않았다")
	}
	account, _ := arena.store.Login("first", "")
	if account.Wins != 0 || account.Losses != 0 {
		t.Fatalf("저장된 기록 = %+v", account)
	}
}

func TestReportValidation(t *testing.T) {
	arena := newTable()
	alone, aloneBox := arena.join(t, "alone", "혼자")
	arena.hub.Report(alone, winnerOf(0))
	if aloneBox.last()["type"] != "error" {
		t.Fatal("대전 없이 한 보고가 받아들여졌다")
	}
	first, _, firstBox, _ := arena.matchedPair(t)
	arena.hub.Report(first, nil)
	arena.hub.Report(first, winnerOf(2))
	if firstBox.count("error") != 2 {
		t.Fatalf("잘못된 보고 응답 = %v", firstBox.types())
	}
}

func TestLeavingMidMatchGivesWinToRemainingPlayer(t *testing.T) {
	arena := newTable()
	first, _, firstBox, secondBox := arena.matchedPair(t)
	arena.hub.Disconnect(first)

	if secondBox.count("opponentLeft") != 1 {
		t.Fatalf("남은 사람이 받은 메시지 = %v", secondBox.types())
	}
	recorded := secondBox.last()
	if recorded["type"] != "recorded" || recorded["wins"] != float64(1) {
		t.Fatalf("남은 사람의 기록 = %v", recorded)
	}
	leaver, _ := arena.store.Login("first", "")
	if leaver.Losses != 1 {
		t.Fatalf("떠난 사람의 기록 = %+v", leaver)
	}
	if firstBox.count("opponentLeft") != 0 {
		t.Fatal("떠난 사람에게 이탈 알림이 갔다")
	}
}

func TestLeavingAfterRecordingDoesNotRecordTwice(t *testing.T) {
	arena := newTable()
	first, second, _, secondBox := arena.matchedPair(t)
	arena.hub.Report(first, winnerOf(1))
	arena.hub.Report(second, winnerOf(1))
	arena.hub.Leave(first)

	if secondBox.count("opponentLeft") != 1 || secondBox.count("recorded") != 1 {
		t.Fatalf("남은 사람이 받은 메시지 = %v", secondBox.types())
	}
	winner, _ := arena.store.Login("second", "")
	if winner.Wins != 1 {
		t.Fatalf("이긴 사람의 기록 = %+v", winner)
	}
}

func TestLeavingAfterMismatchDoesNotRecord(t *testing.T) {
	arena := newTable()
	first, second, _, secondBox := arena.matchedPair(t)
	arena.hub.Report(first, winnerOf(0))
	arena.hub.Report(second, winnerOf(1))
	arena.hub.Leave(first)
	if secondBox.count("recorded") != 0 {
		t.Fatal("어긋난 판이 이탈로 기록되었다")
	}
}

func TestPlayerCanQueueAgainAfterMatchEnds(t *testing.T) {
	arena := newTable()
	first, second, firstBox, secondBox := arena.matchedPair(t)
	arena.hub.Report(first, winnerOf(0))
	arena.hub.Report(second, winnerOf(0))
	arena.hub.Queue(first)
	arena.hub.Queue(second)
	if firstBox.count("matched") != 2 || secondBox.count("matched") != 2 {
		t.Fatalf("다시 짝이 지어지지 않았다: %v %v", firstBox.types(), secondBox.types())
	}
}

func TestInputIsNotRelayedToPlayerWhoStartedNewQueue(t *testing.T) {
	arena := newTable()
	first, second, _, secondBox := arena.matchedPair(t)
	arena.hub.Report(first, winnerOf(0))
	arena.hub.Report(second, winnerOf(0))
	arena.hub.Queue(second)
	before := secondBox.count("input")
	arena.hub.Input(first, 1, 1)
	if secondBox.count("input") != before {
		t.Fatal("새 대기열에 들어간 사람에게 이전 판의 입력이 갔다")
	}
}

func TestRecordFailureIsReportedToBoth(t *testing.T) {
	store, _ := OpenFileStore("")
	hub := NewHub(store)
	firstBox, secondBox := &inbox{}, &inbox{}
	first, _ := hub.Login("first", "첫째", firstBox.send)
	second, _ := hub.Login("second", "둘째", secondBox.send)
	hub.Queue(first)
	hub.Queue(second)
	hub.store = failingStore{store}
	hub.Report(first, winnerOf(0))
	hub.Report(second, winnerOf(0))
	if firstBox.last()["type"] != "error" || secondBox.last()["type"] != "error" {
		t.Fatalf("기록 실패가 알려지지 않았다: %v %v", firstBox.types(), secondBox.types())
	}
}

func TestHubIsSafeUnderConcurrentUse(t *testing.T) {
	arena := newTable()
	var group sync.WaitGroup
	for index := range 20 {
		group.Add(1)
		go func() {
			defer group.Done()
			box := &inbox{}
			player, err := arena.hub.Login("sub-"+string(rune('a'+index)), "", box.send)
			if err != nil {
				return
			}
			arena.hub.Queue(player)
			arena.hub.Input(player, index, index)
			arena.hub.Disconnect(player)
		}()
	}
	group.Wait()
}

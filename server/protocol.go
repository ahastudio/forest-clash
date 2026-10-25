package main

// 클라이언트가 서버로 보내는 메시지 종류.
const (
	typeHello  = "hello"
	typeQueue  = "queue"
	typeCancel = "cancel"
	typeInput  = "input"
	typeResult = "result"
	typeLeave  = "leave"
	typePing   = "ping"
)

// 서버가 클라이언트로 보내는 메시지 종류.
const (
	typeReady        = "ready"
	typeWaiting      = "waiting"
	typeMatched      = "matched"
	typeRecorded     = "recorded"
	typeOpponentLeft = "opponentLeft"
	typeError        = "error"
	typePong         = "pong"
)

const maxInputBits = 255

// clientMessage는 클라이언트가 보내는 모든 메시지의 모양이다. 종류마다 쓰는 필드가 다르다.
type clientMessage struct {
	Type   string `json:"type"`
	Token  string `json:"token"`
	Frame  int    `json:"frame"`
	Bits   int    `json:"bits"`
	Winner *int   `json:"winner"`
	// Sent는 ping을 보낸 시각이다. 서버는 해석하지 않고 pong에 그대로 돌려준다.
	Sent float64 `json:"sent"`
}

// pongMessage는 ping에 대한 답이다. 클라이언트가 보낸 시각을 그대로 돌려주어 왕복 시간을 재게 한다.
type pongMessage struct {
	Type string  `json:"type"`
	Sent float64 `json:"sent"`
}

type readyMessage struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	Wins   int    `json:"wins"`
	Losses int    `json:"losses"`
}

type waitingMessage struct {
	Type string `json:"type"`
}

type opponentInfo struct {
	Name   string `json:"name"`
	Wins   int    `json:"wins"`
	Losses int    `json:"losses"`
}

type matchedMessage struct {
	Type     string       `json:"type"`
	Slot     int          `json:"slot"`
	Opponent opponentInfo `json:"opponent"`
}

type inputMessage struct {
	Type  string `json:"type"`
	Frame int    `json:"frame"`
	Bits  int    `json:"bits"`
}

type recordedMessage struct {
	Type   string `json:"type"`
	Wins   int    `json:"wins"`
	Losses int    `json:"losses"`
}

type opponentLeftMessage struct {
	Type string `json:"type"`
}

type errorMessage struct {
	Type   string `json:"type"`
	Reason string `json:"reason"`
}

func newReady(account Account) readyMessage {
	return readyMessage{Type: typeReady, Name: account.Name, Wins: account.Wins, Losses: account.Losses}
}

func newMatched(slot int, opponent Account) matchedMessage {
	info := opponentInfo{Name: opponent.Name, Wins: opponent.Wins, Losses: opponent.Losses}
	return matchedMessage{Type: typeMatched, Slot: slot, Opponent: info}
}

func newRecorded(account Account) recordedMessage {
	return recordedMessage{Type: typeRecorded, Wins: account.Wins, Losses: account.Losses}
}

func newPong(sent float64) pongMessage {
	return pongMessage{Type: typePong, Sent: sent}
}

func newError(reason string) errorMessage {
	return errorMessage{Type: typeError, Reason: reason}
}

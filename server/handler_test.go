package main

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

const waitLimit = 5 * time.Second

type liveServer struct {
	*httptest.Server
	key   *rsa.PrivateKey
	store *FileStore
}

func startServer(t *testing.T, allowedOrigin string) *liveServer {
	t.Helper()
	return startConfiguredServer(t, allowedOrigin, func(*Server) {})
}

// startConfiguredServer는 서버를 켜기 전에 시험에 맞게 설정을 바꿀 수 있다.
func startConfiguredServer(t *testing.T, allowedOrigin string, configure func(*Server)) *liveServer {
	t.Helper()
	key := newTestKey(t)
	store, _ := OpenFileStore("")
	server := NewServer(NewHub(store), newTestVerifier(key), allowedOrigin)
	server.helloLimit = 300 * time.Millisecond
	configure(server)
	live := &liveServer{Server: httptest.NewServer(server.Routes()), key: key, store: store}
	t.Cleanup(live.Close)
	return live
}

type client struct {
	t      *testing.T
	socket *websocket.Conn
}

func (live *liveServer) dial(t *testing.T) *client {
	t.Helper()
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	address := "ws" + strings.TrimPrefix(live.URL, "http") + "/ws"
	socket, _, err := websocket.Dial(lifetime, address, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = socket.CloseNow() })
	return &client{t: t, socket: socket}
}

func (peer *client) send(message map[string]any) {
	peer.t.Helper()
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	content, _ := json.Marshal(message)
	if err := peer.socket.Write(lifetime, websocket.MessageText, content); err != nil {
		peer.t.Fatal(err)
	}
}

func (peer *client) receive() map[string]any {
	peer.t.Helper()
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	_, content, err := peer.socket.Read(lifetime)
	if err != nil {
		peer.t.Fatal(err)
	}
	var message map[string]any
	_ = json.Unmarshal(content, &message)
	return message
}

func (peer *client) expect(messageType string) map[string]any {
	peer.t.Helper()
	message := peer.receive()
	if message["type"] != messageType {
		peer.t.Fatalf("받은 메시지 = %v, 기대한 종류 = %s", message, messageType)
	}
	return message
}

func (live *liveServer) login(t *testing.T, sub string) *client {
	t.Helper()
	peer := live.dial(t)
	peer.send(map[string]any{"type": "hello", "token": validToken(t, live.key, sub)})
	peer.expect("ready")
	return peer
}

func TestHealthEndpoint(t *testing.T) {
	live := startServer(t, "")
	response, err := http.Get(live.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("상태 = %d", response.StatusCode)
	}
}

func TestTwoClientsPlayAndGetRecorded(t *testing.T) {
	live := startServer(t, "")
	first := live.login(t, "first")
	second := live.login(t, "second")

	first.send(map[string]any{"type": "queue"})
	first.expect("waiting")
	second.send(map[string]any{"type": "queue"})
	second.expect("waiting")
	if slot := first.expect("matched")["slot"]; slot != float64(0) {
		t.Fatalf("첫째 슬롯 = %v", slot)
	}
	if slot := second.expect("matched")["slot"]; slot != float64(1) {
		t.Fatalf("둘째 슬롯 = %v", slot)
	}

	first.send(map[string]any{"type": "input", "frame": 3, "bits": 5})
	relayed := second.expect("input")
	if relayed["frame"] != float64(3) || relayed["bits"] != float64(5) {
		t.Fatalf("중계된 입력 = %v", relayed)
	}

	first.send(map[string]any{"type": "result", "winner": 0})
	second.send(map[string]any{"type": "result", "winner": 0})
	if wins := first.expect("recorded")["wins"]; wins != float64(1) {
		t.Fatalf("이긴 사람의 승수 = %v", wins)
	}
	if losses := second.expect("recorded")["losses"]; losses != float64(1) {
		t.Fatalf("진 사람의 패수 = %v", losses)
	}
}

func TestDisconnectGivesWinToOpponent(t *testing.T) {
	live := startServer(t, "")
	first := live.login(t, "first")
	second := live.login(t, "second")
	first.send(map[string]any{"type": "queue"})
	first.expect("waiting")
	second.send(map[string]any{"type": "queue"})
	second.expect("waiting")
	first.expect("matched")
	second.expect("matched")

	_ = first.socket.Close(websocket.StatusNormalClosure, "")
	second.expect("opponentLeft")
	if wins := second.expect("recorded")["wins"]; wins != float64(1) {
		t.Fatalf("남은 사람의 승수 = %v", wins)
	}
}

func TestDuplicateLoginIsRejected(t *testing.T) {
	live := startServer(t, "")
	live.login(t, "same")
	second := live.dial(t)
	second.send(map[string]any{"type": "hello", "token": validToken(t, live.key, "same")})
	second.expect("error")
}

func TestInvalidTokenIsRejected(t *testing.T) {
	live := startServer(t, "")
	peer := live.dial(t)
	peer.send(map[string]any{"type": "hello", "token": "garbage"})
	peer.expect("error")
}

func TestFirstMessageMustBeHello(t *testing.T) {
	live := startServer(t, "")
	peer := live.dial(t)
	peer.send(map[string]any{"type": "queue"})
	peer.expect("error")
}

func TestHelloTimeoutClosesConnection(t *testing.T) {
	live := startServer(t, "")
	peer := live.dial(t)
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	if _, _, err := peer.socket.Read(lifetime); err == nil {
		t.Fatal("hello 없이도 연결이 유지되었다")
	}
}

func TestPingIsAnsweredWithTheSameSentTime(t *testing.T) {
	live := startServer(t, "")
	peer := live.login(t, "sub")
	peer.send(map[string]any{"type": "ping", "sent": 1234.5})
	if sent := peer.expect("pong")["sent"]; sent != 1234.5 {
		t.Fatalf("pong의 sent = %v", sent)
	}
}

func TestUnparseableAndUnknownMessagesGetErrors(t *testing.T) {
	live := startServer(t, "")
	peer := live.login(t, "sub")
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	_ = peer.socket.Write(lifetime, websocket.MessageText, []byte("not json"))
	peer.expect("error")
	peer.send(map[string]any{"type": "dance"})
	peer.expect("error")
	peer.send(map[string]any{"type": "cancel"})
	peer.send(map[string]any{"type": "leave"})
	peer.send(map[string]any{"type": "queue"})
	peer.expect("waiting")
}

func TestOversizedMessageClosesConnection(t *testing.T) {
	live := startServer(t, "")
	peer := live.login(t, "sub")
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	_ = peer.socket.Write(lifetime, websocket.MessageText, []byte(strings.Repeat("a", maxMessageBytes+1)))
	if _, _, err := peer.socket.Read(lifetime); err == nil {
		t.Fatal("너무 큰 메시지 뒤에도 연결이 유지되었다")
	}
}

func TestOriginOutsideAllowedListIsRejected(t *testing.T) {
	live := startServer(t, "https://allowed.example")
	address := "ws" + strings.TrimPrefix(live.URL, "http") + "/ws"
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	options := &websocket.DialOptions{HTTPHeader: http.Header{"Origin": []string{"https://evil.example"}}}
	if _, _, err := websocket.Dial(lifetime, address, options); err == nil {
		t.Fatal("허용되지 않은 출처가 연결되었다")
	}
	options = &websocket.DialOptions{HTTPHeader: http.Header{"Origin": []string{"https://allowed.example"}}}
	socket, _, err := websocket.Dial(lifetime, address, options)
	if err != nil {
		t.Fatalf("허용된 출처가 거절되었다: %v", err)
	}
	_ = socket.CloseNow()
}

func TestOriginPatterns(t *testing.T) {
	if originPatterns("") != nil {
		t.Fatal("빈 값은 같은 출처만 허용해야 한다")
	}
	if got := originPatterns("https://game.example:8443"); len(got) != 1 || got[0] != "game.example:8443" {
		t.Fatalf("패턴 = %v", got)
	}
	if got := originPatterns(" game.example "); len(got) != 1 || got[0] != "game.example" {
		t.Fatalf("주소 형태가 아닌 값 = %v", got)
	}
}

func TestSlowConnectionIsDroppedWhenQueueIsFull(t *testing.T) {
	lifetime, cancel := context.WithCancel(context.Background())
	link := &connection{lifetime: lifetime, cancel: cancel, outbound: make(chan []byte, 1)}
	link.send(readyMessage{Type: typeReady})
	link.send(readyMessage{Type: typeReady})
	if lifetime.Err() == nil {
		t.Fatal("가득 찬 접속이 끊기지 않았다")
	}
	link.send(readyMessage{Type: typeReady})
}

func TestUnencodableMessagesAreNotSent(t *testing.T) {
	lifetime, cancel := context.WithCancel(context.Background())
	defer cancel()
	link := &connection{lifetime: lifetime, cancel: cancel, outbound: make(chan []byte, 1)}
	link.send(make(chan int))
	link.write(make(chan int))
	if len(link.outbound) != 0 || lifetime.Err() != nil {
		t.Fatal("만들 수 없는 메시지가 보내졌거나 접속이 끊겼다")
	}
}

// startPingingServer는 접속 확인의 간격과 응답을 기다리는 시간을 짧게 한 서버를 켠다.
func startPingingServer(t *testing.T, interval, timeout time.Duration) *liveServer {
	t.Helper()
	return startConfiguredServer(t, "", func(server *Server) {
		server.pingInterval = interval
		server.pingTimeout = timeout
	})
}

func TestAnsweredConnectionChecksKeepTheConnectionOpen(t *testing.T) {
	live := startPingingServer(t, 20*time.Millisecond, 2*time.Second)
	peer := live.login(t, "sub")
	time.Sleep(100 * time.Millisecond)
	peer.send(map[string]any{"type": "ping", "sent": 1})
	peer.expect("pong")
}

func TestUnansweredConnectionCheckClosesTheConnection(t *testing.T) {
	live := startPingingServer(t, 10*time.Millisecond, 30*time.Millisecond)
	peer := live.login(t, "sub")
	time.Sleep(200 * time.Millisecond)
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	if _, _, err := peer.socket.Read(lifetime); err == nil {
		t.Fatal("응답하지 않는 접속이 끊기지 않았다")
	}
}

func TestStubLoginPlaysAWholeMatch(t *testing.T) {
	store, _ := OpenFileStore("")
	server := NewServer(NewHub(store), NewStubVerifier(nil), "")
	live := &liveServer{Server: httptest.NewServer(server.Routes()), store: store}
	t.Cleanup(live.Close)
	first, second := live.dial(t), live.dial(t)
	first.send(map[string]any{"type": "hello", "token": "stub:one:고양이"})
	if ready := first.expect("ready"); ready["name"] != "고양이" {
		t.Fatalf("로그인 응답 = %v", ready)
	}
	first.send(map[string]any{"type": "queue"})
	first.expect("waiting")
	second.send(map[string]any{"type": "hello", "token": "stub:two:새싹"})
	second.expect("ready")
	second.send(map[string]any{"type": "queue"})
	second.expect("waiting")
	if matched := first.expect("matched"); matched["slot"] != float64(0) {
		t.Fatalf("먼저 들어온 사람의 자리 = %v", matched)
	}
	second.expect("matched")
	first.send(map[string]any{"type": "input", "frame": 3, "bits": 16})
	if relayed := second.expect("input"); relayed["frame"] != float64(3) || relayed["bits"] != float64(16) {
		t.Fatalf("전달된 입력 = %v", relayed)
	}
	for _, peer := range []*client{first, second} {
		peer.send(map[string]any{"type": "result", "winner": 0})
	}
	if recorded := first.expect("recorded"); recorded["wins"] != float64(1) {
		t.Fatalf("이긴 쪽의 기록 = %v", recorded)
	}
	if recorded := second.expect("recorded"); recorded["losses"] != float64(1) {
		t.Fatalf("진 쪽의 기록 = %v", recorded)
	}
}

func TestPublicReasonHidesInternalDetails(t *testing.T) {
	internal := fmt.Errorf("공개 키를 가져올 수 없습니다: %w", errors.New("dial tcp 203.0.113.7:443: i/o timeout"))
	if got := publicReason(internal); got != internalLoginReason {
		t.Fatalf("내부 오류의 사용자 문구 = %q", got)
	}
	if got := publicReason(fmt.Errorf("감싼 오류: %w", errTokenExpired)); got != errTokenExpired.Error() {
		t.Fatalf("알려도 되는 오류의 사용자 문구 = %q", got)
	}
}

func TestRateLimiterCountsPerWindow(t *testing.T) {
	now := time.Unix(100, 0)
	limiter := &rateLimiter{limit: 2, now: func() time.Time { return now }}
	var allowed []bool
	for range 3 {
		allowed = append(allowed, limiter.allow())
	}
	if !allowed[0] || !allowed[1] || allowed[2] {
		t.Fatalf("한 창에서 두 번까지만 받아야 한다: %v", allowed)
	}
	now = now.Add(time.Second)
	if !limiter.allow() {
		t.Fatal("새 창에서 다시 받아야 한다")
	}
}

func TestTooManyMessagesCloseTheConnection(t *testing.T) {
	live := startConfiguredServer(t, "", func(server *Server) { server.messageLimit = 3 })
	peer := live.login(t, "sub")
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	// 서버가 한도를 넘자마자 접속을 끊으므로 뒤의 전송은 실패할 수 있다.
	for range 10 {
		_ = peer.socket.Write(lifetime, websocket.MessageText, []byte(`{"type":"ping","sent":1}`))
	}
	sawError := false
	for {
		_, content, err := peer.socket.Read(lifetime)
		if err != nil {
			break
		}
		sawError = sawError || strings.Contains(string(content), `"type":"error"`)
	}
	if !sawError {
		t.Fatal("너무 빠른 메시지에 오류가 알려지지 않았다")
	}
}

func TestConnectionsBeyondTheLimitAreRefused(t *testing.T) {
	live := startConfiguredServer(t, "", func(server *Server) { server.maxConnections = 1 })
	live.login(t, "first")
	address := "ws" + strings.TrimPrefix(live.URL, "http") + "/ws"
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	if _, response, err := websocket.Dial(lifetime, address, nil); err == nil || response.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("한도를 넘은 접속이 거절되지 않았다: %v", err)
	}
}

func TestWriterCancelsTheConnectionWhenAWriteFails(t *testing.T) {
	cancelled := make(chan bool, 1)
	handler := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		socket, err := websocket.Accept(writer, request, nil)
		if err != nil {
			return
		}
		_ = socket.CloseNow()
		lifetime, cancel := context.WithCancel(request.Context())
		defer cancel()
		link := &connection{socket: socket, lifetime: lifetime, cancel: cancel, outbound: make(chan []byte, 1)}
		link.send(newError("보낼 수 없는 메시지"))
		link.runWriter()
		cancelled <- lifetime.Err() != nil
	})
	live := httptest.NewServer(handler)
	t.Cleanup(live.Close)
	lifetime, cancel := context.WithTimeout(context.Background(), waitLimit)
	defer cancel()
	socket, _, err := websocket.Dial(lifetime, "ws"+strings.TrimPrefix(live.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = socket.CloseNow() })
	if !<-cancelled {
		t.Fatal("쓰기에 실패했는데 접속이 닫히지 않았다")
	}
}

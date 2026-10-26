package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
)

const (
	maxMessageBytes = 1024
	// 구글 ID 토큰은 1KB를 넘으므로 첫 메시지(hello)만 더 크게 받는다.
	maxHelloBytes     = 8192
	defaultHelloLimit = 10 * time.Second
	writeTimeout      = 10 * time.Second
	// 접속이 살아 있는지 확인하는 간격과 응답을 기다리는 시간.
	defaultPingInterval = 30 * time.Second
	defaultPingTimeout  = 10 * time.Second
	outboundCapacity    = 256
	// 한 접속이 1초에 보낼 수 있는 메시지 수. 게임은 초당 45프레임이라 입력과 ping을 합쳐도 이보다 훨씬 적게 보낸다.
	defaultMessageLimit = 150
	// 한꺼번에 받는 접속 수. 로그인 전 접속도 센다.
	defaultMaxConnections = 2000
	// 로그인에 실패한 이유 가운데 서버 안쪽 사정(네트워크 주소, 파일 경로)이 섞인 것을 가리는 문구.
	internalLoginReason = "로그인할 수 없습니다. 잠시 뒤 다시 시도해 주세요"
)

// publicLoginErrors는 사용자에게 그대로 알려도 되는 로그인 실패 이유다. 이 밖의 오류는 서버 로그에만 남긴다.
var publicLoginErrors = []error{
	errMalformedToken, errUnsupportedAlg, errBadSignature, errWrongIssuer, errWrongAudience,
	errTokenExpired, errMissingSubject, errUnknownKey, errStubDisabled, errAlreadyOnline,
}

// publicReason은 로그인 실패 이유를 사용자에게 보낼 문구로 바꾼다.
func publicReason(cause error) string {
	for _, known := range publicLoginErrors {
		if errors.Is(cause, known) {
			return known.Error()
		}
	}
	return internalLoginReason
}

// rateLimiter는 1초 창마다 받은 메시지 수를 센다.
type rateLimiter struct {
	limit       int
	now         func() time.Time
	windowStart time.Time
	count       int
}

// allow는 이번 메시지를 받아도 되면 true다.
func (limiter *rateLimiter) allow() bool {
	now := limiter.now()
	if now.Sub(limiter.windowStart) >= time.Second {
		limiter.windowStart = now
		limiter.count = 0
	}
	limiter.count++
	return limiter.count <= limiter.limit
}

// Server는 웹소켓 접속을 받아 허브와 이어 준다.
type Server struct {
	hub            *Hub
	verifier       TokenVerifier
	originPatterns []string
	helloLimit     time.Duration
	pingInterval   time.Duration
	pingTimeout    time.Duration
	messageLimit   int
	maxConnections int64
	active         atomic.Int64
	now            func() time.Time
}

// NewServer는 기본 제한(메시지 수, 접속 수, 대기 시간)을 갖춘 서버를 만든다.
func NewServer(hub *Hub, verifier TokenVerifier, allowedOrigin string) *Server {
	return &Server{
		hub:            hub,
		verifier:       verifier,
		originPatterns: originPatterns(allowedOrigin),
		helloLimit:     defaultHelloLimit,
		pingInterval:   defaultPingInterval,
		pingTimeout:    defaultPingTimeout,
		messageLimit:   defaultMessageLimit,
		maxConnections: defaultMaxConnections,
		now:            time.Now,
	}
}

// Routes는 서버가 받는 주소를 돌려준다.
func (server *Server) Routes() http.Handler {
	router := http.NewServeMux()
	router.HandleFunc("GET /healthz", func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("ok"))
	})
	router.HandleFunc("GET /ws", server.serveWebSocket)
	return router
}

// originPatterns는 허용할 출처 주소(예: https://example.com)에서 웹소켓 라이브러리가 쓰는 호스트 형태를 만든다.
// 비어 있으면 요청을 받은 호스트와 같은 출처만 허용한다.
func originPatterns(allowedOrigin string) []string {
	if allowedOrigin == "" {
		return nil
	}
	if parsed, err := url.Parse(allowedOrigin); err == nil && parsed.Host != "" {
		return []string{parsed.Host}
	}
	return []string{strings.TrimSpace(allowedOrigin)}
}

// connection은 접속 하나에 딸린 값들이다.
type connection struct {
	socket   *websocket.Conn
	lifetime context.Context
	cancel   context.CancelFunc
	outbound chan []byte
	// 접속 확인의 간격과 응답을 기다리는 시간.
	pingInterval time.Duration
	pingTimeout  time.Duration
}

// send는 메시지를 보낼 줄에 넣고 바로 돌아온다. 줄이 가득 차면 느린 접속으로 보고 끊는다.
func (link *connection) send(message any) {
	content, err := json.Marshal(message)
	if err != nil {
		return
	}
	select {
	case link.outbound <- content:
	case <-link.lifetime.Done():
	default:
		link.cancel()
	}
}

// write는 줄을 거치지 않고 바로 쓴다. 로그인 실패처럼 보낸 직후 끊어야 하는 메시지에 쓴다.
func (link *connection) write(message any) {
	content, err := json.Marshal(message)
	if err != nil {
		return
	}
	writeContext, cancel := context.WithTimeout(link.lifetime, writeTimeout)
	defer cancel()
	_ = link.socket.Write(writeContext, websocket.MessageText, content)
}

// runWriter는 보낼 줄의 메시지를 차례로 소켓에 쓴다. 쓰기에 실패하면 접속을 끝낸다.
func (link *connection) runWriter() {
	for {
		select {
		case content := <-link.outbound:
			writeContext, cancel := context.WithTimeout(link.lifetime, writeTimeout)
			err := link.socket.Write(writeContext, websocket.MessageText, content)
			cancel()
			if err != nil {
				link.cancel()
				return
			}
		case <-link.lifetime.Done():
			return
		}
	}
}

// runPinger는 응답 없는 접속을 찾아 끊는다. 대기열에서 오래 가만히 있어도 살아 있는지 알 수 있다.
func (link *connection) runPinger() {
	ticker := time.NewTicker(link.pingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			pingContext, cancel := context.WithTimeout(link.lifetime, link.pingTimeout)
			err := link.socket.Ping(pingContext)
			cancel()
			if err != nil {
				link.cancel()
				return
			}
		case <-link.lifetime.Done():
			return
		}
	}
}

// admit은 접속 수를 하나 늘린다. 한도를 넘으면 되돌리고 거절한다. 받아들였으면 true다.
func (server *Server) admit(writer http.ResponseWriter) bool {
	if server.active.Add(1) > server.maxConnections {
		server.active.Add(-1)
		http.Error(writer, "접속이 가득 찼습니다", http.StatusServiceUnavailable)
		return false
	}
	return true
}

// newConnection은 소켓 하나에 보내기 대기열과 핑 설정을 붙여 접속을 만든다.
func (server *Server) newConnection(socket *websocket.Conn, lifetime context.Context, cancel context.CancelFunc) *connection {
	return &connection{
		socket:       socket,
		lifetime:     lifetime,
		cancel:       cancel,
		outbound:     make(chan []byte, outboundCapacity),
		pingInterval: server.pingInterval,
		pingTimeout:  server.pingTimeout,
	}
}

// serveWebSocket은 접속 하나의 한살이를 맡는다: 접속 수 확인, 웹소켓 승격, 로그인, 메시지 읽기.
func (server *Server) serveWebSocket(writer http.ResponseWriter, request *http.Request) {
	if !server.admit(writer) {
		return
	}
	defer server.active.Add(-1)
	socket, err := websocket.Accept(writer, request, &websocket.AcceptOptions{OriginPatterns: server.originPatterns})
	if err != nil {
		return
	}
	lifetime, cancel := context.WithCancel(request.Context())
	link := server.newConnection(socket, lifetime, cancel)
	defer cancel()
	defer socket.CloseNow()
	go link.runWriter()
	go link.runPinger()

	player := server.login(link)
	if player == nil {
		_ = socket.Close(websocket.StatusPolicyViolation, "login failed")
		return
	}
	defer server.hub.Disconnect(player)
	socket.SetReadLimit(maxMessageBytes)
	server.readLoop(link, player)
}

// login은 첫 메시지(hello)를 제한 시간 안에 받아 토큰을 검증하고 로그인시킨다. 실패하면 nil이다.
func (server *Server) login(link *connection) *Player {
	link.socket.SetReadLimit(maxHelloBytes)
	helloContext, cancel := context.WithTimeout(link.lifetime, server.helloLimit)
	defer cancel()
	message, ok := readHello(helloContext, link)
	if !ok {
		return nil
	}
	claims, err := server.verifier.Verify(helloContext, message.Token)
	if err != nil {
		return rejectLogin(link, err)
	}
	player, err := server.hub.Login(claims.Subject, claims.Name, link.send)
	if err != nil {
		return rejectLogin(link, err)
	}
	return player
}

// readHello는 첫 메시지를 읽는다. 읽지 못했거나 hello가 아니면 false이고, hello가 아닌 경우에는 사용자에게 알린다.
func readHello(helloContext context.Context, link *connection) (clientMessage, bool) {
	_, content, err := link.socket.Read(helloContext)
	if err != nil {
		return clientMessage{}, false
	}
	var message clientMessage
	if json.Unmarshal(content, &message) != nil || message.Type != typeHello {
		link.write(newError("첫 메시지는 hello여야 합니다"))
		return clientMessage{}, false
	}
	return message, true
}

// rejectLogin은 실패 이유를 서버 로그에 남기고, 사용자에게는 알려도 되는 문구만 보낸다. 항상 nil을 돌려준다.
func rejectLogin(link *connection, cause error) *Player {
	log.Printf("로그인 실패: %v", cause)
	link.write(newError(publicReason(cause)))
	return nil
}

// readLoop는 로그인한 접속의 메시지를 끝날 때까지 읽어 나눠 준다. 메시지가 너무 빠르면 접속을 끊는다.
func (server *Server) readLoop(link *connection, player *Player) {
	limiter := &rateLimiter{limit: server.messageLimit, now: server.now}
	for {
		_, content, err := link.socket.Read(link.lifetime)
		if err != nil {
			return
		}
		if !limiter.allow() {
			link.write(newError("메시지를 너무 빠르게 보내 접속을 끊습니다"))
			return
		}
		var message clientMessage
		if json.Unmarshal(content, &message) != nil {
			link.send(newError("메시지 형식이 올바르지 않습니다"))
			continue
		}
		server.dispatch(player, message)
	}
}

// dispatch는 메시지 종류에 맞는 허브 동작을 부른다.
func (server *Server) dispatch(player *Player, message clientMessage) {
	switch message.Type {
	case typeQueue:
		server.hub.Queue(player)
	case typeCancel:
		server.hub.Cancel(player)
	case typeInput:
		server.hub.Input(player, message.Frame, message.Bits)
	case typeResult:
		server.hub.Report(player, message.Winner)
	case typeLeave:
		server.hub.Leave(player)
	case typePing:
		player.send(newPong(message.Sent))
	default:
		player.send(newError("알 수 없는 메시지입니다"))
	}
}

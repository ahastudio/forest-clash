package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
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
)

// Server는 웹소켓 접속을 받아 허브와 이어 준다.
type Server struct {
	hub            *Hub
	verifier       TokenVerifier
	originPatterns []string
	helloLimit     time.Duration
	pingInterval   time.Duration
	pingTimeout    time.Duration
}

func NewServer(hub *Hub, verifier TokenVerifier, allowedOrigin string) *Server {
	return &Server{
		hub:            hub,
		verifier:       verifier,
		originPatterns: originPatterns(allowedOrigin),
		helloLimit:     defaultHelloLimit,
		pingInterval:   defaultPingInterval,
		pingTimeout:    defaultPingTimeout,
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

func (server *Server) serveWebSocket(writer http.ResponseWriter, request *http.Request) {
	socket, err := websocket.Accept(writer, request, &websocket.AcceptOptions{OriginPatterns: server.originPatterns})
	if err != nil {
		return
	}
	lifetime, cancel := context.WithCancel(request.Context())
	link := &connection{
		socket:       socket,
		lifetime:     lifetime,
		cancel:       cancel,
		outbound:     make(chan []byte, outboundCapacity),
		pingInterval: server.pingInterval,
		pingTimeout:  server.pingTimeout,
	}
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
	_, content, err := link.socket.Read(helloContext)
	if err != nil {
		return nil
	}
	var message clientMessage
	if json.Unmarshal(content, &message) != nil || message.Type != typeHello {
		link.write(newError("첫 메시지는 hello여야 합니다"))
		return nil
	}
	claims, err := server.verifier.Verify(link.lifetime, message.Token)
	if err != nil {
		link.write(newError(err.Error()))
		return nil
	}
	player, err := server.hub.Login(claims.Subject, claims.Name, link.send)
	if err != nil {
		link.write(newError(err.Error()))
		return nil
	}
	return player
}

func (server *Server) readLoop(link *connection, player *Player) {
	for {
		_, content, err := link.socket.Read(link.lifetime)
		if err != nil {
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

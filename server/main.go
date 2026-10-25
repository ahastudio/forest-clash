package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const (
	defaultPort     = "58970"
	defaultDataFile = "forest-clash-data.json"
	shutdownTimeout = 5 * time.Second
	headerTimeout   = 5 * time.Second
	keysTimeout     = 10 * time.Second
)

// config는 환경 변수에서 읽은 설정이다.
type config struct {
	port           string
	googleClientID string
	allowedOrigin  string
	dataFile       string
	// authStub가 켜지면 구글 없이 stub 토큰으로 로그인할 수 있다. 로컬 개발에서만 켠다.
	authStub bool
}

func loadConfig(getenv func(string) string) (config, error) {
	loaded := config{
		port:           valueOrDefault(getenv("PORT"), defaultPort),
		googleClientID: getenv("GOOGLE_CLIENT_ID"),
		allowedOrigin:  getenv("ALLOWED_ORIGIN"),
		dataFile:       valueOrDefault(getenv("DATA_FILE"), defaultDataFile),
		authStub:       getenv("AUTH_STUB") == "1",
	}
	if loaded.googleClientID == "" && !loaded.authStub {
		return config{}, errors.New("GOOGLE_CLIENT_ID 환경 변수가 필요합니다(로컬 개발이면 AUTH_STUB=1)")
	}
	return loaded, nil
}

func valueOrDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

// newVerifier는 설정에 맞는 토큰 검증기를 만든다. 구글 클라이언트 아이디가 있으면 구글 토큰을 검증하고,
// stub이 켜져 있으면 그 앞에 stub 로그인을 둔다.
func newVerifier(settings config) TokenVerifier {
	var google TokenVerifier
	if settings.googleClientID != "" {
		keys := NewGoogleKeys(&http.Client{Timeout: keysTimeout}, googleKeysURL, time.Now)
		google = NewVerifier(settings.googleClientID, keys, time.Now)
	}
	if !settings.authStub {
		return google
	}
	log.Print("경고: AUTH_STUB가 켜져 있어 누구나 stub 토큰으로 로그인할 수 있습니다. 로컬 개발에서만 쓰세요")
	return NewStubVerifier(google)
}

func run(lifetime context.Context, settings config) error {
	store, err := OpenFileStore(settings.dataFile)
	if err != nil {
		return err
	}
	server := NewServer(NewHub(store), newVerifier(settings), settings.allowedOrigin)
	httpServer := &http.Server{
		Addr:              ":" + settings.port,
		Handler:           server.Routes(),
		ReadHeaderTimeout: headerTimeout,
	}
	go func() {
		<-lifetime.Done()
		shutdownContext, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		_ = httpServer.Shutdown(shutdownContext)
	}()
	log.Printf("서버를 시작합니다: %s", httpServer.Addr)
	if err := httpServer.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// exit은 프로세스를 끝내는 방법이다. 테스트에서는 기록만 하는 것으로 바꾼다.
var exit = os.Exit

func main() {
	settings, err := loadConfig(os.Getenv)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		exit(1)
		return
	}
	lifetime, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(lifetime, settings); err != nil {
		log.Print(err)
		exit(1)
	}
}

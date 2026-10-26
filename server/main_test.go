package main

import (
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

// recordExit는 프로세스를 끝내는 대신 종료 번호를 기록하게 바꾼다.
func recordExit(t *testing.T) *[]int {
	t.Helper()
	var codes []int
	saved := exit
	exit = func(code int) { codes = append(codes, code) }
	t.Cleanup(func() { exit = saved })
	return &codes
}

func useStubSettings(t *testing.T, port string) {
	t.Helper()
	t.Setenv("AUTH_STUB", "1")
	t.Setenv("PORT", port)
	t.Setenv("DATA_FILE", filepath.Join(t.TempDir(), "data.json"))
}

func freePort(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	_, port, _ := net.SplitHostPort(listener.Addr().String())
	return port
}

func waitUntilHealthy(t *testing.T, port string) {
	t.Helper()
	deadline := time.Now().Add(waitLimit)
	for time.Now().Before(deadline) {
		if response, err := http.Get("http://127.0.0.1:" + port + "/healthz"); err == nil {
			_ = response.Body.Close()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("서버가 시간 안에 켜지지 않았다")
}

func TestMainExitsWithOneWhenConfigIsMissing(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("AUTH_STUB", "")
	codes := recordExit(t)
	main()
	if len(*codes) != 1 || (*codes)[0] != 1 {
		t.Fatalf("종료 번호 = %v", *codes)
	}
}

func TestMainExitsWithOneWhenTheServerCannotStart(t *testing.T) {
	useStubSettings(t, "not-a-port")
	codes := recordExit(t)
	main()
	if len(*codes) != 1 || (*codes)[0] != 1 {
		t.Fatalf("종료 번호 = %v", *codes)
	}
}

func TestMainServesUntilTerminated(t *testing.T) {
	port := freePort(t)
	useStubSettings(t, port)
	codes := recordExit(t)
	finished := make(chan struct{})
	go func() {
		main()
		close(finished)
	}()
	waitUntilHealthy(t, port)
	if err := syscall.Kill(os.Getpid(), syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}
	select {
	case <-finished:
	case <-time.After(waitLimit):
		t.Fatal("종료 신호를 받고도 서버가 끝나지 않았다")
	}
	if len(*codes) != 0 {
		t.Fatalf("종료 번호 = %v", *codes)
	}
}

func TestRunReportsAnUnreadableDataFile(t *testing.T) {
	err := run(context.Background(), config{dataFile: t.TempDir(), authStub: true, port: "0"})
	if err == nil {
		t.Fatal("읽을 수 없는 저장 파일이 알려지지 않았다")
	}
}

func TestLoadConfigUsesDefaults(t *testing.T) {
	environment := map[string]string{"GOOGLE_CLIENT_ID": "client"}
	settings, err := loadConfig(func(name string) string { return environment[name] })
	if err != nil {
		t.Fatal(err)
	}
	if settings.port != defaultPort || settings.dataFile != defaultDataFile || settings.googleClientID != "client" {
		t.Fatalf("설정 = %+v", settings)
	}
}

func TestLoadConfigReadsEnvironment(t *testing.T) {
	environment := map[string]string{
		"PORT":             "9000",
		"GOOGLE_CLIENT_ID": "client",
		"ALLOWED_ORIGIN":   "https://game.example",
		"DATA_FILE":        "records.json",
	}
	settings, _ := loadConfig(func(name string) string { return environment[name] })
	if settings.port != "9000" || settings.allowedOrigin != "https://game.example" || settings.dataFile != "records.json" {
		t.Fatalf("설정 = %+v", settings)
	}
}

func TestLoadConfigAllowsMissingClientIDOnlyWithStub(t *testing.T) {
	settings, err := loadConfig(func(name string) string {
		if name == "AUTH_STUB" {
			return "1"
		}
		return ""
	})
	if err != nil || !settings.authStub || settings.googleClientID != "" {
		t.Fatalf("설정 = %+v, 오류 = %v", settings, err)
	}
}

func TestNewVerifierPicksByConfig(t *testing.T) {
	if _, ok := newVerifier(config{googleClientID: "client"}).(*Verifier); !ok {
		t.Fatal("구글 클라이언트 아이디만 있으면 구글 검증기여야 한다")
	}
	if _, ok := newVerifier(config{googleClientID: "client", authStub: true}).(*StubVerifier); !ok {
		t.Fatal("stub이 켜지면 stub 검증기여야 한다")
	}
	if _, ok := newVerifier(config{authStub: true}).(*StubVerifier); !ok {
		t.Fatal("클라이언트 아이디가 없어도 stub이면 stub 검증기여야 한다")
	}
}

func TestLoadConfigRequiresGoogleClientID(t *testing.T) {
	if _, err := loadConfig(func(string) string { return "" }); err == nil {
		t.Fatal("클라이언트 아이디 없이 설정이 만들어졌다")
	}
}

func TestLoadConfigRefusesStubWithHTTPSOrigin(t *testing.T) {
	environment := map[string]string{"AUTH_STUB": "1", "ALLOWED_ORIGIN": "https://forest-clash.example"}
	if _, err := loadConfig(func(name string) string { return environment[name] }); err == nil {
		t.Fatal("https 출처와 함께 stub 로그인이 켜졌다")
	}
	environment["ALLOWED_ORIGIN"] = "http://localhost:58969"
	if _, err := loadConfig(func(name string) string { return environment[name] }); err != nil {
		t.Fatalf("로컬 출처의 stub 로그인이 거절되었다: %v", err)
	}
}

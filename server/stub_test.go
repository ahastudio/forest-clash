package main

import (
	"context"
	"strings"
	"testing"
)

type recordingVerifier struct {
	tokens []string
}

func (recorder *recordingVerifier) Verify(_ context.Context, token string) (Claims, error) {
	recorder.tokens = append(recorder.tokens, token)
	return Claims{Subject: "google-sub", Name: "구글 이름"}, nil
}

func TestStubVerifierAcceptsStubToken(t *testing.T) {
	claims, err := NewStubVerifier(nil).Verify(context.Background(), "stub:abc_1-X:고양이")
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject != "stub:abc_1-X" || claims.Name != "고양이" {
		t.Fatalf("정보 = %+v", claims)
	}
}

func TestStubVerifierKeepsColonsInName(t *testing.T) {
	claims, err := NewStubVerifier(nil).Verify(context.Background(), "stub:abc:이름:뒤")
	if err != nil || claims.Name != "이름:뒤" {
		t.Fatalf("정보 = %+v, 오류 = %v", claims, err)
	}
}

func TestStubVerifierShortensAndTrimsName(t *testing.T) {
	longName := strings.Repeat("가", maxDisplayNameRunes+5)
	claims, _ := NewStubVerifier(nil).Verify(context.Background(), "stub:abc:  "+longName+"  ")
	if len([]rune(claims.Name)) != maxDisplayNameRunes {
		t.Fatalf("이름 글자 수 = %d", len([]rune(claims.Name)))
	}
}

func TestStubVerifierRejectsBadStubTokens(t *testing.T) {
	tooLong := strings.Repeat("a", maxStubIDBytes+1)
	for _, token := range []string{"stub:", "stub:abc", "stub::이름", "stub:a b:이름", "stub:한글:이름", "stub:" + tooLong + ":이름"} {
		if _, err := NewStubVerifier(nil).Verify(context.Background(), token); err == nil {
			t.Fatalf("%q 토큰이 통과했다", token)
		}
	}
}

func TestStubVerifierRejectsOtherTokensWithoutNext(t *testing.T) {
	if _, err := NewStubVerifier(nil).Verify(context.Background(), "a.b.c"); err != errStubDisabled {
		t.Fatalf("오류 = %v", err)
	}
}

func TestStubVerifierDelegatesOtherTokens(t *testing.T) {
	recorder := &recordingVerifier{}
	claims, err := NewStubVerifier(recorder).Verify(context.Background(), "a.b.c")
	if err != nil || claims.Subject != "google-sub" || len(recorder.tokens) != 1 {
		t.Fatalf("정보 = %+v, 오류 = %v, 받은 토큰 = %v", claims, err, recorder.tokens)
	}
}

func TestStubVerifierDoesNotDelegateStubTokens(t *testing.T) {
	recorder := &recordingVerifier{}
	_, _ = NewStubVerifier(recorder).Verify(context.Background(), "stub:abc:이름")
	if len(recorder.tokens) != 0 {
		t.Fatal("stub 토큰이 구글 검증으로 넘어갔다")
	}
}

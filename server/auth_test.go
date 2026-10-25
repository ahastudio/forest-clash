package main

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const testClientID = "test-client-id"

var testNow = time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

type fixedKeys map[string]*rsa.PublicKey

func (keys fixedKeys) Key(_ context.Context, keyID string) (*rsa.PublicKey, error) {
	if key, found := keys[keyID]; found {
		return key, nil
	}
	return nil, errUnknownKey
}

func newTestKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func encodeSegment(t *testing.T, value any) string {
	t.Helper()
	content, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(content)
}

type tokenSpec struct {
	algorithm string
	keyID     string
	payload   map[string]any
}

func signToken(t *testing.T, key *rsa.PrivateKey, spec tokenSpec) string {
	t.Helper()
	header := map[string]string{"alg": spec.algorithm, "kid": spec.keyID}
	signed := encodeSegment(t, header) + "." + encodeSegment(t, spec.payload)
	digest := sha256.Sum256([]byte(signed))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatal(err)
	}
	return signed + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func validPayload(subject string) map[string]any {
	return map[string]any{
		"iss":  "https://accounts.google.com",
		"aud":  testClientID,
		"exp":  testNow.Add(time.Hour).Unix(),
		"sub":  subject,
		"name": "시험 선수",
	}
}

func validToken(t *testing.T, key *rsa.PrivateKey, subject string) string {
	return signToken(t, key, tokenSpec{algorithm: "RS256", keyID: "key-1", payload: validPayload(subject)})
}

func newTestVerifier(key *rsa.PrivateKey) *Verifier {
	keys := fixedKeys{"key-1": &key.PublicKey}
	return NewVerifier(testClientID, keys, func() time.Time { return testNow })
}

func TestVerifyAcceptsValidToken(t *testing.T) {
	key := newTestKey(t)
	claims, err := newTestVerifier(key).Verify(context.Background(), validToken(t, key, "sub-1"))
	if err != nil || claims.Subject != "sub-1" || claims.Name != "시험 선수" {
		t.Fatalf("claims = %+v, 오류 = %v", claims, err)
	}
}

func TestVerifyAcceptsBareIssuer(t *testing.T) {
	key := newTestKey(t)
	payload := validPayload("sub-1")
	payload["iss"] = "accounts.google.com"
	token := signToken(t, key, tokenSpec{algorithm: "RS256", keyID: "key-1", payload: payload})
	if _, err := newTestVerifier(key).Verify(context.Background(), token); err != nil {
		t.Fatal(err)
	}
}

func TestVerifyRejectsInvalidTokens(t *testing.T) {
	key := newTestKey(t)
	otherKey := newTestKey(t)
	withChange := func(field string, value any) string {
		payload := validPayload("sub-1")
		payload[field] = value
		return signToken(t, key, tokenSpec{algorithm: "RS256", keyID: "key-1", payload: payload})
	}
	withoutSubject := validPayload("")
	cases := map[string]struct {
		token string
		want  error
	}{
		"만료":          {withChange("exp", testNow.Add(-time.Second).Unix()), errTokenExpired},
		"다른 대상":       {withChange("aud", "other-client"), errWrongAudience},
		"다른 발급자":      {withChange("iss", "https://evil.example"), errWrongIssuer},
		"서명 틀림":       {validToken(t, otherKey, "sub-1"), errBadSignature},
		"식별값 없음":      {signToken(t, key, tokenSpec{algorithm: "RS256", keyID: "key-1", payload: withoutSubject}), errMissingSubject},
		"다른 서명 방식":    {signToken(t, key, tokenSpec{algorithm: "none", keyID: "key-1", payload: validPayload("sub-1")}), errUnsupportedAlg},
		"모르는 키 번호":    {signToken(t, key, tokenSpec{algorithm: "RS256", keyID: "key-9", payload: validPayload("sub-1")}), errUnknownKey},
		"조각 수가 다름":    {"abc.def", errMalformedToken},
		"머리가 깨짐":      {"@@@.def.ghi", errMalformedToken},
		"머리가 JSON 아님": {base64.RawURLEncoding.EncodeToString([]byte("x")) + ".b.c", errMalformedToken},
	}
	for name, testCase := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := newTestVerifier(key).Verify(context.Background(), testCase.token)
			if !errors.Is(err, testCase.want) {
				t.Fatalf("오류 = %v, 기대 = %v", err, testCase.want)
			}
		})
	}
}

func TestVerifyRejectsBrokenSignatureEncodingAndPayload(t *testing.T) {
	key := newTestKey(t)
	header := encodeSegment(t, map[string]string{"alg": "RS256", "kid": "key-1"})
	verifier := newTestVerifier(key)
	if _, err := verifier.Verify(context.Background(), header+".e30.@@@"); !errors.Is(err, errMalformedToken) {
		t.Fatalf("서명 인코딩 오류 = %v", err)
	}
	signed := header + ".@@@"
	digest := sha256.Sum256([]byte(signed))
	signature, _ := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	token := signed + "." + base64.RawURLEncoding.EncodeToString(signature)
	if _, err := verifier.Verify(context.Background(), token); !errors.Is(err, errMalformedToken) {
		t.Fatalf("본문 인코딩 오류 = %v", err)
	}
}

func jwksFor(key *rsa.PrivateKey, keyID string) map[string]any {
	exponent := base64.RawURLEncoding.EncodeToString([]byte{1, 0, 1})
	modulus := base64.RawURLEncoding.EncodeToString(key.PublicKey.N.Bytes())
	return map[string]any{"keys": []map[string]string{
		{"kid": keyID, "kty": "RSA", "n": modulus, "e": exponent},
		{"kid": "not-rsa", "kty": "EC"},
		{"kid": "bad-encoding", "kty": "RSA", "n": "@@@", "e": "AQAB"},
	}}
}

type keyServer struct {
	*httptest.Server
	requests atomic.Int32
}

func newKeyServer(t *testing.T, body any, cacheControl string) *keyServer {
	t.Helper()
	server := &keyServer{}
	server.Server = httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		server.requests.Add(1)
		if cacheControl != "" {
			writer.Header().Set("Cache-Control", cacheControl)
		}
		_ = json.NewEncoder(writer).Encode(body)
	}))
	t.Cleanup(server.Close)
	return server
}

type clock struct{ current time.Time }

func (c *clock) now() time.Time { return c.current }

func TestGoogleKeysFetchesAndCaches(t *testing.T) {
	key := newTestKey(t)
	server := newKeyServer(t, jwksFor(key, "key-1"), "public, max-age=600")
	timer := &clock{current: testNow}
	provider := NewGoogleKeys(server.Client(), server.URL, timer.now)

	for range 3 {
		found, err := provider.Key(context.Background(), "key-1")
		if err != nil || found.N.Cmp(key.PublicKey.N) != 0 {
			t.Fatalf("키 = %v, 오류 = %v", found, err)
		}
	}
	if server.requests.Load() != 1 {
		t.Fatalf("요청 수 = %d", server.requests.Load())
	}

	timer.current = testNow.Add(11 * time.Minute)
	_, _ = provider.Key(context.Background(), "key-1")
	if server.requests.Load() != 2 {
		t.Fatalf("만료 뒤 요청 수 = %d", server.requests.Load())
	}
}

func TestGoogleKeysUseKnownKeysWhenRefreshFails(t *testing.T) {
	key := newTestKey(t)
	var failing atomic.Bool
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		if failing.Load() {
			writer.WriteHeader(http.StatusInternalServerError)
			return
		}
		writer.Header().Set("Cache-Control", "public, max-age=600")
		_ = json.NewEncoder(writer).Encode(jwksFor(key, "key-1"))
	}))
	t.Cleanup(server.Close)
	timer := &clock{current: testNow}
	provider := NewGoogleKeys(server.Client(), server.URL, timer.now)
	if _, err := provider.Key(context.Background(), "key-1"); err != nil {
		t.Fatal(err)
	}

	failing.Store(true)
	timer.current = testNow.Add(11 * time.Minute)
	if found, err := provider.Key(context.Background(), "key-1"); err != nil || found.N.Cmp(key.PublicKey.N) != 0 {
		t.Fatalf("가져오기에 실패했는데 받아 둔 키를 쓰지 못했다: 키 = %v, 오류 = %v", found, err)
	}
	if _, err := provider.Key(context.Background(), "key-1"); err != nil || requests.Load() != 2 {
		t.Fatalf("간격 안에서 다시 가져오려 했다: 요청 수 = %d, 오류 = %v", requests.Load(), err)
	}

	timer.current = testNow.Add(13 * time.Minute)
	if _, err := provider.Key(context.Background(), "key-9"); err == nil || errors.Is(err, errUnknownKey) {
		t.Fatalf("받아 둔 적 없는 키는 가져오기 오류여야 한다: %v", err)
	}
}

func TestVerifyCleansAndShortensGoogleNames(t *testing.T) {
	key := newTestKey(t)
	payload := validPayload("sub-1")
	payload["name"] = "  " + strings.Repeat("가", maxDisplayNameRunes+5) + "\x00\n"
	token := signToken(t, key, tokenSpec{algorithm: "RS256", keyID: "key-1", payload: payload})
	claims, err := newTestVerifier(key).Verify(context.Background(), token)
	if err != nil || len([]rune(claims.Name)) != maxDisplayNameRunes || strings.ContainsAny(claims.Name, "\x00\n") {
		t.Fatalf("이름 = %q, 오류 = %v", claims.Name, err)
	}
}

func TestGoogleKeysLimitsRefreshForUnknownKey(t *testing.T) {
	key := newTestKey(t)
	server := newKeyServer(t, jwksFor(key, "key-1"), "")
	timer := &clock{current: testNow}
	provider := NewGoogleKeys(server.Client(), server.URL, timer.now)

	if _, err := provider.Key(context.Background(), "key-9"); !errors.Is(err, errUnknownKey) {
		t.Fatalf("오류 = %v", err)
	}
	if _, err := provider.Key(context.Background(), "key-9"); !errors.Is(err, errUnknownKey) {
		t.Fatalf("오류 = %v", err)
	}
	if server.requests.Load() != 1 {
		t.Fatalf("간격 안의 요청 수 = %d", server.requests.Load())
	}

	timer.current = testNow.Add(2 * time.Minute)
	if _, err := provider.Key(context.Background(), "key-1"); err != nil {
		t.Fatal(err)
	}
}

func TestGoogleKeysReportsFetchFailures(t *testing.T) {
	failing := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusInternalServerError)
	}))
	defer failing.Close()
	broken := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte("not json"))
	}))
	defer broken.Close()
	timer := &clock{current: testNow}

	if _, err := NewGoogleKeys(failing.Client(), failing.URL, timer.now).Key(context.Background(), "k"); err == nil {
		t.Fatal("상태 오류가 알려지지 않았다")
	}
	if _, err := NewGoogleKeys(broken.Client(), broken.URL, timer.now).Key(context.Background(), "k"); err == nil {
		t.Fatal("형식 오류가 알려지지 않았다")
	}
	if _, err := NewGoogleKeys(http.DefaultClient, "http://127.0.0.1:1", timer.now).Key(context.Background(), "k"); err == nil {
		t.Fatal("연결 오류가 알려지지 않았다")
	}
	if _, err := NewGoogleKeys(http.DefaultClient, "://잘못된 주소", timer.now).Key(context.Background(), "k"); err == nil {
		t.Fatal("주소 오류가 알려지지 않았다")
	}
}

func TestKeyLifetimeReadsMaxAge(t *testing.T) {
	cases := map[string]time.Duration{
		"public, max-age=120": 120 * time.Second,
		"max-age=abc":         defaultKeyLifetime,
		"max-age=0":           defaultKeyLifetime,
		"no-store":            defaultKeyLifetime,
		"":                    defaultKeyLifetime,
	}
	for header, want := range cases {
		if got := keyLifetime(header); got != want {
			t.Errorf("keyLifetime(%q) = %v, 기대 = %v", header, got, want)
		}
	}
}

func TestVerifyWorksWithGoogleKeysEndToEnd(t *testing.T) {
	key := newTestKey(t)
	server := newKeyServer(t, jwksFor(key, "key-1"), "max-age=300")
	timer := &clock{current: testNow}
	verifier := NewVerifier(testClientID, NewGoogleKeys(server.Client(), server.URL, timer.now), timer.now)
	if _, err := verifier.Verify(context.Background(), validToken(t, key, "sub-1")); err != nil {
		t.Fatal(err)
	}
}

package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	googleKeysURL      = "https://www.googleapis.com/oauth2/v3/certs"
	defaultKeyLifetime = time.Hour
	// 모르는 키 번호가 오면 다시 가져오되, 잘못된 토큰이 쏟아져도 구글에 계속 요청하지 않도록 간격을 둔다.
	minimumRefreshInterval = time.Minute
	maxKeysResponseBytes   = 1 << 20
)

var (
	errMalformedToken  = errors.New("토큰 형식이 올바르지 않습니다")
	errUnsupportedAlg  = errors.New("지원하지 않는 서명 방식입니다")
	errBadSignature    = errors.New("토큰 서명이 올바르지 않습니다")
	errWrongIssuer     = errors.New("토큰 발급자가 올바르지 않습니다")
	errWrongAudience   = errors.New("토큰 대상이 이 서비스가 아닙니다")
	errTokenExpired    = errors.New("토큰이 만료되었습니다")
	errMissingSubject  = errors.New("토큰에 사용자 식별값이 없습니다")
	errUnknownKey      = errors.New("알 수 없는 서명 키입니다")
	googleIssuerValues = map[string]bool{"accounts.google.com": true, "https://accounts.google.com": true}
)

// Claims는 검증된 토큰에서 꺼낸 사용자 정보다. 이메일은 꺼내지 않는다.
type Claims struct {
	Subject string
	Name    string
}

// KeyProvider는 토큰 서명을 확인하는 공개 키를 키 번호로 찾아 준다.
// 구글에서 가져오는 쪽을 인터페이스로 빼 두어 시험에서는 만든 키를 쓴다.
type KeyProvider interface {
	Key(lifetime context.Context, keyID string) (*rsa.PublicKey, error)
}

// Verifier는 구글 ID 토큰(RS256)을 검증한다.
type Verifier struct {
	clientID string
	keys     KeyProvider
	now      func() time.Time
}

func NewVerifier(clientID string, keys KeyProvider, now func() time.Time) *Verifier {
	return &Verifier{clientID: clientID, keys: keys, now: now}
}

type tokenHeader struct {
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid"`
}

type tokenPayload struct {
	Issuer   string `json:"iss"`
	Audience string `json:"aud"`
	Expires  int64  `json:"exp"`
	Subject  string `json:"sub"`
	Name     string `json:"name"`
}

// Verify는 서명, 발급자, 대상, 만료를 모두 확인하고 사용자 정보를 돌려준다.
func (verifier *Verifier) Verify(lifetime context.Context, token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, errMalformedToken
	}
	var header tokenHeader
	if err := decodeSegment(parts[0], &header); err != nil {
		return Claims{}, err
	}
	if header.Algorithm != "RS256" {
		return Claims{}, errUnsupportedAlg
	}
	key, err := verifier.keys.Key(lifetime, header.KeyID)
	if err != nil {
		return Claims{}, err
	}
	if err := verifySignature(key, parts); err != nil {
		return Claims{}, err
	}
	var payload tokenPayload
	if err := decodeSegment(parts[1], &payload); err != nil {
		return Claims{}, err
	}
	return verifier.check(payload)
}

func (verifier *Verifier) check(payload tokenPayload) (Claims, error) {
	if !googleIssuerValues[payload.Issuer] {
		return Claims{}, errWrongIssuer
	}
	if payload.Audience != verifier.clientID {
		return Claims{}, errWrongAudience
	}
	if payload.Expires <= verifier.now().Unix() {
		return Claims{}, errTokenExpired
	}
	if payload.Subject == "" {
		return Claims{}, errMissingSubject
	}
	return Claims{Subject: payload.Subject, Name: shortName(payload.Name)}, nil
}

func decodeSegment(segment string, target any) error {
	content, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		return errMalformedToken
	}
	if err := json.Unmarshal(content, target); err != nil {
		return errMalformedToken
	}
	return nil
}

func verifySignature(key *rsa.PublicKey, parts []string) error {
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return errMalformedToken
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], signature); err != nil {
		return errBadSignature
	}
	return nil
}

// GoogleKeys는 구글의 공개 키 목록을 가져와 캐시한다.
type GoogleKeys struct {
	client *http.Client
	url    string
	now    func() time.Time

	mutex       sync.Mutex
	keys        map[string]*rsa.PublicKey
	expires     time.Time
	attemptedAt time.Time
}

func NewGoogleKeys(client *http.Client, url string, now func() time.Time) *GoogleKeys {
	return &GoogleKeys{client: client, url: url, now: now}
}

// Key는 키 번호의 공개 키를 돌려준다. 가져온 키는 캐시하고, 가져오기를 시도하는 간격에 제한을 둔다.
// 구글에서 새 키를 가져오지 못해도 이미 받은 키가 있으면 그 키로 확인해, 구글의 일시적인 장애가 모든 로그인을 막지 않게 한다.
func (provider *GoogleKeys) Key(lifetime context.Context, keyID string) (*rsa.PublicKey, error) {
	provider.mutex.Lock()
	defer provider.mutex.Unlock()
	now := provider.now()
	known := provider.keys[keyID]
	if known != nil && now.Before(provider.expires) {
		return known, nil
	}
	if now.Sub(provider.attemptedAt) < minimumRefreshInterval {
		return knownOrUnknown(known)
	}
	provider.attemptedAt = now
	if err := provider.fetch(lifetime, now); err != nil {
		return staleOrError(known, err)
	}
	return knownOrUnknown(provider.keys[keyID])
}

// knownOrUnknown은 키가 있으면 키를, 없으면 알 수 없는 키 오류를 돌려준다.
func knownOrUnknown(key *rsa.PublicKey) (*rsa.PublicKey, error) {
	if key == nil {
		return nil, errUnknownKey
	}
	return key, nil
}

// staleOrError는 새 키를 가져오지 못했을 때 이미 받은 키가 있으면 그것을, 없으면 가져오기 오류를 돌려준다.
func staleOrError(known *rsa.PublicKey, fetchErr error) (*rsa.PublicKey, error) {
	if known == nil {
		return nil, fetchErr
	}
	return known, nil
}

type jsonWebKey struct {
	KeyID    string `json:"kid"`
	KeyType  string `json:"kty"`
	Modulus  string `json:"n"`
	Exponent string `json:"e"`
}

func (provider *GoogleKeys) fetch(lifetime context.Context, now time.Time) error {
	request, err := http.NewRequestWithContext(lifetime, http.MethodGet, provider.url, nil)
	if err != nil {
		return fmt.Errorf("공개 키 요청을 만들 수 없습니다: %w", err)
	}
	response, err := provider.client.Do(request)
	if err != nil {
		return fmt.Errorf("공개 키를 가져올 수 없습니다: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("공개 키 응답이 올바르지 않습니다: %d", response.StatusCode)
	}
	var body struct {
		Keys []jsonWebKey `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, maxKeysResponseBytes)).Decode(&body); err != nil {
		return fmt.Errorf("공개 키 응답을 읽을 수 없습니다: %w", err)
	}
	keys := map[string]*rsa.PublicKey{}
	for _, webKey := range body.Keys {
		if key, ok := webKey.publicKey(); ok {
			keys[webKey.KeyID] = key
		}
	}
	provider.keys = keys
	provider.expires = now.Add(keyLifetime(response.Header.Get("Cache-Control")))
	return nil
}

func (webKey jsonWebKey) publicKey() (*rsa.PublicKey, bool) {
	if webKey.KeyType != "RSA" {
		return nil, false
	}
	modulus, modulusErr := base64.RawURLEncoding.DecodeString(webKey.Modulus)
	exponent, exponentErr := base64.RawURLEncoding.DecodeString(webKey.Exponent)
	if modulusErr != nil || exponentErr != nil {
		return nil, false
	}
	exponentValue := int(new(big.Int).SetBytes(exponent).Int64())
	return &rsa.PublicKey{N: new(big.Int).SetBytes(modulus), E: exponentValue}, true
}

// keyLifetime은 Cache-Control의 max-age만큼 키를 캐시한다. 없으면 한 시간이다.
func keyLifetime(cacheControl string) time.Duration {
	for _, directive := range strings.Split(cacheControl, ",") {
		value, found := strings.CutPrefix(strings.TrimSpace(directive), "max-age=")
		if !found {
			continue
		}
		if seconds, err := strconv.Atoi(value); err == nil && seconds > 0 {
			return time.Duration(seconds) * time.Second
		}
	}
	return defaultKeyLifetime
}

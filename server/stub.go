package main

import (
	"context"
	"errors"
	"strings"
)

const (
	stubPrefix     = "stub:"
	maxStubIDBytes = 64
)

var errStubDisabled = errors.New("구글 로그인이 설정되지 않았습니다")

// TokenVerifier는 로그인 토큰을 검증해 사용자 정보를 돌려준다.
type TokenVerifier interface {
	Verify(lifetime context.Context, token string) (Claims, error)
}

// StubVerifier는 개발 중에 구글 없이 로그인할 수 있게 한다.
// `stub:<아이디>:<이름>` 형식의 토큰을 검증 없이 받아들이므로 로컬 개발에서만 켠다.
// 다른 형식의 토큰은 next에 맡기고, next가 없으면 거절한다.
type StubVerifier struct {
	next TokenVerifier
}

func NewStubVerifier(next TokenVerifier) *StubVerifier {
	return &StubVerifier{next: next}
}

func (stub *StubVerifier) Verify(lifetime context.Context, token string) (Claims, error) {
	rest, isStub := strings.CutPrefix(token, stubPrefix)
	if !isStub {
		return stub.delegate(lifetime, token)
	}
	identifier, name, found := strings.Cut(rest, ":")
	if !found || !validStubID(identifier) {
		return Claims{}, errMalformedToken
	}
	return Claims{Subject: stubPrefix + identifier, Name: shortName(name)}, nil
}

func (stub *StubVerifier) delegate(lifetime context.Context, token string) (Claims, error) {
	if stub.next == nil {
		return Claims{}, errStubDisabled
	}
	return stub.next.Verify(lifetime, token)
}

// validStubID는 영문, 숫자, 밑줄, 붙임표로 이루어진 짧은 아이디만 받는다.
func validStubID(identifier string) bool {
	if identifier == "" || len(identifier) > maxStubIDBytes {
		return false
	}
	for _, character := range identifier {
		letter := character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z'
		digit := character >= '0' && character <= '9'
		if !letter && !digit && character != '_' && character != '-' {
			return false
		}
	}
	return true
}

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"unicode"
)

// maxDisplayNameRunes는 계정의 표시 이름이 가질 수 있는 최대 글자 수다. 상대에게도 보이는 이름이라 길이를 제한한다.
const maxDisplayNameRunes = 32

// shortName은 표시 이름에서 제어 문자를 빼고 앞뒤 공백을 지운 뒤 정해진 글자 수로 줄인다.
// 구글 토큰과 stub 토큰의 이름은 사용자가 정한 값이라 그대로 믿지 않는다.
func shortName(name string) string {
	printable := strings.Map(func(character rune) rune {
		if unicode.IsControl(character) {
			return -1
		}
		return character
	}, name)
	runes := []rune(strings.TrimSpace(printable))
	if len(runes) > maxDisplayNameRunes {
		runes = runes[:maxDisplayNameRunes]
	}
	return string(runes)
}

// Account는 계정 하나의 저장 내용이다. 이메일은 저장하지 않고 구글의 사용자 식별값(Sub)으로만 구분한다.
type Account struct {
	Sub    string `json:"sub"`
	Name   string `json:"name"`
	Wins   int    `json:"wins"`
	Losses int    `json:"losses"`
}

// Store는 계정과 승패 기록을 저장하는 곳이다. 파일 대신 데이터베이스로 바꿀 수 있게 서버는 이 인터페이스만 쓴다.
type Store interface {
	// Login은 계정을 찾아 돌려준다. 없으면 만들고, 이름이 오면 이름을 갱신한다.
	Login(sub, name string) (Account, error)
	// Record는 한 판의 결과를 기록한다: 이긴 쪽의 승과 진 쪽의 패를 하나씩 올린다.
	Record(winnerSub, loserSub string) (winner, loser Account, err error)
}

var errUnknownAccount = errors.New("알 수 없는 계정입니다")

// FileStore는 계정 전체를 JSON 파일 하나에 저장한다.
// 저장할 때는 임시 파일에 쓴 뒤 이름을 바꿔서, 도중에 멈춰도 파일이 반쯤 쓰인 채로 남지 않게 한다.
// 경로가 비어 있으면 메모리에만 둔다.
type FileStore struct {
	mutex    sync.Mutex
	path     string
	accounts map[string]*Account
}

// OpenFileStore는 파일이 있으면 읽고, 없으면 빈 저장소로 시작한다.
func OpenFileStore(path string) (*FileStore, error) {
	store := &FileStore{path: path, accounts: map[string]*Account{}}
	if path == "" {
		return store, nil
	}
	content, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("저장 파일을 읽을 수 없습니다: %w", err)
	}
	if err := json.Unmarshal(content, &store.accounts); err != nil {
		return nil, fmt.Errorf("저장 파일의 형식이 올바르지 않습니다: %w", err)
	}
	return store, nil
}

func (store *FileStore) Login(sub, name string) (Account, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	account, exists := store.accounts[sub]
	if !exists {
		account = &Account{Sub: sub, Name: fmt.Sprintf("선수%d", len(store.accounts)+1)}
	}
	previous := *account
	if name != "" {
		account.Name = name
	}
	store.accounts[sub] = account
	if err := store.save(); err != nil {
		store.restore(sub, previous, exists)
		return Account{}, err
	}
	return *account, nil
}

func (store *FileStore) Record(winnerSub, loserSub string) (Account, Account, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	winner, winnerExists := store.accounts[winnerSub]
	loser, loserExists := store.accounts[loserSub]
	if !winnerExists || !loserExists {
		return Account{}, Account{}, errUnknownAccount
	}
	winner.Wins++
	loser.Losses++
	if err := store.save(); err != nil {
		winner.Wins--
		loser.Losses--
		return Account{}, Account{}, err
	}
	return *winner, *loser, nil
}

// restore는 저장에 실패했을 때 메모리의 계정을 저장하기 전 모습으로 되돌린다.
func (store *FileStore) restore(sub string, previous Account, existed bool) {
	if existed {
		store.accounts[sub] = &previous
		return
	}
	delete(store.accounts, sub)
}

func (store *FileStore) save() error {
	if store.path == "" {
		return nil
	}
	// 계정은 문자열과 숫자뿐이라 JSON으로 만들 수 없는 경우가 없다.
	content, _ := json.Marshal(store.accounts)
	temporary := store.path + ".tmp"
	if err := os.WriteFile(temporary, content, 0o600); err != nil {
		return fmt.Errorf("임시 파일을 쓸 수 없습니다: %w", err)
	}
	if err := os.Rename(temporary, store.path); err != nil {
		return fmt.Errorf("저장 파일을 바꿀 수 없습니다: %w", err)
	}
	return nil
}

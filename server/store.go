package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unicode"
)

// maxDisplayNameRunes는 계정의 표시 이름이 가질 수 있는 최대 글자 수다. 상대에게도 보이는 이름이라 길이를 제한한다.
const maxDisplayNameRunes = 32

// shortName은 표시 이름에서 제어 문자와 서식 문자(글자 방향을 바꾸는 문자, 폭이 없는 문자)를 빼고
// 앞뒤 공백을 지운 뒤 정해진 글자 수로 줄인다.
// 구글 토큰과 stub 토큰의 이름은 사용자가 정한 값이라 그대로 믿지 않는다.
func shortName(name string) string {
	printable := strings.Map(func(character rune) rune {
		if unicode.IsControl(character) || unicode.Is(unicode.Cf, character) {
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
// 파일은 저장 폴더를 연 os.Root를 거쳐서만 다루므로 심볼릭 링크나 `..`로 폴더 밖을 건드리지 못한다.
type FileStore struct {
	mutex    sync.Mutex
	root     *os.Root
	name     string
	accounts map[string]*Account
}

// OpenFileStore는 파일이 있으면 읽고, 없으면 빈 저장소로 시작한다.
func OpenFileStore(path string) (*FileStore, error) {
	store := &FileStore{accounts: map[string]*Account{}}
	if path == "" {
		return store, nil
	}
	root, err := os.OpenRoot(filepath.Dir(path))
	if err != nil {
		return nil, fmt.Errorf("저장 폴더를 열 수 없습니다: %w", err)
	}
	store.root, store.name = root, filepath.Base(path)
	content, err := root.ReadFile(store.name)
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

// Login은 계정을 찾아 돌려준다. 없으면 만들고, 이름이 오면 바꾼다. 저장에 실패하면 메모리도 되돌린다.
func (store *FileStore) Login(sub, name string) (Account, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	account, exists := store.accounts[sub]
	if exists && (name == "" || name == account.Name) {
		return *account, nil
	}
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

// Record는 이긴 쪽의 승과 진 쪽의 패를 하나씩 올려 저장한다. 저장에 실패하면 올린 수를 되돌린다.
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

// writeDurably는 내용을 쓰고 디스크에 내려보낸(Sync) 뒤 닫는다.
// 이름을 바꾸기 전에 내용이 디스크에 있어야, 전원이 꺼져도 비어 있는 저장 파일이 남지 않는다.
func writeDurably(root *os.Root, name string, content []byte) error {
	file, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	_, writeErr := file.Write(content)
	return errors.Join(writeErr, file.Sync(), file.Close())
}

// save는 계정 전체를 임시 파일에 쓴 뒤 저장 파일과 바꾼다. 메모리 전용 저장소면 아무것도 하지 않는다.
func (store *FileStore) save() error {
	if store.root == nil {
		return nil
	}
	// 계정은 문자열과 숫자뿐이라 JSON으로 만들 수 없는 경우가 없다.
	content, _ := json.Marshal(store.accounts)
	temporary := store.name + ".tmp"
	if err := writeDurably(store.root, temporary, content); err != nil {
		return fmt.Errorf("임시 파일을 쓸 수 없습니다: %w", err)
	}
	if err := store.root.Rename(temporary, store.name); err != nil {
		// 바꾸지 못한 임시 파일이 남아 다음 저장을 방해하지 않게 지운다.
		_ = store.root.Remove(temporary)
		return fmt.Errorf("저장 파일을 바꿀 수 없습니다: %w", err)
	}
	return nil
}

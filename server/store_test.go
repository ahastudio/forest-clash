package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestShortNameRemovesControlCharactersTrimsAndLimitsLength(t *testing.T) {
	if got := shortName("  하늘\x00\n선수\t "); got != "하늘선수" {
		t.Fatalf("이름 = %q", got)
	}
	if got := shortName(strings.Repeat("가", maxDisplayNameRunes+3)); len([]rune(got)) != maxDisplayNameRunes {
		t.Fatalf("이름 글자 수 = %d", len([]rune(got)))
	}
	if got := shortName("짧은 이름"); got != "짧은 이름" {
		t.Fatalf("이름 = %q", got)
	}
}

func TestShortNameRemovesDirectionAndZeroWidthCharacters(t *testing.T) {
	if got := shortName("하늘\u202eabc\u200b선수\u2066"); got != "하늘abc선수" {
		t.Fatalf("이름 = %q", got)
	}
}

func TestFileStoreDoesNotSaveWhenNothingChanges(t *testing.T) {
	directory := t.TempDir()
	store, _ := OpenFileStore(filepath.Join(directory, "data.json"))
	_, _ = store.Login("winner", "승자")
	store.name = filepath.Join("없는폴더", "data.json")
	if _, err := store.Login("winner", "승자"); err != nil {
		t.Fatalf("같은 이름의 로그인이 저장을 시도했다: %v", err)
	}
	if _, err := store.Login("winner", ""); err != nil {
		t.Fatalf("이름 없는 로그인이 저장을 시도했다: %v", err)
	}
}

func TestFileStoreReportsWhenTheSavedFileCannotBeReplaced(t *testing.T) {
	directory := t.TempDir()
	root, _ := os.OpenRoot(filepath.Dir(directory))
	t.Cleanup(func() { _ = root.Close() })
	store := &FileStore{root: root, name: filepath.Base(directory), accounts: map[string]*Account{}}
	if err := store.save(); err == nil {
		t.Fatal("폴더를 저장 파일로 바꾸려는 실패가 알려지지 않았다")
	}
	if _, err := os.Stat(directory + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("바꾸지 못한 임시 파일이 남았다")
	}
}

func TestFileStoreCreatesAccountWithDefaultName(t *testing.T) {
	store, _ := OpenFileStore("")
	first, err := store.Login("sub-1", "")
	if err != nil || first.Name != "선수1" {
		t.Fatalf("첫 계정 = %+v, 오류 = %v", first, err)
	}
	second, _ := store.Login("sub-2", "")
	if second.Name != "선수2" {
		t.Fatalf("둘째 계정 이름 = %s", second.Name)
	}
}

func TestFileStoreUpdatesNameOnLogin(t *testing.T) {
	store, _ := OpenFileStore("")
	_, _ = store.Login("sub-1", "처음")
	renamed, _ := store.Login("sub-1", "바꾼 이름")
	if renamed.Name != "바꾼 이름" {
		t.Fatalf("이름 = %s", renamed.Name)
	}
	kept, _ := store.Login("sub-1", "")
	if kept.Name != "바꾼 이름" {
		t.Fatalf("이름이 빈 값으로 지워졌다: %s", kept.Name)
	}
}

func TestFileStoreRecordsWinAndLoss(t *testing.T) {
	store, _ := OpenFileStore("")
	_, _ = store.Login("winner", "승자")
	_, _ = store.Login("loser", "패자")
	winner, loser, err := store.Record("winner", "loser")
	if err != nil || winner.Wins != 1 || loser.Losses != 1 || winner.Losses != 0 || loser.Wins != 0 {
		t.Fatalf("기록 = %+v %+v, 오류 = %v", winner, loser, err)
	}
}

func TestFileStoreRejectsUnknownAccountOnRecord(t *testing.T) {
	store, _ := OpenFileStore("")
	_, _ = store.Login("known", "")
	if _, _, err := store.Record("known", "unknown"); err == nil {
		t.Fatal("없는 계정의 기록이 받아들여졌다")
	}
	if _, _, err := store.Record("unknown", "known"); err == nil {
		t.Fatal("없는 계정의 기록이 받아들여졌다")
	}
}

func TestFileStoreRestoresAccountsFromFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.json")
	store, err := OpenFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = store.Login("winner", "승자")
	_, _ = store.Login("loser", "패자")
	_, _, _ = store.Record("winner", "loser")

	reopened, err := OpenFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	winner, _ := reopened.Login("winner", "")
	if winner.Name != "승자" || winner.Wins != 1 {
		t.Fatalf("복원된 계정 = %+v", winner)
	}
	if _, err := os.Stat(path + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("임시 파일이 남아 있다")
	}
}

func TestOpenFileStoreRejectsBrokenFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.json")
	_ = os.WriteFile(path, []byte("{깨진 파일"), 0o600)
	if _, err := OpenFileStore(path); err == nil {
		t.Fatal("깨진 파일을 받아들였다")
	}
}

func TestOpenFileStoreRejectsUnreadablePath(t *testing.T) {
	if _, err := OpenFileStore(t.TempDir()); err == nil {
		t.Fatal("폴더를 파일로 읽었다")
	}
}

func TestFileStoreKeepsMemoryUnchangedWhenSaveFails(t *testing.T) {
	directory := t.TempDir()
	store, _ := OpenFileStore(filepath.Join(directory, "data.json"))
	_, _ = store.Login("winner", "승자")
	_, _ = store.Login("loser", "패자")
	store.name = filepath.Join("없는폴더", "data.json")

	if _, err := store.Login("newcomer", "새 사람"); err == nil {
		t.Fatal("저장 실패가 알려지지 않았다")
	}
	if _, exists := store.accounts["newcomer"]; exists {
		t.Fatal("저장에 실패한 새 계정이 메모리에 남았다")
	}
	if _, err := store.Login("winner", "다른 이름"); err == nil {
		t.Fatal("저장 실패가 알려지지 않았다")
	}
	if store.accounts["winner"].Name != "승자" {
		t.Fatalf("저장에 실패한 이름 변경이 남았다: %s", store.accounts["winner"].Name)
	}
	if _, _, err := store.Record("winner", "loser"); err == nil {
		t.Fatal("저장 실패가 알려지지 않았다")
	}
	if store.accounts["winner"].Wins != 0 || store.accounts["loser"].Losses != 0 {
		t.Fatal("저장에 실패한 기록이 메모리에 남았다")
	}
}

func TestOpenFileStoreRejectsMissingDirectory(t *testing.T) {
	if _, err := OpenFileStore(filepath.Join(t.TempDir(), "없는폴더", "data.json")); err == nil {
		t.Fatal("없는 저장 폴더를 받아들였다")
	}
}

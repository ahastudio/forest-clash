const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 12;
const NAME_FIRST_NUMBER = 1000;
const NAME_NUMBER_RANGE = 9000;

const randomId = (random: () => number): string =>
  Array.from({ length: ID_LENGTH }, () => ALPHABET.charAt(Math.floor(random() * ALPHABET.length))).join('');

/**
 * 개발 중에 구글 없이 로그인하는 흉내(stub). 페이지마다 임의의 아이디와 이름(「선수」와 번호)을 만들어 서버가 받는 형식의 토큰으로 낸다.
 * 같은 페이지는 언제나 같은 사람이고, 다른 탭이나 다른 브라우저는 다른 사람이라 혼자서도 두 쪽을 시험할 수 있다.
 * 서버가 stub을 허용할 때만 통한다.
 */
export function createStubSignIn(random: () => number = Math.random): () => Promise<string> {
  const token = `stub:${randomId(random)}:선수${NAME_FIRST_NUMBER + Math.floor(random() * NAME_NUMBER_RANGE)}`;
  return () => Promise.resolve(token);
}

/** Vite의 `?raw` 가져오기: 파일 내용을 글자로 받는다. 테스트가 `index.html`을 읽는 데 쓴다. */
declare module '*?raw' {
  const text: string;
  export default text;
}

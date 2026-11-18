import style from '../style.css?raw';

// 서식과 상관없이 스타일 규칙을 비교하려고 공백을 모두 없앤다.
export function compactCss(text: string): string {
  return text.replace(/\s+/g, '');
}

// 게임 화면의 스타일 파일을 공백 없이 돌려준다.
export function readCompactStyle(): string {
  return compactCss(style);
}

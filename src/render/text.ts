import { patch } from '../patch';
import { verticalGradient, withState } from './canvas';
import type { Ctx } from './layout';
import { CENTER_X, NAVY } from './layout';

const FONT = '"Apple SD Gothic Neo",sans-serif';

// 작은 글자: 쓸 자리와 모양. 모양을 적지 않으면 기본값(18px, 흰색, 가운데, 700)이다.
interface SmallText {
  x: number;
  y: number;
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  weight?: number;
}

// 크고 굵은 글자: 어디에 어떤 색과 크기로 쓰는가.
interface Banner {
  text: string;
  color: string;
  size: number;
  y: number;
}

// 남색 테두리를 두른 글자의 모양과 자리.
interface Outlined {
  x: number;
  y: number;
  font: string;
  width: number;
  fill: string;
}

// 글자의 테두리를 색을 정해 그린다.
function strokeLabel(g: Ctx, label: { text: string; x: number; y: number; color: string }): void {
  g.strokeStyle = label.color;
  g.strokeText(label.text, label.x, label.y);
}

/**
 * 크고 굵은 글자: 그림자, 남색 테두리, 위에서 아래로 색이 번지는 속을 차례로 그린다.
 */
export function bannerText(g: Ctx, { text, color, size, y }: Banner): void {
  withState(g, () => {
    patch(g, { textAlign: 'center', font: `900 ${size}px ${FONT}`, lineJoin: 'round', lineWidth: size * 0.16 });
    strokeLabel(g, { text, x: CENTER_X + 5, y: y + 7, color: '#0006' });
    strokeLabel(g, { text, x: CENTER_X, y, color: NAVY });
    g.fillStyle = verticalGradient(g, { top: y - size * 0.8, bottom: y }, ['#fff', color]);
    g.fillText(text, CENTER_X, y);
  });
}

/**
 * 작은 글자: 남색 테두리 위에 색을 채운다.
 */
export function smallText(g: Ctx, text: string, style: SmallText): void {
  const { x, y, size = 18, color = '#fff', align = 'center', weight = 700 } = style;
  withState(g, () => {
    const font = `${weight} ${size}px ${FONT}`;
    patch(g, { textAlign: align, font, fillStyle: color, lineWidth: Math.max(3, size / 5), lineJoin: 'round' });
    strokeLabel(g, { text, x, y, color: NAVY });
    g.fillText(text, x, y);
  });
}

/**
 * 남색 테두리를 두른 글자. 현재 변환의 좌표에 쓴다.
 */
export function outlinedText(g: Ctx, text: string, style: Outlined): void {
  patch(g, { font: style.font, lineWidth: style.width, fillStyle: style.fill });
  strokeLabel(g, { text, x: style.x, y: style.y, color: NAVY });
  g.fillText(text, style.x, style.y);
}

interface Wrap {
  lines: string[];
  current: string;
}

/**
 * 글자 너비를 재서 줄바꿈한다(조작법이 화면 밖으로 잘리지 않게).
 */
export function wrapText(g: Ctx, text: string, maxWidth: number): string[] {
  const wrapped = [...text].reduce<Wrap>(
    (wrap, ch) =>
      wrap.current && g.measureText(wrap.current + ch).width > maxWidth
        ? { lines: wrap.lines.concat(wrap.current), current: ch.trimStart() }
        : { lines: wrap.lines, current: wrap.current + ch },
    { lines: [], current: '' },
  );
  return wrapped.current ? wrapped.lines.concat(wrapped.current) : wrapped.lines;
}

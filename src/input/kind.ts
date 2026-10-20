/** 지금 쓰는 입력 장치. 안내 문구가 장치에 맞게 바뀐다. */
export type InputKind = 'keyboard' | 'touch';

/** 손가락으로 조작하는 기기(폰, 태블릿)이면 touch, 아니면 keyboard다. */
export function detectInputKind(win: Window): InputKind {
  return win.matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
}

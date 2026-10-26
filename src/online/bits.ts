import type { Pad, PadInput } from '../engine';

// 입력 8비트의 순서: 왼쪽, 오른쪽, 위, 아래, A, B, C, D. 서버와 주고받는 값이므로 순서를 바꾸지 않는다.
const CONTROLS = ['l', 'r', 'u', 'd', 'A', 'B', 'C', 'D'] as const;

/**
 * 눌린 방향과 버튼을 8비트 정수 하나로 묶는다.
 */
export function encodePad(pad: Pad): number {
  return CONTROLS.reduce((bits, control, index) => (pad[control] ? bits | (1 << index) : bits), 0);
}

/**
 * 8비트 정수를 엔진이 받는 입력으로 되돌린다.
 */
export function decodePad(bits: number): PadInput {
  const bit = (index: number): number => (bits >> index) & 1;
  return {
    l: bit(0),
    r: bit(1),
    u: bit(2),
    d: bit(3),
    A: bit(4),
    B: bit(5),
    C: bit(6),
    D: bit(7),
  };
}

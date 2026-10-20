/** 컴퓨터 상대가 내는 입력. 사람과 같은 방향 넷과 버튼 넷이고, 누르면 1이다. */
export type AiPad = Record<'l' | 'r' | 'u' | 'd' | 'A' | 'B' | 'C' | 'D', number>;
export type Side = 'l' | 'r';

/** 아무것도 누르지 않은 컴퓨터 입력. */
export const emptyPad = (): AiPad => ({ l: 0, r: 0, u: 0, d: 0, A: 0, B: 0, C: 0, D: 0 });

/** 누를 것만 적으면 나머지는 떼어 둔 입력을 만든다. */
export const padOf = (press: Partial<AiPad>): AiPad => ({ ...emptyPad(), ...press });

/** 한 방향으로 간다. */
export const go = (side: Side): Partial<AiPad> => (side === 'l' ? { l: 1 } : { r: 1 });

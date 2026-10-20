/** 난이도 한 단계의 성격. 쉬울수록 반응이 느리고, 놓치는 일이 많고, 덜 공격적이다. */
export interface Difficulty {
  /** 상대 공격이 발동한 뒤 막기까지 걸리는 프레임 수의 범위. */
  reaction: readonly [number, number];
  /** 하단 기술을 막지 못할 확률. */
  missLow: number;
  /** 그 밖의 기술을 막지 못할 확률. */
  missOther: number;
  /** 발동이 느린 상대 기술을 약펀치로 끊을 확률의 바탕값. */
  interrupt: number;
  /** 헛친 뒤 후딜에 반격할 확률. */
  punish: number;
  /** 사거리 안에서 공격을 고르는 빈도. */
  aggression: number;
  /** 행동 사이의 간격 배율. 쉬울수록 느리다. */
  waitScale: number;
  /** 막고 있는 상대의 방어 자세를 읽어 압박할 확률. */
  mix: number;
  /** 날아드는 상대를 대공 어퍼로 받을 확률의 바탕값. */
  antiAir: number;
}

const VERY_EASY: Difficulty = {
  reaction: [16, 22],
  missLow: 0.85,
  missOther: 0.7,
  interrupt: 0,
  punish: 0.1,
  aggression: 0.45,
  waitScale: 2.0,
  mix: 0,
  antiAir: 0,
};

const EASY: Difficulty = {
  reaction: [12, 16],
  missLow: 0.7,
  missOther: 0.55,
  interrupt: 0.1,
  punish: 0.25,
  aggression: 0.55,
  waitScale: 1.8,
  mix: 0.25,
  antiAir: 0.2,
};

const NORMAL: Difficulty = {
  reaction: [10, 14],
  missLow: 0.45,
  missOther: 0.25,
  interrupt: 0.3,
  punish: 0.6,
  aggression: 0.8,
  waitScale: 1.3,
  mix: 0.6,
  antiAir: 0.5,
};

const HARD: Difficulty = {
  reaction: [6, 10],
  missLow: 0.15,
  missOther: 0.05,
  interrupt: 0.8,
  punish: 0.92,
  aggression: 1.2,
  waitScale: 0.85,
  mix: 1,
  antiAir: 0.95,
};

/** 0 아주 쉬움, 1 조금 쉬움, 2 보통, 3 어려움. 범위를 벗어나면 보통이다. */
const DIFFICULTIES: readonly Difficulty[] = [VERY_EASY, EASY, NORMAL, HARD];

/** 난이도 번호에 맞는 설정을 돌려준다. 범위 밖이면 보통 난이도다. */
export const difficultyFor = (level: number): Difficulty => DIFFICULTIES[level] ?? NORMAL;

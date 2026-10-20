import { AIR_SPECS } from './move-specs-air';
import { GROUND_SPECS } from './move-specs-ground';
import { SPECIAL_SPECS } from './move-specs-special';

// 기술 표의 단일 진입점. 갈래별 파일(지상, 공중, 잡기·특수기·필살기)을 하나로 합친다.
export const SPECS = {
  ...GROUND_SPECS,
  ...AIR_SPECS,
  ...SPECIAL_SPECS,
};

export type MoveId = keyof typeof SPECS;

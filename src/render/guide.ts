import type { InputKind } from '../input/kind';

/** 입력 장치마다 달라지는 안내: 타이틀 아래 문구, 일시정지 화면 아래 문구, 키보드 그림을 보여 줄지. */
export interface Guide {
  titleHint: string;
  pauseFooter: string;
  showKeyboards: boolean;
}

export const GUIDES: Record<InputKind, Guide> = {
  keyboard: {
    titleHint: '1P 버튼: 컴퓨터와 대전   2P 버튼: 둘이서 대전   Space: 조작법',
    pauseFooter: 'Space 계속   M 소리   H 판정 상자 표시',
    showKeyboards: true,
  },
  touch: {
    titleHint: '오른쪽 위 ⏸ 버튼: 조작법과 일시정지',
    pauseFooter: '오른쪽 위 ⏸ 버튼으로 계속',
    showKeyboards: false,
  },
};

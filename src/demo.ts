import { create as createAi } from './ai';
import type { Sound } from './audio/sound';
import type { Engine, Inputs } from './engine';
import { createEngine, MAX_HP } from './engine';
import { patch } from './patch';
import type { Effects } from './render/effects';
import { Reactions } from './render/reactions';

// 컴퓨터의 난이도: 가장 쉬워서 반응이 느리고 덜 공격적이라 가볍게 싸우는 모습이 된다.
const EASIEST = 0;
// 체력이 이 비율 아래로 내려가면 다시 채워서 K.O.가 나지 않고 싸움이 이어진다.
const REFILL_BELOW = 0.4;

/**
 * 타이틀 뒤에서 캐릭터 둘이 가볍게 싸우는 모습. 실제 대전과 따로 도는 엔진 하나가 컴퓨터끼리 싸운다.
 * 맞는 불꽃과 먼지는 화면의 효과를 같이 쓰고, 소리는 장치를 열지 않은 `Sound`를 받아 내지 않는다.
 */
export class TitleDemo {
  readonly engine: Engine = createEngine();
  private readonly reactions: Reactions;
  private readonly first = createAi(this.engine, { level: () => EASIEST });
  private readonly second = createAi(this.engine, { level: () => EASIEST });

  constructor(effects: Effects, sound: Sound) {
    this.reactions = new Reactions({ engine: this.engine, effects, sound });
    this.engine.newMatch('cpu');
  }

  /**
   * 한 프레임 진행하고, 판이 끝났으면 새 판을 열며, 체력이 낮아졌으면 채운다.
   */
  step(): void {
    const inputs: Inputs = [this.first(0), this.second(1)];
    this.engine.step(inputs);
    this.reactions.handle();
    this.keepFighting();
  }

  private keepFighting(): void {
    if (this.engine.phase === 'over') {
      this.engine.newMatch('cpu');
    }
    for (const fighter of this.engine.fighters) {
      patch(fighter, { hp: fighter.hp < MAX_HP * REFILL_BELOW ? MAX_HP : fighter.hp });
    }
  }
}

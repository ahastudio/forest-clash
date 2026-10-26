import type { Engine, Inputs } from '../engine';
import type { Keyboard } from '../input/keyboard';
import { encodePad } from './bits';
import type { OnlineSession } from './session';

// 온라인 대전에서 한 프레임을 진행하는 데 필요한 것들.
interface OnlineFrameParts {
  engine: Engine;
  keyboard: Keyboard;
  step: (inputs: Inputs) => void;
}

/**
 * 온라인 대전의 프레임 진행: 상대 입력이 모인 프레임만 진행하고, 진행한 뒤에는 내 입력과 끝난 판의 결과를 서버로 보낸다.
 */
export class OnlineFrame {
  constructor(private readonly parts: OnlineFrameParts) {}

  /**
   * 온라인 대전 중에는 상대 입력이 모일 때까지 기다리느라 프레임을 진행하지 못할 수 있다. 진행하지 못했으면 false다.
   */
  step(session: OnlineSession): boolean {
    const inputs = session.nextInputs();
    if (inputs) {
      this.parts.step(inputs);
      this.afterStep(session);
    }
    return inputs !== null;
  }

  // 진행한 프레임 뒤의 온라인 일: 타이틀로 돌아왔으면 마치고, 아니면 내 입력을 보내고 끝난 판의 결과를 알린다.
  private afterStep(session: OnlineSession): void {
    if (this.parts.engine.phase === 'title') {
      session.finish();
      return;
    }
    this.sendProgress(session);
  }

  private sendProgress(session: OnlineSession): void {
    session.submit(encodePad(this.parts.keyboard.read(0)));
    this.reportResult(session);
  }

  private reportResult(session: OnlineSession): void {
    const { phase, matchWinner } = this.parts.engine;
    if (phase === 'over' && matchWinner !== null) {
      session.reportResult(matchWinner);
    }
  }
}

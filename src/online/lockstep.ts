import type { Inputs, PlayerId } from '../engine';
import { decodePad } from './bits';

/** 한 프레임의 입력: 몇 번째 프레임에 어떤 버튼이 눌렸는가. */
export interface FrameInput {
  frame: number;
  bits: number;
}

/**
 * 입력 지연 락스텝: 프레임마다 두 사람의 입력이 모두 모여야 그 프레임을 진행한다.
 * 내 입력은 지금 프레임이 아니라 delay 프레임 뒤의 번호로 보내므로, 상대 입력이 도착할 시간을 번다.
 * 처음 delay 프레임은 양쪽 모두 아무것도 누르지 않은 것으로 채워 둔다.
 */
export class Lockstep {
  private frame = 0;
  private sendFrame: number;
  private readonly mine = new Map<number, number>();
  private readonly theirs = new Map<number, number>();

  constructor(
    private readonly slot: PlayerId,
    delay: number,
  ) {
    for (let frame = 0; frame < delay; frame++) {
      this.mine.set(frame, 0);
      this.theirs.set(frame, 0);
    }
    this.sendFrame = delay;
  }

  /** 지금 누른 입력을 앞으로 진행할 프레임 번호에 붙여 돌려준다. 이 값을 서버로 보낸다. */
  submit(bits: number): FrameInput {
    const input = { frame: this.sendFrame++, bits };
    this.mine.set(input.frame, bits);
    return input;
  }

  /** 상대의 입력을 받아 둔다. */
  receive({ frame, bits }: FrameInput): void {
    this.theirs.set(frame, bits);
  }

  /** 두 입력이 모두 모인 프레임이면 슬롯 순서대로 입력을 내주고 다음 프레임으로 간다. 모자라면 null이다. */
  next(): Inputs | null {
    const pair = this.peek();
    if (!pair) {
      return null;
    }
    this.advance();
    return this.slot === 0
      ? [decodePad(pair.mine), decodePad(pair.theirs)]
      : [decodePad(pair.theirs), decodePad(pair.mine)];
  }

  /** 지금 프레임의 두 입력. 하나라도 아직 없으면 null이다. */
  private peek(): { mine: number; theirs: number } | null {
    const mine = this.mine.get(this.frame);
    const theirs = this.theirs.get(this.frame);
    return mine === undefined || theirs === undefined ? null : { mine, theirs };
  }

  /** 모은 입력을 쓰고 다음 프레임으로 간다. */
  private advance(): void {
    this.mine.delete(this.frame);
    this.theirs.delete(this.frame);
    this.frame++;
  }
}

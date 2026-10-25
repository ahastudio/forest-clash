import type { Inputs, PlayerId } from '../engine';
import { Lockstep } from './lockstep';
import { PingMeter } from './ping';
import type { Profile, ServerMessage } from './protocol';
import { clientMessage, parseServerMessage } from './protocol';
import { isExpired } from './token';
import type { Link, OpenLink } from './web-socket';

/** 내 입력을 이만큼 뒤의 프레임에 적용한다. 상대 입력이 도착할 시간을 벌기 위한 값이다(게임은 초당 45프레임으로 돌아가므로 6프레임은 약 133밀리초). */
const INPUT_DELAY_FRAMES = 6;

/** 온라인 대전의 단계. stopped는 오류나 상대의 이탈로 끝난 상태이고, 이유가 status에 남아 있다. */
type SessionState = 'idle' | 'signingIn' | 'connecting' | 'waiting' | 'playing' | 'stopped';

interface SessionDependencies {
  serverUrl: string;
  /** 구글 로그인을 하고 ID 토큰을 돌려준다. */
  signIn(): Promise<string>;
  open: OpenLink;
  /** 지금 시각(밀리초). 핑을 재는 데 쓴다. */
  now(): number;
  /** 상대가 정해졌을 때 부른다. slot은 내 입력이 들어가는 자리(0은 1P, 1은 2P)다. */
  onMatched(slot: PlayerId): void;
}

type Handler<Kind extends ServerMessage['type']> = (message: Extract<ServerMessage, { type: Kind }>) => void;

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : '로그인하지 못했습니다');

/** 로그인, 서버 접속, 상대 찾기, 대전, 결과 보고까지 온라인 대전의 흐름을 관리한다. */
export class OnlineSession {
  state: SessionState = 'idle';
  /** 화면에 보일 현재 상황 한 줄. */
  status = '';
  private token: string | null = null;
  private link: Link | null = null;
  private lockstep: Lockstep | null = null;
  private reported = false;
  /** 이번 판의 승패가 서버에 기록되었는가. 기록된 뒤에 상대가 나가는 것은 판이 끝난 뒤의 정리이므로 알리지 않는다. */
  private recorded = false;
  private readonly ping: PingMeter;

  constructor(private readonly dependencies: SessionDependencies) {
    this.ping = new PingMeter(dependencies.now);
  }

  /** 로그인이나 접속, 상대 찾기가 진행 중인가. */
  get busy(): boolean {
    return this.state === 'signingIn' || this.state === 'connecting' || this.state === 'waiting';
  }

  get playing(): boolean {
    return this.state === 'playing';
  }

  /** 온라인 대전을 시작한다. 이전 판에서 열려 있던 연결은 닫고 새로 접속한다. */
  start(): void {
    if (this.busy || this.playing) {
      return;
    }
    this.closeLink();
    this.connectOrSignIn();
  }

  /** 로그인한 적이 있고 토큰이 만료되지 않았으면 그 토큰으로 바로 접속하고, 아니면 로그인부터 한다. */
  private connectOrSignIn(): void {
    if (this.token && !isExpired(this.token, Date.now() / 1000)) {
      this.connect(this.token);
    } else {
      this.signIn();
    }
  }

  /** 상대를 찾는 중이거나 로그인 중이면 그만둔다. */
  cancel(): void {
    if (this.busy) {
      this.send(clientMessage.cancel());
      this.closeLink();
      this.state = 'idle';
      this.status = '';
    }
  }

  /** 대전이 끝나 타이틀로 돌아왔을 때 연결을 닫는다. 기록은 화면에 남는다. */
  finish(): void {
    this.closeLink();
    this.lockstep = null;
    this.state = 'idle';
  }

  /** 이번 프레임에 진행할 입력. 상대 입력이 아직 없으면 null이다. */
  nextInputs(): Inputs | null {
    return this.lockstep?.next() ?? null;
  }

  /** 내 입력을 프레임 번호를 붙여 상대에게 보낸다. */
  submit(bits: number): void {
    const input = this.lockstep?.submit(bits);
    if (input) {
      this.send(clientMessage.input(input));
    }
  }

  /** 대전 중이고 핑을 잴 때가 되었으면 서버에 ping을 보낸다. */
  measurePing(): void {
    const sentAt = this.playing ? this.ping.due() : null;
    if (sentAt !== null) {
      this.send(clientMessage.ping(sentAt));
    }
  }

  /** 서버와의 평균 왕복 시간(밀리초). 대전 중이 아니거나 아직 재지 못했으면 null이다. */
  get pingMilliseconds(): number | null {
    return this.playing ? this.ping.milliseconds : null;
  }

  /** 판이 끝났을 때 이긴 쪽을 서버에 알린다. 한 판에 한 번만 보낸다. */
  reportResult(winner: PlayerId): void {
    if (!this.reported) {
      this.reported = true;
      this.send(clientMessage.result(winner));
    }
  }

  private signIn(): void {
    this.state = 'signingIn';
    this.status = '로그인하는 중';
    this.dependencies.signIn().then(
      token => this.signedIn(token),
      error => this.fail(reasonOf(error)),
    );
  }

  /** 로그인하는 사이에 취소했으면 이어가지 않는다. */
  private signedIn(token: string): void {
    if (this.state === 'signingIn') {
      this.token = token;
      this.connect(token);
    }
  }

  private connect(token: string): void {
    this.state = 'connecting';
    this.status = '서버에 접속하는 중';
    const link: Link = this.dependencies.open(this.dependencies.serverUrl, {
      open: () => this.send(clientMessage.hello(token)),
      message: text => this.receive(text),
      // 이미 닫은 낡은 연결의 닫힘 알림이 새 접속을 끊지 않게, 지금 연결의 알림만 받는다.
      close: () => this.link === link && this.lost(),
    });
    this.link = link;
  }

  private send(text: string): void {
    this.link?.send(text);
  }

  private closeLink(): void {
    const link = this.link;
    this.link = null;
    link?.close();
  }

  private receive(text: string): void {
    const message = parseServerMessage(text);
    if (message) {
      this.handle(message);
    }
  }

  /** 메시지 종류마다 맞는 처리를 고른다. */
  private readonly handlers: { [Kind in ServerMessage['type']]: Handler<Kind> } = {
    ready: message => this.onReady(message),
    waiting: () => undefined,
    matched: message => this.onMatched(message),
    input: message => this.lockstep?.receive(message),
    recorded: message => {
      this.recorded = true;
      this.status = `내 기록 ${message.wins}승 ${message.losses}패`;
    },
    opponentLeft: () => this.onOpponentLeft(),
    pong: message => this.ping.record(message.sent),
    error: message => {
      this.token = null;
      this.fail(message.reason);
    },
  };

  /**
   * 종류와 내용의 짝은 ServerMessage 타입이 보장하지만, 컴파일러는 합쳐진 종류로 표를 찾은 처리를 읽지 못한다.
   * 그래서 처리를 모든 메시지를 받는 함수로 보고 부른다.
   */
  private handle(message: ServerMessage): void {
    const handler = this.handlers[message.type] as (message: ServerMessage) => void;
    handler(message);
  }

  private onReady(profile: Profile): void {
    this.state = 'waiting';
    this.status = `${profile.name} ${profile.wins}승 ${profile.losses}패 · 상대를 찾는 중`;
    this.send(clientMessage.queue());
  }

  /** 새 판의 입력 모으기를 준비하고 결과 보고와 기록 여부를 처음으로 되돌린다. */
  private prepareMatch(slot: PlayerId): void {
    this.lockstep = new Lockstep(slot, INPUT_DELAY_FRAMES);
    this.ping.reset();
    this.reported = false;
    this.recorded = false;
  }

  private onMatched({ slot, opponent }: Extract<ServerMessage, { type: 'matched' }>): void {
    this.prepareMatch(slot);
    this.state = 'playing';
    this.status = `${opponent.name} ${opponent.wins}승 ${opponent.losses}패와 대전`;
    this.dependencies.onMatched(slot);
  }

  private onOpponentLeft(): void {
    if (!this.recorded) {
      this.stop('상대가 나갔습니다');
    }
  }

  /** 대전이 끝났다. 연결은 열어 두어 서버가 보내는 기록을 받는다. */
  private stop(reason: string): void {
    this.lockstep = null;
    this.state = 'stopped';
    this.status = reason;
  }

  private fail(reason: string): void {
    this.closeLink();
    this.stop(reason);
  }

  /** 서버가 지금 연결을 닫았다. 이미 끝난 뒤이면 무시한다. 우리가 닫은 연결은 connect에서 걸러진다. */
  private lost(): void {
    if (this.state !== 'stopped') {
      this.fail('서버와 연결이 끊어졌습니다');
    }
  }
}

import type { PlayerId } from '../engine';
import type { FrameInput } from './lockstep';

/** 서버가 알려 주는 선수 정보: 이름과 승패. */
export interface Profile {
  name: string;
  wins: number;
  losses: number;
}

export type ServerMessage =
  | ({ type: 'ready' } & Profile)
  | { type: 'waiting' }
  | { type: 'matched'; slot: PlayerId; opponent: Profile }
  | ({ type: 'input' } & FrameInput)
  | { type: 'recorded'; wins: number; losses: number }
  | { type: 'opponentLeft' }
  | { type: 'pong'; sent: number }
  | { type: 'error'; reason: string };

type Body = Record<string, unknown>;

const isRecord = (value: unknown): value is Body => typeof value === 'object' && value !== null;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isSlot = (value: unknown): value is PlayerId => value === 0 || value === 1;
const isText = (value: unknown): value is string => typeof value === 'string';

function profileOf(body: unknown): Profile | null {
  if (!isRecord(body)) {
    return null;
  }
  const { name, wins, losses } = body;
  return isText(name) && isNumber(wins) && isNumber(losses) ? { name, wins, losses } : null;
}

function parseReady(body: Body): ServerMessage | null {
  const profile = profileOf(body);
  return profile && { type: 'ready', ...profile };
}

function parseMatched({ slot, opponent }: Body): ServerMessage | null {
  const profile = profileOf(opponent);
  return profile && isSlot(slot) ? { type: 'matched', slot, opponent: profile } : null;
}

function parseInput({ frame, bits }: Body): ServerMessage | null {
  return isNumber(frame) && isNumber(bits) ? { type: 'input', frame, bits } : null;
}

function parseRecorded({ wins, losses }: Body): ServerMessage | null {
  return isNumber(wins) && isNumber(losses) ? { type: 'recorded', wins, losses } : null;
}

function parsePong({ sent }: Body): ServerMessage | null {
  return isNumber(sent) ? { type: 'pong', sent } : null;
}

function parseError({ reason }: Body): ServerMessage | null {
  return isText(reason) ? { type: 'error', reason } : null;
}

/** 메시지 종류마다 내용을 검사해 만드는 방법. */
const PARSERS: Record<string, (body: Body) => ServerMessage | null> = {
  ready: parseReady,
  waiting: () => ({ type: 'waiting' }),
  matched: parseMatched,
  input: parseInput,
  recorded: parseRecorded,
  opponentLeft: () => ({ type: 'opponentLeft' }),
  pong: parsePong,
  error: parseError,
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 서버가 보낸 글자를 메시지로 바꾼다. 형식이 맞지 않으면 null이다. */
export function parseServerMessage(text: string): ServerMessage | null {
  const body = parseJson(text);
  if (!isRecord(body) || !isText(body.type) || !Object.hasOwn(PARSERS, body.type)) {
    return null;
  }
  return PARSERS[body.type]?.(body) ?? null;
}

/** 클라이언트가 서버로 보내는 메시지의 글자. */
export const clientMessage = {
  hello: (token: string): string => JSON.stringify({ type: 'hello', token }),
  queue: (): string => JSON.stringify({ type: 'queue' }),
  cancel: (): string => JSON.stringify({ type: 'cancel' }),
  input: ({ frame, bits }: FrameInput): string => JSON.stringify({ type: 'input', frame, bits }),
  result: (winner: PlayerId): string => JSON.stringify({ type: 'result', winner }),
  leave: (): string => JSON.stringify({ type: 'leave' }),
  ping: (sent: number): string => JSON.stringify({ type: 'ping', sent }),
};

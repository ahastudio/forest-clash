import { describe, expect, it } from 'vitest';
import { isExpired } from './token';

const NOW = 1_800_000_000;

// 구글 ID 토큰의 모양(머리.내용.서명)으로 내용만 채운 토큰.
const tokenWith = (payload: unknown): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const content = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `머리.${content}.서명`;
};

describe('토큰 만료', () => {
  it('만료 시각이 한참 남았으면 만료되지 않았다', () => {
    expect(isExpired(tokenWith({ exp: NOW + 3600 }), NOW)).toBe(false);
  });

  it('만료 시각이 지났으면 만료되었다', () => {
    expect(isExpired(tokenWith({ exp: NOW - 1 }), NOW)).toBe(true);
  });

  it('만료까지 60초 이하로 남았으면 곧 만료되는 것으로 본다', () => {
    expect(isExpired(tokenWith({ exp: NOW + 60 }), NOW)).toBe(true);
    expect(isExpired(tokenWith({ exp: NOW + 61 }), NOW)).toBe(false);
  });

  it('base64url의 -와 _를 읽는다', () => {
    const token = tokenWith({ exp: NOW + 3600, name: '??>>' });
    expect(token.split('.')[1]).toMatch(/[-_]/);
    expect(isExpired(token, NOW)).toBe(false);
  });

  it('만료 시각을 읽을 수 없는 토큰은 만료되지 않은 것으로 본다', () => {
    expect(isExpired('stub:abc:이름', NOW)).toBe(false);
    expect(isExpired('토큰', NOW)).toBe(false);
    expect(isExpired('머리.@@@.서명', NOW)).toBe(false);
    expect(isExpired(tokenWith(7), NOW)).toBe(false);
    expect(isExpired(tokenWith(null), NOW)).toBe(false);
    expect(isExpired(tokenWith({ exp: '내일' }), NOW)).toBe(false);
    expect(isExpired(tokenWith({}), NOW)).toBe(false);
  });
});

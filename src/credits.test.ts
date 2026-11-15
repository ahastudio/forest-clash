import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

const links = [...html.matchAll(/<a href="([^"]+)"([^>]*)>/g)].map(match => ({ href: match[1], attributes: match[2] }));

describe('만든 사람과 소스 코드 링크', () => {
  it('디스코드와 GitHub 두 곳을 새 탭으로 연다', () => {
    expect(links.map(link => link.href)).toEqual([
      'https://discord.gg/Y6kNcJvCwU',
      'https://github.com/ahastudio/forest-clash',
    ]);
    for (const link of links) {
      expect(link.attributes).toContain('target="_blank"');
      expect(link.attributes).toContain('rel="noopener noreferrer"');
    }
  });

  it('각 링크에 글자 이름이 붙어 있다', () => {
    expect(html).toContain('</svg>디스코드</a>');
    expect(html).toContain('</svg>GitHub</a>');
  });

  it('기본으로는 숨기고 타이틀 장면에서만 보인다', () => {
    expect(html).toContain('.credits{display:none;');
    expect(html).toContain('canvas[data-phase="title"]~.credits{display:flex}');
    expect(html.indexOf('<canvas id="c"')).toBeLessThan(html.indexOf('<nav class="credits"'));
  });

  it('터치 화면에서는 오른쪽 위의 일시정지 버튼을 피해 왼쪽 위로 옮긴다', () => {
    const coarse = html.slice(html.indexOf('@media (pointer:coarse)'));
    expect(coarse).toContain('.credits{right:auto;left:calc(10px + env(safe-area-inset-left));');
    expect(coarse).toContain('.touch .pause{position:fixed;top:');
  });

  it('터치 화면에서 폭이 좁으면 링크가 줄을 바꿔 일시정지 버튼 자리를 침범하지 않는다', () => {
    const coarse = html.slice(html.indexOf('@media (pointer:coarse)'));
    const pauseWidth = 44;
    const pauseRightOffset = 8;
    const gap = 10;
    const leftOffset = 10;
    const reserved = leftOffset + pauseRightOffset + pauseWidth + gap;
    expect(coarse).toContain('flex-wrap:wrap');
    expect(coarse).toContain(
      `max-width:calc(100vw - ${reserved}px - env(safe-area-inset-left) - env(safe-area-inset-right))`,
    );
    expect(coarse).toContain(
      `.touch .pause{position:fixed;top:calc(${pauseRightOffset}px + env(safe-area-inset-top));`,
    );
    expect(coarse).toContain(`right:calc(${pauseRightOffset}px + env(safe-area-inset-right));width:${pauseWidth}px`);
  });

  it('손가락으로 누를 수 있는 높이를 가진다', () => {
    expect(html).toContain('min-height:44px');
  });
});

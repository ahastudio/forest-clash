import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import { BUTTON_NAMES } from './button-control';

describe('화면 조작 마크업', () => {
  it('코드가 찾는 요소가 모두 페이지에 있다', () => {
    for (const selector of ['data-touch', 'data-stick', 'data-knob', 'data-pause']) {
      expect(html).toContain(selector);
    }
    for (const name of BUTTON_NAMES) {
      expect(html).toContain(`data-button="${name}"`);
    }
  });

  it('기본으로는 숨기고 터치 기기에서만 보인다', () => {
    const base = html.slice(0, html.indexOf('@media (pointer:coarse)'));
    expect(base).toContain('.touch{display:none}');
    expect(html).toContain('@media (pointer:coarse){');
    expect(html.slice(html.indexOf('@media (pointer:coarse)'))).toContain('.touch{display:block');
  });

  it('두 손가락 조작으로 화면이 확대되지 않게 뷰포트에서 확대를 끈다', () => {
    expect(html).toContain('maximum-scale=1,user-scalable=no');
  });

  it('모든 버튼은 화면 조작 영역 안에 있고 손가락 모양 커서를 가진다', () => {
    expect(html).toMatch(/\.touch button\{cursor:pointer;/);
    expect(html.slice(0, html.indexOf('<div class="touch"'))).not.toContain('<button');
  });
});

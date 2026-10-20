import { describe, expect, it } from 'vitest';
import { fakeCanvas } from '../testing/canvas';
import { bannerText, outlinedText, smallText, wrapText } from './text';

describe('글자', () => {
  it('큰 글자는 그림자, 테두리, 속 순서로 가운데에 쓴다', () => {
    const { g, of, last } = fakeCanvas();
    bannerText(g, { text: 'K.O.', color: '#f00', size: 100, y: 200 });
    expect(of('strokeText')).toEqual([
      ['K.O.', 485, 207],
      ['K.O.', 480, 200],
    ]);
    expect(of('fillText')).toEqual([['K.O.', 480, 200]]);
    expect(last('textAlign')).toBe('center');
    expect(last('font')).toContain('900 100px');
  });

  it('작은 글자는 기본값(18px, 흰색, 가운데, 700)으로 쓴다', () => {
    const { g, of, last } = fakeCanvas();
    smallText(g, '안녕', { x: 10, y: 20 });
    expect(of('fillText')).toEqual([['안녕', 10, 20]]);
    expect(last('font')).toContain('700 18px');
    expect(last('fillStyle')).toBe('#fff');
    expect(last('textAlign')).toBe('center');
    expect(last('lineWidth')).toBe(3.6);
  });

  it('작은 글자는 모양을 바꿀 수 있다', () => {
    const { g, last } = fakeCanvas();
    smallText(g, 'a', { x: 0, y: 0, size: 30, color: '#f00', align: 'left', weight: 800 });
    expect(last('font')).toContain('800 30px');
    expect(last('textAlign')).toBe('left');
    expect(last('lineWidth')).toBe(6);
  });

  it('테두리 글자는 테두리를 먼저 쓰고 속을 채운다', () => {
    const { g, calls } = fakeCanvas();
    outlinedText(g, '3', { x: 1, y: 2, font: '900 40px sans-serif', width: 6, fill: '#ff0' });
    const names = calls.map(c => c[0]);
    expect(names.indexOf('strokeText')).toBeLessThan(names.indexOf('fillText'));
  });

  it('글자 너비를 재서 줄바꿈한다', () => {
    const { g } = fakeCanvas();
    expect(wrapText(g, 'abcdefghij', 40)).toEqual(['abcde', 'fghij']);
    expect(wrapText(g, 'abc', 100)).toEqual(['abc']);
    expect(wrapText(g, '', 100)).toEqual([]);
  });

  it('줄이 바뀔 때 새 줄 앞의 공백은 지운다', () => {
    const { g } = fakeCanvas();
    expect(wrapText(g, 'abcde fgh', 40)).toEqual(['abcde', 'fgh']);
  });
});

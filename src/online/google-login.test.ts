import { describe, expect, it } from 'vitest';
import type { GoogleApi, GoogleHost } from './google-login';
import { createSignIn } from './google-login';

class FakeElement {
  readonly style = { cssText: '' };
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, () => void>();
  textContent = '';
  src = '';
  async = false;
  removed = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly tag: string) {}

  append(...items: FakeElement[]): void {
    this.children.push(...items);
  }

  remove(): void {
    this.removed = true;
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }
}

interface Setup {
  host: GoogleHost;
  head: FakeElement;
  body: FakeElement;
  google: { callback: ((response: { credential: string }) => void) | null; rendered: FakeElement[]; clientId: string };
  win: { google?: GoogleApi };
}

function setup(withApi = true): Setup {
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  const google: Setup['google'] = { callback: null, rendered: [], clientId: '' };
  const api: GoogleApi = {
    accounts: {
      id: {
        initialize: options => {
          google.callback = options.callback;
          google.clientId = options.client_id;
        },
        renderButton: parent => google.rendered.push(parent as unknown as FakeElement),
      },
    },
  };
  const win: { google?: GoogleApi } = withApi ? { google: api } : {};
  const doc = { head, body, createElement: (tag: string) => new FakeElement(tag) } as unknown as Document;
  return { host: { doc, win, clientId: 'client-id' }, head, body, google, win };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('구글 로그인', () => {
  it('스크립트를 불러온 뒤 로그인 버튼을 보이고 ID 토큰을 돌려준다', async () => {
    const { host, head, body, google } = setup();
    const token = createSignIn(host)();
    const script = head.children[0];
    expect(script?.src).toBe('https://accounts.google.com/gsi/client');
    expect(script?.async).toBe(true);
    script?.onload?.();
    await settle();
    expect(google.clientId).toBe('client-id');
    expect(google.rendered).toHaveLength(1);
    const panel = body.children[0];
    expect(panel?.style.cssText).toContain('position:fixed');
    google.callback?.({ credential: '토큰' });
    await expect(token).resolves.toBe('토큰');
    expect(panel?.removed).toBe(true);
  });

  it('스크립트는 처음 한 번만 불러온다', async () => {
    const { host, head, google } = setup();
    const signIn = createSignIn(host);
    const first = signIn();
    head.children[0]?.onload?.();
    await settle();
    google.callback?.({ credential: 'a' });
    await first;
    const second = signIn();
    await settle();
    google.callback?.({ credential: 'b' });
    await expect(second).resolves.toBe('b');
    expect(head.children).toHaveLength(1);
  });

  it('취소 버튼을 누르면 창을 닫고 취소했다고 알린다', async () => {
    const { host, head, body } = setup();
    const token = createSignIn(host)();
    head.children[0]?.onload?.();
    await settle();
    const panel = body.children[0];
    const cancel = panel?.children[0]?.children[3];
    expect(panel?.children[0]?.children[0]?.textContent).toBe('온라인 대전');
    expect(panel?.children[0]?.children[1]?.textContent).toBe('구글 계정으로 로그인해 주세요');
    expect(cancel?.textContent).toBe('취소');
    expect(cancel?.style.cssText).toContain('cursor:pointer');
    cancel?.listeners.get('click')?.();
    await expect(token).rejects.toThrow('로그인을 취소했습니다');
    expect(panel?.removed).toBe(true);
  });

  it('스크립트를 불러오지 못하면 알린다', async () => {
    const { host, head } = setup();
    const token = createSignIn(host)();
    head.children[0]?.onerror?.();
    await expect(token).rejects.toThrow('불러오지 못했습니다');
    expect(head.children[0]?.removed).toBe(true);
  });

  it('스크립트를 불러오지 못한 뒤 다시 시도하면 스크립트를 다시 불러온다', async () => {
    const { host, head, google } = setup();
    const signIn = createSignIn(host);
    const failed = signIn();
    head.children[0]?.onerror?.();
    await expect(failed).rejects.toThrow('불러오지 못했습니다');
    const retried = signIn();
    expect(head.children).toHaveLength(2);
    head.children[1]?.onload?.();
    await settle();
    google.callback?.({ credential: '토큰' });
    await expect(retried).resolves.toBe('토큰');
  });

  it('스크립트는 불러왔는데 로그인 기능이 없으면 알린다', async () => {
    const { host, head } = setup(false);
    const token = createSignIn(host)();
    head.children[0]?.onload?.();
    await expect(token).rejects.toThrow('쓸 수 없습니다');
  });
});

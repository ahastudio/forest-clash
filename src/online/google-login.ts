const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

interface CredentialResponse {
  credential: string;
}

/** 구글 로그인 스크립트가 만드는 `google` 객체 중 쓰는 부분. */
export interface GoogleApi {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback(response: CredentialResponse): void }): void;
      renderButton(parent: HTMLElement, options: { theme: string; size: string }): void;
    };
  };
}

export interface GoogleHost {
  doc: Document;
  win: { google?: GoogleApi };
  clientId: string;
}

interface Panel {
  slot: HTMLElement;
  remove(): void;
}

const BACKDROP_STYLE =
  'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000a;backdrop-filter:blur(6px);z-index:10';
const CARD_STYLE =
  'box-sizing:border-box;width:min(360px,90vw);display:flex;flex-direction:column;align-items:center;gap:14px;padding:32px 28px 24px;border-radius:28px;border:4px solid #f2c94c;background:linear-gradient(#3b7541,#1f3d25);box-shadow:0 16px 48px #000b,inset 0 2px 0 #ffffff40;color:#fff';
const TITLE_STYLE =
  'margin:0;font-size:28px;font-weight:900;color:#ffe27a;text-shadow:0 3px 0 #5a3d0a,0 6px 10px #0006';
const HINT_STYLE = 'margin:0 0 6px;font-size:15px;font-weight:600;color:#e6f3e0;text-align:center';
const CANCEL_STYLE =
  'cursor:pointer;margin-top:6px;padding:9px 32px;border-radius:999px;border:2px solid #ffffff80;background:#00000040;color:#fff;font:800 15px inherit';

function scriptTag(doc: Document): HTMLScriptElement {
  const script = doc.createElement('script');
  script.src = SCRIPT_URL;
  script.async = true;
  return script;
}

/** 구글 로그인 스크립트를 불러온다. */
function loadScript(doc: Document): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = scriptTag(doc);
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('구글 로그인을 불러오지 못했습니다'));
    };
    doc.head.append(script);
  });
}

/** 구글 로그인 버튼이 들어갈 안내 창. 제목과 취소 버튼이 있다. */
function buildPanel(doc: Document, onCancel: () => void): Panel {
  const slot = doc.createElement('div');
  const root = backdrop(
    doc,
    card(doc, [
      label(doc, { text: '온라인 대전', style: TITLE_STYLE }),
      label(doc, { text: '구글 계정으로 로그인해 주세요', style: HINT_STYLE }),
      slot,
      cancelButton(doc, onCancel),
    ]),
  );
  doc.body.append(root);
  return { slot, remove: () => root.remove() };
}

function card(doc: Document, children: HTMLElement[]): HTMLElement {
  const element = doc.createElement('div');
  element.style.cssText = CARD_STYLE;
  element.append(...children);
  return element;
}

function backdrop(doc: Document, child: HTMLElement): HTMLElement {
  const element = doc.createElement('div');
  element.style.cssText = BACKDROP_STYLE;
  element.append(child);
  return element;
}

function label(doc: Document, { text, style }: { text: string; style: string }): HTMLElement {
  const element = doc.createElement('p');
  element.textContent = text;
  element.style.cssText = style;
  return element;
}

function cancelButton(doc: Document, onCancel: () => void): HTMLElement {
  const button = doc.createElement('button');
  button.textContent = '취소';
  button.style.cssText = CANCEL_STYLE;
  button.addEventListener('click', onCancel);
  return button;
}

/** 안내 창에 구글 로그인 버튼을 보이고, 로그인하면 ID 토큰을 돌려준다. */
function askForToken(host: GoogleHost, api: GoogleApi): Promise<string> {
  return new Promise((resolve, reject) => {
    const panel = buildPanel(host.doc, () => {
      panel.remove();
      reject(new Error('로그인을 취소했습니다'));
    });
    api.accounts.id.initialize({
      client_id: host.clientId,
      callback: response => {
        panel.remove();
        resolve(response.credential);
      },
    });
    api.accounts.id.renderButton(panel.slot, { theme: 'filled_blue', size: 'large' });
  });
}

/**
 * 구글 로그인을 하는 함수를 만든다. 스크립트는 불러오는 데 성공할 때까지 처음 한 번만 불러온다.
 * 불러오기에 실패하면 그 실패를 기억하지 않아, 네트워크가 돌아온 뒤 다시 시도하면 다시 불러온다.
 */
export function createSignIn(host: GoogleHost): () => Promise<string> {
  let script: Promise<void> | null = null;
  return async () => {
    script ??= loadScript(host.doc).catch(error => {
      script = null;
      throw error;
    });
    return askForToken(host, await readyApi(host, script));
  };
}

/** 스크립트를 다 불러온 뒤 로그인 기능을 꺼낸다. */
async function readyApi(host: GoogleHost, script: Promise<void>): Promise<GoogleApi> {
  await script;
  const api = host.win.google;
  if (!api) {
    throw new Error('구글 로그인을 쓸 수 없습니다');
  }
  return api;
}

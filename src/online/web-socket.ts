/**
 * 서버와의 연결: 글자를 보내고 닫을 수 있다.
 */
export interface Link {
  send(text: string): void;
  close(): void;
}

/**
 * 연결에서 일어나는 일을 받는 쪽.
 */
export interface LinkHandlers {
  open(): void;
  message(text: string): void;
  close(): void;
}

/**
 * 연결을 여는 방법. 테스트에서는 가짜로 바꾼다.
 */
export type OpenLink = (url: string, handlers: LinkHandlers) => Link;

/**
 * 브라우저의 WebSocket으로 서버와 연결을 연다.
 */
export const openWebSocket: OpenLink = (url, handlers) => {
  const socket = new WebSocket(url);
  socket.addEventListener('open', () => handlers.open());
  socket.addEventListener('message', event => handlers.message(String(event.data)));
  socket.addEventListener('close', () => handlers.close());
  return { send: text => socket.send(text), close: () => socket.close() };
};

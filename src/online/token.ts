/**
 * 만료 시각보다 이만큼(초) 일찍부터 만료된 것으로 본다. 접속하는 사이에 만료되지 않게 하는 여유다.
 */
const EXPIRY_MARGIN_SECONDS = 60;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// base64url로 적힌 JSON 조각을 읽는다. 읽을 수 없으면 null이다.
function readSegment(segment: string): unknown {
  try {
    return JSON.parse(atob(segment.replaceAll('-', '+').replaceAll('_', '/')));
  } catch {
    return null;
  }
}

// 구글 ID 토큰(JWT)의 만료 시각(초)을 꺼낸다. 읽을 수 없으면 null이다.
function expiryOf(token: string): number | null {
  const payload = readSegment(token.split('.')[1] ?? '');
  const expiry = isRecord(payload) ? payload.exp : undefined;
  return typeof expiry === 'number' ? expiry : null;
}

/**
 * 토큰이 만료되었거나 곧 만료되는가. 구글 ID 토큰은 한 시간쯤 뒤에 만료되므로, 로그인한 토큰을 오래 두었다가 다시 쓰지 않게 한다.
 * 만료 시각을 읽을 수 없는 토큰(stub 토큰 등)은 만료되지 않은 것으로 본다.
 */
export function isExpired(token: string, nowSeconds: number): boolean {
  const expiry = expiryOf(token);
  return expiry !== null && expiry - EXPIRY_MARGIN_SECONDS <= nowSeconds;
}

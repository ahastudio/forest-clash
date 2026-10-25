import { describe, expect, it } from 'vitest';
import { createStubSignIn } from './stub-login';

/** 정해 둔 값을 차례로 내는 난수. */
const sequence = (...values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
};

describe('stub 로그인', () => {
  it('서버가 받는 형식의 토큰을 낸다', async () => {
    const token = await createStubSignIn(sequence(0.1, 0.5))();
    expect(token).toMatch(/^stub:[a-z0-9]{12}:선수[1-9]\d{3}$/);
  });

  it('같은 페이지는 부를 때마다 같은 사람이다', async () => {
    const signIn = createStubSignIn(sequence(0.3, 0.7, 0.2));
    expect(await signIn()).toBe(await signIn());
  });

  it('난수가 다르면 다른 사람이다', async () => {
    const one = await createStubSignIn(sequence(0.1, 0.2, 0.3))();
    const other = await createStubSignIn(sequence(0.8, 0.6, 0.4))();
    expect(one).not.toBe(other);
  });

  it('난수를 주지 않으면 Math.random으로 만든다', async () => {
    expect(await createStubSignIn()()).toMatch(/^stub:/);
  });
});

/**
 * 대상에 없는 이름이 changes에 끼어 있으면 컴파일러가 알려 주기 위한 검사.
 */
type NoExtraKeys<Target, Changes> = Changes & Record<Exclude<keyof Changes, keyof Target>, never>;

/**
 * 대상의 값을 한꺼번에 바꾸고 대상을 돌려준다.
 * 바꿀 값의 이름과 형식이 대상에 맞는지 컴파일러가 검사하므로, 이름을 잘못 적으면 알려 준다.
 */
export function patch<Target extends object, Changes extends Partial<Target>>(
  target: Target,
  changes: NoExtraKeys<Target, Changes>,
): Target {
  return Object.assign(target, changes);
}

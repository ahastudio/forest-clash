/** 캐릭터 그림. 자세 하나가 그림 한 장(벡터)이고 오른쪽을 보는 기준이다. */
export type CharacterKind = 'cat' | 'sprout';
const CHARACTER_KINDS: readonly CharacterKind[] = ['cat', 'sprout'];

/** 그림 한 칸(400)이 세계 184칸이다. 머리 꼭대기가 몸 피격 상자(96)와 맞는다. */
export const SPRITE_SCALE = 0.46;
export const SPRITE_SIZE = 400;

/** 기술마다 네 장: 준비(a), 중간(m), 타격 순간(x), 회수(r). 중간 그림이 없는 기술도 있다. */
const MOVE_ARTS_WITH_MIDDLE = [
  'jab',
  'kicklight',
  'straight',
  'kickheavy',
  'upper',
  'sweep',
  'hammer',
  'lungekick',
  'elbow',
  'dp',
  'shove',
];
const MOVE_ARTS_WITHOUT_MIDDLE = ['cjab', 'lowkick', 'grab'];
const BASE_POSES = [
  'idle',
  'walk1',
  'walk2',
  'jump',
  'fall',
  'crouch',
  'block',
  'block-crouch',
  'hurt',
  'hurt-air',
  'down',
  'getup',
  'dash',
  'airpunch-x',
  'airkick-x',
  'throw-lift',
  'throw-toss',
  'held',
  'tossed',
];

/** 그 기술 그림에 중간 자세가 있는가. */
export const hasMiddlePose = (art: string): boolean => MOVE_ARTS_WITH_MIDDLE.includes(art);

const variants = (arts: readonly string[], kinds: readonly string[]): string[] =>
  arts.flatMap(art => kinds.map(kind => `${art}-${kind}`));

/** 불러올 모든 자세 이름. */
export const allPoseNames = (): string[] => [
  ...BASE_POSES,
  ...variants(MOVE_ARTS_WITH_MIDDLE, ['a', 'm', 'x', 'r']),
  ...variants(MOVE_ARTS_WITHOUT_MIDDLE, ['a', 'x', 'r']),
];

type ImageFactory = () => HTMLImageElement;

const isLoaded = (image: HTMLImageElement): boolean => image.complete && image.naturalWidth > 0;

/** 그림 한 장을 불러오기 시작한다. 큰 그림은 처음 그릴 때 화면이 튀지 않도록 미리 해독해 둔다. */
function load(createImage: ImageFactory, src: string): HTMLImageElement {
  const image = createImage();
  image.src = src;
  image.decode?.().catch(() => undefined);
  return image;
}

/** 불러온 그림들. 아직 다 불러오지 못한 그림은 null로 돌려준다. */
export class Sprites {
  private readonly poses: Map<string, HTMLImageElement>;
  private readonly backgroundImage: HTMLImageElement;
  private readonly logoImage: HTMLImageElement;

  constructor(createImage: ImageFactory = () => new Image()) {
    this.backgroundImage = load(createImage, 'bg.webp');
    this.logoImage = load(createImage, 'logo.webp');
    this.poses = new Map(
      CHARACTER_KINDS.flatMap(kind =>
        allPoseNames().map((pose): [string, HTMLImageElement] => [
          `${kind}/${pose}`,
          load(createImage, `characters/${kind}/${pose}.svg`),
        ]),
      ),
    );
  }

  background(): HTMLImageElement | null {
    return isLoaded(this.backgroundImage) ? this.backgroundImage : null;
  }

  /** 타이틀 로고(숲속대전 Forest Clash). */
  logo(): HTMLImageElement | null {
    return isLoaded(this.logoImage) ? this.logoImage : null;
  }

  pose(kind: CharacterKind, pose: string): HTMLImageElement | null {
    const image = this.poses.get(`${kind}/${pose}`);
    return image && isLoaded(image) ? image : null;
  }
}

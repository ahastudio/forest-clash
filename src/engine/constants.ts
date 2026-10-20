/** 벽 사이(600)가 고정 화면 안에 다 들어온다. */
export const WALL_L = 300;
export const WALL_R = 900;
export const MAX_SEPARATION = 440;
export const GRAVITY = 0.56;

export const MAX_HP = 100;
export const RAGE_MAX = 100;

export const STAND_HEIGHT = 96;
export const CROUCH_HEIGHT = 54;
export const HURT_HALF_WIDTH = 28;
export const PUSH_HALF_WIDTH = 26;
export const THROW_RANGE = 90;

export const WALK_FORWARD = 2.4;
export const WALK_BACK = 1.9;
export const RUN_SPEED = 5.0;
export const BACK_DASH_SPEED = 5.2;
export const JUMP_VELOCITY = 13;
export const HOP_VELOCITY = 9.6;
export const JUMP_DRIFT = 3.0;
export const HOP_DRIFT = 3.6;

export const BUFFER_FRAMES = 6;
export const DOUBLE_TAP_FRAMES = 15;
export const KNOCKBACK_DECAY = 0.85;

/** 잡기 시간표(프레임)와 들어 올린 높이. */
export const THROW_TOSS = 17;
export const THROW_END = 23;
export const THROW_LIFT_ALT = 62;
export const THROW_END_ALT = 36;

/** 땅에서 막 떠오른 높이. 0이면 땅에 있는 것으로 보기 때문에 공중임을 나타내려고 이만큼 띄운다. */
export const AIRBORNE_EPSILON = 0.01;

/** 땅에서 서 있거나 걷거나 앉아 있어 새 행동을 고를 수 있는 상태들. */
export const NEUTRAL_STATES = ['idle', 'crouch', 'walk', 'run'];

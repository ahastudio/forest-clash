/** 화면(캔버스)의 크기와 바닥 높이. */
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;
export const CENTER_X = SCREEN_WIDTH / 2;
export const CENTER_Y = SCREEN_HEIGHT / 2;
/** 캐릭터가 서는 바닥의 화면 세로 위치. */
export const GROUND_Y = 452;
/** 싸우는 세계의 가로 길이. */
export const ARENA_WIDTH = 1200;
export const CAMERA_ZOOM = 1.3;
/** 카메라는 고정이다. 싸우는 곳(벽 사이)이 화면 안에 다 들어오므로 가만히 있을 때 화면이 움직이지 않는다. */
export const CAMERA_X = ARENA_WIDTH / 2;
export const CAMERA_Y = GROUND_Y - 210 / CAMERA_ZOOM;

export const INK = '#4b382c';
export const NAVY = '#1b2a3a';
export const GOLD = '#ffd54a';

export type Ctx = CanvasRenderingContext2D;

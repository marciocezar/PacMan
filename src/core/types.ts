/** Constantes compartilhadas. O eixo é o mesmo do joystick do Atari: 0 cima, 1 direita, 2 baixo, 3 esquerda. */

export const TILE = 8;
export const HUD = 22;

export const UP = 0;
export const RIGHT = 1;
export const DOWN = 2;
export const LEFT = 3;
export const NONE = -1;

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const OPP = [DOWN, LEFT, UP, RIGHT];

export type Cell = "wall" | "dot" | "power" | "empty" | "door";
export type Phase = "title" | "ready" | "play" | "dying" | "clear" | "over";
export type GhostMode = "house" | "leave" | "chase" | "fright" | "eyes";

export type GhostId = "blinky" | "pinky" | "inky" | "clyde";

export interface Actor {
  kind: "pac" | "ghost";
  /** Rótulo estável. Na ROM os quatro fantasmas compartilham a mesma perseguição. */
  name: GhostId | "pacman";
  tx: number;
  ty: number;
  dir: number;
  next: number;
  prog: number;
  mode: GhostMode;
  /** Quadro em que o fantasma pode sair da casa. */
  release: number;
  color: string;
  homeX: number;
  homeY: number;
}

export interface Game {
  template: LevelMap;
  grid: Cell[][];
  dots: number;
  score: number;
  lives: number;
  level: number;
  phase: Phase;
  frame: number;
  chain: number;
  lfsr: number;
  actors: Actor[];
}

export interface LevelMap {
  grid: Cell[][];
  width: number;
  height: number;
  pac: { x: number; y: number };
  ghosts: { x: number; y: number }[];
  /** Casa logo acima da porta, para onde o fantasma sobe ao sair. */
  exit: { x: number; y: number };
  /** Centro da casa, para onde os olhos voltam. */
  pen: { x: number; y: number };
  dots: number;
}

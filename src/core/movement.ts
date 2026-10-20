import { DOT_SCORE, PELLET_REACH, POWER_SCORE } from "../entities/pellet";
import type { AudioDirector } from "../systems/audio";
import { wrapX } from "./level";
import { DX, DY, NONE, OPP, type Actor, type Cell, type Game } from "./types";

/** Janela, em fração de casa, em que a curva ainda entra na esquina. */
const CORNER_EARLY = 0.22;
const CORNER_LATE = 0.78;

export function actorPixel(actor: Actor): { x: number; y: number } {
  const dir = actor.dir === NONE ? 0 : actor.dir;
  const prog = actor.dir === NONE ? 0 : actor.prog;
  return {
    x: actor.tx + DX[dir] * prog,
    y: actor.ty + DY[dir] * prog,
  };
}

export function centerOf(actor: Actor, width: number): { x: number; y: number } {
  if (actor.dir === NONE || actor.prog < 0.5) return { x: actor.tx, y: actor.ty };
  return {
    x: wrapX(actor.tx + DX[actor.dir], width),
    y: actor.ty + DY[actor.dir],
  };
}

/** Os corpos se encostam no meio do corredor, não só quando caem na mesma casa. */
export function bodiesOverlap(a: Actor, b: Actor, width: number): boolean {
  return tileGap(actorPixel(a), actorPixel(b), width) <= 0.62;
}

export function moveActor(
  game: Game,
  actor: Actor,
  speed: number,
  choose: (game: Game, actor: Actor) => number,
  audio?: AudioDirector,
  onArrive?: (game: Game, actor: Actor, audio?: AudioDirector) => void,
): void {
  if (actor.dir !== NONE && actor.next === OPP[actor.dir] && actor.prog > 0) {
    const back = stepCell(game, actor.tx, actor.ty, actor.dir);
    actor.tx = back.x;
    actor.ty = back.y;
    actor.prog = 1 - actor.prog;
    actor.dir = actor.next;
  }

  tryCorner(game, actor);

  if (actor.prog === 0) {
    const dir = choose(game, actor);
    actor.dir = dir;
    if (dir === NONE) return;
  }

  actor.prog += speed;
  if (actor.prog < 1) return;

  const arrived = stepCell(game, actor.tx, actor.ty, actor.dir);
  actor.tx = arrived.x;
  actor.ty = arrived.y;
  actor.prog = 0;
  onArrive?.(game, actor, audio);
  if (actor.mode === "house") {
    actor.dir = NONE;
    return;
  }
  const dir = choose(game, actor);
  actor.dir = dir;
  if (dir !== NONE) actor.prog = Math.min(speed, 0.95);
}

export function eatTiles(game: Game, audio: AudioDirector, actor: Actor): void {
  const width = game.template.width;
  const height = game.template.height;
  const origin = actorPixel(actor);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = game.grid[y][x];
      if (cell !== "dot" && cell !== "power") continue;
      if (tileGap(origin, { x, y }, width) > PELLET_REACH) continue;
      game.grid[y][x] = "empty";
      game.dots -= 1;
      if (cell === "dot") {
        game.score += DOT_SCORE;
        audio.pellet();
      } else {
        game.score += POWER_SCORE;
        game.chain = 0;
        audio.power();
        for (const other of game.actors) {
          if (other.kind === "ghost" && (other.mode === "chase" || other.mode === "fright")) {
            other.mode = "fright";
            if (other.dir !== NONE) other.next = OPP[other.dir];
          }
        }
      }
      if (game.dots <= 0) {
        game.phase = "clear";
        audio.ready();
        return;
      }
    }
  }
}

export function canEnter(game: Game, actor: Actor, dir: number): boolean {
  const next = stepCell(game, actor.tx, actor.ty, dir);
  if (next.cell === "wall") return false;
  if (next.cell === "door") {
    return actor.kind === "ghost" && (actor.mode === "leave" || actor.mode === "eyes");
  }
  return next.y >= 0 && next.y < game.template.height;
}

export function stepCell(game: Game, tx: number, ty: number, dir: number): { x: number; y: number; cell: Cell } {
  const y = ty + DY[dir];
  const x = wrapX(tx + DX[dir], game.template.width);
  if (y < 0 || y >= game.template.height) return { x: tx, y: ty, cell: "wall" };
  return { x, y, cell: game.grid[y][x] };
}

export function tileDistance(game: Game, from: { x: number; y: number }, to: { x: number; y: number }): number {
  return tileGap(from, to, game.template.width);
}

function tileGap(from: { x: number; y: number }, to: { x: number; y: number }, width: number): number {
  let dx = Math.abs(from.x - to.x);
  dx = Math.min(dx, width - dx);
  return dx + Math.abs(from.y - to.y);
}

function tryCorner(game: Game, actor: Actor): void {
  if (actor.dir === NONE || actor.next === NONE) return;
  if (actor.next === actor.dir || actor.next === OPP[actor.dir]) return;

  if (actor.prog > 0 && actor.prog <= CORNER_EARLY && canEnter(game, actor, actor.next)) {
    actor.dir = actor.next;
    return;
  }

  if (actor.prog < CORNER_LATE) return;
  const ahead = stepCell(game, actor.tx, actor.ty, actor.dir);
  if (ahead.cell === "wall" || ahead.cell === "door") return;
  const probe: Actor = { ...actor, tx: ahead.x, ty: ahead.y };
  if (!canEnter(game, probe, actor.next)) return;
  actor.tx = ahead.x;
  actor.ty = ahead.y;
  actor.dir = actor.next;
  actor.prog = Math.max(0, actor.prog - 1);
}

export function choosePac(game: Game, actor: Actor): number {
  if (actor.next !== NONE && canEnter(game, actor, actor.next)) return actor.next;
  if (actor.dir !== NONE && canEnter(game, actor, actor.dir)) return actor.dir;
  return NONE;
}

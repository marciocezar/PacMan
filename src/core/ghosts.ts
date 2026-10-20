import { BLINKY } from "../entities/blinky";
import { CLYDE } from "../entities/clyde";
import { INKY } from "../entities/inky";
import { PINKY } from "../entities/pinky";
import type { AudioDirector } from "../systems/audio";
import { canEnter, stepCell, tileDistance } from "./movement";
import { NONE, OPP, type Actor, type Game, type GhostId } from "./types";

/**
 * Máquina de estados alinhada à ROM do Atari 2600, não ao fliperama.
 *
 * A ROM não tem Scatter. Blinky, Pinky, Inky e Clyde existem aqui como
 * os quatro sprites, e no modo Chase todos miram a casa do Pac-Man.
 * O desempate é o LFSR de $FBE0. Frightened foge para o canto espelhado.
 * Eaten (olhos) volta ao centro da casa.
 */
export const GHOST_ORDER: readonly { id: GhostId; releaseFrames: number }[] = [BLINKY, PINKY, INKY, CLYDE];

const CHASE_SPEED = 0.084;
const FRIGHT_SPEED = 0.055;
const EATEN_SPEED = 0.18;

export function ghostSpeed(mode: Actor["mode"], pace: number): number {
  if (mode === "eyes") return EATEN_SPEED;
  if (mode === "fright") return FRIGHT_SPEED;
  return CHASE_SPEED * pace;
}

export function settleGhost(game: Game, actor: Actor, audio?: AudioDirector): void {
  if (actor.mode === "leave" && actor.tx === game.template.exit.x && actor.ty === game.template.exit.y) {
    actor.mode = audio?.siren ? "fright" : "chase";
  }
  if (actor.mode === "eyes" && actor.tx === game.template.pen.x && actor.ty === game.template.pen.y) {
    actor.mode = "house";
    actor.release = game.frame + 70;
    actor.dir = NONE;
  }
}

export function chooseGhost(game: Game, actor: Actor): number {
  const target = ghostTarget(game, actor);
  const options: number[] = [];
  for (let dir = 0; dir < 4; dir++) {
    if (actor.dir !== NONE && dir === OPP[actor.dir]) continue;
    if (canEnter(game, actor, dir)) options.push(dir);
  }
  const pool = options.length
    ? options
    : actor.dir !== NONE && canEnter(game, actor, OPP[actor.dir])
      ? [OPP[actor.dir]]
      : [];
  if (!pool.length) return NONE;

  const flee = actor.mode === "fright";
  let best = pool[0];
  let bestScore = tileDistance(game, stepCell(game, actor.tx, actor.ty, best), target);
  const ties = [best];
  for (const dir of pool.slice(1)) {
    const score = tileDistance(game, stepCell(game, actor.tx, actor.ty, dir), target);
    const better = flee ? score > bestScore : score < bestScore;
    if (better) {
      best = dir;
      bestScore = score;
      ties.length = 0;
      ties.push(dir);
    } else if (score === bestScore) {
      ties.push(dir);
    }
  }
  game.lfsr = stepLfsr(game.lfsr);
  return ties[game.lfsr % ties.length];
}

function ghostTarget(game: Game, actor: Actor): { x: number; y: number } {
  if (actor.mode === "leave") return game.template.exit;
  if (actor.mode === "eyes") return game.template.pen;
  const pac = game.actors[0];
  if (actor.mode === "fright") {
    return { x: game.template.width - 1 - pac.tx, y: game.template.height - 1 - pac.ty };
  }
  return { x: pac.tx, y: pac.ty };
}

/** O mesmo gerador de bits da ROM ($FBE0): um LFSR de 8 bits em $CB. */
function stepLfsr(cb: number): number {
  let value = cb & 0xff;
  let carry = (value >> 7) & 1;
  value = (value << 1) & 0xff;
  value ^= cb & 0xff;
  carry = (value >> 7) & 1;
  value = (value << 1) & 0xff;
  carry = (value >> 7) & 1;
  value = (value << 1) & 0xff;
  return ((cb << 1) | carry) & 0xff;
}

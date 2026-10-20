import { GHOST_POINTS } from "../entities/pellet";
import { makeActors, releaseDelay } from "../entities/roster";
import type { AudioDirector } from "../systems/audio";
import type { Input } from "../systems/input";
import { chooseGhost, ghostSpeed, settleGhost } from "./ghosts";
import { cloneGrid, createLevel } from "./level";
import { bodiesOverlap, choosePac, eatTiles, moveActor } from "./movement";
import { NONE, type Actor, type Game } from "./types";

export type { Game } from "./types";

export function createGame(): Game {
  const template = createLevel();
  const game: Game = {
    template,
    grid: cloneGrid(template.grid),
    dots: template.dots,
    score: 0,
    lives: 3,
    level: 1,
    phase: "title",
    frame: 0,
    chain: 0,
    lfsr: 0xff,
    actors: [],
  };
  game.actors = makeActors(template);
  return game;
}

function pacOf(game: Game): Actor {
  return game.actors[0];
}

function placeActors(game: Game): void {
  const fresh = makeActors(game.template);
  game.actors.forEach((actor, index) => {
    const source = fresh[index];
    actor.tx = source.tx;
    actor.ty = source.ty;
    actor.dir = NONE;
    actor.next = actor.kind === "pac" ? actor.next : NONE;
    actor.prog = 0;
    actor.mode = actor.kind === "pac" ? "chase" : "house";
    actor.name = source.name;
  });
}

function armGhosts(game: Game): void {
  let index = 0;
  for (const actor of game.actors) {
    if (actor.kind !== "ghost") continue;
    actor.mode = "house";
    actor.dir = NONE;
    actor.prog = 0;
    actor.tx = actor.homeX;
    actor.ty = actor.homeY;
    actor.release = game.frame + releaseDelay(index);
    index += 1;
  }
}

export function update(game: Game, input: Input, audio: AudioDirector): void {
  if (game.phase === "title" || game.phase === "over") {
    if (input.consumeStart()) {
      if (game.phase === "over") restart(game);
      void audio.unlock();
      beginReady(game, audio);
    }
    return;
  }

  if (input.next !== NONE) pacOf(game).next = input.next;

  const sirenWasOn = audio.siren;
  if (game.phase === "play") stepPlay(game, audio);
  audio.tick();
  game.frame += 1;

  if (sirenWasOn && !audio.siren && game.phase === "play") {
    for (const actor of game.actors) {
      if (actor.mode === "fright") actor.mode = "chase";
    }
    game.chain = 0;
  }

  if (audio.sequenceDone) {
    if (game.phase === "ready" || game.phase === "clear") {
      if (game.phase === "clear") {
        game.level += 1;
        game.grid = cloneGrid(game.template.grid);
        game.dots = game.template.dots;
        placeActors(game);
      }
      armGhosts(game);
      game.phase = "play";
    } else if (game.phase === "dying") {
      game.lives -= 1;
      if (game.lives <= 0) {
        game.phase = "over";
      } else {
        placeActors(game);
        beginReady(game, audio);
      }
    }
  }
}

function restart(game: Game): void {
  game.score = 0;
  game.lives = 3;
  game.level = 1;
  game.chain = 0;
  game.grid = cloneGrid(game.template.grid);
  game.dots = game.template.dots;
  game.actors = makeActors(game.template);
}

function beginReady(game: Game, audio: AudioDirector): void {
  game.phase = "ready";
  audio.ready();
}

function stepPlay(game: Game, audio: AudioDirector): void {
  const pace = Math.min(1.45, 1 + (game.level - 1) * 0.06);
  const pac = pacOf(game);
  moveActor(game, pac, 0.094 * pace, choosePac);

  for (const actor of game.actors) {
    if (actor.kind !== "ghost") continue;
    if (actor.mode === "house" && game.frame >= actor.release) actor.mode = "leave";
    if (actor.mode === "house") continue;
    moveActor(game, actor, ghostSpeed(actor.mode, pace), chooseGhost, audio, settleGhost);
  }

  eatTiles(game, audio, pac);

  if (game.phase !== "play") return;

  let deadly = false;
  for (const actor of game.actors) {
    if (actor.kind !== "ghost" || !bodiesOverlap(pac, actor, game.template.width)) continue;
    if (actor.mode === "chase" || actor.mode === "leave") deadly = true;
  }
  if (deadly) {
    game.phase = "dying";
    audio.death();
    return;
  }
  for (const actor of game.actors) {
    if (actor.kind !== "ghost" || actor.mode !== "fright" || !bodiesOverlap(pac, actor, game.template.width)) continue;
    actor.mode = "eyes";
    actor.dir = NONE;
    actor.prog = 0;
    game.score += GHOST_POINTS[Math.min(game.chain, GHOST_POINTS.length - 1)];
    game.chain += 1;
    audio.eatGhost();
  }
}

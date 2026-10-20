import { actorPixel } from "../core/movement";
import { DOWN, HUD, LEFT, NONE, RIGHT, TILE, UP, type Game } from "../core/types";
import { AudioDirector } from "./audio";
import { COLOR } from "./palette";
import { bitOn, GHOST_FRAMES, PAC_DISC } from "./sprites";

const FONT: Record<string, number[]> = {
  "0": [0b1111, 0b1001, 0b1001, 0b1001, 0b1111],
  "1": [0b0010, 0b0110, 0b0010, 0b0010, 0b0111],
  "2": [0b1111, 0b0001, 0b1111, 0b1000, 0b1111],
  "3": [0b1111, 0b0001, 0b0111, 0b0001, 0b1111],
  "4": [0b1001, 0b1001, 0b1111, 0b0001, 0b0001],
  "5": [0b1111, 0b1000, 0b1111, 0b0001, 0b1111],
  "6": [0b1111, 0b1000, 0b1111, 0b1001, 0b1111],
  "7": [0b1111, 0b0001, 0b0010, 0b0100, 0b0100],
  "8": [0b1111, 0b1001, 0b1111, 0b1001, 0b1111],
  "9": [0b1111, 0b1001, 0b1111, 0b0001, 0b1111],
  A: [0b0110, 0b1001, 0b1111, 0b1001, 0b1001],
  C: [0b0111, 0b1000, 0b1000, 0b1000, 0b0111],
  D: [0b1110, 0b1001, 0b1001, 0b1001, 0b1110],
  E: [0b1111, 0b1000, 0b1110, 0b1000, 0b1111],
  F: [0b1111, 0b1000, 0b1110, 0b1000, 0b1000],
  G: [0b0111, 0b1000, 0b1011, 0b1001, 0b0111],
  I: [0b1110, 0b0100, 0b0100, 0b0100, 0b1110],
  J: [0b0011, 0b0001, 0b0001, 0b1001, 0b0110],
  L: [0b1000, 0b1000, 0b1000, 0b1000, 0b1111],
  M: [0b1001, 0b1111, 0b1111, 0b1001, 0b1001],
  N: [0b1001, 0b1101, 0b1011, 0b1001, 0b1001],
  O: [0b0110, 0b1001, 0b1001, 0b1001, 0b0110],
  P: [0b1110, 0b1001, 0b1110, 0b1000, 0b1000],
  Q: [0b0110, 0b1001, 0b1011, 0b0110, 0b0001],
  R: [0b1110, 0b1001, 0b1110, 0b1010, 0b1001],
  S: [0b0111, 0b1000, 0b0110, 0b0001, 0b1110],
  T: [0b1110, 0b0100, 0b0100, 0b0100, 0b0100],
  U: [0b1001, 0b1001, 0b1001, 0b1001, 0b0110],
  V: [0b1001, 0b1001, 0b1001, 0b0110, 0b0100],
  W: [0b1001, 0b1001, 0b1111, 0b1111, 0b1001],
  "!": [0b0100, 0b0100, 0b0100, 0b0000, 0b0100],
  "-": [0b0000, 0b0000, 0b0110, 0b0000, 0b0000],
  " ": [0, 0, 0, 0, 0],
};

const buffer = document.createElement("canvas");

export function draw(
  canvas: HTMLCanvasElement,
  game: Game,
  audio: AudioDirector,
  touch: boolean,
): void {
  const viewW = game.template.width * TILE;
  const viewH = HUD + game.template.height * TILE;
  buffer.width = viewW;
  buffer.height = viewH;
  const gfx = buffer.getContext("2d");
  if (!gfx) return;
  gfx.imageSmoothingEnabled = false;

  gfx.fillStyle = COLOR.floor;
  gfx.fillRect(0, 0, viewW, viewH);
  drawMaze(gfx, game);
  drawActors(gfx, game, audio);
  drawHud(gfx, game, viewW);
  drawBanner(gfx, game, viewW, viewH, touch);

  const pad = touch ? 176 : 0;
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / viewW, (window.innerHeight - pad) / viewH)));
  const cssW = viewW * scale;
  const cssH = viewH * scale;
  if (canvas.width !== cssW) canvas.width = cssW;
  if (canvas.height !== cssH) canvas.height = cssH;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.drawImage(buffer, 0, 0, cssW, cssH);
}

function drawMaze(gfx: CanvasRenderingContext2D, game: Game): void {
  const tick = Math.floor(performance.now() / 80);
  for (let y = 0; y < game.template.height; y++) {
    for (let x = 0; x < game.template.width; x++) {
      const cell = game.grid[y][x];
      const px = x * TILE;
      const py = HUD + y * TILE;
      if (cell === "wall") {
        gfx.fillStyle = COLOR.wall;
        gfx.fillRect(px, py, TILE, TILE);
        gfx.fillStyle = COLOR.wallEdge;
        gfx.fillRect(px, py, TILE, 1);
        continue;
      }
      if (cell === "door") {
        gfx.fillStyle = COLOR.door;
        gfx.fillRect(px, py + 3, TILE, 2);
        continue;
      }
      if (cell === "dot") {
        gfx.fillStyle = COLOR.dot;
        gfx.fillRect(px + 3, py + 3, 2, 2);
      } else if (cell === "power" && (tick & 4) !== 0) {
        gfx.fillStyle = COLOR.power;
        gfx.fillRect(px + 2, py + 2, 4, 4);
      }
    }
  }
}

function drawActors(gfx: CanvasRenderingContext2D, game: Game, audio: AudioDirector): void {
  const tick = Math.floor(performance.now() / 70);
  const viewW = game.template.width * TILE;
  for (const actor of game.actors) {
    const pos = actorPixel(actor);
    const px = Math.round(pos.x * TILE);
    const py = HUD + Math.round(pos.y * TILE);
    const paint = (x: number) => {
      if (actor.kind === "ghost") drawGhost(gfx, actor, x, py, tick, audio);
      else drawPac(gfx, x, py, actor.dir, actor.dir === NONE ? 0 : [0, 1, 2, 1][tick % 4]);
    };
    paint(px);
    if (px < 0) paint(px + viewW);
    if (px + TILE > viewW) paint(px - viewW);
  }
}

function drawPac(gfx: CanvasRenderingContext2D, x: number, y: number, dir: number, amount: number): void {
  gfx.fillStyle = COLOR.pac;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (!bitOn(PAC_DISC[row], col)) continue;
      if (inMouth(col, row, dir, amount)) continue;
      gfx.fillRect(x + col, y + row, 1, 1);
    }
  }
}

function inMouth(col: number, row: number, dir: number, amount: number): boolean {
  if (amount <= 0 || dir === NONE) return false;
  let localCol = col;
  let localRow = row;
  if (dir === LEFT) localCol = 7 - col;
  else if (dir === DOWN) {
    localCol = row;
    localRow = col;
  } else if (dir === UP) {
    localCol = 7 - row;
    localRow = col;
  }
  const reach = amount === 1 ? 6 : 4;
  const band = amount === 1 ? 1 : 2.2;
  return localCol >= reach && Math.abs(localRow - 3.5) <= band;
}

function drawGhost(
  gfx: CanvasRenderingContext2D,
  actor: Game["actors"][number],
  x: number,
  y: number,
  tick: number,
  audio: AudioDirector,
): void {
  const blink = actor.mode === "fright" && audio.powerTicks < 48 && (tick & 4) === 0;
  if (actor.mode !== "eyes") {
    const frame = GHOST_FRAMES[(tick >> 2) & 3];
    gfx.fillStyle = actor.mode === "fright" ? (blink ? COLOR.frightBlink : COLOR.fright) : actor.color;
    for (let row = 0; row < 8; row++) {
      const bits = frame[7 - row];
      for (let col = 0; col < 8; col++) {
        if (bitOn(bits, col)) gfx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }
  if (actor.mode === "fright") {
    gfx.fillStyle = COLOR.floor;
    gfx.fillRect(x + 1, y + 5, 2, 1);
    gfx.fillRect(x + 4, y + 5, 2, 1);
    return;
  }
  const ox = actor.dir === RIGHT ? 1 : actor.dir === LEFT ? -1 : 0;
  const oy = actor.dir === DOWN ? 1 : actor.dir === UP ? -1 : 0;
  paintEye(gfx, x + 1 + ox, y + 2 + oy);
  paintEye(gfx, x + 4 + ox, y + 2 + oy);
}

function paintEye(gfx: CanvasRenderingContext2D, x: number, y: number): void {
  gfx.fillStyle = COLOR.eye;
  gfx.fillRect(x, y, 2, 2);
  gfx.fillStyle = COLOR.pupil;
  gfx.fillRect(x + 1, y + 1, 1, 1);
}

function drawHud(gfx: CanvasRenderingContext2D, game: Game, viewW: number): void {
  const score = String(game.score).padStart(6, "0");
  blitText(gfx, score, 4, 8, COLOR.text);
  const level = `N${game.level}`;
  blitText(gfx, level, Math.floor((viewW - textWidth(level)) / 2), 8, COLOR.textDim);
  for (let i = 0; i < game.lives; i++) {
    drawPac(gfx, viewW - 12 - i * 10, 8, RIGHT, 1);
  }
  gfx.fillStyle = COLOR.wall;
  gfx.fillRect(0, HUD - 2, viewW, 2);
}

function drawBanner(
  gfx: CanvasRenderingContext2D,
  game: Game,
  viewW: number,
  viewH: number,
  touch: boolean,
): void {
  let line = "";
  let sub = "";
  if (game.phase === "title") {
    line = "PAC-MAN";
    sub = touch ? "TOQUE OU ESPACO" : "SETAS OU WASD";
  } else if (game.phase === "ready") {
    line = "PRONTO!";
  } else if (game.phase === "over") {
    line = "FIM DE JOGO";
    sub = touch ? "TOQUE" : "ESPACO";
  }
  if (!line) return;
  gfx.fillStyle = "rgba(0,0,0,0.35)";
  gfx.fillRect(0, HUD, viewW, viewH - HUD);
  const boxW = Math.max(textWidth(line), sub ? textWidth(sub) : 0) + 12;
  const boxH = sub ? 28 : 16;
  const boxX = Math.floor((viewW - boxW) / 2);
  const boxY = HUD + Math.floor((viewH - HUD - boxH) / 2);
  gfx.fillStyle = "#000000";
  gfx.fillRect(boxX, boxY, boxW, boxH);
  gfx.fillStyle = COLOR.wall;
  gfx.fillRect(boxX, boxY, boxW, 1);
  gfx.fillRect(boxX, boxY + boxH - 1, boxW, 1);
  blitText(gfx, line, Math.floor((viewW - textWidth(line)) / 2), boxY + 4, COLOR.ready);
  if (sub) blitText(gfx, sub, Math.floor((viewW - textWidth(sub)) / 2), boxY + 16, COLOR.text);
}

function textWidth(text: string): number {
  return text.length * 5 - 1;
}

function blitText(gfx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  gfx.fillStyle = color;
  let cursor = x;
  for (const char of text) {
    const rows = FONT[char] ?? FONT[" "];
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < 4; col++) {
        if ((rows[row] & (0b1000 >> col)) !== 0) gfx.fillRect(cursor + col, y + row, 1, 1);
      }
    }
    cursor += 5;
  }
}

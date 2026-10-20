import { createGame, update } from "./core/session";
import { AudioDirector } from "./systems/audio";
import { Input, wantsTouchControls } from "./systems/input";
import { draw } from "./systems/render";

const canvas = document.querySelector<HTMLCanvasElement>("#board");
const pad = document.querySelector<HTMLElement>("#dpad");
const stage = document.querySelector<HTMLElement>("#stage");

if (!canvas || !pad || !stage) {
  throw new Error("A página do jogo não carregou os elementos esperados.");
}

const screen: HTMLCanvasElement = canvas;

const touch = wantsTouchControls();
if (touch) pad.hidden = false;

const input = new Input(pad, stage);
input.attach(touch);
const audio = new AudioDirector();
const game = createGame();

let last = performance.now();
let bank = 0;

function frame(now: number): void {
  bank += Math.min(1000, now - last);
  last = now;
  while (bank >= 1000 / 60) {
    update(game, input, audio);
    bank -= 1000 / 60;
  }
  draw(screen, game, audio, touch);
}

function onPaint(now: number): void {
  frame(now);
  requestAnimationFrame(onPaint);
}

requestAnimationFrame(onPaint);
// Alguns navegadores em segundo plano quase não chamam requestAnimationFrame.
// O relógio de 16 ms segura os 60 quadros; se os dois dispararem juntos,
// o acumulador acima não deixa o jogo andar em dobro.
window.setInterval(() => frame(performance.now()), 16);

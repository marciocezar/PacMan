import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const { createGame, update } = await server.ssrLoadModule("/src/core/session.ts");

function audioStub() {
  return {
    siren: false,
    _left: 0,
    sequenceDone: false,
    powerTicks: 0,
    unlock() {},
    ready() {
      this._left = 8;
      this.sequenceDone = false;
      this.siren = false;
    },
    death() {
      this._left = 8;
      this.sequenceDone = false;
      this.siren = false;
    },
    tick() {
      if (this._left > 0) this._left -= 1;
      if (this._left === 0) this.sequenceDone = true;
    },
    pellet() {},
    power() {
      this.siren = true;
      this._power = 40;
    },
    eatGhost() {},
  };
}

const input = {
  next: -1,
  startPressed: false,
  consumeStart() {
    const pressed = this.startPressed;
    this.startPressed = false;
    return pressed;
  },
};

const game = createGame();
const audio = audioStub();
input.startPressed = true;
update(game, input, audio);
if (game.phase !== "ready") throw new Error(`fase inesperada: ${game.phase}`);

for (let i = 0; i < 20; i++) update(game, input, audio);
if (game.phase !== "play") throw new Error(`não entrou no jogo: ${game.phase}`);

const pac = game.actors[0];
const startX = pac.tx;
input.next = 1;
let guard = 0;
while (pac.tx === startX && guard < 400) {
  update(game, input, audio);
  guard += 1;
}
if (pac.tx === startX) throw new Error("Pac-Man não andou para a direita");

const scoreBefore = game.score;
for (let i = 0; i < 800; i++) update(game, input, audio);
if (game.score <= scoreBefore) throw new Error("pontos não subiram ao comer pastilhas");
if (game.dots >= game.template.dots) throw new Error("pastilhas não diminuíram");

const wallX = pac.tx;
const wallY = pac.ty;
input.next = 0;
for (let i = 0; i < 30; i++) update(game, input, audio);
const movedIntoWall = game.grid[pac.ty]?.[pac.tx] === "wall";
if (movedIntoWall) throw new Error(`entrou na parede em ${pac.tx},${pac.ty} vindo de ${wallX},${wallY}`);

let outside = false;
for (let i = 0; i < 2500 && !outside; i++) {
  update(game, input, audio);
  outside = game.actors.some((actor) => actor.kind === "ghost" && actor.mode !== "house" && actor.ty < 10);
}
if (!outside) throw new Error("nenhum fantasma saiu da casa");

console.log(
  JSON.stringify({
    phase: game.phase,
    score: game.score,
    dots: game.dots,
    pac: { x: pac.tx, y: pac.ty, dir: pac.dir },
    frame: game.frame,
    ghosts: game.actors.filter((a) => a.kind === "ghost").map((a) => ({
      x: a.tx,
      y: a.ty,
      mode: a.mode,
      release: a.release,
      home: [a.homeX, a.homeY],
    })),
  }),
);

await server.close();

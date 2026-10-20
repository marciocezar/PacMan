/**
 * Cores tiradas da tabela em $FF2B da ROM.
 * O jogo original pisca um único registrador (COLUP0) entre quatro tons,
 * porque o TIA só tem duas cores de sprite. Aqui cada fantasma fica com
 * um tom estável dessa mesma família, para a imagem não estroboscopiar.
 *
 * $84 fundo azul do labirinto, $F7 pastilha clara, $FB o sprite do jogador,
 * $7A / $5A o azul do modo assustado, $44 / $C4 / $EC / $DC os fantasmas.
 */

export const COLOR = {
  floor: "#000000",
  wall: "#2c2c9a",
  wallEdge: "#3d4ec4",
  dot: "#f3d7a1",
  power: "#fff4cf",
  pac: "#ffe14a",
  ghosts: ["#ff4b6e", "#3ec8e6", "#ff9a2e", "#e46bff"],
  fright: "#2d3ec8",
  frightBlink: "#d5d8ff",
  eye: "#f4f6ff",
  pupil: "#1a1a8c",
  door: "#ff8ec8",
  text: "#f3d7a1",
  textDim: "#8a7a58",
  ready: "#ffe14a",
};

/**
 * Mini TIA rodando na thread de áudio.
 * O clock de som do Atari é 3,579545 MHz / 114 ≈ 31440 Hz.
 * O jogo manda AUDC, AUDF e AUDV (dois canais) e este processador
 * gera a onda. Modos usados pela ROM: 4 (tom puro) e 9 (ruído de 5 bits)
 * e 13 (tom dividido por 6).
 */

declare const sampleRate: number;

interface WorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

declare const AudioWorkletProcessor: {
  prototype: WorkletProcessor;
  new (): WorkletProcessor;
};

declare function registerProcessor(name: string, ctor: new () => WorkletProcessor): void;

const CLOCK = 31440;

class TiaProcessor extends AudioWorkletProcessor {
  private audc = [0, 0];
  private audf = [0, 0];
  private audv = [0, 0];
  private div = [1, 1];
  private out = [0, 0];
  private tone = [0, 0];
  private extra = [0, 0];
  private poly5 = [0x1f, 0x1f];
  private phase = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        c0: number;
        f0: number;
        v0: number;
        c1: number;
        f1: number;
        v1: number;
      };
      this.audc[0] = data.c0 & 15;
      this.audf[0] = data.f0 & 31;
      this.audv[0] = data.v0 & 15;
      this.audc[1] = data.c1 & 15;
      this.audf[1] = data.f1 & 31;
      this.audv[1] = data.v1 & 15;
    };
  }

  private clock(i: number): void {
    this.div[i] -= 1;
    if (this.div[i] > 0) return;
    this.div[i] = this.audf[i] + 1;
    const mode = this.audc[i];

    if (mode === 4 || mode === 5) {
      this.tone[i] ^= 1;
      this.out[i] = this.tone[i];
      return;
    }

    if (mode === 12 || mode === 13) {
      this.extra[i] = (this.extra[i] + 1) % 3;
      if (this.extra[i] === 0) this.tone[i] ^= 1;
      this.out[i] = this.tone[i];
      return;
    }

    if (mode === 7 || mode === 9 || mode === 14 || mode === 15) {
      const sr = this.poly5[i] & 0x1f;
      const feedback = ((sr >> 2) ^ sr) & 1;
      this.poly5[i] = ((sr >> 1) | (feedback << 4)) & 0x1f;
      this.out[i] = this.poly5[i] & 1;
      return;
    }

    this.out[i] = 0;
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channel = outputs[0]?.[0];
    if (!channel) return true;
    const step = CLOCK / sampleRate;
    for (let i = 0; i < channel.length; i++) {
      this.phase += step;
      while (this.phase >= 1) {
        this.phase -= 1;
        this.clock(0);
        this.clock(1);
      }
      const left = this.out[0] ? this.audv[0] / 15 : 0;
      const right = this.out[1] ? this.audv[1] / 15 : 0;
      channel[i] = (left + right) * 0.45;
    }
    return true;
  }
}

registerProcessor("tia", TiaProcessor);

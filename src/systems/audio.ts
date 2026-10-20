/**
 * Tradução direta da rotina de som em $FF55 / $FF94.
 *
 * Canal 0 (efeitos, disparados por $FF43):
 *   comer pastilha  → AUDC 9, AUDF 9, volume caindo de 9 a 1 em 9 quadros (o "waka")
 *   pastilha de poder → AUDC 13, AUDF 13, volume 13, 16 quadros
 *   comer fantasma → AUDC 4, frequência e volume derivados do temporizador de $30 quadros
 *
 * Canal 1:
 *   sirene do medo → AUDC 4, AUDF = (quadro >> 1) & 15, volume inverso
 *   música de entrada → dois tons da tabela $FFF1 / $FFF5
 *   morte → AUDC 4, AUDF = temporizador >> 1, volume = temporizador
 */

export interface Registers {
  c0: number;
  f0: number;
  v0: number;
  c1: number;
  f1: number;
  v1: number;
}

const JINGLE_F0 = [0x08, 0x04, 0x0c, 0x04];
const JINGLE_F1 = [0x14, 0x18, 0x14, 0x18];

export class AudioDirector {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private failed = false;
  frame = 0;
  /** Temporizador $E4. Diminui a cada dois quadros, como na ROM. */
  private timer = 0;
  /** Bits de $E7: bit 6 = morte, bit 3 = música de entrada. */
  private flags = 0;
  /** Efeito do canal 0 ($E8) e a duração que falta ($E9). */
  private effect = 0;
  private effectTimer = 0;
  siren = false;

  async unlock(): Promise<void> {
    if (this.failed) return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      try {
        await this.ctx.audioWorklet.addModule(new URL("./tia-worklet.ts", import.meta.url));
        this.node = new AudioWorkletNode(this.ctx, "tia", { outputChannelCount: [1] });
        this.node.connect(this.ctx.destination);
      } catch {
        this.failed = true;
        this.node = null;
      }
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  /** $FF43 com Y = 0 pastilha, 2 poder, 3 fantasma. */
  private trigger(which: 0 | 2 | 3): void {
    const mask = [0x07, 0, 0x01, 0x00][which];
    const bits = [0x08, 0, 0x02, 0x01][which];
    const duration = [0x09, 0, 0x10, 0x30][which];
    if ((this.effect & mask) !== 0) return;
    this.effect = bits;
    this.effectTimer = duration;
  }

  pellet(): void {
    this.trigger(0);
  }

  power(): void {
    this.trigger(2);
    this.siren = true;
    this.timer = 0xa0;
    this.flags &= ~0x48;
  }

  eatGhost(): void {
    this.trigger(3);
  }

  /** Música curta de $FC21 / $FF94, cerca de 2 segundos. */
  ready(): void {
    this.flags = 0x08;
    this.timer = 0x3c;
    this.effect = 0;
    this.siren = false;
  }

  /** Varredura de morte: bit 6 de $E7, temporizador $3F. */
  death(): void {
    this.flags = 0x40;
    this.timer = 0x3f;
    this.effect = 0;
    this.siren = false;
  }

  /** A música de entrada ou a morte já terminou. */
  get sequenceDone(): boolean {
    return this.timer === 0 && (this.flags & 0x48) === 0;
  }

  /** Quadros que faltam na sirene. Serve para o pisca-pisca final. */
  get powerTicks(): number {
    return this.siren ? this.timer : 0;
  }

  tick(): void {
    this.frame += 1;
    if ((this.frame & 1) === 1 && this.timer > 0) this.timer -= 1;

    let c0 = 0;
    let f0 = 0;
    let v0 = 0;
    let c1 = 0;
    let f1 = 0;
    let v1 = 0;

    if (this.effectTimer > 0 && this.effect !== 0) {
      const before = this.effectTimer;
      this.effectTimer -= 1;
      if (this.effectTimer === 0) {
        this.effect = 0;
      } else if (this.effect & 0x01) {
        const freq = before & 0x1f;
        c0 = 4;
        f0 = freq;
        v0 = (freq ^ 0x0f) & 0x0f;
      } else if (this.effect & 0x02) {
        c0 = 0x0d;
        f0 = 0x0d;
        v0 = 0x0d;
      } else if (this.effect & 0x08) {
        c0 = 9;
        f0 = 9;
        v0 = before & 0x0f;
      }
    }

    if (this.flags & 0x40) {
      c1 = 4;
      f1 = (this.timer >> 1) & 31;
      v1 = this.timer & 15;
      if (this.timer === 0) this.flags &= ~0x40;
    } else if (this.flags & 0x08) {
      if (this.timer === 0) {
        this.flags &= ~0x08;
      } else {
        const index = (this.timer >> 3) & 7;
        if (index < 4) {
          c0 = 4;
          c1 = 4;
          f0 = JINGLE_F0[index];
          f1 = JINGLE_F1[index];
          v0 = 8;
          v1 = 8;
        }
      }
    } else if (this.siren) {
      const step = (this.frame >> 1) & 15;
      c1 = 4;
      f1 = step;
      v1 = (step ^ 15) >> 1;
      if (this.timer === 0) this.siren = false;
    }

    this.post({ c0, f0, v0, c1, f1, v1 });
  }

  private post(regs: Registers): void {
    this.node?.port.postMessage(regs);
  }
}

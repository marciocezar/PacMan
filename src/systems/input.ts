import { DOWN, LEFT, NONE, RIGHT, UP } from "../core/types";

const KEY_TO_DIR: Record<string, number> = {
  ArrowUp: UP,
  KeyW: UP,
  ArrowRight: RIGHT,
  KeyD: RIGHT,
  ArrowDown: DOWN,
  KeyS: DOWN,
  ArrowLeft: LEFT,
  KeyA: LEFT,
};

/**
 * Teclado no computador e toque no celular.
 * A direção fica guardada até o Pac-Man chegar no centro da casa,
 * do mesmo jeito que o arcade: você pode pedir a curva antes.
 */
export class Input {
  next = NONE;
  startPressed = false;
  private pointerX = 0;
  private pointerY = 0;
  private tracking = false;

  constructor(private readonly pad: HTMLElement, private readonly board: HTMLElement) {}

  attach(mobile: boolean): void {
    window.addEventListener("keydown", (event) => {
      const dir = KEY_TO_DIR[event.code];
      if (dir !== undefined) {
        this.next = dir;
        this.startPressed = true;
        event.preventDefault();
        return;
      }
      if (event.code === "Space" || event.code === "Enter") {
        this.startPressed = true;
        event.preventDefault();
      }
    });

    if (!mobile) return;

    this.pad.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((button) => {
      const dir = Number(button.dataset.dir);
      const press = (event: Event) => {
        event.preventDefault();
        this.next = dir;
        this.startPressed = true;
      };
      button.addEventListener("pointerdown", press);
    });

    this.board.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement).closest("#dpad")) return;
      this.tracking = true;
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.startPressed = true;
    });

    this.board.addEventListener("pointermove", (event) => {
      if (!this.tracking) return;
      const dx = event.clientX - this.pointerX;
      const dy = event.clientY - this.pointerY;
      if (Math.hypot(dx, dy) < 28) return;
      this.next = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP;
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
    });

    const end = () => {
      this.tracking = false;
    };
    this.board.addEventListener("pointerup", end);
    this.board.addEventListener("pointercancel", end);
  }

  consumeStart(): boolean {
    const pressed = this.startPressed;
    this.startPressed = false;
    return pressed;
  }
}

/**
 * Desktop (Mac/Windows, inclusive a janela Tauri) marca `data-platform="desktop"`
 * e fica só no teclado. Android e iOS nativos marcam `android` ou `ios` e
 * mostram o controle. Na Web, a HUD aparece quando o navegador tem
 * `ontouchstart` e pelo menos um ponto de toque real.
 */
export function wantsTouchControls(): boolean {
  const platform = document.documentElement.dataset.platform;
  if (platform === "desktop") return false;
  if (platform === "android" || platform === "ios") return true;
  return "ontouchstart" in window && navigator.maxTouchPoints > 0;
}

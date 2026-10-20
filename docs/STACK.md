# Stack

## Decisão

O runtime é **TypeScript + Vite + Canvas 2D + Web Audio (AudioWorklet)**.

Godot 4 e Phaser com Tauri e Capacitor também exportam as cinco plataformas. Os dois trazem um motor de cena, um runtime e mais um projeto para instalar. A partida já era uma grade de 152×214 pixels e duas vozes de som. Canvas e AudioWorklet cobrem isso sem uma camada no meio, e o teste `tools/sim.mjs` importa a regra direto, sem abrir um motor.

Tauri e Capacitor não estão no `package.json`. Eles entram na hora de empacotar, em volta da mesma pasta `builds/web`. O `vite.config.ts` usa `base: "./"` para essa pasta funcionar dentro de um WebView.

## O que roda no aparelho de quem joga

Nenhuma biblioteca de jogo. Só a plataforma.

| Peça | Versão / API | Função |
| --- | --- | --- |
| HTML | `index.html` | Canvas `#board` e `#dpad` com `hidden` |
| CSS | `src/systems/screen.css` | Fundo preto, pixel nítido, grade 3×3, `safe-area-inset-bottom` |
| JavaScript | ES2022, gerado pelo Vite | Regra, desenho e som |
| Canvas 2D | contexto do `#board` | Retângulos de 1 px no buffer, depois `drawImage` inteiro |
| Web Audio | `AudioContext` + `AudioWorkletNode` | Amostras fora da thread do quadro |
| Eventos | `keydown`, `pointerdown`, `pointermove` | Teclado sempre; HUD só quando `wantsTouchControls()` é verdadeiro |

### Por que Canvas e não WebGL

O quadro é uma ampliação inteira de um buffer pequeno. Um retângulo e um `drawImage` com suavização desligada custam menos e não pedem shader. A proporção fica travada porque a escala é `Math.floor` do menor eixo. A janela nunca recebe uma escala diferente na largura e na altura.

### Por que AudioWorklet

O TIA produz uma amostra a cada tick de 31440 Hz. Se essa conta rodasse no `requestAnimationFrame`, um quadro perdido atrasaria o waka. O worklet recebe `{c0,f0,v0,c1,f1,v1}` por `postMessage` e segue o relógio da placa. `latencyHint: "interactive"` pede o menor buffer que o sistema aceita. No Android e no iOS o gesto de começar chama `resume()`; sem isso o navegador deixa o contexto suspenso (autoplay).

Se `audioWorklet.addModule` rejeitar, o diretor marca `failed` e `tick` deixa de postar. A partida não para.

## O que só existe na máquina de desenvolvimento

| Pacote | Pedido em `package.json` | Papel |
| --- | --- | --- |
| Node.js | `>=20` | Roda o Vite e o teste |
| TypeScript | `^5.7.2` | `strict`, `noUnusedLocals`, `noEmit` |
| Vite | `^6.2.0` | Servidor e bundle |

`npm run build` e `npm run build:web` executam `tsc --noEmit` e depois `vite build`. O tipo quebrado impede a pasta `builds/web`. O compilador não emite JavaScript: quem emite é o Vite, alvo `es2022`, sem sourcemap.

`tsconfig.json` inclui só `src`. Os JSON em `assets/` são a referência extraída; o código que toca o som guarda os mesmos inteiros em `src/systems/audio.ts` para o worklet não depender de `fetch` na thread de áudio.

## Pipelines

```
src/  +  assets/  +  index.html
        │
        ▼
   vite build  →  builds/web/          Web (HTML5)
        │
        ├── Tauri WebView      →  .exe / .app / .dmg     Mac e Windows
        ├── Capacitor Android  →  .apk / .aab            Android
        └── Capacitor iOS      →  .ipa via Xcode         iOS
```

| Alvo | Comando que gera o miolo | Janela | Marca no HTML |
| --- | --- | --- | --- |
| Web | `npm run build:web` | o próprio navegador | nenhuma: `ontouchstart` decide a HUD |
| Desktop | o mesmo `builds/web` dentro do Tauri | WKWebView no Mac, WebView2 no Windows | `data-platform="desktop"` |
| Android | o mesmo, via `npx cap sync android` | WebView do sistema | `data-platform="android"` |
| iOS | o mesmo, via `npx cap sync ios` | WKWebView | `data-platform="ios"` |

`wantsTouchControls()` em `src/systems/input.ts`:

1. `data-platform="desktop"` força teclado, mesmo que o WebView anuncie toque.
2. `data-platform="android"` ou `"ios"` força a HUD.
3. Na Web, a HUD liga só com `"ontouchstart" in window` e `navigator.maxTouchPoints > 0`. O segundo teste evita que um computador que apenas declara a API de toque mostre os botões.

Os comandos completos de Tauri e Capacitor, com os pré-requisitos de Rust, Android Studio e Xcode, estão em `docs/README.md`. As pastas `builds/desktop`, `builds/android` e `builds/ios` estão no `.gitignore` para receber os instaladores sem entrar no git. `builds/.gitkeep` segura a pasta vazia.

## Otimizações que ficaram no código

- Um buffer de 152×214 e uma cópia ampliada por inteiro. O laço de pintura não percorre a janela pixel a pixel.
- O acumulador de `main.ts` recupera no máximo 1000 ms por chamada. Um aba em segundo plano não despeja minutos de simulação num único frame, e também não fica presa em “PRONTO!” quando o animation frame atrasa.
- `setInterval(16)` e `requestAnimationFrame` compartilham o mesmo acumulador. Os dois juntos não andam em dobro.
- O worklet mistura no máximo dois canais de 4 bits. Não há decodificador de MP3 nem amostra gravada.
- A IA é uma distância de Manhattan entre casas vizinhas (no máximo três candidatas) e um LFSR de um byte. Não há busca de caminho.
- `eatTiles` ignora a casa assim que a distância passa de 0,48, e para no quadro em que a última pastilha some.
- O teste de regra não sobe canvas nem áudio real.

## O que não foi colocado de propósito

Phaser, Godot, Tauri e Capacitor não estão instalados. Adicioná-los aumentaria `node_modules` e pediria Rust ou um SDK nativo para quem só quer ler a regra ou abrir o navegador. O formato de `builds/web` já é o que esses empacotadores consomem.

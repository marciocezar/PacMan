# Pac-Man, recriado e reorganizado

Este jogo lê a ROM `Pac-Man (1981) (Atari).a26` e a recria para cinco lugares: o navegador, o Mac, o Windows, o Android e o iPhone. Pac-Man é marca da Bandai Namco. Isto é um estudo, não o produto oficial.

## O que a auditoria mudou

O código antigo já jogava, mas estava todo numa pasta só (`src/game`) e misturava regra, desenho e som. A comparação com a ROM mostrou três correções:

1. **Os fantasmas não têm o cérebro do fliperama.** Na ROM do Atari 2600 os quatro perseguem a casa em que o Pac-Man está. Não existe o modo Scatter (ir para um canto) nem a mira especial de Blinky, Pinky, Inky e Clyde. Inventar isso e chamar de fiel ao cartucho seria um erro. Os quatro nomes agora são fichas separadas, com atraso de saída próprio, e a perseguição continua a da ROM.
2. **A curva perdoava pouco.** Se você pedia a esquina um pouco antes ou um pouco depois do centro da casa, o Pac-Man seguia reto. Agora há uma janela curta nos dois lados do cruzamento.
3. **A colisão era uma casa inteira.** Pastilha e fantasma só contavam quando o programa decidia que os dois estavam no mesmo quadrado. Agora a boca alcança a pastilha a 0,48 casa de distância, e o fantasma encosta quando os corpos ficam a até 0,62 casa.

O controle virtual continua fora do Mac e do Windows. Na Web ele só aparece se o navegador tiver toque de verdade (`ontouchstart` e um ponto de toque).

## Onde está cada coisa

```
PacMan/
├── Pac-Man (1981) (Atari).a26     A ROM. O site publicado não a embute.
├── index.html                     A página: tela e os quatro botões escondidos.
├── package.json                   Comandos e dependências.
├── assets/
│   ├── graphics/                  Bytes dos fantasmas e o texto do labirinto.
│   └── audio/                     Números exatos do chip de som (TIA).
├── src/
│   ├── main.ts                    Liga o relógio de 60 quadros.
│   ├── core/                      Regra: fases, movimento, fantasmas, fase.
│   ├── entities/                  Pac-Man, Blinky, Pinky, Inky, Clyde, pastilha.
│   └── systems/                   Teclado, toque, som e desenho.
├── docs/                          Estes textos e a listagem da ROM.
├── builds/                        Sai daqui o site, e no futuro o app.
└── tools/                         Leitor da ROM e um teste sem navegador.
```

| Pasta | Para que serve |
| --- | --- |
| `src/core/session.ts` | O relógio de uma partida: título, pronto, jogo, morte, fase nova |
| `src/core/ghosts.ts` | Estados do fantasma e a escolha do caminho. Não desenha nada |
| `src/core/movement.ts` | Andar, curva na esquina, pastilha e encostar no fantasma |
| `src/core/level.ts` | O labirinto e a porta da casa |
| `src/entities/` | Quem é cada boneco e quantos pontos vale cada pastilha |
| `src/systems/input.ts` | Teclado sempre; botões só no toque ou no app de celular |
| `src/systems/audio.ts` | Liga o som depois do primeiro toque ou tecla |
| `src/systems/render.ts` | Pinta o quadro e amplia sem esticar |
| `docs/reverse-engineering/` | O programa 6502 anotado e o mapa do chip TIA |

## Instalar

1. Instale o Node.js 20 ou mais novo. No terminal, `node -v` deve mostrar v20 ou maior.
2. Abra o terminal na pasta do projeto.
3. Rode:

```bash
npm install
```

## Jogar enquanto desenvolve

```bash
npm run dev
```

Abra o endereço que aparecer, em geral `http://127.0.0.1:5173/`.

- **Mac e Windows:** setas ou W A S D. Espaço ou Enter começa e recomeça. Não há botões na tela.
- **Android, iPhone e iPad, e o navegador de um celular:** quatro botões translúcidos embaixo, ou arrastar o dedo no labirinto.
- O primeiro Espaço, Enter, seta ou toque libera o som. O navegador bloqueia áudio até esse gesto.

Para parar o servidor, `Ctrl+C`.

## Gerar cada plataforma

O jogo em si é o mesmo. Muda a janela em volta da pasta `builds/web`.

### Web (HTML5)

```bash
npm run build:web
```

O site sai em `builds/web`. Para experimentar essa pasta:

```bash
npm run preview
```

### Windows (`.exe`) e Mac (`.app` e `.dmg`)

Usa o [Tauri](https://tauri.app/). Antes: instale o Rust em <https://rustup.rs/>. No Mac, `xcode-select --install`. No Windows, o Visual Studio Build Tools com “Desktop development with C++”.

```bash
npm install -D @tauri-apps/cli@latest
npx tauri init
```

No assistente: comando de desenvolvimento `npm run dev`, comando de build `npm run build:web`, pasta do frontend `../builds/web`, URL `http://127.0.0.1:5173`.

No HTML da janela nativa, deixe `<html data-platform="desktop">` para o controle virtual não aparecer.

```bash
npx tauri build
```

O `.exe` sai em `src-tauri/target/release/bundle/`. O `.app` e o `.dmg` saem nas pastas `macos` e `dmg` do mesmo bundle. Copie os instaladores para `builds/desktop` se quiser tudo num lugar só.

### Android (`.apk` e `.aab`)

Precisa do Android Studio. O Capacitor abre o site dentro do app.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Pac-Man 2600" com.estudo.pacman2600 --web-dir builds/web
npm run build:web
npx cap add android
npx cap sync android
npx cap open android
```

Antes do sync, no `index.html` do build (ou num gancho do Capacitor), use `<html data-platform="android">`. Assim a HUD de botões aparece mesmo que o WebView esconda `ontouchstart`.

No Android Studio: **Build > Build Bundle(s) / APK(s)**. O APK instala direto. O AAB é o arquivo da Play Store. Guarde as saídas em `builds/android`.

### iOS (`.ipa`)

Só num Mac, com o Xcode. Conta Apple grátis instala no seu iPhone. App Store exige a conta paga.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Pac-Man 2600" com.estudo.pacman2600 --web-dir builds/web
npm run build:web
npx cap add ios
npx cap sync ios
npx cap open ios
```

Use `<html data-platform="ios">`. No Xcode, escolha o iPhone e aperte Run. Para o `.ipa`: **Product > Archive**, depois **Distribute App**. Guarde o arquivo em `builds/ios`.

Sempre que mudar o jogo:

```bash
npm run build:web
npx cap sync
```

## Controles

| Onde | O que aparece |
| --- | --- |
| Mac e Windows, navegador ou Tauri | Só teclado |
| Android e iOS, app ou navegador do celular | Botões translúcidos e arrastar |
| Web no computador | Só teclado |
| Web num aparelho com toque | A mesma HUD do celular |

## O que este estudo não copia

- O labirinto da ROM era pintado linha a linha. O de `assets/graphics/maze.txt` é a planta jogável (165 pastilhas, porta, túneis).
- Não há fruta: a ROM não tem esse desenho.
- Não há sirene o tempo todo: ela toca na pastilha de poder.
- Os fantasmas não piscam entre si como no tubo de 1981. Cada um tem uma cor estável.

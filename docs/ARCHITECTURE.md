# Arquitetura

Este texto descreve a auditoria contra a ROM, a máquina de estados dos fantasmas e o caminho de um quadro, do input até o pixel.

## Auditoria

A referência é a ROM de 4096 bytes mapeada em `$F000`–`$FFFF`, com reset em `$F000`. A listagem anotada está em `docs/reverse-engineering/pacman.disasm.txt`. O mapa dos registradores do TIA está em `docs/reverse-engineering/tia_map.json`. O leitor que gerou os dois é `tools/analyze_rom.py`.

O REA (`https://github.com/morluto/rea`) foi avaliado neste projeto. Ele decodifica 6502 quando o Ghidra está instalado, e não modela o TIA: não recupera AUDC/AUDF/AUDV, não monta o labirinto e não separa sprite de kernel de vídeo. O Ghidra não está nesta máquina. A comparação de fidelidade usa a listagem e as tabelas extraídas, não uma descompilação genérica.

### Problemas que a base anterior tinha

| Ponto | O que o código fazia | O que a ROM faz | Correção |
| --- | --- | --- | --- |
| Personalidade | Um único `chooseGhost` para os quatro, alvo = casa do Pac-Man | O mesmo: não há rotina distinta por fantasma | Mantido, agora em `src/core/ghosts.ts`, com uma ficha por sprite |
| Scatter | Não existia | Não existe na ROM | Não foi adicionado. Documentado como ausência |
| Frightened | Modo `fright`, alvo espelhado, reversão | Pastilha liga a sirene e inverte quem está fora | Mantido |
| Eaten | Modo `eyes` volta ao `pen` | Olhos em `$FDC6` e retorno à casa | Mantido, nome de domínio “eaten” no texto; no código o modo continua `eyes` |
| Cornering | A curva só entrava com `prog === 0` | O jogador do 2600 vira no centro da casa, com pouca folga | Janela 0,22 no começo da casa e 0,78 no fim |
| Pastilha | Comida quando `centerOf` caía na casa | A boca ocupa o bloco de 8 pixels | Alcance de 0,48 casa a partir da origem do sprite |
| Fantasma | Morte só na mesma casa discreta | Sobreposição dos sprites de 8 pixels | Distância de Manhattan ≤ 0,62 casa, com túnel |
| Sirene | Só na pastilha de poder | Canal 1, forma 4, enquanto `$E4` conta | Mantido. Não há sirene de fundo fora disso |
| Waka | AUDC 9, AUDF 9, volume 9→1 | `$FF43` Y=0, duração `$09` | Mantido, tabela em `assets/audio/tia.json` |

## Componentes e sistemas

O jogo é um sistema de entidades por componentes, sem biblioteca de ECS. Cada boneco é um `Actor`: um saco de componentes. Nenhum componente desenha. Nenhum sistema de desenho escolhe caminho.

| Componente (campo de `Actor`) | Dono |
| --- | --- |
| `name`, `kind`, `color`, `homeX`, `homeY` | identidade, em `src/entities/` |
| `tx`, `ty`, `dir`, `next`, `prog` | corpo e curva, em `src/core/movement.ts` |
| `mode`, `release` | cérebro, em `src/core/ghosts.ts` |
| `grid` com `dot` / `power` | pastilha, constantes em `src/entities/pellet.ts` |

| Sistema | Arquivo | Lê | Escreve |
| --- | --- | --- | --- |
| Sessão | `src/core/session.ts` | fase, input, áudio | fase, vidas, nível |
| Fantasmas | `src/core/ghosts.ts` | casa do Pac-Man, LFSR | `mode`, direção escolhida |
| Movimento | `src/core/movement.ts` | grade, `next` | `tx`, `ty`, `prog`, pastilhas, pontos |
| Input | `src/systems/input.ts` | teclado, ponteiro | `next`, gesto de começar |
| Áudio | `src/systems/audio.ts` + `tia-worklet.ts` | eventos da sessão | registradores TIA, amostras |
| Desenho | `src/systems/render.ts` | estado já decidido | pixels |

`render.ts` não importa `ghosts.ts`. A IA pode rodar no teste `tools/sim.mjs` sem canvas.

## Máquina de estados do fantasma

```
house --(frame >= release)--> leave --(chegou na porta)--> chase
chase --(pastilha de poder)--> fright --(sirene acabou)--> chase
fright --(encostou no Pac-Man)--> eyes --(chegou no pen)--> house
leave, durante a sirene, entra direto em fright
```

| Modo no código | Nome pedido | Alvo | Velocidade no nível 1 |
| --- | --- | --- | --- |
| `house` | na casa | nenhum, parado | 0 |
| `leave` | saindo | `exit`, a casa acima da porta | 0,084 |
| `chase` | Chase | `tx`,`ty` do Pac-Man, para os quatro nomes | 0,084 |
| `fright` | Frightened | canto espelhado (`largura-1-x`, `altura-1-y`) | 0,055 |
| `eyes` | Eaten | `pen`, o centro da casa | 0,18 |

A porta (`door`) só deixa passar `leave` e `eyes`. O Pac-Man nunca entra.

Saída escalonada, em quadros, a partir do momento em que a fase começa:

| Sprite | Arquivo | Atraso |
| --- | --- | --- |
| Blinky | `src/entities/blinky.ts` | 0 |
| Pinky | `src/entities/pinky.ts` | 110 |
| Inky | `src/entities/inky.ts` | 220 |
| Clyde | `src/entities/clyde.ts` | 330 |

A ordem espacial é a do labirinto: o G mais alto é o Blinky, depois esquerda, centro e direita na fileira de baixo. A cor vem da tabela `$FF2B`, não da pintura do fliperama.

### Por que não há Scatter nem mira diferente

No fliperama, Blinky mira o Pac-Man, Pinky mira quatro casas à frente, Inky usa um vetor com o Blinky e Clyde foge quando está perto. Essas rotinas não estão na ROM de 4 KB. O desempate que está na ROM é o LFSR de 8 bits em `$FBE0` (`stepLfsr` em `ghosts.ts`): duas saídas com a mesma distância usam o bit gerado, e o fantasma não dá meia-volta salvo se for o único caminho.

O ritmo sobe com a fase: `pace = min(1,45, 1 + (nível-1) * 0,06)`, aplicado ao Pac-Man (0,094) e à perseguição (0,084). Medo e olhos não usam esse fator.

## Fases da partida

`session.ts` é a única peça que troca a fase.

| Fase | Movimento | Som que destrava a próxima |
| --- | --- | --- |
| `title` | parado | gesto chama `audio.unlock()` e entra em `ready` |
| `ready` | parado | música de `$3C` meios-quadros, cerca de 2 s |
| `play` | anda | — |
| `dying` | parado | varredura `$3F`; depois tira uma vida |
| `clear` | parado | a mesma música; repõe a grade e sobe o nível |
| `over` | parado | 0 vidas; o próximo gesto zera o placar |

`audio.tick()` roda também em `ready`, `dying` e `clear`, senão o temporizador não chega a zero e a frase “PRONTO!” não sai.

## Um quadro

`src/main.ts` acumula o tempo real e consome passos de `1000/60` ms, no máximo 1 s de atraso por chamada. `requestAnimationFrame` desenha. Um `setInterval` de 16 ms segura o passo quando o navegador quase não chama o animation frame.

Em `play`, a ordem dentro de `stepPlay` é fixa:

1. Move o Pac-Man (curva, depois avanço).
2. Para cada fantasma fora da casa, move com a velocidade do modo.
3. Come pastilhas cujo centro está a ≤ 0,48 casa da origem do sprite.
4. Se um corpo em `chase` ou `leave` está a ≤ 0,62, a fase vira `dying`.
5. Se o corpo está em `fright`, vira `eyes`, soma 20, 40, 80 ou 160 e toca o efeito de comer fantasma.

A curva (`tryCorner`):

- Nos primeiros 22% da casa, se o lado pedido está aberto, a direção muda na hora.
- A partir de 78%, se a casa da frente está livre e a saída lateral dela também, o ator ocupa essa casa e já olha para o lado. O resto do passo (`prog - 1`) não se perde.
- A meia-volta continua imediata: a casa atual recua e `prog` vira `1 - prog`.

A pastilha de poder zera a cadeia, soma 5, liga a sirene (`timer = $A0`, um sim e um não, cerca de 5 s) e põe `next` na direção oposta de quem está em `chase` ou `fright`.

## Áudio, separado do quadro

`AudioDirector.tick` reproduz `$FF43`, `$FF55` e `$FF94`. Ele não gera amostras. Manda seis inteiros ao worklet:

| Efeito | AUDC | AUDF | AUDV |
| --- | --- | --- | --- |
| Waka | 9 | 9 | o temporizador, de 9 a 1 |
| Poder | 13 | 13 | 13, 16 quadros |
| Comer fantasma | 4 | `timer & 31` | `(freq xor 15) & 15`, 48 quadros |
| Música de entrada | 4 nos dois canais | `$FFF1` = 8,4,12,4 e `$FFF5` = 20,24,20,24 | 8 |
| Sirene | 4 | `(quadro >> 1) & 15` | `((freq xor 15) >> 1)` |
| Morte | 4 | `timer >> 1` | `timer & 15`, a partir de `$3F` |

O worklet anda um relógio de 31440 Hz (3,579545 MHz / 114) e reamostra para a taxa da placa. Forma 4/5 é um quadrado. Forma 12/13 divide de novo por 3 e depois inverte. Forma 9 é o ruído de 5 bits. O volume 0–15 vira amplitude `(v/15) * 0,45` por canal.

`unlock()` cria o `AudioContext` com `latencyHint: "interactive"` só depois do gesto. Se o worklet falhar, `failed` fica verdadeiro e o jogo segue mudo.

## Desenho

O buffer lógico tem `19 * 8` por `22 + 24 * 8` pixels (152×214). A escala na janela é `floor` da divisão, nunca uma fração, com `imageSmoothingEnabled = false` e `image-rendering: pixelated`. Sobra tarja preta. No modo toque, 176 px de baixo ficam reservados para a HUD antes dessa conta.

Os quatro quadros do fantasma são os bytes `$FD8B`, `$FD93`, `$FD9B` e `$FDA3`, desenhados de baixo para cima. A cópia legível está em `assets/graphics/sprites.json`. O disco do Pac-Man é desenhado no projeto: a ROM não guarda um bitmap limpo dele.

## Teste sem navegador

`node tools/sim.mjs` sobe o Vite em modo SSR, troca o áudio por um temporizador de 8 quadros e exige: sair do título, entrar em `play`, andar para a direita, subir o placar, não pisar em parede e ver um fantasma com `ty < 10` fora da casa.

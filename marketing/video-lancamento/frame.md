# frame.md · Bunviko — vídeo de lançamento (v1)

Sistema de motion da marca Bunviko. Fonte de tudo: a identidade da marca enviada pelo usuário
(paleta, logo, Viko, slogan) e o produto que existe hoje (chamar-garcom-topaz.vercel.app).
Não usa nada da Conkio além do método.

## Formato
| Pedido | Tamanho | Margem segura |
|---|---|---|
| apresentação (PowerPoint / YouTube) | **1920×1080 (16:9)** | 120 px laterais, 80 px em cima e embaixo |

Duração alvo: **~26 s**. O usuário amplia/encaixa depois no editor.

## Identidade (da folha "Identidade da marca")
| Token | Valor | Uso |
|---|---|---|
| `--amarelo` | `#FFCF35` | fundo principal, cor da virada |
| `--laranja` | `#EF7130` | faíscas, botão, destaque (uma palavra por frase) |
| `--vermelho` | `#CE3B25` | manchas de fundo, alerta |
| `--marrom` | `#32231C` | texto, logo, fundo escuro |
| `--creme` | `#FDF8EF` | fundo claro |
| `--viko` | `#FDEEDB` | corpo do Viko |

- **Tipografia:** Nunito (local), redonda e pesada como o logo. Duas vozes de texto:
  1. **palavra-chave** em Nunito 1000, minúscula, 160–260 px, `letter-spacing -0.04em`;
  2. **etiqueta** pequena em Nunito 900, CAIXA-ALTA espaçada, 28–34 px.
- No máximo **uma palavra em laranja por frase**.
- Fundo troca de cor a cada cena, só na paleta: amarelo → creme → marrom → amarelo (virada) → creme → amarelo.

## Logo
`bunviko` em marrom, Nunito 1000, minúsculo, + **3 faíscas laranja** no canto superior direito
(como na folha da marca). Versão reduzida: `bunviko` branco sobre marrom.
**Animação de assinatura:** as letras sobem por máscara e as 3 faíscas "estalam" uma a uma (pop + squash).

## Elementos de assinatura
1. **Fio condutor = as faíscas laranja.** Nascem do botão quando ele é apertado, viajam como
   "sinal" até o celular do garçom, marcam cada etapa do rastreio e terminam como as faíscas do logo.
2. **Viko** (mascote, SVG próprio já criado no produto): presente do início ao fim, muda de
   expressão conforme a cena (feliz, animado com sino, atento com bloquinho, chef, alegre com
   bandeja, apaixonado com brilhos). Squash & stretch só nele e no botão.
3. **Objeto herói = o aparelho Bunviko** em 2D (cunha creme, base laranja, tela com o Viko,
   botão laranja em cima), desenhado a partir do conceito/modelo 3D.
4. **Interface real desmontada:** o alerta "Mesa 3 está chamando!" do celular do garçom e o
   rastreio da mesa (Anotado → Na cozinha → A caminho → Entregue), redesenhados em vetor.
5. Textura: granulação leve e vinheta quente, quase imperceptíveis. Sem HUD.

## Tokens de movimento (objeto `M`)
| Token | Curva | Duração | Uso |
|---|---|---|---|
| `IN` | `expo.out` | 0.6 s | toda entrada |
| `OUT` | `power3.in` | 0.35 s | toda saída |
| `TR` | `power4.inOut` | 0.55 s | transições |
| `POP` | `back.out(2.4)` | 0.45 s | faíscas, selos, balões |
| `SQ` | `elastic.out(1,0.5)` | 0.7 s | pouso com squash (Viko, botão) |
| `STAG` | — | 0.06 s | atraso entre letras/linhas |

## Regras de movimento
1. Texto entra por máscara (`yPercent 120 → 0`), sai para `-140`.
2. Leitura: `max(1.0 s, 0.3 s × palavras)` parado.
3. Sem corte seco. Transições: **flood a partir do botão**, **mergulho na tela do aparelho**,
   **faísca que vira linha** (o sinal), **persiana** amarela.
4. Câmera viva: push-in 1 → 1.03 em toda cena.
5. Continuidade: o último elemento de uma cena vira o primeiro da próxima.
6. A palavra faz o que significa ("acenando" balança; "na hora" chega de uma vez, com impacto).
7. Proibidos: neon, partículas, crossfade, tremor de câmera, números inventados.

## Tom
Amiga que conta uma novidade boa para o dono de restaurante: animada, próxima, falada.
Ordem: pergunta-gancho → o incômodo do salão → virada "Com o Bunviko" → como funciona → marca → Instagram.

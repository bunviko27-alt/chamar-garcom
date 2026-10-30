# Bunviko: carcaça 3D

Carcaça em cunha para **Raspberry Pi 3 Model B + tela touch HDMI de 5" (120,5 x 77 mm)**.
O Pi vai espetado atrás da tela pelos pinos GPIO, então a carcaça só precisa segurar a tela.

Medidas externas: **156 x 111 x 113 mm** (com a base).

## Peças (`stl/`)
| Arquivo | Qtd | Cor | Como imprimir |
|---|---|---|---|
| `carcaca.stl` | 1 | creme | em pé, aberta para baixo, **com suporte** (janela da tela e teto interno) |
| `base.stl` | 1 | laranja | como está, face lisa na mesa |
| `botao.stl` | 1 | laranja | como está (de cabeça para baixo) |
| `suporte_botao.stl` | 1 | qualquer | como está |
| `presilha.stl` | 4 | qualquer | como está |

PLA ou PETG, 0,2 mm, 3 perímetros, 15–20% de preenchimento. Cabe em qualquer impressora com mesa de 180 x 180 mm ou mais.

## Peças compradas
- Tela touch HDMI de 5" (120,5 x 77 mm) + Raspberry Pi 3 Model B
- 4 parafusos M3 x 10 (base) e 4 parafusos M3 x 8 (presilhas), autoatarraxantes para plástico
- 2 parafusos M2.5 x 6 (suporte do botão)
- 1 chave táctil 12 x 12 x 7,3 mm (botão de cima, ligado num GPIO do Pi)
- Manta de borracha antiderrapante adesiva (silicone ou "nano gel"), cortada no formato da base
  com ~5 mm de borda: segura o aparelho na mesa na hora do toque
- Cabo de energia USB (entra pelo furo de 12 x 6 mm atrás; as fendas de trás são só ventilação)

## Montagem
1. Encaixe a tampa do `botao` por dentro, de baixo para cima, e parafuse o `suporte_botao` com a chave.
2. Coloque a tela (com o Pi já espetado atrás) encostada por dentro da frente e prenda com as 4 `presilhas`.
3. Ligue o Pi à tela e o cabo de energia, depois feche com a `base`.

## Alterar medidas
Todos os valores ficam no topo de `gerar_modelo.py`. Por exemplo, para outra tela, troque
`VIDRO_L`, `VIDRO_A`, `JANELA_L` e `JANELA_A`. Depois gere de novo:
```
pip install manifold3d trimesh matplotlib
python gerar_modelo.py
python previa.py        # atualiza previa/bunviko.glb (visualizador em previa/index.html)
```
**Antes de imprimir**, confira na sua tela:
- `VIDRO_E` (hoje 7 mm): espessura da tela na borda, onde a presilha aperta;
- posição do vidro na placa: já medida (sobra 2,3 mm em cima e 4,3 embaixo), por isso a abertura sobe 1 mm (`JANELA_DY`).

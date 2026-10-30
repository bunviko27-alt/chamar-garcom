# Bunviko · vídeo de lançamento (16:9, ~26 s)

Vídeo de lançamento do Bunviko (botão de chamar garçom na mesa + rastreio do pedido), em motion
graphics 2D (HTML + GSAP), formato apresentação 1920×1080, com o Viko do início ao fim.

## Arquivos
- `frame.md`: sistema visual (cores, tipografia, logo, fio condutor, movimento).
- `roteiro-narracao.md`: texto da voz (ElevenLabs) + storyboard cena a cena.

## Versões
| Versão | Data | O que é |
|---|---|---|
| plano | 2026-10-30 | frame + roteiro + storyboard. Aprovado. |
| v1 | 2026-10-30 | `bunviko-lancamento_v1_2026-10-30.html`: primeira animação (26 s, 7 cenas). |
| **v2** | 2026-10-30 | `bunviko-lancamento.html`: mais profissional. Cenas nascem uma da outra (chicote com borrão até o salão, aparelho cai na mesa e a câmera mergulha nele, tela liga, mergulho no botão, ponto de luz no sinal, celular girando em 3D, alerta vira o cartão do rastreio, Viko salta para a marca, marrom nasce do logo); salão com profundidade, luminárias, balões e garçom passando; ondas de choque nos toques; Viko respira, pisca, pula e se espreme; ✓ que se desenha; letras do logo caem como gelatina. **Sem voz e sem som**; tempos estimados; `@bunviko` provisório. **Aguardando revisão.** |

## Como abrir
`npm run serve` na raiz e abrir `http://localhost:5173/bunviko-lancamento/bunviko-lancamento.html`.
Quadros: `node _base/frames.mjs bunviko-lancamento/bunviko-lancamento.html bunviko-lancamento/_frames 0 2 4 …` e `python _base/sheet.py bunviko-lancamento/_frames 4`.

## Próximos passos
1. Aprovar roteiro e storyboard; informar o @ do Instagram.
2. Animar o HTML (tempos estimados) e revisar por quadros.
3. Voz (ElevenLabs) → medir tempos → sincronizar. Trilha e efeitos.
4. MP4 só depois de "esse é o vídeo".

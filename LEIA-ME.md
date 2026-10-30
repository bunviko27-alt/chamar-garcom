# Chamar garçom (versão online)

Mesa (Raspberry Pi + tela touch) → Garçom (celular) → Cozinha (tablet/celular),
tudo pela web, com notificação push no celular mesmo bloqueado.

- **Supabase**: banco, tempo real e a função `avisar` (notificações push).
- **Vercel**: hospeda o site (pasta `web`).

## Estrutura
Cada tela tem a sua pasta, para trabalhar o design de uma sem mexer nas outras:

| Pasta | Tela | Onde roda |
|---|---|---|
| `web/mesa/` | botão de chamar + andamento do pedido | Raspberry Pi da mesa |
| `web/garcom/` | chamados e pedidos prontos | celular do garçom |
| `web/cozinha/` | pedidos novos e em preparo | notebook/TV da cozinha |

Em cada pasta: `index.html` (estrutura), `estilo.css` (visual) e `app.js` (comportamento).

- `web/comum/`: cores e componentes comuns (`base.css`) e conexão com o banco (`comum.js`).
- `web/vendor/supabase.js`: biblioteca do Supabase (cópia local, não editar).
- `supabase/migrations/001_inicial.sql`: tabelas, segurança e funções do banco.
- `supabase/functions/avisar/`: envia as notificações push.
- `instalar-mesa.sh`: instala a tela da mesa no Raspberry Pi.

## Segurança
O site é público, mas nenhuma tabela é acessível direto. Cada aparelho digita
uma vez o **código da equipe** (6 dígitos) e recebe um token próprio, guardado nele.
Tentativas erradas em excesso bloqueiam novas tentativas por alguns minutos.

## Acesso pela equipe
- Garçom: abrir `https://SITE/garcom`, digitar o código e tocar em
  "Ativar som e notificações".
  - **iPhone**: antes, toque em Compartilhar → *Adicionar à Tela de Início* e abra
    pelo ícone (exigência da Apple para notificações; iOS 16.4 ou mais novo).
  - **Android**: funciona direto no Chrome; "Adicionar à tela inicial" é opcional.
- Cozinha: o mesmo, em `https://SITE/cozinha`.

## Endereços
- Site: https://chamar-garcom-topaz.vercel.app
- Cozinha (notebook/TV): https://chamar-garcom-topaz.vercel.app/cozinha
- Garçom (celular): https://chamar-garcom-topaz.vercel.app/garcom
- Demonstração das 3 telas: https://chamar-garcom-topaz.vercel.app/demo

## Raspberry Pi da mesa (instalado no próprio Pi)
Use o **Raspberry Pi OS Lite (32 bits)**, sem área de trabalho: o Pi 3B tem só 1 GB de RAM.
Copie esta pasta para o Pi e rode, de dentro dela:
```
bash instalar-mesa.sh 5 CODIGO_DA_EQUIPE          # 5 = número da mesa
sudo reboot
```
A tela da mesa fica instalada no Pi (`~/bunviko-mesa`, servida em `localhost:8080`) e abre
sozinha em tela cheia. Ela fala direto com o banco online, então o Pi precisa de internet.

### Desempenho (1 GB de RAM)
- Sem desktop: a tela roda num kiosk mínimo (cage + Chromium), ~150-250 MB a menos de RAM.
- Chromium enxuto: sem extensões, tradução, sincronização, cache pequeno, até 2 processos.
- Página leve: ~4 MB de memória JS, 4 arquivos locais (supabase-js incluso, sem CDN).
- Animações só com transform/opacity; tela inicial parada não gasta processador.
- Se ainda pesar: `bash instalar-mesa.sh 5 CODIGO leve` desliga as animações contínuas.
- Swap de 512 MB, Bluetooth/modem/impressora desligados, reinício automático às 4h.
- Se o navegador fechar ou travar, ele reabre sozinho em 3 segundos.

## Publicar uma versão nova
O código fica em github.com/bunviko27-alt/chamar-garcom (privado). O site está na Vercel
(conta bunviko). O banco é o projeto Supabase do Bunviko.

## Visual
Identidade Bunviko: amarelo `#FFCF35`, laranja `#EF7130`, vermelho `#CE3B25`, marrom `#32231C`,
fonte Nunito (em `web/comum/fontes`, licença OFL) e o mascote **Viko** (`web/comum/viko.js`,
em SVG, com expressões para cada situação). Veja todas as expressões em `/comum/galeria-viko.html`.
Botões e cartões usam sombra sólida (sem desfoque): fica bonito e leve no Raspberry Pi.

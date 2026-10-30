# AGENTS.md · Bunviko (para o Codex e qualquer agente que continuar o projeto)

Responda e escreva **em português do Brasil**. Leia este arquivo inteiro antes de mexer em algo.
O `LEIA-ME.md` tem os detalhes de uso; este arquivo diz **o estado do projeto e o que falta**.

## O que é
**Bunviko** é um sistema de atendimento para restaurante. Slogan: "Um toque. Seu sabor."
1. **Mesa**: um aparelho na mesa (Raspberry Pi 3B + tela touch 5" 800×480 + **botão laranja físico em cima**).
   O cliente aperta o botão (ou toca na tela) para chamar o garçom e acompanha o pedido como um rastreio:
   Anotado → Na cozinha → A caminho → Entregue (com horário de cada etapa).
2. **Garçom**: celular (navegador/PWA). Recebe o chamado (som, vibração, alerta grande e notificação push),
   anota o pedido e marca "entregue".
3. **Cozinha**: notebook/TV. Pedidos novos → "Começar preparo" → "Pronto".
4. **Dono**: área com login (e-mail/senha ou Google). Cria o restaurante, vê o código da equipe e
   cadastra os aparelhos das mesas **por QR Code** (o aparelho novo mostra um QR; o dono escaneia e escolhe o número da mesa).

Mascote: **Viko** (pãozinho creme com olhos `< >`, em SVG: `web/comum/viko.js`).
Cores: amarelo `#FFCF35`, laranja `#EF7130`, vermelho `#CE3B25`, marrom `#32231C`. Fonte: Nunito (local).

## Onde está cada coisa
| Caminho | O quê |
|---|---|
| `web/mesa/` | tela da mesa (roda no Raspberry). `index.html` estrutura, `estilo.css` visual, `app.js` lógica |
| `web/garcom/`, `web/cozinha/` | telas do garçom e da cozinha (mesmo padrão de 3 arquivos) |
| `web/dono/`, `web/parear/` | área do dono e página aberta pelo QR Code (`conta.js` = login Supabase Auth) |
| `web/comum/` | `base.css` (design system), `comum.js` (conexão, tempo real, ações, push, pareamento por QR), `viko.js`, fontes |
| `web/vendor/` | `supabase.js` (UMD) e `qrcode.js`, **locais de propósito** (o Pi não depende de CDN). Não editar |
| `web/config.js` | URL do Supabase, chave **pública** anon e `SITE_URL`. Não é segredo |
| `web/sw.js`, `manifest-*.json` | service worker das notificações (vibração por tipo) e PWA |
| `supabase/migrations/` | `001` tabelas/RPCs, `002` horários das etapas, `003` donos + pareamento. **Já aplicadas** no projeto |
| `supabase/functions/avisar/` | Edge Function que envia as notificações push (gera as chaves VAPID sozinha). **Já publicada** |
| `instalar-mesa.sh` | instala a mesa num Raspberry Pi (kiosk leve, servidor local, botão GPIO) |
| `mesa-botao.py` | servidor local do Pi: serve `web/` em `localhost:8080` e avisa a tela quando o botão GPIO 17 é apertado (SSE em `/botao`) |
| `hardware/carcaca-3d/` | carcaça para impressão 3D (STL) gerada por código (`gerar_modelo.py`, Python + manifold3d) |
| `marketing/video-lancamento/` | vídeo de lançamento 16:9 em HTML + GSAP (v2, sem voz ainda) |

## Contas e serviços (todos do Bunviko, separados da Conkio)
- **GitHub**: `bunviko27-alt/chamar-garcom` (privado). Para outra pessoa trabalhar, o dono adiciona como colaborador.
- **Supabase**: organização "Bunviko", projeto ref `wrwjevaqhhulbkvxsqtq`. Site URL e Redirect URL já apontam para o site.
- **Vercel**: time "bunviko", projeto `chamar-garcom`. Site: **https://chamar-garcom-topaz.vercel.app**
  Hoje o deploy é manual pela CLI (`vercel deploy --prod` na raiz, logado na conta do Bunviko).
  Recomendado: no painel da Vercel, conectar o repositório do GitHub para publicar a cada push.
- **Google Cloud**: projeto "Bunviko" (`sage-nucleus-513219-c2`), cliente OAuth "Bunviko site"
  (Client ID `434868078050-otb7pkvj1c764jnle13g9cfu53ica99e.apps.googleusercontent.com`).
- **Nunca** coloque segredos no repositório (Client Secret do Google, service role do Supabase, senhas).
  O código da equipe do restaurante de teste não está aqui de propósito: peça ao dono.

## Como rodar e conferir
- Local: `python -m http.server 8200 -d web` e abrir `http://localhost:8200/` (fala com o Supabase de verdade).
  Mesa em modo Raspberry: `python mesa-botao.py --pasta web --porta 8300` e abrir `http://localhost:8300/mesa/`
  (sem cadastro aparece o QR). Simular o botão físico: `curl -X POST http://localhost:8300/botao` ou tecla Enter.
- Banco: mudanças de schema = nova migração `supabase/migrations/00N_*.sql`, aplicada no SQL Editor do Supabase
  (não há CLI configurada). Todas as tabelas têm RLS sem políticas: o acesso é só pelas funções RPC `security definer`.
- Depois de mudar `web/`: publicar na Vercel e conferir as rotas (`/`, `/mesa/1`, `/garcom`, `/cozinha`, `/dono`, `/parear?c=ABC123`).

## Raspberry Pi da mesa (passo a passo)
1. Gravar **Raspberry Pi OS Lite 32 bits** (Raspberry Pi Imager), com Wi-Fi e SSH configurados.
2. Ligar a tela de 5" (120,5 × 77 mm) e o botão: chave táctil 12×12 entre **GPIO 17 (pino 11)** e **GND (pino 9)**.
3. No Pi: `git clone` deste repositório, `cd chamar-garcom` e `bash instalar-mesa.sh` (ou `bash instalar-mesa.sh leve`).
4. `sudo reboot`. A tela mostra o QR Code; o dono escaneia (área do dono) e escolhe o número da mesa.
O instalador: Chromium enxuto em kiosk com `cage` (sem desktop, para caber em 1 GB), serviço `bunviko-mesa`
(servidor + botão), swap de 512 MB, desliga Bluetooth/modem/impressora, reinício diário às 4h.

## Estado (o que foi verificado e o que não foi)
Verificado: fluxo mesa → garçom → cozinha → entregue no banco online; permissões (chave pública não lê tabelas;
sem login não se cadastra aparelho); geração do QR e consulta do pareamento; botão físico simulado (POST /botao)
chamando o garçom pela tela local; alerta grande do garçom; rotas publicadas na Vercel.

**Não verificado ainda:**
- Raspberry Pi real (instalação, desempenho, botão GPIO de verdade, tela touch).
- Notificação push num celular real (Android e iPhone com o app na Tela de Início).
- Fluxo completo do dono com conta real (criar conta → confirmar e-mail → criar restaurante → cadastrar mesa pelo QR).
- Login com Google (falta configurar, ver abaixo).

## O que falta fazer (em ordem)
1. **Login com Google**: no Supabase → Authentication → Sign In / Providers → Google: ligar, conferir o Client ID
   acima e o **dono cola o Client Secret** (o agente não deve manusear segredos) → Save. Depois, no Google Cloud
   → Google Auth Platform → Público → **Publicar app** (sai do modo de teste). Testar o botão "Entrar com Google" em `/dono`.
2. **Teste do dono** com conta real e cadastro de uma mesa pelo QR (pode usar `/mesa/` no notebook como se fosse o Pi).
3. **Instalar num Raspberry real** e anotar ajustes de desempenho/tela/botão.
4. **Teste de push** em Android e iPhone.
5. **@ oficial do Instagram**: trocar a constante `INSTAGRAM` em `marketing/video-lancamento/bunviko-lancamento.html`.
6. **Vídeo de lançamento**: gerar a narração no ElevenLabs com o texto de `marketing/video-lancamento/roteiro-narracao.md`,
   sincronizar a animação com a voz, colocar trilha e efeitos, e só então gerar o MP4 (depois da aprovação do dono).
7. **E-mail de produção**: o Supabase gratuito manda poucos e-mails por hora; configurar SMTP próprio antes de lançar.
8. Conectar o GitHub na Vercel para deploy automático.

## Regras de trabalho com o dono
- Ele pede ajustes pontuais e visuais: mude só o trecho pedido e mostre o resultado (capturas de tela) antes de dizer "pronto".
- Peça autorização antes de: gastar créditos (voz), publicar, mudar configurações de contas, apagar dados.
- Nunca digite senhas nem chaves secretas; o dono faz os logins.
- Commits em português, explicando o porquê.

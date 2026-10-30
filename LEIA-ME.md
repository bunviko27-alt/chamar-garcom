# Chamar garçom (versão online)

Mesa (Raspberry Pi + tela touch) → Garçom (celular) → Cozinha (tablet/celular),
tudo pela web, com notificação push no celular mesmo bloqueado.

- **Supabase**: banco, tempo real e a função `avisar` (notificações push).
- **Vercel**: hospeda o site (pasta `web`).

## Estrutura
- `supabase/migrations/001_inicial.sql`: tabelas, segurança e funções RPC.
- `supabase/functions/avisar/`: envia as notificações push.
- `web/`: telas `mesa`, `garcom`, `cozinha`, `demo`, mais o service worker e os ícones.
- `web/config.js`: endereço do Supabase e chaves públicas (preenchido na publicação).
- `instalar-mesa.sh`: configura um Raspberry Pi como tela de mesa.

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

## Raspberry Pi da mesa
```
bash instalar-mesa.sh 5 https://SITE 123456
sudo reboot
```

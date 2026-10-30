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

## Endereços
- Site: https://chamar-garcom-topaz.vercel.app
- Cozinha (notebook/TV): https://chamar-garcom-topaz.vercel.app/cozinha
- Garçom (celular): https://chamar-garcom-topaz.vercel.app/garcom
- Demonstração das 3 telas: https://chamar-garcom-topaz.vercel.app/demo

## Raspberry Pi da mesa (instalado no próprio Pi)
Copie esta pasta para o Pi e rode, de dentro dela:
```
bash instalar-mesa.sh 5 CODIGO_DA_EQUIPE
sudo reboot
```
A tela da mesa fica instalada no Pi (`~/bunviko-mesa`, servida em `localhost:8080`) e abre
sozinha em tela cheia. Ela fala direto com o banco online, então o Pi precisa de internet.

## Publicar uma versão nova
O código fica em github.com/bunviko27-alt/chamar-garcom (privado). O site está na Vercel
(conta bunviko). O banco é o projeto Supabase do Bunviko.

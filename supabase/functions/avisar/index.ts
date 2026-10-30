// Edge Function "avisar": manda notificação push para os celulares da equipe.
//
// Chamada pelo site logo depois de uma ação:
//   chamado -> garçons ("Mesa 5 chamando")
//   novo    -> cozinha ("Novo pedido: mesa 5")
//   pronto  -> garçons ("Pronto: mesa 5")
// Exige o token do aparelho; as chaves VAPID ficam na tabela privado.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

// Projetos novos podem ter só as chaves novas (secret); os antigos, a service role.
function chaveServidor(): string {
  const lista = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (lista) {
    try {
      const v = Object.values(JSON.parse(lista))[0];
      if (typeof v === "string") return v;
    } catch (_) { /* segue para as outras */ }
  }
  return Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const sb = createClient(Deno.env.get("SUPABASE_URL")!, chaveServidor());

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const MENSAGENS: Record<string, (mesa: string, desc: string) => {
  alvo: string; titulo: string; corpo: string; url: string;
}> = {
  chamado: (m) => ({ alvo: "garcom", titulo: `Mesa ${m} chamando`, corpo: "Toque para abrir", url: "/garcom" }),
  pronto: (m, d) => ({ alvo: "garcom", titulo: `Pronto: mesa ${m}`, corpo: d || "Levar para a mesa", url: "/garcom" }),
  novo: (m, d) => ({ alvo: "cozinha", titulo: `Novo pedido: mesa ${m}`, corpo: d || "Sem descrição", url: "/cozinha" }),
};

// Chaves VAPID: criadas na primeira chamada e guardadas na tabela privado,
// assim nenhuma chave secreta precisa ser copiada à mão.
let vapid: Record<string, string> | null = null;

async function chaves(origem: string) {
  if (vapid) return vapid;
  const { data } = await sb.from("privado").select("chave, valor");
  let c = Object.fromEntries((data ?? []).map((r) => [r.chave, r.valor]));
  if (!c.vapid_publica || !c.vapid_privada) {
    const novas = webpush.generateVAPIDKeys();
    const linhas = [
      { chave: "vapid_publica", valor: novas.publicKey },
      { chave: "vapid_privada", valor: novas.privateKey },
      { chave: "vapid_contato", valor: /^https:\/\//.test(origem) ? origem : "https://supabase.com" },
    ];
    // ignoreDuplicates: se duas chamadas gerarem ao mesmo tempo, vale a primeira.
    await sb.from("privado").upsert(linhas, { onConflict: "chave", ignoreDuplicates: true });
    const { data: de_novo } = await sb.from("privado").select("chave, valor");
    c = Object.fromEntries((de_novo ?? []).map((r) => [r.chave, r.valor]));
  }
  webpush.setVapidDetails(c.vapid_contato, c.vapid_publica, c.vapid_privada);
  vapid = c;
  return c;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const origem = req.headers.get("origin") ?? "";

  // GET: devolve a chave pública para o navegador assinar as notificações.
  if (req.method === "GET") {
    const c = await chaves(origem);
    return resposta({ vapid_publica: c.vapid_publica });
  }

  const { token, tipo, mesa, desc } = await req.json().catch(() => ({}));
  const montar = MENSAGENS[tipo];
  if (typeof token !== "string" || !montar) return resposta({ ok: false }, 400);

  const { data: disp } = await sb.from("dispositivos")
    .select("restaurante_id").eq("token", token).maybeSingle();
  if (!disp) return resposta({ ok: false }, 401);

  await chaves(origem);

  const msg = montar(String(mesa ?? "").slice(0, 10), String(desc ?? "").slice(0, 120));
  const { data: inscricoes } = await sb.from("push_inscricoes")
    .select("endpoint, dados, dispositivos!inner(restaurante_id, papel)")
    .eq("dispositivos.restaurante_id", disp.restaurante_id)
    .eq("dispositivos.papel", msg.alvo);

  const carga = JSON.stringify({ titulo: msg.titulo, corpo: msg.corpo, url: msg.url, tag: `${tipo}-${mesa}` });
  let enviados = 0;
  await Promise.all((inscricoes ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(s.dados, carga, { TTL: 300, urgency: "high" });
      enviados++;
    } catch (e) {
      // Inscrição expirada ou removida pelo usuário: apaga.
      const codigo = (e as { statusCode?: number }).statusCode;
      if (codigo === 404 || codigo === 410) {
        await sb.from("push_inscricoes").delete().eq("endpoint", s.endpoint);
      }
    }
  }));
  return resposta({ ok: true, enviados });
});

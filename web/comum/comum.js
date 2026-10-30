// Código compartilhado pelas telas: login por código, tempo real (Supabase),
// ações, alertas sonoros e notificações push.

import { SUPABASE_URL, SUPABASE_CHAVE } from "/config.js";
import { viko } from "/comum/viko.js";

// supabase-js vem de /vendor/supabase.js (arquivo único, carregado antes deste módulo):
// sem depender de CDN e com um download só, o que pesa menos no Raspberry Pi.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let token = null;
let ultimo = null;
let aoReceber = () => {};
let canal = null;
let difRelogio = 0; // relógio do servidor - relógio deste aparelho (segundos)

// ---------------------------------------------------------------- início

export async function iniciar(opcoes) {
  aoReceber = opcoes.aoReceber;
  const chave = `cg-token-${opcoes.papel}${opcoes.mesa ? "-" + opcoes.mesa : ""}`;
  token = ler(chave);
  const codigo = new URLSearchParams(location.search).get("codigo");
  if (!token && codigo) token = await entrar(codigo, opcoes, chave).catch(() => null);
  if (!token) token = await pedirCodigo(opcoes, chave);
  await atualizar();
  setInterval(atualizar, 30000); // garantia, caso algum aviso em tempo real se perca
  document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizar(); });
}

async function entrar(codigo, { papel, mesa }, chave) {
  const { data, error } = await sb.rpc("entrar", { p_codigo: codigo, p_papel: papel, p_mesa: mesa || null });
  if (error) throw new Error("rede");
  if (data.erro) throw new Error(data.erro);
  gravar(chave, data.token);
  return data.token;
}

async function atualizar() {
  const { data, error } = await sb.rpc("estado", { p_token: token });
  if (error) {
    if (/token_invalido/.test(error.message)) { limparTokens(); location.reload(); }
    document.body.classList.add("offline");
    return;
  }
  document.body.classList.remove("offline");
  difRelogio = data.agora - Date.now() / 1000;
  if (!canal || canal.topic !== `realtime:${data.canal}`) ouvir(data.canal);
  ultimo = data;
  aoReceber(data);
}

let espera;
function ouvir(nome) {
  if (canal) sb.removeChannel(canal);
  canal = sb.channel(nome)
    .on("broadcast", { event: "mudou" }, () => {
      clearTimeout(espera);
      espera = setTimeout(atualizar, 120);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") atualizar();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") document.body.classList.add("offline");
    });
}

// ---------------------------------------------------------------- ações

export async function acaoMesa(mesa, acao, dados = {}) {
  const { data, error } = await sb.rpc("acao_mesa", {
    p_token: token, p_mesa: String(mesa), p_acao: acao, p_desc: dados.desc || "",
  });
  if (error) return false;
  if (acao === "chamar") avisar("chamado", mesa);
  if (acao === "pedido") avisar("novo", mesa, dados.desc);
  atualizar();
  return data.ok;
}

export async function acaoPedido(id, acao) {
  const { data, error } = await sb.rpc("acao_pedido", { p_token: token, p_id: id, p_acao: acao });
  if (error) return false;
  const p = ultimo?.pedidos.find((x) => x.id === id);
  if (acao === "pronto" && p) avisar("pronto", p.mesa, p.desc);
  atualizar();
  return data.ok;
}

function avisar(tipo, mesa, desc = "") {
  sb.functions.invoke("avisar", { body: { token, tipo, mesa: String(mesa), desc } }).catch(() => {});
}

// ---------------------------------------------------------------- utilidades

export function agoraServidor() {
  return Date.now() / 1000 + difRelogio;
}

export function ha(ts) {
  const s = Math.max(0, Math.floor(agoraServidor() - ts));
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  return m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`;
}

export function esc(t) {
  const d = document.createElement("div");
  d.textContent = t ?? "";
  return d.innerHTML;
}

function ler(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function gravar(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
function limparTokens() {
  try { Object.keys(localStorage).filter((k) => k.startsWith("cg-token-")).forEach((k) => localStorage.removeItem(k)); } catch (_) {}
}

// ---------------------------------------------------------------- alertas

let audio;
function liberarSom() {
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
}

export function bipe(vezes = 2) {
  if (!audio) return;
  for (let i = 0; i < vezes; i++) {
    const t = audio.currentTime + i * 0.25;
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.frequency.value = 880;
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(vol).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}

// Liga som e notificações push. Retorna uma frase para mostrar ao usuário.
export async function ativarAlertas() {
  liberarSom();
  bipe(1);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalado = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return ios && !instalado
      ? "Som ligado. Para receber alertas com o iPhone bloqueado: toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone."
      : "Som ligado. Este navegador não aceita notificações.";
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    if ((await Notification.requestPermission()) !== "granted") {
      return "Som ligado. Notificações bloqueadas: libere nas configurações do navegador.";
    }
    let insc = await reg.pushManager.getSubscription();
    if (!insc) {
      // A chave pública das notificações vem da função "avisar" (que a cria na 1ª vez).
      const { data, error: erroChave } = await sb.functions.invoke("avisar", { method: "GET" });
      if (erroChave || !data?.vapid_publica) throw erroChave || new Error("sem chave");
      insc = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64url(data.vapid_publica) });
    }
    const { error } = await sb.rpc("salvar_push", { p_token: token, p_inscricao: insc.toJSON() });
    if (error) throw error;
    gravar("cg-push", "1");
    return null;
  } catch (_) {
    return "Som ligado, mas não deu para ativar as notificações. Tente de novo.";
  }
}

export function alertasAtivos() {
  return ler("cg-push") === "1" && "Notification" in window && Notification.permission === "granted";
}

function base64url(s) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

// ---------------------------------------------------------------- tela de código

const NOMES = { mesa: "esta mesa", garcom: "o garçom", cozinha: "a cozinha" };

function pedirCodigo(opcoes, chave) {
  return new Promise((resolver) => {
    const tela = document.createElement("div");
    tela.className = "login";
    tela.innerHTML = `
      <div class="login-caixa">
        ${viko({ humor: "atento" })}
        <h2>Código da equipe</h2>
        <p>Digite o código do restaurante para ativar ${NOMES[opcoes.papel]}${opcoes.mesa ? ` (mesa ${esc(opcoes.mesa)})` : ""}.</p>
        <div class="login-pontos">${"<i></i>".repeat(6)}</div>
        <p class="login-erro"></p>
        <div class="login-teclado">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join("")}
          <span></span><button data-n="0">0</button><button data-n="x" aria-label="Apagar">⌫</button>
        </div>
      </div>`;
    document.body.appendChild(tela);
    const pontos = tela.querySelectorAll(".login-pontos i");
    const erro = tela.querySelector(".login-erro");
    let digitado = "";

    const mostrar = () => pontos.forEach((p, i) => p.classList.toggle("cheio", i < digitado.length));
    async function digitar(n) {
      if (n === "x") digitado = digitado.slice(0, -1);
      else if (digitado.length < 6) digitado += n;
      erro.textContent = "";
      mostrar();
      if (digitado.length < 6) return;
      try {
        const t = await entrar(digitado, opcoes, chave);
        tela.remove();
        resolver(t);
      } catch (e) {
        erro.textContent = e.message === "codigo_invalido" ? "Código errado, tente de novo"
          : e.message === "muitas_tentativas" ? "Muitas tentativas. Espere alguns minutos."
          : "Sem conexão. Tente de novo.";
        tela.querySelector(".login-caixa").animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(10px)" }, { transform: "translateX(0)" }],
          { duration: 300 });
        digitado = "";
        mostrar();
      }
    }
    tela.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) digitar(b.dataset.n); });
    document.addEventListener("keydown", function tecla(e) {
      if (!tela.isConnected) return document.removeEventListener("keydown", tecla);
      if (/^\d$/.test(e.key)) digitar(e.key);
      if (e.key === "Backspace") digitar("x");
    });
  });
}

// Lógica da tela: mesa. A conexão com o banco e os alertas ficam em /comum/comum.js.
//
// Chamar o garçom: o botão laranja FÍSICO em cima do aparelho (ligado ao GPIO do
// Raspberry, ver /mesa-botao.py). A tela aponta para ele. Também funcionam: tocar
// no Viko, "ou toque aqui" e as teclas Enter/Espaço (útil para testar no PC).

import { iniciar, acaoMesa, agoraServidor } from "/comum/comum.js";
import { viko, piscar } from "/comum/viko.js";

const PARAMS = new URLSearchParams(location.search);
// /mesa/5 (site) ou /mesa/?n=5 (instalado no Raspberry)
// Sem número na URL (Raspberry): o aparelho é cadastrado por QR Code e o número
// vem do cadastro feito pelo dono.
let MESA = (location.pathname.match(/^\/mesa\/(\w+)$/) || [])[1] || PARAMS.get("n") || null;
const URL_TEM_MESA = !!MESA;
if (PARAMS.get("leve") === "1") document.documentElement.classList.add("leve");
const MOSTRAR_ENTREGUE = 30; // segundos que "Bom apetite!" fica na tela

// O que o Viko diz e como ele fica em cada etapa do pedido.
const FRASES = {
  enviado: { humor: "atento", extra: "bloco", etapa: 0,
    titulos: ["Pedido anotado!"],
    subs: ["Já mandei para a cozinha.", "Anotadinho, pode deixar comigo.", "Agora é com o chef!"] },
  preparando: { humor: "concentrado", extra: "chapeu", etapa: 1,
    titulos: ["O chef está caprichando", "Panelas no fogo!", "Preparando com carinho"],
    subs: ["Um cheirinho bom já está no ar…", "Temperando cada detalhe.", "Feito na hora, só pra você.", "Falta pouco, segura a fome!"] },
  pronto: { humor: "alegre", extra: "prato", etapa: 2,
    titulos: ["Saiu da cozinha!"],
    subs: ["Seu pedido está a caminho da mesa.", "Prepare o garfo!", "Chegando quentinho."] },
  entregue: { humor: "apaixonado", extra: "brilhos", etapa: 4,
    titulos: ["Bom apetite!"],
    subs: ["Precisando, é só apertar o botão aqui em cima.", "Aproveite cada mordida!"] },
};
// Horário de cada etapa, na ordem do rastreio.
const HORARIOS = ["criado", "preparando", "pronto", "entregue"];

const DICAS = {
  inicio: "Aperte o botão aqui em cima",
  chamando: "Garçom a caminho!",
  pedido: "Precisa de algo? Aperte aqui em cima",
};

const $ = (id) => document.getElementById(id);
function mostrarNumero() {
  $("nome-mesa").textContent = MESA ? `Mesa ${MESA}` : "";
  document.title = MESA ? `Mesa ${MESA}` : "Bunviko";
}
mostrarNumero();

let ultimo = null, giro = 0, statusAtual = null, vikoAtual = "";
let reacao = null;   // expressão momentânea (ao ser tocado ou ao acenar)

const hora = (ts) => ts ? new Date(ts * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

function mostrarViko(humor, extra) {
  if (reacao) humor = reacao;
  const chave = humor + extra;
  if (chave === vikoAtual) return;          // só redesenha quando muda
  vikoAtual = chave;
  $("viko").innerHTML = viko({ humor, extra });
}

function pedidoDaMesa(estado) {
  const meus = estado.pedidos.filter((p) => p.mesa === MESA);
  const ativos = meus.filter((p) => p.status !== "entregue");
  if (ativos.length) return ativos[ativos.length - 1];
  const ent = meus.filter((p) => agoraServidor() - p.atualizado < MOSTRAR_ENTREGUE);
  return ent[ent.length - 1] || null;
}

function desenhar() {
  if (!ultimo) return;
  const chamando = MESA in ultimo.chamados;
  const pedido = pedidoDaMesa(ultimo);

  if (pedido && !chamando) {
    document.body.dataset.tela = "pedido";
    const f = FRASES[pedido.status];
    if (pedido.status !== statusAtual) { statusAtual = pedido.status; giro = 0; }
    mostrarViko(f.humor, f.extra);
    $("p-titulo").textContent = f.titulos[giro % f.titulos.length];
    $("p-sub").textContent = f.subs[giro % f.subs.length];
    $("p-feito").textContent = `feito às ${hora(pedido.criado)}`;
    [...$("p-etapas").children].forEach((el, i) => {
      el.className = i < f.etapa || (i === 3 && f.etapa === 4) ? "feita" : i === f.etapa ? "atual" : "";
      el.querySelector("small").textContent = hora(pedido[HORARIOS[i]]);
    });
  } else {
    statusAtual = null;
    document.body.dataset.tela = chamando ? "chamando" : "inicio";
    mostrarViko(chamando ? "animado" : "feliz", chamando ? "sino" : null);
  }
  $("dica-texto").textContent = DICAS[document.body.dataset.tela];
}

// Troca as frases a cada 6 s e reavalia o "Bom apetite!" que expira.
setInterval(() => {
  giro++;
  $("p-sub").style.opacity = 0;
  setTimeout(() => { desenhar(); $("p-sub").style.opacity = 1; }, 350);
}, 6000);

// ---------------------------------------------------------------- Viko vivo
// As animações só rodam no momento da reação; parado, ele não gasta processador.

const OCIOSO_PRIMEIRO = 15000;   // sem ninguém tocar: primeiro aceno
const OCIOSO_REPETE = 25000;     // e depois a cada tanto
const CHAMADAS = ["Precisa de algo? Aperta o botão aqui em cima!", "Psiu! O botão laranja me chama!", "Tô aqui se precisar!", "Bateu a fome? Aperta aqui em cima!"];
const RESPOSTAS = {
  chamando: ["Ele já está vindo!", "Calma, já avisei!", "Já já ele chega!"],
  pedido: ["Já já fica pronto!", "Tô de olho no seu pedido!", "Hmm, que cheirinho!"],
};
let tOcioso, tReacao, tBalao, nFala = 0;

function reagir(humor, ms) {
  clearTimeout(tReacao);
  reacao = humor;
  desenhar();
  tReacao = setTimeout(() => { reacao = null; desenhar(); }, ms);
}

function falar(texto, ms = 2800) {
  clearTimeout(tBalao);
  $("balao").textContent = texto;
  $("balao").classList.add("mostrar");
  tBalao = setTimeout(() => $("balao").classList.remove("mostrar"), ms);
}

function reiniciarClasse(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth;                       // reinicia a animação
  el.classList.add(classe);
}

function acenar() {
  if (document.body.dataset.tela === "inicio" && !document.documentElement.classList.contains("leve")) {
    reiniciarClasse($("corpo"), "ola");
    reagir("animado", 2400);
    falar(CHAMADAS[nFala++ % CHAMADAS.length]);
    setTimeout(() => $("corpo").classList.remove("ola"), 2400);
  }
  tOcioso = setTimeout(acenar, OCIOSO_REPETE);
}

function cutucado() {
  clearTimeout(tOcioso);
  tOcioso = setTimeout(acenar, OCIOSO_PRIMEIRO);
}

const chamar = () => { if (!(MESA in (ultimo?.chamados || {}))) acaoMesa(MESA, "chamar"); };

// Botão de chamar (físico, teclado ou toque): Viko reage e o garçom é chamado.
function apertouBotao() {
  cutucado();
  reiniciarClasse($("dica-botao"), "apertou");
  reiniciarClasse($("corpo"), "apertado");
  if (MESA in (ultimo?.chamados || {})) falar("Já avisei, ele está vindo!", 2000);
  chamar();
}

function tocarViko() {
  const tela = document.body.dataset.tela;
  if (tela === "inicio") return apertouBotao();
  reiniciarClasse($("corpo"), "apertado");
  reagir("alegre", 1100);
  const frases = RESPOSTAS[tela];
  if (frases) falar(frases[nFala++ % frases.length], 2000);
}

$("chamar").onclick = apertouBotao;
$("dica-botao").onclick = apertouBotao;
$("palco").onclick = tocarViko;
$("cancelar").onclick = () => acaoMesa(MESA, "cancelar");
$("corpo").addEventListener("animationend", (e) => { if (e.animationName === "aperta") $("corpo").classList.remove("apertado"); });
document.addEventListener("pointerdown", cutucado);
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && !e.repeat && !document.querySelector(".login")) {
    e.preventDefault();
    apertouBotao();
  }
});

// No Raspberry, o servidor local avisa quando o botão físico (GPIO) é apertado.
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  try {
    new EventSource("/botao").addEventListener("apertou", apertouBotao);
  } catch (_) { /* sem servidor do botão: segue só com toque/teclado */ }
}

mostrarViko("feliz", null);
piscar();
cutucado();
iniciar({
  papel: "mesa", mesa: URL_TEM_MESA ? MESA : null,
  aoReceber: (estado) => {
    if (estado.mesa && estado.mesa !== MESA) { MESA = estado.mesa; mostrarNumero(); }
    ultimo = estado;
    desenhar();
  },
});

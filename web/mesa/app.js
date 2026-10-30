// Lógica da tela: mesa. A conexão com o banco e os alertas ficam em /comum/comum.js.

import { iniciar, acaoMesa, agoraServidor } from "/comum/comum.js";
import { viko, piscar } from "/comum/viko.js";

const PARAMS = new URLSearchParams(location.search);
// /mesa/5 (site) ou /mesa/?n=5 (instalado no Raspberry)
const MESA = (location.pathname.match(/^\/mesa\/(\w+)$/) || [])[1] || PARAMS.get("n") || "1";
if (PARAMS.get("leve") === "1") document.documentElement.classList.add("leve");
const MOSTRAR_ENTREGUE = 20; // segundos que "Bom apetite!" fica na tela

// O que o Viko diz e como ele fica em cada etapa do pedido.
const FRASES = {
  enviado: { humor: "atento", extra: "bloco", etapa: 0, progresso: 22,
    titulos: ["Pedido anotado!"],
    subs: ["Já mandei para a cozinha.", "Anotadinho, pode deixar comigo.", "Agora é com o chef!"] },
  preparando: { humor: "concentrado", extra: "chapeu", etapa: 1, progresso: 58,
    titulos: ["O chef está caprichando", "Panelas no fogo!", "Preparando com carinho"],
    subs: ["Um cheirinho bom já está no ar…", "Temperando cada detalhe.", "Feito na hora, só pra você.", "Falta pouco, segura a fome!"] },
  pronto: { humor: "alegre", extra: "prato", etapa: 2, progresso: 88,
    titulos: ["Saindo da cozinha!"],
    subs: ["Seu pedido está a caminho.", "Prepare o garfo!", "Chegando quentinho."] },
  entregue: { humor: "apaixonado", extra: "brilhos", etapa: 3, progresso: 100,
    titulos: ["Bom apetite!"],
    subs: ["Qualquer coisa, é só me tocar.", "Aproveite cada mordida!"] },
};

const $ = (id) => document.getElementById(id);
$("nome-mesa").textContent = `Mesa ${MESA}`;
document.title = `Mesa ${MESA}`;

let ultimo = null, giro = 0, statusAtual = null, vikoAtual = "";
let reacao = null;   // expressão momentânea (ao ser tocado ou ao acenar)

function mostrarViko(humor, extra) {
  if (reacao) humor = reacao;
  const chave = humor + extra;
  if (chave === vikoAtual) return;          // só redesenha quando muda
  vikoAtual = chave;
  $("viko").innerHTML = viko({ humor, extra });
}

// ---------------------------------------------------------------- Viko vivo
// As animações só rodam no momento da reação; parado, ele não gasta processador.

const OCIOSO_PRIMEIRO = 15000;   // sem ninguém tocar: primeiro aceno
const OCIOSO_REPETE = 25000;     // e depois a cada tanto
const CHAMADAS = ["Psiu! Precisa de algo?", "Toque em mim!", "Tô aqui se precisar!", "Bateu a fome? Me chama!"];
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

function falar(texto, ms = 2600) {
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

function tocarViko() {
  const tela = document.body.dataset.tela;
  reiniciarClasse($("corpo"), "apertado");
  if (tela === "inicio") return chamar();
  reagir("alegre", 1100);
  const frases = RESPOSTAS[tela];
  if (frases) falar(frases[nFala++ % frases.length], 2000);
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

  if (pedido) {
    document.body.dataset.tela = "pedido";
    const f = FRASES[pedido.status];
    if (pedido.status !== statusAtual) { statusAtual = pedido.status; giro = 0; }
    mostrarViko(f.humor, f.extra);
    $("p-titulo").textContent = f.titulos[giro % f.titulos.length];
    $("p-sub").textContent = f.subs[giro % f.subs.length];
    $("p-barra").style.width = f.progresso + "%";
    $("p-barra").parentElement.classList.toggle("completa", f.progresso === 100);
    [...$("p-etapas").children].forEach((el, i) => {
      el.className = i < f.etapa ? "feita" : i === f.etapa ? "atual" : "";
    });
    const mini = $("chamar-mini");
    mini.classList.toggle("avisado", chamando);
    mini.querySelector("span").textContent = chamando ? "Garçom avisado" : "Chamar garçom";
  } else {
    statusAtual = null;
    document.body.dataset.tela = chamando ? "chamando" : "inicio";
    mostrarViko(chamando ? "animado" : "feliz", chamando ? "sino" : null);
  }
}

// Troca as frases a cada 6 s e reavalia o "Bom apetite!" que expira.
setInterval(() => {
  giro++;
  $("p-sub").style.opacity = 0;
  setTimeout(() => { desenhar(); $("p-sub").style.opacity = 1; }, 350);
}, 6000);

const chamar = () => { if (!(MESA in (ultimo?.chamados || {}))) acaoMesa(MESA, "chamar"); };
$("chamar").onclick = chamar;
$("chamar-mini").onclick = chamar;
$("palco").onclick = tocarViko;
$("corpo").addEventListener("animationend", (e) => { if (e.animationName === "aperta") $("corpo").classList.remove("apertado"); });
document.addEventListener("pointerdown", cutucado);
$("cancelar").onclick = () => acaoMesa(MESA, "cancelar");
document.addEventListener("contextmenu", (e) => e.preventDefault());

mostrarViko("feliz", null);
piscar();
cutucado();
iniciar({ papel: "mesa", mesa: MESA, aoReceber: (estado) => { ultimo = estado; desenhar(); } });

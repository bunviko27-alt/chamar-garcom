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

function mostrarViko(humor, extra) {
  const chave = humor + extra;
  if (chave === vikoAtual) return;          // só redesenha quando muda
  vikoAtual = chave;
  $("personagem").innerHTML = viko({ humor, extra });
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
$("personagem").onclick = () => { if (document.body.dataset.tela === "inicio") chamar(); };
$("cancelar").onclick = () => acaoMesa(MESA, "cancelar");
document.addEventListener("contextmenu", (e) => e.preventDefault());

mostrarViko("feliz", null);
piscar();
iniciar({ papel: "mesa", mesa: MESA, aoReceber: (estado) => { ultimo = estado; desenhar(); } });

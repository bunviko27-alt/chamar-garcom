// Lógica da tela: mesa. A conexão com o banco e os alertas ficam em /comum/comum.js.

import { iniciar, acaoMesa, agoraServidor } from "/comum/comum.js";

const PARAMS = new URLSearchParams(location.search);
// /mesa/5 (site) ou /mesa/?n=5 (instalado no Raspberry)
const MESA = (location.pathname.match(/^\/mesa\/(\w+)$/) || [])[1] || PARAMS.get("n") || "1";
if (PARAMS.get("leve") === "1") document.documentElement.classList.add("leve");
const MOSTRAR_ENTREGUE = 20; // segundos que "Bom apetite!" fica na tela

const FRASES = {
  enviado: { icone: "📝", etapa: 0, titulos: ["Pedido anotado!"],
    subs: ["Já está indo para a cozinha", "Anotadinho! Já já começa a mágica", "Seu pedido está a caminho do chef"] },
  preparando: { icone: "👨‍🍳", etapa: 1,
    titulos: ["O chef está caprichando", "Panelas no fogo!", "Preparando com carinho"],
    subs: ["Um cheirinho bom já está no ar…", "Temperando cada detalhe", "Feito na hora, só pra você", "Falta pouco, segura a fome!"] },
  pronto: { icone: "🍽️", etapa: 2, titulos: ["Saindo da cozinha!"],
    subs: ["Seu pedido está a caminho da mesa", "Prepare o garfo!", "Chegando quentinho"] },
  entregue: { icone: "😋", etapa: 3, titulos: ["Bom apetite!"],
    subs: ["Qualquer coisa, é só chamar", "Aproveite!"] },
};

const $ = (id) => document.getElementById(id);
$("nome-mesa").textContent = `Mesa ${MESA}`;
document.title = `Mesa ${MESA}`;

let ultimo = null, giro = 0, statusAtual = null;

function pedidoDaMesa(estado) {
  const meus = estado.pedidos.filter((p) => p.mesa === MESA);
  const ativos = meus.filter((p) => p.status !== "entregue");
  if (ativos.length) return ativos[ativos.length - 1];
  const ent = meus.filter((p) => agoraServidor() - p.atualizado < MOSTRAR_ENTREGUE);
  return ent[ent.length - 1] || null;
}

function desenhar() {
  if (!ultimo) return;
  $("restaurante").textContent = ultimo.config.restaurante;
  const chamando = MESA in ultimo.chamados;
  const pedido = pedidoDaMesa(ultimo);

  if (pedido) {
    document.body.dataset.tela = "pedido";
    const f = FRASES[pedido.status];
    if (pedido.status !== statusAtual) { statusAtual = pedido.status; giro = 0; }
    $("pedido").dataset.status = pedido.status;
    $("p-icone").textContent = f.icone;
    $("p-titulo").textContent = f.titulos[giro % f.titulos.length];
    $("p-sub").textContent = f.subs[giro % f.subs.length];
    [...$("p-etapas").children].forEach((el, i) => {
      el.className = "etapa" + (i < f.etapa ? " feita" : i === f.etapa ? " atual" : "");
    });
    const mini = $("chamar-mini");
    mini.classList.toggle("avisado", chamando);
    mini.querySelector("span").textContent = chamando ? "Garçom avisado ✓" : "Chamar garçom";
  } else {
    statusAtual = null;
    document.body.dataset.tela = chamando ? "chamando" : "inicio";
  }
}

// Troca as frases a cada 6 s e reavalia o "Bom apetite!" que expira.
setInterval(() => {
  giro++;
  $("p-sub").style.opacity = 0;
  setTimeout(() => { desenhar(); $("p-sub").style.opacity = 1; }, 400);
}, 6000);

$("chamar").onclick = () => acaoMesa(MESA, "chamar");
$("chamar-mini").onclick = () => { if (!(MESA in (ultimo?.chamados || {}))) acaoMesa(MESA, "chamar"); };
$("cancelar").onclick = () => acaoMesa(MESA, "cancelar");
document.addEventListener("contextmenu", (e) => e.preventDefault());

iniciar({ papel: "mesa", mesa: MESA, aoReceber: (estado) => { ultimo = estado; desenhar(); } });

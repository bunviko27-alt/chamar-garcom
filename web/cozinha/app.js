// Lógica da tela: cozinha. A conexão com o banco e os alertas ficam em /comum/comum.js.

import { iniciar, acaoPedido, ha, esc, bipe, agoraServidor, ativarAlertas, alertasAtivos } from "/comum/comum.js";
import { viko, piscar } from "/comum/viko.js";
window.acaoPedido = acaoPedido;

const $ = (id) => document.getElementById(id);
const ATRASO = 20 * 60; // segundos até o tempo ficar em destaque
let ultimo = null, vistos = null;

$("ola-viko").innerHTML = viko({ humor: "concentrado", extra: "chapeu" });
piscar();

if (alertasAtivos()) $("ativar").textContent = "🔔 Ligar som";
$("ativar").onclick = async () => {
  const aviso = await ativarAlertas();
  document.body.classList.add("som");
  $("aviso-alerta").textContent = aviso || "";
};

const relogio = () => {
  $("relogio").textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};
relogio();
setInterval(relogio, 15000);

function cartao(p, tipo, botao, desde) {
  const atrasado = tipo !== "saindo" && agoraServidor() - p.criado > ATRASO;
  const novo = vistos && !vistos.has(p.id + p.status);
  return `
    <div class="cartao pedido${novo ? " chega" : ""}">
      <div class="topo">
        <div class="selo-mesa"><div><small>MESA</small>${esc(p.mesa)}</div></div>
        <div><div class="titulo-cartao">${tipo === "novos" ? "Pedido novo" : tipo === "fogo" ? "Preparando" : "Pronto"}</div>
          <span class="tempo">${desde}</span></div>
        <span class="pilula ${atrasado ? "alerta" : ""} direita-cartao">⏱ ${ha(p.criado).replace("há ", "")}</span>
      </div>
      <div class="desc">${p.desc ? esc(p.desc) : "<i>Sem descrição: confirme com o garçom</i>"}</div>
      ${botao ? `<div class="acoes">${botao}</div>` : ""}
    </div>`;
}

const vazio = (humor, extra, texto) => `<div class="vazio">${viko({ humor, extra })}<span>${texto}</span></div>`;

function desenhar() {
  if (!ultimo) return;
  $("restaurante").textContent = ultimo.config.restaurante;
  const novos = ultimo.pedidos.filter((p) => p.status === "enviado");
  const fogo = ultimo.pedidos.filter((p) => p.status === "preparando");
  const prontos = ultimo.pedidos.filter((p) => p.status === "pronto");

  $("n-novos").textContent = novos.length || "";
  $("n-fogo").textContent = fogo.length || "";
  $("n-prontos").textContent = prontos.length || "";
  $("novos").innerHTML = novos.map((p) => cartao(p, "novos",
    `<button class="btn marca" onclick="acaoPedido(${p.id},'preparar')">Começar preparo</button>`, `chegou ${ha(p.criado)}`
  )).join("") || vazio("feliz", null, "Sem pedidos novos.");
  $("preparando").innerHTML = fogo.map((p) => cartao(p, "fogo",
    `<button class="btn ok" onclick="acaoPedido(${p.id},'pronto')">Pronto ✓</button>`, `no fogo ${ha(p.atualizado)}`
  )).join("") || vazio("concentrado", "chapeu", "Nada no fogo agora.");
  $("prontos").innerHTML = prontos.map((p) => cartao(p, "saindo", "", `pronto ${ha(p.atualizado)}`
  )).join("") || vazio("alegre", null, "Tudo entregue!");

  const atuais = new Set(ultimo.pedidos.map((p) => p.id + p.status));
  if (vistos && novos.some((p) => !vistos.has(p.id + p.status))) bipe(2);
  vistos = atuais;
  document.title = novos.length ? `(${novos.length}) Cozinha` : "Cozinha";
}

setInterval(desenhar, 20000);
iniciar({ papel: "cozinha", aoReceber: (estado) => { ultimo = estado; desenhar(); } });

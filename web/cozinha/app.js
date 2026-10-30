// Lógica da tela: cozinha. A conexão com o banco e os alertas ficam em /comum/comum.js.

import { iniciar, acaoPedido, ha, esc, bipe, agoraServidor, ativarAlertas, alertasAtivos } from "/comum/comum.js";
window.acaoPedido = acaoPedido;

const $ = (id) => document.getElementById(id);
const ATRASO = 20 * 60; // segundos até o tempo ficar em destaque
let ultimo = null, vistos = null;

if (alertasAtivos()) $("ativar").textContent = "🔔 Ligar som";
$("ativar").onclick = async () => {
  const aviso = await ativarAlertas();
  document.body.classList.add("som");
  $("aviso-alerta").textContent = aviso || "";
};

function cartao(p, classe, botao) {
  const atrasado = agoraServidor() - p.criado > ATRASO ? " atrasado" : "";
  return `
    <div class="cartao ${classe}${atrasado}">
      <div class="topo"><span class="mesa">Mesa ${esc(p.mesa)}</span><span class="tempo">${ha(p.criado)}</span></div>
      <div class="desc">${p.desc ? esc(p.desc) : "<i style='color:var(--suave)'>Sem descrição — confirme com o garçom</i>"}</div>
      <div class="acoes">${botao}</div>
    </div>`;
}

function desenhar() {
  if (!ultimo) return;
  $("restaurante").textContent = ultimo.config.restaurante;
  const novos = ultimo.pedidos.filter((p) => p.status === "enviado");
  const prep = ultimo.pedidos.filter((p) => p.status === "preparando");

  $("n-novos").textContent = novos.length || "";
  $("novos").innerHTML = novos.map((p) => cartao(p, "novo",
    `<button class="btn" onclick="acaoPedido(${p.id},'preparar')">Começar preparo</button>`
  )).join("") || `<div class="vazio">Sem pedidos novos</div>`;
  $("preparando").innerHTML = prep.map((p) => cartao(p, "preparando",
    `<button class="btn ok" onclick="acaoPedido(${p.id},'pronto')">Pronto ✓</button>`
  )).join("") || `<div class="vazio">Nada no fogo agora</div>`;

  const atuais = new Set(novos.map((p) => p.id));
  if (vistos && [...atuais].some((id) => !vistos.has(id))) {
    bipe(2);
  }
  vistos = atuais;
  document.title = novos.length ? `(${novos.length}) Cozinha` : "Cozinha";
}

setInterval(desenhar, 20000);
iniciar({ papel: "cozinha", aoReceber: (estado) => { ultimo = estado; desenhar(); } });

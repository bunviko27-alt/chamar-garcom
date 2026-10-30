// Lógica da tela: garçom. A conexão com o banco e os alertas ficam em /comum/comum.js.

import { iniciar, acaoMesa, acaoPedido, ha, esc, bipe, ativarAlertas, alertasAtivos } from "/comum/comum.js";
import { viko, piscar } from "/comum/viko.js";
Object.assign(window, { acaoMesa, acaoPedido, abrirPedido });

const $ = (id) => document.getElementById(id);
let ultimo = null, vistos = null;

$("ola-viko").innerHTML = viko({ humor: "feliz" });
piscar();

if (alertasAtivos()) $("ativar-texto").textContent = "Notificações ligadas. Toque para ligar o som também.";
$("ativar").onclick = async () => {
  const aviso = await ativarAlertas();
  document.body.classList.add("som");
  $("aviso-alerta").textContent = aviso || "";
};

function abrirPedido(mesa) {
  $("dlg-titulo").textContent = mesa ? `Pedido da mesa ${mesa}` : "Novo pedido";
  $("campo-mesa").hidden = !!mesa;
  const n = ultimo?.config.mesas || 10;
  $("dlg-mesa").innerHTML = Array.from({ length: n }, (_, i) => `<option>${i + 1}</option>`).join("");
  if (mesa) $("dlg-mesa").value = mesa;
  $("dlg-desc").value = "";
  $("dlg").returnValue = "";
  $("dlg").showModal();
}
$("dlg").addEventListener("close", () => {
  if ($("dlg").returnValue === "enviar") {
    acaoMesa($("dlg-mesa").value, "pedido", { desc: $("dlg-desc").value });
  }
});
$("novo").onclick = () => abrirPedido(null);

// Alerta grande no topo + som + vibração (a vibração funciona no Android; no iPhone
// a Apple não deixa sites vibrarem, lá quem vibra é a notificação do sistema).
let tAlerta;
function avisar(humor, extra, titulo, texto, vibracao, bipes) {
  const el = $("alerta");
  el.innerHTML = `${viko({ humor, extra })}<div><b>${esc(titulo)}</b><small>${esc(texto)}</small></div>`;
  el.classList.remove("mostrar");
  void el.offsetWidth;
  el.classList.add("mostrar");
  clearTimeout(tAlerta);
  tAlerta = setTimeout(() => el.classList.remove("mostrar"), 7000);
  bipe(bipes);
  if (navigator.vibrate) navigator.vibrate(vibracao);
}
$("alerta").onclick = () => {
  $("alerta").classList.remove("mostrar");
  $("chamados").scrollIntoView({ behavior: "smooth", block: "start" });
};

const selo = (mesa, tipo = "") => `<div class="selo-mesa ${tipo}"><div><small>MESA</small>${esc(mesa)}</div></div>`;
const vazio = (humor, texto) => `<div class="vazio">${viko({ humor })}<span>${texto}</span></div>`;

function desenhar() {
  if (!ultimo) return;
  $("restaurante").textContent = ultimo.config.restaurante;

  const chamados = Object.entries(ultimo.chamados).sort((a, b) => a[1] - b[1]);
  $("n-chamados").textContent = chamados.length || "";
  $("p-chamados").textContent = chamados.length;
  $("chamados").innerHTML = chamados.length ? chamados.map(([mesa, ts]) => `
    <div class="cartao chamado${vistos && !vistos.has("c" + mesa) ? " novo" : ""}">
      <div class="topo">${selo(mesa)}
        <div><div class="titulo-cartao">Está chamando você</div><span class="tempo">${ha(ts)}</span></div>
      </div>
      <div class="acoes">
        <button class="btn claro" onclick="acaoMesa('${esc(mesa)}','atender')">Só atendi</button>
        <button class="btn marca" onclick="abrirPedido('${esc(mesa)}')">Anotar pedido</button>
      </div>
    </div>`).join("") : vazio("feliz", "Nenhuma mesa chamando. Tudo tranquilo!");

  const prontos = ultimo.pedidos.filter((p) => p.status === "pronto");
  $("n-prontos").textContent = prontos.length || "";
  $("p-prontos").textContent = prontos.length;
  $("prontos").innerHTML = prontos.length ? prontos.map((p) => `
    <div class="cartao pronto">
      <div class="topo">${selo(p.mesa, "ok")}
        <div><div class="titulo-cartao">Pronto para levar</div><span class="tempo">saiu ${ha(p.atualizado)}</span></div>
      </div>
      ${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ""}
      <div class="acoes"><button class="btn ok" onclick="acaoPedido(${p.id},'entregue')">Entreguei ✓</button></div>
    </div>`).join("") : vazio("atento", "Nada esperando para sair.");

  const cozinha = ultimo.pedidos.filter((p) => p.status === "enviado" || p.status === "preparando");
  $("cozinha").innerHTML = cozinha.length ? cozinha.map((p) => `
    <div class="linha-cozinha">${selo(p.mesa, "neutro")}
      <div class="info">${p.status === "enviado" ? "Na fila" : "Preparando"}<small>pedido ${ha(p.criado)}</small></div>
      <span class="pilula ${p.status === "enviado" ? "" : "marca"}">${p.status === "enviado" ? "⏳" : "🔥"}</span>
    </div>`).join("") : vazio("concentrado", "Cozinha sem pedidos.");

  // Aviso só para o que é novo; com a tela fechada quem avisa é a notificação push.
  const atuais = new Set([...chamados.map(([m]) => "c" + m), ...prontos.map((p) => "p" + p.id)]);
  if (vistos) {
    const novos = [...atuais].filter((k) => !vistos.has(k));
    const chamado = novos.find((k) => k[0] === "c");
    const pronto = prontos.find((p) => novos.includes("p" + p.id));
    if (chamado) avisar("animado", "sino", `Mesa ${chamado.slice(1)} está chamando!`, "Toque para ver", [500, 150, 500, 150, 900], 3);
    else if (pronto) avisar("alegre", "prato", `Pedido da mesa ${pronto.mesa} pronto!`, "Pode levar", [300, 120, 300], 2);
  }
  vistos = atuais;
  const total = chamados.length + prontos.length;
  document.title = total ? `(${total}) Garçom` : "Garçom";
}

setInterval(desenhar, 20000); // atualiza o "há X min"
iniciar({ papel: "garcom", aoReceber: (estado) => { ultimo = estado; desenhar(); } });

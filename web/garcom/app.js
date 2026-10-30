// Lógica da tela: garcom. A conexão com o banco e os alertas ficam em /comum/comum.js.

import { iniciar, acaoMesa, acaoPedido, ha, esc, bipe, ativarAlertas, alertasAtivos } from "/comum/comum.js";
Object.assign(window, { acaoMesa, acaoPedido, abrirPedido });

const $ = (id) => document.getElementById(id);
let ultimo = null, vistos = null;

if (alertasAtivos()) $("ativar").textContent = "🔔 Notificações ligadas · toque para ligar o som também";
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

function desenhar() {
  if (!ultimo) return;
  $("restaurante").textContent = ultimo.config.restaurante;

  const chamados = Object.entries(ultimo.chamados).sort((a, b) => a[1] - b[1]);
  $("n-chamados").textContent = chamados.length || "";
  $("chamados").innerHTML = chamados.length ? chamados.map(([mesa, ts]) => `
    <div class="cartao chamado${vistos && !vistos.has("c" + mesa) ? " novo" : ""}">
      <div class="topo"><span class="mesa">Mesa ${esc(mesa)}</span><span class="tempo">${ha(ts)}</span></div>
      <div class="acoes">
        <button class="btn claro" onclick="acaoMesa('${esc(mesa)}','atender')">Só atendi</button>
        <button class="btn marca" onclick="abrirPedido('${esc(mesa)}')">Anotar pedido</button>
      </div>
    </div>`).join("") : `<div class="vazio">Nenhuma mesa chamando 🙌</div>`;

  const prontos = ultimo.pedidos.filter((p) => p.status === "pronto");
  $("n-prontos").textContent = prontos.length || "";
  $("prontos").innerHTML = prontos.length ? prontos.map((p) => `
    <div class="cartao pronto">
      <div class="topo"><span class="mesa">Mesa ${esc(p.mesa)}</span><span class="tempo">pronto ${ha(p.atualizado)}</span></div>
      ${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ""}
      <div class="acoes"><button class="btn ok" onclick="acaoPedido(${p.id},'entregue')">Entregue na mesa ✓</button></div>
    </div>`).join("") : `<div class="vazio">Nada esperando para sair</div>`;

  const cozinha = ultimo.pedidos.filter((p) => p.status === "enviado" || p.status === "preparando");
  $("cozinha").innerHTML = cozinha.length ? cozinha.map((p) => `
    <div class="cartao cozinha">
      <span class="mesa">Mesa ${esc(p.mesa)}</span>
      <span class="selo ${p.status}">${p.status === "enviado" ? "Aguardando" : "Preparando"} · ${ha(p.criado)}</span>
    </div>`).join("") : `<div class="vazio">Cozinha sem pedidos</div>`;

  // Bipe só para o que é novo; com a tela fechada quem avisa é a notificação push.
  const atuais = new Set([...chamados.map(([m]) => "c" + m), ...prontos.map((p) => "p" + p.id)]);
  if (vistos) {
    const novos = [...atuais].filter((k) => !vistos.has(k));
    if (novos.length) bipe(novos.some((k) => k[0] === "c") ? 3 : 2);
  }
  vistos = atuais;
  const total = chamados.length + prontos.length;
  document.title = total ? `(${total}) Garçom` : "Garçom";
}

setInterval(desenhar, 20000); // atualiza o "há X min"
iniciar({ papel: "garcom", aoReceber: (estado) => { ultimo = estado; desenhar(); } });

// Área do dono: restaurante, código da equipe e aparelhos das mesas.

import { sb, esc, traduzir, garantirLogin, criarRestaurante, meuRestaurante, sair } from "/dono/conta.js";
import { viko, piscar } from "/comum/viko.js";

const $ = (id) => document.getElementById(id);
const conteudo = $("conteudo");
let restaurante = null;

$("sair").onclick = async () => { await sair(); location.reload(); };

// Janela simples de formulário/confirmação. Resolve true se a pessoa tocou em OK.
function janela(titulo, campos, textoOk = "Salvar", perigo = false) {
  $("dlg-titulo").textContent = titulo;
  $("dlg-campos").innerHTML = campos;
  $("dlg-ok").textContent = textoOk;
  $("dlg-ok").className = `btn ${perigo ? "perigo" : "marca"}`;
  $("dlg").returnValue = "";
  $("dlg").showModal();
  return new Promise((r) => $("dlg").addEventListener("close", () => r($("dlg").returnValue === "ok"), { once: true }));
}

function haQuanto(ts) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 3600) return `visto há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `visto há ${Math.round(s / 3600)} h`;
  return `visto há ${Math.round(s / 86400)} dias`;
}

function mostrarRestaurante() {
  $("r-nome").textContent = restaurante.nome;
  $("r-codigo").textContent = restaurante.codigo;
}

async function carregarAparelhos() {
  const { data, error } = await sb.rpc("dono_aparelhos");
  if (error) return;
  $("n-aparelhos").textContent = data.length || "";
  $("aparelhos").innerHTML = data.length ? data.map((a) => `
    <div class="cartao aparelho">
      <div class="selo-mesa"><div><small>MESA</small>${esc(a.mesa)}</div></div>
      <div class="info">
        <b>Mesa ${esc(a.mesa)}</b>
        <span class="status ${a.online ? "online" : ""}">${a.online ? "Ligado" : esc(haQuanto(a.contato))}</span>
      </div>
      <div class="acoes">
        <button class="btn claro mini" data-numero="${a.id}" data-mesa="${esc(a.mesa)}">Nº</button>
        <button class="btn claro mini" data-remover="${a.id}" data-mesa="${esc(a.mesa)}">✕</button>
      </div>
    </div>`).join("")
    : `<div class="vazio">${viko({ humor: "atento" })}<span>Nenhum aparelho ainda. Cadastre o primeiro aí embaixo.</span></div>`;
}

$("conteudo").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.numero) {
    if (!(await janela(`Número da mesa ${b.dataset.mesa}`, `<label>Novo número<input id="j-mesa" value="${b.dataset.mesa}" inputmode="numeric" maxlength="10"></label>`))) return;
    const { error } = await sb.rpc("dono_mudar_mesa", { p_id: +b.dataset.numero, p_mesa: $("j-mesa").value.trim() });
    if (error) alert("Número inválido: use só letras e números.");
    carregarAparelhos();
  } else if (b.dataset.remover) {
    if (!(await janela(`Remover a mesa ${b.dataset.mesa}?`, "<p>O aparelho volta a mostrar o QR Code e precisa ser cadastrado de novo.</p>", "Remover", true))) return;
    await sb.rpc("dono_remover_aparelho", { p_id: +b.dataset.remover });
    carregarAparelhos();
  }
});

async function abrirPainel() {
  conteudo.innerHTML = "";
  conteudo.append($("painel").content.cloneNode(true));
  mostrarRestaurante();
  carregarAparelhos();
  setInterval(carregarAparelhos, 15000);

  $("r-editar").onclick = async () => {
    if (!(await janela("Seu restaurante", `
      <label>Nome<input id="j-nome" maxlength="60" value="${esc(restaurante.nome)}"></label>
      <label>Quantas mesas?<input id="j-mesas" type="number" min="1" max="500" value="${restaurante.mesas}"></label>`))) return;
    const { data, error } = await sb.rpc("dono_atualizar", { p_nome: $("j-nome").value, p_mesas: +$("j-mesas").value });
    if (!error) { restaurante = data; mostrarRestaurante(); }
  };
  $("r-trocar").onclick = async () => {
    if (!(await janela("Trocar o código da equipe?", "<p>Use se o código vazou. Garçons e cozinha vão precisar digitar o código novo. As mesas continuam funcionando.</p>", "Trocar", true))) return;
    const { data, error } = await sb.rpc("dono_trocar_codigo");
    if (!error) { restaurante = data; mostrarRestaurante(); }
  };
  $("manual").onsubmit = (e) => {
    e.preventDefault();
    const c = $("manual-codigo").value.replace(/\s/g, "").toUpperCase();
    if (c.length === 6) location.href = `/parear?c=${c}`;
  };
}

async function iniciar() {
  await garantirLogin(conteudo);
  $("sair").hidden = false;
  try {
    restaurante = (await meuRestaurante()) || (await criarRestaurante(conteudo));
  } catch (erro) {
    conteudo.innerHTML = `<p class="carregando">${esc(traduzir(erro))}</p>`;
    return;
  }
  abrirPainel();
}

piscar();
iniciar();

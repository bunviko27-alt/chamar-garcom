// Abre ao escanear o QR Code do aparelho da mesa: o dono entra e escolhe o número da mesa.

import { sb, esc, traduzir, garantirLogin, criarRestaurante, meuRestaurante } from "/dono/conta.js";
import { viko, piscar } from "/comum/viko.js";

const conteudo = document.getElementById("conteudo");
const CODIGO = (new URLSearchParams(location.search).get("c") || "").replace(/\s/g, "").toUpperCase();
const bonito = (c) => c.replace(/^(...)/, "$1 ");

const ERROS = {
  codigo_expirado: "Esse QR Code expirou. O aparelho já mostra um novo: escaneie de novo.",
  ja_cadastrado: "Esse aparelho já foi cadastrado.",
  mesa_invalida: "Número inválido: use só números ou letras.",
};

function sucesso(mesa) {
  conteudo.innerHTML = `
    <div class="cadastro">
      ${viko({ humor: "apaixonado", extra: "brilhos" })}
      <h1>Pronto!</h1>
      <p class="sub">O aparelho virou a <b>Mesa ${esc(mesa)}</b> e já está funcionando.</p>
      <a class="btn marca grande" href="/dono">Ver meus aparelhos</a>
    </div>`;
}

async function iniciar() {
  if (!/^[A-Z0-9]{6}$/.test(CODIGO)) {
    conteudo.innerHTML = `<div class="cadastro">${viko({ humor: "atento" })}<h1>QR Code inválido</h1>
      <p class="sub">Escaneie de novo o QR Code que aparece na tela do aparelho.</p></div>`;
    return;
  }
  await garantirLogin(conteudo, { titulo: "Cadastrar aparelho", texto: "Entre na sua conta de dono para cadastrar este aparelho." });
  if (!(await meuRestaurante())) await criarRestaurante(conteudo);
  const { data: sugestao } = await sb.rpc("dono_proxima_mesa");

  conteudo.innerHTML = `
    <div class="cadastro">
      ${viko({ humor: "alegre" })}
      <h1>Qual mesa é essa?</h1>
      <p class="sub">Aparelho</p>
      <div class="codigo-aparelho">${esc(bonito(CODIGO))}</div>
      <form id="f">
        <div class="numero-mesa">
          <button class="btn claro" type="button" id="menos">−</button>
          <input id="mesa" value="${esc(sugestao || "1")}" maxlength="10" inputmode="numeric" aria-label="Número da mesa">
          <button class="btn claro" type="button" id="mais">+</button>
        </div>
        <p class="erro" id="erro"></p>
        <button class="btn marca grande" type="submit" id="ok">Cadastrar mesa</button>
      </form>
    </div>`;
  const campo = document.getElementById("mesa");
  const passo = (n) => { const v = parseInt(campo.value, 10) || 0; campo.value = Math.max(1, v + n); };
  document.getElementById("menos").onclick = () => passo(-1);
  document.getElementById("mais").onclick = () => passo(1);
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const mesa = campo.value.trim();
    document.getElementById("ok").disabled = true;
    const { data, error } = await sb.rpc("pareamento_confirmar", { p_codigo: CODIGO, p_mesa: mesa });
    document.getElementById("ok").disabled = false;
    if (error) {
      const chave = Object.keys(ERROS).find((k) => error.message.includes(k));
      document.getElementById("erro").textContent = chave ? ERROS[chave] : traduzir(error);
      return;
    }
    sucesso(data.mesa);
  };
}

piscar();
iniciar();

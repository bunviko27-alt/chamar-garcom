// Conta do dono (Supabase Auth): login com e-mail/senha ou Google.
// Usado pela área do dono (/dono) e pela página que abre ao escanear o QR (/parear).

import { SUPABASE_URL, SUPABASE_CHAVE } from "/config.js";
import { viko } from "/comum/viko.js";

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "bunviko-dono" },
});

export const esc = (t) => { const d = document.createElement("div"); d.textContent = t ?? ""; return d.innerHTML; };

const ERROS = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Falta confirmar o e-mail: abra a mensagem que enviamos e toque no link."],
  [/already registered|already been registered/i, "Esse e-mail já tem conta. Toque em Entrar."],
  [/password should be at least|at least 6/i, "A senha precisa ter pelo menos 6 caracteres."],
  [/rate limit|too many/i, "Muitas tentativas. Espere alguns minutos e tente de novo."],
  [/provider is not enabled|unsupported provider/i, "Login com Google ainda não foi ligado no Supabase (veja o LEIA-ME)."],
  [/invalid email|unable to validate email/i, "Esse e-mail não parece válido."],
];
export function traduzir(erro) {
  const m = erro?.message || String(erro || "");
  for (const [re, txt] of ERROS) if (re.test(m)) return txt;
  return "Algo deu errado. Confira a internet e tente de novo.";
}

export async function usuario() {
  const { data } = await sb.auth.getSession();
  return data.session?.user || null;
}

export const sair = () => sb.auth.signOut();

// Desenha a tela de login dentro de `el` e resolve quando a pessoa entrar.
export function pedirLogin(el, { titulo = "Área do dono", texto = "Entre para cuidar do seu restaurante." } = {}) {
  return new Promise((resolver) => {
    el.innerHTML = `
      <div class="entrar">
        ${viko({ humor: "feliz" })}
        <h1>${esc(titulo)}</h1>
        <p class="sub">${esc(texto)}</p>
        <button class="btn claro google" id="e-google">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/></svg>
          Entrar com Google
        </button>
        <div class="ou"><span>ou com e-mail</span></div>
        <form id="e-form" novalidate>
          <label>E-mail<input type="email" id="e-email" autocomplete="email" inputmode="email" required></label>
          <label>Senha<input type="password" id="e-senha" autocomplete="current-password" minlength="6" required></label>
          <p class="erro" id="e-erro"></p>
          <button class="btn marca" id="e-entrar" type="submit">Entrar</button>
          <button class="btn claro" id="e-criar" type="button">Criar conta</button>
        </form>
      </div>`;
    const $ = (id) => el.querySelector("#" + id);
    const msg = (t, ok = false) => { $("e-erro").textContent = t; $("e-erro").classList.toggle("ok", ok); };
    const ocupado = (sim) => el.querySelectorAll("button").forEach((b) => (b.disabled = sim));

    $("e-google").onclick = async () => {
      ocupado(true);
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href } });
      if (error) { msg(traduzir(error)); ocupado(false); }
    };
    $("e-form").onsubmit = async (e) => {
      e.preventDefault();
      ocupado(true); msg("");
      const { data, error } = await sb.auth.signInWithPassword({ email: $("e-email").value.trim(), password: $("e-senha").value });
      ocupado(false);
      if (error) return msg(traduzir(error));
      resolver(data.user);
    };
    $("e-criar").onclick = async () => {
      const email = $("e-email").value.trim(), senha = $("e-senha").value;
      if (!email || senha.length < 6) return msg("Digite seu e-mail e uma senha com pelo menos 6 caracteres.");
      ocupado(true); msg("");
      const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.href } });
      ocupado(false);
      if (error) return msg(traduzir(error));
      if (data.session) return resolver(data.user);          // projeto sem confirmação de e-mail
      msg(`Conta criada! Enviamos um e-mail para ${email}. Toque no link dele e volte aqui.`, true);
    };
  });
}

// Garante que a pessoa está logada (mostrando o login se precisar). Resolve com o usuário.
export async function garantirLogin(el, opcoes) {
  return (await usuario()) || pedirLogin(el, opcoes);
}

// Pede o nome e cria o restaurante do dono. Resolve com os dados do restaurante.
export function criarRestaurante(el) {
  return new Promise((resolver) => {
    el.innerHTML = `
      <div class="entrar">
        ${viko({ humor: "alegre", extra: "brilhos" })}
        <h1>Bem-vindo!</h1>
        <p class="sub">Qual é o nome do seu restaurante?</p>
        <form id="r-form">
          <label>Nome do restaurante<input id="r-nome" maxlength="60" required placeholder="Ex.: Cantina da Ana"></label>
          <p class="erro" id="r-erro"></p>
          <button class="btn marca" type="submit">Criar restaurante</button>
        </form>
      </div>`;
    el.querySelector("#r-form").onsubmit = async (e) => {
      e.preventDefault();
      const { data, error } = await sb.rpc("dono_criar_restaurante", { p_nome: el.querySelector("#r-nome").value });
      if (error) return (el.querySelector("#r-erro").textContent = /nome_invalido/.test(error.message) ? "Digite o nome do restaurante." : traduzir(error));
      resolver(data);
    };
  });
}

export async function meuRestaurante() {
  const { data, error } = await sb.rpc("dono_restaurante");
  if (error) throw error;
  return data;
}

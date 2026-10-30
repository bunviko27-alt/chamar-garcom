// Viko, o mascote do Bunviko, em SVG (leve, nítido em qualquer tamanho).
//
//   viko({ humor: "feliz" | "animado" | "atento" | "concentrado" | "alegre" | "apaixonado",
//          extra: null | "sino" | "bloco" | "chapeu" | "prato" | "brilhos" })
//
// Devolve o SVG como texto. piscar() faz todos os Vikos da página piscarem de vez
// em quando trocando uma classe: só 2 redesenhos a cada piscada (barato no Pi).

const ESCURO = "#32231C";
const LARANJA = "#EF7130";
const AMARELO = "#FFCF35";
const VERMELHO = "#CE3B25";
const CORPO = "#FDEEDB";

const linha = (d, largura = 12, cor = ESCURO) =>
  `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${largura}" stroke-linecap="round" stroke-linejoin="round"/>`;

const OLHOS = {
  // < >  (o olhar da marca)
  setas: linha("M88 92 L64 110 L88 128") + linha("M132 92 L156 110 L132 128"),
  // ● ●  com brilho
  bolinhas: `<ellipse cx="76" cy="110" rx="11" ry="13" fill="${ESCURO}"/><ellipse cx="144" cy="110" rx="11" ry="13" fill="${ESCURO}"/>
    <circle cx="80" cy="105" r="4" fill="#fff"/><circle cx="148" cy="105" r="4" fill="#fff"/>`,
  // ^ ^
  arcos: linha("M62 116 Q76 96 90 116") + linha("M130 116 Q144 96 158 116"),
  // ♥ ♥
  coracoes: ["M76 124 C60 112 62 96 72 98 C75 98 76 101 76 101 C76 101 77 98 80 98 C90 96 92 112 76 124Z",
             "M144 124 C128 112 130 96 140 98 C143 98 144 101 144 101 C144 101 145 98 148 98 C158 96 160 112 144 124Z"]
    .map((d) => `<path d="${d}" fill="${VERMELHO}" stroke="${VERMELHO}" stroke-width="5" stroke-linejoin="round"/>`).join(""),
};

const BOCAS = {
  sorriso: linha("M98 136 Q110 152 122 136"),
  aberta: `<path d="M94 134 Q110 162 126 134 Z" fill="${ESCURO}" stroke="${ESCURO}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M101 147 Q110 140 119 147 Q110 156 101 147Z" fill="#F08A6C"/>`,
};

const HUMORES = {
  feliz: ["setas", "sorriso"],
  animado: ["setas", "aberta"],
  atento: ["bolinhas", "sorriso"],
  concentrado: ["arcos", "sorriso"],
  alegre: ["arcos", "aberta"],
  apaixonado: ["coracoes", "aberta"],
};

const EXTRAS = {
  chapeu: `<g stroke="${"#E2CDB3"}" stroke-width="3">
      <rect x="80" y="30" width="60" height="20" rx="6" fill="#fff"/>
      <circle cx="88" cy="18" r="16" fill="#fff"/><circle cx="132" cy="18" r="16" fill="#fff"/>
      <circle cx="110" cy="8" r="20" fill="#fff"/>
      <rect x="81.5" y="26" width="57" height="12" fill="#fff" stroke="none"/></g>`,
  sino: `<g transform="translate(176 128) rotate(14)">
      <path d="M-20 20 H20 C16 15 14 10 14 0 A14 14 0 0 0 -14 0 C-14 10 -16 15 -20 20Z" fill="${AMARELO}" stroke="${ESCURO}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="0" cy="26" r="5" fill="${ESCURO}"/><circle cx="0" cy="-17" r="4" fill="${ESCURO}"/></g>`,
  bloco: `<g transform="translate(178 132) rotate(10)">
      <rect x="-20" y="-24" width="40" height="48" rx="6" fill="#fff" stroke="${ESCURO}" stroke-width="5"/>
      <path d="M-10 -10 H10 M-10 0 H10 M-10 10 H4" stroke="${LARANJA}" stroke-width="5" stroke-linecap="round"/></g>`,
  prato: `<g transform="translate(176 140)">
      <path d="M-26 6 A26 24 0 0 1 26 6 Z" fill="${AMARELO}" stroke="${ESCURO}" stroke-width="5" stroke-linejoin="round"/>
      <rect x="-32" y="6" width="64" height="8" rx="4" fill="#fff" stroke="${ESCURO}" stroke-width="5"/>
      <circle cx="0" cy="-20" r="5" fill="${ESCURO}"/></g>`,
  brilhos: [[24, 40, 1], [196, 70, .8], [30, 150, .7]]
    .map(([x, y, k]) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0 -16 C3 -4 4 -3 16 0 C4 3 3 4 0 16 C-3 4 -4 3 -16 0 C-4 -3 -3 -4 0 -16Z" fill="${AMARELO}" stroke="${LARANJA}" stroke-width="3" stroke-linejoin="round"/>`)
    .join(""),
};

export function viko({ humor = "feliz", extra = null, classe = "" } = {}) {
  const [olhos, boca] = HUMORES[humor] || HUMORES.feliz;
  return `<svg class="viko ${classe}" viewBox="0 -30 220 210" role="img" aria-label="Viko">
    <ellipse cx="110" cy="172" rx="78" ry="8" fill="${ESCURO}" opacity=".10"/>
    <path d="M110 18 C170 18 204 64 204 116 C204 158 172 168 110 168 C48 168 16 158 16 116 C16 64 50 18 110 18Z" fill="${CORPO}"/>
    <path d="M22 134 C30 156 60 164 110 164 C160 164 190 156 198 134 C186 150 156 156 110 156 C64 156 34 150 22 134Z" fill="#F4DCC0"/>
    ${extra === "chapeu" ? "" : linha("M164 14 L168 -4", 11, LARANJA) + linha("M180 28 L194 14", 11, LARANJA)}
    <ellipse cx="52" cy="136" rx="13" ry="8" fill="#F7A98B" opacity=".55"/>
    <ellipse cx="168" cy="136" rx="13" ry="8" fill="#F7A98B" opacity=".55"/>
    <g class="olhos">${OLHOS[olhos]}</g>
    ${BOCAS[boca]}
    ${extra ? EXTRAS[extra] || "" : ""}
  </svg>`;
}

let piscador = null;
export function piscar() {
  if (piscador) return;
  const uma = () => {
    const todos = document.querySelectorAll(".viko");
    todos.forEach((v) => v.classList.add("piscando"));
    setTimeout(() => todos.forEach((v) => v.classList.remove("piscando")), 140);
    piscador = setTimeout(uma, 3500 + Math.random() * 3000);
  };
  piscador = setTimeout(uma, 2500);
}

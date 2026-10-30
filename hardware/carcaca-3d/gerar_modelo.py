#!/usr/bin/env python3
"""Gera os STLs da carcaça do Bunviko (Raspberry Pi 3B + tela touch HDMI de 5").

Peças (pasta stl/):
  carcaca.stl         corpo em cunha, com janela da tela, logo, botão, saídas de ar
  base.stl            base laranja que fecha embaixo (4 parafusos M3)
  botao.stl           tampa laranja do botão de cima (aciona uma chave táctil 12x12)
  suporte_botao.stl   plaquinha que segura a chave táctil (2 parafusos M2.5)
  presilha.stl        prende a tela por dentro (imprimir 4)

Uso:  python gerar_modelo.py      (precisa de: pip install manifold3d trimesh matplotlib)
Todas as medidas em mm; ajuste os PARÂMETROS e gere de novo.
Eixos: X = largura, Y = profundidade (0 = frente), Z = altura (0 = apoio da carcaça).
"""

import math
from pathlib import Path

import numpy as np
import trimesh
from manifold3d import CrossSection, FillRule, JoinType, Manifold

# ============================================================== PARÂMETROS
# Tela touch HDMI de 5" (800x480). Medida do usuário: 120,5 x 77 mm.
VIDRO_L, VIDRO_A = 120.5, 77.0     # tela inteira: largura x altura (medido)
VIDRO_E = 7.0                      # espessura da tela na borda, onde a presilha aperta (A CONFERIR)
TELA_L, TELA_A = 118.6, 70.4       # vidro do LCD por cima da placa (medido)
JANELA_L, JANELA_A = 110.0, 66.0   # abertura: área ativa padrão 108x64,8 + folga, dentro do vidro
# Vidro na placa: sobra 2,3 mm em cima e 4,3 embaixo (medido) -> centro 1 mm acima.
JANELA_DX = 0.0
JANELA_DY = (4.3 - 2.3) / 2        # deslocamento da abertura em relação ao centro da placa
DISPLAY_PROF = VIDRO_E             # só para conferência de encaixe
PI_PROF = 30.0                     # Pi 3B espetado atrás pelos pinos GPIO, com portas (conferência)

LARG = 156.0          # largura total
PROF = 112.0          # profundidade da base (frente -> trás)
ANG_FRENTE = 65.0     # inclinação da tela em relação à mesa
ANG_TRAS = 82.0       # inclinação da traseira
PAREDE = 2.6
R_BAIXO, R_TOPO = 9.0, 12.0            # arredondamento dos cantos
MARGEM_INF, MARGEM_SUP = 20.0, 11.0   # moldura abaixo/acima da tela (embaixo vai o logo)

CHAVE_ALT = 7.3       # altura da chave táctil 12x12 (com o botãozinho)
BASE_ESP = 4.0        # espessura da base laranja
FOLGA = 0.4           # folga de encaixe entre peças impressas
SEG = 72              # resolução das curvas
# ==========================================================================

PASTA = Path(__file__).resolve().parent
SAIDA = PASTA / "stl"


def rad(g):
    return math.radians(g)


a, b = rad(ANG_FRENTE), rad(ANG_TRAS)
U = np.array([math.cos(a), math.sin(a)])        # sobe pela frente (y, z)
NF = np.array([-math.sin(a), math.cos(a)])      # normal da frente, para fora
V = np.array([-math.cos(b), math.sin(b)])       # sobe pela traseira
NB = np.array([math.sin(b), math.cos(b)])       # normal da traseira, para fora
B0 = np.array([PROF, 0.0])                      # pé da traseira

# Centros dos arredondamentos no perfil lateral (y, z).
s0 = R_BAIXO / math.tan(a)                      # onde começa a parte plana da frente
s1 = s0 + MARGEM_INF + VIDRO_A + MARGEM_SUP     # onde termina
ALT = math.sin(a) * s1 - math.cos(a) * R_TOPO + R_TOPO
C0 = U * s0 - NF * R_BAIXO
C1 = U * s1 - NF * R_TOPO
sb0 = R_BAIXO / math.tan(b)
sb1 = (ALT - R_TOPO + math.cos(b) * R_TOPO) / math.sin(b)
C3 = B0 + V * sb0 - NB * R_BAIXO
C2 = B0 + V * sb1 - NB * R_TOPO
CANTOS = [(C0, R_BAIXO), (C1, R_TOPO), (C2, R_TOPO), (C3, R_BAIXO)]
TOPO_Y = (C1[0] + C2[0]) / 2                    # meio da parte plana de cima


# ------------------------------------------------------------- utilidades

def esfera(c, r):
    return Manifold.sphere(r, SEG).translate(tuple(c))


def casco(encolher=0.0, descer=0.0):
    """Corpo arredondado (envoltória de 8 esferas). encolher = desconto da parede."""
    partes = []
    for (y, z), r in CANTOS:
        rr = r - encolher
        for sx in (-1, 1):
            x = sx * (LARG / 2 - r)
            partes.append(esfera((x, y, z), rr))
            if descer and z == 0:
                partes.append(esfera((x, y, -descer), rr))
    return Manifold.batch_hull(partes)


def caixa(x0, x1, y0, y1, z0, z1):
    return Manifold.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def quadro(ex, ey, ez, origem):
    """Matriz 3x4 que leva coordenadas locais (x, y, z) para o mundo."""
    return np.column_stack([ex, ey, ez, origem]).astype(float)


def na_frente(peca, x, s, h=0.0):
    """Local: x = largura, y = sobe pela frente, z = para fora da frente."""
    o = U * s + NF * h
    return peca.transform(quadro((1, 0, 0), (0, *U), (0, *NF), (x, *o)))


def na_tras(peca, x, s, h=0.0):
    """Local: x = largura vista de trás, y = sobe pela traseira, z = para fora."""
    o = B0 + V * s + NB * h
    return peca.transform(quadro((-1, 0, 0), (0, *V), (0, *NB), (x, *o)))


def pilula(comp, larg, alt, z0=0.0):
    """Pílula (retângulo de pontas redondas) deitada em XY, de z0 a z0+alt."""
    r = larg / 2
    reta = max(comp - larg, 0.001)
    cs = CrossSection.square((reta, larg), center=True) + \
        CrossSection.circle(r, SEG).translate((-reta / 2, 0)) + \
        CrossSection.circle(r, SEG).translate((reta / 2, 0))
    return cs.extrude(alt).translate((0, 0, z0))


def cilindro(r, z0, z1, r2=None):
    return Manifold.cylinder(z1 - z0, r, r if r2 is None else r2, SEG).translate((0, 0, z0))


def texto(txt, altura, z0, z1):
    """Texto centrado em (0, 0) no plano XY, extrudado de z0 a z1."""
    from matplotlib.font_manager import FontProperties
    from matplotlib.textpath import TextPath
    caminho = TextPath((0, 0), txt, size=10, prop=FontProperties(family="DejaVu Sans", weight="bold"))
    polis = [p for p in caminho.to_polygons() if len(p) >= 3]
    tudo = np.vstack(polis)
    (xmin, ymin), (xmax, ymax) = tudo.min(0), tudo.max(0)
    k = altura / (ymax - ymin)
    polis = [((p - [(xmin + xmax) / 2, (ymin + ymax) / 2]) * k).tolist() for p in polis]
    return CrossSection(polis, FillRule.EvenOdd).extrude(z1 - z0).translate((0, 0, z0))


# ------------------------------------------------------------- peças

VIDRO_S0 = s0 + MARGEM_INF                       # borda de baixo do vidro (ao longo da frente)
VIDRO_SC = VIDRO_S0 + VIDRO_A / 2
PRESILHAS = [(sx * (VIDRO_L / 2 - 18), s) for sx in (-1, 1) for s in (VIDRO_S0 - 5, VIDRO_S0 + VIDRO_A + 5)]
TORRE_H = VIDRO_E + 4.0                          # altura das torres das presilhas

TAMPA_L, TAMPA_W = 20.0, 10.4                    # tampa do botão
ABA = 2.5                                        # aba que impede a tampa de sair
CAMISA_H = 12.0                                  # guia do botão, abaixo do teto
ORELHA_X = (TAMPA_L + 2 * ABA + FOLGA) / 2 + 2 + 3.4   # orelha (r4) entra 0.6 na camisa


def carcaca():
    externo = casco() ^ caixa(-LARG, LARG, -50, PROF + 50, 0, ALT + 50)
    interno = casco(PAREDE, descer=30)
    corpo = externo - interno

    # Guia do botão (camisa) + orelhas para o suporte da chave.
    teto = ALT - PAREDE
    vao_l, vao_w = TAMPA_L + 2 * ABA + FOLGA, TAMPA_W + 2 * ABA + FOLGA
    camisa = pilula(vao_l + 4, vao_w + 4, CAMISA_H + PAREDE + 1, teto - CAMISA_H) - \
        pilula(vao_l, vao_w, CAMISA_H, teto - CAMISA_H)
    for sx in (-1, 1):
        orelha = cilindro(4, teto - CAMISA_H, ALT) - cilindro(1.1, teto - CAMISA_H - 1, teto - 1.5)
        camisa += orelha.translate((sx * ORELHA_X, 0, 0))
    corpo += camisa.translate((0, TOPO_Y, 0)) ^ externo
    corpo -= pilula(TAMPA_L + FOLGA * 1.5, TAMPA_W + FOLGA * 1.5, PAREDE + 4, teto - 1).translate((0, TOPO_Y, 0))

    # Torres das presilhas do vidro (por dentro da frente).
    for x, s in PRESILHAS:
        torre = cilindro(4, -PAREDE - TORRE_H, -PAREDE + 0.5) - \
            cilindro(1.25, -PAREDE - TORRE_H - 1, -0.8)
        corpo += na_frente(torre, x, s) ^ externo

    # Torres dos parafusos da base.
    for x, y in pontos_base():
        torre = cilindro(4, 0, 14) - cilindro(1.25, -1, 12)
        corpo += torre.translate((x, y, 0)) ^ externo

    # Janela da tela, com chanfro por fora.
    c = 1.5
    janela = Manifold.batch_hull([
        caixa(-JANELA_L / 2, JANELA_L / 2, -JANELA_A / 2, JANELA_A / 2, -PAREDE - 1, -PAREDE - 0.99),
        caixa(-JANELA_L / 2 - c, JANELA_L / 2 + c, -JANELA_A / 2 - c, JANELA_A / 2 + c, 0, 0.01),
    ]) + caixa(-JANELA_L / 2 - c, JANELA_L / 2 + c, -JANELA_A / 2 - c, JANELA_A / 2 + c, 0, 5)
    corpo -= na_frente(janela, JANELA_DX, VIDRO_SC + JANELA_DY)

    # Logos em baixo-relevo.
    corpo -= na_frente(texto("bunviko", 7.0, -0.8, 2), 0, s0 + MARGEM_INF / 2)
    corpo -= na_tras(texto("bunviko", 9.0, -0.8, 2), 0, sb0 + 0.62 * (sb1 - sb0))

    # Traseira: passagem do cabo USB-C e saídas de ar.
    corpo -= na_tras(pilula(12, 6, PAREDE + 6, -PAREDE - 3), 0, 22)
    for sx in (-1, 1):
        for i in range(6):
            fenda = pilula(16, 2.4, PAREDE + 6, -PAREDE - 3)
            fenda = fenda.rotate((0, 0, 90))
            corpo -= na_tras(fenda, sx * (22 + 6 * i), 24)
    return corpo


def secao(z):
    return casco().slice(z)


def pontos_base():
    """Posições das 4 torres de parafuso: perto dos cantos, encostadas nas paredes."""
    contorno = secao(0.01).offset(-PAREDE - 2.0, JoinType.Round, circular_segments=SEG)
    pts = np.vstack([np.array(p) for p in contorno.to_polygons()])
    escolhidos = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            escolhidos.append(tuple(pts[np.argmax(sx * pts[:, 0] + sy * pts[:, 1] * 1.6)]))
    return escolhidos


def base():
    fora = secao(0.01).offset(-0.4, JoinType.Round, circular_segments=SEG)
    dentro = secao(0.01).offset(-PAREDE - FOLGA, JoinType.Round, circular_segments=SEG)
    placa = fora.extrude(BASE_ESP).translate((0, 0, -BASE_ESP))
    aro = (dentro - dentro.offset(-2.0, JoinType.Round, circular_segments=SEG)).extrude(3)
    for x, y in pontos_base():
        aro -= cilindro(5, -1, 4).translate((x, y, 0))
    peca = placa + aro
    for x, y in pontos_base():
        furo = cilindro(1.7, -BASE_ESP - 1, 1) + cilindro(3.5, -BASE_ESP - 0.01, -BASE_ESP + 1.8, 1.7)
        peca -= furo.translate((x, y, 0))
    # Fundo liso, sem furos de ventilação: recebe uma manta de borracha
    # antiderrapante adesiva (ver BORRACHA_MARGEM no LEIA-ME).
    return peca


def botao():
    corpo_l = PAREDE + 3.0                         # atravessa a parede e sobra 3 mm
    tampa = pilula(TAMPA_L, TAMPA_W, corpo_l, 0)
    aba = pilula(TAMPA_L + 2 * ABA, TAMPA_W + 2 * ABA, 1.5, -1.5)
    # A haste para 0.3 mm acima do botão da chave (encaixada 1.5 mm no suporte).
    haste_l = CAMISA_H - (CHAVE_ALT - 1.5) - 1.5 - 0.3
    haste = cilindro(2.5, -1.5 - haste_l, -1.5)
    peca = tampa + aba + haste
    return peca.rotate((180, 0, 0)).translate((0, 0, corpo_l))   # imprime de cabeça para baixo


def suporte_botao():
    placa = caixa(-ORELHA_X - 5, ORELHA_X + 5, -10, 10, 0, 3)
    placa -= caixa(-6.2, 6.2, -6.2, 6.2, 1.5, 4)                   # encaixe da chave 12x12
    placa -= caixa(-2, 2, -12, -4, -1, 4)                          # passagem dos fios
    for sx in (-1, 1):
        placa -= cilindro(1.4, -1, 4).translate((sx * ORELHA_X, 0, 0))
    return placa


def presilha():
    # O pé apoia de 1 a 5 mm para dentro da borda da tela (longe dos componentes).
    barra = caixa(-5, 10, -5, 5, 0, 3)
    pe = caixa(6, 10, -5, 5, 3, 3 + TORRE_H - VIDRO_E)
    return barra + pe - cilindro(1.7, -1, 4)


# ------------------------------------------------------------- saída

def malha(m):
    g = m.to_mesh()
    return trimesh.Trimesh(np.asarray(g.vert_properties)[:, :3], np.asarray(g.tri_verts), process=True)


def conferir_encaixe(car):
    """Volume da tela + Pi não pode bater em nada da carcaça."""
    tela = na_frente(caixa(-VIDRO_L / 2, VIDRO_L / 2, -VIDRO_A / 2, VIDRO_A / 2,
                           -PAREDE - DISPLAY_PROF, -PAREDE), 0, VIDRO_SC)
    pi = na_frente(caixa(-43, 43, -29, 29, -PAREDE - DISPLAY_PROF - PI_PROF, -PAREDE - DISPLAY_PROF + 0.1),
                   0, VIDRO_SC)
    choque = (car ^ (tela + pi)).volume()
    return tela, pi, choque


def main():
    SAIDA.mkdir(exist_ok=True)
    car = carcaca()
    pecas = {
        "carcaca": car,
        "base": base().translate((0, 0, BASE_ESP)),
        "botao": botao(),
        "suporte_botao": suporte_botao(),
        "presilha": presilha(),
    }
    for nome, m in pecas.items():
        t = malha(m)
        t.export(SAIDA / f"{nome}.stl")
        ext = t.bounds[1] - t.bounds[0]
        print(f"{nome:14s} {ext[0]:6.1f} x {ext[1]:6.1f} x {ext[2]:6.1f} mm  "
              f"fechada={t.is_watertight}  volume={t.volume / 1000:6.1f} cm³  triângulos={len(t.faces)}")
    _, _, choque = conferir_encaixe(car)
    print(f"Tela + Pi batendo na carcaça: {choque:.1f} mm³")
    print(f"Altura {ALT:.1f} mm (+{BASE_ESP:g} da base), parte plana do topo {C2[0] - C1[0]:.1f} mm")


if __name__ == "__main__":
    main()

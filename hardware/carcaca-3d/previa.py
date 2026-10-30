#!/usr/bin/env python3
"""Desenha imagens de prévia da montagem (previa/*.png) a partir das peças."""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

import gerar_modelo as g

CORES = {"carcaca": "#efe7dc", "base": "#e8572a", "botao": "#e8572a", "tela": "#1d1d1f"}
LUZ = np.array([-0.4, -0.7, 0.8]) / np.linalg.norm([-0.4, -0.7, 0.8])


def triangulos(m):
    t = g.malha(m)
    return t.vertices[t.faces], t.face_normals


def montar():
    car = g.carcaca()
    pecas = {
        "carcaca": car,
        "base": g.base(),
        "botao": g.botao().rotate((180, 0, 0)).translate((0, g.TOPO_Y, g.ALT + 3.0)),
    }
    tela = g.na_frente(g.caixa(-g.VIDRO_L / 2, g.VIDRO_L / 2, -g.VIDRO_A / 2, g.VIDRO_A / 2,
                               -g.PAREDE - 2.0, -g.PAREDE), 0, g.VIDRO_SC)
    pecas["tela"] = tela
    return pecas


def desenhar(pecas, elev, azim, arquivo, titulo, corte=None):
    fig = plt.figure(figsize=(8, 6.4), dpi=130)
    ax = fig.add_subplot(projection="3d")
    for nome, m in pecas.items():
        if corte is not None:
            m = m ^ corte
        tri, nor = triangulos(m)
        base = np.array(matplotlib.colors.to_rgb(CORES[nome]))
        luz = np.clip(nor @ LUZ, 0, 1) * 0.55 + 0.45
        cores = np.clip(base[None, :] * luz[:, None], 0, 1)
        ax.add_collection3d(Poly3DCollection(tri, facecolors=cores, edgecolors="none", linewidths=0))
    ax.set_xlim(-125, 125); ax.set_ylim(-60, 190); ax.set_zlim(-30, 190)
    ax.set_box_aspect((1, 1, 0.88))
    ax.view_init(elev=elev, azim=azim)
    ax.set_axis_off()
    ax.set_title(titulo, fontsize=13)
    fig.tight_layout()
    fig.savefig(arquivo, facecolor="#faf7f2")
    plt.close(fig)


def exportar_glb(pecas, arquivo):
    """Montagem colorida em GLB, para o visualizador 3D (previa/index.html)."""
    import trimesh
    cena = trimesh.Scene()
    for nome, m in pecas.items():
        t = g.malha(m)
        cor = (np.array(matplotlib.colors.to_rgb(CORES[nome])) * 255).astype(np.uint8)
        t.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
            baseColorFactor=[*cor, 255], roughnessFactor=0.55 if nome != "tela" else 0.15, metallicFactor=0.0))
        # GLB usa Y para cima: gira de Z-para-cima e põe a frente virada para a câmera.
        t.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
        cena.add_geometry(t, node_name=nome)
    cena.export(arquivo)


def main():
    pasta = g.PASTA / "previa"
    pasta.mkdir(exist_ok=True)
    pecas = montar()
    exportar_glb(pecas, pasta / "bunviko.glb")
    desenhar(pecas, 18, -62, pasta / "frente.png", "Frente")
    desenhar(pecas, 8, 0, pasta / "lateral.png", "Lateral")
    desenhar(pecas, 18, 118, pasta / "traseira.png", "Traseira")
    meio = g.caixa(0, 200, -100, 300, -50, 300)
    desenhar(pecas, 10, 20, pasta / "corte.png", "Corte (por dentro)", corte=meio)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
process-mascot-assets.py
========================
Processa os DOIS arquivos originais do mascote (sem redesenhar nada):

  assets-src/mascot-expressions.png  -> 8 expressoes finais (Arquivo B)
  assets-src/mascot-spritesheet.png  -> pecas de efeitos/sombras (Arquivo A)

Para cada peca: recorte por bounding-box real do conteudo + remocao de fundo
branco por analise de cor (fundo liso), gerando PNGs com alpha real em:

  public/mascot/states/*.png   (8 estados completos)
  public/mascot/fx/*.png       (camadas de efeito animaveis)

Uso:  python3 scripts/process-mascot-assets.py
"""
import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_EXPR = os.path.join(ROOT, "assets-src", "mascot-expressions.png")
SRC_SHEET = os.path.join(ROOT, "assets-src", "mascot-spritesheet.png")
OUT_STATES = os.path.join(ROOT, "public", "mascot", "states")
OUT_FX = os.path.join(ROOT, "public", "mascot", "fx")
MANIFEST = os.path.join(ROOT, "public", "mascot", "manifest.json")

os.makedirs(OUT_STATES, exist_ok=True)
os.makedirs(OUT_FX, exist_ok=True)


def white_to_alpha(img: Image.Image, near_white=14, soft=42) -> Image.Image:
    """Remove SOMENTE o fundo branco conectado as bordas da imagem.

    Brancos internos da arte (olhos, xicara, vapor) permanecem opacos.
    Usa flood-fill por conectividade a partir das bordas + borda suave.
    """
    arr = np.asarray(img.convert("RGB")).astype(np.int16)
    dist = 255 - arr.min(axis=2)          # 0 = branco puro
    whiteish = dist <= near_white          # candidato a fundo
    # componentes conexos dos pixels brancos; os que tocam a borda sao fundo
    labels, _ = ndimage.label(whiteish)
    border_labels = np.unique(np.concatenate([
        labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]))
    border_labels = border_labels[border_labels != 0]
    background = np.isin(labels, border_labels)
    # alpha: 0 no fundo, com transicao suave na borda da arte
    alpha = np.full(dist.shape, 255, dtype=np.float64)
    alpha[background] = 0
    # suaviza a borda: pixels nao-fundo mas quase brancos proximos ao fundo
    edge = ndimage.binary_dilation(background, iterations=2) & ~background
    soft_a = np.clip((dist - near_white) * 255 / max(1, soft - near_white), 40, 255)
    alpha[edge] = np.minimum(alpha[edge], soft_a[edge])
    out = np.dstack([arr.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(out, "RGBA")


def content_bbox(alpha: np.ndarray, thr=24):
    ys, xs = np.where(alpha > thr)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def crop_cell(img_rgba: Image.Image, box, pad=6):
    """Recorta box e aperta para o bounding-box real do conteudo."""
    cell = img_rgba.crop(box)
    a = np.asarray(cell)[:, :, 3]
    bb = content_bbox(a)
    if bb is None:
        return cell
    x0, y0, x1, y1 = bb
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(cell.width, x1 + pad); y1 = min(cell.height, y1 + pad)
    return cell.crop((x0, y0, x1, y1))


manifest = {"states": {}, "fx": {}}

# ---------------------------------------------------------------------------
# 1) ARQUIVO B -> 8 estados finais (grade 4 x 2)
# ---------------------------------------------------------------------------
expr = Image.open(SRC_EXPR)
expr_rgba = white_to_alpha(expr)
W, H = expr_rgba.size
STATE_NAMES = [
    "happy", "love", "tired", "connecting",
    "coding", "music", "angry", "error404",
]
cw, ch = W / 4.0, H / 2.0
for i, name in enumerate(STATE_NAMES):
    col, row = i % 4, i // 4
    box = (int(col * cw), int(row * ch), int((col + 1) * cw), int((row + 1) * ch))
    piece = crop_cell(expr_rgba, box, pad=4)
    path = os.path.join(OUT_STATES, f"{name}.png")
    piece.save(path, optimize=True)
    manifest["states"][name] = {
        "file": f"/mascot/states/{name}.png",
        "w": piece.width, "h": piece.height,
    }
    print(f"[state] {name}: {piece.width}x{piece.height}")

# ---------------------------------------------------------------------------
# 2) ARQUIVO A -> efeitos e sombras por componentes conexos
# ---------------------------------------------------------------------------
sheet = Image.open(SRC_SHEET)
sheet_rgba = white_to_alpha(sheet)
arr_a = np.asarray(sheet_rgba)[:, :, 3]


def extract_blobs(region_box, min_area=60, merge_px=6):
    """Extrai blobs (pecas) de uma regiao do sprite sheet, do maior p/ menor."""
    x0, y0, x1, y1 = region_box
    sub = arr_a[y0:y1, x0:x1] > 40
    sub = ndimage.binary_dilation(sub, iterations=merge_px)
    labels, n = ndimage.label(sub)
    blobs = []
    for sl in ndimage.find_objects(labels):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        if w * h < min_area:
            continue
        blobs.append((x0 + sl[1].start, y0 + sl[0].start,
                      x0 + sl[1].stop, y0 + sl[0].stop))
    blobs.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
    return blobs


def save_fx(name, box, pad=2):
    piece = crop_cell(sheet_rgba, box, pad=pad)
    path = os.path.join(OUT_FX, f"{name}.png")
    piece.save(path, optimize=True)
    manifest["fx"][name] = {
        "file": f"/mascot/fx/{name}.png",
        "w": piece.width, "h": piece.height,
    }
    print(f"[fx] {name}: {piece.width}x{piece.height} from {box}")


# Painel EFEITOS/EMOCOES — pecas nomeadas (coordenadas validadas por blob
# detection automatica na primeira execucao; ver _fx_blobs.json)
FX_PIECES = {
    "heart-big":    (585, 372, 618, 403),
    "sparkles":     (620, 382, 654, 402),
    "music-notes":  (660, 372, 688, 406),
    "steam-cloud":  (695, 378, 717, 405),
    "anger-mark":   (720, 377, 745, 403),
    "heart-small":  (586, 407, 615, 432),
    "tears":        (627, 406, 645, 432),
    "cloud-puff":   (659, 410, 685, 434),
    "shadow-large": (793, 383, 834, 400),
    "shadow-medium":(889, 383, 916, 402),
    "shadow-small": (925, 382, 946, 401),
}
for name, box in FX_PIECES.items():
    save_fx(name, box, pad=2)

with open(MANIFEST, "w") as f:
    json.dump(manifest, f, indent=2)
print("manifest salvo em", MANIFEST)

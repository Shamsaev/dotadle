"""Генерация аватарок, полных рендеров и сеток для портрета из символов.
Использование: python3 scripts/make_assets.py ПАПКА_С_РЕНДЕРАМИ
В папке должны лежать файлы <slug>.webp или <slug>.png (прозрачный фон), slug как в lib/heroes.json.
Нужны: pip install pillow numpy
"""
import json, os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
heroes = json.load(open(f"{ROOT}/lib/heroes.json", encoding="utf-8"))
FULL_FIGURE = {"dark_willow", "kez", "spectre", "wisp", "witch_doctor"}  # у этих аватарка — фигура целиком
COLS, ROWS = 56, 40

def load(slug):
    for ext in ("webp", "png"):
        p = f"{SRC}/{slug}.{ext}"
        if os.path.exists(p): return Image.open(p).convert("RGBA")
    return None

def pct(arr, p):
    c = np.cumsum(arr); c = c / c[-1]; return int(np.searchsorted(c, p))

def square(im, cx, top, side):
    canvas = Image.new("RGBA", (im.width + 2 * side, im.height + 2 * side), (0, 0, 0, 0)); canvas.paste(im, (side, side))
    l = int(cx - side / 2) + side; t = int(top) + side
    return canvas.crop((l, t, l + side, t + side)).resize((160, 160), Image.LANCZOS)

def face(im, slug):
    a = np.array(im)[:, :, 3]
    if slug in FULL_FIGURE:
        ys, xs = np.where(a > 60); side = int(max(np.ptp(xs), np.ptp(ys)) * 1.02)
        return square(im, (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2 - side / 2, side)
    m = (a > 170).astype(float)
    if m.sum() < 100: m = (a > 60).astype(float)
    x0, y0, x1, y1 = pct(m.sum(0), .04), pct(m.sum(1), .01), pct(m.sum(0), .96), pct(m.sum(1), .99)
    W, H = x1 - x0, y1 - y0
    side = int(min(max(W * 0.95, H * 0.42), H * 0.75))
    cols = m[y0:y0 + int(side * 0.6), x0:x1].sum(0)
    cx = x0 + (np.average(np.arange(len(cols)), weights=cols) if cols.sum() else W / 2)
    return square(im, cx, y0 - side * 0.05, side)

def grid(im):
    a = np.array(im)[:, :, 3]; ys, xs = np.where(a > 60)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    PW, PH = COLS * 6, ROWS * 10
    s = min(PW / im.width, PH / im.height); nw, nh = max(1, int(im.width * s)), max(1, int(im.height * s))
    c = Image.new("RGBA", (PW, PH), (0, 0, 0, 0)); c.paste(im.resize((nw, nh), Image.LANCZOS), ((PW - nw) // 2, (PH - nh) // 2))
    arr = np.array(c).astype(float).reshape(ROWS, 10, COLS, 6, 4)
    al = arr[..., 3:4] / 255
    rgb = (arr[..., :3] * al).sum((1, 3)) / np.maximum(al.sum((1, 3)), 1e-6)
    alpha = al.mean((1, 3))[..., 0]
    q = lambda v: np.clip(np.round(v / 17), 0, 15).astype(int)
    R, G, B, A = q(rgb[..., 0]), q(rgb[..., 1]), q(rgb[..., 2]), q(alpha * 255)
    return "".join("%x%x%x%x" % (R[y, x], G[y, x], B[y, x], A[y, x]) for y in range(ROWS) for x in range(COLS))

os.makedirs(f"{ROOT}/public/heroes/face", exist_ok=True); os.makedirs(f"{ROOT}/public/heroes/full", exist_ok=True)
pfile = f"{ROOT}/lib/portraits.json"
P = json.load(open(pfile)) if os.path.exists(pfile) else {"cols": COLS, "rows": ROWS, "grids": {}}
for h in heroes:
    im = load(h["slug"])
    if im is None: print("нет картинки:", h["slug"]); continue
    face(im, h["slug"]).save(f"{ROOT}/public/heroes/face/{h['slug']}.webp", quality=86)
    a = np.array(im)[:, :, 3]; ys, xs = np.where(a > 60)
    full = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)); full.thumbnail((300, 320), Image.LANCZOS)
    full.save(f"{ROOT}/public/heroes/full/{h['slug']}.webp", quality=82)
    P["grids"][str(h["id"])] = grid(im)
json.dump(P, open(pfile, "w"))
print("готово")

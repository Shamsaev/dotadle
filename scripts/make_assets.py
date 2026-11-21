"""Портреты героев и сетки для режима «Портрет из символов».
Использование: python3 scripts/make_assets.py ПАПКА_С_ПОРТРЕТАМИ
В папке должны лежать официальные портреты героев <slug>.webp или <slug>.png (128×72 или больше),
slug — как в lib/heroes.json (например pudge, antimage, largo).
Нужны: pip install pillow numpy
"""
import json, os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
heroes = json.load(open(f"{ROOT}/lib/heroes.json", encoding="utf-8"))
C, R = 48, 16
os.makedirs(f"{ROOT}/public/heroes/p", exist_ok=True)
grids = {}
for h in heroes:
    path = next((f"{SRC}/{h['slug']}.{e}" for e in ("webp", "png", "jpg") if os.path.exists(f"{SRC}/{h['slug']}.{e}")), None)
    if not path: print("нет картинки:", h["slug"]); continue
    im = Image.open(path).convert("RGBA")
    im.convert("RGB").resize((128, 72), Image.LANCZOS).save(f"{ROOT}/public/heroes/p/{h['slug']}.webp", quality=90)
    arr = np.array(im.resize((C * 6, R * 10), Image.LANCZOS)).astype(float).reshape(R, 10, C, 6, 4)
    rgb = arr[..., :3].mean((1, 3)); a = arr[..., 3].mean((1, 3))
    q = lambda v: np.clip(np.round(v / 17), 0, 15).astype(int)
    r_, g_, b_, a_ = q(rgb[..., 0]), q(rgb[..., 1]), q(rgb[..., 2]), q(a)
    grids[str(h["id"])] = "".join("%x%x%x%x" % (r_[y, x], g_[y, x], b_[y, x], a_[y, x]) for y in range(R) for x in range(C))
json.dump({"cols": C, "rows": R, "grids": grids}, open(f"{ROOT}/lib/portraits.json", "w"))
print("готово")

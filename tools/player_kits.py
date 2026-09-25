"""Стикеры игроков в форме клубов (ADR-009): art/players/clubs/*.png → webapp/players/clubs/*.webp.

Исходники — картинки Midjourney 1024×1024: круглая наклейка с чёрным кольцом на сером фоне.
Для каждой: находим кольцо, режем круг чуть внутри него (контур рисует CSS), ищем на груди
ровный участок майки — туда мини-апп ставит номер, — и цвет цифр: белый на тёмной майке,
чёрный на светлой. Итог — art/players/kits.json, его читает build_data.py. Запускать руками после новых картинок:

    venv/bin/pip install pillow   # один раз: боту и мини-аппу Pillow не нужен
    venv/bin/python tools/player_kits.py
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / "art" / "players" / "clubs"
OUT = BASE / "webapp" / "players" / "clubs"
MANIFEST = BASE / "art" / "players" / "kits.json"   # клуб → роль → [где номер по высоте, цвет цифр]
SIZE = 192
DARK = 150   # сумма RGB ниже — это чёрный контур
WHITE = 243  # все каналы выше — белая вырубка наклейки


def circle(im: Image.Image) -> tuple[int, int, int]:
    """Центр и радиус круга наклейки. Наклейка — круг в белой вырубке; у части картинок внутри
    ещё чёрное кольцо. Заливаем от центра всё небелое: заливка упирается в белую вырубку.
    Круг даёт левый, правый и верхний край заливки; низ не берём — там белая майка может
    касаться вырубки."""
    k = 2   # заливаем на уменьшенной вдвое картинке
    small = im.resize((im.width // k, im.height // k))
    w, h = small.size
    px = small.load()
    inside = lambda x, y: min(px[x, y][:3]) < WHITE

    def fill(seed):
        seen = bytearray(w * h)
        stack = [seed]
        seen[seed[1] * w + seed[0]] = 1
        x0, x1, y0 = seed[0], seed[0], seed[1]
        while stack:
            x, y = stack.pop()
            x0, x1, y0 = min(x0, x), max(x1, x), min(y0, y)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and inside(nx, ny):
                    seen[ny * w + nx] = 1
                    stack.append((nx, ny))
        return x0, x1, y0

    # Центр картинки может попасть на мелочь (точку на белой маске) — пробуем несколько точек:
    # рядом с головой почти всегда фон круга. Берём самую широкую заливку
    seeds = [(int(w * fx), int(h * fy)) for fx, fy in ((0.5, 0.5), (0.28, 0.38), (0.72, 0.38), (0.5, 0.22))]
    x0, x1, y0 = max((fill(sd) for sd in seeds if inside(*sd)), key=lambda b: b[1] - b[0])
    r = (x1 - x0 + 1) * k / 2
    cx, cy = (x0 * k + r), (y0 * k + r)
    if x0 == 0 or y0 == 0 or x1 == w - 1:
        raise ValueError("заливка ушла за край: не нашёл белую вырубку вокруг круга")
    return round(cx), round(cy), round(r)


def ring(im: Image.Image, cx: int, cy: int, r: int) -> int:
    """Толщина чёрного кольца по краю круга, 0 — кольца нет."""
    px = im.load()
    for side in (-1, 1):
        t = 0
        x = cx + side * r - side * 2
        while t < 40 and sum(px[x - side * t, cy][:3]) < DARK:
            t += 1
        if t:
            return t + 2
    return 0


def lum(c) -> float:
    r, g, b = (v / 255 for v in c[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def chest(im: Image.Image) -> tuple[float, str, float]:
    """Середина самого длинного ровного участка майки по центру груди и цвет цифр."""
    w, h = im.size
    px = im.load()
    band = range(int(w * 0.44), int(w * 0.56))
    rows = []
    for y in range(int(h * 0.58), int(h * 0.97)):
        cs = [px[x, y][:3] for x in band]
        mean = tuple(sum(c[i] for c in cs) / len(cs) for i in range(3))
        spread = max(max(abs(c[i] - mean[i]) for i in range(3)) for c in cs)
        rows.append((y, mean, spread))
    best, run = (0, 0, None), []
    for y, mean, spread in rows:
        if spread < 28 and (not run or max(abs(mean[i] - run[-1][1][i]) for i in range(3)) < 22):
            run.append((y, mean))
        else:
            run = [(y, mean)] if spread < 28 else []
        if len(run) > best[1] - best[0]:
            best = (run[0][0], run[-1][0], run[len(run) // 2][1])
    y0, y1, color = best
    mid = (y0 + y1) / 2 / h
    return round(mid, 3), ("#ffffff" if lum(color) < 0.5 else "#000000"), (y1 - y0) / h


def process(path: Path) -> dict:
    im = Image.open(path).convert("RGB")
    try:
        cx, cy, r = circle(im)
    except ValueError as e:
        raise ValueError(f"{path.name}: {e}") from None
    r -= ring(im, cx, cy, r) + 3   # режем внутри кольца: контур 1px рисует CSS
    crop = im.crop((cx - r, cy - r, cx + r, cy + r))
    side = crop.width
    y, ink, room = chest(crop)
    out = crop.convert("RGBA")
    m = Image.new("L", (side * 4, side * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, side * 4 - 1, side * 4 - 1), fill=255)
    out.putalpha(m.resize((side, side), Image.LANCZOS))
    OUT.mkdir(parents=True, exist_ok=True)
    out.resize((SIZE, SIZE), Image.LANCZOS).save(OUT / f"{path.stem}.webp", quality=88, method=6)
    return {"y": y, "ink": ink, "room": round(room, 3)}


def main() -> None:
    kits: dict[str, dict] = {}
    for path in sorted(SRC.glob("*.png")):
        club, role = path.stem.rsplit("-", 1)
        info = process(path)
        kits.setdefault(club, {})[role] = [info["y"], info["ink"]]
        flag = "  ← мало места под номер" if info["room"] < 0.1 else ""
        print(f"{path.stem:28} номер y={info['y']:.2f} {info['ink']} место {info['room']:.2f}{flag}")
    MANIFEST.write_text(json.dumps(kits, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Клубов: {len(kits)} → {MANIFEST.relative_to(BASE)}")
    if any(len(v) != 2 for v in kits.values()):
        sys.exit("У некоторых клубов нет полевого или вратаря")


if __name__ == "__main__":
    main()

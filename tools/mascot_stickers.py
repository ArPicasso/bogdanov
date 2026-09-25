"""Проводники онбординга (ADR-011): листы Midjourney из art/mascots/ → webapp/mascots/<клуб>-<поза>.webp.

Исходник — лист 2×2 `art/mascots/<клуб>.png`: один талисман в четырёх позах на сером фоне. По умолчанию
слева вверху hello, справа вверху point, слева внизу cheer, справа внизу shrug. Midjourney перепутал
места — настоящий порядок в art/mascots/order.json: {"<клуб>": ["cheer", "point", "hello", "shrug"]}.
Можно положить и одну позу отдельно: `art/mascots/<клуб>-<поза>.png` — она заменит четверть листа.

Для каждой фигуры: заливкой от краёв убираем серый фон (упирается в белую вырубку или чёрный контур),
оставляем самую большую фигуру — обрезки соседних четвертей и крошки уходят, — режем по ней и кладём в
квадрат 288×288 WebP с прозрачностью. Запускать руками после новых картинок:

    venv/bin/pip install pillow   # один раз: боту и мини-аппу Pillow не нужен
    venv/bin/python tools/mascot_stickers.py
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / "art" / "mascots"
OUT = BASE / "webapp" / "mascots"
ORDER = SRC / "order.json"
POSES = ("hello", "point", "cheer", "shrug")
SIZE = 288      # в 3 раза больше самого крупного показа, 84×92 на экране выбора
WORK = 512      # маску считаем на картинке не больше этого: быстро, а край сглаживает увеличение
MARGIN = 0.03   # поле вокруг фигуры в готовом квадрате
EXT = (".png", ".jpg", ".jpeg", ".webp")


def background(im: Image.Image) -> tuple[int, int, int]:
    """Цвет фона — медиана пикселей рамки картинки."""
    w, h = im.size
    px = im.load()
    edge = [px[x, y] for x in range(0, w, 3) for y in (0, h - 1)] + [px[x, y] for y in range(0, h, 3) for x in (0, w - 1)]
    return tuple(sorted(c[i] for c in edge)[len(edge) // 2] for i in range(3))


def mask(im: Image.Image) -> tuple[Image.Image, bool]:
    """Маска фигуры и касается ли она края. Фон — всё, что залилось от краёв цветом, близким к фону.
    Допуск — меньше половины расстояния от фона до белого: белая вырубка фигуры в фон не уходит."""
    k = max(1, max(im.size) // WORK)
    small = im.resize((im.width // k, im.height // k))
    w, h = small.size
    px = small.load()
    bg = background(small)
    tol = min(40, max(12, (255 - min(bg)) * 0.45))
    near = lambda c: max(abs(c[0] - bg[0]), abs(c[1] - bg[1]), abs(c[2] - bg[2])) <= tol

    back = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    stack = [(x, y) for x, y in stack if near(px[x, y])]
    for x, y in stack:
        back[y * w + x] = 1
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not back[ny * w + nx] and near(px[nx, ny]):
                back[ny * w + nx] = 1
                stack.append((nx, ny))

    # Самый большой кусок не-фона — фигура. Остальное — крошки и края соседних фигур
    seen = bytearray(back)
    best, touches = [], False
    for start in range(w * h):
        if seen[start]:
            continue
        seen[start] = 1
        part, stack, edge = [], [start], False
        while stack:
            i = stack.pop()
            part.append(i)
            x, y = i % w, i // w
            edge = edge or x in (0, w - 1) or y in (0, h - 1)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and not seen[j]:
                    seen[j] = 1
                    stack.append(j)
        if len(part) > len(best):
            best, touches = part, edge
    if len(best) < w * h * 0.02:
        raise ValueError("не нашёл фигуру: фон не отделяется")

    m = bytearray(w * h)
    for i in best:
        m[i] = 255
    # Минус пиксель по краю: там смесь серого с белой вырубкой, она дала бы серую кайму
    out = Image.frombytes("L", (w, h), bytes(m)).filter(ImageFilter.MinFilter(3))
    return out.resize(im.size, Image.LANCZOS), touches


def sticker(im: Image.Image, dest: Path) -> tuple[int, bool]:
    """Вырезать фигуру и сохранить квадрат SIZE×SIZE. Возвращает размер файла и касание края."""
    alpha, touches = mask(im)
    fig = im.convert("RGBA")
    fig.putalpha(alpha)
    fig = fig.crop(alpha.getbbox())
    side = round(max(fig.size) * (1 + 2 * MARGIN))
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(fig, ((side - fig.width) // 2, (side - fig.height) // 2))
    # Уменьшаем с учётом прозрачности, иначе по краю вылезает цвет фона
    sq = sq.convert("RGBa").resize((SIZE, SIZE), Image.LANCZOS).convert("RGBA")
    sq.save(dest, "WEBP", quality=88, method=6)
    return dest.stat().st_size, touches


def sources(clubs: set[str]) -> dict[str, dict[str, Image.Image]]:
    """Клуб → поза → картинка: четверти листов и отдельные позы поверх них."""
    order = json.loads(ORDER.read_text(encoding="utf-8")) if ORDER.exists() else {}
    found: dict[str, dict[str, Image.Image]] = {}
    files = sorted(p for p in SRC.iterdir() if p.suffix.lower() in EXT)
    for path in files:   # сначала листы
        if path.stem not in clubs:
            continue
        im = Image.open(path).convert("RGB")
        w, h = im.size
        poses = order.get(path.stem, POSES)
        if sorted(poses) != sorted(POSES):
            sys.exit(f"order.json: у {path.stem} должны быть ровно позы {', '.join(POSES)}")
        boxes = ((0, 0, w // 2, h // 2), (w // 2, 0, w, h // 2), (0, h // 2, w // 2, h), (w // 2, h // 2, w, h))
        found[path.stem] = {pose: im.crop(box) for pose, box in zip(poses, boxes)}
    for path in files:   # потом отдельные позы
        club, _, pose = path.stem.rpartition("-")
        if club in clubs and pose in POSES:
            found.setdefault(club, {})[pose] = Image.open(path).convert("RGB")
        elif path.stem not in clubs:
            print(f"пропускаю {path.name}: не клуб из teams.json и не <клуб>-<поза>")
    return found


def main() -> None:
    clubs = {t["id"] for t in json.loads((BASE / "teams.json").read_text(encoding="utf-8"))}
    found = sources(clubs)
    if not found:
        sys.exit(f"В {SRC.relative_to(BASE)} нет листов <клуб>.png")
    OUT.mkdir(parents=True, exist_ok=True)
    problems = []
    for club in sorted(found):
        line = []
        for pose in POSES:
            if pose not in found[club]:
                problems.append(f"{club}: нет позы {pose}")
                continue
            try:
                size, touches = sticker(found[club][pose], OUT / f"{club}-{pose}.webp")
            except ValueError as e:
                problems.append(f"{club}-{pose}: {e}")
                continue
            line.append(f"{pose} {size // 1024} КБ" + (" ← у края" if touches else ""))
            if touches:
                problems.append(f"{club}-{pose}: фигура касается края четверти — проверьте, не обрезана ли")
        print(f"{club:18} " + ", ".join(line))
    print(f"Клубов: {len(found)} → {OUT.relative_to(BASE)}")
    if problems:
        print("\nПроверить:\n" + "\n".join(f"- {p}" for p in problems))


if __name__ == "__main__":
    main()

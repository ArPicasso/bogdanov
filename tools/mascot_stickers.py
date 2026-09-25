"""Проводники онбординга (ADR-011): листы Midjourney из art/mascots/ → webapp/mascots/<клуб>-<поза>.webp.

Исходник — лист 2×2 `art/mascots/<клуб>.png`: один талисман в четырёх позах на сером фоне. По умолчанию
слева вверху hello, справа вверху point, слева внизу cheer, справа внизу shrug. Midjourney путает места
и жесты, поэтому какая фигура листа идёт в какую позу — в art/mascots/poses.json:
{"<клуб>": {"hello": "BL", "point": "TR mirror", ...}} — TL, TR, BL, BR: слева/справа, вверху/внизу;
mirror — отзеркалить: в мини-аппе фигура стоит слева от облачка и показывать должна на него. Одна
фигура может пойти в две позы. Можно положить и одну позу отдельно: `art/mascots/<клуб>-<поза>.png` —
она заменит эту позу из листа.

Фигуры не режем по четвертям: клюшки и руки заходят в соседние. Заливкой от краёв убираем серый фон
(она упирается в белую вырубку или чёрный контур), берём четыре самые крупные фигуры и раскладываем по
местам сетки. Слиплись вырубками — разнимаем: сжимаем маску, пока фигуры не разойдутся, и отращиваем
каждую обратно. Каждую фигуру кладём в квадрат 288×288 WebP с прозрачностью. Запускать руками после
новых картинок:

    venv/bin/pip install pillow   # один раз: боту и мини-аппу Pillow не нужен
    venv/bin/python tools/mascot_stickers.py
"""
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / "art" / "mascots"
OUT = BASE / "webapp" / "mascots"
LAYOUT = SRC / "poses.json"
GRID = ("TL", "TR", "BL", "BR")
POSES = ("hello", "point", "cheer", "shrug")
SIZE = 288      # в 3 раза больше самого крупного показа, 84×92 на экране выбора
WORK = 512      # маску считаем на картинке не больше этого: быстро, а край сглаживает увеличение
MARGIN = 0.04   # поле вокруг фигуры в готовом квадрате: в него ложатся кайма и край
RIM = 0.018     # белая кайма по силуэту, доля стороны квадрата
EDGE = 0.006    # чёрный край снаружи каймы
SHADOW = 10     # насколько глубоко от фона дочищаем тень, пикселей на картинке WORK
EXT = (".png", ".jpg", ".jpeg", ".webp")


def background(im: Image.Image) -> tuple[int, int, int]:
    """Цвет фона — медиана пикселей рамки картинки."""
    w, h = im.size
    px = im.load()
    edge = [px[x, y] for x in range(0, w, 3) for y in (0, h - 1)] + [px[x, y] for y in range(0, h, 3) for x in (0, w - 1)]
    return tuple(sorted(c[i] for c in edge)[len(edge) // 2] for i in range(3))


def foreground(small: Image.Image) -> bytearray:
    """1 — фигура, 0 — фон. Фон — всё, что залилось от краёв цветом, близким к фону. Допуск — меньше
    половины расстояния от фона до белого: белая вырубка фигуры в фон не уходит."""
    w, h = small.size
    px = small.load()
    bg = background(small)
    tol = min(40, max(12, (255 - min(bg)) * 0.45))
    near = lambda c: max(abs(c[0] - bg[0]), abs(c[1] - bg[1]), abs(c[2] - bg[2])) <= tol
    fg = bytearray(b"\x01" * (w * h))
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    stack = [(x, y) for x, y in stack if near(px[x, y])]
    for x, y in stack:
        fg[y * w + x] = 0
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and fg[ny * w + nx] and near(px[nx, ny]):
                fg[ny * w + nx] = 0
                stack.append((nx, ny))

    # Карманы фона между фигурами: вырубки соседних наклеек сомкнулись, и заливка от краёв туда не
    # дошла. Карман — кусок цвета фона (с тенью от наклеек), обведённый белой вырубкой. Серое внутри
    # фигуры обведено чёрным контуром и цветом фона почти не бывает
    shade = lambda c: max(c) - min(c) < 28 and 60 < sum(c) / 3 < 236
    white = lambda c: min(c) > 225
    pocket = bytearray(fg[i] and (near(c := px[i % w, i // w]) or shade(c)) for i in range(w * h))
    for start in range(w * h):
        if not pocket[start]:
            continue
        pocket[start] = 0
        part, stack, rim = [start], [start], []
        while stack:
            i = stack.pop()
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if not (0 <= nx < w and 0 <= ny < h):
                    continue
                if pocket[j]:
                    pocket[j] = 0
                    part.append(j)
                    stack.append(j)
                elif fg[j] and not (near(c := px[nx, ny]) or shade(c)):
                    rim.append(white(c))
        flat = sum(near(px[i % w, i // w]) for i in part)
        if len(part) >= 24 and flat >= len(part) * 0.3 and rim and sum(rim) > len(rim) * 0.6:
            for i in part:
                fg[i] = 0

    # Midjourney кладёт под наклейку мягкую серую тень — на тёмной теме она вышла бы серым ореолом.
    # Дочищаем от фона серое без цвета, не заходя глубже SHADOW: белая вырубка и чёрный контур
    # тень останавливают, а серые места самой фигуры так далеко от фона не лежат
    front = deque(i for i in range(w * h) if not fg[i])
    dist = {i: 0 for i in front}
    while front:
        i = front.popleft()
        if dist[i] >= SHADOW:
            continue
        x, y = i % w, i // w
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            j = ny * w + nx
            if 0 <= nx < w and 0 <= ny < h and fg[j] and shade(px[nx, ny]):
                fg[j] = 0
                dist[j] = dist[i] + 1
                front.append(j)
    return fg


def parts(fg: bytes, w: int, h: int) -> list[list[int]]:
    """Связные куски маски, от крупных к мелким."""
    seen = bytearray(1 if v == 0 else 0 for v in fg)
    out = []
    for start in range(w * h):
        if seen[start]:
            continue
        seen[start] = 1
        part, stack = [], [start]
        while stack:
            i = stack.pop()
            part.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and not seen[j]:
                    seen[j] = 1
                    stack.append(j)
        out.append(part)
    return sorted(out, key=len, reverse=True)


def figures(im: Image.Image, n: int) -> tuple[list[Image.Image], list[str]]:
    """n фигур с картинки — маски в полный размер, по местам сетки (сверху вниз, слева направо),
    и замечания: фигура у края листа, фигуры слиплись."""
    k = max(1, max(im.size) // WORK)
    small = im.resize((im.width // k, im.height // k))
    w, h = small.size
    fg = foreground(small)
    big = w * h * (0.015 if n > 1 else 0.02)   # фигура на листе — около десятой части площади

    # Ядра: сжимаем маску, пока не найдётся n крупных кусков — слипшиеся вырубки расходятся
    mask = Image.frombytes("L", (w, h), bytes(v * 255 for v in fg))
    notes = []
    for step in range(30):
        cores = [p for p in parts(mask.tobytes(), w, h) if len(p) >= big][:n]
        if len(cores) == n:
            break
        mask = mask.filter(ImageFilter.MinFilter(3))
    else:
        if n != 4:
            raise ValueError("не нашёл фигуру: фон не отделяется")
        # Фигуры наложились широко и не расходятся — ядро каждой: её кусок в своей четверти листа
        full = Image.frombytes("L", (w, h), bytes(v * 255 for v in fg))
        cores = []
        for bx, by in ((0, 0), (w // 2, 0), (0, h // 2), (w // 2, h // 2)):
            q = full.crop((bx, by, bx + w // 2, by + h // 2))
            core = parts(q.tobytes(), q.width, q.height)[0]
            cores.append([(by + i // q.width) * w + bx + i % q.width for i in core])
        notes.append("фигуры наложились — разнял по четвертям, проверьте, где прошла граница")
    if 0 < step < 29:
        notes.append("фигуры касались друг друга — проверьте, где прошла граница")

    # Отращиваем ядра обратно по исходной маске: каждый пиксель — ближайшему ядру
    label = bytearray(w * h)
    queue = deque()
    for num, core in enumerate(cores, 1):
        for i in core:
            label[i] = num
            queue.append(i)
    while queue:
        i = queue.popleft()
        x, y = i % w, i // w
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            j = ny * w + nx
            if 0 <= nx < w and 0 <= ny < h and fg[j] and not label[j]:
                label[j] = label[i]
                queue.append(j)

    found = []
    for num in range(1, n + 1):
        own = bytes(255 if v == num else 0 for v in label)
        m = Image.frombytes("L", (w, h), own)
        x0, y0, x1, y1 = m.getbbox()
        if x0 == 0 or y0 == 0 or x1 == w or y1 == h:
            notes.append("фигура касается края листа — проверьте, не обрезана ли")
        # Минус пиксель по краю: там смесь серого с белой вырубкой, она дала бы серую кайму
        m = m.filter(ImageFilter.MinFilter(3)).resize(im.size, Image.LANCZOS)
        found.append(((y0 + y1) / 2, (x0 + x1) / 2, m))
    # По местам сетки: две верхние — по высоте, внутри ряда — слева направо
    found.sort(key=lambda f: f[0])
    rows = [found[:2], found[2:]] if n == 4 else [found]
    grid = [m for row in rows for _, _, m in sorted(row, key=lambda f: f[1])]
    return grid, notes


def sticker(im: Image.Image, alpha: Image.Image, side: int, mirror: bool, dest: Path) -> int:
    """Вырезать фигуру по маске и поставить в квадрат side×side (по центру, ногами на нижнее поле),
    сохранить SIZE×SIZE. side общий у всех поз клуба — талисман не меняет размер от позы к позе."""
    fig = im.convert("RGBA")
    fig.putalpha(alpha)
    fig = fig.crop(alpha.getbbox())
    pad = round(side * MARGIN)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(fig, ((side - fig.width) // 2, side - pad - fig.height))
    # Белая кайма и тонкий чёрный край по силуэту, как у Кэпа и стикеров бота: Midjourney рисует
    # вырубку не всегда, а без неё тёмная фигура теряется на тёмной теме. Где вырубка уже есть,
    # она становится чуть шире
    rim = sq.getchannel("A")
    for _ in range(max(1, round(side * RIM))):
        rim = rim.filter(ImageFilter.MaxFilter(3))
    edge = rim
    for _ in range(max(1, round(side * EDGE))):
        edge = edge.filter(ImageFilter.MaxFilter(3))
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    for color, alpha in (((0, 0, 0), edge), ((255, 255, 255), rim)):
        layer = Image.new("RGBA", (side, side), color + (0,))
        layer.putalpha(alpha)
        out = Image.alpha_composite(out, layer)
    sq = Image.alpha_composite(out, sq)
    # Уменьшаем с учётом прозрачности, иначе по краю вылезает цвет фона
    sq = sq.convert("RGBa").resize((SIZE, SIZE), Image.LANCZOS).convert("RGBA")
    if mirror:
        sq = ImageOps.mirror(sq)
    sq.save(dest, "WEBP", quality=88, method=6)
    return dest.stat().st_size


def main() -> None:
    clubs = {t["id"] for t in json.loads((BASE / "teams.json").read_text(encoding="utf-8"))}
    layout = json.loads(LAYOUT.read_text(encoding="utf-8")) if LAYOUT.exists() else {}
    files = sorted(p for p in SRC.iterdir() if p.suffix.lower() in EXT)
    jobs: dict[str, dict[str, tuple]] = {}   # клуб → поза → (картинка, маска, отзеркалить)
    problems = []
    # Сначала листы, потом отдельные позы поверх них
    for path in sorted(files, key=lambda p: p.stem not in clubs):
        club, _, pose = path.stem.rpartition("-")
        single = club in clubs and pose in POSES
        if path.stem not in clubs and not single:
            print(f"пропускаю {path.name}: не клуб из teams.json и не <клуб>-<поза>")
            continue
        im = Image.open(path).convert("RGB")
        try:
            masks, notes = figures(im, 1 if single else 4)
        except ValueError as e:
            problems.append(f"{path.name}: {e}")
            continue
        problems += [f"{path.name}: {note}" for note in dict.fromkeys(notes)]
        if single:
            jobs.setdefault(club, {})[pose] = (im, masks[0], False)
            continue
        for pose, default in zip(POSES, GRID):
            place, *flag = layout.get(path.stem, {}).get(pose, default).split()
            if place not in GRID or flag not in ([], ["mirror"]):
                sys.exit(f"poses.json: у {path.stem} {pose} — «{place} {' '.join(flag)}», ждал TL/TR/BL/BR и mirror")
            jobs.setdefault(path.stem, {}).setdefault(pose, (im, masks[GRID.index(place)], bool(flag)))
    if not jobs:
        sys.exit(f"В {SRC.relative_to(BASE)} нет листов <клуб>.png")

    OUT.mkdir(parents=True, exist_ok=True)
    for club in sorted(jobs):
        line = []
        boxes = [m.getbbox() for _, m, _ in jobs[club].values()]
        side = round(max(max(b[2] - b[0], b[3] - b[1]) for b in boxes) * (1 + 2 * MARGIN))
        for pose in POSES:
            if pose not in jobs[club]:
                problems.append(f"{club}: нет позы {pose}")
                continue
            im, mask, mirror = jobs[club][pose]
            size = sticker(im, mask, side, mirror, OUT / f"{club}-{pose}.webp")
            line.append(f"{pose} {size // 1024} КБ")
        print(f"{club:18} " + ", ".join(line))
    print(f"Клубов: {len(jobs)} → {OUT.relative_to(BASE)}")
    if problems:
        print("\nПроверить:\n" + "\n".join(f"- {p}" for p in problems))


if __name__ == "__main__":
    main()

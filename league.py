"""Протоколы матчей с сайта лиги: загрузка и разбор. См. docs/adr/001."""
import argparse
import asyncio
import json
import re
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

import aiohttp

BASE = Path(__file__).parent
TZ = ZoneInfo("Europe/Moscow")
RESULTS_FILE = BASE / "results.json"
SETTLE_DAYS = 3   # столько дней после матча протокол ещё перезапрашиваем: лига может его поправить
DEFAULT_SITE = "https://nmhl.fhr.ru"
DEFAULT_CLUB = "Рязань-ВДВ"
USER_AGENT = "ryazan-vdv-schedule-bot (+https://github.com/ArPicasso/bogdanov)"
PAUSE = 1.0

MONTHS = {m: i for i, m in enumerate(
    ["январь", "февраль", "март", "апрель", "май", "июнь", "июль",
     "август", "сентябрь", "октябрь", "ноябрь", "декабрь"], start=1)}

# ---------- мини-DOM поверх html.parser ----------

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "wbr"}


class Node:
    def __init__(self, tag: str, attrs: dict, parent: "Node | None"):
        self.tag, self.attrs, self.parent = tag, attrs, parent
        self.children: list["Node | str"] = []

    def classes(self) -> set[str]:
        return set((self.attrs.get("class") or "").split())

    def iter(self):
        for ch in self.children:
            if isinstance(ch, Node):
                yield ch
                yield from ch.iter()

    def find_all(self, tag: str | None = None, cls: str | None = None) -> list["Node"]:
        return [n for n in self.iter()
                if (tag is None or n.tag == tag) and (cls is None or cls in n.classes())]

    def find(self, tag: str | None = None, cls: str | None = None) -> "Node | None":
        found = self.find_all(tag, cls)
        return found[0] if found else None

    def text(self) -> str:
        parts = []

        def walk(n: Node):
            for ch in n.children:
                if isinstance(ch, str):
                    parts.append(ch)
                elif ch.tag == "br":
                    parts.append(" ")
                else:
                    walk(ch)
        walk(self)
        return re.sub(r"\s+", " ", "".join(parts)).strip()


class _TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = self.cur = Node("root", {}, None)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs), self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def parse_html(html: str) -> Node:
    b = _TreeBuilder()
    b.feed(html)
    b.close()
    return b.root

# ---------- модель ----------


@dataclass(frozen=True)
class Player:
    number: int | None
    name: str


@dataclass(frozen=True)
class Goal:
    period: str        # "1", "2", "3", "ОТ", "РБ" (победный буллит)
    time: str          # игровое время "18:06"
    score: str         # счёт после гола "0:1", хозяева первыми
    team: str          # "home" или "away"
    strength: str      # "рав.", "бол.", "мен.", "бул." или ""
    author: Player
    assists: tuple[Player, ...]


@dataclass(frozen=True)
class Protocol:
    game_id: int
    n: int             # номер матча в календаре лиги, он же ключ в games.json
    date: date
    time: str          # местное время арены, не МСК
    attendance: int | None
    home: str
    away: str
    home_score: int
    away_score: int
    decision: str      # "", "ОТ" или "Б"
    periods: tuple[tuple[int, int], ...]
    goals: tuple[Goal, ...]

    def to_json(self) -> dict:
        d = asdict(self)
        d["date"] = self.date.isoformat()
        return d

# ---------- разбор ----------

TITLE_RE = re.compile(r"Матч № (\d+)\.\s*(\d{1,2}) (\S+) (\d{4}),[^,]*,\s*(\d{1,2}:\d{2})")
SCORE_RE = re.compile(r"(\d+)\s*:\s*(\d+)\s*(ОТ|Б)?")
PAIR_RE = re.compile(r"(\d+):(\d+)")
PLAYER_RE = re.compile(r"^(?:(\d+)\.\s*)?(.+?)(?:\s*\(\d+\))?$")


def _player(cell: str) -> Player | None:
    m = PLAYER_RE.match(cell)
    if not cell or not m:
        return None
    return Player(int(m.group(1)) if m.group(1) else None, m.group(2).strip())


def _goals(table: Node) -> tuple[Goal, ...]:
    goals, prev = [], (0, 0)
    for tr in table.find_all("tr"):
        cells = [td.text() for td in tr.children if isinstance(td, Node) and td.tag == "td"]
        if len(cells) < 8:
            continue
        m = PAIR_RE.fullmatch(cells[3])
        author = _player(cells[5])
        if not m or not author:
            continue
        score = (int(m.group(1)), int(m.group(2)))
        team = "home" if score[0] > prev[0] else "away"
        prev = score
        assists = tuple(p for p in map(_player, cells[6:8]) if p)
        goals.append(Goal(cells[1], cells[2], cells[3], team, cells[4], author, assists))
    return tuple(goals)


def parse_protocol(html: str, game_id: int) -> Protocol | None:
    """None — протокола нет (матч не сыгран) или вёрстка незнакомая."""
    root = parse_html(html)
    title, count = root.find("div", "games_title"), root.find("p", "count")
    teams = [h.text() for t in root.find_all("table", "matches_protocol_main") for h in t.find_all("h2")]
    if not title or not count or len(teams) < 2:
        return None
    t = TITLE_RE.search(title.text())
    s = SCORE_RE.fullmatch(count.text())
    month = MONTHS.get(t.group(3).lower()) if t else None
    if not t or not s or not month:
        return None

    aud = root.find("p", "games_title_more")
    aud_m = re.search(r"(\d+)", aud.text()) if aud else None
    detail = root.find("div", "detail_count")
    periods = tuple((int(a), int(b)) for a, b in PAIR_RE.findall(detail.text())) if detail else ()
    goals_table = root.find("table", "matches_goals")

    return Protocol(
        game_id=game_id,
        n=int(t.group(1)),
        date=date(int(t.group(4)), month, int(t.group(2))),
        time=t.group(5),
        attendance=int(aud_m.group(1)) if aud_m else None,
        home=teams[0],
        away=teams[1],
        home_score=int(s.group(1)),
        away_score=int(s.group(2)),
        decision=s.group(3) or "",
        periods=periods,
        goals=_goals(goals_table) if goals_table else (),
    )


def parse_game_ids(html: str, tournament: int) -> list[int]:
    """Только из таблицы календаря: в ленте вверху страницы — матчи всей лиги."""
    href = re.compile(rf"/report/{tournament}/\?idgame=(\d+)")
    ids = [int(m.group(1))
           for td in parse_html(html).find_all("td", "col_count")
           for a in td.find_all("a")
           if (m := href.search(a.attrs.get("href") or ""))]
    return list(dict.fromkeys(ids))


def parse_club_ids(html: str, tournament: int) -> dict[str, int]:
    """Id клуба внутри сезона из фильтра календаря; каждый сезон он свой."""
    opts = re.findall(rf'value="/calendar/{tournament}/\d+/(\d+)/"[^>]*>([^<]+)', html)
    return {name.strip(): int(cid) for cid, name in opts if int(cid)}   # 0 — фильтр по месяцу


def parse_tournaments(html: str) -> list[tuple[int, str]]:
    """Турниры из выпадающего списка, новые первыми."""
    opts = re.findall(r'value="/calendar/(\d+)/"[^>]*>([^<]+)', html)
    return list(dict.fromkeys((int(i), name.strip()) for i, name in opts))

# ---------- загрузка ----------


async def _get(session: aiohttp.ClientSession, url: str) -> str:
    async with session.get(url) as r:
        r.raise_for_status()
        return await r.text()


async def fetch_protocols(site: str, tournament: int | None = None, club: str = DEFAULT_CLUB,
                          skip: set[int] = frozenset()) -> tuple[int, list[Protocol]]:
    """Скачивает протоколы клуба за турнир. Запросы идут по одному с паузой."""
    headers = {"User-Agent": USER_AGENT}
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(headers=headers, timeout=timeout, trust_env=True) as s:
        page = await _get(s, f"{site}/calendar/")
        if tournament is None:
            regular = [i for i, name in parse_tournaments(page) if "Регулярный" in name]
            if not regular:
                raise RuntimeError("не нашёл регулярный чемпионат в календаре лиги")
            tournament = regular[0]
            await asyncio.sleep(PAUSE)
            page = await _get(s, f"{site}/calendar/{tournament}/")
        clubs = {name: cid for name, cid in parse_club_ids(page, tournament).items() if club in name}
        if len(clubs) != 1:
            raise RuntimeError(f"клуб «{club}» в турнире {tournament}: найдено {list(clubs)}")
        await asyncio.sleep(PAUSE)
        cal = await _get(s, f"{site}/calendar/{tournament}/0/{next(iter(clubs.values()))}/")

        protocols = []
        for gid in parse_game_ids(cal, tournament):
            if gid in skip:
                continue
            await asyncio.sleep(PAUSE)
            p = parse_protocol(await _get(s, f"{site}/report/{tournament}/?idgame={gid}"), gid)
            if p and (club in p.home or club in p.away):
                protocols.append(p)
        return tournament, protocols


Results = dict[str, dict[str, dict]]   # id турнира → номер матча → протокол


def load_results(path: Path = RESULTS_FILE) -> Results:
    """Номера матчей в плей-офф начинаются заново, поэтому раскладка по турнирам."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return {}


def save_results(results: Results, path: Path = RESULTS_FILE) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(results, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


async def update_results(site: str, tournament: int | None, club: str, path: Path) -> list[Protocol]:
    results = load_results(path)
    settled = datetime.now(TZ).date() - timedelta(days=SETTLE_DAYS)
    known = {r["game_id"] for games in results.values() for r in games.values()
             if date.fromisoformat(r["date"]) < settled}
    tournament, fresh = await fetch_protocols(site, tournament, club, skip=known)
    games = results.setdefault(str(tournament), {})
    for p in fresh:
        games[str(p.n)] = p.to_json()
    save_results(results, path)
    return fresh


def main() -> None:
    ap = argparse.ArgumentParser(description="Скачать протоколы матчей клуба с сайта лиги в results.json")
    ap.add_argument("--site", default=DEFAULT_SITE)
    ap.add_argument("--tournament", type=int, help="id турнира; по умолчанию — последний регулярный чемпионат")
    ap.add_argument("--club", default=DEFAULT_CLUB, help="часть названия клуба")
    ap.add_argument("--out", type=Path, default=RESULTS_FILE)
    args = ap.parse_args()
    fresh = asyncio.run(update_results(args.site, args.tournament, args.club, args.out))
    for p in sorted(fresh, key=lambda p: p.date):
        print(f"{p.date} №{p.n} {p.home} {p.home_score}:{p.away_score} {p.decision} {p.away}".rstrip())
    print(f"Новых протоколов: {len(fresh)} → {args.out}")


if __name__ == "__main__":
    main()

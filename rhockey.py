"""Календарь турнира с r-hockey.ru. Временный источник до открытия rhl.fhr.ru (ADR-002)."""
import asyncio
import re
from dataclasses import dataclass
from datetime import date

import aiohttp

from league import PAUSE, USER_AGENT

SITE = "https://r-hockey.ru"
RHL_2026 = "/stat/temp/2027/30904"
SEASON_MONTHS = (10, 11, 12, 1, 2, 3)   # страница календаря отдаёт один месяц за раз

MON = {"янв": 1, "фев": 2, "мар": 3, "апр": 4, "май": 5, "мая": 5, "июн": 6, "июл": 7,
       "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12}


@dataclass(frozen=True)
class RawGame:
    rh_id: int
    date: date
    home_rh: int     # id команды на r-hockey
    away_rh: int


def _season_year(month: int, first_year: int) -> int:
    return first_year if month >= 7 else first_year + 1


ROW_RE = re.compile(r'<div class="middle aligned row match-data([^"]*)"')
TEAMS_RE = re.compile(r"\bteam-(\d+)\s+team-(\d+)\b")
LINK_RE = re.compile(r'/match/(\d+)-')
WHEN_RE = re.compile(r'match-time">\s*<span>\s*(\d{1,2}) (\w{3})')


def parse_month(html: str, first_year: int, tournament_id: int = 30904) -> list[RawGame]:
    """Строки календаря турнира. Разбор регулярками: вложенность div у вёрстки неровная."""
    games = []
    starts = list(ROW_RE.finditer(html))
    for i, m in enumerate(starts):
        cls = m.group(1).split()
        if f"trn-{tournament_id}" not in cls:
            continue
        block = html[m.end():starts[i + 1].start() if i + 1 < len(starts) else len(html)]
        teams, link, when = TEAMS_RE.search(m.group(1)), LINK_RE.search(block), WHEN_RE.search(block)
        if not teams or not link or not when or when.group(2) not in MON:
            continue
        month = MON[when.group(2)]
        games.append(RawGame(int(link.group(1)), date(_season_year(month, first_year), month, int(when.group(1))),
                             int(teams.group(1)), int(teams.group(2))))
    return games


async def fetch_season(tournament: str = RHL_2026, first_year: int = 2026) -> list[RawGame]:
    headers = {"User-Agent": USER_AGENT}
    games: dict[int, RawGame] = {}
    async with aiohttp.ClientSession(headers=headers, timeout=aiohttp.ClientTimeout(total=60),
                                     trust_env=True) as s:
        for month in SEASON_MONTHS:
            async with s.get(f"{SITE}{tournament}/calendar", params={"month": month}) as r:
                r.raise_for_status()
                for g in parse_month(await r.text(), first_year):
                    games[g.rh_id] = g
            await asyncio.sleep(PAUSE)
    return sorted(games.values(), key=lambda g: (g.date, g.rh_id))

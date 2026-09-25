"""Матчи прошлых сезонов НМХЛ для истории очных встреч (ADR-006). Результат — history.json."""
import argparse
import asyncio
import json
import re
from datetime import date
from pathlib import Path

import aiohttp

import league
from build_data import HISTORY_FILE, Teams, load_teams

SEASONS = 5

DATE_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{2})")
SCORE_RE = re.compile(r"(\d+):(\d+)\s*(ОТ|Б)?")
TOURNAMENT_RE = re.compile(r"^(\d{2}/\d{2}) \| (Регулярный чемпионат|Плей-офф)$")


def parse_calendar(html: str) -> list[dict]:
    """Сыгранные матчи со страницы календаря турнира. Технические результаты («-:+») пропускаем."""
    games = []
    for day in league.parse_html(html).find_all("tr"):
        cells = [ch for ch in day.children if isinstance(ch, league.Node) and ch.tag == "td"]
        if not cells or "date" not in cells[0].classes():
            continue
        m = DATE_RE.search(cells[0].text())
        if not m:
            continue
        when = date(2000 + int(m.group(3)), int(m.group(2)), int(m.group(1)))
        for row in day.find_all("tr"):
            team_td, count_td = row.find("td", "col_team"), row.find("td", "col_count")
            if not team_td or not count_td:
                continue
            names = [a.text() for a in team_td.find_all("a")]
            s = SCORE_RE.fullmatch(count_td.text())
            if len(names) != 2 or not s:
                continue
            games.append({"date": when.isoformat(), "home": names[0], "away": names[1],
                          "home_score": int(s.group(1)), "away_score": int(s.group(2)),
                          "decision": s.group(3) or ""})
    return games


def pick_tournaments(tournaments: list[tuple[int, str]], seasons: int) -> list[tuple[int, str]]:
    """Регулярка и плей-офф последних `seasons` сезонов: [(id, "25/26 | Плей-офф"), …]."""
    wanted = []
    for tid, name in tournaments:
        m = TOURNAMENT_RE.match(name)
        if m and m.group(1) not in wanted:
            wanted.append(m.group(1))
    keep = set(wanted[:seasons])
    return [(tid, name) for tid, name in tournaments
            if (m := TOURNAMENT_RE.match(name)) and m.group(1) in keep]


def to_history(teams: Teams, games: list[dict], season: str, stage: str) -> list[dict]:
    """Названия → id из teams.json; матчи с командами не из РХЛ-2026/27 отбрасываем."""
    out = []
    for g in games:
        home, away = teams.find_past(g["home"]), teams.find_past(g["away"])
        if home and away:
            out.append({"date": g["date"], "season": season, "stage": stage, "home": home, "away": away,
                        "score": [g["home_score"], g["away_score"]], "decision": g["decision"]})
    return out


async def fetch_history(site: str, teams: Teams, seasons: int = SEASONS) -> list[dict]:
    headers = {"User-Agent": league.USER_AGENT}
    async with aiohttp.ClientSession(headers=headers, timeout=aiohttp.ClientTimeout(total=60),
                                     trust_env=True) as s:
        chosen = pick_tournaments(league.parse_tournaments(await league._get(s, f"{site}/calendar/")), seasons)
        out = []
        for tid, name in chosen:
            await asyncio.sleep(league.PAUSE)
            season, stage = name.split(" | ")
            # «/0/» — все месяцы; без него плей-офф отдаёт только текущий месяц
            games = parse_calendar(await league._get(s, f"{site}/calendar/{tid}/0/"))
            out += to_history(teams, games, season, "playoff" if stage == "Плей-офф" else "regular")
            print(f"{name}: {len(games)} матчей")
    return sorted(out, key=lambda g: (g["date"], g["home"]))


def save_history(games: list[dict], path: Path = HISTORY_FILE) -> None:
    # по матчу на строку: так прошлые сезоны читаются в diff
    lines = ",\n".join(json.dumps(g, ensure_ascii=False) for g in games)
    path.write_text(f'{{"source": "nmhl.fhr.ru", "games": [\n{lines}\n]}}\n', encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description="Скачать матчи прошлых сезонов в history.json")
    ap.add_argument("--site", default=league.DEFAULT_SITE)
    ap.add_argument("--seasons", type=int, default=SEASONS)
    ap.add_argument("--out", type=Path, default=HISTORY_FILE)
    args = ap.parse_args()
    games = asyncio.run(fetch_history(args.site, load_teams(), args.seasons))
    save_history(games, args.out)
    print(f"Матчей между командами РХЛ: {len(games)} → {args.out}")


if __name__ == "__main__":
    main()

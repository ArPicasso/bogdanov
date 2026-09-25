"""Собирает webapp/data/league.json для мини-аппа: команды, матчи, результаты, таблица (ADR-002)."""
import argparse
import asyncio
import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import league
import rhockey

BASE = Path(__file__).parent
TZ = ZoneInfo("Europe/Moscow")
TEAMS_FILE = BASE / "teams.json"
OFFICIAL_GAMES = BASE / "games.json"
OFFICIAL_TEAM = "ryazan-vdv"          # у кого из команд есть официальный календарь — games.json
HISTORY_FILE = BASE / "history.json"
OUT = BASE / "webapp" / "data" / "league.json"
H2H_LAST = 5


def norm(name: str) -> str:
    name = name.lower().replace("ё", "е").replace("«", "").replace("»", "").replace('"', "")
    name = re.sub(r"\s*-\s*", "-", name)
    name = re.sub(r"^(мхк|хк)\s+", "", name.strip())
    return re.sub(r"\s+", " ", name)


class Teams:
    def __init__(self, teams: list[dict]):
        self.all = teams
        self.by_rh = {t["rhockey"]: t["id"] for t in teams}
        self.by_name = {norm(n): t["id"] for t in teams for n in [t["name"], *t["aliases"]]}
        self.by_former = {norm(n): t["id"] for t in teams for n in t.get("former", [])}

    def find(self, name: str) -> str | None:
        return self.by_name.get(norm(name))

    def find_past(self, name: str) -> str | None:
        """То же, но с прежними названиями клубов — для матчей прошлых сезонов (ADR-006)."""
        return self.find(name) or self.by_former.get(norm(name))


def load_teams(path: Path = TEAMS_FILE) -> Teams:
    return Teams(json.loads(path.read_text(encoding="utf-8")))

# ---------- матчи ----------


def official_games(teams: Teams, path: Path = OFFICIAL_GAMES) -> list[dict]:
    games = []
    for g in json.loads(path.read_text(encoding="utf-8")):
        opp = teams.find(g["opponent"])
        if opp is None:
            raise ValueError(f"соперник «{g['opponent']}» из games.json не найден в teams.json")
        home, away = (OFFICIAL_TEAM, opp) if g["home"] else (opp, OFFICIAL_TEAM)
        games.append({"id": f"n{g['n']}", "n": g["n"], "date": g["date"], "home": home, "away": away,
                      "official": True})
    return games


def merge_calendar(teams: Teams, raw: list[rhockey.RawGame], official: list[dict]) -> list[dict]:
    """Официальный календарь заменяет агрегатор для своих команд."""
    covered = {OFFICIAL_TEAM}
    games = list(official)
    for g in raw:
        home, away = teams.by_rh[g.home_rh], teams.by_rh[g.away_rh]
        if home in covered or away in covered:
            continue
        games.append({"id": f"rh{g.rh_id}", "n": None, "date": g.date.isoformat(), "home": home, "away": away,
                      "official": False})
    return sorted(games, key=lambda g: (g["date"], g["id"]))

# ---------- результаты ----------


def attach_results(games: list[dict], teams: Teams, results: league.Results) -> list[str]:
    """Протоколы лиги ложатся на матчи по дате и командам. Возвращает непривязанные."""
    index = {(g["date"], g["home"], g["away"]): g for g in games}
    unmatched = []
    for tournament in results.values():
        for p in tournament.values():
            home, away = teams.find(p["home"]), teams.find(p["away"])
            g = index.get((p["date"], home, away))
            if g is None:
                unmatched.append(f"{p['date']} {p['home']} — {p['away']}")
                continue
            g["n"] = g["n"] or p["n"]
            g["time"] = p["time"]
            g["attendance"] = p["attendance"]
            g["score"] = {"home": p["home_score"], "away": p["away_score"], "decision": p["decision"],
                          "periods": p["periods"]}
            g["goals"] = [{"period": x["period"], "time": x["time"], "team": x["team"], "score": x["score"],
                           "strength": x["strength"], "author": x["author"]["name"],
                           "assists": [a["name"] for a in x["assists"]]} for x in p["goals"]]
    return unmatched

# ---------- таблица ----------


@dataclass
class Row:
    team: str
    gp: int = 0
    w: int = 0      # в основное время
    otw: int = 0
    sow: int = 0
    sol: int = 0
    otl: int = 0
    l: int = 0
    gf: int = 0
    ga: int = 0
    form: list[str] = field(default_factory=list)

    @property
    def pts(self) -> int:
        return 2 * (self.w + self.otw + self.sow) + self.sol + self.otl

    def to_json(self) -> dict:
        return {"team": self.team, "gp": self.gp, "w": self.w, "otw": self.otw, "sow": self.sow,
                "sol": self.sol, "otl": self.otl, "l": self.l, "gf": self.gf, "ga": self.ga,
                "pts": self.pts, "form": self.form[-5:]}


def standings(teams: Teams, games: list[dict]) -> dict[str, list[dict]]:
    """Правила лиги: победа — 2, поражение в ОТ или по буллитам — 1. Сверено с таблицей НМХЛ 25/26."""
    rows = {t["id"]: Row(t["id"]) for t in teams.all}
    for g in sorted((g for g in games if g.get("score")), key=lambda g: g["date"]):
        s = g["score"]
        for side, gf, ga in (("home", s["home"], s["away"]), ("away", s["away"], s["home"])):
            r = rows[g[side]]
            r.gp += 1
            r.gf += gf
            r.ga += ga
            won = gf > ga
            if s["decision"] == "ОТ":
                r.otw += won
                r.otl += not won
            elif s["decision"] == "Б":
                r.sow += won
                r.sol += not won
            else:
                r.w += won
                r.l += not won
            r.form.append("W" if won else "L")
    conf = {t["id"]: t["conf"] for t in teams.all}
    table: dict[str, list[dict]] = {"west": [], "east": []}
    for r in sorted(rows.values(), key=lambda r: (-r.pts, -r.w, -(r.gf - r.ga), -r.gf)):
        table[conf[r.team]].append(r.to_json())
    return table

# ---------- очные встречи ----------


def load_history(path: Path = HISTORY_FILE) -> list[dict]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))["games"]
    except (FileNotFoundError, ValueError, KeyError):
        return []


def pair_key(a: str, b: str) -> str:
    return "|".join(sorted((a, b)))


def head_to_head(games: list[dict], history: list[dict]) -> dict[str, dict]:
    """Для каждой пары из календаря сезона: победы, голы и последние встречи (ADR-006).

    Встречи — прошлые сезоны из history.json плюс уже сыгранные матчи этого сезона."""
    past = [{k: h[k] for k in ("date", "home", "away", "score", "decision")} for h in history]
    past += [{"date": g["date"], "home": g["home"], "away": g["away"],
              "score": [g["score"]["home"], g["score"]["away"]], "decision": g["score"]["decision"]}
             for g in games if g.get("score")]
    by_pair: dict[str, list[dict]] = {}
    for m in sorted(past, key=lambda m: m["date"]):
        by_pair.setdefault(pair_key(m["home"], m["away"]), []).append(m)
    out = {}
    for key in sorted({pair_key(g["home"], g["away"]) for g in games}):
        a, b = key.split("|")
        wins, goals = {a: 0, b: 0}, {a: 0, b: 0}
        meetings = by_pair.get(key, [])
        for m in meetings:
            hs, as_ = m["score"]
            goals[m["home"]] += hs
            goals[m["away"]] += as_
            wins[m["home"] if hs > as_ else m["away"]] += 1
        out[key] = {"games": len(meetings), "wins": wins, "goals": goals,
                    "since": meetings[0]["date"][:4] if meetings else None,
                    "last": meetings[::-1][:H2H_LAST]}
    return out

# ---------- сборка ----------


BOT_LINK = "https://t.me/rhl_u21_bot"
APP_LINK = "https://t.me/rhl_u21_bot/myapp"


def links(env=os.environ) -> dict[str, str]:
    """Ссылки на бота и мини-апп в Telegram (ADR-004). Переменные окружения заменяют ссылки по умолчанию."""
    out = {"bot": (env.get("BOT_LINK") or BOT_LINK).strip(), "app": (env.get("APP_LINK") or APP_LINK).strip()}
    return {k: v.rstrip("/") for k, v in out.items() if v.startswith("https://t.me/")}


def build(teams: Teams, raw: list[rhockey.RawGame], results: league.Results) -> tuple[dict, list[str]]:
    games = merge_calendar(teams, raw, official_games(teams))
    unmatched = attach_results(games, teams, results)
    data = {
        "season": "2026/27",
        "league": "РХЛ — Первенство России U21",
        "updated": datetime.now(TZ).isoformat(timespec="minutes"),
        "sources": {
            "calendar": "ФХР (официально) для «Рязань-ВДВ», r-hockey.ru (неофициально) для остальных",
            "results": "протоколы лиги",
        },
        "links": links(),
        "teams": [{k: t[k] for k in ("id", "abbr", "name", "city", "conf", "logo") if k in t} for t in teams.all],
        "games": games,
        "standings": standings(teams, games),
    }
    return data, unmatched


def main() -> None:
    ap = argparse.ArgumentParser(description="Собрать webapp/data/league.json")
    ap.add_argument("--results", type=Path, default=league.RESULTS_FILE)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    teams = load_teams()
    raw = asyncio.run(rhockey.fetch_season())
    data, unmatched = build(teams, raw, league.load_results(args.results))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    h2h = head_to_head(data["games"], load_history())
    (args.out.parent / "h2h.json").write_text(json.dumps(h2h, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    played = sum(1 for g in data["games"] if g.get("score"))
    print(f"Матчей: {len(data['games'])}, сыграно: {played} → {args.out}")
    for u in unmatched:
        print("Протокол не привязан к матчу:", u)


if __name__ == "__main__":
    main()

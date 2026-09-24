"""Сборка данных лиги для мини-аппа: календарь r-hockey, справочник команд, таблица."""
import json
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_data as b  # noqa: E402
import rhockey  # noqa: E402

FIX = Path(__file__).parent / "fixtures"


class RHockeyCalendar(unittest.TestCase):
    def test_month_page(self):
        games = rhockey.parse_month((FIX / "rhockey_rhl_2026_10.html").read_text(encoding="utf-8"), 2026)
        self.assertEqual(len(games), 12)
        self.assertEqual(games[0], rhockey.RawGame(9319019, date(2026, 10, 3), 2916, 2914))

    def test_other_tournament_rows_skipped(self):
        html = (FIX / "rhockey_rhl_2026_10.html").read_text(encoding="utf-8")
        self.assertEqual(rhockey.parse_month(html, 2026, tournament_id=1), [])

    def test_season_crosses_new_year(self):
        self.assertEqual(rhockey._season_year(12, 2026), 2026)
        self.assertEqual(rhockey._season_year(1, 2026), 2027)


class TeamNames(unittest.TestCase):
    teams = b.load_teams()

    def test_26_teams_in_two_conferences(self):
        confs = [t["conf"] for t in self.teams.all]
        self.assertEqual((confs.count("west"), confs.count("east")), (13, 13))

    def test_spellings_from_all_sources(self):
        cases = {
            "МХК Рязань-ВДВ": "ryazan-vdv",       # протоколы лиги
            "ХК Сокол ЧР": "sokol",
            "МХК Кристалл С": "kristall",
            "Полет": "polet",                     # r-hockey без ё
            "Тверичи - СШОР": "tverichi",         # официальный состав ФХР
            "Ростов": "rostov",                   # games.json
            "ХК Краснодар": "krasnodar",
        }
        for name, team in cases.items():
            self.assertEqual(self.teams.find(name), team, name)

    def test_every_rhockey_id_is_known(self):
        self.assertEqual(len(self.teams.by_rh), 26)


class Calendar(unittest.TestCase):
    teams = b.load_teams()

    def test_official_games(self):
        games = b.official_games(self.teams)
        self.assertEqual(len(games), 48)
        self.assertEqual(sum(g["home"] == "ryazan-vdv" for g in games), 24)
        self.assertEqual(games[0], {"id": "n1", "n": 1, "date": "2026-10-03", "home": "ryazan-vdv",
                                    "away": "belgorod", "official": True})

    def test_official_calendar_replaces_aggregator(self):
        raw = rhockey.parse_month((FIX / "rhockey_rhl_2026_10.html").read_text(encoding="utf-8"), 2026)
        games = b.merge_calendar(self.teams, raw, b.official_games(self.teams))
        ryazan = [g for g in games if "ryazan-vdv" in (g["home"], g["away"])]
        self.assertEqual(len(ryazan), 48)
        self.assertTrue(all(g["official"] for g in ryazan))
        ryazan_rh = sum(2916 in (g.home_rh, g.away_rh) for g in raw)
        self.assertEqual(len(games), 48 + len(raw) - ryazan_rh)


class Standings(unittest.TestCase):
    def test_matches_official_table_2025_26(self):
        # таблица НМХЛ 2025/26, Восток: Рязань-ВДВ 48 игр, 40-4-1-1-1-1, 192-69, 92 очка
        results = json.loads((FIX / "results_1378_ryazan.json").read_text(encoding="utf-8"))
        protocols = results["1378"].values()
        names = sorted({n for p in protocols for n in (p["home"], p["away"])})
        teams = b.Teams([{"id": b.norm(n), "name": n, "city": "", "conf": "east", "rhockey": i, "aliases": []}
                         for i, n in enumerate(names)])
        games = [{"id": k, "n": None, "date": p["date"], "home": b.norm(p["home"]), "away": b.norm(p["away"]),
                  "official": True} for k, p in results["1378"].items()]
        self.assertEqual(b.attach_results(games, teams, results), [])
        top = b.standings(teams, games)["east"][0]
        self.assertEqual({k: top[k] for k in ("team", "gp", "w", "otw", "sow", "sol", "otl", "l", "gf", "ga", "pts")},
                         {"team": "рязань-вдв", "gp": 48, "w": 40, "otw": 4, "sow": 1, "sol": 1, "otl": 1, "l": 1,
                          "gf": 192, "ga": 69, "pts": 92})


if __name__ == "__main__":
    unittest.main()


class Links(unittest.TestCase):
    def test_only_telegram_links(self):
        env = {"BOT_LINK": "https://t.me/rhl_bot/", "APP_LINK": "http://evil.example/app"}
        self.assertEqual(b.links(env), {"bot": "https://t.me/rhl_bot"})

    def test_empty(self):
        self.assertEqual(b.links({}), {})

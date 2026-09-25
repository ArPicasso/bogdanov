"""История очных встреч (ADR-006): разбор архива календарей и подсчёт по парам."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_data as b  # noqa: E402
import history  # noqa: E402
import league  # noqa: E402

FIX = Path(__file__).parent / "fixtures"


def fixture(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


class CalendarArchive(unittest.TestCase):
    games = history.parse_calendar(fixture("calendar_1379_all.html"))

    def test_whole_playoff_2025_26(self):
        self.assertEqual(len(self.games), 53)
        self.assertEqual(self.games[0], {"date": "2026-03-28", "home": "МХК Ермак", "away": "Прогресс",
                                         "home_score": 5, "away_score": 4, "decision": "Б"})

    def test_final_game(self):
        self.assertEqual(self.games[-1]["date"], "2026-05-13")
        self.assertEqual((self.games[-1]["home"], self.games[-1]["away"]), ("Металлург ВО", "Гранит-Чехов"))

    def test_overtime_and_shootout(self):
        self.assertEqual(sorted({g["decision"] for g in self.games}), ["", "Б", "ОТ"])

    def test_club_page_parses_too(self):
        games = history.parse_calendar(fixture("calendar_1378_ryazan.html"))
        self.assertTrue(all("Рязань" in g["home"] + g["away"] for g in games))
        self.assertEqual(games[0]["date"], "2025-10-04")

    def test_last_seasons_regular_and_playoff(self):
        picked = history.pick_tournaments(league.parse_tournaments(fixture("calendar_index.html")), 2)
        self.assertEqual([name for _, name in picked],
                         ["25/26 | Плей-офф", "25/26 | Регулярный чемпионат",
                          "24/25 | Плей-офф", "24/25 | Регулярный чемпионат"])


class FormerNames(unittest.TestCase):
    teams = b.load_teams()

    def test_renamed_clubs_keep_history(self):
        self.assertEqual(self.teams.find_past("Гранит-Чехов"), "akhmat-granit")
        self.assertEqual(self.teams.find_past("ХК Гранит"), "akhmat-granit")
        self.assertEqual(self.teams.find_past("Воевода"), "vityaz-podolsk")

    def test_former_names_not_used_for_current_season(self):
        self.assertIsNone(self.teams.find("Воевода"))

    def test_clubs_outside_league_dropped(self):
        games = [{"date": "2026-01-01", "home": "МХК Липецк", "away": "МХК Рязань-ВДВ",
                  "home_score": 1, "away_score": 2, "decision": ""},
                 {"date": "2026-01-02", "home": "Воевода", "away": "МХК Рязань-ВДВ",
                  "home_score": 3, "away_score": 2, "decision": "ОТ"}]
        out = history.to_history(self.teams, games, "25/26", "regular")
        self.assertEqual([(g["home"], g["away"], g["score"]) for g in out],
                         [("vityaz-podolsk", "ryazan-vdv", [3, 2])])


class HeadToHead(unittest.TestCase):
    past = [
        {"date": "2024-10-01", "home": "ryazan-vdv", "away": "belgorod", "score": [3, 1], "decision": ""},
        {"date": "2024-11-01", "home": "belgorod", "away": "ryazan-vdv", "score": [4, 3], "decision": "Б"},
        {"date": "2025-10-01", "home": "belgorod", "away": "ryazan-vdv", "score": [0, 2], "decision": ""},
    ]
    season = [
        {"date": "2026-10-03", "home": "ryazan-vdv", "away": "belgorod"},
        {"date": "2026-10-10", "home": "ryazan-vdv", "away": "tambov",
         "score": {"home": 2, "away": 1, "decision": "ОТ"}},
    ]
    h2h = b.head_to_head(season, past)

    def test_only_pairs_from_this_season(self):
        self.assertEqual(sorted(self.h2h), ["belgorod|ryazan-vdv", "ryazan-vdv|tambov"])

    def test_wins_and_goals_across_home_and_away(self):
        h = self.h2h["belgorod|ryazan-vdv"]
        self.assertEqual(h["games"], 3)
        self.assertEqual(h["wins"], {"ryazan-vdv": 2, "belgorod": 1})
        self.assertEqual(h["goals"], {"ryazan-vdv": 8, "belgorod": 5})
        self.assertEqual(h["since"], "2024")

    def test_last_meetings_newest_first(self):
        self.assertEqual([m["date"] for m in self.h2h["belgorod|ryazan-vdv"]["last"]],
                         ["2025-10-01", "2024-11-01", "2024-10-01"])

    def test_played_games_of_this_season_count(self):
        h = self.h2h["ryazan-vdv|tambov"]
        self.assertEqual((h["games"], h["wins"]["ryazan-vdv"], h["last"][0]["decision"]), (1, 1, "ОТ"))

    def test_history_file_is_readable(self):
        games = b.load_history()
        self.assertGreater(len(games), 1000)
        ids = {t["id"] for t in b.load_teams().all}
        self.assertTrue(all(g["home"] in ids and g["away"] in ids for g in games))


if __name__ == "__main__":
    unittest.main()

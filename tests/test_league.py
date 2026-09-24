"""Разбор страниц сайта лиги. Фикстуры — реальные страницы nmhl.fhr.ru, сезон 2025/26."""
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import league  # noqa: E402
from league import Goal, Player  # noqa: E402

FIX = Path(__file__).parent / "fixtures"


def fixture(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


class RegularTimeProtocol(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = league.parse_protocol(fixture("protocol_900942_regular.html"), 900942)

    def test_header(self):
        p = self.p
        self.assertEqual((p.game_id, p.n, p.date, p.time, p.attendance),
                         (900942, 4, date(2025, 10, 4), "17:00", 259))
        self.assertEqual((p.home, p.away), ("МХК Рязань-ВДВ", "МХК Белгород"))

    def test_score(self):
        p = self.p
        self.assertEqual((p.home_score, p.away_score, p.decision), (6, 1, ""))
        self.assertEqual(p.periods, ((0, 1), (5, 0), (1, 0)))

    def test_goals(self):
        goals = self.p.goals
        self.assertEqual(len(goals), 7)
        self.assertEqual(goals[0], Goal("1", "18:06", "0:1", "away", "рав.",
                                        Player(23, "Щербаков Артём Ан."), (Player(89, "Рудаков Матвей"),)))
        self.assertEqual(goals[2].assists, (Player(12, "Романов Павел"), Player(68, "Михеев Яромир")))
        self.assertEqual(goals[5].strength, "бол.")

    def test_goals_add_up_to_score(self):
        home = sum(g.team == "home" for g in self.p.goals)
        self.assertEqual((home, len(self.p.goals) - home), (6, 1))


class OvertimeProtocol(unittest.TestCase):
    def test_away_win_in_overtime(self):
        p = league.parse_protocol(fixture("protocol_901016_ot.html"), 901016)
        self.assertEqual((p.n, p.home, p.away), (78, "ХК Самара", "МХК Рязань-ВДВ"))
        self.assertEqual((p.home_score, p.away_score, p.decision), (5, 6, "ОТ"))
        self.assertEqual(p.periods, ((0, 2), (1, 1), (4, 2), (0, 1)))
        last = p.goals[-1]
        self.assertEqual((last.period, last.team, last.score, last.author), ("ОТ", "away", "5:6", Player(68, "Михеев Яромир")))


class ShootoutProtocol(unittest.TestCase):
    def test_shootout_winner(self):
        p = league.parse_protocol(fixture("protocol_901033_shootout.html"), 901033)
        self.assertEqual((p.n, p.home_score, p.away_score, p.decision), (95, 4, 3, "Б"))
        self.assertEqual(p.periods, ((2, 0), (0, 1), (1, 2), (0, 0), (1, 0)))
        last = p.goals[-1]
        self.assertEqual((last.period, last.team, last.assists), ("РБ", "home", ()))


class NotAProtocol(unittest.TestCase):
    def test_unknown_page_gives_none(self):
        self.assertIsNone(league.parse_protocol("<html><body>Страница не найдена</body></html>", 1))

    def test_calendar_page_gives_none(self):
        self.assertIsNone(league.parse_protocol(fixture("calendar_index.html"), 1))


class Calendar(unittest.TestCase):
    def test_game_ids_of_club(self):
        ids = league.parse_game_ids(fixture("calendar_1378_ryazan.html"), 1378)
        self.assertEqual(len(ids), 48)
        self.assertEqual(len(set(ids)), 48)
        self.assertIn(900942, ids)

    def test_ticker_games_are_ignored(self):
        # в ленте вверху страницы — матчи всей лиги того же турнира (901906 — Ермак — Бобров)
        ids = league.parse_game_ids(fixture("calendar_1379_ryazan_playoff.html"), 1379)
        self.assertEqual(ids, [901740, 901748, 901756, 901846, 901850, 901854,
                               901925, 901927, 901929, 901941])
        self.assertNotIn(901906, ids)

    def test_club_ids(self):
        clubs = league.parse_club_ids(fixture("calendar_1378_ryazan.html"), 1378)
        self.assertEqual(clubs["МХК Рязань-ВДВ"], 15336)
        self.assertNotIn(0, clubs.values())

    def test_tournaments_newest_first(self):
        t = league.parse_tournaments(fixture("calendar_index.html"))
        self.assertEqual(t[:3], [(1425, "Кубок Поколения 2026"), (1379, "25/26 | Плей-офф"),
                                 (1378, "25/26 | Регулярный чемпионат")])


class ResultsFile(unittest.TestCase):
    def test_roundtrip_is_json(self):
        p = league.parse_protocol(fixture("protocol_900942_regular.html"), 900942)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "results.json"
            league.save_results({"1378": {str(p.n): p.to_json()}}, path)
            data = league.load_results(path)["1378"]
        self.assertEqual(data["4"]["date"], "2025-10-04")
        self.assertEqual(data["4"]["goals"][0]["author"], {"number": 23, "name": "Щербаков Артём Ан."})
        json.dumps(data)

    def test_missing_file_is_empty(self):
        self.assertEqual(league.load_results(Path("/nonexistent/results.json")), {})


if __name__ == "__main__":
    unittest.main()

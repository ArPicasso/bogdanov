"""Онбординг бота (ADR-005): тексты, кнопки и стикеры — без Telegram и без токена."""
import json
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import bot  # noqa: E402


class AppUrl(unittest.TestCase):
    def test_team_added_to_query(self):
        with mock.patch.object(bot, "WEBAPP_URL", "https://x.github.io/app/?v=2"):
            self.assertEqual(bot.app_url("ryazan-vdv"), "https://x.github.io/app/?v=2&team=ryazan-vdv")
            self.assertEqual(bot.app_url(), "https://x.github.io/app/?v=2")

    def test_one_button_opens_app(self):
        with mock.patch.object(bot, "WEBAPP_URL", "https://x.github.io/app/"):
            kb = bot.app_kb("arktika").inline_keyboard
        self.assertEqual(len(kb), 1)
        self.assertEqual(len(kb[0]), 1)
        self.assertEqual(kb[0][0].web_app.url, "https://x.github.io/app/?team=arktika")

    def test_app_url_has_default(self):
        self.assertTrue(bot.WEBAPP_URL.startswith("https://"))

    def test_no_old_schedule_menu(self):
        src = (ROOT / "bot.py").read_text(encoding="utf-8")
        for old in ("ReplyKeyboardMarkup", "set_my_commands", "Следующая игра", "calendar.pdf"):
            self.assertNotIn(old, src)


class Welcome(unittest.TestCase):
    def test_team_named_in_greeting(self):
        self.assertIn(bot.TEAMS["arktika"], bot.welcome_text("arktika"))

    def test_generic_greeting_points_to_button(self):
        self.assertIn("Открыть РХЛ", bot.welcome_text())

    def test_greeting_is_valid_html(self):
        tags = re.findall(r"</?(\w+)>", bot.welcome_text("arktika"))
        self.assertEqual(tags.count("b") % 2, 0)

    def test_description_limits(self):
        self.assertLessEqual(len(bot.DESCRIPTION), 512)
        self.assertLessEqual(len(bot.SHORT_DESCRIPTION), 120)


class Stickers(unittest.TestCase):
    def test_every_sticker_used_in_bot_exists(self):
        names = set(re.findall(r'send_sticker\([^)]*"(\w+)"', (ROOT / "bot.py").read_text(encoding="utf-8")))
        self.assertEqual(names, {"hello", "tap", "bell", "gameday"})
        for n in names:
            data = (bot.STICKERS / f"{n}.webp").read_bytes()
            self.assertEqual(data[:4] + data[8:12], b"RIFFWEBP", n)
            self.assertLess(len(data), 512 * 1024, n)   # лимит Telegram на статичный стикер

    def test_emoji_set(self):
        icons = json.loads((bot.STICKERS / "emoji.json").read_text(encoding="utf-8"))
        self.assertLessEqual(len(icons), 200)   # лимит набора кастомных эмодзи
        for n in icons:
            data = (bot.STICKERS / "emoji" / f"{n}.webp").read_bytes()
            self.assertEqual(data[:4] + data[8:12], b"RIFFWEBP", n)


if __name__ == "__main__":
    unittest.main()

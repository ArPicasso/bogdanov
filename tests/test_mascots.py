"""Картинки проводников онбординга (ADR-011): tools/mascot_stickers.py → webapp/mascots/."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSES = {"hello", "point", "cheer", "shrug"}


class MascotStickers(unittest.TestCase):
    def test_every_club_has_all_poses(self):
        clubs = {t["id"] for t in json.loads((ROOT / "teams.json").read_text(encoding="utf-8"))}
        found: dict[str, set[str]] = {}
        for path in (ROOT / "webapp" / "mascots").glob("*.webp"):
            club, _, pose = path.stem.rpartition("-")
            self.assertIn(club, clubs, path.name)
            self.assertIn(pose, POSES, path.name)
            found.setdefault(club, set()).add(pose)
        for club, poses in found.items():
            self.assertEqual(poses, POSES, club)

    def test_every_sheet_is_cut(self):
        clubs = {t["id"] for t in json.loads((ROOT / "teams.json").read_text(encoding="utf-8"))}
        sheets = {p.stem for p in (ROOT / "art" / "mascots").glob("*.png")} & clubs   # лист — <клуб>.png
        cut = {p.stem.rpartition("-")[0] for p in (ROOT / "webapp" / "mascots").glob("*.webp")}
        self.assertEqual(sheets, cut, "лист есть, а картинок нет — запустите tools/mascot_stickers.py")


if __name__ == "__main__":
    unittest.main()

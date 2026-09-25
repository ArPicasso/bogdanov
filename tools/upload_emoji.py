"""Публикует эмодзи stickers/emoji/*.webp набором кастомных эмодзи Telegram (ADR-005).

    BOT_TOKEN=... OWNER_ID=<твой Telegram id> venv/bin/python tools/upload_emoji.py

OWNER_ID — владелец набора, человек: он должен хотя бы раз написать боту. Свой id
присылает, например, @userinfobot. Набор называется rhl_u21_by_<имя бота>, ссылка —
t.me/addemoji/<набор>. Запуск заново пересоздаёт набор из текущих картинок.
Запускается руками, раз после перерисовки (tools/render_stickers.js), или workflow
«Опубликовать эмодзи» (.github/workflows/upload-emoji.yml) — токен он берёт из секретов.
"""
import asyncio
import json
import os
from pathlib import Path

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import FSInputFile, InputSticker

EMOJI = Path(__file__).resolve().parent.parent / "stickers" / "emoji"
TITLE = "РХЛ U21 — стикербук болельщика"


async def main() -> None:
    bot = Bot(os.environ["BOT_TOKEN"])
    owner = int(os.environ["OWNER_ID"])
    me = await bot.get_me()
    name = f"rhl_u21_by_{me.username}"
    icons = json.loads((EMOJI.parent / "emoji.json").read_text(encoding="utf-8"))
    stickers = [InputSticker(sticker=FSInputFile(EMOJI / f"{n}.webp"), format="static", emoji_list=[e])
                for n, e in icons.items()]
    try:
        await bot.delete_sticker_set(name)   # пересоздаём: так порядок и картинки всегда как в репозитории
    except TelegramBadRequest:
        pass   # набора ещё нет
    await bot.create_new_sticker_set(owner, name, TITLE, stickers, sticker_type="custom_emoji")
    print(f"Готово: https://t.me/addemoji/{name}")
    await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())

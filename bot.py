"""Бот РХЛ U21 2026/27 (@rhl_u21_bot, aiogram 3): встречает и ведёт в мини-апп, напоминает о матчах.

Весь интерфейс — в мини-аппе (ADR-003). У бота нет своей клавиатуры и меню команд: на всё он
отвечает стикером и одной кнопкой «Открыть РХЛ» (ADR-005).
"""
import asyncio
import html
import json
import logging
import os
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (CallbackQuery, FSInputFile, InlineKeyboardButton, InlineKeyboardMarkup,
                           MenuButtonWebApp, Message, ReplyKeyboardRemove, WebAppInfo)

BASE = Path(__file__).parent
TZ = ZoneInfo("Europe/Moscow")
SUBS_FILE = BASE / "subscribers.json"
STICKERS = BASE / "stickers"          # стикеры бота (ADR-005), 512×512 WEBP
# мини-апп (ADR-003); переменная окружения — только чтобы подставить тестовый адрес
WEBAPP_URL = os.environ.get("WEBAPP_URL") or "https://arpicasso.github.io/bogdanov/"
REMIND_TODAY_AT = time(10, 0)      # утром в день игры
REMIND_TOMORROW_AT = time(19, 0)   # вечером накануне
REMIND_TEAM = "Рязань-ВДВ"         # напоминания пока только о её матчах: games.json

DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


@dataclass(frozen=True)
class Game:
    n: int
    d: date
    opponent: str
    home: bool


GAMES = sorted(
    (Game(g["n"], date.fromisoformat(g["date"]), g["opponent"], g["home"])
     for g in json.loads((BASE / "games.json").read_text(encoding="utf-8"))),
    key=lambda g: g.d,
)
# id команды → название: для диплинка /start <id> (ADR-005)
TEAMS = {t["id"]: t["name"] for t in json.loads((BASE / "teams.json").read_text(encoding="utf-8"))}

# ---------- свои эмодзи ----------
# Набор rhl_u21_by_<бот> (tools/upload_emoji.py) в порядке stickers/emoji.json. Писать ими бот
# может, пока у владельца бота есть Telegram Premium (Bot API, MessageEntity). Не вышло —
# emoji_off() и то же сообщение обычными эмодзи.

EMOJI = json.loads((STICKERS / "emoji.json").read_text(encoding="utf-8"))   # имя → обычный эмодзи
CUSTOM: dict[str, str] = {}   # имя → custom_emoji_id, заполняет load_custom_emoji() при запуске


def custom_ids(set_stickers: list) -> dict[str, str]:
    """Сопоставить стикеры набора именам из emoji.json: порядок тот же, в каком их загрузили."""
    return {n: st.custom_emoji_id for n, st in zip(EMOJI, set_stickers) if st.custom_emoji_id}


def e(name: str) -> str:
    """Свой эмодзи, если набор загружен, иначе обычный."""
    plain = EMOJI[name]
    if name in CUSTOM:
        return f'<tg-emoji emoji-id="{CUSTOM[name]}">{plain}</tg-emoji>'
    return plain


def emoji_off(err: Exception) -> bool:
    """Telegram не принял свои эмодзи: дальше пишем обычными. True — есть смысл повторить."""
    if not CUSTOM:
        return False
    logging.warning("custom emoji off: %s", err)
    CUSTOM.clear()
    return True

# ---------- тексты и кнопки ----------

B_APP = "Открыть РХЛ"

# видно в пустом чате до «Старт» и в профиле бота (до 512 и 120 символов)
DESCRIPTION = ("Бот Первенства России U21 — РХЛ 2026/27.\n\n"
               "🏒 Календарь всех 26 команд, таблица и счёт матчей — в приложении\n"
               "🔔 Напоминания перед играми\n\n"
               "Жми «Старт» 👇")
SHORT_DESCRIPTION = "РХЛ U21: календарь, таблица и счёт матчей. Напомню перед игрой 🏒"


def app_url(team: str | None = None) -> str:
    """Адрес мини-аппа; с командой — ?team=<id>, мини-апп выберет её, если своей ещё нет."""
    if not team:
        return WEBAPP_URL
    u = urlsplit(WEBAPP_URL)
    return urlunsplit(u._replace(query=urlencode(parse_qsl(u.query) + [("team", team)])))


def app_kb(team: str | None = None) -> InlineKeyboardMarkup:
    """Одна кнопка — открыть мини-апп."""
    web_app = WebAppInfo(url=app_url(team))
    if "puck" in CUSTOM:   # значок на кнопке — наша шайба
        btn = InlineKeyboardButton(text=B_APP, icon_custom_emoji_id=CUSTOM["puck"], web_app=web_app)
    else:
        btn = InlineKeyboardButton(text=f"{EMOJI['puck']} {B_APP}", web_app=web_app)
    return InlineKeyboardMarkup(inline_keyboard=[[btn]])


def welcome_text(team: str | None = None) -> str:
    head = (f"Здарова! Открываю РХЛ с командой <b>«{html.escape(TEAMS[team])}»</b> {e('rhl')}" if team
            else f"Здарова! Это РХЛ U21 — всё про лигу в одном месте {e('rhl')}")
    return (f"{head}\n\n"
            f"{e('star')} Календарь 26 команд\n"
            f"{e('cup')} Таблица конференций\n"
            f"{e('goal')} Счёт и голы матчей\n\n"
            "<b>Жми «Открыть РХЛ»</b> 👇 и выбери, за кого болеешь.")


def lost_text() -> str:
    return f"Всё самое интересное — в приложении {e('fire')}\nЖми кнопку 👇"

# ---------- напоминания: подписчики ----------

def load_subs() -> set[int]:
    try:
        return set(json.loads(SUBS_FILE.read_text()))
    except (FileNotFoundError, ValueError):
        return set()


def save_subs(subs: set[int]) -> None:
    SUBS_FILE.write_text(json.dumps(sorted(subs)))


SUBS = load_subs()


def remind_kb(chat_id: int) -> InlineKeyboardMarkup:
    on = chat_id in SUBS
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text="🔕 Выключить" if on else "🔔 Включить", callback_data="r:toggle")]])


def remind_text(chat_id: int) -> str:
    state = "✅ включены" if chat_id in SUBS else "❌ выключены"
    return (f"{e('bell')} Напоминания о матчах «{REMIND_TEAM}» {state}\n\n"
            f"Пришлю сообщение накануне игры в {REMIND_TOMORROW_AT:%H:%M} "
            f"и в день игры в {REMIND_TODAY_AT:%H:%M} (МСК).")


def reminder_text(g: Game, kind: str) -> str:
    head = "Сегодня игра!" if kind == "today" else "Завтра игра!"
    where = f"{e('home')} Дома" if g.home else f"{e('away')} На выезде"
    return (f"{e('bell')} <b>{head}</b>\n\n{DOW[g.d.weekday()]} {g.d:%d.%m} · {REMIND_TEAM} — "
            f"<b>{html.escape(g.opponent)}</b>\n{where}")

# ---------- стикеры ----------

_sticker_ids: dict[str, str] = {}   # имя → file_id: файл загружаем один раз


async def send_sticker(bot: Bot, chat_id: int, name: str, **kw) -> bool:
    """Стикер — украшение (ADR-005): ошибка не мешает сообщению, кроме блокировки бота."""
    try:
        msg = await bot.send_sticker(chat_id, _sticker_ids.get(name) or FSInputFile(STICKERS / f"{name}.webp"), **kw)
    except TelegramForbiddenError:
        raise
    except Exception:
        logging.exception("sticker %s failed", name)
        return False
    _sticker_ids[name] = msg.sticker.file_id
    return True

# ---------- хендлеры ----------

dp = Dispatcher()


async def say(bot: Bot, chat_id: int, make) -> None:
    """Отправить make() → (текст, клавиатура); если Telegram не принял свои эмодзи — обычными."""
    try:
        text, kb = make()
        await bot.send_message(chat_id, text, reply_markup=kb)
    except TelegramBadRequest as err:
        if not emoji_off(err):
            raise
        text, kb = make()
        await bot.send_message(chat_id, text, reply_markup=kb)


async def safe_edit(c: CallbackQuery, make) -> None:
    text, kb = make()
    try:
        await c.message.edit_text(text, reply_markup=kb)
    except TelegramBadRequest as err:   # «message is not modified» — молча, свои эмодзи — повтор
        if "not modified" not in str(err) and emoji_off(err):
            await safe_edit(c, make)


@dp.message(CommandStart())
async def start(m: Message, command: CommandObject):
    # стикер заодно убирает клавиатуру, если она осталась от прошлой версии бота
    if not await send_sticker(m.bot, m.chat.id, "hello", reply_markup=ReplyKeyboardRemove()):
        await m.answer("🏒", reply_markup=ReplyKeyboardRemove())
    cid = m.chat.id
    if command.args == "remind":   # из мини-аппа, экран «Я» (ADR-004)
        await say(m.bot, cid, lambda: (remind_text(cid), remind_kb(cid)))
        return
    team = command.args if command.args in TEAMS else None
    await say(m.bot, cid, lambda: (welcome_text(team), app_kb(team)))


@dp.message(Command("remind"))
async def h_remind(m: Message):
    cid = m.chat.id
    await say(m.bot, cid, lambda: (remind_text(cid), remind_kb(cid)))


@dp.callback_query(F.data == "r:toggle")
async def cb_remind(c: CallbackQuery):
    cid = c.message.chat.id
    SUBS.symmetric_difference_update({cid})
    save_subs(SUBS)
    await safe_edit(c, lambda: (remind_text(cid), remind_kb(cid)))
    await c.answer("Готово")
    if cid in SUBS:
        await send_sticker(c.bot, cid, "bell")


@dp.message()   # последним: всё остальное (ADR-005 — бот не молчит)
async def h_lost(m: Message):
    await send_sticker(m.bot, m.chat.id, "tap", reply_markup=ReplyKeyboardRemove())
    await say(m.bot, m.chat.id, lambda: (lost_text(), app_kb()))

# ---------- напоминания ----------

def next_reminder(now: datetime) -> tuple[datetime, str]:
    slots = [(datetime.combine(now.date() + timedelta(days=d), t, TZ), kind)
             for d in (0, 1) for t, kind in ((REMIND_TODAY_AT, "today"), (REMIND_TOMORROW_AT, "tomorrow"))]
    return min(s for s in slots if s[0] > now)


async def reminder_loop(bot: Bot):
    while True:
        now = datetime.now(TZ)
        at, kind = next_reminder(now)
        await asyncio.sleep((at - now).total_seconds())
        day = at.date() + timedelta(days=1 if kind == "tomorrow" else 0)
        games = [g for g in GAMES if g.d == day]
        if not games:
            continue
        g = games[0]
        for cid in list(SUBS):
            try:
                if kind == "today":
                    await send_sticker(bot, cid, "gameday")
                await say(bot, cid, lambda: (reminder_text(g, kind), app_kb()))
            except TelegramForbiddenError:   # бота заблокировали
                SUBS.discard(cid)
                save_subs(SUBS)
            except Exception:
                logging.exception("send to %s failed", cid)
            await asyncio.sleep(0.05)


async def load_custom_emoji(bot: Bot) -> None:
    try:
        me = await bot.get_me()
        st = await bot.get_sticker_set(f"rhl_u21_by_{me.username}")
    except TelegramBadRequest:   # набор не опубликован — пишем обычными эмодзи
        logging.warning("custom emoji set not found, plain emoji")
        return
    CUSTOM.update(custom_ids(st.stickers))
    logging.info("custom emoji: %d", len(CUSTOM))


async def main():
    logging.basicConfig(level=logging.INFO)
    bot = Bot(os.environ["BOT_TOKEN"], default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    await load_custom_emoji(bot)
    await bot.delete_my_commands()   # меню команд пустое: всё — в мини-аппе
    try:   # описание не критично: без него бот работает
        await bot.set_my_description(DESCRIPTION)
        await bot.set_my_short_description(SHORT_DESCRIPTION)
    except TelegramBadRequest:
        logging.exception("set description failed")
    await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="РХЛ", web_app=WebAppInfo(url=WEBAPP_URL)))
    asyncio.create_task(reminder_loop(bot))
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

"""Бот РХЛ U21 2026/27: встречает и ведёт в мини-апп, напоминает о матчах «Рязань-ВДВ» (aiogram 3)."""
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
from aiogram.types import (BotCommand, CallbackQuery, FSInputFile, InlineKeyboardButton,
                           InlineKeyboardMarkup, KeyboardButton, MenuButtonWebApp, Message,
                           ReplyKeyboardMarkup, WebAppInfo)

BASE = Path(__file__).parent
TZ = ZoneInfo("Europe/Moscow")
SUBS_FILE = BASE / "subscribers.json"
STICKERS = BASE / "stickers"          # стикеры бота (ADR-005), 512×512 WEBP
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")   # мини-апп (ADR-003); пусто — бот без кнопки
REMIND_TODAY_AT = time(10, 0)      # утром в день игры
REMIND_TOMORROW_AT = time(19, 0)   # вечером накануне

MONTHS = ["", "январь", "февраль", "март", "апрель", "май", "июнь",
          "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
MONTHS_GEN = ["", "января", "февраля", "марта", "апреля", "мая", "июня",
              "июля", "августа", "сентября", "октября", "ноября", "декабря"]
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
OPPONENTS = sorted({g.opponent for g in GAMES})
# id команды → название: для диплинка /start <id> (ADR-005)
TEAMS = {t["id"]: t["name"] for t in json.loads((BASE / "teams.json").read_text(encoding="utf-8"))}
MONTH_KEYS = sorted({(g.d.year, g.d.month) for g in GAMES})

PLAYOFF = (
    "🏆 <b>Плей-офф — Кубок Регионов</b>\n"
    "Топ-8 конференции, серии до 3 побед.\n"
    "Игры 1, 2 и 5 — у команды с более высоким посевом.\n\n"
    "1/8 — 27, 28, 31 марта, 1, 4 апреля\n"
    "1/4 — 10, 11, 14, 15, 18 апреля\n"
    "1/2 — 24, 25, 28, 29 апреля, 2 мая\n"
    "Финал — 7, 8, 11, 12, 15 мая 2027"
)

# ---------- форматирование ----------

def today() -> date:
    return datetime.now(TZ).date()


def fmt(g: Game, show_past: bool = True) -> str:
    place = "🏠" if g.home else "✈️"
    opp = f"<b>{g.opponent}</b>" if g.home else g.opponent
    line = f"{DOW[g.d.weekday()]} {g.d:%d.%m} {place} {opp}"
    return f"<s>{line}</s>" if show_past and g.d < today() else line


def until(d: date) -> str:
    days = (d - today()).days
    if days == 0:
        return "сегодня"
    if days == 1:
        return "завтра"
    last, last2 = days % 10, days % 100
    word = "день" if last == 1 and last2 != 11 else \
        "дня" if 2 <= last <= 4 and not 12 <= last2 <= 14 else "дней"
    return f"через {days} {word}"


def upcoming() -> list[Game]:
    t = today()
    return [g for g in GAMES if g.d >= t]


def next_game_text() -> str:
    up = upcoming()
    if not up:
        return "Регулярка закончилась. Дальше плей-офф 👇\n\n" + PLAYOFF
    g = up[0]
    where = "🏠 Дома" if g.home else "✈️ На выезде"
    num = GAMES.index(g) + 1
    text = (f"🏒 <b>Следующая игра — {until(g.d)}</b>\n\n"
            f"{DOW[g.d.weekday()]}, {g.d.day} {MONTHS_GEN[g.d.month]} {g.d.year}\n"
            f"Соперник: <b>{g.opponent}</b>\n{where}\n"
            f"Игра {num} из {len(GAMES)} (№ {g.n} в календаре лиги)")
    same = [x for x in up[1:3] if x.opponent == g.opponent]
    if same:
        text += "\n\nДальше с ними же: " + ", ".join(f"{x.d:%d.%m}" for x in same)
    return text


def list_text(title: str, games: list[Game]) -> str:
    if not games:
        return f"{title}\n\nИгр нет."
    return f"{title}\n\n" + "\n".join(fmt(g) for g in games)


def season_text() -> str:
    parts, cur = ["📋 <b>Весь сезон</b> (🏠 дома, ✈️ выезд)"], None
    for g in GAMES:
        if (g.d.year, g.d.month) != cur:
            cur = (g.d.year, g.d.month)
            parts.append(f"\n<b>{MONTHS[g.d.month].capitalize()} {g.d.year}</b>")
        parts.append(fmt(g))
    return "\n".join(parts)


def stats_line() -> str:
    left = upcoming()
    home = sum(g.home for g in left)
    return f"Осталось игр: {len(left)} из {len(GAMES)} ({home} дома, {len(left) - home} на выезде)"

# ---------- подписчики ----------

def load_subs() -> set[int]:
    try:
        return set(json.loads(SUBS_FILE.read_text()))
    except (FileNotFoundError, ValueError):
        return set()


def save_subs(subs: set[int]) -> None:
    SUBS_FILE.write_text(json.dumps(sorted(subs)))


SUBS = load_subs()

# ---------- клавиатуры ----------

B_NEXT, B_SOON, B_MONTH, B_OPP = "🏒 Следующая игра", "📅 Ближайшие 5", "🗓 По месяцам", "🆚 Соперники"
B_HOME, B_AWAY, B_ALL, B_PO = "🏠 Дома", "✈️ Выезд", "📋 Весь сезон", "🏆 Плей-офф"
B_REMIND, B_PDF = "🔔 Напоминания", "📄 PDF"
B_APP = "🏒 Открыть РХЛ"


def app_url(team: str | None = None) -> str:
    """Адрес мини-аппа; с командой — ?team=<id>, мини-апп выберет её, если своей ещё нет."""
    if not team:
        return WEBAPP_URL
    u = urlsplit(WEBAPP_URL)
    return urlunsplit(u._replace(query=urlencode(parse_qsl(u.query) + [("team", team)])))


# первая строка — мини-апп (ADR-005), ниже — расписание «Рязань-ВДВ»
MAIN_KB = ReplyKeyboardMarkup(
    keyboard=([[KeyboardButton(text=B_APP, web_app=WebAppInfo(url=WEBAPP_URL))]] if WEBAPP_URL else []) +
             [[KeyboardButton(text=B_NEXT), KeyboardButton(text=B_SOON)],
              [KeyboardButton(text=B_MONTH), KeyboardButton(text=B_OPP)],
              [KeyboardButton(text=B_HOME), KeyboardButton(text=B_AWAY)],
              [KeyboardButton(text=B_ALL), KeyboardButton(text=B_PO)],
              [KeyboardButton(text=B_REMIND), KeyboardButton(text=B_PDF)]],
    resize_keyboard=True, is_persistent=True,
)


def months_kb() -> InlineKeyboardMarkup:
    btns = [InlineKeyboardButton(text=f"{MONTHS[m].capitalize()} {str(y)[2:]}", callback_data=f"m:{y}-{m}")
            for y, m in MONTH_KEYS]
    return InlineKeyboardMarkup(inline_keyboard=[btns[i:i + 3] for i in range(0, len(btns), 3)])


def opponents_kb() -> InlineKeyboardMarkup:
    btns = [InlineKeyboardButton(text=o, callback_data=f"o:{i}") for i, o in enumerate(OPPONENTS)]
    return InlineKeyboardMarkup(inline_keyboard=[btns[i:i + 2] for i in range(0, len(btns), 2)])


def remind_kb(chat_id: int) -> InlineKeyboardMarkup:
    on = chat_id in SUBS
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text="🔕 Выключить" if on else "🔔 Включить", callback_data="r:toggle")]])


def app_kb(team: str | None = None, remind: bool = False) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text=B_APP, web_app=WebAppInfo(url=app_url(team)))]]
    if remind:
        rows.append([InlineKeyboardButton(text="🔔 Напоминания о матчах", callback_data="r:open")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def welcome_text(team: str | None = None) -> str:
    head = (f"Здарова! Открываю РХЛ с командой <b>«{html.escape(TEAMS[team])}»</b> 🏒" if team
            else "Здарова! Это РХЛ U21 — всё про лигу в одном месте 🏒")
    return (f"{head}\n\n"
            "Календарь 26 команд, таблица и счёт матчей — в приложении.\n\n"
            "<b>Жми «Открыть РХЛ»</b> 👇 и выбери, за кого болеешь.")


LOST_TEXT = "Всё самое интересное — в приложении. Жми кнопку 👇"
# видно в пустом чате до «Старт» и в профиле бота (до 512 и 120 символов)
DESCRIPTION = ("Бот Первенства России U21 — РХЛ 2026/27.\n\n"
               "🏒 Календарь всех 26 команд, таблица и счёт матчей — в приложении\n"
               "🔔 Напоминания перед играми\n\n"
               "Жми «Старт» 👇")
SHORT_DESCRIPTION = "РХЛ U21: календарь, таблица и счёт матчей. Напомню перед игрой 🏒"


def remind_text(chat_id: int) -> str:
    state = "✅ включены" if chat_id in SUBS else "❌ выключены"
    return (f"🔔 Напоминания {state}\n\n"
            f"Пришлю сообщение накануне игры в {REMIND_TOMORROW_AT:%H:%M} "
            f"и в день игры в {REMIND_TODAY_AT:%H:%M} (МСК).")

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


async def safe_edit(c: CallbackQuery, text: str, reply_markup: InlineKeyboardMarkup) -> None:
    try:
        await c.message.edit_text(text, reply_markup=reply_markup)
    except TelegramBadRequest:   # текст и клавиатура не изменились
        pass


@dp.message(CommandStart())
async def start(m: Message, command: CommandObject):
    if command.args == "remind":   # из мини-аппа, экран «Я» (ADR-004)
        await m.answer(remind_text(m.chat.id), reply_markup=remind_kb(m.chat.id))
        await m.answer("Кнопки расписания — внизу.", reply_markup=MAIN_KB)
        return
    if not WEBAPP_URL:
        await m.answer("Расписание МХК «Рязань-ВДВ», РХЛ 2026/27 🏒\nЖми кнопки внизу.\n\n"
                       + next_game_text(), reply_markup=MAIN_KB)
        return
    # ADR-005: стикер ставит клавиатуру, следующее сообщение ведёт к одной кнопке
    if not await send_sticker(m.bot, m.chat.id, "hello", reply_markup=MAIN_KB):
        await m.answer("Кнопка приложения — всегда внизу.", reply_markup=MAIN_KB)
    team = command.args if command.args in TEAMS else None
    await m.answer(welcome_text(team), reply_markup=app_kb(team, remind=True))


@dp.message(Command("next"))
@dp.message(F.text == B_NEXT)
async def h_next(m: Message):
    await m.answer(next_game_text())


@dp.message(Command("soon"))
@dp.message(F.text == B_SOON)
async def h_soon(m: Message):
    await m.answer(list_text("📅 <b>Ближайшие игры</b>", upcoming()[:5]) + "\n\n" + stats_line())


@dp.message(F.text == B_MONTH)
async def h_months(m: Message):
    await m.answer("🗓 Выбери месяц:", reply_markup=months_kb())


@dp.callback_query(F.data.startswith("m:"))
async def cb_month(c: CallbackQuery):
    y, mo = map(int, c.data[2:].split("-"))
    games = [g for g in GAMES if (g.d.year, g.d.month) == (y, mo)]
    await safe_edit(c, list_text(f"🗓 <b>{MONTHS[mo].capitalize()} {y}</b>", games), months_kb())
    await c.answer()


@dp.message(F.text == B_OPP)
async def h_opps(m: Message):
    await m.answer("🆚 Выбери соперника:", reply_markup=opponents_kb())


@dp.callback_query(F.data.startswith("o:"))
async def cb_opp(c: CallbackQuery):
    opp = OPPONENTS[int(c.data[2:])]
    games = [g for g in GAMES if g.opponent == opp]
    await safe_edit(c, list_text(f"🆚 <b>{opp}</b>", games), opponents_kb())
    await c.answer()


@dp.message(F.text == B_HOME)
async def h_home(m: Message):
    await m.answer(list_text("🏠 <b>Домашние игры</b>", [g for g in GAMES if g.home]))


@dp.message(F.text == B_AWAY)
async def h_away(m: Message):
    await m.answer(list_text("✈️ <b>Выездные игры</b>", [g for g in GAMES if not g.home]))


@dp.message(Command("season"))
@dp.message(F.text == B_ALL)
async def h_all(m: Message):
    await m.answer(season_text())


@dp.message(Command("playoff"))
@dp.message(F.text == B_PO)
async def h_po(m: Message):
    await m.answer(PLAYOFF)


@dp.message(Command("remind"))
@dp.message(F.text == B_REMIND)
async def h_remind(m: Message):
    await m.answer(remind_text(m.chat.id), reply_markup=remind_kb(m.chat.id))


@dp.callback_query(F.data == "r:open")
async def cb_remind_open(c: CallbackQuery):
    await c.message.answer(remind_text(c.message.chat.id), reply_markup=remind_kb(c.message.chat.id))
    await c.answer()


@dp.callback_query(F.data == "r:toggle")
async def cb_remind(c: CallbackQuery):
    cid = c.message.chat.id
    SUBS.symmetric_difference_update({cid})
    save_subs(SUBS)
    await safe_edit(c, remind_text(cid), remind_kb(cid))
    await c.answer("Готово")
    if cid in SUBS:
        await send_sticker(c.bot, cid, "bell")


@dp.message(Command("pdf"))
@dp.message(F.text == B_PDF)
async def h_pdf(m: Message):
    await m.answer_document(FSInputFile(BASE / "calendar.pdf"), caption="Календарь на печать")


@dp.message()   # последним: всё, что не поймали хендлеры выше (ADR-005 — бот не молчит)
async def h_lost(m: Message):
    if not WEBAPP_URL:
        await m.answer("Не понял 🤔 Жми кнопки внизу.", reply_markup=MAIN_KB)
        return
    await send_sticker(m.bot, m.chat.id, "tap")
    await m.answer(LOST_TEXT, reply_markup=app_kb())

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
        head = "Сегодня игра!" if kind == "today" else "Завтра игра!"
        text = f"🔔 <b>{head}</b>\n\n{fmt(g, show_past=False)}\n" + ("🏠 Дома" if g.home else "✈️ На выезде")
        for cid in list(SUBS):
            try:
                if kind == "today":
                    await send_sticker(bot, cid, "gameday")
                await bot.send_message(cid, text)
            except TelegramForbiddenError:   # бота заблокировали
                SUBS.discard(cid)
                save_subs(SUBS)
            except Exception:
                logging.exception("send to %s failed", cid)
            await asyncio.sleep(0.05)


async def main():
    logging.basicConfig(level=logging.INFO)
    bot = Bot(os.environ["BOT_TOKEN"], default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    await bot.set_my_commands([
        BotCommand(command="next", description="Следующая игра"),
        BotCommand(command="soon", description="Ближайшие 5 игр"),
        BotCommand(command="season", description="Весь сезон"),
        BotCommand(command="playoff", description="Плей-офф"),
        BotCommand(command="remind", description="Напоминания"),
        BotCommand(command="pdf", description="PDF на печать"),
    ])
    try:   # описание не критично: без него бот работает
        await bot.set_my_description(DESCRIPTION)
        await bot.set_my_short_description(SHORT_DESCRIPTION)
    except TelegramBadRequest:
        logging.exception("set description failed")
    if WEBAPP_URL:
        await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(
            text="Приложение", web_app=WebAppInfo(url=WEBAPP_URL)))
    asyncio.create_task(reminder_loop(bot))
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

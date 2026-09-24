"use strict";
// Интерфейс — по DESIGN.md. Всё, что пришло из данных, вставляется только через esc().

// Скрипт Telegram грузится асинхронно и не держит запуск: tg появляется в initTelegram()
let tg = null;
let inTelegram = false;
const launchedInTelegram = /tgWebAppData=/.test(location.hash);
const TZ = "Europe/Moscow";
const FAV_KEY = "fav_team";
const THEME_KEY = "theme";          // "auto" | "light" | "dark", хранится на устройстве
const SPLASH_KEY = "splash_team";   // эмблема для заставки: её рисуют до загрузки данных
const SURFACE = { light: "#ffffff", dark: "#131922" };
const HEADER = { light: "#000000", dark: "#0b0f15" };   // в тон бегущей строке
const DATA_KEY = "league_cache";    // прошлые данные: повторный запуск рисуется сразу, свежие — в фоне
const SPLASH_MIN_MS = 480;          // столько нужно буквам заставки, чтобы приземлиться

const DOW = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MON_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const CONF = { east: "Восток", west: "Запад" };
const PLAYOFF_CUT = 8;
const PERIOD_NAMES = { "1": "1-й период", "2": "2-й период", "3": "3-й период", "ОТ": "Овертайм", "РБ": "Буллиты" };

const ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/></svg>',
  away: '<svg viewBox="0 0 24 24"><path d="M3 12h13M12 6l6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
// «Надувная лента» Slush — плоская, без градиента: синяя трубка в чёрном контуре
const RIBBON = `<svg class="ribbon" viewBox="0 0 220 150" aria-hidden="true">
  <path class="o" d="M10 120 C 60 20, 110 150, 150 70 S 210 10, 230 40" stroke-width="30"/>
  <path class="f" d="M10 120 C 60 20, 110 150, 150 70 S 210 10, 230 40" stroke-width="27"/>
</svg>`;

const state = {
  data: null,
  teams: {},
  fav: null,
  draft: null,
  tab: "home",
  cal: { team: null, side: "all" },
  conf: "east",
  scrolledToNext: false,
};

const $ = (sel) => document.querySelector(sel);

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- даты: всё по Москве ----------

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function daysFromToday(iso) {
  return Math.round((parseISO(iso) - parseISO(todayISO())) / 864e5);
}
function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
function until(iso) {
  const d = daysFromToday(iso);
  if (d === 0) return "сегодня";
  if (d === 1) return "завтра";
  if (d === -1) return "вчера";
  if (d < 0) return `${-d} ${plural(-d, "день", "дня", "дней")} назад`;
  return `через ${d} ${plural(d, "день", "дня", "дней")}`;
}
function fmtLong(iso) {
  const d = parseISO(iso);
  return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]}`;
}

// ---------- хранилище любимой команды ----------

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } }
function cloud() {
  return inTelegram && tg.CloudStorage && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;
}
function rememberSplash(id) {
  const t = team(id);
  lsSet(SPLASH_KEY, JSON.stringify({ logo: t.logo || "", abbr: t.abbr || "" }));
}
function saveFav(id) {
  lsSet(FAV_KEY, id);
  rememberSplash(id);
  if (cloud()) cloud().setItem(FAV_KEY, id, () => {});
}

// ---------- тема ----------

function themePref() {
  const v = lsGet(THEME_KEY);
  return v === "light" || v === "dark" ? v : "auto";
}
function hashTheme() {
  try {
    const m = /tgWebAppThemeParams=([^&]+)/.exec(location.hash);
    const bg = m && JSON.parse(decodeURIComponent(m[1])).bg_color;
    if (!bg || !/^#[0-9a-f]{6}$/i.test(bg)) return null;
    const n = parseInt(bg.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128 ? "dark" : "light";
  } catch (e) {
    return null;
  }
}
function systemTheme() {
  if (inTelegram && tg.colorScheme) return tg.colorScheme;
  const fromHash = launchedInTelegram && hashTheme();
  if (fromHash) return fromHash;
  return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme() {
  const pref = themePref();
  const theme = pref === "auto" ? systemTheme() : pref;
  document.documentElement.dataset.theme = theme;
  if (inTelegram && tg.isVersionAtLeast) {
    if (tg.isVersionAtLeast("6.1")) {
      tg.setHeaderColor(HEADER[theme]);
      tg.setBackgroundColor(SURFACE[theme]);
    }
    if (tg.isVersionAtLeast("7.10") && tg.setBottomBarColor) tg.setBottomBarColor(SURFACE[theme]);
  }
}
const SUN = `<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>`;
const MOON = `<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>`;
function toggleLabel() {
  return document.documentElement.dataset.theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
}
// Кнопка-стикер в углу цветной шапки: видна на каждом экране, одно нажатие — светлая ↔ тёмная
function addThemeToggle() {
  const band = $("#screen .band");
  if (!band) return;
  band.classList.add("has-toggle");
  band.insertAdjacentHTML("afterbegin", `<button class="theme-toggle" data-theme-toggle type="button" aria-label="${toggleLabel()}">${SUN}${MOON}</button>`);
}
let themeAnimTimer = 0;
function toggleTheme(btn) {
  const root = document.documentElement;
  lsSet(THEME_KEY, root.dataset.theme === "dark" ? "light" : "dark");
  root.classList.add("theme-anim");
  applyTheme();
  btn.setAttribute("aria-label", toggleLabel());
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
  clearTimeout(themeAnimTimer);
  themeAnimTimer = setTimeout(() => root.classList.remove("theme-anim"), 400);
  if (state.tab === "me" || !state.fav) {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }
}
function themePills() {
  const pref = themePref();
  const auto = launchedInTelegram ? "Как в Telegram" : "Как в системе";
  return `<div class="label">Оформление</div><div class="pills theme-pills" role="group" aria-label="Оформление">${[["auto", auto], ["light", "Светлое"], ["dark", "Тёмное"]]
    .map(([k, v]) => `<button class="${pref === k ? "on" : ""}" data-theme-pick="${k}" aria-pressed="${pref === k}">${v}</button>`)
    .join("")}</div>`;
}

// ---------- выборки ----------

const team = (id) => state.teams[id] || { id, abbr: "?", name: id, city: "" };
const games = () => state.data.games;
const gamesOf = (id) => games().filter((g) => g.home === id || g.away === id);
const isUpcoming = (g) => !g.score && g.date >= todayISO();
const nextGame = (id) => gamesOf(id).find(isUpcoming);
const lastPlayed = (id) => gamesOf(id).filter((g) => g.score).pop();

function standingOf(id) {
  for (const conf of Object.keys(state.data.standings)) {
    const i = state.data.standings[conf].findIndex((r) => r.team === id);
    if (i >= 0) return { conf, place: i + 1, row: state.data.standings[conf][i] };
  }
  return null;
}

function outcomeFor(g, me) {
  if (!g.score || (g.home !== me && g.away !== me)) return "";
  const mine = g.home === me ? g.score.home : g.score.away;
  const their = g.home === me ? g.score.away : g.score.home;
  return mine > their ? "w" : "l";
}

// ---------- элементы ----------

function emblem(id, size) {
  const t = team(id);
  const cls = `em${size ? " " + size : ""}`;
  if (t.logo) return `<span class="${cls}"><img src="${esc(t.logo)}" alt="" loading="lazy" decoding="async"></span>`;
  return `<span class="${cls} ab" aria-hidden="true">${esc(t.abbr)}</span>`;
}

function resultPill(g) {
  const res = outcomeFor(g, state.fav);
  if (!res) return g.score && g.score.decision ? `<span class="res l">${esc(g.score.decision)}</span>` : "";
  const dec = g.score.decision ? `<small>${esc(g.score.decision)}</small>` : "";
  return `<span class="res ${res}" title="${res === "w" ? "Победа" : "Поражение"}">${res === "w" ? "В" : "П"}${dec}</span>`;
}

function whereTag(g, me) {
  if (me !== g.home && me !== g.away) return "";
  return g.home === me ? `<span class="tag home">${ICON.home}Дома</span>` : `<span class="tag away">${ICON.away}Выезд</span>`;
}

function board(g) {
  const side = (id) => `<div class="side">${emblem(id, "lg")}<div class="name">${esc(team(id).name)}</div><div class="city">${esc(team(id).city)}</div></div>`;
  let mid;
  if (g.score) {
    const dec = g.score.decision === "ОТ" ? "овертайм" : g.score.decision === "Б" ? "буллиты" : "финал";
    mid = `<div class="score">${g.score.home}:${g.score.away}<span class="dec">${dec}</span></div>`;
  } else {
    mid = `<div class="score pending">${g.time ? esc(g.time) : "vs"}<span class="dec">${until(g.date)}</span></div>`;
  }
  return `<div class="board">${side(g.home)}${mid}${side(g.away)}</div>`;
}

function periodsLine(g) {
  if (!g.score || !g.score.periods || !g.score.periods.length) return "";
  return `<div class="periods">${g.score.periods.map((p) => `<span class="num">${p[0]}:${p[1]}</span>`).join("")}</div>`;
}

function gameRow(g, next) {
  const d = parseISO(g.date);
  const past = !!g.score;
  const lead = (id) => (id === g.home ? g.score.home > g.score.away : g.score.away > g.score.home);
  const goals = (id) => (past ? `<span class="gl${lead(id) ? " lead" : ""}">${id === g.home ? g.score.home : g.score.away}</span>` : "");
  const line = (id) => `<div>${emblem(id)}<span class="nm${id === state.fav ? " me" : ""}">${esc(team(id).name)}</span>${goals(id)}</div>`;
  const right = past ? resultPill(g) : `<span class="kick">${g.time ? esc(g.time) : ""}</span>`;
  return `<div class="row${past ? " past" : ""}${next ? " next" : ""}" data-game="${esc(g.id)}" role="button" tabindex="0"${next ? ' id="next-anchor"' : ""}>
    <div class="date"><b>${d.getUTCDate()}</b><span>${MON_SHORT[d.getUTCMonth()]} ${DOW[d.getUTCDay()]}</span></div>
    <div class="t">${line(g.home)}${line(g.away)}</div>
    <div class="r">${right}</div>
  </div>`;
}

function footer() {
  const upd = state.data.updated ? new Date(state.data.updated) : null;
  const when = upd ? upd.toLocaleString("ru-RU", { timeZone: TZ, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  return `<div class="foot">${esc(state.data.league)} · сезон ${esc(state.data.season)}${when ? `<br>Обновлено ${esc(when)} МСК` : ""}</div>`;
}

// ---------- экраны ----------

// Три цифры сезона: в сезоне — место, очки, форма; до старта — матчи, дом и выезд, дни до старта
function seasonStats(me) {
  const st = standingOf(me);
  const mine = gamesOf(me);
  if (st && st.row.gp) {
    const form = st.row.form.length ? `<span class="form">${st.row.form.map((f) => `<i class="${f}"></i>`).join("")}</span>` : "—";
    return `<div class="stat"><b>${st.place}</b><span>место<br>${CONF[st.conf]}</span></div>
      <div class="stat"><b>${st.row.pts}</b><span>${plural(st.row.pts, "очко", "очка", "очков")}<br>за ${st.row.gp} ${plural(st.row.gp, "игру", "игры", "игр")}</span></div>
      <div class="stat"><b>${form}</b><span>форма<br>5 игр</span></div>`;
  }
  if (!mine.length) return "";
  const home = mine.filter((g) => g.home === me).length;
  const days = Math.max(daysFromToday(mine[0].date), 0);
  return `<div class="stat"><b>${mine.length}</b><span>матчей<br>в сезоне</span></div>
    <div class="stat"><b>${home}</b><span>дома,<br>${mine.length - home} на выезде</span></div>
    <div class="stat"><b>${days}</b><span>${plural(days, "день", "дня", "дней")}<br>до старта</span></div>`;
}

// Самый длинный кусок названия, который нельзя перенести: по нему подбирается кегль шапки
function longestChunk(name) {
  return Math.max(...name.split(/\s+/).flatMap((w) => w.split(/(?<=-)/)).map((x) => x.length));
}

function renderHome() {
  const me = state.fav;
  const t = team(me);
  const mine = gamesOf(me);
  const next = nextGame(me);
  const last = lastPlayed(me);
  const upcoming = mine.filter(isUpcoming).slice(1, 4);

  let html = `<section class="band sky">${RIBBON}
    <div class="hero"><button type="button" class="hero-em" data-switch-open aria-label="Сменить команду">${emblem(me, "xl")}</button><div><h1 style="--w:${longestChunk(t.name)}">${esc(t.name)}</h1><div class="meta">${esc(t.city)} · ${CONF[t.conf] || ""}</div></div></div>
  </section>`;

  const stats = seasonStats(me);
  if (stats) html += `<div class="stats">${stats}</div>`;

  if (next) {
    const today = daysFromToday(next.date) === 0;
    html += `<div class="label">Следующий матч${next.n ? `<span class="aside">№ ${esc(next.n)}</span>` : ""}</div>
      <div class="board-card tap" data-game="${esc(next.id)}" role="button" tabindex="0">
        <div class="board-top">
          <span class="tags">${whereTag(next, me)}${today ? '<span class="tag today">Сегодня</span>' : ""}${next.official ? "" : '<span class="tag soft">предварительно</span>'}</span>
          <span class="when">${esc(fmtLong(next.date))}</span>
        </div>
        ${board(next)}
      </div>`;
  } else {
    html += `<div class="label">Следующий матч</div><div class="empty">Матчей регулярного чемпионата больше нет</div>`;
  }

  if (last) {
    html += `<div class="label">Последний результат</div>
      <div class="board-card tap" data-game="${esc(last.id)}" role="button" tabindex="0">
        <div class="board-top"><span class="tags">${whereTag(last, me)}${resultPill(last)}</span><span class="when">${esc(fmtLong(last.date))}</span></div>
        ${board(last)}
        ${periodsLine(last)}
      </div>`;
  }

  if (upcoming.length) {
    html += `<div class="label">Дальше<button type="button" class="aside link" data-tab="calendar">Весь календарь</button></div>
      <div class="list">${upcoming.map((g) => gameRow(g, false)).join("")}</div>`;
  }
  return html + footer();
}

function renderCalendar() {
  const teamId = state.cal.team;
  let list = teamId ? gamesOf(teamId) : games();
  if (teamId && state.cal.side !== "all") {
    list = list.filter((g) => (state.cal.side === "home" ? g.home === teamId : g.away === teamId));
  }
  const other = teamId && teamId !== state.fav;
  const opts = state.data.teams
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((t) => `<option value="${esc(t.id)}"${t.id === teamId && other ? " selected" : ""}>${esc(t.name)}</option>`)
    .join("");

  let html = `<section class="band lavender"><h1>Календарь</h1>
    <div class="pills">
      <button class="${teamId === state.fav ? "on" : ""}" data-cal-team="${esc(state.fav)}">Моя команда</button>
      <button class="${!teamId ? "on" : ""}" data-cal-team="">Вся лига</button>
      <select class="${other ? "on" : ""}" id="cal-team-select" aria-label="Другая команда"><option value="">Другая…</option>${opts}</select>
    </div>`;
  if (teamId) {
    html += `<div class="pills">${[["all", "Все"], ["home", "Дома"], ["away", "Выезд"]]
      .map(([k, v]) => `<button class="${state.cal.side === k ? "on" : ""}" data-cal-side="${k}">${v}</button>`)
      .join("")}</div>`;
  }
  html += `</section>`;

  const nextId = (list.find(isUpcoming) || {}).id;
  let month = "";
  for (const g of list) {
    const m = g.date.slice(0, 7);
    if (m !== month) {
      if (month) html += `</div>`;
      const d = parseISO(g.date);
      const count = list.filter((x) => x.date.slice(0, 7) === m).length;
      html += `<div class="label">${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}<span class="aside">${count} ${plural(count, "матч", "матча", "матчей")}</span></div><div class="list">`;
      month = m;
    }
    html += gameRow(g, g.id === nextId);
  }
  if (month) html += `</div>`;
  if (!list.length) html += `<div class="empty">Матчей нет</div>`;
  html += `<div class="foot">Официальный календарь ФХР пока есть только у «Рязань-ВДВ». Остальные даты — предварительные, уточним после открытия сайта РХЛ.</div>`;
  return html;
}

function renderTable() {
  const conf = state.conf;
  const rows = state.data.standings[conf] || [];
  let html = `<section class="band mint"><h1>Таблица</h1><div class="pills">${Object.entries(CONF)
    .map(([k, v]) => `<button class="${conf === k ? "on" : ""}" data-conf="${k}">${v}</button>`)
    .join("")}</div></section>`;
  html += `<div class="st"><div class="st-row head"><span class="pos"></span><span class="tm">Команда</span><span>И</span><span class="wl">В</span><span class="wl">П</span><span>Ш</span><span>О</span></div>`;
  rows.forEach((r, i) => {
    if (i === PLAYOFF_CUT) html += `<div class="cut"><span>плей-офф ↑</span></div>`;
    const wins = r.w + r.otw + r.sow;
    const losses = r.l + r.otl + r.sol;
    html += `<div class="st-row${r.team === state.fav ? " me" : ""}" data-team="${esc(r.team)}" role="button" tabindex="0">
      <span class="pos">${i + 1}</span>
      <span class="tm">${emblem(r.team)}<span>${esc(team(r.team).name)}</span></span>
      <span class="n">${r.gp}</span><span class="n wl">${wins}</span><span class="n wl">${losses}</span>
      <span class="n">${r.gf}:${r.ga}</span><span class="pts num">${r.pts}</span>
    </div>`;
  });
  html += `</div>`;
  const played = rows.some((r) => r.gp);
  html += `<div class="foot">${played
    ? "Победа — 2 очка, поражение в овертайме или по буллитам — 1. В плей-офф выходят 8 команд конференции."
    : "Сезон стартует 3 октября — таблица заполнится после первых матчей."}</div>`;
  return html;
}

// Сетка клубов по конференциям: первый запуск (attr = data-pick) и лист смены команды (data-switch)
function teamGrid(chosen, attr) {
  let html = "";
  for (const conf of ["east", "west"]) {
    const list = state.data.teams.filter((t) => t.conf === conf).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    html += `<div class="label">${CONF[conf]}<span class="aside">${list.length} команд</span></div><div class="picker">`;
    for (const t of list) {
      html += `<button class="pick${t.id === chosen ? " on" : ""}" ${attr}="${esc(t.id)}" aria-pressed="${t.id === chosen}">
        ${emblem(t.id, "md")}<div><b>${esc(t.name)}</b><small>${esc(t.city)}</small></div></button>`;
    }
    html += `</div>`;
  }
  return html;
}

function renderOnboarding() {
  const chosen = state.draft;
  let html = `<section class="band sky"><h1>За кого<br>болеете?</h1><div class="lede">Главный экран, календарь и таблица подстроятся под команду. Поменять можно в любой момент.</div></section>`;
  html += teamGrid(chosen, "data-pick");
  const label = chosen ? `Готово — ${esc(team(chosen).name)}` : "Выберите команду";
  html += `<div style="height:88px"></div><div class="cta-bar"><button class="btn" data-confirm${chosen ? "" : " disabled"}>${label}</button></div>`;
  return html;
}

// ---------- экран «Я» (ADR-004) ----------

function tgUser() {
  return (inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
}
// Ссылка, которая открывает мини-апп сразу с этим клубом
function inviteLink(id) {
  const app = state.data.links && state.data.links.app;
  if (app) return `${app}?startapp=${encodeURIComponent(id)}`;
  return `${location.origin}${location.pathname}?team=${encodeURIComponent(id)}`;
}
function canStory() {
  return inTelegram && typeof tg.shareToStory === "function" && tg.isVersionAtLeast("7.8");
}

const STAR = `<svg class="pp-star" viewBox="0 0 100 100" aria-hidden="true"><path d="m50 6 12.5 27 29.5 3.5-22 20 6 29.5L50 71 23.5 86l6-29.5-22-20L37 33z"/></svg>`;
const ICON_ME = {
  story: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" stroke-dasharray="3.2 2.2"/><path d="M12 8v8M8 12h8"/></svg>',
  invite: '<svg viewBox="0 0 24 24"><path d="M20 4 3 11l6.5 2.5L12 20z"/><path d="m9.5 13.5 4-4"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
};

function passport(me) {
  const t = team(me);
  const u = tgUser();
  const who = u && u.first_name ? `${esc(u.first_name)} · ` : "";
  const stats = seasonStats(me);
  return `<article class="passport" aria-label="Паспорт болельщика">
    <div class="pp-top"><span class="pp-tag">Паспорт болельщика</span>${STAR}</div>
    <div class="pp-main">${emblem(me, "xl")}
      <div class="pp-name"><small>Болею за</small><b style="--w:${longestChunk(t.name)}">${esc(t.name)}</b></div>
    </div>
    <div class="pp-meta">${who}${esc(state.data.league.split(" — ")[0])} · сезон ${esc(state.data.season)}</div>
    ${stats ? `<div class="pp-stats">${stats}</div>` : ""}
  </article>`;
}

function renderMe() {
  const me = state.fav;
  const t = team(me);
  const u = tgUser();
  const title = u && u.first_name ? u.first_name : "Профиль";
  const bot = state.data.links && state.data.links.bot;
  let html = `<section class="band concrete"><h1 style="--w:${longestChunk(title)}" class="fit">${esc(title)}</h1>
    <div class="lede">Болеет за ${esc(t.name)}. Покажите это друзьям.</div></section>`;
  html += passport(me);
  html += `<div class="me-actions">
    <button type="button" class="btn" data-story>${ICON_ME.story}${canStory() ? "Выложить в историю" : "Поделиться карточкой"}</button>
    <button type="button" class="btn ghost" data-invite>${ICON_ME.invite}Позвать болеть вместе</button>
  </div>`;
  html += `<div class="label">Настройки</div><div class="menu">`;
  if (bot) {
    html += me === "ryazan-vdv"
      ? `<button type="button" class="menu-row" data-remind>${ICON_ME.bell}<span><b>Напоминания о матчах</b><small>Накануне и в день игры — в боте</small></span>${ICON_ME.chev}</button>`
      : `<div class="menu-row off">${ICON_ME.bell}<span><b>Напоминания о матчах</b><small>Пока только о «Рязань-ВДВ». Скоро — о любой команде</small></span></div>`;
  }
  html += `<button type="button" class="menu-row" data-switch-open>${ICON_ME.swap}<span><b>Сменить команду</b><small>Сейчас: ${esc(t.name)}</small></span>${ICON_ME.chev}</button>
  </div>`;
  html += themePills();
  return html + footer();
}

// Лист со всеми клубами: одно касание — новая любимая команда
function openTeamSheet() {
  const html = `<div class="grab"></div>
    <div class="sheet-head"><span class="when">Сменить команду</span>
    <button class="btn-round" data-close aria-label="Закрыть">${ICON.close}</button></div>
    ${teamGrid(state.fav, "data-switch")}`;
  showSheet(html);
}

function shareStory() {
  const id = state.fav;
  const t = team(id);
  const link = inviteLink(id);
  const text = `Болею за ${t.name}! Матчи и таблица РХЛ: ${link}`;
  if (canStory()) {
    tg.shareToStory(new URL(`stories/${id}.jpg`, location.href).href, { text: text.slice(0, 200) });
    return;
  }
  shareLink(link, `Болею за ${t.name}! Матчи и таблица РХЛ`);
}

function shareLink(link, text) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  if (inTelegram) return tg.openTelegramLink(url);
  if (navigator.share) return navigator.share({ title: "РХЛ", text, url: link }).catch(() => {});
  window.open(url, "_blank", "noopener");
}

// ---------- карточка матча ----------

let sheetOpener = null;   // куда вернуть фокус после закрытия карточки

function openMatch(id) {
  const g = games().find((x) => x.id === id);
  if (!g) return;
  let html = `<div class="grab"></div>
    <div class="sheet-head"><span class="when">${esc(fmtLong(g.date))} ${parseISO(g.date).getUTCFullYear()} · ${esc(until(g.date))}</span>
    <button class="btn-round" data-close aria-label="Закрыть">${ICON.close}</button></div>
    <div class="board-card">${board(g)}${periodsLine(g)}</div>`;

  if (g.goals && g.goals.length) {
    html += `<div class="label">Голы<span class="aside">${g.goals.length}</span></div><div class="goals">`;
    let period = null;
    for (const x of g.goals) {
      if (x.period !== period) {
        period = x.period;
        html += `<div class="period"><span class="tag">${esc(PERIOD_NAMES[period] || period)}</span></div>`;
      }
      const tag = x.strength && x.strength !== "рав." ? `<span class="tag">${esc(x.strength.replace(".", ""))}</span>` : "";
      html += `<div class="goal">
        <div class="tm">${esc(x.period === "РБ" ? "Б" : x.time)}</div>
        ${emblem(x.team === "away" ? g.away : g.home)}
        <div class="who">${esc(x.author)}${tag}${x.assists.length ? `<div class="as">${x.assists.map(esc).join(", ")}</div>` : ""}</div>
        <div class="sc">${esc(x.score)}</div>
      </div>`;
    }
    html += `</div>`;
  }

  html += `<div class="label">О матче</div><div class="facts-card"><dl class="facts">`;
  if (g.n) html += `<dt>Номер</dt><dd>№ ${esc(g.n)}</dd>`;
  html += `<dt>Город</dt><dd>${esc(team(g.home).city)}</dd>`;
  if (g.time) html += `<dt>Начало</dt><dd>${esc(g.time)} местное</dd>`;
  if (g.attendance) html += `<dt>Зрители</dt><dd>${esc(Number(g.attendance).toLocaleString("ru-RU"))}</dd>`;
  html += `<dt>Календарь</dt><dd>${g.official ? "ФХР, официальный" : '<span class="tag soft">предварительно</span>'}</dd>`;
  if (g.score) html += `<dt>Источник счёта</dt><dd>протокол лиги</dd>`;
  html += `</dl></div>`;

  showSheet(html);
}

function showSheet(html) {
  const sheet = $("#sheet");
  sheet.innerHTML = html;
  sheet.hidden = false;
  $("#sheet-backdrop").hidden = false;
  sheet.scrollTop = 0;
  sheetOpener = document.activeElement;
  sheet.querySelector("[data-close]").focus({ preventScroll: true });
  if (inTelegram) {
    tg.BackButton.show();
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
  }
}

function closeMatch() {
  if ($("#sheet").hidden) return;
  $("#sheet").hidden = true;
  $("#sheet-backdrop").hidden = true;
  if (inTelegram) tg.BackButton.hide();
  if (sheetOpener && sheetOpener.isConnected) sheetOpener.focus({ preventScroll: true });
  sheetOpener = null;
}

// ---------- бегущая строка ----------

function fillMarquee() {
  const d = state.data;
  const first = d.games.length ? d.games[0].date : null;
  const played = d.games.filter((g) => g.score).length;
  const facts = [
    `${d.league} ${d.season}`,
    first && daysFromToday(first) > 0 ? `старт ${fmtLong(first)}` : `сыграно ${played} из ${d.games.length}`,
    `${d.teams.length} команд`,
    `${d.games.length} матчей`,
    "Восток и Запад",
    "8 лучших — в плей-офф",
  ];
  const once = facts.map((f) => `<span>${esc(f)}</span>`).join("");
  $("#marquee").innerHTML = once + once;
}

// ---------- навигация ----------

function render() {
  const screen = $("#screen");
  const onboarding = !state.fav;
  $("#tabs").hidden = onboarding;
  if (onboarding) {
    screen.innerHTML = renderOnboarding();
    addThemeToggle();
    return;
  }
  document.querySelectorAll("#tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === state.tab);
    if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  const views = { home: renderHome, calendar: renderCalendar, table: renderTable, me: renderMe };
  screen.innerHTML = views[state.tab]();
  addThemeToggle();
  const anchor = state.tab === "calendar" && !state.scrolledToNext && $("#next-anchor");
  if (anchor) {
    anchor.scrollIntoView({ block: "center" });
    state.scrolledToNext = true;
  } else if (state.tab !== "calendar") {
    window.scrollTo(0, 0);
  }
}

function haptic() {
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

function go(tab) {
  if (tab === state.tab) return;
  state.tab = tab;
  state.draft = null;
  if (tab === "calendar") state.scrolledToNext = false;
  haptic();
  render();
}

function confirmTeam(id = state.draft || state.fav) {
  if (!id) return;
  state.fav = id;
  state.draft = null;
  state.cal = { team: id, side: "all" };
  state.conf = team(id).conf;
  saveFav(id);
  closeMatch();
  state.tab = "home";
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  render();
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-tab],[data-game],[data-pick],[data-confirm],[data-cal-team],[data-cal-side],[data-conf],[data-team],[data-theme-pick],[data-theme-toggle],[data-close],[data-switch-open],[data-switch],[data-story],[data-invite],[data-remind],#sheet-backdrop");
  if (!el || el.disabled) return;
  if (el.hasAttribute("data-switch-open")) return openTeamSheet();
  if (el.dataset.switch) return confirmTeam(el.dataset.switch);
  if (el.hasAttribute("data-story")) return shareStory();
  if (el.hasAttribute("data-invite")) return shareLink(inviteLink(state.fav), `Болеем вместе за ${team(state.fav).name}: матчи, таблица и счёт РХЛ`);
  if (el.hasAttribute("data-remind")) {
    const url = `${state.data.links.bot}?start=remind`;
    return inTelegram ? tg.openTelegramLink(url) : window.open(url, "_blank", "noopener");
  }
  if (el.hasAttribute("data-theme-toggle")) return toggleTheme(el);
  if (el.dataset.themePick) {
    lsSet(THEME_KEY, el.dataset.themePick);
    applyTheme();
    haptic();
    return render();
  }
  if (el.id === "sheet-backdrop" || el.hasAttribute("data-close")) return closeMatch();
  if (el.hasAttribute("data-confirm")) return confirmTeam();
  if (el.dataset.tab) return go(el.dataset.tab);
  if (el.dataset.game) return openMatch(el.dataset.game);
  if (el.dataset.pick) {
    state.draft = el.dataset.pick;
    haptic();
    return render();
  }
  if (el.dataset.calTeam !== undefined) {
    state.cal = { team: el.dataset.calTeam || null, side: "all" };
    state.scrolledToNext = false;
    haptic();
    return render();
  }
  if (el.dataset.calSide) {
    state.cal.side = el.dataset.calSide;
    haptic();
    return render();
  }
  if (el.dataset.conf) {
    state.conf = el.dataset.conf;
    haptic();
    return render();
  }
  if (el.dataset.team) {
    state.cal = { team: el.dataset.team, side: "all" };
    state.scrolledToNext = false;
    state.tab = "calendar";
    return render();
  }
});

// Строки и карточки с role="button" нажимаются с клавиатуры, Esc закрывает карточку матча
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return closeMatch();
  if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"]')) {
    e.preventDefault();
    e.target.click();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "cal-team-select" && e.target.value) {
    state.cal = { team: e.target.value, side: "all" };
    state.scrolledToNext = false;
    render();
  }
});

// ---------- запуск ----------

function startParam() {
  const fromTg = inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  const q = new URLSearchParams(location.search);
  return fromTg || q.get("tgWebAppStartParam") || q.get("startapp") || q.get("team");
}

function pickFav(id) {
  state.fav = id;
  state.cal.team = id;
  state.conf = state.teams[id].conf;
}

function initTelegram() {
  const w = window.Telegram && window.Telegram.WebApp;
  if (!w || tg) return;
  tg = w;
  inTelegram = !!tg.initData;
  if (!inTelegram) return;
  tg.ready();
  tg.expand();
  tg.onEvent("themeChanged", applyTheme);
  tg.BackButton.onClick(closeMatch);
  if (!$("#sheet").hidden) tg.BackButton.show();
  applyTheme();
  // команда могла быть выбрана на другом устройстве — она в облаке Telegram
  const c = cloud();
  if (!state.fav && state.data && c) {
    c.getItem(FAV_KEY, (err, v) => {
      if (err || !v || !state.teams[v] || state.fav) return;
      lsSet(FAV_KEY, v);
      rememberSplash(v);
      pickFav(v);
      render();
    });
  }
}
window.__onTelegram = initTelegram;

function hideSplash() {
  const splash = $("#splash");
  if (!splash || splash.classList.contains("out")) return;
  const calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = calm ? 0 : Math.max(0, SPLASH_MIN_MS - (Date.now() - (window.__splashT0 || 0)));
  setTimeout(() => {
    splash.classList.add("out");
    setTimeout(() => splash.remove(), 420);
  }, wait);
}

function readCache() {
  try {
    const d = JSON.parse(lsGet(DATA_KEY));
    return d && Array.isArray(d.games) && Array.isArray(d.teams) ? d : null;
  } catch (e) {
    return null;
  }
}

async function fetchData() {
  const r = await fetch("data/league.json");   // тот же запрос, что в <link rel="preload">
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

function useData(d) {
  state.data = d;
  state.teams = {};
  d.teams.forEach((t) => { state.teams[t.id] = t; });
  fillMarquee();
}

function boot(d) {
  useData(d);
  const fromLink = startParam();
  const saved = lsGet(FAV_KEY);
  const fav = [fromLink, saved].find((id) => id && state.teams[id]);
  if (fav) {
    pickFav(fav);
    if (fromLink === fav && fav !== saved) saveFav(fav);
    else rememberSplash(fav);
  }
  render();
  hideSplash();
}

async function main() {
  applyTheme();
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  initTelegram();   // если скрипт Telegram уже успел загрузиться

  const fresh = fetchData();
  const cached = readCache();
  if (cached) boot(cached);
  try {
    const d = await fresh;
    const changed = !cached || d.updated !== cached.updated;
    if (changed) lsSet(DATA_KEY, JSON.stringify(d));
    if (!cached) {
      boot(d);
    } else if (changed) {
      const y = window.scrollY;
      useData(d);
      render();
      window.scrollTo(0, y);
    }
  } catch (err) {
    if (cached) return;
    $("#screen").innerHTML = `<div class="empty" style="margin-top:24px">Не удалось загрузить матчи. Проверьте интернет и откройте приложение ещё раз.</div>`;
    hideSplash();
  }
}

main();

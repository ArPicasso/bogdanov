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
const SPLASH_MIN_MS = 1400;         // буквы приземляются к 500 мс, остальное — полюбоваться (DESIGN.md)
const SPLASH_REPEAT_MS = 600;       // повторный запуск с данными на устройстве: только приземление букв

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
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
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
  cal: { team: null, side: "all", conf: "all" },
  conf: "east",
  scrolledToNext: false,
  h2h: null,        // история очных встреч (ADR-006): грузится при первом открытии карточки матча
  tableView: "teams",   // «Таблица»: команды или лидеры лиги (ADR-009)
  leadCat: "pts",
  leaders: null,    // лидеры лиги: грузятся при первом открытии «Игроков»
};

const $ = (sel) => document.querySelector(sel);

// ---------- движение (DESIGN.md → «Движение») ----------

const EASE_OUT = "cubic-bezier(.2, .8, .2, 1)";   // приход: быстро и с торможением
const EASE_IN = "cubic-bezier(.4, 0, 1, 1)";      // уход: с разгоном
const calm = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const nextFrame = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));   // после того, как кадр нарисован

// Бегунок — заливка выбранного в меню, сегментах и чипах. Он из трёх частей (полукруг, середина,
// полукруг) и двигается только transform: анимацию ведёт видеокарта, и она идёт ровно, даже пока
// основной поток перерисовывает экран. Ширина — масштабом середины, полукруги не искажаются
const RUN = '<i class="run" aria-hidden="true"><i class="l"></i><i class="m"></i><i class="r"></i></i>';
const runs = new WeakMap();   // бегунок → { from, to, anims }: чтобы подхватить его на лету

function runPose(r, cap) {
  return [
    `translateX(${r.x}px)`,
    `translateX(${r.x + cap - 0.5}px) scaleX(${Math.max(1, r.w - 2 * cap + 1)})`,
    `translateX(${r.x + r.w - cap}px)`,
  ];
}
// Где бегунок сейчас, с учётом идущей анимации
function runNow(run) {
  const st = runs.get(run);
  if (!st) return null;
  const a = st.anims && st.anims[0];
  if (!a || a.playState !== "running" || !st.from) return st.to;
  const p = a.effect.getComputedTiming().progress || 0;
  return { x: st.from.x + (st.to.x - st.from.x) * p, w: st.from.w + (st.to.w - st.from.w) * p };
}
function moveRun(run, to, animate, duration = 260) {
  const cap = run.offsetHeight / 2;
  const from = runNow(run);
  const st = runs.get(run);
  if (st && st.anims) st.anims.forEach((a) => a.cancel());
  const parts = [...run.children];
  const end = runPose(to, cap);
  parts.forEach((el, i) => { el.style.transform = end[i]; });
  const rec = { from, to, anims: null };
  if (animate && from && !calm() && (Math.abs(from.x - to.x) > 0.5 || Math.abs(from.w - to.w) > 0.5)) {
    const begin = runPose(from, cap);
    rec.anims = parts.map((el, i) => el.animate([{ transform: begin[i] }, { transform: end[i] }], { duration, easing: EASE_OUT }));
  }
  runs.set(run, rec);
}

// Группы с бегунком помечены data-run — по этому ключу бегунок находит своё прежнее место,
// когда группу перерисовали заново
function runnerState(root) {
  const m = {};
  root.querySelectorAll("[data-run] > .run").forEach((r) => {
    const now = runNow(r);
    if (now) m[r.parentNode.dataset.run] = now;
  });
  return m;
}
function placeRunner(group, from) {
  const run = group.querySelector(":scope > .run");
  const on = group.querySelector(":scope > button.on");
  if (!run || !on || !on.offsetWidth) return;
  if (from && !runs.has(run)) runs.set(run, { from: null, to: from, anims: null });
  moveRun(run, { x: on.offsetLeft, w: on.offsetWidth }, !!from);
  group.classList.add("ready");
}
function placeRunners(root, prev = {}) {
  root.querySelectorAll("[data-run]").forEach((g) => placeRunner(g, prev[g.dataset.run]));
}

// Меню: ширина вкладок меняется сразу, а глаз видит плавное — бегунок едет, иконки съезжают
// со старых мест (FLIP), подпись проявляется. Всё это transform и opacity
function setTab(tab, animate) {
  const nav = $("#tabs");
  const btns = [...nav.querySelectorAll("button")];
  const flip = animate && !calm() && !nav.hidden;
  const before = flip ? btns.map((b) => b.querySelector("svg").getBoundingClientRect().left) : null;
  btns.forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (nav.hidden) return;
  const on = nav.querySelector("button.active");
  moveRun(nav.querySelector(".run"), { x: on.offsetLeft, w: on.offsetWidth }, animate, 300);
  nav.classList.add("ready");
  if (!flip) return;
  btns.forEach((b, i) => {
    const svg = b.querySelector("svg");
    svg.getAnimations().forEach((a) => a.cancel());
    const dx = before[i] - svg.getBoundingClientRect().left;
    if (Math.abs(dx) > 0.5) svg.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 300, easing: EASE_OUT });
  });
  on.querySelector("span").animate([{ opacity: 0, transform: "translateX(-6px)" }, { opacity: 1, transform: "none" }],
    { duration: 220, delay: 60, easing: EASE_OUT, fill: "backwards" });
}

// Цифры сезона на Главной досчитывают до значения — раз в день, не при каждой смене вкладки
const COUNT_KEY = "countup_day";
function countUp(root) {
  const els = root.querySelectorAll("[data-count]");
  if (!els.length || calm() || lsGet(COUNT_KEY) === todayISO()) return;
  lsSet(COUNT_KEY, todayISO());
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / 400);
    const e = 1 - Math.pow(1 - t, 3);
    els.forEach((el) => { el.textContent = String(Math.round(+el.dataset.count * e)); });
    if (t < 1) requestAnimationFrame(step);
  };
  els.forEach((el) => { el.textContent = "0"; });
  requestAnimationFrame(step);
}

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
  const theme = themeOf(themePref());
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
// Кнопки темы обновляются на месте, экран не перерисовывается
function syncThemeUI() {
  const pref = themePref();
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-label", toggleLabel()));
  document.querySelectorAll("[data-theme-pick]").forEach((b) => {
    const on = b.dataset.themePick === pref;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
  });
}
// Новая тема раскрывается кругом от нажатой кнопки: одна анимация снимка экрана вместо
// перехода цвета у каждого узла. Без View Transitions — прежний переход цвета, но только на
// небольших экранах: у «Всей лиги» тысячи узлов, там переключаем сразу
let themeAnimTimer = 0;
function switchTheme(pref, from) {
  const root = document.documentElement;
  lsSet(THEME_KEY, pref);
  const before = root.dataset.theme;
  const swap = () => { applyTheme(); syncThemeUI(); };
  if (calm() || themeOf(pref) === before) return swap();
  if (document.startViewTransition) {
    const r = from.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(swap);
    vt.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
      { duration: 420, easing: EASE_OUT, pseudoElement: "::view-transition-new(root)" },
    )).catch(() => {});
    return;
  }
  if (document.getElementsByTagName("*").length < 2500) {
    root.classList.add("theme-anim");
    clearTimeout(themeAnimTimer);
    themeAnimTimer = setTimeout(() => root.classList.remove("theme-anim"), 400);
  }
  swap();
}
function themeOf(pref) {
  return pref === "auto" ? systemTheme() : pref;
}
function toggleTheme(btn) {
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
  switchTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", btn);
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
  if (t.logo) return `<span class="${cls}"><img src="${esc(t.logo)}" alt=""></span>`;
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
    // в основное время подписи нет: счёт сам говорит, что матч сыгран
    const dec = { "ОТ": "овертайм", "Б": "буллиты" }[g.score.decision];
    mid = `<div class="score">${g.score.home}:${g.score.away}${dec ? `<span class="dec">${dec}</span>` : ""}</div>`;
  } else {
    mid = `<div class="score pending">${g.time ? esc(g.time) : "vs"}<span class="dec">${until(g.date)}</span></div>`;
  }
  return `<div class="board">${side(g.home)}${mid}${side(g.away)}</div>`;
}

function periodsLine(g) {
  if (!g.score || !g.score.periods || !g.score.periods.length) return "";
  return `<div class="periods">${g.score.periods.map((p) => `<span class="num">${p[0]}:${p[1]}</span>`).join("")}</div>`;
}

// Строка календаря одной команды: команда уже названа фильтром, в строке — только соперник
function gameRow(g, me, next) {
  const d = parseISO(g.date);
  const past = !!g.score;
  const home = g.home === me;
  const opp = home ? g.away : g.home;
  const where = home
    ? '<span class="where home">Дома</span>'
    : `<span class="where away">Выезд</span><span class="city">${esc(team(g.home).city)}</span>`;
  let right = `<span class="kick">${g.time ? esc(g.time) : ""}</span>`;
  if (past) {
    const mine = home ? g.score.home : g.score.away;
    const their = home ? g.score.away : g.score.home;
    const res = me === state.fav ? resultPill(g) : "";
    right = `<span class="sc num">${mine}:${their}</span>${res}`;
  }
  return `<div class="row one${past ? " past" : ""}${next ? " next" : ""}" data-game="${esc(g.id)}" data-date="${esc(g.date)}" role="button" tabindex="0"${next ? ' id="next-anchor"' : ""}>
    <div class="date"><b>${d.getUTCDate()}</b><span>${MON_SHORT[d.getUTCMonth()]} ${DOW[d.getUTCDay()]}</span></div>
    <div class="t"><div>${emblem(opp)}<span class="nm">${esc(team(opp).name)}</span></div><div class="sub">${where}</div></div>
    <div class="r">${right}</div>
  </div>`;
}

// Строка «Вся лига»: без даты — её даёт подзаголовок дня
function leagueRow(g) {
  const past = !!g.score;
  const lead = (id) => (id === g.home ? g.score.home > g.score.away : g.score.away > g.score.home);
  const goals = (id) => (past ? `<span class="gl${lead(id) ? " lead" : ""}">${id === g.home ? g.score.home : g.score.away}</span>` : "");
  const line = (id) => `<div>${emblem(id)}<span class="nm${id === state.fav ? " me" : ""}">${esc(team(id).name)}</span>${goals(id)}</div>`;
  const right = past ? resultPill(g) : `<span class="kick">${g.time ? esc(g.time) : ""}</span>`;
  return `<div class="row two${past ? " past" : ""}" data-game="${esc(g.id)}" role="button" tabindex="0">
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
function seasonStats(me, count = false) {
  const st = standingOf(me);
  const mine = gamesOf(me);
  // На Главной цифры досчитывают до значения (countUp), в паспорте — стоят
  const n = (v) => (count ? `<b data-count="${v}">${v}</b>` : `<b>${v}</b>`);
  if (st && st.row.gp) {
    const form = st.row.form.length ? `<span class="form">${st.row.form.map((f) => `<i class="${f}"></i>`).join("")}</span>` : "—";
    return `<div class="stat">${n(st.place)}<span>место<br>${CONF[st.conf]}</span></div>
      <div class="stat">${n(st.row.pts)}<span>${plural(st.row.pts, "очко", "очка", "очков")}<br>за ${st.row.gp} ${plural(st.row.gp, "игру", "игры", "игр")}</span></div>
      <div class="stat"><b>${form}</b><span>форма<br>5 игр</span></div>`;
  }
  if (!mine.length) return "";
  const home = mine.filter((g) => g.home === me).length;
  const days = Math.max(daysFromToday(mine[0].date), 0);
  return `<div class="stat">${n(mine.length)}<span>матчей<br>в сезоне</span></div>
    <div class="stat">${n(home)}<span>дома,<br>${mine.length - home} на выезде</span></div>
    <div class="stat">${n(days)}<span>${plural(days, "день", "дня", "дней")}<br>до старта</span></div>`;
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

  const stats = seasonStats(me, true);
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
      <div class="list">${upcoming.map((g) => gameRow(g, me, false)).join("")}</div>`;
  }
  return html + footer();
}

function calFor(id) {
  return { team: id || null, side: "all", conf: "all" };
}

function segBtn(on, attrs, inner) {
  return `<button type="button" class="${on ? "on" : ""}" ${attrs} aria-pressed="${on}">${inner}</button>`;
}

function calendarList() {
  const { team: teamId, side, conf } = state.cal;
  let list = teamId ? gamesOf(teamId) : games();
  if (teamId && side !== "all") list = list.filter((g) => (side === "home" ? g.home === teamId : g.away === teamId));
  if (!teamId && conf !== "all") list = list.filter((g) => team(g.home).conf === conf || team(g.away).conf === conf);
  return list;
}

// Полоса фильтров Календаря: обновляется на месте, бегунки перетекают к новому выбору
function filterbarInner() {
  const { team: teamId, side, conf } = state.cal;
  const other = teamId && teamId !== state.fav;
  const chev = '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg>';
  // Вторичный фильтр всегда на месте: у команды — дом/выезд, у лиги — конференция. Высота полосы не прыгает
  const sub = teamId
    ? [["all", "Все"], ["home", "Дома"], ["away", "Выезд"]].map(([k, v]) => segBtn(side === k, `data-cal-side="${k}"`, v))
    : [["all", "Все"], ["east", "Восток"], ["west", "Запад"]].map(([k, v]) => segBtn(conf === k, `data-cal-conf="${k}"`, v));
  const otherName = other ? esc(team(teamId).name) : "Другая";
  return `<div class="seg" role="group" aria-label="Чей календарь" data-run="cal-team">${RUN}
        ${segBtn(teamId === state.fav, `data-cal-team="${esc(state.fav)}"`, "<span>Моя команда</span>")}
        ${segBtn(!teamId, 'data-cal-team=""', "<span>Вся лига</span>")}
        ${segBtn(other, 'data-cal-other aria-haspopup="dialog"', `<span>${otherName}</span>${chev}`)}
      </div>
      <div class="chips" role="group" aria-label="${teamId ? "Где играют" : "Конференция"}" data-run="cal-sub">${RUN}${sub.join("")}</div>`;
}

// Высота месяца до первого показа: строка команды ~65px, строка лиги ~75px, день ~31px.
// По ней браузер держит место под месяцы вне экрана (content-visibility)
const MONTH_H = { label: 46, one: 65, two: 75, day: 31 };

// upto — месяц «ГГГГ-ММ», до которого включительно месяцы раскладываются сразу: выше видимого
// места высота должна быть настоящей, иначе прокрутка вверх дёргается (style.css → .month)
function calendarMonths(list, upto) {
  const teamId = state.cal.team;
  const nextId = (list.find(isUpcoming) || {}).id;
  const nextDay = nextId ? list.find((x) => x.id === nextId).date : null;
  if (upto === undefined) upto = nextDay ? nextDay.slice(0, 7) : "";
  const byMonth = new Map();
  for (const g of list) {
    const m = g.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(g);
  }
  let html = "";
  for (const [key, month] of byMonth) {
    const d = parseISO(month[0].date);
    const count = month.length;
    let body = "";
    let day = "";
    let days = 0;
    for (const g of month) {
      if (teamId) {
        body += gameRow(g, teamId, g.id === nextId);
        continue;
      }
      if (g.date !== day) {
        day = g.date;
        days += 1;
        const next = day === nextDay;
        const today = daysFromToday(day) === 0;
        body += `<div class="day${next ? " next" : ""}" data-date="${esc(day)}"${next ? ' id="next-anchor"' : ""}><span>${esc(fmtLong(day))}</span>${today ? '<span class="tag today">Сегодня</span>' : ""}</div>`;
      }
      body += leagueRow(g);
    }
    const h = MONTH_H.label + count * (teamId ? MONTH_H.one : MONTH_H.two) + days * MONTH_H.day;
    html += `<section class="month${key <= upto ? " open" : ""}" style="contain-intrinsic-size: auto ${h}px"><div class="label">${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}<span class="aside">${count} ${plural(count, "матч", "матча", "матчей")}</span></div><div class="list">${body}</div></section>`;
  }
  if (!list.length) html += `<div class="empty">Матчей нет</div>`;
  return html;
}

function renderCalendar() {
  let html = `<section class="band lavender split"><h1>Календарь</h1></section>
    <div class="filterbar">${filterbarInner()}</div>`;
  html += `<div id="cal-list">${calendarMonths(calendarList())}</div>`;
  html += `<div class="foot">Официальный календарь ФХР пока есть только у «Рязань-ВДВ». Остальные даты — предварительные, уточним после открытия сайта РХЛ.</div>`;
  return html;
}

// День, который сейчас виден у верха списка под прилипшими фильтрами
function visibleDay() {
  const bar = $(".filterbar");
  if (!bar) return null;
  const top = bar.getBoundingClientRect().bottom;
  for (const el of document.querySelectorAll("#cal-list [data-date]")) {
    const r = el.getBoundingClientRect();
    if (r.bottom > top) return r.top < top + 8 ? { date: el.dataset.date, top: r.top } : null;
  }
  return null;
}

// Смена фильтра Календаря: сначала отвечает нажатая кнопка, список — в следующем кадре.
// keep — остаться на том же дне; иначе — к ближайшему матчу
let calToken = 0;
function refreshCalendar(keep) {
  const bar = $(".filterbar");
  if (!bar) return render();
  const prev = runnerState(bar);
  bar.innerHTML = filterbarInner();
  placeRunners(bar, prev);
  const token = ++calToken;
  const anchor = keep ? visibleDay() : null;
  nextFrame(() => {
    if (token !== calToken || state.tab !== "calendar") return;
    const list = calendarList();
    $("#cal-list").innerHTML = calendarMonths(list, anchor ? anchor.date.slice(0, 7) : undefined);
    if (anchor) {
      const els = [...document.querySelectorAll("#cal-list [data-date]")];
      const el = els.find((x) => x.dataset.date >= anchor.date) || els[els.length - 1];
      if (el) window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - anchor.top);
    } else if (!keep) {
      const next = $("#next-anchor");
      if (next) next.scrollIntoView({ block: "center" });
    }
  });
}

function renderTable() {
  return `<section class="band mint"><h1>Таблица</h1><div id="table-filters">${tableFilters()}</div></section>
    <div id="table-body">${state.tableView === "players" ? leadersBody() : tableBody()}</div>`;
}

// Шапка «Таблицы»: «Команды · Игроки», под ними конференции или показатели (ADR-009).
// Пилюли — во всю ширину: конференции в один ряд, шесть показателей — сеткой 3×2, все на виду
function tableFilters() {
  const players = state.tableView === "players";
  const pills = players
    ? LEAD_CATS.map(([k, v]) => `<button class="${state.leadCat === k ? "on" : ""}" data-lead-cat="${k}" aria-pressed="${state.leadCat === k}">${v}</button>`)
    : Object.entries(CONF).map(([k, v]) => `<button class="${state.conf === k ? "on" : ""}" data-conf="${k}" aria-pressed="${state.conf === k}">${v}</button>`);
  return `<div class="seg table-seg" role="group" aria-label="Что показать" data-run="table-view">${RUN}
      ${segBtn(!players, 'data-table-view="teams"', "<span>Команды</span>")}
      ${segBtn(players, 'data-table-view="players"', "<span>Игроки</span>")}
    </div>
    <div class="pills fill" style="--n:${players ? 3 : 2}" role="group" aria-label="${players ? "Показатель" : "Конференция"}">${pills.join("")}</div>`;
}

// «Команды · Игроки»: бегунок перетекает сразу, список — в следующем кадре
function refreshTable() {
  const bar = $("#table-filters");
  if (!bar) return render();
  const prev = runnerState(bar);
  bar.innerHTML = tableFilters();
  placeRunners(bar, prev);
  nextFrame(() => {
    const box = $("#table-body");
    if (!box || state.tab !== "table") return;
    box.innerHTML = state.tableView === "players" ? leadersBody() : tableBody();
    fadeIn(box);
  });
}

function tableBody() {
  const conf = state.conf;
  const rows = state.data.standings[conf] || [];
  let html = `<div class="st"><div class="st-row head"><span class="pos"></span><span class="tm">Команда</span><span>И</span><span class="wl">В</span><span class="wl">П</span><span>Ш</span><span>О</span></div>`;
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

// ---------- лидеры лиги (ADR-009) ----------

// Показатель → подпись пилюли и колонки строки; выбранная колонка — жирным
const LEAD_CATS = [["pts", "Бомбардиры"], ["g", "Снайперы"], ["a", "Ассистенты"], ["pm", "+/−"], ["sv_pct", "Вратари"], ["pim", "Штраф"]];
const LEAD_COLS = {
  pts: [["gp", "И"], ["g", "Ш"], ["a", "А"], ["pts", "О"]],
  g: [["gp", "И"], ["g", "Ш"], ["a", "А"], ["pts", "О"]],
  a: [["gp", "И"], ["g", "Ш"], ["a", "А"], ["pts", "О"]],
  pm: [["gp", "И"], ["pts", "О"], ["pm", "+/−"]],
  pim: [["gp", "И"], ["pts", "О"], ["pim", "Штр"]],
  sv_pct: [["gp", "И"], ["gaa", "КН"], ["sv_pct", "%ОБ"]],
};
const LEAD_LEGEND = {
  pts: "И — игры, Ш — голы, А — передачи, О — очки: гол или передача",
  pm: "+/− — забитые минус пропущенные шайбы, пока игрок на льду; голы в большинстве не считаются",
  pim: "Штр — штрафные минуты",
  sv_pct: "%ОБ — отражённые броски, КН — пропущено в среднем за 60 минут. Вратари с малым игровым временем в список лиги не входят",
};

let leadersLoading = null;
let leadersFailed = false;   // не качаем по кругу: после ошибки — «Повторить»
function loadLeaders() {
  if (!leadersLoading) {
    leadersFailed = false;
    leadersLoading = fetch("data/leaders.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => (state.leaders = d))
      .catch(() => { leadersLoading = null; leadersFailed = true; return null; });
  }
  return leadersLoading;
}
function fillLeaders() {
  loadLeaders().then(() => {
    const box = $("#table-body");
    if (!box || state.tab !== "table" || state.tableView !== "players") return;
    box.innerHTML = leadersBody();
    fadeIn(box);
  });
}

function leadValue(k, v) {
  if (v == null) return "—";
  if (k === "pm") return v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0";
  if (k === "sv_pct" || k === "gaa") return String(v.toFixed(k === "gaa" ? 2 : 1)).replace(".", ",");
  return String(v);
}

function leaderRow(r, cols, main) {
  const club = r.team
    ? `${emblem(r.team)}<span>${esc(team(r.team).name)}</span>`
    : `<span>${esc(r.club)}</span>`;
  return `<div class="st-row lead-row${r.team && r.team === state.fav ? " me" : ""}">
    <span class="pos">${r.rank}</span>
    <span class="pl"><b>${esc(r.name)}</b><small>${club}</small></span>
    ${cols.map(([k]) => `<span class="${k === main ? "pts" : "n"}${k === "gp" ? " wl" : ""}">${leadValue(k, r[k])}</span>`).join("")}
  </div>`;
}

function leadersBody() {
  const d = state.leaders;
  if (!d && leadersFailed) return failBlock("Лидеры лиги", "leaders");
  if (!d) {
    fillLeaders();
    return `<div class="sk sk-label"></div><div class="sk" style="height:${38 + 10 * 57}px"></div>`;
  }
  const cat = state.leadCat;
  const rows = d.categories[cat] || [];
  const cols = LEAD_COLS[cat];
  const top = rows.filter((r) => r.rank <= 10);
  const mine = state.fav && !top.some((r) => r.team === state.fav) && rows.find((r) => r.team === state.fav);
  const past = d.season !== state.data.season;
  let html = `<div class="label">${esc(d.league)} ${esc(d.season)}<span class="aside">${past ? "прошлый сезон" : esc(d.stage)}</span></div>`;
  html += `<div class="st lead" style="--cols:${cols.length}"><div class="st-row lead-row head"><span class="pos"></span><span class="pl">Игрок</span>${cols
    .map(([k, l]) => `<span class="${k === "gp" ? "wl" : ""}">${l}</span>`).join("")}</div>`;
  html += top.map((r) => leaderRow(r, cols, cat)).join("");
  if (mine) html += `<div class="cut"><span>лучший в команде</span></div>${leaderRow(mine, cols, cat)}`;
  html += `</div>`;
  if (!top.length) html += `<div class="empty">Список появится после первых матчей</div>`;
  const legend = LEAD_LEGEND[cat] || LEAD_LEGEND.pts;
  html += `<div class="foot">${legend}.<br>${past
    ? `Статистика регулярного чемпионата ${esc(d.league)} ${esc(d.season)} с сайта лиги. Клубы — под нынешними названиями. Лидеры сезона ${esc(state.data.season)} появятся после первого тура.`
    : "Места — как в статистике на сайте лиги."}</div>`;
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
  html += `<div style="height:88px"></div><div class="cta-bar${chosen ? "" : " wait"}"><button class="btn" data-confirm${chosen ? "" : " disabled"}>${label}</button></div>`;
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

// Тот же лист из Календаря: выбор показывает календарь клуба, любимая команда не меняется
function openCalSheet() {
  const html = `<div class="grab"></div>
    <div class="sheet-head"><span class="when">Календарь команды</span>
    <button class="btn-round" data-close aria-label="Закрыть">${ICON.close}</button></div>
    ${teamGrid(state.cal.team, "data-cal-pick")}`;
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

// ---------- очные встречи (ADR-006) ----------

let h2hLoading = null;
function loadH2H() {
  if (!h2hLoading) {
    h2hLoading = fetch("data/h2h.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => (state.h2h = d))
      .catch(() => { h2hLoading = null; return null; });
  }
  return h2hLoading;
}
const pairKey = (a, b) => [a, b].sort().join("|");
const shortDate = (iso) => { const d = parseISO(iso); return `${d.getUTCDate()} ${MON_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

// Вывод одной строкой. Прогноз не даём: только «по истории встреч»
function h2hVerdict(h, a, b) {
  const wa = h.wins[a], wb = h.wins[b];
  if (h.games < 3) return `Встречались ${h.games} ${plural(h.games, "раз", "раза", "раз")} — по истории фаворита не назвать`;
  if (wa === wb) return `История равная: по ${wa} ${plural(wa, "победе", "победы", "побед")}`;
  const [fav, w] = wa > wb ? [a, wa] : [b, wb];
  return `По истории встреч сильнее ${team(fav).name}: ${w} ${plural(w, "победа", "победы", "побед")} из ${h.games}`;
}

// Место под очные встречи, пока они грузятся: та же высота, что у карточки и пяти встреч
function h2hSkeleton() {
  return `<div class="sk sk-label"></div><div class="sk" style="height:152px"></div><div class="sk sk-label"></div><div class="sk" style="height:${5 * 75}px"></div>`;
}
function failBlock(title, what) {
  return `<div class="label">${title}</div><div class="empty">Не удалось загрузить. Проверьте интернет.<br><button type="button" class="retry" data-retry="${what}">Повторить</button></div>`;
}
function fadeIn(el) {
  if (el && !calm()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
}
function fillH2H(g) {
  loadH2H().then(() => {
    const box = $("#h2h");
    if (!box || $("#sheet").hidden || box.dataset.pair !== pairKey(g.home, g.away)) return;
    box.innerHTML = state.h2h ? h2hBlock(g) : failBlock("Очные встречи", "h2h");
    fadeIn(box);
  });
}

function h2hBlock(g) {
  const h = state.h2h && state.h2h[pairKey(g.home, g.away)];
  const label = (aside) => `<div class="label">Очные встречи${aside ? `<span class="aside">${aside}</span>` : ""}</div>`;
  if (!h || !h.games) return `${label("")}<div class="empty">В НМХЛ и РХЛ раньше не встречались</div>`;
  const a = g.home, b = g.away;
  const share = Math.round((100 * h.wins[a]) / h.games);
  let html = label(`${h.games} ${plural(h.games, "матч", "матча", "матчей")} с ${esc(h.since)} года`);
  html += `<div class="h2h">
    <div class="h2h-row"><span class="h2h-em">${emblem(a)}</span><b class="num">${h.wins[a]}</b><span>победы</span><b class="num">${h.wins[b]}</b><span class="h2h-em">${emblem(b)}</span></div>
    <div class="h2h-bar" role="img" aria-label="Победы: ${esc(team(a).name)} ${h.wins[a]}, ${esc(team(b).name)} ${h.wins[b]}"><i style="width:${share}%"></i></div>
    <div class="h2h-row goals-row"><span></span><b class="num">${h.goals[a]}</b><span>шайбы</span><b class="num">${h.goals[b]}</b><span></span></div>
    <div class="h2h-verdict">${esc(h2hVerdict(h, a, b))}</div>
  </div>`;
  const tappable = h.last.some((m) => m.id);
  html += `<div class="label">Последние встречи${tappable ? `<span class="aside">нажми — будет разбор</span>` : ""}</div><div class="list">${h.last.map((m) => {
    const lead = (id) => (id === m.home ? m.score[0] > m.score[1] : m.score[1] > m.score[0]);
    const line = (id, goals) => `<div>${emblem(id)}<span class="nm${lead(id) ? " me" : ""}">${esc(team(id).name)}</span><span class="gl${lead(id) ? " lead" : ""}">${goals}</span></div>`;
    const dec = m.decision ? `<span class="res l">${esc(m.decision)}</span>` : "";
    // встреча с разбором (ADR-008) открывается, как матч календаря
    const attrs = m.id ? ` role="button" tabindex="0" data-game="${esc(m.id)}" aria-label="${esc(`Разбор матча ${team(m.home).name} — ${team(m.away).name}, ${shortDate(m.date)}`)}"` : "";
    return `<div class="row two${m.id ? "" : " static"}"${attrs}><div class="t">${line(m.home, m.score[0])}${line(m.away, m.score[1])}</div><div class="r">${dec}<span class="kick when">${esc(shortDate(m.date))}</span></div></div>`;
  }).join("")}</div>`;
  return html;
}

// ---------- карточка матча ----------

let sheetOpener = null;   // куда вернуть фокус после закрытия карточки

// ---------- разбор сыгранного матча (ADR-008) ----------

const recaps = {};                 // id матча → data/matches/<id>.json, грузится при открытии карточки
const recapLoading = {};
const recapMissing = new Set();      // у матча нет файла разбора (протокола нет) — это не ошибка
const recapView = { id: null, tab: "goals", pens: false, side: "home", pick: null, drawn: null };

// null — разбора нет, false — не загрузился (сеть), можно повторить
function loadRecap(id) {
  if (!recapLoading[id]) {
    recapLoading[id] = fetch(`data/matches/${encodeURIComponent(id)}.json`)
      .then((r) => (r.ok ? r.json() : r.status === 404 ? null : Promise.reject(new Error(r.status))))
      .then((d) => {
        if (d) recaps[id] = d;
        else recapMissing.add(id);
        return d;
      })
      .catch(() => { delete recapLoading[id]; return false; });
  }
  return recapLoading[id];
}

// Место под разбор, пока он грузится: сюжет, график, вкладки и голы
function recapSkeleton(g) {
  const n = Math.max(1, (g.goals || []).length);
  return `<div class="sk" style="height:76px;margin-top:12px"></div><div class="sk sk-label"></div><div class="sk" style="height:300px"></div>
    <div class="sk" style="height:40px;margin-top:24px;border-radius:9999px"></div><div class="sk" style="height:${n * 52 + 40}px;margin-top:14px"></div>`;
}
function fillRecap(id) {
  loadRecap(id).then((d) => {
    const box = $("#recap");
    if (recapView.id !== id || !box || $("#sheet").hidden) return;
    if (d === false) {
      box.innerHTML = failBlock("Разбор матча", "recap");
      return fadeIn(box);
    }
    if (d && d.gw != null) recapView.pick = d.gw;
    rerenderRecap();
    fadeIn(box);
  });
}

// Матч этого сезона — из league.json, прошлого — целиком из своего файла разбора
const findGame = (id) => games().find((x) => x.id === id) || (recaps[id] && recaps[id].game) || null;
const sheetStack = [];   // из прошлой встречи «Назад» ведёт в матч, откуда её открыли
const STAGE = { regular: "регулярный чемпионат", playoff: "плей-офф" };

const secs = (t) => { const [m, s] = String(t).split(":").map(Number); return m * 60 + (s || 0); };
const sideTeam = (g, side) => (side === "away" ? g.away : g.home);

function strengthTag(x, i, d) {
  if (x.period === "РБ") return `<span class="tag soft">победный буллит</span>`;
  const st = x.strength && x.strength !== "рав." ? `<span class="tag">${esc(x.strength.replace(".", ""))}</span>` : "";
  const gw = d && d.gw === i ? `<span class="tag soft">победная</span>` : "";
  return st + gw;
}

// Ход матча: разница в счёте по минутам. Мятное — ведут хозяева, лавандовое — гости (DESIGN.md)
function flowChart(g, d) {
  const goals = (g.goals || []).map((x, i) => ({ ...x, i })).filter((x) => x.period !== "РБ");
  if (!goals.length) return "";
  const length = (d && d.length) || (g.score.decision ? 65 : 60);
  let run = 0;
  const leads = goals.map((x) => (run += x.team === "home" ? 1 : -1));
  const up = Math.max(2, ...leads), dn = Math.max(2, ...leads.map((v) => -v));
  const W = 340, x0 = 30, x1 = 334, u = 11, yc = 14 + up * u;
  const X = (sec) => x0 + ((x1 - x0) * Math.min(sec, length * 60)) / (length * 60);
  const Y = (v) => yc - v * u;
  const bot = Y(-dn) + 4;
  const lane = { home: bot + 20, away: bot + 34 };
  const hAbbr = esc(team(g.home).abbr), aAbbr = esc(team(g.away).abbr);

  const pts = [[X(0), yc]];
  let diff = 0;
  const dots = goals.map((x) => {
    const px = X(secs(x.time));
    pts.push([px, Y(diff)]);
    diff += x.team === "home" ? 1 : -1;
    pts.push([px, Y(diff)]);
    return { x: px, y: Y(diff), g: x };
  });
  pts.push([X(length * 60), Y(diff)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${X(length * 60).toFixed(1)} ${yc} Z`;

  // Периоды — колонки: чётные подложены тоном, границы сплошные, подпись внизу колонки
  const periods = [["1-й период", 0, 1200], ["2-й период", 1200, 2400], ["3-й период", 2400, 3600]];
  if (length > 60) periods.push(["ОТ", 3600, length * 60]);
  const top = Y(up) - 10, bottom = lane.away + 30;
  const bands = periods.map(([, a, b], i) => (i % 2
    ? `<rect x="${X(a).toFixed(1)}" y="${top}" width="${(X(b) - X(a)).toFixed(1)}" height="${bottom - top}" class="fl-band"/>` : "")).join("");
  const grid = periods.slice(1).map(([, a]) => `<line x1="${X(a)}" x2="${X(a)}" y1="${top}" y2="${bottom}" class="fl-grid"/>`).join("");
  const plabels = periods.map(([l, a, b]) => `<text class="fl-per" x="${((X(a) + X(b)) / 2).toFixed(1)}" y="${lane.away + 23}" text-anchor="middle">${X(b) - X(a) < 60 ? l.replace(" период", "") : l}</text>`).join("");

  // удаление на 2/4/5 минут — полоса до конца штрафа или до гола в большинстве; остальные — точка
  const pens = ((d && d.penalties) || []).map((p) => {
    const s0 = secs(p.time);
    let s1 = [2, 4, 5].includes(p.min) ? s0 + p.min * 60 : s0;
    if (p.min === 2) {
      const pp = goals.find((x) => x.team !== p.team && x.strength.startsWith("бол") && secs(x.time) > s0 && secs(x.time) < s1);
      if (pp) s1 = secs(pp.time);
    }
    const w = Math.max(5, X(s1) - X(s0));
    return `<rect x="${X(s0).toFixed(1)}" y="${lane[p.team] - 3}" width="${w.toFixed(1)}" height="6" rx="3" class="fl-pen"><title>${esc(p.time)} · ${esc(p.who)}, ${esc(p.min)} мин</title></rect>`;
  }).join("");

  const pick = recapView.pick;
  // Первый показ матча — график рисуется слева направо, точки выскакивают, когда до них дошла линия
  const draw = recapView.drawn !== g.id;
  recapView.drawn = g.id;
  const dotEls = dots.map((o) => {
    const pp = o.g.strength && o.g.strength.startsWith("бол");
    const delay = draw ? ` style="--d:${Math.round((600 * (o.x - x0)) / (x1 - x0))}ms"` : "";
    return `<g class="fl-dot${pp ? " pp" : ""}${o.g.i === pick ? " on" : ""}" data-recap-goal="${o.g.i}"${delay} role="button" tabindex="0" aria-label="${esc(`Гол ${o.g.time}, ${o.g.author}, счёт ${o.g.score}`)}"><circle cx="${o.x.toFixed(1)}" cy="${o.y}" r="14" class="hit"/><circle cx="${o.x.toFixed(1)}" cy="${o.y}" r="${o.g.i === pick ? 6 : 4.5}" class="v"/></g>`;
  }).join("");

  const cur = g.goals[pick] || goals[goals.length - 1];
  const hasPens = d && d.penalties && d.penalties.length;
  return `<div class="label">Ход матча<span class="aside">разница в счёте</span></div>
  <div class="flow${draw ? " draw" : ""}">
    <div class="fl-plot">${draw ? `<i class="fl-cover" style="left:${((100 * x0) / W).toFixed(2)}%"></i>` : ""}<svg viewBox="0 0 ${W} ${lane.away + 30}" role="img" aria-label="Разница в счёте по ходу матча">
      <defs><clipPath id="fl-up"><rect x="0" y="0" width="${W}" height="${yc}"/></clipPath>
        <clipPath id="fl-dn"><rect x="0" y="${yc}" width="${W}" height="${W}"/></clipPath></defs>
      ${bands}${grid}
      <line x1="${x0}" x2="${x1}" y1="${yc}" y2="${yc}" class="fl-axis"/>
      <path d="${area}" class="fl-home" clip-path="url(#fl-up)"/>
      <path d="${area}" class="fl-away" clip-path="url(#fl-dn)"/>
      <path d="${line}" class="fl-line"/>
      <text class="fl-ax" x="${x0 - 6}" y="${Y(up) + 3}" text-anchor="end">+${up}</text>
      <text class="fl-ax" x="${x0 - 6}" y="${yc + 3}" text-anchor="end">0</text>
      <text class="fl-ax" x="${x0 - 6}" y="${Y(-dn) + 3}" text-anchor="end">−${dn}</text>
      <text class="fl-ax" x="${x0 + 4}" y="${Y(up) + 3}">ВЕДЁТ ${hAbbr}</text>
      <text class="fl-ax" x="${x0 + 4}" y="${Y(-dn) + 3}">ВЕДЁТ ${aAbbr}</text>
      ${hasPens ? `<text class="fl-ax" x="${x0 - 6}" y="${lane.home + 3}" text-anchor="end">${hAbbr}</text>
      <text class="fl-ax" x="${x0 - 6}" y="${lane.away + 3}" text-anchor="end">${aAbbr}</text>
      <line x1="${x0}" x2="${x1}" y1="${lane.home}" y2="${lane.home}" class="fl-lane"/>
      <line x1="${x0}" x2="${x1}" y1="${lane.away}" y2="${lane.away}" class="fl-lane"/>` : ""}
      ${pens}${plabels}${dotEls}
    </svg></div>
    <div class="flow-cap" aria-live="polite">
      <div class="tm num">${esc(cur.time)}</div>${emblem(sideTeam(g, cur.team))}
      <div class="who">${esc(cur.author)}${strengthTag(cur, cur.i ?? g.goals.indexOf(cur), d)}<small>${cur.assists.length ? cur.assists.map(esc).join(", ") : "без передач"}</small></div>
      <div class="sc num">${esc(cur.score)}</div>
    </div>
    <div class="legend"><span><i class="k-home"></i>ведут хозяева</span><span><i class="k-away"></i>ведут гости</span>
      <span><i class="k-dot"></i>гол</span><span><i class="k-dot pp"></i>в большинстве</span>${hasPens ? `<span><i class="k-pen"></i>удаление</span>` : ""}</div>
  </div>`;
}

function penaltyPeriod(p, g) {
  const s = secs(p.time);
  if (s >= 3600) return "ОТ";
  return String(Math.min(3, Math.floor(s / 1200) + 1));
}

function goalsTab(g, d) {
  const items = (g.goals || []).map((x, i) => ({ kind: "g", x, i, s: x.period === "РБ" ? 1e9 : secs(x.time), p: x.period }));
  const pens = (d && d.penalties) || [];
  if (recapView.pens) pens.forEach((x) => items.push({ kind: "p", x, s: secs(x.time) + 0.5, p: penaltyPeriod(x, g) }));
  items.sort((a, b) => a.s - b.s);
  let html = pens.length ? `<div class="chips" role="group" aria-label="Что показать" data-run="recap-pens">${RUN}
    <button data-recap-pens="0" class="${recapView.pens ? "" : "on"}" aria-pressed="${!recapView.pens}">Только голы</button>
    <button data-recap-pens="1" class="${recapView.pens ? "on" : ""}" aria-pressed="${recapView.pens}">С удалениями</button></div>` : "";
  if (!items.length) return html + `<div class="empty">В протоколе нет голов</div>`;
  html += `<div class="goals">`;
  let period = null;
  for (const it of items) {
    if (it.p !== period) {
      period = it.p;
      html += `<div class="period"><span class="tag">${esc(PERIOD_NAMES[period] || period)}</span></div>`;
    }
    const x = it.x;
    if (it.kind === "g") {
      html += `<div class="goal${it.i === recapView.pick ? " hl" : ""}">
        <div class="tm">${esc(x.period === "РБ" ? "Б" : x.time)}</div>
        ${emblem(sideTeam(g, x.team))}
        <div class="who">${esc(x.author)}${strengthTag(x, it.i, d)}${x.assists.length ? `<div class="as">${x.assists.map(esc).join(", ")}</div>` : ""}</div>
        <div class="sc">${esc(x.score)}</div>
      </div>`;
    } else {
      html += `<div class="goal pen">
        <div class="tm">${esc(x.time)}</div>
        ${emblem(sideTeam(g, x.team))}
        <div class="who">${esc(x.no ? `${x.no}. ${x.who}` : x.who)}<div class="as">${esc(x.why)}</div></div>
        <div class="sc">${esc(x.min)} мин</div>
      </div>`;
    }
  }
  html += `</div>`;
  // победная не последняя (5:2 — победная 3:1) — объясняем, иначе похоже на ошибку
  if (d && d.gw != null && g.goals && d.gw < g.goals.length - 1) {
    html += `<div class="note">Победная шайба — та, после которой соперник уже не сравнял счёт. Так её считает лига.</div>`;
  }
  return html;
}

function hasStats(d) { return d && (d.shots || d.faceoffs || (d.goalies && d.goalies.length)); }

function statsTab(g, d) {
  // Больше — залито, как доля побед в очных встречах; у штрафа залит тот, у кого меньше
  const row = (label, h, a, fewer) => {
    const hw = fewer ? h < a : h > a, aw = fewer ? a < h : a > h;
    return `<div class="cmp-row"><div class="cmp-top"><b class="num">${h}</b><span>${label}</span><b class="num">${a}</b></div>
      <div class="cmp-bar" role="img" aria-label="${esc(`${label}: ${team(g.home).name} ${h}, ${team(g.away).name} ${a}`)}"><i class="${hw ? "w" : ""}" style="flex:${h || 0.01}"></i><i class="${aw ? "w" : ""}" style="flex:${a || 0.01}"></i></div></div>`;
  };
  let html = `<div class="cmp-head">${emblem(g.home)}<span>${esc(team(g.home).abbr)}</span><span></span><span>${esc(team(g.away).abbr)}</span>${emblem(g.away)}</div><div class="cmp">`;
  if (d.shots) html += row("Броски в створ", d.shots.home, d.shots.away);
  if (d.faceoffs) html += row("Вбрасывания", d.faceoffs.home, d.faceoffs.away);
  if (d.pim) html += row("Штраф, мин", d.pim.home, d.pim.away, true);
  if (d.pp) {
    const pp = (s) => `${d.pp[s][0]} из ${d.pp[s][1]}`;
    html += `<div class="cmp-row"><div class="cmp-top small"><b class="num">${pp("home")}</b><span>Голы в большинстве</span><b class="num">${pp("away")}</b></div></div>`;
  }
  html += `</div>`;
  if (d.goalies && d.goalies.length) {
    html += `<div class="label">Вратари<span class="aside">отражено</span></div><div class="gk">`;
    for (const k of d.goalies) {
      const pct = k.shots ? `${(Math.round((1000 * k.saves) / k.shots) / 10).toLocaleString("ru-RU")}%` : "—";
      const toi = k.toi && k.toi !== "60:00" && k.toi !== "65:00" ? ` · ${esc(k.toi)} на льду` : "";
      html += `<div class="gk-row">${emblem(sideTeam(g, k.team))}<div class="nm">${k.no ? `${esc(k.no)}. ` : ""}${esc(k.name)}<small>${k.saves} из ${k.shots} ${plural(k.shots, "броска", "бросков", "бросков")}${toi}</small></div><div class="pc num">${pct}</div></div>`;
    }
    html += `</div>`;
  }
  return html;
}

function rosterTab(g, d) {
  const side = recapView.side;
  const groups = [["G", "Вратари"], ["D", "Защитники"], ["F", "Нападающие"]];
  let html = `<div class="chips" role="group" aria-label="Команда" data-run="recap-side">${RUN}
    ${["home", "away"].map((s) => `<button data-recap-side="${s}" class="${side === s ? "on" : ""}" aria-pressed="${side === s}">${esc(team(sideTeam(g, s)).name)}</button>`).join("")}</div>`;
  const r = d.lineups[side];
  html += `<div class="roster">`;
  for (const [key, title] of groups) {
    if (!r[key] || !r[key].length) continue;
    html += `<div class="grp">${title}</div>`;
    for (const p of r[key]) {
      const pts = p.dnp ? "запас" : key === "G" ? "" : `${p.g}+${p.a}`;
      const scored = !p.dnp && p.g + p.a > 0;
      html += `<div class="pl${scored ? " scored" : ""}"><span class="no num">${p.no != null ? esc(p.no) : ""}</span>
        <span class="nm">${esc(p.name)}${p.cap ? `<span class="tag soft">${esc(p.cap)}</span>` : ""}</span>
        <span class="pts num${scored ? "" : " z"}">${pts}</span></div>`;
    }
  }
  return html + `</div><div class="note">«К» — капитан, «А» — ассистент. Очки — голы + передачи за этот матч.</div>`;
}

function recapHTML(g) {
  const d = recaps[g.id];
  let html = "";
  if (d && d.story) {
    html += `<div class="story"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.6 6.2 6.7.5-5.1 4.4 1.6 6.5L12 16.6l-5.8 3.5 1.6-6.5L2.7 9.2l6.7-.5z"/></svg><p>${esc(d.story)}</p></div>`;
  }
  html += flowChart(g, d);
  const tabs = [["goals", "Голы"]];
  if (hasStats(d)) tabs.push(["stats", "Статистика"]);
  if (d && d.lineups) tabs.push(["roster", "Составы"]);
  if (!tabs.some((t) => t[0] === recapView.tab)) recapView.tab = "goals";
  if (tabs.length > 1) {
    html += `<div class="seg recap-seg" role="tablist" data-run="recap-tab">${RUN}${tabs.map(([k, l]) =>
      `<button role="tab" data-recap-tab="${k}" class="${recapView.tab === k ? "on" : ""}" aria-selected="${recapView.tab === k}">${l}</button>`).join("")}</div>`;
  } else if (g.goals && g.goals.length) {
    html += `<div class="label">Голы<span class="aside">${g.goals.length}</span></div>`;
  }
  const body = { goals: goalsTab, stats: statsTab, roster: rosterTab }[recapView.tab](g, d);
  return html + `<div class="recap-body">${body}</div>`;
}

function factsHTML(g) {
  const d = recaps[g.id];
  let html = `<div class="label">О матче</div><div class="facts-card"><dl class="facts">`;
  if (g.n) html += `<dt>Номер</dt><dd>№ ${esc(g.n)}</dd>`;
  html += `<dt>Город</dt><dd>${esc(team(g.home).city)}</dd>`;
  if (g.time) html += `<dt>Начало</dt><dd>${esc(g.time)} местное</dd>`;
  if (g.attendance) html += `<dt>Зрители</dt><dd>${esc(Number(g.attendance).toLocaleString("ru-RU"))}</dd>`;
  if (d && d.referees && d.referees.length) html += `<dt>Главные судьи</dt><dd>${d.referees.map(esc).join(", ")}</dd>`;
  if (d && d.linesmen && d.linesmen.length) html += `<dt>Линейные судьи</dt><dd>${d.linesmen.map(esc).join(", ")}</dd>`;
  if (d && d.coaches) {
    for (const s of ["home", "away"]) if (d.coaches[s]) html += `<dt>Тренер ${esc(team(sideTeam(g, s)).name)}</dt><dd>${esc(d.coaches[s])}</dd>`;
  }
  if (g.season) html += `<dt>Турнир</dt><dd>НМХЛ ${esc(g.season)}, ${esc(STAGE[g.stage] || g.stage)}</dd>`;
  else html += `<dt>Календарь</dt><dd>${g.official ? "ФХР, официальный" : '<span class="tag soft">предварительно</span>'}</dd>`;
  if (g.score) html += `<dt>Источник счёта</dt><dd>протокол лиги</dd>`;
  return html + `</dl></div>`;
}

function rerenderRecap() {
  const g = findGame(recapView.id);
  const box = $("#recap");
  if (!g || !box || $("#sheet").hidden) return;
  const prev = runnerState(box);
  box.innerHTML = recapHTML(g);
  placeRunners(box, prev);
  $("#facts").innerHTML = factsHTML(g);
}

// Новая вкладка разбора начинается сразу под прилипшими сегментами, а не там, куда
// обрезалась прокрутка после смены высоты
function keepTabTop() {
  const seg = $("#recap .recap-seg");
  const body = $("#recap .recap-body");
  if (!seg || !body) return;
  const gap = body.getBoundingClientRect().top - seg.getBoundingClientRect().bottom;
  if (gap < 8) $("#sheet").scrollTop += gap - 8;
}

// dir: 1 — вперёд (в прошлую встречу), −1 — «Назад»: содержимое листа въезжает с этой стороны
function openMatch(id, from = null, dir = 0) {
  const g = findGame(id);
  if (!g) {
    // прошлый матч: его нет в league.json, сначала файл разбора
    if (/^h\d+$/.test(id)) loadRecap(id).then((d) => { if (d && d.game) openMatch(id, from, dir); });
    return;
  }
  if (from && from !== id) {
    sheetStack.push(from);
    dir = 1;
  }
  if (recapView.id !== id) {
    const gw = recaps[id] ? recaps[id].gw : null;
    Object.assign(recapView, { id, tab: "goals", pens: false, side: g.home === state.fav || g.away !== state.fav ? "home" : "away",
      pick: gw != null ? gw : g.goals && g.goals.length ? g.goals.length - 1 : null });
  }
  const back = sheetStack.length
    ? `<button class="btn-round" data-back aria-label="Назад к матчу">${ICON.back}</button>` : "";
  const when = g.season
    ? `${esc(fmtLong(g.date))} ${parseISO(g.date).getUTCFullYear()} · НМХЛ ${esc(g.season)}${g.stage === "playoff" ? ", плей-офф" : ""}`
    : `${esc(fmtLong(g.date))} ${parseISO(g.date).getUTCFullYear()} · ${esc(until(g.date))}`;
  let html = `<div class="grab"></div>
    <div class="sheet-head">${back}<span class="when">${when}</span>
    <button class="btn-round" data-close aria-label="Закрыть">${ICON.close}</button></div>
    <div class="board-card">${board(g)}${periodsLine(g)}</div>`;

  const recapReady = !!recaps[id] || recapMissing.has(id);
  if (g.score) html += `<div id="recap">${recapReady ? recapHTML(g) : recapSkeleton(g)}</div>`;
  if (!g.season) html += `<div id="h2h" data-pair="${esc(pairKey(g.home, g.away))}">${state.h2h ? h2hBlock(g) : h2hSkeleton()}</div>`;
  html += `<div id="facts">${factsHTML(g)}</div>`;

  showSheet(html, dir);
  if (g.score && !recapReady) fillRecap(id);
  if (!state.h2h && !g.season) fillH2H(g);
}

// «Назад» в листе: из прошлой встречи — к матчу, откуда её открыли; иначе закрыть
function sheetBack() {
  if (!sheetStack.length) return closeMatch();
  openMatch(sheetStack.pop(), null, -1);
}

let sheetClosing = null;   // анимации ухода листа, пока он уезжает вниз

// Пока лист открыт, Telegram не сворачивает мини-апп свайпом вниз: этот жест закрывает лист
function tgSwipes(on) {
  if (!inTelegram || !tg.isVersionAtLeast || !tg.isVersionAtLeast("7.7")) return;
  if (on && tg.enableVerticalSwipes) tg.enableVerticalSwipes();
  if (!on && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
}

function showSheet(html, dir = 0) {
  const sheet = $("#sheet");
  const back = $("#sheet-backdrop");
  const wasOpen = !sheet.hidden && !sheetClosing;
  if (sheetClosing) {
    sheetClosing.forEach((a) => a.cancel());
    sheetClosing = null;
  }
  sheet.style.transform = back.style.opacity = "";
  sheet.style.pointerEvents = back.style.pointerEvents = "";
  sheet.innerHTML = `<div class="sheet-page">${html}</div>`;
  sheet.hidden = false;
  back.hidden = false;
  sheet.scrollTop = 0;
  document.body.classList.add("sheet-open");
  placeRunners(sheet);
  if (!sheetOpener) sheetOpener = document.activeElement;   // при переходе внутри листа — прежний
  sheet.querySelector("[data-close]").focus({ preventScroll: true });
  if (wasOpen && dir && !calm()) {
    sheet.firstElementChild.animate([{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: "none" }],
      { duration: 200, easing: EASE_OUT });
  }
  if (inTelegram) {
    tg.BackButton.show();
    if (!wasOpen) tgSwipes(false);
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
  }
}

// Уход зеркален приходу: лист уезжает вниз с разгоном. fromY — откуда, если его уже тянут пальцем
function closeMatch(fromY = 0) {
  sheetStack.length = 0;
  const sheet = $("#sheet");
  const back = $("#sheet-backdrop");
  if (sheet.hidden || sheetClosing) return;
  document.body.classList.remove("sheet-open");
  if (inTelegram) {
    tg.BackButton.hide();
    tgSwipes(true);
  }
  if (sheetOpener && sheetOpener.isConnected) sheetOpener.focus({ preventScroll: true });
  sheetOpener = null;
  const done = () => {
    sheet.hidden = true;
    back.hidden = true;
    sheet.style.transform = back.style.opacity = "";
    sheet.style.pointerEvents = back.style.pointerEvents = "";
  };
  if (calm()) return done();
  sheet.style.pointerEvents = back.style.pointerEvents = "none";
  const anims = [
    sheet.animate([{ transform: `translateY(${fromY}px)` }, { transform: "translateY(100%)" }], { duration: 200, easing: EASE_IN, fill: "forwards" }),
    back.animate([{ opacity: back.style.opacity || 1 }, { opacity: 0 }], { duration: 180, easing: "ease-in", fill: "forwards" }),
  ];
  sheetClosing = anims;
  anims[0].finished.then(() => {
    if (sheetClosing !== anims) return;
    sheetClosing = null;
    done();
    anims.forEach((a) => a.cancel());
  }).catch(() => {});
}

// Свайп вниз закрывает лист: он идёт за пальцем, пока прокрутка листа в самом верху.
// Дальше 30% высоты или быстрым движением — закрыть, иначе пружиной на место
function initSheetDrag() {
  const sheet = $("#sheet");
  const back = $("#sheet-backdrop");
  const SLOP = 8;   // первые пиксели — ещё не жест, а неточное касание
  let y0 = 0, dy = 0, lastY = 0, lastT = 0, v = 0, armed = false, drag = false;
  sheet.addEventListener("touchstart", (e) => {
    armed = e.touches.length === 1 && sheet.scrollTop <= 0 && !sheetClosing;
    drag = false;
    dy = v = 0;
    y0 = lastY = e.touches[0].clientY;
    lastT = e.timeStamp;
  }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (!armed) return;
    const y = e.touches[0].clientY;
    dy = y - y0;
    if (!drag) {
      if (dy < 0 || sheet.scrollTop > 0) { armed = false; return; }   // листают вверх — обычная прокрутка
      if (dy < SLOP) return;
      drag = true;
    }
    e.preventDefault();
    v = (y - lastY) / Math.max(1, e.timeStamp - lastT);
    lastY = y;
    lastT = e.timeStamp;
    const d = Math.max(0, dy - SLOP);
    sheet.style.transform = `translateY(${d}px)`;
    back.style.opacity = String(Math.max(0, 1 - d / sheet.offsetHeight));
  }, { passive: false });
  const end = () => {
    armed = false;
    if (!drag) return;
    drag = false;
    const d = Math.max(0, dy - SLOP);
    if (d > sheet.offsetHeight * 0.3 || v > 0.5) return closeMatch(d);
    if (!calm()) {
      sheet.animate([{ transform: `translateY(${d}px)` }, { transform: "translateY(0)" }], { duration: 280, easing: "cubic-bezier(.3, 1.4, .5, 1)" });
      back.animate([{ opacity: back.style.opacity || 1 }, { opacity: 1 }], { duration: 200, easing: EASE_OUT });
    }
    sheet.style.transform = back.style.opacity = "";
  };
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);
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

// dir — направление смены вкладки: новый экран въезжает с её стороны; 0 — без перехода
function render(dir = 0) {
  const screen = $("#screen");
  const onboarding = !state.fav;
  $("#tabs").hidden = onboarding;
  document.body.dataset.tab = onboarding ? "" : state.tab;
  if (onboarding) {
    screen.innerHTML = renderOnboarding();
    addThemeToggle();
    return;
  }
  const cur = $("#tabs button.active");
  if (!cur || cur.dataset.tab !== state.tab || !$("#tabs").classList.contains("ready")) setTab(state.tab, false);
  const views = { home: renderHome, calendar: renderCalendar, table: renderTable, me: renderMe };
  screen.innerHTML = views[state.tab]();
  addThemeToggle();
  placeRunners(screen);
  const anchor = state.tab === "calendar" && !state.scrolledToNext && $("#next-anchor");
  if (anchor) {
    anchor.scrollIntoView({ block: "center" });
    state.scrolledToNext = true;
  } else if (state.tab !== "calendar") {
    window.scrollTo(0, 0);
  }
  if (state.tab === "home") countUp(screen);
  if (dir && !calm()) {
    // двигаем детей, а не сам экран: его край обрезает сдвиг (#screen в style.css)
    for (const el of screen.children) {
      el.animate([{ opacity: 0, transform: `translateX(${dir * 16}px)` }, { opacity: 1, transform: "none" }], { duration: 220, easing: EASE_OUT });
    }
  }
}

const TAB_ORDER = ["home", "calendar", "table", "me"];
const tabDir = (from, to) => Math.sign(TAB_ORDER.indexOf(to) - TAB_ORDER.indexOf(from)) || 1;

function haptic() {
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

// Меню отвечает сразу: бегунок поехал в этом же кадре, а тяжёлая перерисовка экрана — в следующем,
// когда анимация уже идёт на видеокарте и её не остановить занятым основным потоком
let goToken = 0;
function go(tab) {
  if (tab === state.tab) return;
  const dir = tabDir(state.tab, tab);
  state.tab = tab;
  state.draft = null;
  if (tab === "calendar") state.scrolledToNext = false;
  haptic();
  setTab(tab, true);
  const token = ++goToken;
  nextFrame(() => { if (token === goToken) render(dir); });
}

function confirmTeam(id = state.draft || state.fav) {
  if (!id) return;
  const wasFav = state.fav;
  const dir = state.fav ? tabDir(state.tab, "home") : 1;
  state.fav = id;
  state.draft = null;
  state.cal = calFor(id);
  state.conf = team(id).conf;
  saveFav(id);
  closeMatch();
  // пришёл по ссылке на лидеров и только что выбрал команду — ведём туда, куда звали
  state.tab = !wasFav && state.tableView === "players" ? "table" : "home";
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  render(dir);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-tab],[data-game],[data-pick],[data-confirm],[data-cal-team],[data-cal-side],[data-cal-conf],[data-cal-other],[data-cal-pick],[data-conf],[data-team],[data-theme-pick],[data-theme-toggle],[data-close],[data-switch-open],[data-switch],[data-story],[data-invite],[data-remind],[data-recap-tab],[data-recap-goal],[data-recap-pens],[data-recap-side],[data-back],[data-retry],[data-table-view],[data-lead-cat],#sheet-backdrop");
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
    haptic();
    return switchTheme(el.dataset.themePick, el);
  }
  if (el.id === "sheet-backdrop" || el.hasAttribute("data-close")) return closeMatch();
  if (el.dataset.retry === "leaders") {
    haptic();
    leadersFailed = false;
    $("#table-body").innerHTML = leadersBody();
    return;
  }
  if (el.dataset.retry) {
    const g = findGame(recapView.id);
    const box = $(`#${el.dataset.retry}`);
    if (!g || !box) return;
    haptic();
    if (el.dataset.retry === "h2h") {
      box.innerHTML = h2hSkeleton();
      return fillH2H(g);
    }
    box.innerHTML = recapSkeleton(g);
    return fillRecap(g.id);
  }
  if (el.hasAttribute("data-back")) return sheetBack();
  if (el.dataset.recapTab || el.dataset.recapGoal || el.dataset.recapPens || el.dataset.recapSide) {
    if (el.dataset.recapTab) recapView.tab = el.dataset.recapTab;
    if (el.dataset.recapGoal) recapView.pick = Number(el.dataset.recapGoal);
    if (el.dataset.recapPens) recapView.pens = el.dataset.recapPens === "1";
    if (el.dataset.recapSide) recapView.side = el.dataset.recapSide;
    // после перерисовки вернуть фокус на ту же кнопку: иначе с клавиатуры он улетает в начало
    const attr = ["recapTab", "recapGoal", "recapPens", "recapSide"].find((k) => el.dataset[k]);
    const sel = `[data-${attr.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${el.dataset[attr]}"]`;
    haptic();
    rerenderRecap();
    if (el.dataset.recapTab) keepTabTop();
    const f = $(`#recap ${sel}`);
    if (f) f.focus({ preventScroll: true });
    return;
  }
  if (el.hasAttribute("data-confirm")) return confirmTeam();
  if (el.dataset.tab) return go(el.dataset.tab);
  if (el.dataset.game) {
    const id = el.dataset.game;
    const from = el.closest("#sheet") ? recapView.id : null;
    // прошлая встреча грузится из своего файла — строка пульсирует, пока он едет
    if (!findGame(id) && /^h\d+$/.test(id)) {
      el.classList.add("busy");
      el.setAttribute("aria-busy", "true");
      loadRecap(id).then((d) => {
        el.classList.remove("busy");
        el.removeAttribute("aria-busy");
        if (d && d.game) openMatch(id, from);
        else if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
      });
      return;
    }
    return openMatch(id, from);
  }
  if (el.dataset.pick) {
    // выбор на месте, без перерисовки: карточка пружинит, «Готово» выезжает снизу
    state.draft = el.dataset.pick;
    haptic();
    document.querySelectorAll("[data-pick]").forEach((b) => {
      b.classList.toggle("on", b === el);
      b.setAttribute("aria-pressed", b === el);
    });
    el.classList.remove("pop");
    void el.offsetWidth;   // перезапустить анимацию на той же карточке
    el.classList.add("pop");
    const btn = $("[data-confirm]");
    btn.disabled = false;
    btn.textContent = `Готово — ${team(state.draft).name}`;
    $(".cta-bar").classList.remove("wait");
    return;
  }
  if (el.hasAttribute("data-cal-other")) return openCalSheet();
  if (el.dataset.calTeam !== undefined || el.dataset.calPick) {
    state.cal = calFor(el.dataset.calPick || el.dataset.calTeam);
    closeMatch();
    haptic();
    return refreshCalendar(false);
  }
  if (el.dataset.calConf) {
    state.cal.conf = el.dataset.calConf;
    haptic();
    return refreshCalendar(true);
  }
  if (el.dataset.calSide) {
    state.cal.side = el.dataset.calSide;
    haptic();
    return refreshCalendar(true);
  }
  if (el.dataset.tableView) {
    if (el.dataset.tableView === state.tableView) return;
    state.tableView = el.dataset.tableView;
    haptic();
    return refreshTable();
  }
  if (el.dataset.leadCat) {
    state.leadCat = el.dataset.leadCat;
    haptic();
    el.parentNode.querySelectorAll("[data-lead-cat]").forEach((b) => {
      b.classList.toggle("on", b === el);
      b.setAttribute("aria-pressed", b === el);
    });
    $("#table-body").innerHTML = leadersBody();
    return fadeIn($("#table-body"));
  }
  if (el.dataset.conf) {
    state.conf = el.dataset.conf;
    haptic();
    el.parentNode.querySelectorAll("[data-conf]").forEach((b) => {
      b.classList.toggle("on", b === el);
      b.setAttribute("aria-pressed", b === el);
    });
    $("#table-body").innerHTML = tableBody();
    return fadeIn($("#table-body"));
  }
  if (el.dataset.team) {
    state.cal = calFor(el.dataset.team);
    return go("calendar");
  }
});

// iOS показывает :active, только если на странице слушают касания
document.addEventListener("touchstart", () => {}, { passive: true });

// Бегунки держатся за свои кнопки, когда меняется ширина экрана или догрузился шрифт
function resyncRunners() {
  if (state.fav) setTab(state.tab, false);
  placeRunners(document.body);
}
window.addEventListener("resize", resyncRunners);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(resyncRunners);

// Строки и карточки с role="button" нажимаются с клавиатуры, Esc закрывает карточку матча
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return sheetBack();
  if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"]')) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));   // у SVG нет .click()
  }
});

// ---------- запуск ----------

function startParam() {
  const fromTg = inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  const q = new URLSearchParams(location.search);
  return fromTg || q.get("tgWebAppStartParam") || q.get("startapp") || q.get("team");
}

// Ссылка на матч из бота: ?match=<id> или startapp=m-<id> (ADR-008)
function matchParam() {
  const fromTg = inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  const q = new URLSearchParams(location.search);
  const sp = fromTg || q.get("tgWebAppStartParam") || q.get("startapp") || "";
  return q.get("match") || (/^m-/.test(sp) ? sp.slice(2) : null);
}

// Ссылка на лидеров лиги из бота: ?view=leaders или startapp=leaders (ADR-009)
function leadersParam() {
  const fromTg = inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  const q = new URLSearchParams(location.search);
  return q.get("view") === "leaders" || (fromTg || q.get("tgWebAppStartParam") || q.get("startapp")) === "leaders";
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
  tg.BackButton.onClick(sheetBack);
  if (!$("#sheet").hidden) {
    tg.BackButton.show();
    tgSwipes(false);
  }
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

function hideSplash(minMs = SPLASH_MIN_MS) {
  const splash = $("#splash");
  if (!splash || splash.classList.contains("out")) return;
  const wait = calm() ? 0 : Math.max(0, minMs - (Date.now() - (window.__splashT0 || 0)));
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

// Эмблемы декодируются заранее и держатся в памяти: при перерисовке экрана картинка встаёт
// в том же кадре, что и строка, а не мигает пустым кругом
const warmed = [];
function warmLogos() {
  if (warmed.length) return;
  const logos = [...new Set(state.data.teams.map((t) => t.logo).filter(Boolean))];
  (window.requestIdleCallback || setTimeout)(() => logos.forEach((src) => {
    const img = new Image();
    img.src = src;
    if (img.decode) img.decode().catch(() => {});
    warmed.push(img);
  }), { timeout: 1500 });
}

function useData(d) {
  state.data = d;
  state.teams = {};
  d.teams.forEach((t) => { state.teams[t.id] = t; });
  fillMarquee();
  warmLogos();
}

// cached — данные уже были на устройстве: заставка короткая (DESIGN.md → «Экран запуска»)
function boot(d, cached = false) {
  useData(d);
  const fromLink = startParam();
  const saved = lsGet(FAV_KEY);
  // Ссылка с командой выбирает её только новичку: приглашение от друга не перезаписывает свой клуб
  const fav = [saved, fromLink].find((id) => id && state.teams[id]);
  if (fav) {
    pickFav(fav);
    if (fromLink === fav && fav !== saved) saveFav(fav);
    else rememberSplash(fav);
  }
  // Из бота — сразу «Таблица → Игроки». Новичок сначала выбирает команду, потом попадает туда же
  if (leadersParam() && !state.openedFromLink) {
    state.openedFromLink = true;
    state.tab = "table";
    state.tableView = "players";
  }
  render();
  hideSplash(cached ? SPLASH_REPEAT_MS : SPLASH_MIN_MS);
  const mid = matchParam();
  if (mid && !state.openedFromLink && (games().some((g) => g.id === mid) || /^h\d+$/.test(mid))) {
    state.openedFromLink = true;
    openMatch(mid);
  }
}

async function main() {
  applyTheme();
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  initTelegram();   // если скрипт Telegram уже успел загрузиться

  const fresh = fetchData();
  initSheetDrag();
  const cached = readCache();
  if (cached) boot(cached, true);
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

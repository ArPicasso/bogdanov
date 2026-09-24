"use strict";
// Интерфейс — по DESIGN.md. Всё, что пришло из данных, вставляется только через esc().

const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = !!(tg && tg.initData);
const TZ = "Europe/Moscow";
const FAV_KEY = "fav_team";
const CANVAS = "#08090a";

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
function fmtShort(iso) {
  const d = parseISO(iso);
  return `${DOW[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")} ${MON_SHORT[d.getUTCMonth()]}`;
}

// ---------- хранилище любимой команды ----------

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } }
const cloud = inTelegram && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;

function loadFav() {
  return new Promise((resolve) => {
    if (!cloud) return resolve(lsGet(FAV_KEY));
    cloud.getItem(FAV_KEY, (err, v) => resolve(err ? lsGet(FAV_KEY) : v || lsGet(FAV_KEY)));
  });
}
function saveFav(id) {
  lsSet(FAV_KEY, id);
  if (cloud) cloud.setItem(FAV_KEY, id, () => {});
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

function tile(id, size) {
  const me = id === state.fav ? " me" : "";
  return `<span class="tile${size ? " " + size : ""}${me}" aria-hidden="true">${esc(team(id).abbr)}</span>`;
}

function outcomeBadge(g) {
  const res = outcomeFor(g, state.fav);
  if (!res) return "";
  return `<span class="badge ${res}">${res === "w" ? "В" : "П"}${g.score.decision ? " " + esc(g.score.decision) : ""}</span>`;
}

function whereBadge(g, me) {
  if (me !== g.home && me !== g.away) return "";
  return g.home === me ? `<span class="badge">${ICON.home}Дома</span>` : `<span class="badge">${ICON.away}Выезд</span>`;
}

function board(g) {
  const side = (id) => `<div class="side">${tile(id, "lg")}<div class="name${id === state.fav ? " me" : ""}">${esc(team(id).name)}</div><div class="city">${esc(team(id).city)}</div></div>`;
  let mid;
  if (g.score) {
    const dec = g.score.decision === "ОТ" ? "овертайм" : g.score.decision === "Б" ? "буллиты" : "финал";
    mid = `<div class="score">${g.score.home}:${g.score.away}<span class="dec">${dec}</span></div>`;
  } else {
    mid = `<div class="score pending">${g.time ? esc(g.time) : "—"}<span class="kick">${until(g.date)}</span></div>`;
  }
  return `<div class="board">${side(g.home)}${mid}${side(g.away)}</div>`;
}

function periodsLine(g) {
  if (!g.score || !g.score.periods || !g.score.periods.length) return "";
  return `<div class="periods">${g.score.periods.map((p) => `<span>${p[0]}:${p[1]}</span>`).join("")}</div>`;
}

function gameRow(g, next) {
  const d = parseISO(g.date);
  const past = !!g.score;
  const goals = (id) => (past ? `<span class="gl${(id === g.home ? g.score.home > g.score.away : g.score.away > g.score.home) ? " lead" : ""}">${id === g.home ? g.score.home : g.score.away}</span>` : "");
  const line = (id) => `<div>${tile(id, "sm")}<span class="nm${id === state.fav ? " me" : ""}">${esc(team(id).name)}</span>${goals(id)}</div>`;
  let right = "";
  if (past) right = outcomeBadge(g) || (g.score.decision ? `<span class="badge">${esc(g.score.decision)}</span>` : "");
  else right = `<span class="when-mono">${g.time ? esc(g.time) : "—"}</span>`;
  return `<div class="row${past ? " past" : ""}${next ? " next" : ""}" data-game="${esc(g.id)}"${next ? ' id="next-anchor"' : ""}>
    <div class="d"><b>${String(d.getUTCDate()).padStart(2, "0")}</b><span>${MON_SHORT[d.getUTCMonth()]} ${DOW[d.getUTCDay()]}</span></div>
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

function renderHome() {
  const me = state.fav;
  const t = team(me);
  const st = standingOf(me);
  const mine = gamesOf(me);
  const next = nextGame(me);
  const last = lastPlayed(me);
  const upcoming = mine.filter(isUpcoming).slice(1, 4);

  let html = `<div class="teamhead">${tile(me)}<div><h1>${esc(t.name)}</h1><div class="meta">${esc(t.city)} · ${CONF[t.conf] || ""}</div></div></div>`;

  if (st && st.row.gp) {
    const form = st.row.form.length ? `<span class="form">${st.row.form.map((f) => `<i class="${f}"></i>`).join("")}</span>` : "—";
    html += `<div class="stats">
      <div><b>${st.place}</b><span>место · ${CONF[st.conf]}</span></div>
      <div><b>${st.row.pts}</b><span>${plural(st.row.pts, "очко", "очка", "очков")} · ${st.row.gp} ${plural(st.row.gp, "игра", "игры", "игр")}</span></div>
      <div><b>${form}</b><span>форма</span></div>
    </div>`;
  } else if (next) {
    const home = mine.filter((g) => g.home === me).length;
    html += `<div class="stats">
      <div><b>${mine.length}</b><span>матчей</span></div>
      <div><b>${home} / ${mine.length - home}</b><span>дома / выезд</span></div>
      <div><b>${Math.max(daysFromToday(mine[0].date), 0)}</b><span>${plural(Math.max(daysFromToday(mine[0].date), 0), "день", "дня", "дней")} до старта</span></div>
    </div>`;
  }

  if (next) {
    const today = daysFromToday(next.date) === 0;
    html += `<div class="eyebrow">Следующий матч${next.n ? `<span class="aside mono">№ ${esc(next.n)}</span>` : ""}</div>
      <div class="card tap" data-game="${esc(next.id)}">
        <div class="board-top">
          <span style="display:flex;gap:6px">${whereBadge(next, me)}${next.official ? "" : '<span class="badge">предварительно</span>'}</span>
          ${today ? '<span class="badge now">Сегодня</span>' : `<span class="when-mono">${esc(fmtShort(next.date))}</span>`}
        </div>
        ${board(next)}
      </div>`;
  } else {
    html += `<div class="eyebrow">Следующий матч</div><div class="card empty">Матчей регулярного чемпионата больше нет</div>`;
  }

  if (last) {
    html += `<div class="eyebrow">Последний результат</div>
      <div class="card tap" data-game="${esc(last.id)}">
        <div class="board-top"><span style="display:flex;gap:6px">${whereBadge(last, me)}${outcomeBadge(last)}</span><span class="when-mono">${esc(fmtShort(last.date))}</span></div>
        ${board(last)}
        ${periodsLine(last)}
      </div>`;
  }

  if (upcoming.length) {
    html += `<div class="eyebrow">Дальше<span class="aside" data-tab="calendar" style="cursor:pointer">Весь календарь →</span></div>
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

  let html = `<div class="seg" role="tablist">
      <button class="${teamId === state.fav ? "on" : ""}" data-cal-team="${esc(state.fav)}">Моя команда</button>
      <button class="${!teamId ? "on" : ""}" data-cal-team="">Вся лига</button>
      <select class="${other ? "on" : ""}" id="cal-team-select" aria-label="Другая команда"><option value="">Другая…</option>${opts}</select>
    </div>`;
  if (teamId) {
    html += `<div class="seg sm">${[["all", "Все"], ["home", "Дома"], ["away", "Выезд"]]
      .map(([k, v]) => `<button class="${state.cal.side === k ? "on" : ""}" data-cal-side="${k}">${v}</button>`)
      .join("")}</div>`;
  }

  const nextId = (list.find(isUpcoming) || {}).id;
  let month = "";
  for (const g of list) {
    const m = g.date.slice(0, 7);
    if (m !== month) {
      if (month) html += `</div>`;
      const d = parseISO(g.date);
      const count = list.filter((x) => x.date.slice(0, 7) === m).length;
      html += `<div class="eyebrow">${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}<span class="aside">${count} ${plural(count, "матч", "матча", "матчей")}</span></div><div class="list">`;
      month = m;
    }
    html += gameRow(g, g.id === nextId);
  }
  if (month) html += `</div>`;
  if (!list.length) html += `<div class="card empty">Матчей нет</div>`;
  html += `<div class="foot">Официальный календарь ФХР пока есть только у «Рязань-ВДВ». Остальные даты — предварительные, уточним после открытия сайта РХЛ.</div>`;
  return html;
}

function renderTable() {
  const conf = state.conf;
  const rows = state.data.standings[conf] || [];
  let html = `<div class="seg">${Object.entries(CONF)
    .map(([k, v]) => `<button class="${conf === k ? "on" : ""}" data-conf="${k}">${v}</button>`)
    .join("")}</div>`;
  html += `<div class="st"><div class="st-row head"><span class="pos">#</span><span class="tm">Команда</span><span>И</span><span>В</span><span>П</span><span>Ш</span><span>О</span></div>`;
  rows.forEach((r, i) => {
    if (i === PLAYOFF_CUT) html += `<div class="cut">Зона плей-офф выше</div>`;
    const wins = r.w + r.otw + r.sow;
    const losses = r.l + r.otl + r.sol;
    html += `<div class="st-row${r.team === state.fav ? " me" : ""}" data-team="${esc(r.team)}">
      <span class="pos">${i + 1}</span>
      <span class="tm">${tile(r.team, "sm")}<span>${esc(team(r.team).name)}</span></span>
      <span class="num">${r.gp}</span><span class="num">${wins}</span><span class="num">${losses}</span>
      <span class="num">${r.gf}:${r.ga}</span><span class="pts">${r.pts}</span>
    </div>`;
  });
  html += `</div>`;
  const played = rows.some((r) => r.gp);
  html += `<div class="foot">${played
    ? "Победа — 2 очка, поражение в овертайме или по буллитам — 1. В плей-офф выходят 8 команд конференции."
    : "Сезон стартует 3 октября — таблица заполнится после первых матчей."}</div>`;
  return html;
}

function renderPicker(onboarding) {
  const chosen = state.draft || state.fav;
  let html = onboarding
    ? `<h1>За кого болеете?</h1><div class="meta" style="margin-top:6px">Главный экран, календарь и таблица подстроятся под команду. Поменять можно в любой момент.</div>`
    : `<h1>Моя команда</h1><div class="meta" style="margin-top:6px">Сейчас: ${esc(team(state.fav).name)}</div>`;
  for (const conf of ["east", "west"]) {
    const list = state.data.teams.filter((t) => t.conf === conf).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    html += `<div class="eyebrow">${CONF[conf]}<span class="aside">${list.length} команд</span></div><div class="picker">`;
    for (const t of list) {
      html += `<button class="pick${t.id === chosen ? " on" : ""}" data-pick="${esc(t.id)}" aria-pressed="${t.id === chosen}">
        <span class="tile">${esc(t.abbr)}</span><div><b>${esc(t.name)}</b><small>${esc(t.city)}</small></div></button>`;
    }
    html += `</div>`;
  }
  const changed = chosen && chosen !== state.fav;
  const label = onboarding ? (chosen ? `Готово — ${esc(team(chosen).name)}` : "Выберите команду") : changed ? `Сохранить — ${esc(team(chosen).name)}` : "Команда выбрана";
  html += `<div style="height:72px"></div><div class="cta-bar${onboarding ? "" : " above-nav"}">
    <button class="btn-primary" data-confirm${(onboarding ? chosen : changed) ? "" : " disabled"}>${label}</button></div>`;
  return html;
}

// ---------- карточка матча ----------

function openMatch(id) {
  const g = games().find((x) => x.id === id);
  if (!g) return;
  let html = `<div class="grab"></div>
    <div class="sheet-head"><span class="when-mono">${esc(fmtLong(g.date))} ${parseISO(g.date).getUTCFullYear()} · ${esc(until(g.date))}</span>
    <button class="btn-ghost" data-close aria-label="Закрыть">${ICON.close}</button></div>
    <div class="card">${board(g)}${periodsLine(g)}</div>`;

  if (g.goals && g.goals.length) {
    html += `<div class="eyebrow">Голы<span class="aside">${g.goals.length}</span></div><div class="goals">`;
    let period = null;
    for (const x of g.goals) {
      if (x.period !== period) {
        period = x.period;
        html += `<div class="period">${esc(PERIOD_NAMES[period] || period)}</div>`;
      }
      const tag = x.strength && x.strength !== "рав." ? `<span class="badge">${esc(x.strength.replace(".", ""))}</span>` : "";
      html += `<div class="goal ${x.team}">
        <div class="tm">${esc(x.period === "РБ" ? "Б" : x.time)}</div>
        <div class="who">${esc(x.author)}${tag}${x.assists.length ? `<div class="as">${x.assists.map(esc).join(", ")}</div>` : ""}</div>
        <div class="sc">${esc(x.score)}</div>
      </div>`;
    }
    html += `</div>`;
  }

  html += `<div class="eyebrow">О матче</div><div class="card"><dl class="facts">`;
  if (g.n) html += `<dt>Номер</dt><dd class="mono">№ ${esc(g.n)}</dd>`;
  html += `<dt>Город</dt><dd>${esc(team(g.home).city)}</dd>`;
  if (g.time) html += `<dt>Начало</dt><dd class="mono">${esc(g.time)} местное</dd>`;
  if (g.attendance) html += `<dt>Зрители</dt><dd>${esc(Number(g.attendance).toLocaleString("ru-RU"))}</dd>`;
  html += `<dt>Календарь</dt><dd>${g.official ? "ФХР, официальный" : '<span class="badge">предварительно</span>'}</dd>`;
  if (g.score) html += `<dt>Источник счёта</dt><dd>протокол лиги</dd>`;
  html += `</dl></div>`;

  const sheet = $("#sheet");
  sheet.innerHTML = html;
  sheet.hidden = false;
  $("#sheet-backdrop").hidden = false;
  sheet.scrollTop = 0;
  if (inTelegram) {
    tg.BackButton.show();
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
  }
}

function closeMatch() {
  $("#sheet").hidden = true;
  $("#sheet-backdrop").hidden = true;
  if (inTelegram) tg.BackButton.hide();
}

// ---------- навигация ----------

function render() {
  const screen = $("#screen");
  const onboarding = !state.fav;
  $("#tabs").hidden = onboarding;
  if (onboarding) {
    screen.innerHTML = renderPicker(true);
    return;
  }
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  const views = { home: renderHome, calendar: renderCalendar, table: renderTable, team: () => renderPicker(false) };
  screen.innerHTML = views[state.tab]();
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

function confirmTeam() {
  const id = state.draft || state.fav;
  if (!id) return;
  state.fav = id;
  state.draft = null;
  state.cal = { team: id, side: "all" };
  state.conf = team(id).conf;
  saveFav(id);
  state.tab = "home";
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  render();
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-tab],[data-game],[data-pick],[data-confirm],[data-cal-team],[data-cal-side],[data-conf],[data-team],[data-close],#sheet-backdrop");
  if (!el || el.disabled) return;
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
  return fromTg || q.get("startapp") || q.get("team");
}

async function main() {
  if (inTelegram) {
    tg.ready();
    tg.expand();
    if (tg.isVersionAtLeast && tg.isVersionAtLeast("6.1")) {
      tg.setHeaderColor(CANVAS);
      tg.setBackgroundColor(CANVAS);
    }
    if (tg.isVersionAtLeast && tg.isVersionAtLeast("7.10") && tg.setBottomBarColor) tg.setBottomBarColor(CANVAS);
    tg.BackButton.onClick(closeMatch);
  }
  try {
    const r = await fetch("data/league.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    state.data = await r.json();
  } catch (err) {
    $("#screen").innerHTML = `<div class="card empty">Не удалось загрузить матчи. Проверьте интернет и откройте приложение ещё раз.</div>`;
    return;
  }
  state.data.teams.forEach((t) => { state.teams[t.id] = t; });

  const fromLink = startParam();
  const saved = await loadFav();
  const fav = [fromLink, saved].find((id) => id && state.teams[id]);
  if (fav) {
    state.fav = fav;
    state.cal.team = fav;
    state.conf = state.teams[fav].conf;
    if (fromLink === fav && fav !== saved) saveFav(fav);
  }
  render();
}

main();

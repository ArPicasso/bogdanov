"use strict";

const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = !!(tg && tg.initData);
const TZ = "Europe/Moscow";
const FAV_KEY = "fav_team";

const DOW = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const CONF = { east: "Восток", west: "Запад" };
const PLAYOFF_CUT = 8;

const state = {
  data: null,
  teams: {},
  fav: null,
  tab: "home",
  cal: { team: null, side: "all" },
  conf: null,
  scrolledToToday: false,
};

const $ = (sel) => document.querySelector(sel);

// Всё, что пришло из данных, вставляется только через esc(): названия и фамилии — со сторонних сайтов.
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

const team = (id) => state.teams[id] || { name: id, city: "" };
const games = () => state.data.games;
const gamesOf = (id) => games().filter((g) => g.home === id || g.away === id);
const nextGame = (id) => gamesOf(id).find((g) => !g.score && g.date >= todayISO());
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
const decLabel = (s) => (s.decision === "ОТ" ? "ОТ" : s.decision === "Б" ? "Б" : "");

// ---------- элементы ----------

function teamLabel(id) {
  const cls = id === state.fav ? ' class="me"' : "";
  return `<span${cls}>${esc(team(id).name)}</span>`;
}

function gameRow(g) {
  const d = parseISO(g.date);
  const res = outcomeFor(g, state.fav);
  let right;
  if (g.score) {
    right = `<div class="s ${res}">${g.score.home}:${g.score.away}${decLabel(g.score) ? `<small>${decLabel(g.score)}</small>` : ""}</div>`;
  } else {
    right = `<div class="s"><small>${g.time ? esc(g.time) : ""}</small></div>`;
  }
  return `<div class="row${g.score ? " past" : ""}" data-game="${esc(g.id)}">
    <div class="d"><b>${d.getUTCDate()}</b>${DOW[d.getUTCDay()]}</div>
    <div class="t"><div>${teamLabel(g.home)}</div><div>${teamLabel(g.away)}</div></div>
    ${right}
  </div>`;
}

function vsBlock(g) {
  const mid = g.score
    ? `${g.score.home}:${g.score.away}${decLabel(g.score) ? `<span class="dec">${g.score.decision === "ОТ" ? "овертайм" : "буллиты"}</span>` : ""}`
    : `<span class="sub">${g.time ? esc(g.time) : "—"}</span>`;
  const side = (id) => `<div class="team">${teamLabel(id)}<span class="city">${esc(team(id).city)}</span></div>`;
  return `<div class="vs">${side(g.home)}<div class="mid">${mid}</div>${side(g.away)}</div>`;
}

// ---------- экраны ----------

function renderHome() {
  const me = state.fav;
  const t = team(me);
  const st = standingOf(me);
  const next = nextGame(me);
  const last = lastPlayed(me);
  const upcoming = gamesOf(me).filter((g) => !g.score && g.date >= todayISO()).slice(1, 4);

  let html = `<h1>${esc(t.name)}</h1><div class="sub">${esc(t.city)}`;
  if (st && st.row.gp) html += ` · ${st.place} место, ${CONF[st.conf]} · ${st.row.pts} ${plural(st.row.pts, "очко", "очка", "очков")}`;
  html += `</div>`;

  if (next) {
    const where = next.home === me ? "🏠 Дома" : "✈️ На выезде";
    html += `<h2>Следующий матч</h2>
      <div class="card hero tap" data-game="${esc(next.id)}">
        <div class="when"><span>${fmtLong(next.date)} · ${where}</span><b>${until(next.date)}</b></div>
        ${vsBlock(next)}
        ${next.official ? "" : `<div class="sub" style="text-align:center"><span class="badge warn">дата предварительная</span></div>`}
      </div>`;
  } else {
    html += `<div class="card empty">Матчей регулярного чемпионата больше нет</div>`;
  }

  if (last) {
    html += `<h2>Последний результат</h2>
      <div class="card hero tap" data-game="${esc(last.id)}">
        <div class="when"><span>${fmtLong(last.date)}</span><span>${until(last.date)}</span></div>
        ${vsBlock(last)}
      </div>`;
  }

  if (upcoming.length) {
    html += `<h2>Дальше</h2><div class="list">${upcoming.map(gameRow).join("")}</div>`;
  }
  html += footer();
  return html;
}

function renderCalendar() {
  const teamId = state.cal.team;
  let list = teamId ? gamesOf(teamId) : games();
  if (teamId && state.cal.side !== "all") {
    list = list.filter((g) => (state.cal.side === "home" ? g.home === teamId : g.away === teamId));
  }

  const opts = state.data.teams
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((t) => `<option value="${esc(t.id)}"${t.id === teamId ? " selected" : ""}>${esc(t.name)}</option>`)
    .join("");

  let html = `<div class="chips">
      <button class="chip${teamId === state.fav ? " on" : ""}" data-cal-team="${esc(state.fav)}">Моя команда</button>
      <button class="chip${!teamId ? " on" : ""}" data-cal-team="">Вся лига</button>
      <select class="chip${teamId && teamId !== state.fav ? " on" : ""}" id="cal-team-select">
        <option value="">Другая команда…</option>${opts}
      </select>
    </div>`;
  if (teamId) {
    html += `<div class="chips">${[["all", "Все"], ["home", "Дома"], ["away", "Выезд"]]
      .map(([k, v]) => `<button class="chip${state.cal.side === k ? " on" : ""}" data-cal-side="${k}">${v}</button>`)
      .join("")}</div>`;
  }

  let month = "";
  let open = false;
  const today = todayISO();
  let todayMarked = false;
  for (const g of list) {
    const m = g.date.slice(0, 7);
    if (m !== month) {
      if (open) html += `</div>`;
      const d = parseISO(g.date);
      html += `<h2>${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}</h2><div class="list">`;
      month = m;
      open = true;
    }
    if (!todayMarked && g.date >= today) {
      html += `<span id="today-anchor"></span>`;
      todayMarked = true;
    }
    html += gameRow(g);
  }
  if (open) html += `</div>`;
  if (!list.length) html += `<div class="card empty">Матчей нет</div>`;
  html += `<div class="foot">Официальный календарь пока есть только у «Рязань-ВДВ». Даты остальных матчей — предварительные, уточним после открытия сайта РХЛ.</div>`;
  return html;
}

function renderTable() {
  const conf = state.conf;
  const rows = state.data.standings[conf] || [];
  let html = `<div class="chips">${Object.entries(CONF)
    .map(([k, v]) => `<button class="chip${conf === k ? " on" : ""}" data-conf="${k}">${v}</button>`)
    .join("")}</div>`;
  html += `<table class="st"><thead><tr><th class="n">#</th><th class="team">Команда</th><th>И</th><th>В</th><th>П</th><th>Ш</th><th>О</th></tr></thead><tbody>`;
  rows.forEach((r, i) => {
    const wins = r.w + r.otw + r.sow;
    const losses = r.l + r.otl + r.sol;
    const cls = [r.team === state.fav ? "fav" : "", i === PLAYOFF_CUT ? "cut" : ""].filter(Boolean).join(" ");
    html += `<tr class="${cls}" data-team="${esc(r.team)}">
      <td class="n">${i + 1}</td>
      <td class="team">${esc(team(r.team).name)}</td>
      <td>${r.gp}</td><td>${wins}</td><td>${losses}</td><td>${r.gf}:${r.ga}</td><td class="pts">${r.pts}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  const played = rows.some((r) => r.gp);
  html += `<div class="foot">${played ? "Победа — 2 очка, поражение в овертайме или по буллитам — 1. В плей-офф выходят 8 команд конференции." : "Сезон начнётся 3 октября — таблица заполнится после первых матчей."}</div>`;
  return html;
}

function renderTeamPicker(onboarding) {
  let html = onboarding
    ? `<h1>За кого болеете?</h1><div class="sub">Главный экран, календарь и таблица подстроятся под команду. Поменять можно в любой момент.</div>`
    : `<h1>Моя команда</h1><div class="sub">Сейчас: ${esc(team(state.fav).name)}</div>`;
  for (const conf of ["east", "west"]) {
    html += `<h2>${CONF[conf]}</h2><div class="grid">`;
    state.data.teams
      .filter((t) => t.conf === conf)
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .forEach((t) => {
        html += `<button class="pick${t.id === state.fav ? " on" : ""}" data-pick="${esc(t.id)}"><b>${esc(t.name)}</b><span>${esc(t.city)}</span></button>`;
      });
    html += `</div>`;
  }
  return html;
}

function footer() {
  const upd = state.data.updated ? new Date(state.data.updated) : null;
  const when = upd ? upd.toLocaleString("ru-RU", { timeZone: TZ, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";
  return `<div class="foot">${esc(state.data.league)}, сезон ${esc(state.data.season)}${when ? `<br>Данные обновлены ${esc(when)} (МСК)` : ""}</div>`;
}

// ---------- карточка матча ----------

function openMatch(id) {
  const g = games().find((x) => x.id === id);
  if (!g) return;
  let html = `<div class="grab"></div>
    <div class="sheet-head"><div class="sub">${fmtLong(g.date)} ${parseISO(g.date).getUTCFullYear()} · ${until(g.date)}</div>
    <button class="close" data-close aria-label="Закрыть">✕</button></div>
    <div class="card">${vsBlock(g)}`;
  if (g.score && g.score.periods && g.score.periods.length) {
    html += `<div class="periods">${g.score.periods.map((p) => `${p[0]}:${p[1]}`).join(" · ")}</div>`;
  }
  html += `</div>`;

  if (g.goals && g.goals.length) {
    html += `<h2>Голы</h2><div class="list">${g.goals
      .map((x) => `<div class="goal ${x.team}">
          <div class="tm">${esc(x.period === "РБ" ? "Б" : x.time)}</div>
          <div class="who">${esc(x.author)}${x.assists.length ? `<div class="as">${x.assists.map(esc).join(", ")}</div>` : ""}</div>
          <div class="sc">${esc(x.score)}</div>
        </div>`)
      .join("")}</div>`;
  }

  html += `<h2>О матче</h2><div class="card"><dl class="facts">`;
  if (g.n) html += `<dt>Матч</dt><dd>№ ${esc(g.n)} в календаре лиги</dd>`;
  html += `<dt>Где</dt><dd>${esc(team(g.home).city)}</dd>`;
  if (g.time) html += `<dt>Начало</dt><dd>${esc(g.time)} (местное)</dd>`;
  if (g.attendance) html += `<dt>Зрители</dt><dd>${esc(g.attendance)}</dd>`;
  html += `<dt>Календарь</dt><dd>${g.official ? "официальный, ФХР" : '<span class="badge warn">предварительный</span>'}</dd>`;
  if (g.score) html += `<dt>Счёт</dt><dd>по протоколу лиги</dd>`;
  html += `</dl></div>`;

  const sheet = $("#sheet");
  sheet.innerHTML = html;
  sheet.hidden = false;
  $("#sheet-backdrop").hidden = false;
  sheet.scrollTop = 0;
  if (inTelegram) tg.BackButton.show();
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
    screen.innerHTML = renderTeamPicker(true);
    return;
  }
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === state.tab));
  const views = { home: renderHome, calendar: renderCalendar, table: renderTable, team: () => renderTeamPicker(false) };
  screen.innerHTML = views[state.tab]();
  if (state.tab === "calendar" && !state.scrolledToToday) {
    const a = $("#today-anchor");
    if (a) a.scrollIntoView({ block: "center" });
    state.scrolledToToday = true;
  } else {
    window.scrollTo(0, 0);
  }
}

function go(tab) {
  if (tab === state.tab) return;
  state.tab = tab;
  if (tab === "calendar") state.scrolledToToday = false;
  if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
  render();
}

function setFav(id) {
  state.fav = id;
  state.cal.team = id;
  state.conf = team(id).conf;
  saveFav(id);
  state.tab = "home";
  render();
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-tab],[data-game],[data-pick],[data-cal-team],[data-cal-side],[data-conf],[data-team],[data-close],#sheet-backdrop");
  if (!el) return;
  if (el.id === "sheet-backdrop" || el.hasAttribute("data-close")) return closeMatch();
  if (el.dataset.tab) return go(el.dataset.tab);
  if (el.dataset.game) return openMatch(el.dataset.game);
  if (el.dataset.pick) return setFav(el.dataset.pick);
  if (el.dataset.calTeam !== undefined) {
    state.cal.team = el.dataset.calTeam || null;
    state.cal.side = "all";
    state.scrolledToToday = false;
    return render();
  }
  if (el.dataset.calSide) {
    state.cal.side = el.dataset.calSide;
    return render();
  }
  if (el.dataset.conf) {
    state.conf = el.dataset.conf;
    return render();
  }
  if (el.dataset.team) {
    state.cal = { team: el.dataset.team, side: "all" };
    state.scrolledToToday = false;
    state.tab = "calendar";
    return render();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "cal-team-select" && e.target.value) {
    state.cal = { team: e.target.value, side: "all" };
    state.scrolledToToday = false;
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
    document.documentElement.classList.add("tg");
    tg.ready();
    tg.expand();
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
  } else {
    state.conf = "east";
  }
  render();
}

main();

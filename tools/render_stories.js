// Рисует карточки клубов для Telegram Stories (ADR-004): webapp/story.html → webapp/stories/<id>.jpg
//
//   venv/bin/python build_data.py                       # нужен webapp/data/league.json
//   (cd webapp && python3 -m http.server 8000) &
//   npm i -D playwright && node tools/render_stories.js [http://localhost:8000/]
//
// Перерисовывать, когда меняются эмблемы, названия клубов или сезон.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:8000/";
const OUT = path.join(__dirname, "..", "webapp", "stories");

(async () => {
  const teams = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "teams.json"), "utf8"));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  for (const t of teams) {
    await page.goto(`${BASE}story.html?team=${encodeURIComponent(t.id)}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT, `${t.id}.jpg`), type: "jpeg", quality: 82 });
    console.log(t.id);
  }
  await browser.close();
})();

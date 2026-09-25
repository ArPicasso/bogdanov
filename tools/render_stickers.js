// Рисует стикеры бота (ADR-005): stickers/stickers.html?s=<имя> → stickers/<имя>.webp, 512×512,
// и эмодзи: stickers.html?s=e-<имя> → stickers/emoji/<имя>.webp, 100×100 (список — stickers/emoji.json)
//
//   (python3 -m http.server 8000) &                     # из корня репозитория
//   npm i -D playwright && node tools/render_stickers.js [http://localhost:8000/stickers/]
//
// Telegram принимает статичный стикер только в WEBP. Chromium снимает PNG с прозрачным фоном,
// в WEBP его перегоняет тот же Chromium через canvas — другие зависимости не нужны.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:8000/stickers/";
const OUT = path.join(__dirname, "..", "stickers");
const NAMES = ["hello", "tap", "bell", "gameday"];
const EMOJI = Object.keys(JSON.parse(fs.readFileSync(path.join(OUT, "emoji.json"), "utf8")));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const jobs = [
    ...NAMES.map((n) => [n, path.join(OUT, `${n}.webp`), 512]),
    ...EMOJI.map((n) => [`e-${n}`, path.join(OUT, "emoji", `${n}.webp`), 100]),
  ];
  fs.mkdirSync(path.join(OUT, "emoji"), { recursive: true });
  for (const [name, file, size] of jobs) {
    await page.goto(`${BASE}stickers.html?s=${name}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
    const webp = await page.evaluate(async ([b64, size]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, size, size);
      return c.toDataURL("image/webp", 0.92).split(",")[1];
    }, [png.toString("base64"), size]);
    fs.writeFileSync(file, Buffer.from(webp, "base64"));
    console.log(path.relative(OUT, file));
  }
  await browser.close();
})();

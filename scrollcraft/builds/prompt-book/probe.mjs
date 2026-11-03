// Quick look: console errors + frames at chosen scroll positions.
//   node probe.mjs <outDir> <width> <height> [reduced]
import { chromium } from "playwright-core";
import fs from "node:fs";

const [out = "lab/probe", w = "1440", h = "900", mode = ""] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, reducedMotion: mode === "reduced" ? "reduce" : "no-preference", deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("requestfailed", (r) => errors.push("FAILED " + r.url()));
await page.goto("http://localhost:4500/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(2500);

const vh = +h;
const marks = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll("#app > section, #app > footer").forEach((s) => {
    out[s.id] = { top: s.getBoundingClientRect().top + scrollY, height: s.offsetHeight };
  });
  out.__total = document.documentElement.scrollHeight;
  return out;
});
console.log(JSON.stringify(marks));

const shots = [];
const hero = marks.top;
for (const f of [0, 0.15, 0.3, 0.45, 0.6, 1]) shots.push([`hero-${f}`, Math.round(f * (hero.height - vh))]);
for (const [id, m] of Object.entries(marks)) {
  if (id === "top" || id.startsWith("__")) continue;
  const travel = Math.max(m.height - vh, 0);
  shots.push([`${id}-a`, Math.round(m.top - vh * 0.35)]);
  shots.push([`${id}-b`, Math.round(m.top + travel * 0.1)]);
  if (travel > vh * 0.3) {
    shots.push([`${id}-c`, Math.round(m.top + travel * 0.5)]);
    shots.push([`${id}-d`, Math.round(m.top + travel * 0.92)]);
  }
}
let i = 0;
for (const [name, y] of shots) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${String(i++).padStart(2, "0")}-${name}.png` });
}
console.log("errors:", errors.length ? errors : "none");
await browser.close();

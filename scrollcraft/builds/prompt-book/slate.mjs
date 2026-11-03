// Frames through the Skills slate: takes advance with scroll, clap mid-cut, phone layout.
import { chromium } from "playwright-core";
import fs from "node:fs";

const OUT = "lab/slate";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:4500/", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => { const s = document.getElementById("skills"); return { top: s.getBoundingClientRect().top + scrollY, height: s.offsetHeight }; });
  const travel = m.height - h;
  const takes = [];
  for (const f of [-0.3, 0.05, 0.35, 0.65, 0.97]) {
    const y = Math.round(m.top + (f < 0 ? f * h : f * travel));
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
    await page.waitForTimeout(1300);
    takes.push(await page.evaluate(() => [document.querySelector(".slate__no").textContent, document.querySelector(".slate__name").textContent]));
    await page.screenshot({ path: `${OUT}/${w}-${f}.png` });
  }
  // one wheel step mid-scene, caught mid-clap
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), Math.round(m.top + 0.35 * travel));
  await page.waitForTimeout(1000);
  await page.mouse.move(w / 2, h / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(110);
  await page.screenshot({ path: `${OUT}/${w}-clap.png` });
  const overflow = await page.evaluate(() => { const n = document.querySelector(".slate__name"), b = document.querySelector(".slate__take"); return n.scrollWidth - b.clientWidth; });
  console.log(w, JSON.stringify({ span: await page.getAttribute("#skills", "data-sc-span"), takes, nameOverflowPx: overflow, errors }));
}
await browser.close();

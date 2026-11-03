// Projects rail: filtering down to a few cards centres them; back to All pans again.
import { chromium } from "playwright-core";
import fs from "node:fs";

fs.mkdirSync("lab/rail", { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
for (const [w, h] of [[1920, 888], [390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:4500/", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const state = () => page.evaluate(() => {
    const s = document.getElementById("work"), rail = s.querySelector(".rep__rail");
    const cards = [...s.querySelectorAll(".rep__card")].filter((c) => getComputedStyle(c).display !== "none").map((c) => c.getBoundingClientRect());
    const left = Math.min(...cards.map((r) => r.left)), right = Math.max(...cards.map((r) => r.right));
    return { cards: cards.length, sectionTop: Math.round(s.getBoundingClientRect().top), stageTop: Math.round(s.querySelector(".rep__stage").getBoundingClientRect().top),
      offCentre: Math.round((left + right) / 2 - innerWidth / 2), leftEdge: Math.round(left), fit: rail.classList.contains("is-fit"), transform: rail.style.transform || "none", span: s.getAttribute("data-sc-span") };
  });
  // into the middle of the held stage
  const m = await page.evaluate(() => { const s = document.getElementById("work"); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight }; });
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), Math.round(m.top + (m.h - h) * 0.6));
  await page.waitForTimeout(1500);
  const r = { before: await state() };
  await page.click('#work .chip[data-filter="Object Oriented Programming"]');
  await page.waitForTimeout(900);
  r.oop = await state();
  await page.screenshot({ path: `lab/rail/${w}-oop.png` });
  await page.click('#work .chip[data-filter="Machine Learning"]');
  await page.waitForTimeout(900);
  r.ml = await state();
  await page.screenshot({ path: `lab/rail/${w}-ml.png` });
  await page.click('#work .chip[data-filter="*"]');
  await page.waitForTimeout(900);
  r.all = await state();
  await page.mouse.move(w / 2, h / 2);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(200); }
  await page.waitForTimeout(800);
  r.allScrolled = await state();
  r.errors = errors;
  console.log(w, JSON.stringify(r, null, 1));
}
await browser.close();

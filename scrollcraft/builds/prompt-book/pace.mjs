// Pace: slow scroll keeps full scenes, a flick shortens the ones ahead, jumps land.
import { chromium } from "playwright-core";
import fs from "node:fs";

const OUT = "lab/pace";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:4500/", { waitUntil: "load" });
await page.waitForTimeout(2500);

const spans = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-sc-act]")].map((s) => [s.id, s.getAttribute("data-sc-span")])));
const pace = () => page.evaluate(() => document.body.dataset.pace);
const r = { start: await spans() };

// 1. Slow reading scroll: 3 wheel notches of 100px every 250ms
for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(250); }
r.slow = { pace: await pace(), spans: await spans(), y: await page.evaluate(() => scrollY) };
await page.mouse.move(700, 450);
for (let i = 0; i < 6; i++) { await page.mouse.move(700 + i * 8, 450 + i * 5); await page.waitForTimeout(40); }
await page.screenshot({ path: `${OUT}/1-slow-mouse.png` });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/2-still-constellation.png` });

// 2. A flick: big wheel deltas in quick succession, screenshot mid-flick
const anchor = () => page.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); const b = el.getBoundingClientRect(); return { tag: el.className || el.tagName, top: Math.round(b.top) }; });
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 420); await page.waitForTimeout(16); }
await page.screenshot({ path: `${OUT}/3-flick-streak.png` });
r.flick = { pace: await pace(), spans: await spans(), mode: await page.textContent("#desk-mode") };
await page.waitForTimeout(1400);
r.afterFlickSettle = { pace: await pace(), spans: await spans() };

// 3. Visible content must not move when lengths change below the screen
const before = await anchor();
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(16); }
await page.waitForTimeout(30);
const y1 = await page.evaluate(() => scrollY);
await page.waitForTimeout(1200);
const y2 = await page.evaluate(() => scrollY);
r.noJump = { before, scrollMovedWhileIdle: y2 - y1 };

// 4. Cue list jump lands on its scene
await page.click("#desk-toggle");
await page.click('#cue-list a[data-cue="activities"]');
await page.waitForTimeout(2500);
r.jumpActivities = await page.evaluate(() => Math.round(document.getElementById("activities").getBoundingClientRect().top));
await page.click("#desk-toggle");
await page.click('#cue-list a[data-cue="top"]');
await page.waitForTimeout(3000);
r.jumpTop = await page.evaluate(() => scrollY);
r.end = { pace: await pace(), spans: await spans() };
r.errors = errors;
console.log(JSON.stringify(r, null, 1));
await browser.close();

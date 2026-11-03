// Exercise the real controls: filters, modal, cue list, keyboard, overflow.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const out = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:4500/", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const r = { size: `${w}x${h}` };

  r.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  // Activities filter
  await page.locator('#activities .chip[data-filter="Competitions"]').scrollIntoViewIfNeeded();
  await page.click('#activities .chip[data-filter="Competitions"]');
  r.competitionsShown = await page.$$eval("#activities .credit", (els) => els.filter((e) => getComputedStyle(e).display !== "none").length);
  await page.click('#activities .chip[data-filter="*"]');
  r.allShown = await page.$$eval("#activities .credit", (els) => els.filter((e) => getComputedStyle(e).display !== "none").length);

  // Modal from a credit, keyboard close
  await page.locator("#activities .credit__inner").nth(1).click();
  await page.waitForTimeout(400);
  r.modalTitle = await page.textContent("#modal-title");
  r.modalLinks = await page.$$eval(".modal__actions a", (a) => a.map((x) => x.textContent.trim() + " -> " + x.getAttribute("href")));
  r.focusInModal = await page.evaluate(() => !!document.activeElement.closest(".modal"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  r.modalClosed = await page.evaluate(() => !document.querySelector("#modal").classList.contains("is-open"));

  // Projects filter refits the rail
  const spanBefore = await page.getAttribute("#work", "data-sc-span");
  await page.evaluate(() => document.querySelector("#work").scrollIntoView());
  await page.waitForTimeout(300);
  await page.click('#work .chip[data-filter="Machine Learning"]');
  r.workSpan = `${spanBefore} -> ${await page.getAttribute("#work", "data-sc-span")}`;
  r.workShown = await page.$$eval("#work .rep__card", (els) => els.filter((e) => getComputedStyle(e).display !== "none").length);
  await page.click('#work .chip[data-filter="*"]');

  // Keyboard: Enter on a project card opens it
  await page.focus("#work .rep__inner");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  r.enterOpens = await page.textContent("#modal-title");
  await page.keyboard.press("Escape");

  // Cue list jumps
  await page.click("#desk-toggle");
  r.cueList = await page.$$eval("#cue-list a", (a) => a.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
  await page.click('#cue-list a[data-cue="skills"]');
  await page.waitForTimeout(1500);
  r.afterJump = { go: await page.textContent("#go-label"), lx: await page.evaluate(() => document.body.dataset.lx), listHidden: await page.evaluate(() => document.querySelector("#cue-list").hidden) };

  // Live GitHub numbers replaced the yml fallback?
  r.stats = await page.$$eval(".ledger__num", (n) => n.map((x) => x.textContent));
  r.errors = errors;
  out.push(r);
}
console.log(JSON.stringify(out, null, 1));
await browser.close();

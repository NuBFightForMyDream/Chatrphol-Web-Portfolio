# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| prompt-book (Chatrphol portfolio, 2026-11-03) | Prompt book (new): scenes in running order, each a lighting state | Fixed prompt desk in the bottom-right corner: GO / STANDBY rows with cue lamps, expands to a jumping cue list; no top bar | Pinned 3.0vh layered stage built from CSS/SVG planes (cyc, battens, floor, follow-spot iris on the real photo, velvet tabs, proscenium, seat backs); tabs part, house darkens, name flies up into the valance | pin(3.0) > flow+count > pin(2.6, cue per entry) > reveal (flow) > flow rows > pan(1.2-2.6, fitted) > bespoke follow-spot list > pin(1.5) close; 8 scenes, 16.3vh desktop | Curtain call: house lights up (drift to warm ground), name bow, email as underlined running link + one button, socials, holds | The desk calls the show: STANDBY red lamp as a scene nears, GO green as it crosses the line, and the whole page's lighting state crossfades | Black box theatre, two gels from content.yml (lavender UI, amber light only), no generated imagery | localhost:4500 (repo root) |

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

- **prompt-book**: the *Prompt book* grammar; a fixed cue-desk nav with GO/STANDBY lamps; scene-wide lighting crossfades on a scroll call; a theatre-curtain layered hero; a house-lights-up close; follow-spot list-with-sticky-window for a long credits run.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.

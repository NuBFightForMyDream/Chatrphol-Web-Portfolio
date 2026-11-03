# BRIEF: Chatrphol (Nine) portfolio, "Prompt book"

Partly interviewed (2026-11-03). Topics the owner answered are quoted. The rest are
**authored decisions**, made because the owner answered only some topics and asked
for the redesign to go ahead. Each one is labelled.

Standing constraint from the owner: "เเต่ยังคงดีเทลเเละการเติมข้อมูลทุกอย่างเหมอนเดิม"
(keep every detail and keep filling in content exactly as before). So `content.yml`, its schema, and
`.pages.yml` stay as they are, and every field that rendered before still renders.

## The eight topics

1. **Vibe.** Owner: "ธีม stage play". Authored: *black box theatre, a lit stage, the crew's view of a show*.
   References (authored): a printed theatre programme, a stage manager's prompt book, a
   follow spot cutting through haze.
2. **Journey.** Owner: "โครงหน้าเเบบเดิม" (keep the current page structure). Order stays as in the old
   `main.js`: Hero → About → Education → Skills → Experiences → Projects → Activities → (Contact if defined) → footer.
3. **Energy curve.** Owner: "ไม่มีจังหวะตายตัว" (no fixed rhythm). Read as: no uniform beat. Each section
   gets a different pace. Authored: quiet preshow, a big curtain-up, a calm middle, a dense
   credits run, and a warm, settled end.
4. **Feeling / the one moment.** Authored, see the curve and peak below.
5. **The thing no other site does.** Authored: scrolling *calls the show*. A stage manager's cue
   desk stands by for each section and calls GO as you reach it, and the stage lighting for the whole page changes on the call.
6. **Range.** Owner: "premium-minimal".
7. **One world or scenes.** Authored: scenes. The owner asked for the old section structure, so a
   continuous world is out.
8. **Assets.** Authored: real photos from `images/` only. No generated imagery, no spend
   (no `KIE_AI_API_KEY`). The profile photo is a white-background ID shot. It becomes the subject
   inside a follow-spot iris, so the white background reads as the pool of light.

## Grammar: Prompt book (new)

A show in running order. Each content section is a **scene with its own lighting state**.

- **Navigation:** the prompt desk, fixed in the prompt corner (bottom right). It shows the cue being
  run (GO) and the next one (STANDBY), and it opens into the full cue list, which jumps.
  Cue numbers appear only on the desk, written like a real prompt book (LX 1, LX 4, LX 7). They are
  the vocabulary of the desk, not a progress counter.
- **Sequence:** scenes cut on a lighting change, not a crossfade of content. Pages that have already
  been lit stay lit (no re-hiding).
- **Ending:** the curtain call. The house lights come up (the ground warms and lifts), and it holds.
- **Bans:** section numbers or eyebrows in headings; scroll cues; custom cursor; glow, gradient text,
  violet-to-blue blobs; card grids as page structure; `scrub` (no footage); centred copy outside the
  front cloth.

Why the other seven grammars lost: *filmic one-shot*, because a portfolio is a range, not one argument;
*chaptered editorial*, because it bans the pinned acts the curtain and biography need; *live surface*,
because there is no product to run; *continuous world*, because the owner kept the section structure and it is the most fragile build;
*typographic poster*, because there are real photographs to show; *gallery*, which suits the work sections but not a
performance that runs in order; *split stage*, because there is no two-sided argument;
*rhythmic cutlist*, because it is the opposite of premium-minimal.

## Feeling curve (written before the score)

| # | Scene (section) | Feeling | What on screen causes it |
|---|---|---|---|
| 1 | Preshow → curtain up (hero) | anticipation → **awe** | Closed velvet front cloth with the name lit by a single front-of-house spot; house lights fade, the curtain parts, the stage is revealed with him standing on his mark in the follow spot |
| 2 | Programme note (About) | intimacy | Small, quiet, printed-programme typography after all that scale; the roles read as "appearing as" credits |
| 3 | Biography (Education) | reflection | The frame holds in low cold light while the years change one at a time along a fly line |
| 4 | Kit list (Skills) | order / competence | Work lights snap on: a hard wipe reveals a ruled props checklist |
| 5 | Engagements (Experiences) | assurance | Plain, confident rows; nothing moves except the rows settling in |
| 6 | Repertoire (Projects) | curiosity | The stage holds while the productions travel sideways past you |
| 7 | Credits (Activities) | pride / weight | A long dense credits run; the follow spot picks out one production at a time and its photo appears in the side window |
| 8 | Curtain call (close) | warmth, resolve | House lights up, a warm ground, the name takes its bow, a way to get in touch. It holds |

No two adjacent rows share a feeling.

**Peak:** scene 1, the curtain up.
> "The page opens on a closed theatre curtain with my name on it, and when you scroll the house lights
> go down and the curtain opens on me standing in a spotlight."

It has the largest span on the page (3.0 viewport-heights). The silence before it is the preshow: on
landing nothing moves until the visitor scrolls (authored stillness, not dead scroll).

**It's the site where** "scrolling runs the show like a stage manager: a cue light stands by,
calls GO, and the lighting changes as you arrive at each part of my life."

## Score

| Scene | Device | Why this one |
|---|---|---|
| Curtain up | `pin` 3.0 + layered planes driven from `--sc-p` (cyc, battens, floor, subject, curtain, proscenium, seats, haze) | A reveal of depth needs the frame to hold while the planes separate |
| Programme note | `flow` + `in` + real counters | Information, compressed; intimacy comes from scale dropping |
| Biography | `pin` (short) with cue windows per entry | A held breath; one year at a time |
| Kit list | `reveal` (wipe down) | A work light switching on is a change of state |
| Engagements | `flow` + stagger | Administrative, so it is kept short |
| Repertoire | `pan` | Lateral travel reads as range |
| Credits | bespoke follow-spot (scroll-driven, page JS) + sticky photo window | Weight from density; the spot keeps it readable |
| Curtain call | `pin` (short) + `drift` to the house-light ground, last cue holds | The ending resolves and stands still |

Families: pin, flow/in, count, reveal, pan, drift, plus the bespoke spot. No device twice in a row. Zero `scrub`.

## Signature move

**The prompt desk calls the show.** As a section approaches, its cue goes to STANDBY (red cue
light). When it crosses the reading line the desk calls GO (green), and the page's lighting state
crossfades to that scene's state, with a fade time like a real lighting cue. The desk doubles as navigation.

## Authored silence

The landing view of the hero holds still until the first scroll. That stillness is intentional.

## Revision 2 (2026-11-03): pace and stars

Owner: "ยังอยากให้ดาวเชื่อมกันเหมือนเดิม เเต่เรื่องการ scroll อยากให้ปรับ เเบบว่าเลื่อนเร็วๆไปได้ เเต่ถ้าอยากเลื่อนช้าก็จะเป็นอีกเเบบ"
(keep the stars connecting like before; scrolling fast should get through, scrolling slowly should be a different experience)

- **Stars return**, same behaviour as the old site (twinkle, link to the pointer within 150px and to each
  other near it), on a fixed canvas between the lighting washes and the page. The hero's back wall is now
  translucent, so after the curtain opens the stage has a night-sky cyc.
- **Pace is read from the hand**, named in the desk's own vocabulary:
  - *Cue to cue* (more than 0.9 viewport travelled in 300ms): the pinned scenes still below the screen
    shorten (education 1.25, projects 1.4, close 1.2), the lighting crossfades in 0.28s, reveals stop waiting, and the stars streak
    in the scroll direction.
  - *Full run* (slow for 450ms): every scene ahead goes back to its full length, the hero planes glide
    (lerped), fades run at their full time, and if the page is left still the whole sky links into a constellation.
  - Lengths only change for scenes entirely below the viewport, so nothing on screen moves. A jump from any `#` link holds the layout
    still until it lands.
- Base lengths shortened: hero 3.0 to 2.6 (still the longest), education max 2.3, projects max 2.4.

## Revision 3 (2026-11-03): Skills as takes

Owner: "ตรง part skills อยากให้มันขยับได้ เเบบเลื่อนได้ หรือเป็น take เเบบ scene cutter ก็ได้"
(make Skills move, either scrolling or as takes, like a scene cutter)

- Skills is now a **clapperboard scene**: a pinned stage (span 1.2 + 0.08 per tool, max 2.2; 1.2 cue to cue). Scroll
  position picks the take. Each new take is a hard cut with no fade: the stick snaps shut, the board knocks, and a one-frame flash marks the cut.
  Slate fields: Prod. (profile.name), Scene (skills.title), Take (number). The full tool list sits beside it,
  and takes already shot stay ticked, so the list is a record of the scene.
- Feeling: snap / momentum after the education scene's quiet hold. The two scenes are adjacent pins, which breaks the "no device twice in
  a row" rule. That is accepted because they behave oppositely (slow crossfade vs hard cuts) and the owner asked
  for this motion. Recorded here so it reads as a decision.
- Reduced motion keeps the old static checklist.
- Desktop length is now 17.0 viewport-heights in a full run, and the pace system shortens the pinned scenes when the page is scrolled hard.

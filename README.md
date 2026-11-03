# 🎭 Chatrphol's Web Portfolio

A one-page portfolio styled as a stage play. It opens on a closed curtain with my name on it. Scrolling opens the curtain, and every section after that is a "scene" with its own stage lighting.

All the text on the site lives in **`content.yml`**: profile, projects, activities, experiences, education, skills, colours and button labels. Edit that file and the site updates. No code needed.

**Live:** https://nubfightformydream.github.io/Chatrphol-Web-Portfolio/

```
├── content.yml            ← edit this (all site text)
├── images/                ← profile, project, activity and experience photos
├── assets/icons/skills/   ← skill logos (.svg)
├── .pages.yml             ← Pages CMS form config (optional)
├── index.html             ┐
├── assets/css, js, vendor ┘ site code
└── scrollcraft/           ← design notes (BRIEF.md) + the pre-redesign files; not used by the site
```

---

## Publishing

GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / `(root)`**. Any commit to `main` goes live in about a minute.

If the site still shows the old version, hard refresh with **Cmd + Shift + R**.

---

## Editing

- **On GitHub:** open `content.yml` → ✏️ → edit → **Commit changes**
- **Pages CMS (form view):** https://app.pagescms.org → repo `Chatrphol-Web-Portfolio`, branch `main`. Saving through it may strip the `#` comments from `content.yml`. That doesn't affect the site.
- **Locally:** opening `index.html` directly won't work, because the browser blocks reading `content.yml` from disk. Run `python3 -m http.server 8000` and open http://localhost:8000, or use VS Code Live Server.

Every line in `content.yml` has a `#` comment saying where it appears. If the YAML breaks, the site shows the line number and how to fix it.

### Where each part of `content.yml` shows up

The file order is not the page order. This table follows the page.

| Scene | On the page | Edit |
|---|---|---|
| 1 | Hero: curtain, name, typed roles, buttons → curtain opens on my photo in a spotlight, intro, socials, highlight tape | `profile`, `socials`, `skills.highlights` |
| 2 | About: text, black and white playbill headshot, stat counters | `about` |
| 3 | Education: held frame, one period at a time | `education` |
| 4 | Skills: clapperboard, one take per tool, with logos | `skills` |
| 5 | Experiences: rows, click for details | `experiences` |
| 6 | Projects: held frame, cards travel sideways, filters | `projects` |
| 7 | Activities: credits list, follow spot, filters | `activities` |
| Close | Curtain call: house lights up, name, email, socials, resume | `footer`, `profile.email`, `profile.resume`, optional `contact` |

Other things:

| To change | Edit |
|---|---|
| Browser tab title | `profile.site_title`. Also update `<title>` in `index.html` so shared links in LINE or Facebook show it |
| Section headings / menu names | `title`, `subtitle`, `menu` in each section |
| Button and label text (View my work, Let's talk, Scenes…) | `labels` |
| Colours | `theme` |

### Recipes

**New project / activity / experience.** All three use the same fields. Copy a block into that section's `items:` and keep the indentation.

```yaml
    - title: My New Project
      category: Machine Learning        # builds the filter buttons
      type: Personal Project            # tag under the title (projects)
      team: [Front-End Developer]       # tag under the title (activities)
      year: Dec 2026
      description: Short line.
      details: Longer text for the detail view (optional).
      image: "images/projects/my-project.png"   # empty = auto playbill cover
      gallery: [images/a.jpg, images/b.jpg]
      video: https://youtu.be/xxxx      # YouTube plays in the detail view
      link: https://github.com/...
      tags: [Junior, Python]
      featured: false                   # projects: wide card + Featured label
```

Any field can be left out. `activities.categories` sets filter buttons that always show, even when empty.

**Stats.** `github: contributions` or `github: repos` pulls live numbers from the GitHub link in `socials`. `number` is the fallback if the API is down or rate-limited.

**Skills and logos.** `skills.items` can hold any number of tools. The scene length adapts, and duplicates show once. Logos are matched by name to `assets/icons/skills/<name>.svg`, lowercased with symbols removed: `Docker` → `docker.svg`, `C++` → `cplusplus.svg`, `Node.js` → `nodejs.svg`. `HTML/CSS/JavaScript` shows one logo per part. A missing file just means no logo. New ones come from [devicon.dev](https://devicon.dev) ("plain" SVGs) or [simpleicons.org](https://simpleicons.org); the site recolours them to match.

**Contact block (optional).** The close already has email, socials and resume. Adding this gives it a heading and line of its own, and adds Contact to the menu:

```yaml
contact:
  menu: Contact
  title: Let's work together
  text: Open to internships in data and AI.
```

**Colours.** The two colours act as stage-light gels. `accent` is the interface colour (buttons, menu, numbers). `accent2` is used only as light (spotlight, house lights, stars).

**Images.** Upload to `images/` and reference them as `images/name.jpg`. Use English names with no spaces, and keep files under about 500KB. Phone photos are several MB.

**Hiding a section.** Empty its `items` and it disappears from the page and the menu.

### YAML rules

1. `#` starts a comment
2. Don't delete keys or their `:`
3. Indent with spaces, never Tab
4. Quote text that contains `:` or `#`
5. List items start with `-`

---

## How the page behaves

| Part | Behaviour |
|---|---|
| Prompt desk (bottom right) | Works as the menu, styled as a stage manager's desk: red **STANDBY** as the next scene approaches, green **GO** when it arrives, and the page lighting changes with each scene. **Scenes** opens the section list |
| Scroll speed | Slow = **Full run**: full-length scenes, eased motion, slow light fades. Fast = **Cue to cue**: the pinned scenes ahead shorten, lights snap, nothing waits |
| Stars | Twinkle and link up to the mouse. Left still, the whole sky joins into constellations. Scrolling fast streaks them |
| Skills | Each scroll step claps a new take, and ticks build up in the list |
| Projects | When a filter leaves only a few cards, they centre and stop travelling |
| Activities | A follow spot lights the row being read and shows its photo in the side window (inline photos on mobile) |
| Detail view | Click any card or row; Esc closes it |
| Reduced motion | Animations are off. The hero is shown as an open, lit stage and every section reads as a normal page |

Plain HTML/CSS/JS, no build step.

**Credits:** [js-yaml](https://github.com/nodeca/js-yaml) (MIT) · scrollcraft engine (`assets/vendor/scrollcraft.js`) · skill logos from [Devicon](https://devicon.dev) (MIT) and [Simple Icons](https://simpleicons.org) (CC0), see `assets/icons/skills/CREDITS.md` · fonts: Big Shoulders Display and IBM Plex Sans Thai (Google Fonts)

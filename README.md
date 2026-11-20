# Old Possum’s Book of Productivity

A calm focus timer with the look of a medieval bestiary. Your possum writes at its desk while you work, puts its quill down on your breaks, and shuts its eyes when you step away. Other beasts (the cat is usually the first) are earned from bestiary cards. Friends can study with you live. (It used to be called pomocat; saved data and backups carry over.)

- **Three screens that follow the timer.** Before you start, pick what you're working on and which tasks go in this session. While you work, it's your possum, a big timer and this session's tasks. On a break, what waited for you, a break idea, the next session, friends and chat appear.
- **Nothing interrupts a focus session.** Reminders, paws, chat and people joining wait, and show up together on your break.
- **Planner** for the different parts of your life: projects, tasks with steps (parent and child), tags, a follow-up flag, due dates, reminders at a set time, and repeating tasks. Views: today, week, board, projects (each with its own board and notes), calendar, archive, and progress.
- **The hungry pig** (a nod to Porky the Litter Eater) sits at the edge of the desk. Feed it a stray thought while you focus and it hands it back on your break, to make into a task or let go. It eats finished tasks as they go to the archive, or straight away if you drop a finished task on it in the planner.
- **Pour out your notes** on the planner's Notes page: write anything, then sort it into suggested tasks. Dates ("friday", "the 27th", "next week") and project names are picked up from your words; stray thoughts can go to the pig. Sorting happens in the browser (`js/notes-sort.js`), or, if you add your own Anthropic API key in Settings, with Claude (`js/claude-sort.js`: Claude Opus 5.5 through the official SDK loaded from jsDelivr, structured JSON output, your key kept in its own browser storage and never in backups). Sorting with Claude sends your notes, today's date and your project names to Anthropic, billed to your account.
- **Bestiary cards.** Every four focus sessions earns a card, offered face down on that break. Cards unlock beasts (the cat first), backdrops (the starry vault), coats for the cat, and helpers (Streak Shield, Double Ink). The deck is in `js/cards.js`.
- **Automations.** Ticking off every step finishes the parent. Follow-ups come back on their date (or in 3 days). Tasks you pick for a session move to "doing" when you start. Repeating tasks book their next one. Finished tasks move to the archive after a few days.
- **Study live with friends.** Share a link: you see each other quietly while working, can share one timer, and send paws and messages that wait for each other's breaks. Finishing a task can tell the room, on their break.
- **Your own projects**, an optional deadline countdown, level and streak, chimes, desktop notifications, light and dark themes, a page that dims a little in the evening, and backdrops you unlock (parchment with vines to start, the starry vault from a card).
- **Installable** as a desktop app and works offline (except buddy rooms), with the scene window: your buddy at its desk and the time, in a small window that floats above your other windows (Chrome and Edge; `js/pip.js`).

## The Mac app

`mac/` wraps the app in a native window (Swift, AppKit and WebKit) and adds what a web page can't do:

- **A countdown in the menu bar** ("18:24", "Break 4:12", "Paused 18:24"), with a menu to show the app, show or hide the scene window, start or pause, and skip.
- **macOS notifications** when a session or break ends or a reminder is due, sent only while the app isn't in front. Plain words, no emojis.
- **The scene window as a floating panel** that stays above other windows, on every desktop and over full-screen apps (`widget.html`).
- **Sorting notes with Apple Intelligence**, on the Mac itself (macOS 26 with Apple Intelligence on): "Pour out your notes" offers "Sort on this Mac" first. Apple's on-device model splits the notes and writes the titles; the page works out dates and projects from each item's own words. The notes never leave the Mac and it costs nothing. See `mac/Sources/OldPossum/OnDeviceSorter.swift` and `js/mac-sort.js`.

Build it with only the Xcode Command Line Tools:

```bash
./mac/build.sh --open
```

That makes `mac/build/Old Possum.app` (signed for this Mac only). The web files are copied into the app, so rebuild after changing them. The Mac app keeps its own data, separate from the browser's: use Settings, "Make a copy" in the browser and "Bring in a copy" in the app to move your tasks across. `OldPossum --selftest` (run the binary inside the app) checks a build: it reports whether Apple Intelligence is available and sorts two made-up notes on the Mac, starts and pauses the timer from the Mac side, opens the scene window, prints what it sees and quits. The icon is made by `mac/scripts/make_icon.py`.

## Run it locally

```bash
python3 tools/serve.py
```

Then open http://localhost:8000. (Opening `index.html` by double-clicking won't work; browsers block apps like this from running straight off the disk.)

## Put it online (free, with GitHub Pages)

1. Push this repo to GitHub.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, then pick `main` and `/ (root)`.
3. After a minute your site is at `https://<your-username>.github.io/Pomocat/`. Send that link to friends.

Free GitHub Pages needs the repo to be public (or a paid GitHub plan for private repos).

## Use it as a desktop app

- **Chrome / Edge:** open the site, then click the install icon at the right end of the address bar.
- **Safari (macOS Sonoma or later):** File → Add to Dock.

It gets its own window and dock icon, and works offline for solo sessions.

## How buddy rooms work

Rooms are peer-to-peer, so there's no pomocat server to run or pay for. Browsers find each other through public [Nostr](https://nostr.com) relays using [Trystero](https://github.com/dmotz/trystero), then talk directly over WebRTC, end-to-end encrypted. The room code is also the password for the matchmaking messages.

Good to know:

- Anyone with the link can join, so share it like you'd share a video-call link.
- While someone is focusing, anything you send them (a paw, a message, news that you finished a task) waits until their break.
- People in the room see your name, cat, timer, and (if you allow it) your category and current task. As on any video call, peers can see each other's IP address.
- Some strict networks (certain offices and universities) block direct peer-to-peer connections. If two people can't see each other, try a different network or a phone hotspot. For a sturdier setup you can add a TURN server, or swap Trystero's Nostr strategy for its Supabase or Firebase one (same API, free tiers). Both are a few lines in `js/room.js`.

## The art

Your buddy is a medieval, woodcut-style drawing: the possum in `assets/art/possum-writing.svg`, the cat in `assets/art/cat-writing.svg`. It started as a draft from an image tool and was traced into vector in Adobe Illustrator, then loosened so it looks hand-drawn: fewer strokes, a few flat hand-coloured washes, slightly crooked lines. Nothing in it is a live filter.

- `js/scene/art.js` loads the drawing for your beast, repaints a cat's fur for each coat (the `COATS` table) and makes the small faces for friend lists and the buddy picker. Beasts and backdrops are listed in `js/coats.js`; which ones you've unlocked is in `state.unlocks`.
- `css/scene.css` holds the poses: writing while you focus, looking up on breaks, eyes shut when you're away (the possum will play dead once that drawing exists). The head, arms, tail and eyelids are separate layers, so motion is small and held, like a paper cut-out.
- `tools/art-src/` rebuilds the drawing from the draft: `layers.py calm` splits it into colour and ink layers for each moving part, `trace-layers.jsx` traces them in Illustrator, and `assemble-layers.py calm` writes the SVG. `tools/trace-compare.html` compares the versions we tried.
- The possum (the default buddy) goes the same way: `possum-calm.py`, then `trace-layers.jsx` (put `layers-possum-calm` in `trace-dirs.txt`), then `assemble-layers.py possum-calm` writes `assets/art/possum-writing.svg`. `make_paw.py possum` cuts its hand for peering over the planner (`assets/art/possum-paw.svg`).
- `tools/art-src/margins/cut_corners.py` cuts the vine-and-figure corners out of the cream scene into `assets/art/margins/`.

To add a coat: add an entry to `COATS` in `js/scene/art.js` and to `COAT_LIST` in `js/coats.js`.

## Project layout

```
index.html               page structure (scene, timer card, panels, planner, dialogs)
css/app.css              calm UI styles, light and dark
css/scene.css            where the cat sits, its poses, evening dimming
js/main.js               wires everything together; the three screens; holding things until your break
js/timer.js              pomodoro engine (timestamp-based)
js/store.js              saved state, stats and XP, import/export, upgrades from older versions
js/planner.js            projects, tasks, links, reminders, repeats, follow-ups, archive, automations
js/ui/planner-view.js    planner views and the task editor
js/ui/session.js         "this session" checklist and quick-add
js/room.js               buddy rooms (peer-to-peer)
js/scene/scene.js        your cat on screen, speech bubble, hearts
js/scene/art.js          loads the cat drawing, coats, faces
js/ui/*.js               settings, stats, toasts
js/sound.js              synthesized chimes (Web Audio)
js/pip.js                pop-out mini timer
sw.js, manifest.webmanifest   offline and install
assets/art/cat-writing.svg   the cat drawing (layers: tail, static, head, arm, lids)
tools/art-src/           draft images and the trace pipeline
tools/serve.py           local server with caching off
```

Your data stays in your browser (localStorage). Use **Settings → Your data** to export a backup or move it to another browser.

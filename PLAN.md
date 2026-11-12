# Exam season mode: plan and progress log

Handoff for whoever continues this work (person or Claude session). Read this first, then `README.md`.
Branch: `claude/epic-cori-aiec12`. Nothing is merged into `main`, so the live site still runs the 2-week tool only.

## Goal (from the original brief)
Add an "Exam season" mode next to the 2-week mode. **The 2-week mode must keep working exactly as now.**
Students plan toward one target exam (national exams, university session exams) through milestones
(mock exams, midterms, session exams). The tool shows:
1. a **Season map**: one overview page from the start date to the target exam;
2. a **Period calendar**: a detailed calendar from the start date to the next milestone only (same grid style as the 2-week tool).

Constraints: mobile-first; Georgian UI; every new string goes in `js/strings.js` under `en` (the owner translates to `ka`);
Georgian font embedded in the PDF (check PDF and PNG); no accounts, no server, no tracking (minors use it);
localStorage for drafts only, wrapped in try/catch; PDF + PNG export for both pages. Keep the code simple.
**Report any rule conflict to the owner instead of quietly choosing.**

Way of working: 2 stages, show the owner each one.

## Progress log
- **Stage 1: done.** Mode switch; Exams step (target exam, milestones, class tests); Topics step; Days off over the period;
  Season map (overview on screen + full A4 page drawn as SVG). Commits `ad55255`, then the follow-up below.
- **Stage 1 feedback round: done.** Owner asked for:
  1. milestones added automatically → empty rows by exam type, no dates (National → 3 mock exams, Session → 1 midterm, Other → none);
     rows are replaced on type change only while no milestone has a date or name typed;
  2. steps 3 (Exams) and 5 (Tests) looked the same → class tests merged into the Exams step; exam season now has 6 steps;
  3. the "more than 8 weeks" notice came too late → it now also shows on the Exams step (blue note, not a red warning).
  Also fixed: target-exam subjects are ticked on every milestone automatically; "Weeks left: N, days: N" wording.
- **Stage 2: done, owner testing.** Period calendar step (step 7) with all the rules below; PDF + PNG export
  for the season map and the period calendar. First feedback round applied (see "Stage 2 feedback round").

## Next (as of 2026-11-10)
1. Owner keeps testing stage 2; apply further feedback.
2. Owner translates the new `en` strings (exam season section of `js/strings.js`) to `ka`.
3. Test on a real iPhone (Safari): sharing several PNGs at once, canvas size, print to PDF.
4. Then merge `claude/epic-cori-aiec12` into `main` (the live site) once the owner approves.
5. Done (2026-11-12): the 2-week printed test-prep label now puts the subject first, like exam season

## Calendar-first UI (decided 2026-11-10; both modes built on branch `claude/calendar-first`)
Owner wants to replace the step-by-step forms with one screen: a blank calendar the student edits directly,
with sessions appearing as classes and tests are added. Decisions so far:
- **Order:** finish stage 2 testing and merge this branch into `main` first; then build the redesign on a new branch.
- **Rename "review boxes" to "sessions"** everywhere in the UI ("box" undersells them; they are study sessions).
  Needs new `en` strings and the owner's `ka` translation. The print legend and "Boxes n / 4" footer change too.
- **Editing:** tap an empty slot → add a class (repeats weekly) or a test; tap a day header → day off;
  subject chips choose which subjects get sessions; drag classes and tests to move them; undo instead of confirms.
- **Sessions are fixed by default.** An advanced "Move sessions" toggle lets students drag them, after a warning that
  explains why they are placed where they are and what to watch if they move one. Moved sessions can't go on/after
  their test or on/before the lesson they review; moving earlier or over 4 a day shows a warning.
  Moved sessions go back to their planned day if classes, tests or days off change.
- **Phone layout:** days become rows, morning/afternoon/evening become 3 columns; long-press to drag.
- **Print/PNG export unchanged:** `render.js` keeps drawing the A4 pages from the same state.
- Exam season (season map as a zoom level, milestones on a timeline) is not designed in detail yet.
- **Test prep is always locked**, also in advanced mode (owner, 2026-11-10).
- Prototype (2-week mode only, uses the real `schedule.js`): https://claude.ai/artifact/LjE97EobF2aBG8SLw4Kfjd
  Owner approved the design on 2026-11-10: "new design looks good. lets go with it."
- **Built (2-week mode, not merged):** `js/board.js` is the new screen; `app.js` renders it when `mode` is `two`
  (the old 2-week steps are gone). New state: `moved`, `advanced`.
  Moved sessions also print where the student put them (`plan()` applies them). Tests can be added on the greyed days
  after the 2 weeks (they shape the sessions before them); tests further out are listed under the calendar.
  Lesson topics are typed in a class's sheet; "done" ticks in a session's sheet. Undo lives in memory only.
- **Strings:** every English "box" now says "session"; new keys start with `b` or `ses_` (section "2-week calendar screen").
  **`ka` still says უჯრა and the new keys are not translated** (they fall back to English).
- **Checked:** the 3 test files pass; headless Chromium at desktop size: add class/test, after-period test, drag class,
  drag test, locked session, test prep locked, advanced move, undo, day off, mode switch, print SVG; phone layout by
  measuring cells (no screenshot). **Not checked:** a real phone (long-press drag on iOS Safari and Android).
- **Exam season on the same screen (built, not merged).** The step pages are gone for both modes; `app.js` is now only
  state, strings and export. Above the calendar, exam season shows a timeline: Start → Period 1 → milestone → … → target exam,
  then "+ Milestone". Tap the target exam or a milestone to edit type, name, date and subjects in a sheet (changes apply at once);
  tap a period to write its topics. Milestones and the target exam also show in the calendar and can be dragged to a new date.
  "On the target exam" chips replace "Sessions for" (they set the target's subjects and tick them on every milestone; a new
  class subject does not get sessions automatically in this mode). Until the target exam has a date and subjects the calendar
  shows the next 2 weeks, so classes can be added first. **Practice tests are locked like test prep**; fix errors, sort errors
  and old topics can be moved in advanced mode (sort errors only after its exam). Export: period calendar pages + season map.
  The 4-step cycle moved into "How it works".
- **Fixed while testing:** "Start over" (in the export panel, outside the calendar) did nothing in either mode; a refused
  drag of a locked session threw an error.
- **Checked (exam season, headless Chromium, desktop size):** reset, set target date/subjects in the sheet, suggested milestones,
  add classes, change milestone type (practice test + fix errors appear for a midterm), drag a milestone, period topics
  (shown on the printed season map), practice test locked, move old topics + undo, print period (4 pages) and season map.
- **Unused strings:** the old step strings (`step1`, `classesHeading`, `examsHeading`, `topicsHeading`, `viewList`, …) are no
  longer shown. Left in `strings.js` for now; remove them once the owner is happy with the new screen.
- **Owner feedback on exam season (2026-11-10):**
  1. National exams are on several days → `target.subjectDates = { subjectKey: date }`. `target.date` is the first exam day;
     each subject defaults to it and can get its own day in the target sheet ("Day of each exam"), or by dragging that
     subject's exam in the calendar. `buildSeason` gives `target.date` = earliest day, `target.last`, `target.dateOf`;
     each subject's run-up and test prep follow its own day; the last period runs to the last exam day (8-week cap).
     Milestones on or after the first exam day are not used. Test added in `test/period.test.js`.
  2. Milestones of the same type are numbered by date ("Mock exam 1, 2, 3"; undated ones last), on screen and in print.
     A milestone alone of its type, or with its own name, has no number. Milestones still have one date each.
  3. "Each exam should get its own mock exams" → milestones now belong to one subject by default. Choosing the target
     type gives every exam subject its own set (national: 3 mocks, session: 1 midterm); a subject added to the exam gets
     its own set, a subject removed loses its own ones (shared ones just untick it). Suggested dates spread toward that
     subject's own exam day. Numbering counts within the same subject(s). A milestone can still be ticked for several
     subjects (it then shows in each of their rows).
     `buildSeason` returns `tracks`: per exam subject, its upcoming milestones then its exam day, each with `from`.
     The timeline is one row per exam subject with "+ topics" between stops and "+ Milestone" per row. Topics are per
     subject per stretch, stored as before (`topics[stopId][subjectKey]`, `target` for the last stretch).
     The printed season map is now one row per exam on a shared date scale (topics above the line, ruled lines when empty);
     the old subjects × periods table is gone. The global "periods" still decide the calendar's range (up to the next
     milestone of any subject). Test added in `test/season.test.js`.
- **Owner (2026-11-12):** exam subjects come only from classes. The target sheet no longer has an "Add subject" field;
  its chips are the timetable subjects (plus any already chosen). With no classes it says to add classes in the calendar first.
  The "Set target exam" button and the timeline's target exam card are disabled until there is a class subject
  (or a subject already on the target); the empty-state banner now says "Start with your classes".
  The exam season guide steps now start with "Add your classes", then target exam, its subjects, milestones, days off.
- **Milestones are mock exams only (owner, 2026-11-12).** No type picker or name in the milestone sheet; "+ Mock exam" on
  the timeline. Midterm, session exams and other real exams are chosen as the **target exam** (types: national, midterm,
  session, other). A university student plans toward the midterm first, then sets the session exam as the target after it.
  Only national exams add milestones automatically (3 mock exams per subject). Saved plans: every milestone becomes a mock
  exam on load (custom names dropped). `schedule.js` is unchanged and still handles the other milestone types (tests use them).
- **Default start date (2026-11-12):** Monday of the current week (new plans and "Start over"); saved plans keep theirs.
- **Print/PNG labels (2026-11-12):** box labels wrap onto as many lines as needed (no "…"); a word wider than the box is
  split. Each week's morning/afternoon/evening rows share the height by what they hold (at least 60% of an equal share);
  if a slot still overflows, the font shrinks up to 3px, then "+n more" as before. A named lesson shows its date too:
  "12.11 · Fractions", in print and on screen; on screen every session shows its lessons' dates. This intentionally changes the 2-week drawing operations.
- **Theme toggle (2026-11-12):** light / dark / auto buttons in the header, next to the language. Saved under its own
  localStorage key `charte-theme` (not in the plan state, so "Start over" keeps it); an inline script in `index.html` applies
  it before the first paint. Print and PNG stay light.
- **Next:** owner tests both modes on a phone; translate the new strings (`b…`, `ses_…`); remove the unused step strings.

## Verified so far
- `node test/schedule.test.js` → 19 pass (the original 2-week rules, unchanged).
- `node test/season.test.js` → 7 pass (season periods, 8-week cap, passed/late milestones, suggested dates).
- The 2-week printed layout produces byte-identical drawing operations before and after the `render.js` refactor
  (checked with a script that runs `Render.layout` under Node with a fake text measurer).
- Clicked through in headless Chromium at iPhone and desktop sizes, Georgian and English: no console errors; Georgian renders on screen.
- Re-run all three test files after any change; the 2-week comparison scripts were one-off (scratch), not in the repo.
- `node test/period.test.js` → 16 pass (the owner's 5 cases + R21, cumulative, sort errors, run-up on day off / before start, target run-up, mocks without practice test, milestone + 1 day).
- 2-week mode after stage 2: `buildPlan` output identical to the previous commit on 3,000 random inputs (ignoring the internal
  `rank` number and the new `mk` merge key), and `Render.layout` drawing operations identical on 600 layouts.
- Headless Chromium (driven over CDP), Georgian UI: period calendar 2 pages, season map 1 page, 2-week 1 page in PDF;
  **Noto Sans Georgian (regular + bold) embedded** in all three PDFs; PNGs (one per page) show Georgian. No console errors.
- **Not yet checked:** iOS Safari (share sheet with several images, canvas limits); the real print dialog on a phone.
- Known: a few symbols (→, …, !) fall back to a system font (Segoe UI on Windows) in the PDF. Same in the 2-week export before stage 2.

## Where things are
- `js/schedule.js`: `buildPlan` (2-week rules, untouched) and `buildSeason(state)` (target, milestones sorted, `past`, `late`,
  `stops`, `periods`, and `period` = the next one to plan: start → next stop, capped at `PERIOD_MAX` = 56 days, `capped` flag).
  A milestone on or before the start date has passed; one on or after the target exam is ignored.
- `js/render.js`: `painter(measure, t)` shared drawing helpers (rect/line/text/fit/wrap/header); `layout` (2-week calendar);
  `layoutSeason` (season map page). Colours `C.practice` and `C.cum` are already defined for stage 2 boxes.
- `js/app.js`: `STEPS.two` and `STEPS.season` lists; `season()`; `viewExams`, `viewTopics`, `viewMap`; `defaultMilestones()`.
  State fields added: `mode`, `target {type, name, date, subjects}`, `milestones [{id, type, name, date, subjects}]`,
  `topics {periodId: {subjectKey: text}}`, `mapView`. Period id = the id of the milestone that ends it, or `'target'`.
  In exam mode `chosen()` returns the target exam's subjects (they replace the 2-week "priority" subjects).
- `js/strings.js`: new keys in the "Exam season mode" section of `en`. Not translated yet.
- Bump `?v=` in `index.html` after changing css/js (now `v=28`).
- Stage 2 code: `Schedule.buildPeriod(state)` → the shared `plan(state, cfg)` (`buildPlan` = `plan(state, null)`, unchanged rules).
  New part kinds: R21, PT (practice test), FX (fix errors), SE (sort errors), CUM (old topics); the last four are `solo` (never merged).
  Milestones/target are tests with `test.stop`. `Render.layout` takes `o.page`, `o.season`, `o.title`, `o.testLabel`;
  `app.js` `pageOpts()` splits the period into 2-week pages; `pagesOps(what)` feeds print and PNG for 'cal', 'map', 'blank'.

## Stage 2 feedback round
- Owner (testing stage 2): "the milestones should have date suggestions prefilled". This replaces the stage 1 decision
  "empty rows, no dates". Now: `Schedule.suggestDates(start, target, n)` spreads n milestones evenly (k/(n+1) of the way),
  Saturday → Friday, Sunday → Monday; none if there are under 2 weeks per milestone. Rows carry `suggested: true` and show
  "Suggested date: change it to the real one." A date the student types is never changed; suggested dates follow the
  start date, target date, and adding/removing rows. Suggestions go by row order and ignore typed dates in other rows.
  Public holidays are not known (e.g. 1 January can be suggested).

- Owner: "should mock exams have a practice test? aren't they the same thing?" → agreed. This changes approved rule 3/9:
  **mock exams get only the pre-test box** (no practice test, no fix errors). Midterms, session exams, "other" milestones
  and the target exam keep the full run-up. The legend shows "Practice test" only when the calendar has one.
- Owner: the sort-errors box must be visible after the mock → **the period calendar runs to milestone + 1 day**
  (`period.last` in `buildSeason`; not for the target exam or a capped period). The season map periods are unchanged.
  The next period, planned from milestone + 1, shows the same sort-errors box on its first day (rule 8).
- Owner: on the Topics step "Add the target exam date and its subjects first" showed although a date was set (no subjects
  ticked). Now each step names what is missing: no date / date not after start / no subjects; Exams step warns too.

## Small choices made in stage 2 (tell the owner)
- Old-topics boxes skip that subject's own test/milestone day (otherwise the empty exam day is always the least loaded).
- With equal load the earlier day wins (as approved), so old-topics boxes often sit together early in the week.
- Pre-test box label in exam season reads "<Subject>: Test prep" (subject first): in Georgian the prefix is long and
  three pre-test boxes before a mock were cut to the same text. The 2-week label is unchanged (it has the same issue in Georgian).
- On the period calendar a milestone test reads e.g. "MOCK EXAM: Math"; a class test still reads "TEST: Math".

## Stage 2 spec (built)
Period calendar rules + export. Keep every existing rule (lesson chain +1/+3/+7, compression before tests, pre-test box,
merge same subject/day, 4-box daily cap with warning, overflow moves later, first-free-slot placement), and add:
1. **R21**: after R7, a review on day +21 if it falls before the next test or milestone in that subject; otherwise dropped.
2. **Cumulative review**: 1 box per subject per week, label `<Subject>: old topics`, dotted outline.
3. **Milestone run-up** per subject on that milestone: `Practice test: <Subject>` 4 days before (timed, closed book, heavy outline);
   `Fix errors` 3 days before; the existing pre-test box the day before. Never moved by the cap.
4. **After the milestone**: `Sort errors: <Subject>` on milestone day +1; shows on the next period's calendar.
5. **Period length**: the whole period, printed as one A4 landscape page per 2 weeks; cap at 8 weeks and say so (already in `buildSeason`).
6. Box styles, readable in black & white: class = dashed · review = solid · test / milestone / practice test = heavy or filled ·
   cumulative = dotted. Update the legend.
7. PDF + PNG export for the season map and the period calendar. One PNG per page (an 8-week image stacked would exceed iOS canvas limits);
   on phones share all pages at once. PDF via the browser print of SVG pages (one `page-break` per page), as now.
   Check the Georgian font is embedded (e.g. Chromium `page.pdf()` + list fonts) and that PNGs show Georgian.
8. Add the period calendar step after the season map (`STEPS.season`), with the existing "By day" / "Full calendar" views.
9. Tests for the owner's 5 cases:
   - National exams in ~7 months with 3 mock exams; next mock in 3 weeks.
   - University: midterm in 10 days, session exams in ~2 months.
   - A regular test inside the milestone run-up week.
   - Two subjects whose practice tests land on the same day, with the cap exceeded (expect the warning; nothing moves them).
   - No milestones: the period runs to the target exam, capped at 8 weeks.

### Decisions the owner approved (the 11 rule conflicts)
1. **Weights**: practice test = 2 boxes, fix errors = 1, sort errors = 1, cumulative = 1 (pre-test stays 2).
   Run-up days of a milestone with several subjects will often exceed the cap and show the warning; accepted.
2. **No merging** for practice test, fix errors, sort errors and cumulative boxes: they stay their own boxes.
   The merge rule applies only to lesson reviews and the pre-test box, as now.
3. **Practice test looks like a test but is scheduled like a box**: heavy outline, placed in the first free slot;
   no pre-test box of its own and no compression before it.
4. **R21** must fall before that subject's next test or milestone, else it is dropped.
   Cap moves, in order: cumulative first, then R21, then R7, then R3. (R1, compressed, pre-test, quick-recall and run-up boxes never move.)
5. **Cumulative placement**: after lesson reviews, pre-test and run-up boxes are placed, put each cumulative box on that week's
   study day with the lowest load (ties → earlier day), avoiding a day that already has that subject's box when possible.
   Partial weeks with fewer than 4 study days in the period get none. They appear in the first period too
   ("old topics" = everything learned before the start date).
6. **Regular test inside the run-up**: keep all boxes (e.g. day −4 = practice test + that test's pre-test box).
   The milestone's pre-test box covers only lessons since that regular test. A regular test on the milestone date is treated as the milestone.
7. **Run-up boxes before the start date** are skipped with a note. A run-up box on a day off moves to the **previous** study day,
   keeping the order practice test → fix errors → pre-test.
8. **Sort errors** is never moved by the cap. If the next period is planned later than milestone +1, put it on the period's
   first day, but only if the milestone was within the last 7 days. A milestone dated on the start date counts as passed:
   it shows as a test that day, and the period runs to the following milestone.
9. **The target exam gets the same run-up** (practice test, fix errors, pre-test) when it falls inside the period.
10. **Looks**: class = dashed; lesson review, fix errors, sort errors = solid (label says which); pre-test and practice test = heavy
    outline ("Practice test:" bold prefix); regular test and milestone = filled (label says which, e.g. "MOCK EXAM: …"); cumulative = dotted.
11. **Topics** are printed on the season map only, not on the period calendar (the grid has no room) unless the owner asks.

Milestones and the target exam count as tests for each of their subjects, so compression, the pre-test box and the
"never move a box onto or after its test" rule apply to them automatically.

## How to run it
- Local server from the project folder: `py -m http.server 8000` (Windows) or `python3 -m http.server 8000`, then open http://localhost:8000
  and press Ctrl+F5 after changes.
- Tests: `node test/schedule.test.js`, `node test/season.test.js` and `node test/period.test.js`.
- Owner's machine: Windows, PowerShell, repo at `D:\coding-projects\review-calendar`.

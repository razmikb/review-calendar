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
- **Stage 2: not started.** See below.

## Verified so far
- `node test/schedule.test.js` → 19 pass (the original 2-week rules, unchanged).
- `node test/season.test.js` → 6 pass (season periods, 8-week cap, passed/late milestones).
- The 2-week printed layout produces byte-identical drawing operations before and after the `render.js` refactor
  (checked with a script that runs `Render.layout` under Node with a fake text measurer).
- Clicked through in headless Chromium at iPhone and desktop sizes, Georgian and English: no console errors; Georgian renders on screen.
- **Not yet checked:** Georgian in an exported PDF/PNG (export is stage 2). iOS Safari has not been tested.

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
- Bump `?v=` in `index.html` after changing css/js (now `v=7`).

## Stage 2 to do
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
- Tests: `node test/schedule.test.js` and `node test/season.test.js`.
- Owner's machine: Windows, PowerShell, repo at `D:\coding-projects\review-calendar`.

# Review Calendar (charte.ge · Learning how to Learn, session 2)

A static page where a student builds a 2-week spaced review calendar, then prints it, saves it as PDF, or saves/shares it as a PNG. No accounts, no server, no tracking: data stays in the browser (localStorage). The font is self-hosted, so no requests go to Google.

## Files
- `index.html`: page shell
- `js/strings.js`: **all text**. Translate by adding keys to `ka` (missing keys fall back to English).
- `js/schedule.js`: scheduling rules (pure functions, tested)
- `js/render.js`: the printable A4 calendar. One layout is drawn both as SVG (print/PDF) and to a canvas (PNG).
- `js/app.js`: the step-by-step UI
- `fonts/`: Noto Sans Georgian (SIL Open Font License, `fonts/OFL.txt`)
- `test/schedule.test.js`: run with `node test/schedule.test.js`

## Rules as implemented
1. Start date: today by default, editable. The calendar covers 14 days.
2. Classes come from a typed weekly timetable (Mon–Sun × morning/afternoon/evening, comma-separated), repeated for both weeks.
3. Only the chosen priority subjects get review boxes. One lesson per subject per day (a double lesson counts once).
4. Normal chain: day +1, +3, +7. If the next test is on day +7 or sooner, compress: up to 3 reviews, one per day, first on +1, last on the day before the test. Test the next day → quick recall on test day, before the test.
5. Test prep the day before every test covers lessons since the previous test in that subject. It counts as **2 boxes**.
6. Same subject, same day → one merged box.
7. Days off = no classes and no study. Reviews on them move to the next study day before the test; if none fits, to the latest study day before.
8. Over 4 boxes: move boxes holding only 7-day reviews first, then 3-day reviews, to the next study day. Never 1-day, compressed, or test-prep boxes, never earlier, never onto or after the test. If a day is still over 4, it shows a warning. Boxes pushed past day 14 show a note ("add it when you plan next week").
9. Reviews go in the first time-of-day slot with no class or test, else evening.

## Deferred (future versions)
- Lessons before the start date (e.g. opening the calendar mid-week: what to do with last week's lessons). Version 1 starts with no past lessons.
- More than 3 reviews per lesson; reviews continuing after a test; "struggled → review sooner".
- Exact hours / time-blocking (session 4).

## Updating
After changing any file in `css/` or `js/`, raise the `?v=` number on every link in `index.html` (e.g. `?v=2` → `?v=3`). Browsers then load the new files right away instead of a cached copy.

## Deploy (GitHub Pages)
Push this folder to a GitHub repository, then Settings → Pages → Deploy from branch → `main` / root. Optional custom domain such as `calendar.charte.ge` (add a CNAME record at the DNS provider).

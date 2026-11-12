# Review Calendar: what it does

Review Calendar is a free web tool from charte.ge (course "Learning how to Learn", session 2). It helps school and university students plan **when to review** what they learn in class, so it stays in memory up to their tests and exams. It runs in Georgian and English.

## The idea

We forget most of a new lesson within days unless we recall it again. Recall works best when it is **spaced out**: a short time after the lesson, then longer and longer. It should also be **active**: close the book, write or solve from memory, check, and reread only what was wrong. Rereading the notes alone is not enough.

The tool turns this into a calendar. The student enters their classes and tests, and the review sessions appear on their own, on the right days.

## How a student uses it

1. **Add classes.** Tap a morning, afternoon or evening slot and pick a subject. A class repeats every week.
2. **Add tests.** Tap a slot on the test day and choose "test". Classes and tests can be dragged to another day.
3. **Choose subjects.** Pick which subjects get review sessions (starting with 2–3 is best).
4. **Mark days off.** Tap a day's heading to mark it as a day off: away, ill or on holiday, with no classes and no study. Its sessions move to another day.
5. **Follow the calendar.** Tick each session when done. Print it, save it as a PDF, or save or share it as images.

Changes show up straight away, and any step can be undone. There is a filled-in example to try first.

## The rules behind the sessions

- **Spacing:** each lesson gets review sessions 1, 3 and 7 days after it.
- **Before a test:** the sessions move closer together so they all fit before the test. The day before each test gets a **test-prep** session that covers everything since the last test in that subject.
- **One session per subject per day:** reviews of the same subject on the same day are merged into one session.
- **Daily limit:** at most 4 sessions a day (about an hour), leaving time for homework. On busy days, the later reviews move to the next free day, never earlier and never past the test.
- **Fixed by default:** sessions stay where the rules put them. Students who really need to (a training camp, a family trip) can turn on "Move sessions" after a short explanation. The calendar then stops them from putting a session on or after its test.

## Two modes

**Next 2 weeks.** A detailed 2-week calendar for the classes and tests coming up.

**Exam season.** For a big exam months away: national exams, a midterm, university session exams or another exam.
- The student sets the exam, its first day and the subjects on it. Each subject can have its own exam day.
- A **timeline** above the calendar shows each subject's way to its exam, with mock exams along the way and weeks left. For national exams, 3 mock exams per subject are added with suggested dates, which the student can change.
- The student can write the **topics** to cover before each mock exam or exam.
- The calendar plans the period up to the next mock exam or exam, up to 8 weeks at a time. On top of the 1, 3 and 7-day reviews it adds:
  - a 21-day review;
  - a weekly "old topics" session to recall earlier material;
  - before the exam itself: a timed practice test, a session to fix its errors, then test prep;
  - after each mock exam: a session to sort its errors (not known, forgot, or careless).
- A one-page **season map** shows the whole road to the exam, the topics for each period, and the 4-step cycle: Understand → Recall → Space → Simulate.

## Privacy

No account, no sign-up, no server, no tracking or analytics. Everything the student enters stays in their own browser on their own device. The Georgian font is part of the site, so no requests go to outside services. This matters because many users are minors.

## Where it comes from

The rules follow learning research: spaced and retrieval practice, shorter gaps before a close test (Cepeda et al., 2008), mixing problem types within a subject (Rohrer et al., 2015), and limits on useful daily study time (Cooper, Robinson & Patall, 2006; Fernández-Alonso et al., 2015). The "Why" notes in the tool explain each rule to students.

For how the code is built, see `README.md`. For the work log, see `PLAN.md`.

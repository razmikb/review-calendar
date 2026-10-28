/*
 * All text shown in the tool and on the printed calendar.
 *
 * To translate: copy a key from `en` into `ka` and write the Georgian text.
 * Any key missing from `ka` falls back to English, so the tool works while translation is in progress.
 * {name} placeholders are filled in by the tool; keep them as they are.
 */
window.STRINGS = {
  en: {
    appTitle: 'Review calendar',
    tagline: 'Read to learn. Recall to keep. Reread to fix.',
    langLabel: 'Language',

    // Steps
    step1: 'Start',
    step2: 'Classes',
    step3: 'Subjects',
    step4: 'Tests',
    step5: 'Days off',
    step6: 'Calendar',
    back: 'Back',
    next: 'Next',
    showCalendar: 'Show my calendar',
    stepOf: 'Step {n} of {total}',

    // Step 1
    startHeading: 'Plan your next 2 weeks of review',
    startBody: 'This calendar shows when to review each lesson so you keep it. Each review box means: close the book, write or solve from memory, then check and reread only what was wrong.',
    frameLearn: 'Learn new',
    frameLearnWhen: 'In class, lectures, tutor lessons',
    frameRecall: 'Recall',
    frameRecallWhen: 'Every review box: book closed',
    frameFix: 'Reread / fix',
    frameFixWhen: 'Right after: only what was wrong',
    startDate: 'First day of the calendar',
    startDateHint: 'Usually today. The calendar covers 14 days from this date.',
    loadExample: 'Fill in an example',
    exampleLoaded: 'Example filled in. Replace it with your own timetable.',
    startOver: 'Start over',
    startOverConfirm: 'Delete everything you entered?',
    confirmYes: 'Yes, delete',
    confirmNo: 'Cancel',

    // Step 2
    classesHeading: 'Your weekly timetable',
    classesBody: 'Write the subjects you have on each day: school or university classes, lectures, tutor lessons, courses. Several in one part of the day? Separate them with commas.',
    classesRepeat: 'Enter one normal week. It repeats for both weeks of the calendar.',
    classesPlaceholder: 'e.g. Math, Biology',
    slot_m: 'Morning',
    slot_a: 'Afternoon',
    slot_e: 'Evening',

    // Step 3
    subjectsHeading: 'Choose 2–3 subjects to review',
    subjectsBody: 'Start small: a subject with a test coming up, your hardest one, or the most important one. Add more once the routine sticks.',
    subjectsNone: 'Your subjects appear here once you write your timetable in the previous step.',
    subjectsTooMany: 'That is {n} subjects. It works, but the days fill up fast. Most students start with 2–3.',
    subjectsChosen: '{n} chosen',

    // Step 4
    testsHeading: 'Tests and exams',
    testsBody: 'Add the tests for your chosen subjects. Before a test, reviews move closer together so they all fit, and the day before gets a test-prep box.',
    testsEmpty: 'No tests added. If you have none, go to the next step.',
    addTest: 'Add a test',
    testSubject: 'Subject',
    testDate: 'Date',
    testSlot: 'Time of day',
    testSlotAuto: 'Same time as the class',
    removeTest: 'Remove',
    otherSubjects: 'Other subjects',
    pickSubject: 'Choose…',

    // Step 5
    offHeading: 'Days off',
    offBody: 'Tap the days when you will not study at all: holidays, trips, family events. They get no classes and no reviews. A review that falls on a day off moves to the next study day.',
    offCount: '{n} days off',

    // Step 6
    calHeading: 'Your calendar',
    calRange: '{from} – {to}',
    viewList: 'By day',
    viewGrid: 'Full calendar',
    boxesCount: 'Boxes: {n} / 4',
    overCap: 'More than 4 boxes. Do the ones marked first, then as many as you can.',
    overCapSummary: '{n} days have more than 4 boxes.',
    allGood: 'No day has more than 4 boxes.',
    nothingDue: 'No reviews',
    dayOff: 'Day off',
    today: 'Today',
    test: 'Test',
    noPriority: 'Choose at least one subject (step 3) to get review boxes.',
    renameHeading: 'Name your lessons',
    renameBody: 'Write what each lesson was about, so you know what to recall. For example: cell division.',
    renamePlaceholder: 'Topic (optional)',
    renameNone: 'No lessons yet.',
    homeworkHeading: 'Does homework count?',
    homeworkBody: 'Only if you do it from memory first, then check and fix. With notes or the textbook open, it is rereading. Closed-book homework on yesterday\'s lesson can count as that lesson\'s 1st review: tick the box.',

    // Box explanations
    kind_R1: '1st review, 1 day after the lesson on {date}',
    kind_R3: '2nd review, 3 days after the lesson on {date}',
    kind_R7: '3rd review, 7 days after the lesson on {date}',
    kind_C: 'Review {k} of {n} before the test on {test} (lesson on {date})',
    kind_Q: 'Quick recall before today\'s test (lesson on {date})',
    kind_P: 'Test prep for the test on {test}: recall everything since the last test. Counts as 2 boxes.',
    movedCap: 'Moved from {date}: that day had more than 4 boxes.',
    movedOff: 'Moved from {date}: day off.',
    notePushedOut: '{subject}: a review from {date} did not fit in these 2 weeks. Add it when you plan next week.',
    noteDroppedOff: '{subject}: a review on {date} fell on a day off and had nowhere to go.',

    // Export
    exportHeading: 'Save and share',
    yourName: 'Your name (printed on the calendar)',
    print: 'Print or save as PDF',
    printHint: 'In the print window choose A4, landscape, and “Save as PDF” if you want a file.',
    saveImage: 'Save as image',
    shareImage: 'Share image',
    blankHeading: 'Drawing it by hand?',
    blankBody: 'Print the empty template and fill it in with a pen.',
    printBlank: 'Print blank template',
    saveBlank: 'Blank template as image',
    imageFailed: 'Could not make the image. Try “Print or save as PDF” instead.',

    // Printed calendar
    printTitle: 'My review calendar',
    printName: 'Name',
    printBoxes: 'Boxes',
    printTest: 'TEST',
    printPrep: 'Test prep',
    printBeforeTest: 'before test',
    printMore: '+{n} more',
    legendClass: 'Class',
    legendReview: 'Review box',
    legendPrep: 'Test prep (= 2 boxes)',
    legendTest: 'Test',
    legendRule: 'Each box: close the book → recall from memory → check → reread only what was wrong.',
    legendCap: 'Up to 4 boxes a day. Tick each box when done. Missed one? Do it on the next free day.',
    footer: 'charte.ge · Learning how to Learn',

    // Evidence ("Why?" panels)
    why: 'Why?',
    whyStart: 'Spreading reviews over several days works better than the same time in one go (Cepeda et al., 2006). Testing yourself and spacing out study are rated the most useful study techniques; rereading and highlighting are among the least useful (Dunlosky et al., 2013).',
    whySubjects: 'Doing several subjects in one sitting is fine: treat each box as its own recall → check → fix, then switch. Mixing helps most within one subject, for example different types of maths problems (Rohrer et al., 2015).',
    whyTests: 'When a test is close, the best gap between reviews is shorter: roughly 20–40% of the time left for a test a week away (Cepeda et al., 2008). A gap a little too long costs less than one too short, so full days push boxes later, never earlier.',
    whyChain: 'Reviews come 1, 3 and 7 days after a lesson. The exact pattern matters less than spacing reviews out at all (Karpicke & Bauernschmidt, 2011).',
    whyCap: 'More home study helps only up to a point (Cooper, Robinson & Patall, 2006). For 13–14-year-olds in maths and science, about 60–70 minutes a day worked best, and how they studied mattered more than how long (Fernández-Alonso et al., 2015). Four boxes take about 45–60 minutes and leave time for homework.',

    // Dates
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    weekdaysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },

  ka: {
    // Draft: weekday names only. Everything else falls back to English until translated.
    weekdaysShort: ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'],
    weekdaysLong: ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა']
  }
};

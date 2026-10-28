/*
 * Scheduling rules for the 2-week spaced review calendar.
 * Pure functions only (no DOM), so the same code runs in the browser and in Node tests.
 *
 * Day numbers are relative to the start date: day 0 = start, day 13 = last day shown.
 * Dates are handled in UTC so daylight-saving changes never shift a day.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Schedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HORIZON = 14;          // days shown on the calendar
  var DAILY_CAP = 4;         // boxes per day before a warning
  var PRETEST_WEIGHT = 2;    // a test-prep box counts as 2 boxes
  var SLOTS = ['m', 'a', 'e']; // morning, afternoon, evening
  var DAY_MS = 86400000;

  // ---------- dates ----------
  function parseDate(s) {
    var p = String(s).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function isoDate(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function addDays(iso, n) { return isoDate(parseDate(iso) + n * DAY_MS); }
  function dayDiff(fromIso, toIso) { return Math.round((parseDate(toIso) - parseDate(fromIso)) / DAY_MS); }
  // Monday = 0 … Sunday = 6
  function weekday(iso) { return (new Date(parseDate(iso)).getUTCDay() + 6) % 7; }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // ---------- subjects ----------
  // Students type subjects freely; "Math, Bio" in one slot means two classes.
  function splitSubjects(text) {
    return String(text || '').split(/[,;\n]+/).map(function (s) { return s.trim().replace(/\s+/g, ' '); })
      .filter(Boolean);
  }
  function subjectKey(name) { return String(name).trim().toLocaleLowerCase(); }

  /** All distinct subjects in the timetable, in the order first written. */
  function subjectsInTimetable(timetable) {
    var seen = {}, out = [];
    for (var w = 0; w < 7; w++) {
      var day = (timetable && timetable[w]) || {};
      SLOTS.forEach(function (slot) {
        splitSubjects(day[slot]).forEach(function (name) {
          var k = subjectKey(name);
          if (!seen[k]) { seen[k] = true; out.push(name); }
        });
      });
    }
    return out;
  }

  // ---------- main ----------
  /**
   * state = {
   *   start: 'YYYY-MM-DD',
   *   timetable: { 0..6: { m, a, e } }   // free text per weekday (Mon = 0) and slot
   *   priority: [subject names]           // subjects that get review boxes
   *   tests: [{ id, subject, date, slot: 'auto'|'m'|'a'|'e' }]
   *   daysOff: ['YYYY-MM-DD']             // no classes, no study
   *   lessonNames: { lessonId: 'topic' }
   * }
   */
  function buildPlan(state) {
    var start = state.start;
    var H = HORIZON;
    var offSet = {};
    (state.daysOff || []).forEach(function (d) { offSet[dayDiff(start, d)] = true; });
    var isOff = function (d) { return !!offSet[d]; };

    var prioKeys = {};
    (state.priority || []).forEach(function (s) { prioKeys[subjectKey(s)] = true; });
    var displayName = {};
    subjectsInTimetable(state.timetable).forEach(function (s) { displayName[subjectKey(s)] = s; });
    (state.priority || []).forEach(function (s) { if (!displayName[subjectKey(s)]) displayName[subjectKey(s)] = s; });
    (state.tests || []).forEach(function (t) { if (!displayName[subjectKey(t.subject)]) displayName[subjectKey(t.subject)] = t.subject; });

    var notes = [];
    var days = [];
    for (var d = 0; d < H; d++) {
      days.push({ i: d, date: addDays(start, d), off: isOff(d), classes: [], tests: [], boxes: [], load: 0, over: false });
    }

    // Classes (layer 1) for the shown days, and when each subject meets per day.
    function classesOn(dayIndex) {
      var date = addDays(start, dayIndex);
      var row = (state.timetable && state.timetable[weekday(date)]) || {};
      var list = [];
      SLOTS.forEach(function (slot) {
        var seen = {};
        splitSubjects(row[slot]).forEach(function (name) {
          var k = subjectKey(name);
          if (seen[k]) return;
          seen[k] = true;
          list.push({ subject: displayName[k] || name, key: k, slot: slot });
        });
      });
      return list;
    }
    days.forEach(function (day) { if (!day.off) day.classes = classesOn(day.i); });

    // Tests (layer 3). They may lie beyond the 2 weeks: they still shape the reviews.
    var tests = (state.tests || []).filter(function (t) { return t.subject && t.date; }).map(function (t) {
      var k = subjectKey(t.subject);
      var dayIndex = dayDiff(start, t.date);
      var slot = t.slot && t.slot !== 'auto' ? t.slot : null;
      if (!slot) {
        var cls = dayIndex >= 0 && dayIndex < H ? classesOn(dayIndex).filter(function (c) { return c.key === k; })[0] : null;
        slot = cls ? cls.slot : 'm';
      }
      return { id: t.id, subject: displayName[k] || t.subject, key: k, day: dayIndex, date: t.date, slot: slot };
    }).sort(function (a, b) { return a.day - b.day; });
    tests.forEach(function (t) { if (t.day >= 0 && t.day < H) days[t.day].tests.push(t); });

    function nextTest(key, afterDay) {
      for (var i = 0; i < tests.length; i++) if (tests[i].key === key && tests[i].day > afterDay) return tests[i];
      return null;
    }
    function prevTestDay(key, beforeDay) {
      var p = -Infinity;
      tests.forEach(function (t) { if (t.key === key && t.day < beforeDay) p = Math.max(p, t.day); });
      return p;
    }

    // Lessons: one per priority subject per day, at the first slot it meets (double lessons count once).
    var lessons = [];
    days.forEach(function (day) {
      if (day.off) return;
      var seen = {};
      day.classes.forEach(function (c) {
        if (!prioKeys[c.key] || seen[c.key]) return;
        seen[c.key] = true;
        var id = c.key + '|' + day.date;
        lessons.push({ id: id, subject: c.subject, key: c.key, day: day.i, date: day.date, slot: c.slot,
          name: (state.lessonNames && state.lessonNames[id]) || '' });
      });
    });

    // Review parts. A part is one reason to recall something; parts merge into boxes later.
    var parts = [];
    lessons.forEach(function (L) {
      var T = nextTest(L.key, L.day);
      var bound = T ? T.day : Infinity; // reviews for this lesson must stay before its test
      if (!T || L.day + 7 < T.day) {
        [[1, 'R1'], [3, 'R3'], [7, 'R7']].forEach(function (r) {
          parts.push({ kind: r[1], key: L.key, subject: L.subject, day: L.day + r[0], lessons: [L.id], bound: bound });
        });
        return;
      }
      var first = L.day + 1, last = T.day - 1;
      var n = Math.min(3, T.day - L.day - 1);
      var when = n === 3 ? [first, Math.floor((first + last) / 2), last]
        : n === 2 ? [first, last]
        : n === 1 ? [first] : [];
      when.forEach(function (day, idx) {
        parts.push({ kind: 'C', step: idx + 1, of: n, test: T.id, key: L.key, subject: L.subject, day: day, lessons: [L.id], bound: bound });
      });
      if (n === 0) {
        parts.push({ kind: 'Q', test: T.id, key: L.key, subject: L.subject, day: T.day, lessons: [L.id], bound: Infinity });
      }
    });
    // Test prep the day before each test: everything since the previous test in that subject.
    tests.forEach(function (T) {
      var since = prevTestDay(T.key, T.day);
      var covered = lessons.filter(function (L) { return L.key === T.key && L.day > since && L.day < T.day; })
        .map(function (L) { return L.id; });
      parts.push({ kind: 'P', test: T.id, key: T.key, subject: T.subject, day: T.day - 1, lessons: covered, bound: T.day });
    });

    // Only keep what falls inside the 2 weeks.
    parts = parts.filter(function (p) { return p.day >= 0 && p.day < H; });

    // Days off: move to the next study day before the test; failing that, the latest study day before.
    var kept = [];
    parts.forEach(function (p) {
      if (!isOff(p.day)) { kept.push(p); return; }
      var from = p.day, to = -1, d;
      for (d = from + 1; d < H && d < p.bound; d++) if (!isOff(d)) { to = d; break; }
      if (to < 0) {
        var earliest = p.kind === 'P' ? 0 : Math.max(0, minLessonDay(p) + 1);
        for (d = from - 1; d >= earliest; d--) if (!isOff(d)) { to = d; break; }
      }
      if (to < 0) { notes.push({ type: 'droppedOff', subject: p.subject, date: addDays(start, from) }); return; }
      p.movedFrom = { day: from, why: 'off' };
      p.day = to;
      kept.push(p);
    });
    parts = kept;
    function minLessonDay(p) {
      var m = Infinity;
      p.lessons.forEach(function (id) { lessons.forEach(function (L) { if (L.id === id) m = Math.min(m, L.day); }); });
      return m === Infinity ? 0 : m;
    }

    // Merge: one box per subject per day.
    function addPart(p) {
      var day = days[p.day];
      var box = day.boxes.filter(function (b) { return b.key === p.key; })[0];
      if (!box) {
        box = { key: p.key, subject: p.subject, day: p.day, date: day.date, parts: [] };
        day.boxes.push(box);
      }
      box.parts.push(p);
      refreshBox(box);
    }
    function refreshBox(box) {
      box.weight = box.parts.some(function (p) { return p.kind === 'P'; }) ? PRETEST_WEIGHT : 1;
      box.movable = box.parts.every(function (p) { return p.kind === 'R3' || p.kind === 'R7'; });
      box.rank = box.parts.every(function (p) { return p.kind === 'R7'; }) ? 0 : 1; // R7-only boxes move first
      box.bound = Math.min.apply(null, box.parts.map(function (p) { return p.bound; }));
      box.id = box.key + '|' + box.date;
    }
    parts.forEach(addPart);
    function load(day) { return day.boxes.reduce(function (s, b) { return s + b.weight; }, 0); }

    // Daily cap: move R7, then R3 boxes to the next study day. Never earlier, never onto/after the test.
    days.forEach(function (day) {
      while (load(day) > DAILY_CAP) {
        var candidates = day.boxes.filter(function (b) { return b.movable; })
          .sort(function (a, b) { return a.rank - b.rank; });
        var moved = false;
        for (var c = 0; c < candidates.length && !moved; c++) {
          var box = candidates[c], to = -1;
          for (var d = day.i + 1; d < H; d++) if (!isOff(d)) { to = d; break; }
          if (to >= 0 && to >= box.bound) continue; // would land on or after its test
          day.boxes.splice(day.boxes.indexOf(box), 1);
          if (to < 0) {
            notes.push({ type: 'pushedOut', subject: box.subject, date: day.date });
          } else {
            box.parts.forEach(function (p) {
              if (!p.movedFrom) p.movedFrom = { day: day.i, why: 'cap' };
              p.day = to;
              addPart(p);
            });
          }
          moved = true;
        }
        if (!moved) break;
      }
    });

    // Placement: first slot with no class and no test, else evening.
    // A quick recall on test day must come before the test.
    var order = { m: 0, a: 1, e: 2 };
    days.forEach(function (day) {
      var busy = {};
      day.classes.forEach(function (c) { busy[c.slot] = true; });
      day.tests.forEach(function (t) { busy[t.slot] = true; });
      var free = SLOTS.filter(function (s) { return !busy[s]; })[0] || 'e';
      day.boxes.forEach(function (b) {
        b.slot = free;
        var q = b.parts.filter(function (p) { return p.kind === 'Q'; })[0];
        if (q) {
          var t = tests.filter(function (x) { return x.id === q.test; })[0];
          if (t && order[free] > order[t.slot]) b.slot = t.slot;
        }
        b.parts.sort(function (x, y) { return kindOrder(x.kind) - kindOrder(y.kind); });
      });
      day.boxes.sort(function (a, b) { return b.weight - a.weight; });
      day.load = load(day);
      day.over = day.load > DAILY_CAP;
    });

    return { start: start, days: days, lessons: lessons, tests: tests, notes: notes };
  }

  function kindOrder(k) { return { Q: 0, P: 1, C: 2, R1: 3, R3: 4, R7: 5 }[k]; }

  return {
    HORIZON: HORIZON, DAILY_CAP: DAILY_CAP, PRETEST_WEIGHT: PRETEST_WEIGHT, SLOTS: SLOTS,
    buildPlan: buildPlan, subjectsInTimetable: subjectsInTimetable, splitSubjects: splitSubjects, subjectKey: subjectKey,
    addDays: addDays, dayDiff: dayDiff, weekday: weekday, todayIso: todayIso, parseDate: parseDate
  };
});

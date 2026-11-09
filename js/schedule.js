/*
 * Scheduling rules for the 2-week spaced review calendar.
 * Pure functions only (no DOM), so the same code runs in the browser and in Node tests.
 *
 * The plan covers 14 days from the start date. The calendar shows them in whole weeks, Monday to Sunday:
 * 2 weeks when the start is a Monday, otherwise 3.
 * Day numbers are relative to that first Monday: day 0 = Monday.
 * Days before the start or after the 14 days are shown but empty (no lessons, no study), like days off.
 * Dates are handled in UTC so daylight-saving changes never shift a day.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Schedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HORIZON = 14;          // days planned from the start date
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
  function mondayOf(iso) { return addDays(iso, -weekday(iso)); }
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
  function buildPlan(state) { return plan(state, null); }

  /*
   * The shared planner. cfg = null gives the 2-week calendar exactly as before.
   * In exam season cfg = { horizon, priority, stopTests } (see buildPeriod) and these rules are added:
   * R21, cumulative "old topics" boxes, the milestone run-up (practice test, fix errors) and sort errors.
   */
  function plan(state, cfg) {
    var start = mondayOf(state.start);
    var first = dayDiff(start, state.start); // index of the start date; earlier days are before the plan
    var end = first + (cfg ? cfg.horizon : HORIZON); // first day after the plan
    var shown = Math.ceil(end / 7) * 7;      // whole weeks on the calendar
    var offSet = {};
    (state.daysOff || []).forEach(function (d) { offSet[dayDiff(start, d)] = true; });
    var isOff = function (d) { return d < first || d >= end || !!offSet[d]; };

    var priority = cfg ? cfg.priority : (state.priority || []);
    var allTests = (state.tests || []).concat(cfg ? cfg.stopTests : []);
    var prioKeys = {};
    priority.forEach(function (s) { prioKeys[subjectKey(s)] = true; });
    var displayName = {};
    subjectsInTimetable(state.timetable).forEach(function (s) { displayName[subjectKey(s)] = s; });
    priority.forEach(function (s) { if (!displayName[subjectKey(s)]) displayName[subjectKey(s)] = s; });
    allTests.forEach(function (t) { if (t.subject && !displayName[subjectKey(t.subject)]) displayName[subjectKey(t.subject)] = t.subject; });

    var notes = [];
    var days = [];
    for (var d = 0; d < shown; d++) {
      days.push({ i: d, date: addDays(start, d), before: d < first, after: d >= end, off: isOff(d), classes: [], tests: [], boxes: [], load: 0, over: false });
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
    // A regular test on the same day as a milestone in that subject is the milestone.
    var stopAt = {};
    (cfg ? cfg.stopTests : []).forEach(function (t) { stopAt[subjectKey(t.subject) + '|' + t.date] = true; });
    var tests = allTests.filter(function (t) {
      return t.subject && t.date && (t.stop || !stopAt[subjectKey(t.subject) + '|' + t.date]);
    }).map(function (t) {
      var k = subjectKey(t.subject);
      var dayIndex = dayDiff(start, t.date);
      var slot = t.slot && t.slot !== 'auto' ? t.slot : null;
      if (!slot) {
        var cls = dayIndex >= first && dayIndex < end ? classesOn(dayIndex).filter(function (c) { return c.key === k; })[0] : null;
        slot = cls ? cls.slot : 'm';
      }
      var out = { id: t.id, subject: displayName[k] || t.subject, key: k, day: dayIndex, date: t.date, slot: slot };
      if (t.stop) out.stop = t.stop; // milestone or target exam: { id, type, name, isTarget }
      return out;
    }).sort(function (a, b) { return a.day - b.day; });
    tests.forEach(function (t) { if (t.day >= first && t.day < end) days[t.day].tests.push(t); });

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
        // Exam season: a 4th review 21 days on, only if it still comes before the next test or milestone.
        if (cfg && L.day + 21 < bound) parts.push({ kind: 'R21', key: L.key, subject: L.subject, day: L.day + 21, lessons: [L.id], bound: bound });
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
    // Exam season: sort the errors the day after each milestone. If that day is before this period,
    // the period's first day gets it, but only for a milestone in the last 7 days.
    if (cfg) tests.forEach(function (T) {
      if (!T.stop) return;
      var day = T.day + 1;
      if (day < first) { if (T.day < first - 7) return; day = first; }
      var N = nextTest(T.key, T.day);
      parts.push({ kind: 'SE', solo: true, after: T.day, test: T.id, key: T.key, subject: T.subject, day: day, lessons: [], bound: N ? N.day : Infinity });
    });

    // Only keep what falls inside the 14 planned days.
    parts = parts.filter(function (p) { return p.day >= first && p.day < end; });

    // Days off: move to the next study day before the test; failing that, the latest study day before.
    var kept = [];
    parts.forEach(function (p) {
      if (!isOff(p.day)) { kept.push(p); return; }
      var from = p.day, to = -1, d;
      for (d = from + 1; d < end && d < p.bound; d++) if (!isOff(d)) { to = d; break; }
      if (to < 0) {
        var earliest = p.kind === 'P' ? first : p.kind === 'SE' ? Math.max(first, p.after + 1) : Math.max(first, minLessonDay(p) + 1);
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

    // Exam season run-up for each milestone and the target exam, per subject:
    // practice test 4 days before, fix errors 3 days before, then the pre-test box the day before (above).
    // On a day off they go to the previous study day, keeping that order. Before the start date: skipped, with a note.
    // A mock exam is already a practice exam: it gets only the pre-test box, no practice test or fix errors.
    if (cfg) tests.forEach(function (T) {
      if (!T.stop || T.day < first || (!T.stop.isTarget && T.stop.type === 'mock')) return;
      var P = parts.filter(function (p) { return p.kind === 'P' && p.test === T.id; })[0];
      var pday = P ? P.day : T.day - 1;
      function latestStudy(d) { while (d >= first && isOff(d)) d--; return d >= first ? d : -1; }
      var fx = T.day - 3 >= end ? null : latestStudy(Math.min(T.day - 3, pday - 1));
      var pt = T.day - 4 >= end ? null : latestStudy(Math.min(T.day - 4, (fx != null && fx >= 0 ? fx : pday) - 1));
      var skipped = fx === -1 || pt === -1;
      [['PT', pt, T.day - 4], ['FX', fx, T.day - 3]].forEach(function (r) {
        if (r[1] == null || r[1] < 0) return;
        var p = { kind: r[0], solo: true, test: T.id, key: T.key, subject: T.subject, day: r[1], lessons: [], bound: T.day };
        if (r[1] !== r[2]) p.movedFrom = { day: r[2], why: 'off' };
        parts.push(p);
      });
      if (skipped) notes.push({ type: 'runupSkipped', subject: T.subject, date: T.date, stop: T.stop });
    });

    // Merge: one box per subject per day. Run-up, sort-errors and cumulative boxes ("solo") stay their own boxes.
    var WEIGHT = { P: PRETEST_WEIGHT, PT: 2 };
    var RANK = { CUM: 0, R21: 1, R7: 2, R3: 3 }; // which boxes the cap moves first
    function mergeKey(p) { return p.solo ? p.key + '|' + p.kind + '|' + (p.test || p.week) : p.key; }
    function addPart(p) {
      var day = days[p.day], mk = mergeKey(p);
      var box = day.boxes.filter(function (b) { return b.mk === mk; })[0];
      if (!box) {
        box = { key: p.key, mk: mk, subject: p.subject, day: p.day, date: day.date, parts: [] };
        day.boxes.push(box);
      }
      box.parts.push(p);
      refreshBox(box);
    }
    function refreshBox(box) {
      box.weight = Math.max.apply(null, box.parts.map(function (p) { return WEIGHT[p.kind] || 1; }));
      box.movable = box.parts.every(function (p) { return p.kind in RANK; });
      box.rank = Math.max.apply(null, box.parts.map(function (p) { return RANK[p.kind] == null ? 9 : RANK[p.kind]; }));
      box.bound = Math.min.apply(null, box.parts.map(function (p) { return p.bound; }));
      box.id = box.mk + '|' + box.date;
    }
    parts.forEach(addPart);
    function load(day) { return day.boxes.reduce(function (s, b) { return s + b.weight; }, 0); }

    // Exam season: one "old topics" box per subject per week, on the week's least loaded study day
    // (ties: earlier). Not on that subject's test day; a day without that subject's box if possible.
    // Weeks with fewer than 4 study days in the period get none.
    if (cfg) for (var w = 0; w < shown / 7; w++) {
      var study = days.slice(w * 7, w * 7 + 7).filter(function (d) { return !d.off; });
      if (study.length < 4) continue;
      priority.forEach(function (s) {
        var k = subjectKey(s);
        var ok = study.filter(function (d) { return !d.tests.some(function (x) { return x.key === k; }); });
        var free = ok.filter(function (d) { return !d.boxes.some(function (b) { return b.key === k; }); });
        var pick = (free.length ? free : ok).reduce(function (best, d) { return !best || load(d) < load(best) ? d : best; }, null);
        if (!pick) return;
        var N = nextTest(k, pick.i);
        addPart({ kind: 'CUM', solo: true, week: w, key: k, subject: displayName[k] || s, day: pick.i, lessons: [], bound: N ? N.day : Infinity });
      });
    }

    // Daily cap: move cumulative, then R21, R7, R3 boxes to the next study day. Never earlier, never onto/after the test.
    days.forEach(function (day) {
      while (load(day) > DAILY_CAP) {
        var candidates = day.boxes.filter(function (b) { return b.movable; })
          .sort(function (a, b) { return a.rank - b.rank; });
        var moved = false;
        for (var c = 0; c < candidates.length && !moved; c++) {
          var box = candidates[c], to = -1;
          for (var d = day.i + 1; d < end; d++) if (!isOff(d)) { to = d; break; }
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

    return { start: start, first: first, end: end, days: days, lessons: lessons, tests: tests, notes: notes };
  }

  function kindOrder(k) { return { Q: 0, P: 1, C: 2, R1: 3, R3: 4, R7: 5, R21: 6, PT: 7, FX: 8, SE: 9, CUM: 10 }[k]; }

  // ---------- exam season ----------
  var PERIOD_MAX = 56; // the period calendar covers at most 8 weeks

  /** Distinct subject names, keeping the first spelling. */
  function uniqueSubjects(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (s) {
      s = String(s || '').trim().replace(/\s+/g, ' ');
      var k = subjectKey(s);
      if (s && !seen[k]) { seen[k] = true; out.push(s); }
    });
    return out;
  }

  /**
   * The season overview: target exam, milestones and the periods between them.
   * state.target = { type, name, date, subjects: [names] }
   * state.milestones = [{ id, type, name, date, subjects: [names] }]  (subjects outside the target are ignored)
   * A milestone on or before the start date has passed. Periods: start → each upcoming milestone → target.
   * `period` is the next one to plan in detail: start → next milestone (or target), at most 8 weeks.
   */
  function buildSeason(state) {
    var start = state.start;
    var tg = state.target || {};
    var subjects = uniqueSubjects(tg.subjects);
    var names = {};
    subjects.forEach(function (s) { names[subjectKey(s)] = s; });
    function stop(x, id, isTarget) {
      var subs = isTarget ? subjects : uniqueSubjects(x.subjects).filter(function (s) { return names[subjectKey(s)]; })
        .map(function (s) { return names[subjectKey(s)]; });
      var days = dayDiff(start, x.date);
      return { id: id, isTarget: isTarget, type: x.type || '', name: String(x.name || '').trim(), date: x.date,
        subjects: subs, days: days, weeks: Math.floor(days / 7), rest: days % 7 };
    }
    // The target exam can take several days (e.g. national exams: one subject per day). tg.date is its first day;
    // tg.subjectDates = { subjectKey: date } gives a subject its own day. The target stop is the earliest exam day,
    // target.last the latest one and target.dateOf the day of each subject.
    var target = null;
    if (tg.date) {
      var dateOf = {};
      subjects.forEach(function (s) { var k = subjectKey(s); dateOf[k] = (tg.subjectDates && tg.subjectDates[k]) || tg.date; });
      var days = subjects.length ? subjects.map(function (s) { return dateOf[subjectKey(s)]; }).sort() : [tg.date];
      target = stop({ type: tg.type, name: tg.name, date: days[0], subjects: subjects }, 'target', true);
      target.last = days[days.length - 1];
      target.dateOf = dateOf;
    }
    var all = (state.milestones || []).filter(function (m) { return m.date; })
      .map(function (m) { return stop(m, m.id, false); })
      .sort(function (a, b) { return a.days - b.days; });
    var past = all.filter(function (m) { return m.days <= 0; });
    var late = all.filter(function (m) { return m.days > 0 && target && m.date >= target.date; });
    var upcoming = all.filter(function (m) { return m.days > 0 && (!target || m.date < target.date); });
    var stops = upcoming.concat(target && target.days > 0 ? [target] : []);
    var periods = stops.map(function (s, i) {
      return { id: s.id, n: i + 1, from: i ? stops[i - 1].date : start, to: s.date, stop: s };
    });
    var next = stops[0] || null;
    var period = null;
    if (next) {
      var capped = next.days > PERIOD_MAX;
      period = { from: start, to: capped ? addDays(start, PERIOD_MAX - 1) : next.date, stop: next, capped: capped };
      // The period calendar runs one day past a milestone, so its "sort errors" box is on it,
      // and to the last day of the target exam (still at most 8 weeks).
      period.last = capped ? period.to
        : next.isTarget ? (dayDiff(start, next.last) >= PERIOD_MAX ? addDays(start, PERIOD_MAX - 1) : next.last)
        : addDays(next.date, 1);
    }
    // One track per exam subject: its own upcoming milestones, then its own exam day.
    // Each stop ends a stretch (from the previous stop) that the student can write topics for.
    var tracks = subjects.map(function (s) {
      var key = subjectKey(s);
      var list = upcoming.filter(function (m) { return m.subjects.some(function (x) { return subjectKey(x) === key; }); });
      if (target && target.days > 0) {
        var d = target.dateOf[key], n = dayDiff(start, d);
        list = list.filter(function (m) { return m.date < d; })
          .concat([{ id: 'target', isTarget: true, type: target.type, name: target.name, date: d, subjects: [s], days: n, weeks: Math.floor(n / 7), rest: n % 7 }]);
      }
      return { subject: s, key: key, stops: list.map(function (m, i) { return { stop: m, from: i ? list[i - 1].date : start }; }) };
    });
    return { start: start, target: target, subjects: subjects, milestones: all, past: past, late: late,
      stops: stops, periods: periods, period: period, tracks: tracks };
  }

  /**
   * Suggested dates for n milestones: spread evenly between the start and the target exam
   * (k / (n + 1) of the way), moved off weekends (Saturday → Friday, Sunday → Monday).
   * Returns [] when the target is less than 2 weeks per milestone away: then the student types the dates.
   */
  function suggestDates(start, target, n) {
    var span = start && target ? dayDiff(start, target) : 0;
    if (n < 1 || span < 14 * (n + 1)) return [];
    var out = [];
    for (var k = 1; k <= n; k++) {
      var d = addDays(start, Math.round(span * k / (n + 1)));
      var wd = weekday(d);
      out.push(wd === 5 ? addDays(d, -1) : wd === 6 ? addDays(d, 1) : d);
    }
    return out;
  }

  /**
   * The period calendar: the 2-week rules over start → next milestone (at most 8 weeks), plus the exam season rules.
   * The target exam's subjects get review boxes. Every milestone (also passed ones) and the target exam
   * count as a test in each of their subjects. Returns null when there is nothing to plan yet.
   */
  function buildPeriod(state) {
    var sea = buildSeason(state);
    if (!sea.period) return null;
    var stopTests = [];
    sea.milestones.filter(function (m) { return sea.late.indexOf(m) < 0; })
      .concat(sea.target ? [sea.target] : []).forEach(function (m) {
        m.subjects.forEach(function (s) {
          stopTests.push({ id: m.id + '|' + subjectKey(s), subject: s, date: m.dateOf ? m.dateOf[subjectKey(s)] : m.date, slot: 'auto',
            stop: { id: m.id, type: m.type, name: m.name, isTarget: m.isTarget } });
        });
      });
    var p = plan(state, { horizon: dayDiff(state.start, sea.period.last) + 1, priority: sea.subjects, stopTests: stopTests });
    p.season = sea;
    p.period = sea.period;
    return p;
  }

  return {
    HORIZON: HORIZON, DAILY_CAP: DAILY_CAP, PRETEST_WEIGHT: PRETEST_WEIGHT, SLOTS: SLOTS, PERIOD_MAX: PERIOD_MAX,
    buildSeason: buildSeason, buildPeriod: buildPeriod, suggestDates: suggestDates, uniqueSubjects: uniqueSubjects,
    buildPlan: buildPlan, subjectsInTimetable: subjectsInTimetable, splitSubjects: splitSubjects, subjectKey: subjectKey,
    addDays: addDays, dayDiff: dayDiff, weekday: weekday, mondayOf: mondayOf, todayIso: todayIso, parseDate: parseDate
  };
});

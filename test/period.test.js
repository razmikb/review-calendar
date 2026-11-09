// Run: node test/period.test.js
// The exam season period calendar (stage 2 rules). Start: Monday 9 Nov 2026 = day 0.
'use strict';
var assert = require('assert');
var S = require('../js/schedule.js');

var START = '2026-11-09';
var passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }
function tt(map) {
  var t = {};
  for (var w = 0; w < 7; w++) t[w] = Object.assign({ m: '', a: '', e: '' }, map[w] || {});
  return t;
}
// Math Mon/Wed/Fri morning, Georgian Tue/Thu morning, English Mon afternoon.
var TT = tt({ 0: { m: 'Math', a: 'English' }, 1: { m: 'Georgian' }, 2: { m: 'Math' }, 3: { m: 'Georgian' }, 4: { m: 'Math' } });
var SUBS = ['Georgian', 'English', 'Math'];
function day(n) { return S.addDays(START, n); }
function boxes(p, kind, subject) {
  var out = [];
  p.days.forEach(function (d) {
    d.boxes.forEach(function (b) {
      if (subject && b.subject !== subject) return;
      if (kind && !b.parts.some(function (x) { return x.kind === kind; })) return;
      out.push({ day: d.i, kinds: b.parts.map(function (x) { return x.kind; }).join('+'), weight: b.weight, box: b });
    });
  });
  return out;
}
function days(list) { return list.map(function (b) { return b.day; }); }
// type: the first milestone's type. Mock exams get no practice test; other milestones do.
function national(extra, type) {
  return Object.assign({ start: START, timetable: TT, tests: [], daysOff: [],
    target: { type: 'national', date: '2027-06-07', subjects: SUBS },
    milestones: [
      { id: 'a', type: type || 'mock', date: day(21), subjects: SUBS },
      { id: 'b', type: 'mock', date: '2027-02-01', subjects: SUBS },
      { id: 'c', type: 'mock', date: '2027-04-19', subjects: SUBS }
    ] }, extra || {});
}

// ---------- the owner's 5 cases ----------

test('1. national exams in ~7 months, 3 mocks, next mock in 3 weeks', function () {
  var p = S.buildPeriod(national());
  assert.strictEqual(p.period.to, day(21));
  assert.strictEqual(p.period.last, day(22));
  assert.strictEqual(p.end, 23);                   // up to the mock, plus the day after for sorting errors
  assert.strictEqual(p.days.length, 28);           // shown as 4 whole weeks
  assert.strictEqual(p.days[21].tests.length, 3);  // the mock, one test per subject
  assert.ok(p.days[21].tests.every(function (x) { return x.stop && x.stop.id === 'a'; }));
  SUBS.forEach(function (s) {
    // A mock is itself a practice exam: no practice test or fix errors before it, only the pre-test box.
    assert.strictEqual(boxes(p, 'PT', s).length, 0, s);
    assert.strictEqual(boxes(p, 'FX', s).length, 0, s);
    assert.ok(days(boxes(p, 'P', s)).indexOf(20) >= 0, s + ' pre-test the day before');
    assert.deepStrictEqual(days(boxes(p, 'SE', s)), [22], s + ' sort errors the day after, on this calendar');
  });
  // R21 from day 0 would land on the mock day itself: dropped. Nothing else reaches day 21 either.
  assert.strictEqual(boxes(p, 'R21').length, 0);
  // Old topics: 1 per subject in each of the 3 full weeks; the last week (mock day + 1 day) gets none.
  assert.strictEqual(boxes(p, 'CUM').length, 9);
  assert.ok(boxes(p, 'CUM').every(function (b) { return b.day < 21; }));
});

test('2. university: midterm in 10 days, session exams in ~2 months', function () {
  var p = S.buildPeriod({ start: START, timetable: tt({ 0: { m: 'Calculus' }, 2: { a: 'Physics' }, 3: { m: 'Calculus' } }), tests: [],
    target: { type: 'session', date: '2027-01-11', subjects: ['Calculus', 'Physics'] },
    milestones: [{ id: 'mid', type: 'midterm', date: day(10), subjects: ['Calculus'] }] });
  assert.strictEqual(p.period.to, day(10));
  assert.strictEqual(p.end, 12);
  assert.deepStrictEqual(days(boxes(p, 'SE', 'Calculus')), [11]);
  assert.deepStrictEqual(days(boxes(p, 'PT', 'Calculus')), [6]);
  assert.deepStrictEqual(days(boxes(p, 'FX', 'Calculus')), [7]);
  assert.ok(days(boxes(p, 'P', 'Calculus')).indexOf(9) >= 0);
  assert.strictEqual(boxes(p, 'PT', 'Physics').length, 0); // Physics is not on the midterm
  assert.ok(boxes(p, 'R1', 'Physics').length > 0);         // but it is on the target exam: it gets reviews
  // Week 2 has 4 study days (Mon-Thu): it gets old-topics boxes, never on the midterm day for Calculus.
  var cum = boxes(p, 'CUM', 'Calculus');
  assert.strictEqual(cum.length, 2);
  assert.ok(cum.every(function (b) { return b.day !== 10; }));
});

test('3. a regular test inside the milestone run-up week', function () {
  // Session-exam milestone on day 21. Math test on Friday day 18 (= milestone day -3). Math also on Saturday day 19.
  var st = national({ timetable: tt({ 0: { m: 'Math', a: 'English' }, 1: { m: 'Georgian' }, 2: { m: 'Math' }, 3: { m: 'Georgian' }, 4: { m: 'Math' }, 5: { m: 'Math' } }),
    tests: [{ id: 'reg', subject: 'Math', date: day(18), slot: 'auto' }] }, 'session');
  var p = S.buildPeriod(st);
  // Day 17 keeps both: the practice test and the regular test's pre-test box.
  var d17 = boxes(p, null, 'Math').filter(function (b) { return b.day === 17; }).map(function (b) { return b.kinds; });
  assert.ok(d17.indexOf('PT') >= 0);
  assert.ok(d17.some(function (k) { return k.indexOf('P') === 0; }));
  assert.deepStrictEqual(days(boxes(p, 'FX', 'Math')), [18]);  // fix errors on the regular test day
  assert.ok(p.days[18].tests.some(function (x) { return x.id === 'reg'; }));
  // The milestone's pre-test covers only lessons after the regular test.
  var pre = boxes(p, 'P', 'Math').filter(function (b) { return b.day === 20; })[0].box.parts.filter(function (x) { return x.kind === 'P'; })[0];
  assert.deepStrictEqual(pre.lessons, ['math|' + day(19)]);
});

test('3b. a regular test on the milestone date is the milestone', function () {
  var p = S.buildPeriod(national({ tests: [{ id: 'reg', subject: 'Math', date: day(21), slot: 'auto' }] }));
  var math = p.days[21].tests.filter(function (x) { return x.key === 'math'; });
  assert.strictEqual(math.length, 1);
  assert.strictEqual(math[0].stop.id, 'a');
});

test('4. two practice tests on one day over the cap: warning, nothing moves them', function () {
  var p = S.buildPeriod(national({}, 'session')); // a session-exam milestone (a mock gets no practice test)
  var d = p.days[17];
  assert.ok(d.load > S.DAILY_CAP);
  assert.strictEqual(d.over, true);
  var pts = d.boxes.filter(function (b) { return b.parts[0].kind === 'PT'; });
  assert.strictEqual(pts.length, 3);
  pts.forEach(function (b) { assert.strictEqual(b.weight, 2); assert.strictEqual(b.parts.length, 1); });
  // Fix errors and pre-test also stay put.
  assert.strictEqual(p.days[18].boxes.filter(function (b) { return b.parts[0].kind === 'FX'; }).length, 3);
});

test('5. no milestones: the period runs to the target exam, capped at 8 weeks', function () {
  var p = S.buildPeriod({ start: START, timetable: TT, tests: [],
    target: { type: 'national', date: '2027-06-07', subjects: SUBS }, milestones: [] });
  assert.strictEqual(p.period.capped, true);
  assert.strictEqual(p.end, 56);
  assert.strictEqual(p.days.length, 56);
  assert.strictEqual(boxes(p, 'PT').length, 0);   // the exam is far beyond these 8 weeks
  assert.ok(boxes(p, 'R21').length > 0);           // no test in the way: R21 is kept
  assert.strictEqual(boxes(p, 'CUM').length, 8 * 3);
});

// ---------- the other stage 2 rules ----------

test('R21 is dropped when it would fall on or after the next test in that subject', function () {
  var p = S.buildPeriod(national({ milestones: [{ id: 'a', type: 'mock', date: day(30), subjects: ['Math'] }] }));
  // Math lessons on days 0, 2, 4, 7 -> R21 on 21, 23, 25, 28 (before 30); day 9 -> 30 is the mock: dropped.
  var r21 = [];
  p.lessons.filter(function (L) { return L.key === 'math'; }).forEach(function (L) {
    boxes(p, 'R21', 'Math').forEach(function (b) {
      b.box.parts.forEach(function (x) { if (x.kind === 'R21' && x.lessons[0] === L.id) r21.push(L.day); });
    });
  });
  assert.deepStrictEqual(r21, [0, 2, 4, 7]);
});

test('the cap moves old-topics boxes first, then R21', function () {
  var b = S.buildPeriod(national({ milestones: [] }));
  b.days.forEach(function (d) {
    if (!d.over) return;
    // An over-full day may keep only boxes that cannot move, or movable ones that have nowhere to go.
    d.boxes.forEach(function (x) { if (x.movable) assert.ok(x.bound <= d.i + 1 || d.i === b.end - 1); });
  });
  var moved = [];
  b.days.forEach(function (d) { d.boxes.forEach(function (x) { x.parts.forEach(function (p) { if (p.movedFrom && p.movedFrom.why === 'cap') moved.push(p.kind); }); }); });
  assert.ok(moved.every(function (k) { return ['CUM', 'R21', 'R7', 'R3'].indexOf(k) >= 0; }));
});

test('old topics: one per subject per week, on its own, dotted box kind CUM, not with other kinds', function () {
  var p = S.buildPeriod(national());
  boxes(p, 'CUM').forEach(function (b) { assert.strictEqual(b.kinds, 'CUM'); assert.strictEqual(b.weight, 1); });
  [0, 1, 2].forEach(function (w) {
    SUBS.forEach(function (s) {
      var n = boxes(p, 'CUM', s).filter(function (b) { return Math.floor(b.box.parts[0].week) === w; }).length;
      assert.strictEqual(n, 1, s + ' week ' + w);
    });
  });
});

test('sort errors: the day after a milestone; a milestone in the last 7 days puts it on the first day', function () {
  var p = S.buildPeriod(national({ milestones: [
    { id: 'old', type: 'mock', date: day(-4), subjects: ['Math'] },
    { id: 'older', type: 'mock', date: day(-9), subjects: ['English'] },
    { id: 'a', type: 'mock', date: day(21), subjects: SUBS }] }));
  assert.deepStrictEqual(days(boxes(p, 'SE', 'Math')), [0, 22]);
  assert.deepStrictEqual(days(boxes(p, 'SE', 'English')), [22]); // nothing from the milestone 9 days ago
});

test('a milestone on the start date has passed: test that day, sort errors next day, period runs on', function () {
  var p = S.buildPeriod(national({ milestones: [
    { id: 'today', type: 'mock', date: START, subjects: ['Math'] },
    { id: 'a', type: 'mock', date: day(21), subjects: SUBS }] }));
  assert.strictEqual(p.period.to, day(21));
  assert.ok(p.days[0].tests.some(function (x) { return x.stop && x.stop.id === 'today'; }));
  assert.deepStrictEqual(days(boxes(p, 'SE', 'Math')), [1, 22]); // and milestone a's, the day after it
});

test('run-up on a day off goes to the previous study day; before the start it is skipped with a note', function () {
  var p = S.buildPeriod(national({ daysOff: [day(17)] }, 'midterm'));
  assert.deepStrictEqual(days(boxes(p, 'PT', 'Math')), [16]);
  assert.deepStrictEqual(days(boxes(p, 'FX', 'Math')), [18]);
  var q = S.buildPeriod(national({ milestones: [{ id: 'a', type: 'midterm', date: day(2), subjects: ['Math'] },
    { id: 'b', type: 'mock', date: day(30), subjects: ['Math'] }] }));
  assert.strictEqual(boxes(q, 'PT', 'Math').filter(function (b) { return b.day < 2; }).length, 0);
  assert.ok(q.notes.some(function (n) { return n.type === 'runupSkipped' && n.subject === 'Math'; }));
});

test('the target exam gets the same run-up when it falls inside the period', function () {
  var p = S.buildPeriod({ start: START, timetable: TT, tests: [],
    target: { type: 'session', date: day(20), subjects: ['Math'] }, milestones: [] });
  assert.deepStrictEqual(days(boxes(p, 'PT', 'Math')), [16]);
  assert.deepStrictEqual(days(boxes(p, 'FX', 'Math')), [17]);
});

test('nothing to plan without an exam date', function () {
  assert.strictEqual(S.buildPeriod({ start: START, timetable: TT, target: {}, milestones: [] }), null);
});

test('mock exams: pre-test only; midterms keep the full run-up', function () {
  var p = S.buildPeriod(national({ milestones: [
    { id: 'mock', type: 'mock', date: day(10), subjects: ['Math'] },
    { id: 'mid', type: 'midterm', date: day(30), subjects: ['Math'] }] }));
  assert.strictEqual(p.period.stop.id, 'mock');
  assert.strictEqual(boxes(p, 'PT').length, 0);
  assert.strictEqual(boxes(p, 'FX').length, 0);
  assert.ok(days(boxes(p, 'P', 'Math')).indexOf(9) >= 0);
  assert.deepStrictEqual(days(boxes(p, 'SE', 'Math')), [11]); // the day after the mock, on this calendar
  var q = S.buildPeriod(national({ milestones: [{ id: 'mid', type: 'midterm', date: day(10), subjects: ['Math'] }] }));
  assert.deepStrictEqual(days(boxes(q, 'PT', 'Math')), [6]);
  assert.deepStrictEqual(days(boxes(q, 'FX', 'Math')), [7]);
});

test('the target exam and a capped period get no extra day', function () {
  var t = S.buildPeriod({ start: START, timetable: TT, tests: [], target: { date: day(20), subjects: ['Math'] }, milestones: [] });
  assert.strictEqual(t.period.last, day(20));
  assert.strictEqual(t.end, 21);
  var c = S.buildPeriod({ start: START, timetable: TT, tests: [], target: { date: '2027-06-07', subjects: ['Math'] }, milestones: [] });
  assert.strictEqual(c.end, 56);
});

console.log('\n' + passed + ' tests passed');

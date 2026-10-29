// Run: node test/schedule.test.js
'use strict';
var assert = require('assert');
var S = require('../js/schedule.js');

var START = '2026-10-29'; // Thursday: the calendar starts Mon 26 Oct, days 0-2 are before the start
function tt(map) { // map: { 0: {m:'Bio'} } Mon=0
  var t = {};
  for (var w = 0; w < 7; w++) t[w] = Object.assign({ m: '', a: '', e: '' }, map[w] || {});
  return t;
}
function boxesOf(plan, subject) {
  var out = [];
  plan.days.forEach(function (d) {
    d.boxes.forEach(function (b) { if (b.subject === subject) out.push({ day: d.i, kinds: b.parts.map(function (p) { return p.kind; }).join('+'), slot: b.slot, weight: b.weight }); });
  });
  return out;
}
function daysOf(list) { return list.map(function (b) { return b.day; }); }
var passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }

test('normal chain R1, R3 from a Monday lesson (R7 falls past the 2 weeks)', function () {
  // Bio on Mondays only. Mon 2 Nov = day 7, Mon 9 Nov = day 14 (outside).
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'], tests: [] });
  var b = boxesOf(p, 'Bio');
  assert.deepStrictEqual(daysOf(b), [8, 10]);
  assert.strictEqual(b[0].kinds, 'R1');
  assert.strictEqual(b[1].kinds, 'R3');      // R7 would be day 14, outside the 2 weeks
  assert.strictEqual(b[0].slot, 'm');         // Tuesday has no classes: morning is free
});

test('compression table: Mon -> next Mon gives Tue, Thu, Sun', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-09', slot: 'auto' }] });
  // lesson day 7 (Mon 2 Nov), test day 14 (outside) -> 8, 10, 13 (+ test prep on 13)
  var b = boxesOf(p, 'Bio');
  assert.deepStrictEqual(daysOf(b), [8, 10, 13]);
  assert.strictEqual(b[2].kinds, 'P+C');
  assert.strictEqual(b[2].weight, 2);
});

test('compression: Mon -> Fri gives Tue, Wed, Thu', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-06' }] });
  assert.deepStrictEqual(daysOf(boxesOf(p, 'Bio')).filter(function (d) { return d < 11; }), [8, 9, 10]);
});

test('compression: Mon -> Thu gives Tue, Wed', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-05' }] });
  assert.deepStrictEqual(daysOf(boxesOf(p, 'Bio')).filter(function (d) { return d < 10; }), [8, 9]);
});

test('test the day after a lesson: quick recall on test day, before the test', function () {
  // Bio Mon afternoon, test Tue 3 Nov in the afternoon; morning free -> quick recall in the morning
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { a: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-03', slot: 'a' }] });
  var b = boxesOf(p, 'Bio').filter(function (x) { return x.day <= 8; });
  assert.deepStrictEqual(b.map(function (x) { return x.day + ':' + x.kinds + ':' + x.slot; }), ['7:P:m', '8:Q:m']);
});

test('quick recall moves into the test slot when the free slot is after the test', function () {
  // Tue has Math in the morning and afternoon; Bio test Tue morning -> quick recall sits in the test slot
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { e: 'Bio' }, 1: { m: 'Math', a: 'Math' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-03', slot: 'm' }] });
  var q = boxesOf(p, 'Bio').filter(function (x) { return x.day === 8; })[0];
  assert.strictEqual(q.kinds, 'Q');
  assert.strictEqual(q.slot, 'm');
});

test('two tests for one subject: second test prep covers only lessons since the first', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' }, 3: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't1', subject: 'Bio', date: '2026-11-03' }, { id: 't2', subject: 'Bio', date: '2026-11-08' }] });
  var preps = [];
  p.days.forEach(function (d) { d.boxes.forEach(function (b) { b.parts.forEach(function (x) { if (x.kind === 'P') preps.push(x); }); }); });
  assert.strictEqual(preps.length, 2);
  // Lessons: Thu 29 Oct (3), Mon 2 Nov (7), Thu 5 Nov (10); Mon 9 Nov (14) is outside
  assert.deepStrictEqual(preps[0].lessons, ['bio|2026-10-29', 'bio|2026-11-02']);
  assert.deepStrictEqual(preps[1].lessons, ['bio|2026-11-05']);
});

test('same subject, several lessons due one day: merged into one box', function () {
  // Math Mon and Wed: Mon lesson R3 = Thu, Wed lesson R1 = Thu -> one box
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Math' }, 2: { m: 'Math' } }), priority: ['Math'], tests: [] });
  var thu = p.days[10].boxes.filter(function (b) { return b.subject === 'Math'; });
  assert.strictEqual(thu.length, 1);
  assert.strictEqual(thu[0].parts.length, 2);
});

test('double lesson in one day counts as one lesson', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Math', a: 'Math' } }), priority: ['Math'], tests: [] });
  assert.strictEqual(p.lessons.filter(function (L) { return L.day === 7; }).length, 1);
  assert.strictEqual(p.lessons[0].slot, 'm');
});

test('cap: over 4 moves R7 first, never R1', function () {
  // 6 subjects every weekday -> heavy days
  var all = 'A, B, C, D, E, F';
  var t = {}; for (var w = 0; w < 5; w++) t[w] = { m: all };
  var p = S.buildPlan({ start: START, timetable: tt(t), priority: ['A', 'B', 'C', 'D', 'E', 'F'], tests: [] });
  p.days.forEach(function (d) {
    if (d.over) {
      // anything left over the cap must be unmovable
      assert.ok(d.boxes.every(function (b) { return !b.movable; }), 'day ' + d.i + ' over cap with movable boxes');
    }
    d.boxes.forEach(function (b) {
      b.parts.forEach(function (x) { if (x.kind === 'R1') assert.ok(!x.movedFrom || x.movedFrom.why !== 'cap'); });
    });
  });
});

test('cap never moves a box onto or after its test', function () {
  var all = 'A, B, C, D, E';
  var t = {}; for (var w = 0; w < 5; w++) t[w] = { m: all };
  var tests = ['A', 'B', 'C', 'D', 'E'].map(function (s, i) { return { id: s, subject: s, date: '2026-11-1' + i }; });
  var p = S.buildPlan({ start: START, timetable: tt(t), priority: ['A', 'B', 'C', 'D', 'E'], tests: tests });
  p.days.forEach(function (d) {
    d.boxes.forEach(function (b) {
      var T = p.tests.filter(function (x) { return x.key === b.key && x.day >= d.i; })[0];
      b.parts.forEach(function (x) { if (x.kind !== 'Q' && T) assert.ok(d.i < T.day || x.kind === 'P'); });
    });
  });
});

test('all slots occupied: reviews go to evening', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio', a: 'Math', e: 'Tutor' }, 1: { m: 'Bio', a: 'Math', e: 'Tutor' } }), priority: ['Bio'], tests: [] });
  var tue = p.days[8].boxes[0];
  assert.strictEqual(tue.slot, 'e');
});

test('day off: no classes, reviews move to the next study day', function () {
  // Bio Monday; Tue 3 Nov off -> R1 moves to Wed
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'], tests: [], daysOff: ['2026-11-03'] });
  assert.strictEqual(p.days[8].boxes.length, 0);
  var wed = p.days[9].boxes[0];
  assert.strictEqual(wed.parts[0].kind, 'R1');
  assert.strictEqual(wed.parts[0].movedFrom.why, 'off');
});

test('day off before a test: test prep moves earlier, not onto the test', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-06' }], daysOff: ['2026-11-05'] });
  var prep = null;
  p.days.forEach(function (d) { d.boxes.forEach(function (b) { b.parts.forEach(function (x) { if (x.kind === 'P') prep = d.i; }); }); });
  assert.strictEqual(prep, 9);
});

test('a day off removes that day\'s lessons', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'], tests: [], daysOff: ['2026-11-02'] });
  assert.strictEqual(p.lessons.filter(function (L) { return L.day === 7; }).length, 0);
  assert.strictEqual(p.days[7].classes.length, 0);
});

test('calendar always shows Monday to Sunday, whatever the start day', function () {
  ['2026-10-26', '2026-10-29', '2026-11-01'].forEach(function (start) {
    var p = S.buildPlan({ start: start, timetable: tt({}), priority: [], tests: [] });
    assert.strictEqual(p.days.length, 14);
    assert.strictEqual(p.start, '2026-10-26');
    assert.strictEqual(S.weekday(p.days[0].date), 0);
    assert.strictEqual(S.weekday(p.days[13].date), 6);
  });
});

test('days before the start date: no classes, lessons, tests or boxes', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' }, 1: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-10-27' }, { id: 'u', subject: 'Bio', date: '2026-10-29' }] });
  assert.strictEqual(p.first, 3);
  [0, 1, 2].forEach(function (i) {
    var d = p.days[i];
    assert.ok(d.before && d.off);
    assert.strictEqual(d.classes.length + d.tests.length + d.boxes.length, 0);
  });
  assert.ok(!p.days[3].before);
  assert.strictEqual(p.days[3].tests.length, 1);   // test on the start date shows
  assert.strictEqual(p.notes.length, 0);           // its prep (day 2) is silently out of range, not "dropped"
  assert.ok(p.lessons.every(function (L) { return L.day >= 3; }));
});

test('free-text subjects: case and spaces do not create duplicates', function () {
  assert.deepStrictEqual(S.subjectsInTimetable(tt({ 0: { m: 'Math,  Bio' }, 1: { a: 'math' }, 2: { e: 'ბიოლოგია; Bio' } })),
    ['Math', 'Bio', 'ბიოლოგია']);
});

console.log('\n' + passed + ' tests passed');

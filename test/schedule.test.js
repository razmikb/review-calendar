// Run: node test/schedule.test.js
'use strict';
var assert = require('assert');
var S = require('../js/schedule.js');

var START = '2026-10-29'; // Thursday
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

test('normal chain R1, R3, R7 from a Monday lesson', function () {
  // Bio on Mondays only. Mon 2 Nov = day 4, Mon 9 Nov = day 11.
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'], tests: [] });
  var b = boxesOf(p, 'Bio');
  assert.deepStrictEqual(daysOf(b), [5, 7, 11, 12]);
  assert.strictEqual(b[0].kinds, 'R1');
  assert.strictEqual(b[1].kinds, 'R3');
  assert.strictEqual(b[2].kinds, 'R7');      // day 11 is also a lesson day; R7 of the first Monday
  assert.strictEqual(b[3].kinds, 'R1');
  assert.strictEqual(b[0].slot, 'm');         // Tuesday has no classes: morning is free
});

test('compression table: Mon -> next Mon gives Tue, Thu, Sun', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-09', slot: 'auto' }] });
  // lesson day 4 (Mon 2 Nov), test day 11 -> 5, 7, 10 (+ test prep on 10)
  var b = boxesOf(p, 'Bio').filter(function (x) { return x.day < 11; });
  assert.deepStrictEqual(daysOf(b), [5, 7, 10]);
  assert.strictEqual(b[2].kinds, 'P+C');
  assert.strictEqual(b[2].weight, 2);
});

test('compression: Mon -> Fri gives Tue, Wed, Thu', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-06' }] });
  assert.deepStrictEqual(daysOf(boxesOf(p, 'Bio')).filter(function (d) { return d < 8; }), [5, 6, 7]);
});

test('compression: Mon -> Thu gives Tue, Wed', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-05' }] });
  assert.deepStrictEqual(daysOf(boxesOf(p, 'Bio')).filter(function (d) { return d < 7; }), [5, 6]);
});

test('test the day after a lesson: quick recall on test day, before the test', function () {
  // Bio Mon afternoon, test Tue 3 Nov in the afternoon; morning free -> quick recall in the morning
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { a: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-03', slot: 'a' }] });
  var b = boxesOf(p, 'Bio').filter(function (x) { return x.day <= 5; });
  assert.deepStrictEqual(b.map(function (x) { return x.day + ':' + x.kinds + ':' + x.slot; }), ['4:P:m', '5:Q:m']);
});

test('quick recall moves into the test slot when the free slot is after the test', function () {
  // Tue has Math in the morning and afternoon; Bio test Tue morning -> quick recall sits in the test slot
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { e: 'Bio' }, 1: { m: 'Math', a: 'Math' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-03', slot: 'm' }] });
  var q = boxesOf(p, 'Bio').filter(function (x) { return x.day === 5; })[0];
  assert.strictEqual(q.kinds, 'Q');
  assert.strictEqual(q.slot, 'm');
});

test('two tests for one subject: second test prep covers only lessons since the first', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' }, 3: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't1', subject: 'Bio', date: '2026-11-03' }, { id: 't2', subject: 'Bio', date: '2026-11-10' }] });
  var preps = [];
  p.days.forEach(function (d) { d.boxes.forEach(function (b) { b.parts.forEach(function (x) { if (x.kind === 'P') preps.push(x); }); }); });
  assert.strictEqual(preps.length, 2);
  // Lessons: Thu 29 Oct (0), Mon 2 Nov (4), Thu 5 Nov (7), Mon 9 Nov (11), Thu 12 Nov (14 -> outside)
  assert.deepStrictEqual(preps[0].lessons, ['bio|2026-10-29', 'bio|2026-11-02']);
  assert.deepStrictEqual(preps[1].lessons, ['bio|2026-11-05', 'bio|2026-11-09']);
});

test('same subject, several lessons due one day: merged into one box', function () {
  // Math Mon and Wed: Mon lesson R3 = Thu, Wed lesson R1 = Thu -> one box
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Math' }, 2: { m: 'Math' } }), priority: ['Math'], tests: [] });
  var thu = p.days[7].boxes.filter(function (b) { return b.subject === 'Math'; });
  assert.strictEqual(thu.length, 1);
  assert.strictEqual(thu[0].parts.length, 2);
});

test('double lesson in one day counts as one lesson', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Math', a: 'Math' } }), priority: ['Math'], tests: [] });
  assert.strictEqual(p.lessons.filter(function (L) { return L.day === 4; }).length, 1);
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
  var tue = p.days[5].boxes[0];
  assert.strictEqual(tue.slot, 'e');
});

test('day off: no classes, reviews move to the next study day', function () {
  // Bio Monday; Tue 3 Nov off -> R1 moves to Wed
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'], tests: [], daysOff: ['2026-11-03'] });
  assert.strictEqual(p.days[5].boxes.length, 0);
  var wed = p.days[6].boxes[0];
  assert.strictEqual(wed.parts[0].kind, 'R1');
  assert.strictEqual(wed.parts[0].movedFrom.why, 'off');
});

test('day off before a test: test prep moves earlier, not onto the test', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'],
    tests: [{ id: 't', subject: 'Bio', date: '2026-11-06' }], daysOff: ['2026-11-05'] });
  var prep = null;
  p.days.forEach(function (d) { d.boxes.forEach(function (b) { b.parts.forEach(function (x) { if (x.kind === 'P') prep = d.i; }); }); });
  assert.strictEqual(prep, 6);
});

test('a day off removes that day\'s lessons', function () {
  var p = S.buildPlan({ start: START, timetable: tt({ 0: { m: 'Bio' } }), priority: ['Bio'], tests: [], daysOff: ['2026-11-02'] });
  assert.strictEqual(p.lessons.filter(function (L) { return L.day === 4; }).length, 0);
  assert.strictEqual(p.days[4].classes.length, 0);
});

test('free-text subjects: case and spaces do not create duplicates', function () {
  assert.deepStrictEqual(S.subjectsInTimetable(tt({ 0: { m: 'Math,  Bio' }, 1: { a: 'math' }, 2: { e: 'ბიოლოგია; Bio' } })),
    ['Math', 'Bio', 'ბიოლოგია']);
});

console.log('\n' + passed + ' tests passed');

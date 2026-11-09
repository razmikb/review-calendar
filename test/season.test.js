// Run: node test/season.test.js
'use strict';
var assert = require('assert');
var S = require('../js/schedule.js');

var passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }
var START = '2026-11-09';

test('national exams in ~7 months with 3 mock exams: 4 periods, next one ends at the first mock', function () {
  var subs = ['Georgian', 'English', 'Math'];
  var sea = S.buildSeason({ start: START,
    target: { type: 'national', date: '2027-06-07', subjects: subs },
    milestones: [
      { id: 'b', type: 'mock', date: '2027-02-01', subjects: ['Math'] },
      { id: 'a', type: 'mock', date: '2026-11-30', subjects: subs },
      { id: 'c', type: 'mock', date: '2027-04-19', subjects: ['english', 'Chemistry'] }
    ] });
  assert.deepStrictEqual(sea.stops.map(function (s) { return s.id; }), ['a', 'b', 'c', 'target']); // sorted by date
  assert.deepStrictEqual(sea.periods.map(function (p) { return p.from + '>' + p.to; }),
    ['2026-11-09>2026-11-30', '2026-11-30>2027-02-01', '2027-02-01>2027-04-19', '2027-04-19>2027-06-07']);
  assert.strictEqual(sea.stops[0].days, 21);
  assert.strictEqual(sea.stops[0].weeks, 3);
  assert.strictEqual(sea.stops[0].rest, 0);
  assert.deepStrictEqual(sea.stops[2].subjects, ['English']); // spelled as on the target; Chemistry is not on it
  assert.strictEqual(sea.period.to, '2026-11-30');
  assert.strictEqual(sea.period.capped, false);
});

test('university: midterm in 10 days, session exams in ~2 months', function () {
  var sea = S.buildSeason({ start: START,
    target: { type: 'session', date: '2027-01-11', subjects: ['Calculus', 'Physics'] },
    milestones: [{ id: 'm', type: 'midterm', date: '2026-11-19', subjects: ['Calculus'] }] });
  assert.strictEqual(sea.stops[0].days, 10);
  assert.strictEqual(sea.stops[0].weeks, 1);
  assert.strictEqual(sea.stops[0].rest, 3);
  assert.strictEqual(sea.period.to, '2026-11-19');
  assert.strictEqual(sea.periods.length, 2);
});

test('no milestones: the period runs to the target exam, capped at 8 weeks', function () {
  var sea = S.buildSeason({ start: START, target: { type: 'national', date: '2027-06-07', subjects: ['Math'] }, milestones: [] });
  assert.strictEqual(sea.periods.length, 1);
  assert.strictEqual(sea.period.stop.isTarget, true);
  assert.strictEqual(sea.period.capped, true);
  assert.strictEqual(S.dayDiff(sea.period.from, sea.period.to) + 1, 56);
});

test('exactly 8 weeks away is not capped; the milestone day is the last day', function () {
  var sea = S.buildSeason({ start: START, target: { date: '2027-01-04', subjects: ['Math'] }, milestones: [] });
  assert.strictEqual(sea.period.capped, false);
  assert.strictEqual(sea.period.to, '2027-01-04');
});

test('passed milestones and milestones after the target are left out of the periods', function () {
  var sea = S.buildSeason({ start: START, target: { date: '2027-01-11', subjects: ['Math'] },
    milestones: [
      { id: 'old', date: '2026-11-02', subjects: ['Math'] },
      { id: 'today', date: START, subjects: ['Math'] },
      { id: 'late', date: '2027-02-01', subjects: ['Math'] },
      { id: 'nodate', date: '', subjects: ['Math'] }
    ] });
  assert.deepStrictEqual(sea.past.map(function (m) { return m.id; }), ['old', 'today']);
  assert.deepStrictEqual(sea.late.map(function (m) { return m.id; }), ['late']);
  assert.deepStrictEqual(sea.stops.map(function (m) { return m.id; }), ['target']);
});

test('no target date: no periods', function () {
  var sea = S.buildSeason({ start: START, target: { subjects: ['Math'] }, milestones: [{ id: 'a', date: '2026-12-01' }] });
  assert.strictEqual(sea.target, null);
  assert.strictEqual(sea.period.stop.id, 'a');
  var none = S.buildSeason({ start: START, target: {}, milestones: [] });
  assert.strictEqual(none.period, null);
  assert.strictEqual(none.periods.length, 0);
});

test('each exam subject has its own track: its own mocks, then its own exam day', function () {
  var sea = S.buildSeason({ start: START,
    target: { type: 'national', date: '2027-06-07', subjects: ['Math', 'Georgian'], subjectDates: { georgian: '2027-06-10' } },
    milestones: [
      { id: 'm1', type: 'mock', date: '2027-01-11', subjects: ['Math'] },
      { id: 'g1', type: 'mock', date: '2027-01-14', subjects: ['Georgian'] },
      { id: 'both', type: 'other', date: '2027-03-01', subjects: ['Math', 'Georgian'] },
      { id: 'old', type: 'mock', date: '2026-10-01', subjects: ['Math'] }
    ] });
  function ids(tr) { return tr.stops.map(function (x) { return x.stop.id + '@' + x.stop.date; }); }
  assert.deepStrictEqual(sea.tracks.map(function (tr) { return tr.subject; }), ['Math', 'Georgian']);
  assert.deepStrictEqual(ids(sea.tracks[0]), ['m1@2027-01-11', 'both@2027-03-01', 'target@2027-06-07']); // passed one left out
  assert.deepStrictEqual(ids(sea.tracks[1]), ['g1@2027-01-14', 'both@2027-03-01', 'target@2027-06-10']);
  assert.strictEqual(sea.tracks[1].stops[0].from, START);
  assert.strictEqual(sea.tracks[1].stops[1].from, '2027-01-14');
});

test('suggested milestone dates: evenly spread, on weekdays, none when too close', function () {
  // 210 days to the national exams, 3 mocks -> about 52, 105, 158 days in
  var d = S.suggestDates(START, '2027-06-07', 3);
  assert.strictEqual(d.length, 3);
  d.forEach(function (x) { assert.ok(S.weekday(x) < 5, x + ' is a weekday'); });
  assert.deepStrictEqual(d.map(function (x) { return S.dayDiff(START, x); }).map(function (n) { return Math.round(n / 7); }), [8, 15, 23]);
  // A midterm halfway to session exams 2 months away
  var m = S.suggestDates(START, '2027-01-11', 1);
  assert.strictEqual(m.length, 1);
  assert.ok(Math.abs(S.dayDiff(START, m[0]) - 31) <= 1);
  // Too close: 3 mocks need at least 8 weeks
  assert.deepStrictEqual(S.suggestDates(START, '2026-12-20', 3), []);
  assert.deepStrictEqual(S.suggestDates(START, '', 1), []);
});

console.log('\n' + passed + ' tests passed');

/*
 * The calendar screen, for both modes: the student builds the plan on the calendar itself.
 * Tap a slot to add a class or a test, tap a day to make it a day off, drag classes and tests to move them.
 * Sessions are placed by the rules in schedule.js and appear as the calendar fills up.
 * They stay put unless the student turns on "Move sessions" (advanced); test prep and practice tests never move.
 * Exam season adds a timeline above the calendar: the target exam, milestones and the periods between them,
 * each opened with a tap. The calendar then covers the period up to the next milestone.
 * app.js owns the state and the export; it calls Board.init once, then Board.view on each render.
 */
(function () {
  'use strict';
  var S = window.Schedule;
  var SLOTS = ['m', 'a', 'e'];
  var A;              // what app.js shares: state, strings, helpers (see app.js "Board")
  var plan;           // the plan shown on screen right now
  var prevIds = null; // sessions on screen before this render: new ones get a short animation
  var undoStack = [];
  var suppressClick = false;

  window.Board = { init: init, view: view, after: after, applyMoves: applyMoves, clearUndo: function () { undoStack = []; } };

  // ---------- helpers ----------
  function st() { return A.getState(); }
  function t(k, v) { return A.t(k, v); }
  function esc(s) { return A.esc(s); }
  function k(name) { return S.subjectKey(name); }
  function day(iso) { return A.dayLabel(iso); }
  function wdLong(iso) { return t('weekdaysLong')[S.weekday(iso)]; }
  function slotName(s) { return t('slot_' + s); }
  function slotLower(s) { return t('slot_' + s).toLocaleLowerCase(); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function classesAt(w, slot) { return S.splitSubjects(st().timetable[w][slot]); }
  function setClasses(w, slot, list) { st().timetable[w][slot] = list.join(', '); }
  function season() { return A.season(); }
  // The subjects that get sessions: chosen by the student (2 weeks) or the target exam's subjects (exam season).
  function prioList() { return season() ? st().target.subjects : st().priority; }
  function subjects() {
    var s = st();
    return S.uniqueSubjects(S.subjectsInTimetable(s.timetable).concat(s.tests.map(function (x) { return x.subject; }), prioList()));
  }
  function known(name) { return subjects().some(function (x) { return k(x) === k(name); }); }
  function isPrio(name) { return prioList().some(function (p) { return k(p) === k(name); }); }
  function hasSub(list, name) { return (list || []).some(function (x) { return k(x) === k(name); }); }
  function toggleSub(list, name) { return hasSub(list, name) ? list.filter(function (x) { return k(x) !== k(name); }) : list.concat([name]); }
  // Turn sessions on or off for a subject. In exam season that adds it to (or removes it from) the target exam,
  // with its own milestones.
  function setPrio(name, on) {
    var s = st();
    if (!season()) {
      s.priority = on ? s.priority.concat([name]) : s.priority.filter(function (x) { return k(x) !== k(name); });
      return;
    }
    if (on) A.addExamSubject(name); else A.removeExamSubject(name);
  }
  // A new subject typed in the 2-week mode gets sessions right away. In exam season only the exam's subjects do.
  function autoPrio(name) { if (!season() && !known(name)) st().priority.push(name); }
  // A subject with no class and no test left is dropped from the "Sessions for" list (2-week mode).
  function tidyPriority() {
    if (season()) return;
    var s = st();
    var used = S.uniqueSubjects(S.subjectsInTimetable(s.timetable).concat(s.tests.map(function (x) { return x.subject; })));
    s.priority = s.priority.filter(function (p) { return used.some(function (u) { return k(u) === k(p); }); });
  }
  function dayByDate(date) { return plan.days.filter(function (d) { return d.date === date; })[0]; }
  function findBox(id) {
    for (var i = 0; i < plan.days.length; i++) for (var j = 0; j < plan.days[i].boxes.length; j++)
      if (plan.days[i].boxes[j].id === id) return { box: plan.days[i].boxes[j], day: plan.days[i] };
    return null;
  }
  function isPrep(b) { return b.parts.some(function (p) { return p.kind === 'P'; }); }
  function kind0(b) { return b.parts[0].kind; }
  // Test prep and practice tests never move, not even with "Move sessions" on.
  function lockKey(b) { return isPrep(b) ? 'bPrepLocked' : kind0(b) === 'PT' ? 'bPracticeLocked' : ''; }
  function touchUI() { return window.matchMedia && matchMedia('(hover: none)').matches; }

  // ---------- sessions the student moved ----------
  // state.moved = { sessionId: { date, slot } }. A session that no longer exists after an edit goes back (is forgotten).
  function applyMoves(p, s) {
    var lost = 0, byId = {};
    s.moved = s.moved || {};
    p.days.forEach(function (d) { d.boxes.forEach(function (b) { b.home = { date: d.date, slot: b.slot, day: d.i }; byId[b.id] = { b: b, d: d }; }); });
    Object.keys(s.moved).forEach(function (id) {
      var o = s.moved[id], hit = byId[id];
      var to = p.days.filter(function (d) { return d.date === o.date; })[0];
      if (!hit || !to || to.off || lockKey(hit.b)) { delete s.moved[id]; lost++; return; }
      hit.d.boxes.splice(hit.d.boxes.indexOf(hit.b), 1);
      hit.b.slot = o.slot;
      hit.b.moved = true;
      to.boxes.push(hit.b);
    });
    p.days.forEach(function (d) {
      d.load = d.boxes.reduce(function (n, b) { return n + b.weight; }, 0);
      d.over = d.load > S.DAILY_CAP;
    });
    p.lostMoves = lost;
    return p;
  }

  // ---------- changes and undo ----------
  function change(fn, msg, warn) {
    undoStack.push(JSON.stringify(st()));
    if (undoStack.length > 60) undoStack.shift();
    fn();
    A.save();
    A.render();
    if (msg) toast(msg, { undo: true, warn: warn });
  }
  function undo() {
    if (!undoStack.length) return;
    A.setState(JSON.parse(undoStack.pop()));
    A.save(); closeSheet(); A.render(); toast(t('bUndone'));
  }

  // ---------- the screen ----------
  function view() {
    var s = st();
    plan = A.plan();
    var subs = subjects(), chosen = prioList().filter(function (p) { return subs.some(function (x) { return k(x) === k(p); }); });
    var sea = season() ? A.buildSeason() : null;
    var hasClass = S.subjectsInTimetable(s.timetable).length > 0;
    var moved = Object.keys(s.moved || {}).length;

    var bar = '<div class="bar">' +
      '<div class="view-toggle" role="group" aria-label="' + esc(t('modeLabel')) + '">' +
      '<button type="button" data-action="mode" data-mode="two" aria-pressed="' + !sea + '">' + esc(t('modeTwo')) + '</button>' +
      '<button type="button" data-action="mode" data-mode="season" aria-pressed="' + !!sea + '">' + esc(t('modeSeason')) + '</button></div>' +
      '<label class="bar-field" for="b-start">' + esc(t('bStart')) + '<input type="date" id="b-start" data-b-start value="' + esc(s.start) + '"></label>' +
      '<button type="button" class="btn small-btn" data-b="undo"' + (undoStack.length ? '' : ' disabled') + '>' + esc(t('bUndo')) + '</button>' +
      '<button type="button" class="switch" role="switch" data-b="adv" aria-checked="' + !!s.advanced + '"><span class="track" aria-hidden="true"></span>' + esc(t('bMoveSessions')) + '</button>' +
      '</div>';

    var guide = sea
      ? [[hasClass, 'bGuideClasses'], [!!(sea.target && sea.target.days > 0), 'bGuideTarget'], [chosen.length > 0, 'bGuideExamSubjects'],
        [s.milestones.length > 0, 'bGuideMilestones'], [s.daysOff.length > 0, 'bGuideOff']]
      : [[hasClass, 'bGuideClasses'], [chosen.length > 0, 'bGuideSubjects'], [s.tests.length > 0, 'bGuideTests'], [s.daysOff.length > 0, 'bGuideOff']];
    var guideHtml = '<ol class="guide">' + guide.map(function (g, i) {
      return '<li' + (g[0] ? ' class="done"' : '') + '><span class="mark" aria-hidden="true">' + (g[0] ? '✓' : i + 1) + '</span>' + esc(t(g[1])) +
        (g[0] ? '<span class="sr"> ✓</span>' : '') + '</li>';
    }).join('') + '</ol>';

    var subjHtml = subs.length ? '<div class="b-subjects"><span>' + esc(t(sea ? 'bExamSubjects' : 'bSessionsFor')) + '</span>' + subs.map(function (x) {
      return '<button type="button" class="chip-btn" data-b="prio" data-subject="' + esc(x) + '" aria-pressed="' + isPrio(x) + '">' + esc(x) + '</button>';
    }).join('') + '</div>' : '';
    if (chosen.length > (sea ? 4 : 3)) subjHtml += '<p class="warn">' + esc(t('subjectsTooMany', { n: chosen.length })) + '</p>';

    var banner = '';
    if (sea) {
      var miss = A.missing(sea);
      if (!s.target.date && !hasClass) banner += '<div class="b-hint"><p><b>' + esc(t('bSeasonEmptyTitle')) + '</b> ' + esc(t('bSeasonEmptyBody')) + '</p>' +
        '<button type="button" class="btn primary" data-b="target"' + (hasSubjects() ? '' : ' disabled aria-describedby="b-need-class"') + '>' + esc(t('bSetTarget')) + '</button>' +
        '<button type="button" class="btn" data-b="example">' + esc(t('loadExample')) + '</button>' +
        '<p class="muted small" id="b-need-class">' + esc(t('bNeedClass')) + '</p></div>';
      else if (miss) banner += '<p class="warn">' + esc(t(miss)) + '</p>';
      if (miss) banner += '<p class="muted small">' + esc(t('bSeasonNoPeriod')) + '</p>';
    } else if (!hasClass && !s.tests.length) banner += '<div class="b-hint"><p><b>' + esc(t('bEmptyTitle')) + '</b> ' + esc(t('bEmptyBody')) + '</p>' +
      '<button type="button" class="btn" data-b="example">' + esc(t('loadExample')) + '</button></div>';
    else if (hasClass && !chosen.length) banner += '<p class="warn">' + esc(t('bNoSessions')) + '</p>';
    if (s.advanced) banner += '<div class="b-adv"><p><b>' + esc(t('bAdvOnTitle')) + '</b> ' + esc(t('bAdvOnBody')) + '</p>' +
      (moved ? '<button type="button" class="btn small-btn" data-b="putall">' + esc(t('bPutAllBack', { n: moved })) + '</button>' : '') +
      '<button type="button" class="btn small-btn" data-b="advoff">' + esc(t('bTurnOff')) + '</button></div>';

    var overDays = plan.days.filter(function (d) { return d.over; }).length;
    var per = plan.period;
    var notes = (per ? '<p class="b-period"><b>' + esc(t(per.last === per.to ? 'periodRange' : per.stop.isTarget ? 'bPeriodExamDays' : 'periodRangeAfter',
        { from: day(per.from), to: day(per.last), stop: A.stopName(per.stop), date: day(per.to) })) + '</b> ' +
        esc(t('periodPages', { n: A.pageCount(plan) })) + '</p>' +
        (per.capped ? '<p class="note">' + esc(t('periodCapped')) + '</p>' : '') : '') +
      (sea ? sea.late.map(function (m) { return '<p class="warn">' + esc(A.stopName(m) + ' ' + day(m.date) + ': ' + t('msAfterTarget')) + '</p>'; }).join('') : '') +
      (overDays ? '<p class="warn">' + esc(t('overCapSummary', { n: overDays })) + '</p>' : '') +
      plan.notes.map(function (n) { return '<p class="warn">' + esc(A.noteText(n)) + '</p>'; }).join('');

    var legend = '<div class="b-legend">' +
      '<span><i class="lg-cls"></i>' + esc(t('legendClass')) + '</span>' +
      '<span><i class="lg-ses"></i>' + esc(t('legendReview')) + '</span>' +
      '<span><i class="lg-prep"></i>' + esc(t('legendPrep')) + '</span>' +
      (sea ? '<span><i class="lg-practice"></i>' + esc(t('legendPractice')) + '</span><span><i class="lg-cum"></i>' + esc(t('legendCum')) + '</span>' : '') +
      '<span><i class="lg-test"></i>' + esc(t(sea ? 'legendExam' : 'legendTest')) + '</span>' +
      '<span><i class="lg-off"></i>' + esc(t('dayOff')) + '</span></div>' +
      '<p class="b-method">' + esc(t('legendRule')) + '</p>';

    var how = '<section class="panel"><details class="how"><summary><h3>' + esc(t('bHowHeading')) + '</h3></summary><div class="how-body">' +
      '<p>' + esc(t(sea ? 'seasonStartBody' : 'startBody')) + '</p>' +
      '<div class="frame">' +
      '<div><b>' + esc(t('frameLearn')) + '</b><span>' + esc(t('frameLearnWhen')) + '</span></div>' +
      '<div class="recall"><b>' + esc(t('frameRecall')) + '</b><span>' + esc(t('frameRecallWhen')) + '</span></div>' +
      '<div><b>' + esc(t('frameFix')) + '</b><span>' + esc(t('frameFixWhen')) + '</span></div></div>' +
      (sea ? '<h3>' + esc(t('cycleHeading')) + '</h3><ol class="cycle">' + ['Understand', 'Recall', 'Space', 'Simulate'].map(function (c) {
        return '<li class="c-' + c.toLowerCase() + '"><b>' + esc(t('cycle' + c)) + '</b><span>' + esc(t('cycle' + c + 'When')) + '</span></li>';
      }).join('') + '</ol><p class="muted small">' + esc(t('periodNextTime')) + '</p>'
        : '<p class="muted small">' + esc(t('bPlanRange', { from: day(plan.days[plan.first].date), to: day(plan.days[plan.end - 1].date) })) + '</p>') +
      A.why('whyStart') + A.why('whyChain') + A.why('whySubjects') + A.why('whyTests') + A.why('whyCap') +
      '<h3>' + esc(t('homeworkHeading')) + '</h3><p>' + esc(t('homeworkBody')) + '</p>' +
      '</div></details></section>';

    var resetRow = '<div class="row"><button type="button" class="btn quiet" data-b="reset">' + esc(t('startOver')) + '</button></div>';
    var exp = sea
      ? A.exportPanel('exportHeading', 'cal', A.pageCount(plan),
        '<h3>' + esc(t('mapExportHeading')) + '</h3>' +
        '<div class="row"><button type="button" class="btn" data-action="print" data-what="map">' + esc(t('print')) + '</button>' +
        '<button type="button" class="btn" data-action="png" data-what="map">' + esc(t('saveImage')) + '</button>' +
        (navigator.share ? '<button type="button" class="btn" data-action="share" data-what="map">' + esc(t('shareImage')) + '</button>' : '') + '</div>' + resetRow)
      : A.exportPanel('exportHeading', 'cal', 1,
        '<h3>' + esc(t('blankHeading')) + '</h3><p class="muted small">' + esc(t('blankBody')) + '</p>' +
        '<div class="row"><button type="button" class="btn" data-action="print" data-what="blank">' + esc(t('printBlank')) + '</button>' +
        '<button type="button" class="btn" data-action="png" data-what="blank">' + esc(t('saveBlank')) + '</button></div>' + resetRow);

    return '<div class="board' + (s.advanced ? ' adv' : '') + '">' + bar + guideHtml + (sea ? seasonHtml(sea) : '') + subjHtml + banner + notes +
      '<div class="weeks" id="b-grid">' + gridHtml() + '</div>' + legend + otherTests() + '</div>' + how + exp;
  }

  function gridHtml() {
    var today = S.todayIso(), html = '', ids = {};
    var testsOn = {};
    plan.tests.forEach(function (x) { (testsOn[x.date] = testsOn[x.date] || []).push(x); });
    for (var w = 0; w * 7 < plan.days.length; w++) {
      var week = plan.days.slice(w * 7, w * 7 + 7);
      html += '<section class="week" aria-label="' + esc(day(week[0].date) + ' – ' + day(week[6].date)) + '"><div class="corner"></div>';
      SLOTS.forEach(function (sl, i) { html += '<div class="rl" style="grid-row:' + (i + 2) + '">' + esc(slotName(sl)) + '</div>'; });
      html += '<div class="rl foot" style="grid-row:5">' + esc(t('printBoxes')) + '</div>';
      week.forEach(function (d, col) {
        var out = d.before || d.after, off = d.off && !out;
        var ok = out ? (d.after ? 'test' : '') : off ? '' : 'all';
        html += '<div class="bday' + (out ? ' out' : '') + (d.after ? ' after' : '') + (off ? ' off' : '') + (d.over ? ' over' : '') +
          (d.date === today ? ' is-today' : '') + '" style="grid-column:' + (col + 2) + '">';
        html += '<button type="button" class="dh" data-dayhead="' + d.date + '"' + (out ? ' disabled' : '') + '>' +
          '<span class="wd">' + esc(A.wd(d.date)) + '</span> <span class="dm">' + esc(A.dm(d.date)) + '</span>' +
          (off ? '<span class="tag">' + esc(t('dayOff')) + '</span>' : d.date === today ? '<span class="tag">' + esc(t('today')) + '</span>' : '') + '</button>';
        SLOTS.forEach(function (sl) {
          html += '<div class="cell" data-cell data-date="' + d.date + '" data-slot="' + sl + '"' + (ok ? ' data-ok="' + ok + '"' : '') + '>' +
            '<span class="sl">' + esc(slotName(sl)) + '</span>';
          (testsOn[d.date] || []).filter(function (x) { return x.slot === sl; }).forEach(function (x) {
            html += '<button type="button" class="chip test' + (x.stop ? ' stop' : '') + '" data-drag="test" data-id="' + esc(x.id) + '"' +
              (x.stop ? ' data-stop="' + esc(x.stop.id) + '"' : '') + '><span class="tx">' + esc(x.stop ? A.testLabel(x) : t('printTest') + ' · ' + x.subject) + '</span></button>';
          });
          d.classes.filter(function (c) { return c.slot === sl; }).forEach(function (c) {
            var topic = (st().lessonNames[c.key + '|' + d.date] || '').trim();
            html += '<button type="button" class="chip cls' + (isPrio(c.subject) ? '' : ' nop') + '" data-drag="class" data-date="' + d.date +
              '" data-slot="' + sl + '" data-key="' + esc(c.key) + '" data-subject="' + esc(c.subject) + '"><span class="tx">' + esc(c.subject) +
              (topic ? '<small>' + esc(topic) + '</small>' : '') + '</span></button>';
          });
          d.boxes.filter(function (b) { return b.slot === sl; }).forEach(function (b) {
            ids[b.id + '@' + d.date] = true;
            html += sessionChip(b, prevIds && !prevIds[b.id + '@' + d.date]);
          });
          if (ok) html += '<button type="button" class="add" data-add aria-label="' + esc(t('bAddAria', { day: day(d.date), slot: slotLower(sl) })) + '">+</button>';
          html += '</div>';
        });
        html += '<div class="df">' + (out || off ? '' : (d.over ? '⚠ ' : '') + d.load + ' / ' + S.DAILY_CAP) + '</div></div>';
      });
      html += '</section>';
    }
    view.ids = ids;
    return html;
  }

  function sessionChip(b, isNew) {
    var done = !!st().done[b.id];
    var k0 = kind0(b);
    return '<button type="button" class="chip ses' + (isPrep(b) ? ' prep' : k0 === 'PT' ? ' practice' : k0 === 'CUM' ? ' cum' : '') +
      (lockKey(b) ? ' locked' : '') + (b.moved ? ' moved' : '') + (done ? ' is-done' : '') + (isNew ? ' pop' : '') +
      '" data-drag="session" data-id="' + esc(b.id) + '"><span class="tick" aria-hidden="true">' + (done ? '✓' : '') + '</span><span class="tx">' + esc(b.subject) +
      '<small>' + esc(shortLabel(b)) + '</small></span>' + (done ? '<span class="sr">' + esc(t('bDone')) + '</span>' : '') + '</button>';
  }
  function shortLabel(b) {
    if (isPrep(b)) return t('ses_P');
    var lessons = [];
    b.parts.forEach(function (p) { p.lessons.forEach(function (id) { if (lessons.indexOf(id) < 0) lessons.push(id); }); });
    var base = b.parts.length > 1 ? t('sesLessons', { n: lessons.length || b.parts.length }) : t('ses_' + b.parts[0].kind);
    var topic = lessons.length === 1 ? (st().lessonNames[lessons[0]] || '').trim() : '';
    return topic ? base + ' · ' + topic : base;
  }

  // Tests outside the calendar still shape the sessions before them: list them so they can be removed.
  function otherTests() {
    var shown = {};
    plan.days.forEach(function (d) { shown[d.date] = true; });
    var list = st().tests.filter(function (x) { return x.date && !shown[x.date]; });
    if (!list.length) return '';
    return '<div class="b-other"><p class="muted small">' + esc(t('bOtherTests')) + '</p><ul>' + list.map(function (x) {
      return '<li>' + esc(x.subject + ' · ' + day(x.date)) + ' <button type="button" class="btn quiet" data-b="rmtest" data-id="' + esc(x.id) + '">' + esc(t('removeTest')) + '</button></li>';
    }).join('') + '</ul></div>';
  }

  // Runs after app.js has put the screen on the page.
  function after() {
    prevIds = view.ids || null;
    if (plan && plan.lostMoves) {
      var n = plan.lostMoves;
      plan.lostMoves = 0;
      A.save();
      setTimeout(function () { toast(t('bMovesLost', { n: n }), { warn: true }); }, 0);
    }
  }

  // ---------- sheets (bottom sheet on phones, dialog on wider screens) ----------
  var sheetRoot, toastRoot, sheetHandlers = {}, sheetCleanup = null, lastFocus = null;
  function openSheet(html, handlers, cleanup) {
    closeSheet(true);
    lastFocus = document.activeElement;
    sheetRoot.innerHTML = '<div class="scrim" data-scrim><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' + html + '</div></div>';
    sheetHandlers = handlers || {};
    sheetCleanup = cleanup || null;
    var f = $('[autofocus]', sheetRoot) || $('.sheet button, .sheet input', sheetRoot);
    if (f) f.focus();
  }
  function closeSheet(keepFocus) {
    if (sheetCleanup) sheetCleanup();
    sheetCleanup = null;
    if (!sheetRoot.innerHTML) return;
    sheetRoot.innerHTML = '';
    if (!keepFocus && lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
  }
  function acts(list) {
    return '<div class="acts">' + list.map(function (a) {
      return '<button type="button" class="btn' + (a[2] ? ' ' + a[2] : '') + '" data-act="' + a[0] + '">' + esc(a[1]) + '</button>';
    }).join('') + '</div>';
  }

  function openAdd(date, slot, mode) {
    var d = dayByDate(date), testOnly = d.after;
    mode = testOnly ? 'test' : (mode || 'class');
    var isClass = mode === 'class', w = S.weekday(date), subs = subjects();
    var html = '<h2 id="sheet-title">' + esc(day(date) + ' · ' + slotName(slot)) + '</h2>' +
      (testOnly ? '<p class="note">' + esc(t('bAfterOnlyTests')) + '</p>' :
        '<div class="view-toggle seg" role="group"><button type="button" data-act="mode" data-mode="class" aria-pressed="' + isClass + '">' + esc(t('bClass')) + '</button>' +
        '<button type="button" data-act="mode" data-mode="test" aria-pressed="' + !isClass + '">' + esc(t('test')) + '</button></div>') +
      '<p class="muted small">' + esc(isClass ? t('bClassRepeats', { weekday: t('weekdaysLong')[w], slot: slotLower(slot) }) : t('bTestNote')) + '</p>' +
      (subs.length ? '<div class="picks' + (isClass ? '' : ' t') + '">' + subs.map(function (x) {
        return '<button type="button" data-act="pick" data-name="' + esc(x) + '">' + esc(x) + '</button>';
      }).join('') + '</div>' : '') +
      '<form class="newsub" data-form="add"><label class="sr" for="b-newsub">' + esc(t('bNewSubject')) + '</label>' +
      '<input type="text" id="b-newsub" autocomplete="off" placeholder="' + esc(t(subs.length ? 'bNewSubject' : 'bFirstSubject')) + '"' + (subs.length ? '' : ' autofocus') + '>' +
      '<button class="btn primary" type="submit">' + esc(t('addSubject')) + '</button></form>' +
      (testOnly ? '' : '<div class="acts"><button type="button" class="btn quiet" data-act="off">' + esc(t('bMarkOff', { day: day(date) })) + '</button></div>');
    function add(name) {
      name = String(name || '').trim().replace(/\s+/g, ' ');
      if (!name) return;
      if (isClass) {
        var list = classesAt(w, slot);
        if (list.some(function (x) { return k(x) === k(name); })) { toast(t('bAlreadyThere', { subject: name })); return; }
        closeSheet();
        change(function () { autoPrio(name); list.push(name); setClasses(w, slot, list); },
          t('bClassAdded', { subject: name, weekday: t('weekdaysLong')[w], slot: slotLower(slot) }));
      } else {
        if (st().tests.some(function (x) { return x.date === date && k(x.subject) === k(name); })) { toast(t('bAlreadyThere', { subject: name })); return; }
        closeSheet();
        change(function () {
          autoPrio(name);
          st().tests.push({ id: 't' + Date.now(), subject: name, date: date, slot: slot });
        }, t('bTestAdded', { subject: name, day: day(date) }));
      }
    }
    openSheet(html, {
      mode: function (el) { openAdd(date, slot, el.getAttribute('data-mode')); },
      pick: function (el) { add(el.getAttribute('data-name')); },
      add: function (form) { add(form.querySelector('input').value); },
      off: function () { closeSheet(); toggleOff(date); }
    });
  }

  function toggleOff(date) {
    var on = st().daysOff.indexOf(date) < 0;
    change(function () {
      var s = st();
      if (on) s.daysOff.push(date); else s.daysOff = s.daysOff.filter(function (x) { return x !== date; });
    }, t(on ? 'bOffOn' : 'bOffOff', { day: day(date) }));
  }

  function openDay(date) {
    var off = st().daysOff.indexOf(date) >= 0;
    openSheet('<h2 id="sheet-title">' + esc(day(date)) + '</h2><p>' + esc(t(off ? 'bDayIsOff' : 'bDayOffAsk')) + '</p>' +
      acts([['toggle', t(off ? 'bMakeStudyDay' : 'bMarkOffShort'), 'primary'], ['close', t('confirmNo')]]),
      { toggle: function () { closeSheet(); toggleOff(date); }, close: function () { closeSheet(); } });
  }

  function highlight(sel) {
    var els = sel ? [].slice.call(document.querySelectorAll(sel)) : [];
    els.forEach(function (el) { el.classList.add('rel'); });
    return function () { els.forEach(function (el) { el.classList.remove('rel'); }); };
  }
  function cssq(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }

  function openClass(el) {
    var subject = el.getAttribute('data-subject'), date = el.getAttribute('data-date'), slot = el.getAttribute('data-slot');
    var w = S.weekday(date), wl = t('weekdaysLong')[w], prio = isPrio(subject);
    var lessonId = k(subject) + '|' + date;
    var isLesson = plan.lessons.some(function (L) { return L.id === lessonId; });
    var undoHl = highlight('.ses[data-id^="' + cssq(k(subject) + '|') + '"]');
    openSheet('<h2 id="sheet-title">' + esc(t('bClassTitle', { subject: subject })) + '</h2>' +
      '<p class="muted">' + esc(t('bEvery', { weekday: wl, slot: slotLower(slot) })) + '</p>' +
      '<p>' + esc(t(prio ? 'bClassSessions' : 'bClassNoSessions', { subject: subject })) + '</p>' +
      (isLesson ? '<label class="field" for="b-topic">' + esc(t('bLessonTopic', { day: day(date) })) +
        '<input type="text" id="b-topic" data-lesson="' + esc(lessonId) + '" value="' + esc(st().lessonNames[lessonId] || '') + '" placeholder="' + esc(t('renamePlaceholder')) + '" autocomplete="off"></label>' : '') +
      '<p class="muted small">' + esc(t(touchUI() ? 'bHoldClass' : 'bDragClass')) + '</p>' +
      acts((prio ? [] : [['prio', t('bGiveSessions', { subject: subject }), 'primary']]).concat([
        ['remove', t('bRemoveEvery', { weekday: wl }), 'danger-quiet'], ['close', t('bClose')]])), {
        prio: function () { closeSheet(); change(function () { setPrio(subject, true); }, t('bPrioOn', { subject: subject })); },
        remove: function () {
          closeSheet();
          change(function () { setClasses(w, slot, classesAt(w, slot).filter(function (x) { return k(x) !== k(subject); })); tidyPriority(); },
            t('bClassRemoved', { subject: subject, weekday: wl }));
        },
        close: function () { closeSheet(); }
      }, function () { undoHl(); if (isLesson) A.render(); });
  }

  function openTest(el) {
    var x = st().tests.filter(function (q) { return q.id === el.getAttribute('data-id'); })[0];
    if (!x) return;
    var shown = plan.tests.filter(function (q) { return q.id === x.id; })[0] || x;
    var undoHl = highlight('.ses[data-id^="' + cssq(k(x.subject) + '|') + '"]');
    openSheet('<h2 id="sheet-title">' + esc(t('bTestTitle', { subject: x.subject })) + '</h2>' +
      '<p class="muted">' + esc(day(x.date) + ', ' + slotLower(shown.slot)) + '</p>' +
      '<p>' + esc(t('bTestBody', { subject: x.subject })) + '</p>' +
      '<p class="muted small">' + esc(t(touchUI() ? 'bHoldTest' : 'bDragTest')) + '</p>' +
      acts([['remove', t('bRemoveTest'), 'danger-quiet'], ['close', t('bClose')]]), {
        remove: function () { closeSheet(); removeTest(x.id); },
        close: function () { closeSheet(); }
      }, undoHl);
  }
  function removeTest(id) {
    var x = st().tests.filter(function (q) { return q.id === id; })[0];
    if (!x) return;
    change(function () { st().tests = st().tests.filter(function (q) { return q.id !== id; }); tidyPriority(); }, t('bTestRemoved', { subject: x.subject }));
  }

  function openSession(el) {
    var hit = findBox(el.getAttribute('data-id'));
    if (!hit) return;
    var b = hit.box, done = !!st().done[b.id];
    var sel = [];
    b.parts.forEach(function (p) {
      p.lessons.forEach(function (id) { sel.push('.cls[data-key="' + cssq(p.key) + '"][data-date="' + id.split('|')[1] + '"]'); });
      if (p.test) sel.push('.test[data-id="' + cssq(p.test) + '"]');
    });
    var undoHl = highlight(sel.join(','));
    el.classList.add('sel');
    var cid = 'b-done';
    openSheet('<h2 id="sheet-title">' + esc(t('bSessionTitle', { subject: b.subject })) + '</h2>' +
      '<p class="muted">' + esc(day(hit.day.date) + ', ' + slotLower(b.slot) + (b.weight > 1 ? ' · ' + t('bCountsTwo') : '')) + '</p>' +
      '<ul>' + b.parts.map(function (p) { return '<li>' + esc(A.explain(p, plan)) + '</li>'; }).join('') + '</ul>' +
      (sel.length ? '<p class="muted small">' + esc(t('bHighlighted')) + '</p>' : '') +
      '<p><b>' + esc(t('legendRule')) + '</b></p>' +
      '<label class="done-row" for="' + cid + '"><input type="checkbox" id="' + cid + '" data-act-change="done"' + (done ? ' checked' : '') + '> ' + esc(t('bDone')) + '</label>' +
      (b.moved ? '<p class="note">' + esc(t('bYouMoved', { day: day(b.home.date), slot: slotLower(b.home.slot) })) + '</p>' : '') +
      '<p class="muted small">' + esc(t(lockKey(b) ? lockKey(b) : st().advanced ? (touchUI() ? 'bHoldSession' : 'bDragSession') : 'bSessionsFixed')) + '</p>' +
      acts((b.moved ? [['back', t('bPutBack')]] : []).concat([['close', t('bClose'), 'primary']])), {
        back: function () { closeSheet(); change(function () { delete st().moved[b.id]; }, t('bSessionBack')); },
        close: function () { closeSheet(); },
        done: function (input) {
          if (input.checked) st().done[b.id] = true; else delete st().done[b.id];
          A.save();
        }
      }, function () { undoHl(); A.render(); });
  }

  function openAdvancedWarning() {
    function li(keys) { return '<ul>' + keys.map(function (x) { return '<li>' + esc(t(x)) + '</li>'; }).join('') + '</ul>'; }
    openSheet('<h2 id="sheet-title">' + esc(t('bAdvTitle')) + '</h2>' +
      '<p>' + esc(t('bAdvIntro')) + '</p>' +
      '<h3>' + esc(t('bAdvWhyHeading')) + '</h3>' + li(['bAdvWhy1', 'bAdvWhy2', 'bAdvWhy3']) +
      '<h3>' + esc(t('bAdvIfHeading')) + '</h3>' + li(['bAdvIf1', 'bAdvIf2', 'bAdvIf3', 'bAdvIf4', 'bAdvIf5', 'bAdvIf6']) +
      '<p class="muted small">' + esc(t('bAdvRare')) + '</p>' +
      acts([['keep', t('bAdvKeep'), 'primary'], ['on', t('bAdvOn')]]), {
        keep: function () { closeSheet(); },
        on: function () { closeSheet(); change(function () { st().advanced = true; }, t('bAdvOnToast')); }
      });
  }

  function openReset() {
    openSheet('<h2 id="sheet-title">' + esc(t('startOver')) + '</h2><p>' + esc(t('startOverConfirm')) + '</p>' +
      acts([['yes', t('confirmYes'), 'danger'], ['no', t('confirmNo')]]), {
        yes: function () { closeSheet(); change(function () { A.reset(); }, t('bResetDone')); },
        no: function () { closeSheet(); }
      });
  }

  // ---------- exam season: timeline, target exam, milestones, topics ----------
  function msById(id) { return st().milestones.filter(function (m) { return m.id === id; })[0]; }
  function stopLabel(id) {
    if (id === 'target') return A.stopName({ type: st().target.type, name: st().target.name, isTarget: true });
    var m = msById(id);
    return m ? A.stopName({ id: m.id, type: m.type, name: m.name }) : '';
  }
  // One row per exam subject: Start → [topics → milestone] … → [topics → its exam day], then "+ Milestone".
  // Each part opens a sheet. A milestone shared by several subjects shows in each of their rows.
  function seasonHtml(sea) {
    var s = st(), info = {}, tg = sea.target;
    sea.milestones.forEach(function (m) { info[m.id] = m; });
    function byDate(a, b) { return a.date && b.date ? (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) : a.date ? -1 : b.date ? 1 : 0; }
    function card(id, cls, name, sub, extra) {
      var off = id === 'target' && !hasSubjects();
      if (off) extra = t('bNeedClassShort');
      return '<li class="tl-stop ' + cls + '"><button type="button" data-b="' + (id === 'target' ? 'target' : 'ms') + '" data-id="' + esc(id) + '"' + (off ? ' disabled' : '') + '>' +
        '<b>' + esc(name) + '</b><span>' + esc(sub) + '</span>' + (extra ? '<small>' + esc(extra) + '</small>' : '') + '</button></li>';
    }
    function msCard(m) {
      var x = info[m.id], name = stopLabel(m.id);
      if (!m.date) return card(m.id, 'nodate', name, t('bNoDate'));
      var late = sea.late.indexOf(x) >= 0, past = x.days <= 0;
      return card(m.id, past ? 'past' : late ? 'late' : '', name, day(m.date),
        past ? t('msPassed') : late ? t('bAfterTargetShort') : A.left(x) + (m.suggested ? ' · ' + t('bSuggested') : ''));
    }
    function examCard(subj, ts) {
      var date = tg ? tg.dateOf[k(subj)] : '';
      return card('target', 'target', stopLabel('target'), date ? day(date) : t('bNoDate'),
        ts ? A.left(ts) : tg ? t('targetPassed') : '');
    }
    function topicBtn(stopId, subj) {
      var tx = A.topicText(stopId, subj);
      return '<li class="tl-topic"><button type="button" data-b="topic" data-id="' + esc(stopId) + '" data-subject="' + esc(subj) + '"' +
        ' aria-label="' + esc(t('bTopicsFor', { subject: subj, stop: stopId === 'target' ? stopLabel('target') : stopLabel(stopId) })) + '">' +
        (tx ? '<span>' + esc(tx) + '</span>' : '<small>' + esc(t('bAddTopics')) + '</small>') + '</button></li>';
    }
    function row(label, items, subj) {
      return '<div class="tl-row"><div class="tl-subj">' + esc(label) + '</div><ol class="tl">' +
        '<li class="tl-start"><b>' + esc(t('printStart')) + '</b><span>' + esc(day(s.start)) + '</span></li>' + items +
        (subj ? '<li class="tl-add"><button type="button" data-b="addms" data-subject="' + esc(subj) + '">' + esc(t('bAddMilestone')) + '</button></li>' : '') +
        '</ol></div>';
    }
    var html = '';
    sea.tracks.forEach(function (tr) {
      var mine = s.milestones.filter(function (m) { return hasSub(m.subjects, tr.subject); }).sort(byDate);
      var inTrack = {};
      tr.stops.forEach(function (x) { inTrack[x.stop.id] = true; });
      var past = mine.filter(function (m) { return info[m.id] && info[m.id].days <= 0; });
      var items = past.map(msCard).join('');
      var target = null;
      tr.stops.forEach(function (x) {
        if (x.stop.isTarget) { target = x.stop; return; }
        items += topicBtn(x.stop.id, tr.subject) + msCard(msById(x.stop.id));
      });
      // Not on the way to this exam: no date yet, or on/after the exam day.
      items += mine.filter(function (m) { return !inTrack[m.id] && past.indexOf(m) < 0; }).map(msCard).join('');
      items += (target ? topicBtn('target', tr.subject) : '') + examCard(tr.subject, target);
      html += row(tr.subject, items, tr.subject);
    });
    if (!sea.tracks.length) html += row(t('bNoExamSubjects'), examCard('', null), '');
    // Milestones that belong to none of the exam's subjects (their subjects were removed).
    var loose = s.milestones.filter(function (m) { return !sea.subjects.some(function (x) { return hasSub(m.subjects, x); }); });
    if (loose.length && sea.tracks.length) html += row(t('bNoSubjectRow'), loose.sort(byDate).map(msCard).join(''), '');
    return '<section class="season" aria-label="' + esc(t('timelineHeading')) + '">' + html + '</section>';
  }

  // The sheet is drawn again after each change, keeping the focus on the same field.
  function reopen(fn) {
    var id = document.activeElement && document.activeElement.id;
    fn();
    var el = id && document.getElementById(id);
    if (el && sheetRoot.contains(el)) el.focus();
  }
  function selectHtml(id, act, prefix, values, sel) {
    return '<select id="' + id + '" data-act-change="' + act + '">' + values.map(function (v) {
      return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + esc(t(prefix + v)) + '</option>';
    }).join('') + '</select>';
  }

  // The target exam's subjects come from classes, so it can't be set before there is one.
  function hasSubjects() { return S.subjectsInTimetable(st().timetable).length > 0 || st().target.subjects.length > 0; }
  function openStop(id) { if (id === 'target') openTarget(); else openMilestone(id); }

  function openTarget() {
    var s = st(), tg = s.target, sea = A.buildSeason();
    var pool = S.uniqueSubjects(S.subjectsInTimetable(s.timetable).concat(tg.subjects));
    var status = !tg.date ? t('targetNoDate') : sea.target.days <= 0 ? t('targetPassed') : A.left(sea.target);
    var again = function () { reopen(openTarget); };
    openSheet('<h2 id="sheet-title">' + esc(t('targetHeading')) + '</h2>' +
      '<div class="exam-fields">' +
      '<label class="field" for="b-tg-type">' + esc(t('targetType')) + selectHtml('b-tg-type', 'tgtype', 'tgType_', ['national', 'session', 'other'], tg.type) + '</label>' +
      (tg.type === 'other' ? '<label class="field" for="b-tg-name">' + esc(t('examName')) + '<input type="text" id="b-tg-name" data-act-change="tgname" value="' +
        esc(tg.name) + '" placeholder="' + esc(t('examNamePlaceholder')) + '" autocomplete="off"></label>' : '') +
      '<label class="field" for="b-tg-date">' + esc(t('bFirstExamDay')) + '<input type="date" id="b-tg-date" data-act-change="tgdate" min="' + esc(s.start) + '" value="' + esc(tg.date) + '"></label>' +
      '</div><p class="' + (tg.date && sea.target.days > 0 ? 'muted small' : 'warn') + '">' + esc(status) + '</p>' +
      '<h3>' + esc(t('targetSubjects')) + '</h3>' + (pool.length ? '<p class="muted small">' + esc(t('bTargetSubjectsHint')) + '</p>' : '') +
      (pool.length ? '<div class="chips">' + pool.map(function (x) {
        return '<button type="button" class="chip-btn" data-act="tsub" data-subject="' + esc(x) + '" aria-pressed="' + hasSub(tg.subjects, x) + '">' + esc(x) + '</button>';
      }).join('') + '</div>' : '<p class="note">' + esc(t('bTargetNoClasses')) + '</p>') +
      (tg.date && sea.target && sea.subjects.length ? '<h3>' + esc(t('bExamDays')) + '</h3><p class="muted small">' + esc(t('bExamDaysHint')) + '</p>' +
        '<div class="exam-days">' + sea.subjects.map(function (x) {
          var fid = 'b-sd-' + k(x).replace(/[^\w-]/g, '_');
          return '<label class="field" for="' + esc(fid) + '">' + esc(x) + '<input type="date" id="' + esc(fid) + '" data-act-change="sdate" data-key="' +
            esc(k(x)) + '" min="' + esc(s.start) + '" value="' + esc(sea.target.dateOf[k(x)]) + '"></label>';
        }).join('') + '</div>' : '') +
      acts([['close', t('bClose'), 'primary']]), {
        sdate: function (el) {
          var key = el.getAttribute('data-key'), v = el.value;
          change(function () {
            tg.subjectDates = tg.subjectDates || {};
            if (!v || v === tg.date) delete tg.subjectDates[key]; else tg.subjectDates[key] = v;
            A.suggestDates();
          });
          again();
        },
        tgtype: function (el) { change(function () { tg.type = el.value; A.defaultMilestones(); }); again(); },
        tgname: function (el) { change(function () { tg.name = el.value; }); again(); },
        tgdate: function (el) { if (!el.value) return; change(function () { tg.date = el.value; A.suggestDates(); }); again(); },
        tsub: function (el) { var x = el.getAttribute('data-subject'); change(function () { setPrio(x, !hasSub(tg.subjects, x)); }); again(); },
        close: function () { closeSheet(); }
      });
  }

  function openMilestone(id) {
    var s = st(), m = msById(id), sea = A.buildSeason();
    if (!m) return;
    var x = sea.milestones.filter(function (q) { return q.id === id; })[0];
    var status = !m.date ? t(s.target.date ? 'msNoDate' : 'msNoDateYet')
      : x.days <= 0 ? t('msPassed')
      : sea.target && m.date >= sea.target.date ? t('msAfterTarget')
      : m.suggested ? A.left(x) + '. ' + t('msSuggested') : A.left(x);
    var subs = A.chosen();
    var again = function () { if (msById(id)) reopen(function () { openMilestone(id); }); else closeSheet(); };
    openSheet('<h2 id="sheet-title">' + esc(stopLabel(id)) + '</h2>' +
      '<div class="exam-fields">' +
      '<label class="field" for="b-ms-type">' + esc(t('milestoneType')) + selectHtml('b-ms-type', 'mstype', 'msType_', ['mock', 'midterm', 'session', 'other'], m.type) + '</label>' +
      (m.type === 'other' ? '<label class="field" for="b-ms-name">' + esc(t('examName')) + '<input type="text" id="b-ms-name" data-act-change="msname" value="' +
        esc(m.name) + '" placeholder="' + esc(t('examNamePlaceholder')) + '" autocomplete="off"></label>' : '') +
      '<label class="field" for="b-ms-date">' + esc(t('examDate')) + '<input type="date" id="b-ms-date" data-act-change="msdate" value="' + esc(m.date) + '"></label>' +
      '</div><p class="' + (m.suggested ? 'note' : 'muted small') + '">' + esc(status) + '</p>' +
      '<h3>' + esc(t('milestoneSubjects')) + '</h3>' +
      (subs.length ? '<div class="chips">' + subs.map(function (q) {
        return '<button type="button" class="chip-btn" data-act="msub" data-subject="' + esc(q) + '" aria-pressed="' + hasSub(m.subjects, q) + '">' + esc(q) + '</button>';
      }).join('') + '</div>' : '<p class="muted small">' + esc(t('bPickTargetFirst')) + '</p>') +
      '<p class="muted small">' + esc(t(touchUI() ? 'bHoldStop' : 'bDragStop')) + '</p>' +
      acts([['remove', t('bRemoveMilestone'), 'danger-quiet'], ['close', t('bClose'), 'primary']]), {
        mstype: function (el) { change(function () { m.type = el.value; }); again(); },
        msname: function (el) { change(function () { m.name = el.value; }); again(); },
        msdate: function (el) { change(function () { m.date = el.value; m.suggested = false; A.suggestDates(); }); again(); },
        msub: function (el) { var q = el.getAttribute('data-subject'); change(function () { m.subjects = toggleSub(m.subjects || [], q); A.suggestDates(); }); again(); },
        remove: function () {
          var name = stopLabel(id);
          closeSheet();
          change(function () { st().milestones = st().milestones.filter(function (q) { return q.id !== id; }); A.suggestDates(); }, t('bMsRemoved', { name: name }));
        },
        close: function () { closeSheet(); }
      });
  }

  // A new milestone for one exam subject (its row's "+ Milestone").
  function addMilestone(subject) {
    var m = A.newMilestone(st().target.type === 'session' ? 'midterm' : 'mock', subject);
    change(function () { st().milestones.push(m); A.suggestDates(); });
    openMilestone(m.id);
  }

  // Topics for one subject, for the stretch that ends at a milestone (or at its exam day).
  function openTopic(stopId, subject) {
    var sea = A.buildSeason();
    var tr = sea.tracks.filter(function (x) { return x.key === k(subject); })[0];
    var seg = tr && tr.stops.filter(function (x) { return x.stop.id === stopId; })[0];
    if (!seg) return;
    var name = stopId === 'target' ? stopLabel('target') : stopLabel(stopId);
    openSheet('<h2 id="sheet-title">' + esc(t('bTopicsTitle', { subject: subject, stop: name })) + '</h2>' +
      '<p class="muted">' + esc(day(seg.from) + ' – ' + day(seg.stop.date)) + '</p>' +
      '<p>' + esc(t('bTopicsBody')) + '</p>' +
      '<label class="field" for="b-topic-in">' + esc(t('bTopicsLabel')) +
      '<input type="text" id="b-topic-in" data-topic="' + esc(stopId) + '|' + esc(k(subject)) + '" value="' + esc(A.topicText(stopId, subject)) +
      '" placeholder="' + esc(t('topicsPlaceholder')) + '" autocomplete="off" autofocus></label>' +
      acts([['close', t('bClose'), 'primary']]), { close: function () { closeSheet(); } }, function () { A.render(); });
  }

  // ---------- toast ----------
  var toastTimer;
  function toast(msg, o) {
    o = o || {};
    clearTimeout(toastTimer);
    toastRoot.innerHTML = '<div class="toast' + (o.warn ? ' warn' : '') + '"><span>' + esc(msg) + '</span>' +
      (o.undo ? '<button type="button" data-toast-undo>' + esc(t('bUndo')) + '</button>' : '') + '</div>';
    toastTimer = setTimeout(function () { toastRoot.innerHTML = ''; }, o.warn ? 7000 : 4500);
  }

  // ---------- drag and drop (mouse: drag; touch: hold, then drag) ----------
  var drag = null, ghost = null, overCell = null, scrollV = 0, rafId = 0;
  function onPointerDown(e) {
    var el = e.target.closest('.board [data-drag]');
    if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { el: el, kind: el.getAttribute('data-drag'), pid: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', active: false };
    if (drag.touch) drag.timer = setTimeout(function () { startDrag(drag.x, drag.y); }, 380);
  }
  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pid || drag.dead) return;
    var dist = Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
    if (!drag.active) {
      if (drag.touch) { if (dist > 10) { clearTimeout(drag.timer); drag = null; } return; }
      if (dist < 6) return;
      startDrag(e.clientX, e.clientY);
      if (!drag || !drag.active) return;
    }
    drag.x = e.clientX; drag.y = e.clientY;
    moveGhost();
  }
  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    clearTimeout(drag.timer);
    if (drag.active) finishDrag(true);
    // The click that follows a drag must not open a sheet. It comes right after pointerup, before any timer.
    if (drag.active || drag.dead) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 0); }
    drag = null;
  }
  function onPointerCancel() {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.active) finishDrag(false);
    drag = null;
  }
  function startDrag(x, y) {
    if (!drag) return;
    if (drag.kind === 'session') {
      var hitL = findBox(drag.el.getAttribute('data-id'));
      var locked = !st().advanced ? 'bSessionsLocked' : hitL ? lockKey(hitL.box) : '';
      if (locked) { toast(t(locked)); drag.dead = true; return; }
    }
    drag.active = true;
    var r = drag.el.getBoundingClientRect();
    drag.dx = x - r.left; drag.dy = y - r.top;
    ghost = drag.el.cloneNode(true);
    ghost.classList.add('ghost'); ghost.classList.remove('pop', 'sel', 'rel');
    ghost.style.width = r.width + 'px';
    document.body.appendChild(ghost);
    drag.el.classList.add('dragging');
    document.body.classList.add('is-dragging');
    try { if (drag.touch && navigator.vibrate) navigator.vibrate(12); } catch (err) { /* not allowed */ }
    moveGhost();
    rafId = requestAnimationFrame(autoScroll);
  }
  function moveGhost() {
    ghost.style.left = (drag.x - drag.dx) + 'px';
    ghost.style.top = (drag.y - drag.dy) + 'px';
    var under = document.elementFromPoint(drag.x, drag.y);
    var cell = under && under.closest('[data-cell]');
    if (cell !== overCell) {
      if (overCell) overCell.classList.remove('drop-ok', 'drop-no');
      overCell = cell;
      if (cell) cell.classList.add(dropCheck(cell).ok ? 'drop-ok' : 'drop-no');
    }
    var edge = 80, h = window.innerHeight;
    scrollV = drag.y < edge ? -Math.ceil((edge - drag.y) / 5) : drag.y > h - edge ? Math.ceil((drag.y - (h - edge)) / 5) : 0;
  }
  function autoScroll() {
    if (!drag || !drag.active) return;
    if (scrollV) { window.scrollBy(0, scrollV); moveGhost(); }
    rafId = requestAnimationFrame(autoScroll);
  }
  function dropCheck(cell) {
    var ok = cell && cell.getAttribute('data-ok');
    if (!ok || (ok === 'test' && drag.kind !== 'test')) return { ok: false };
    var date = cell.getAttribute('data-date'), slot = cell.getAttribute('data-slot');
    if (drag.kind === 'session') {
      var hit = findBox(drag.el.getAttribute('data-id')), d = dayByDate(date);
      if (!hit) return { ok: false };
      if (d.i >= hit.box.bound) return { ok: false, why: t('bDropAfterTest', { subject: hit.box.subject }) };
      var lastLesson = -1;
      hit.box.parts.forEach(function (p) {
        p.lessons.forEach(function (id) { plan.lessons.forEach(function (L) { if (L.id === id) lastLesson = Math.max(lastLesson, L.day); }); });
      });
      if (d.i <= lastLesson) return { ok: false, why: t('bDropBeforeLesson') };
      if (hit.box.parts.some(function (p) { return p.after != null && d.i <= p.after; })) return { ok: false, why: t('bDropBeforeExam') };
    }
    return { ok: true, date: date, slot: slot };
  }
  function finishDrag(drop) {
    cancelAnimationFrame(rafId);
    var cell = overCell, kind = drag.kind, el = drag.el;
    if (overCell) overCell.classList.remove('drop-ok', 'drop-no');
    overCell = null;
    if (ghost) ghost.remove();
    ghost = null;
    el.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    if (!drop || !cell) return;
    var c = dropCheck(cell);
    if (!c.ok) { if (c.why) toast(c.why, { warn: true }); return; }
    if (kind === 'class') {
      var subject = el.getAttribute('data-subject'), w1 = S.weekday(el.getAttribute('data-date')), s1 = el.getAttribute('data-slot');
      var w2 = S.weekday(c.date), s2 = c.slot;
      if (w1 === w2 && s1 === s2) return;
      if (classesAt(w2, s2).some(function (x) { return k(x) === k(subject); })) { toast(t('bAlreadyThere', { subject: subject })); return; }
      change(function () {
        setClasses(w1, s1, classesAt(w1, s1).filter(function (x) { return k(x) !== k(subject); }));
        setClasses(w2, s2, classesAt(w2, s2).concat([subject]));
      }, t('bClassMoved', { subject: subject, weekday: t('weekdaysLong')[w2], slot: slotLower(s2) }));
    } else if (kind === 'test' && el.hasAttribute('data-stop')) {
      var sid = el.getAttribute('data-stop');
      change(function () {
        // A target exam chip is one subject's exam day: moving it moves only that subject.
        if (sid === 'target') {
          var tg = st().target, key = el.getAttribute('data-id').split('|')[1];
          tg.subjectDates = tg.subjectDates || {};
          if (c.date === tg.date) delete tg.subjectDates[key]; else tg.subjectDates[key] = c.date;
        }
        else st().milestones.forEach(function (m) { if (m.id === sid) { m.date = c.date; m.suggested = false; } });
        A.suggestDates();
      }, t('bStopMoved', { name: stopLabel(sid) + (sid === 'target' ? ': ' + el.innerText.split(': ').slice(1).join(': ') : ''), day: day(c.date) }));
    } else if (kind === 'test') {
      var id = el.getAttribute('data-id');
      change(function () { st().tests.forEach(function (x) { if (x.id === id) { x.date = c.date; x.slot = c.slot; } }); }, t('bTestMoved', { day: day(c.date) }));
    } else {
      var hit = findBox(el.getAttribute('data-id'));
      if (!hit) return;
      var b = hit.box, to = dayByDate(c.date);
      if (to.date === hit.day.date && c.slot === b.slot) return;
      var back = to.date === b.home.date && c.slot === b.home.slot;
      var msgs = [];
      if (!back && to.i < b.home.day) msgs.push(t('bDropEarlier'));
      if (to.date !== hit.day.date && to.load + b.weight > S.DAILY_CAP) msgs.push(t('bDropOver', { day: day(to.date) }));
      change(function () {
        if (back) delete st().moved[b.id]; else st().moved[b.id] = { date: c.date, slot: c.slot };
      }, back ? t('bSessionBack') : msgs.length ? msgs.join(' ') : t('bSessionMoved', { day: day(c.date) }), msgs.length > 0);
    }
  }

  // ---------- events ----------
  function init(api) {
    A = api;
    sheetRoot = document.createElement('div'); sheetRoot.id = 'sheet-root';
    toastRoot = document.createElement('div'); toastRoot.id = 'toast-root'; toastRoot.setAttribute('aria-live', 'polite');
    document.body.appendChild(sheetRoot); document.body.appendChild(toastRoot);
    var app = A.root;

    app.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('touchmove', function (e) { if (drag && drag.active) e.preventDefault(); }, { passive: false });
    app.addEventListener('contextmenu', function (e) { if (e.target.closest('.board [data-drag]')) e.preventDefault(); });

    app.addEventListener('click', function (e) {
      if (!e.target.closest('.board-page')) return;
      if (suppressClick) { suppressClick = false; return; }
      var chip = e.target.closest('[data-drag]');
      if (chip) {
        var kind = chip.getAttribute('data-drag');
        if (kind === 'class') openClass(chip);
        else if (kind === 'test') { if (chip.hasAttribute('data-stop')) openStop(chip.getAttribute('data-stop')); else openTest(chip); }
        else openSession(chip);
        return;
      }
      var dh = e.target.closest('[data-dayhead]');
      if (dh) { openDay(dh.getAttribute('data-dayhead')); return; }
      var cell = e.target.closest('[data-cell]');
      if (cell && cell.hasAttribute('data-ok')) { openAdd(cell.getAttribute('data-date'), cell.getAttribute('data-slot')); return; }
      var b = e.target.closest('[data-b]');
      if (!b) return;
      var a = b.getAttribute('data-b');
      if (a === 'undo') undo();
      else if (a === 'adv') {
        if (st().advanced) change(function () { st().advanced = false; }, t('bAdvOffToast'));
        else openAdvancedWarning();
      }
      else if (a === 'advoff') change(function () { st().advanced = false; }, t('bAdvOffToast'));
      else if (a === 'putall') change(function () { st().moved = {}; }, t('bAllBack'));
      else if (a === 'example') change(function () { A.example(); }, t('bExampleLoaded'));
      else if (a === 'reset') openReset();
      else if (a === 'rmtest') removeTest(b.getAttribute('data-id'));
      else if (a === 'prio') {
        var name = b.getAttribute('data-subject'), on = !isPrio(name);
        change(function () { setPrio(name, on); }, t(on ? 'bPrioOn' : 'bPrioOff', { subject: name }));
      }
      else if (a === 'target') openStop('target');
      else if (a === 'ms') openStop(b.getAttribute('data-id'));
      else if (a === 'topic') openTopic(b.getAttribute('data-id'), b.getAttribute('data-subject'));
      else if (a === 'addms') addMilestone(b.getAttribute('data-subject'));
    });
    app.addEventListener('change', function (e) {
      var el = e.target;
      if (!el.hasAttribute('data-b-start')) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(el.value)) return;
      change(function () { st().start = el.value; st().moved = {}; if (season()) A.suggestDates(); }, t('bStartChanged', { day: day(el.value) }));
    });

    sheetRoot.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-scrim')) { closeSheet(); return; }
      var a = e.target.closest('[data-act]');
      if (a && sheetHandlers[a.getAttribute('data-act')]) sheetHandlers[a.getAttribute('data-act')](a);
    });
    sheetRoot.addEventListener('change', function (e) {
      var a = e.target.getAttribute('data-act-change');
      if (a && sheetHandlers[a]) sheetHandlers[a](e.target);
    });
    sheetRoot.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target.getAttribute('data-form');
      if (f && sheetHandlers[f]) sheetHandlers[f](e.target);
    });
    sheetRoot.addEventListener('input', function (e) {
      var el = e.target;
      if (el.hasAttribute('data-topic')) {
        var tp = el.getAttribute('data-topic').split('|'), tps = st().topics;
        tps[tp[0]] = tps[tp[0]] || {};
        if (el.value.trim()) tps[tp[0]][tp[1]] = el.value; else delete tps[tp[0]][tp[1]];
        A.save();
        return;
      }
      if (!el.hasAttribute('data-lesson')) return;
      var id = el.getAttribute('data-lesson');
      if (el.value.trim()) st().lessonNames[id] = el.value; else delete st().lessonNames[id];
      A.save();
    });
    toastRoot.addEventListener('click', function (e) { if (e.target.closest('[data-toast-undo]')) undo(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheetRoot.innerHTML) { closeSheet(); return; }
      var tag = document.activeElement && document.activeElement.tagName;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && tag !== 'INPUT' && tag !== 'TEXTAREA' &&
        !sheetRoot.innerHTML && A.root.querySelector('.board')) { e.preventDefault(); undo(); }
    });
  }
})();

/*
 * The step-by-step page. State lives only in this browser (localStorage); nothing is sent anywhere.
 */
(function () {
  'use strict';
  var S = window.Schedule, R = window.Render, STR = window.STRINGS;
  var KEY = 'charte-review-calendar-v1';
  // Each mode has its own steps: [label key, view].
  var STEPS = {
    two: [['step1', viewStart], ['step2', viewClasses], ['step3', viewSubjects], ['step4', viewTests], ['step5', viewOff], ['step6', viewCalendar]],
    season: [['step1', viewStart], ['step2', viewClasses], ['stepExams', viewExams], ['stepTopics', viewTopics], ['step5', viewOff], ['stepMap', viewMap], ['stepPeriod', viewCalendar]]
  };
  function steps() { return STEPS[state.mode] || STEPS.two; }
  function season() { return state.mode === 'season'; }
  var app = document.getElementById('app');
  var measure = R.measurer();
  var ui = { confirmReset: false, flash: '', status: '' };

  function fresh() {
    var tt = {};
    for (var w = 0; w < 7; w++) tt[w] = { m: '', a: '', e: '' };
    return { v: 1, lang: 'ka', step: 0, start: S.todayIso(), timetable: tt, priority: [], tests: [], daysOff: [],
      lessonNames: {}, done: {}, name: '', view: 'list',
      // exam season mode
      mode: 'two', target: { type: 'national', name: '', date: '', subjects: [] }, milestones: [], topics: {}, mapView: 'list' };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) return Object.assign(fresh(), s);
    } catch (e) { /* storage blocked or empty */ }
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  var state = load() || fresh();

  function t(key, vars) {
    var L = STR[state.lang] || {};
    var s = Object.prototype.hasOwnProperty.call(L, key) ? L[key] : STR.en[key];
    if (s == null) return key;
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---------- dates ----------
  function dm(iso) { var p = iso.split('-'); return +p[2] + '.' + p[1]; }
  function wd(iso) { return t('weekdaysShort')[S.weekday(iso)]; }
  function dayLabel(iso) { return wd(iso) + ' ' + dm(iso); }
  function lessonDate(id) { return id.split('|')[1]; }
  function lessonLabel(id) { return (state.lessonNames[id] || '').trim() || dm(lessonDate(id)); }

  // ---------- plan ----------
  // Exam season: the period calendar (null until there is an exam date). Otherwise the 2-week plan.
  function plan() { return season() ? S.buildPeriod(state) : S.buildPlan(state); }
  function renderOpts(p, blank) {
    return {
      plan: blank ? null : p, t: t, name: blank ? '' : state.name,
      range: p ? dayLabel(p.days[0].date) + ' – ' + dayLabel(p.days[p.days.length - 1].date) : '',
      fmtDay: function (iso) { return { wd: wd(iso), dm: dm(iso) }; },
      lessonLabel: lessonLabel
    };
  }
  // The period calendar is printed 2 weeks per A4 page.
  function pageOpts(p) {
    var weeks = p.days.length / 7, total = Math.ceil(weeks / 2), out = [];
    for (var n = 0; n < total; n++) {
      var o = renderOpts(p, false), from = n * 2, w = Math.min(2, weeks - from);
      o.page = { from: from, weeks: w, n: n + 1, total: total };
      o.season = true;
      o.title = t('printPeriodTitle');
      o.range = dayLabel(p.days[from * 7].date) + ' – ' + dayLabel(p.days[(from + w) * 7 - 1].date) +
        (total > 1 ? '  ·  ' + t('printPage', { n: n + 1, total: total }) : '');
      o.testLabel = testLabel;
      out.push(o);
    }
    return out;
  }
  function testLabel(x) {
    return (x.stop ? stopName(x.stop).toLocaleUpperCase() : t('printTest')) + ': ' + x.subject;
  }
  function stopDayName(x) { return x.stop ? stopName(x.stop) + ' ' + dayLabel(x.date) : dayLabel(x.date); }

  // ---------- views ----------
  function render() {
    document.documentElement.lang = state.lang;
    var list = steps(), last = list.length - 1;
    if (!(state.step >= 0 && state.step <= last)) state.step = 0;
    var step = state.step;
    var fn = list[step][1];
    var wide = (fn === viewCalendar && state.view === 'grid') || (fn === viewMap && state.mapView === 'grid');
    var html = '<div class="page' + (wide ? ' wide' : '') + '">' +
      '<header class="top"><div class="brand"><h1>' + esc(t('appTitle')) + '</h1><p>' + esc(t('tagline')) + '</p></div>' +
      '<div class="lang" role="group" aria-label="' + esc(t('langLabel')) + '">' +
      '<button type="button" data-action="lang" data-lang="ka" aria-pressed="' + (state.lang === 'ka') + '">ქართ</button>' +
      '<button type="button" data-action="lang" data-lang="en" aria-pressed="' + (state.lang === 'en') + '">EN</button></div></header>' +
      '<nav aria-label="' + esc(t('stepOf', { n: step + 1, total: list.length })) + '"><ol class="steps">' +
      list.map(function (s, i) {
        var k = s[0];
        return '<li><button type="button" data-action="go" data-step="' + i + '"' + (i === step ? ' aria-current="step"' : '') +
          (i < step ? ' class="done"' : '') + '><span class="n">' + (i + 1) + '</span><span class="lbl">' + esc(t(k)) + '</span></button></li>';
      }).join('') + '</ol></nav>' +
      list[step][1]() +
      '<div class="nav">' +
      (step > 0 ? '<button type="button" class="btn" data-action="go" data-step="' + (step - 1) + '">' + esc(t('back')) + '</button>' : '<span></span>') +
      (step < last ? '<button type="button" class="btn primary" data-action="go" data-step="' + (step + 1) + '">' +
        esc(t(nextLabel(list[step + 1][1]))) + '</button>' : '') +
      '</div></div>';
    app.innerHTML = html;
  }

  function nextLabel(view) {
    return view === viewMap ? 'showSeasonMap' : view === viewCalendar ? (season() ? 'showPeriod' : 'showCalendar') : 'next';
  }

  function why(key) { return '<details class="why"><summary>' + esc(t('why')) + '</summary><p>' + esc(t(key)) + '</p></details>'; }

  function viewStart() {
    var mode = '<div class="mode" role="group" aria-label="' + esc(t('modeLabel')) + '"><span class="lbl">' + esc(t('modeLabel')) + '</span>' +
      '<div class="view-toggle">' +
      '<button type="button" data-action="mode" data-mode="two" aria-pressed="' + !season() + '">' + esc(t('modeTwo')) + '</button>' +
      '<button type="button" data-action="mode" data-mode="season" aria-pressed="' + season() + '">' + esc(t('modeSeason')) + '</button></div></div>';
    return '<section class="panel">' + mode + '<h2>' + esc(t(season() ? 'seasonStartHeading' : 'startHeading')) + '</h2><p>' + esc(t(season() ? 'seasonStartBody' : 'startBody')) + '</p>' +
      '<div class="frame">' +
      '<div><b>' + esc(t('frameLearn')) + '</b><span>' + esc(t('frameLearnWhen')) + '</span></div>' +
      '<div class="recall"><b>' + esc(t('frameRecall')) + '</b><span>' + esc(t('frameRecallWhen')) + '</span></div>' +
      '<div><b>' + esc(t('frameFix')) + '</b><span>' + esc(t('frameFixWhen')) + '</span></div></div>' +
      why('whyStart') +
      '<label class="field" for="start">' + esc(t('startDate')) +
      '<input type="date" id="start" data-field="start" value="' + esc(state.start) + '">' +
      '<span class="hint">' + esc(t(season() ? 'seasonStartDateHint' : 'startDateHint')) + '</span></label>' +
      (ui.flash ? '<p class="note">' + esc(ui.flash) + '</p>' : '') +
      '<div class="row"><button type="button" class="btn" data-action="example">' + esc(t('loadExample')) + '</button>' +
      (ui.confirmReset
        ? '<span class="confirm"><span>' + esc(t('startOverConfirm')) + '</span><button type="button" class="btn danger" data-action="reset-yes">' +
          esc(t('confirmYes')) + '</button><button type="button" class="btn" data-action="reset-no">' + esc(t('confirmNo')) + '</button></span>'
        : '<button type="button" class="btn quiet" data-action="reset">' + esc(t('startOver')) + '</button>') +
      '</div></section>';
  }

  function viewClasses() {
    var names = t('weekdaysLong');
    var rows = '';
    for (var w = 0; w < 7; w++) {
      rows += '<div class="tt-row"><span class="wd">' + esc(names[w]) + '</span>' + ['m', 'a', 'e'].map(function (slot) {
        var id = 'tt-' + w + '-' + slot;
        return '<label for="' + id + '"><span class="lbl">' + esc(t('slot_' + slot)) + '</span>' +
          '<input type="text" id="' + id + '" data-tt="' + w + ',' + slot + '" value="' + esc(state.timetable[w][slot]) +
          '" placeholder="' + esc(t('classesPlaceholder')) + '" autocomplete="off"></label>';
      }).join('') + '</div>';
    }
    return '<section class="panel"><h2>' + esc(t('classesHeading')) + '</h2><p>' + esc(t('classesBody')) + '</p>' +
      '<p class="muted small">' + esc(t(season() ? 'seasonClassesRepeat' : 'classesRepeat')) + '</p>' +
      '<div class="tt"><div class="tt-head"><span></span><span>' + esc(t('slot_m')) + '</span><span>' + esc(t('slot_a')) +
      '</span><span>' + esc(t('slot_e')) + '</span></div>' + rows + '</div></section>';
  }

  function chosen() {
    if (season()) return S.uniqueSubjects(state.target.subjects);
    var all = S.subjectsInTimetable(state.timetable).map(S.subjectKey);
    return state.priority.filter(function (s) { return all.indexOf(S.subjectKey(s)) >= 0; });
  }

  function viewSubjects() {
    var subjects = S.subjectsInTimetable(state.timetable);
    var pk = state.priority.map(S.subjectKey);
    var n = chosen().length;
    return '<section class="panel"><h2>' + esc(t('subjectsHeading')) + '</h2><p>' + esc(t('subjectsBody')) + '</p>' +
      (subjects.length
        ? '<div class="chips">' + subjects.map(function (s) {
            return '<button type="button" class="chip-btn" data-action="subject" data-subject="' + esc(s) + '" aria-pressed="' +
              (pk.indexOf(S.subjectKey(s)) >= 0) + '">' + esc(s) + '</button>';
          }).join('') + '</div><p class="muted small">' + esc(t('subjectsChosen', { n: n })) + '</p>'
        : '<p class="note">' + esc(t('subjectsNone')) + '</p>') +
      (n > 3 ? '<p class="warn">' + esc(t('subjectsTooMany', { n: n })) + '</p>' : '') +
      why('whySubjects') + '</section>';
  }

  function viewTests() {
    var pri = chosen();
    var others = S.subjectsInTimetable(state.timetable).filter(function (s) {
      return pri.map(S.subjectKey).indexOf(S.subjectKey(s)) < 0;
    });
    function options(sel) {
      var o = '<option value="">' + esc(t('pickSubject')) + '</option>';
      o += pri.map(function (s) { return '<option' + (S.subjectKey(s) === S.subjectKey(sel) ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
      if (others.length) {
        o += '<optgroup label="' + esc(t('otherSubjects')) + '">' + others.map(function (s) {
          return '<option' + (S.subjectKey(s) === S.subjectKey(sel) ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('') + '</optgroup>';
      }
      return o;
    }
    var rows = state.tests.map(function (x) {
      var id = esc(x.id);
      return '<div class="test-row">' +
        '<label class="field" for="ts-' + id + '">' + esc(t('testSubject')) + '<select id="ts-' + id + '" data-test="' + id + '" data-key="subject">' + options(x.subject) + '</select></label>' +
        '<label class="field" for="td-' + id + '">' + esc(t('testDate')) + '<input type="date" id="td-' + id + '" data-test="' + id + '" data-key="date" min="' + esc(state.start) + '" value="' + esc(x.date) + '"></label>' +
        '<label class="field" for="tl-' + id + '">' + esc(t('testSlot')) + '<select id="tl-' + id + '" data-test="' + id + '" data-key="slot">' +
        ['auto', 'm', 'a', 'e'].map(function (s) {
          return '<option value="' + s + '"' + (x.slot === s ? ' selected' : '') + '>' + esc(s === 'auto' ? t('testSlotAuto') : t('slot_' + s)) + '</option>';
        }).join('') + '</select></label>' +
        '<button type="button" class="btn quiet" data-action="remove-test" data-id="' + id + '">' + esc(t('removeTest')) + '</button></div>';
    }).join('');
    return '<section class="panel">' + (season() ? '<h3>' + esc(t('classTestsHeading')) + '</h3><p>' + esc(t('classTestsBody')) + '</p>'
        : '<h2>' + esc(t('testsHeading')) + '</h2><p>' + esc(t('testsBody')) + '</p>') +
      (rows || '<p class="muted">' + esc(t('testsEmpty')) + '</p>') +
      '<div><button type="button" class="btn" data-action="add-test">' + esc(t('addTest')) + '</button></div>' +
      why('whyTests') + '</section>';
  }

  function viewOff() {
    var cells = '';
    var monday = S.mondayOf(state.start), first = S.dayDiff(monday, state.start), end = first + S.HORIZON;
    if (season()) {
      var per = S.buildSeason(state).period;
      end = first + (per ? S.dayDiff(state.start, per.last) + 1 : S.HORIZON);
    }
    for (var i = 0; i < Math.ceil(end / 7) * 7; i++) {
      var d = S.addDays(monday, i);
      cells += i < first || i >= end
        ? '<span class="chip-btn outside" aria-hidden="true"><small>' + esc(wd(d)) + '</small>' + esc(dm(d)) + '</span>'
        : '<button type="button" class="chip-btn" data-action="off" data-date="' + d + '" aria-pressed="' + (state.daysOff.indexOf(d) >= 0) + '">' +
          '<small>' + esc(wd(d)) + '</small>' + esc(dm(d)) + '</button>';
    }
    var n = state.daysOff.filter(function (d) { var k = S.dayDiff(monday, d); return k >= first && k < end; }).length;
    return '<section class="panel"><h2>' + esc(t('offHeading')) + '</h2><p>' + esc(t('offBody')) + '</p>' +
      '<div class="offs">' + cells + '</div><p class="muted small">' + esc(t('offCount', { n: n })) + '</p></section>';
  }

  function explain(part, p) {
    var lessonD = part.lessons[0] ? dayLabel(lessonDate(part.lessons[0])) : '';
    var test = part.test ? p.tests.filter(function (x) { return x.id === part.test; })[0] : null;
    var s = t('kind_' + part.kind, { date: lessonD, k: part.step, n: part.of, test: test ? stopDayName(test) : '' });
    if (part.lessons.length === 1 && state.lessonNames[part.lessons[0]]) s += ': ' + state.lessonNames[part.lessons[0]];
    if (part.movedFrom) s += ' ' + t(part.movedFrom.why === 'cap' ? 'movedCap' : 'movedOff', { date: dayLabel(p.days[part.movedFrom.day].date) });
    return s;
  }

  function boxWhat(b) {
    var bits = [];
    var solo = { PT: 'printPracticeTest', FX: 'printFixErrors', SE: 'printSortErrors', CUM: 'printOldTopics' };
    b.parts.forEach(function (part) {
      if (solo[part.kind]) { bits.push(t(solo[part.kind])); return; }
      if (part.kind === 'P') { bits.push(t('printPrep')); return; }
      if (part.kind === 'Q') { bits.push(t('printBeforeTest')); return; }
      part.lessons.forEach(function (id) { var l = lessonLabel(id); if (bits.indexOf(l) < 0) bits.push(l); });
    });
    return bits.join(', ');
  }

  function noteText(n) {
    if (n.type === 'runupSkipped') return t('noteRunupSkipped', { subject: n.subject, stop: stopName(n.stop), date: dayLabel(n.date) });
    var key = n.type === 'pushedOut' ? (season() ? 'notePushedOutPeriod' : 'notePushedOut') : 'noteDroppedOff';
    return t(key, { subject: n.subject, date: dayLabel(n.date) });
  }

  function viewCalendar() {
    var p = plan();
    if (!p) return '<section class="panel"><h2>' + esc(t('periodHeading')) + '</h2>' + missingNote(S.buildSeason(state)) + '</section>';
    var today = S.todayIso();
    var overDays = p.days.filter(function (d) { return d.over; }).length;
    var pages = season() ? pageOpts(p) : null;
    var intro = season()
      ? '<h2>' + esc(t('periodHeading')) + '</h2>' +
        '<p>' + esc(t(p.period.last !== p.period.to ? 'periodRangeAfter' : 'periodRange', { from: dayLabel(p.period.from), to: dayLabel(p.period.last), stop: stopName(p.period.stop), date: dayLabel(p.period.to) })) + '</p>' +
        (p.period.capped ? '<p class="note">' + esc(t('periodCapped')) + '</p>' : '') +
        '<p class="muted small">' + esc(t('periodPages', { n: pages.length })) + ' ' + esc(t('periodNextTime')) + '</p>'
      : '<h2>' + esc(t('calHeading')) + '</h2>' +
        '<p class="muted">' + esc(t('calRange', { from: dayLabel(p.days[0].date), to: dayLabel(p.days[p.days.length - 1].date) })) + '</p>' +
        (p.first ? '<p class="muted small">' + esc(t('calPlanNote', { from: dayLabel(p.days[p.first].date), to: dayLabel(p.days[p.end - 1].date) })) + '</p>' : '');
    var head = '<section class="panel">' + intro +
      (chosen().length ? '' : '<p class="warn">' + esc(t(season() ? 'needTargetSubjects' : 'noPriority')) + '</p>') +
      (overDays ? '<p class="warn">' + esc(t('overCapSummary', { n: overDays })) + '</p>' : '') +
      p.notes.map(function (n) { return '<p class="warn">' + esc(noteText(n)) + '</p>'; }).join('') +
      '<div class="row"><div class="view-toggle" role="group">' +
      '<button type="button" data-action="view" data-view="list" aria-pressed="' + (state.view === 'list') + '">' + esc(t('viewList')) + '</button>' +
      '<button type="button" data-action="view" data-view="grid" aria-pressed="' + (state.view === 'grid') + '">' + esc(t('viewGrid')) + '</button></div></div>' +
      why('whyChain') + why('whyCap') + '</section>';

    var body;
    if (state.view === 'grid') {
      body = '<div class="grid-wrap">' + (pages || [renderOpts(p, false)]).map(function (o) { return R.toSVG(R.layout(o, measure)); }).join('') + '</div>';
    } else {
      body = '<div class="days">' + p.days.map(function (d) {
        var label = d.i % 7 === 0 ? '<p class="week-label">' + esc(dayLabel(d.date)) + ' – ' + esc(dayLabel(p.days[Math.min(d.i + 6, p.days.length - 1)].date)) + '</p>' : '';
        var chips = d.tests.map(function (x) { return '<span class="cls test">' + esc(x.stop ? stopName(x.stop) : t('test')) + ' · ' + esc(x.subject) + ' · ' + esc(t('slot_' + x.slot)) + '</span>'; })
          .concat(d.classes.map(function (c) { return '<span class="cls">' + esc(c.subject) + '</span>'; })).join('');
        var boxes = d.boxes.map(function (b) {
          var prep = b.parts.some(function (x) { return x.kind === 'P'; });
          var k0 = b.parts[0].kind;
          var cls = k0 === 'PT' ? ' practice' : k0 === 'CUM' ? ' cum' : prep ? ' prep' : '';
          var done = !!state.done[b.id];
          var cid = 'done-' + b.id.replace(/[^\w-]/g, '_');
          return '<div class="box' + cls + (done ? ' is-done' : '') + '">' +
            '<label for="' + esc(cid) + '"><input type="checkbox" id="' + esc(cid) + '" data-done="' + esc(b.id) + '"' + (done ? ' checked' : '') + '>' +
            '<span><span class="subj">' + esc(b.subject) + '</span> <span class="slot">' + esc(t('slot_' + b.slot)) + '</span>' +
            '<span class="what">' + esc(boxWhat(b)) + '</span></span></label>' +
            '<details><summary>' + esc(t('why')) + '</summary><ul>' + b.parts.map(function (x) { return '<li>' + esc(explain(x, p)) + '</li>'; }).join('') + '</ul></details></div>';
        }).join('');
        if (d.before || d.after) {
          return label + '<article class="day off outside"><header><h3>' + esc(wd(d.date)) + ' <span>' + esc(dm(d.date)) + '</span></h3></header>' +
            '<p class="muted small">' + esc(t(d.before ? 'beforeStart' : 'afterEnd')) + '</p></article>';
        }
        return label + '<article class="day' + (d.off ? ' off' : '') + (d.over ? ' over' : '') + '">' +
          '<header><h3>' + esc(wd(d.date)) + ' <span>' + esc(dm(d.date)) + '</span>' + (d.date === today ? '<span class="today">' + esc(t('today')) + '</span>' : '') + '</h3>' +
          (d.off ? '' : '<span class="count">' + esc(t('boxesCount', { n: d.load })) + '</span>') + '</header>' +
          (d.off ? '<p class="muted small">' + esc(t('dayOff')) + '</p>' : (chips ? '<div class="classes">' + chips + '</div>' : '') +
            (boxes || '<p class="muted small">' + esc(t('nothingDue')) + '</p>') +
            (d.over ? '<p class="warn">' + esc(t('overCap')) + '</p>' : '')) +
          '</article>';
      }).join('') + '</div>';
    }

    var bySubject = {};
    p.lessons.forEach(function (L) { (bySubject[L.subject] = bySubject[L.subject] || []).push(L); });
    var rename = '<section class="panel"><details><summary><h3 style="display:inline">' +
      esc(t('renameHeading')) + '</h3></summary><div class="lessons" style="margin-top:10px"><p class="muted small">' + esc(t('renameBody')) + '</p>' +
      (p.lessons.length ? Object.keys(bySubject).map(function (subj) {
        return bySubject[subj].map(function (L) {
          var id = 'ln-' + L.id.replace(/[^\w-]/g, '_');
          return '<div class="lesson"><label for="' + esc(id) + '"><b>' + esc(subj) + '</b> · ' + esc(dayLabel(L.date)) + '</label>' +
            '<input type="text" id="' + esc(id) + '" data-lesson="' + esc(L.id) + '" value="' + esc(state.lessonNames[L.id] || '') + '" placeholder="' + esc(t('renamePlaceholder')) + '" autocomplete="off"></div>';
        }).join('');
      }).join('') : '<p class="muted">' + esc(t('renameNone')) + '</p>') + '</div></details></section>';

    var homework = '<section class="panel"><h3>' + esc(t('homeworkHeading')) + '</h3><p>' + esc(t('homeworkBody')) + '</p></section>';

    var exp = exportPanel('exportHeading', 'cal', pages ? pages.length : 1, season() ? '' :
      '<h3>' + esc(t('blankHeading')) + '</h3><p class="muted small">' + esc(t('blankBody')) + '</p>' +
      '<div class="row"><button type="button" class="btn" data-action="print" data-what="blank">' + esc(t('printBlank')) + '</button>' +
      '<button type="button" class="btn" data-action="png" data-what="blank">' + esc(t('saveBlank')) + '</button></div>');

    return head + body + rename + homework + exp;
  }

  // what: 'cal' (the calendar, every page), 'map' (season map) or 'blank' (empty 2-week template)
  function exportPanel(heading, what, n, extra) {
    return '<section class="panel"><h3>' + esc(t(heading)) + '</h3>' +
      '<label class="field" for="name">' + esc(t('yourName')) + '<input type="text" id="name" data-field="name" value="' + esc(state.name) + '" autocomplete="off"></label>' +
      '<div class="row"><button type="button" class="btn primary" data-action="print" data-what="' + what + '">' + esc(t('print')) + '</button>' +
      '<button type="button" class="btn" data-action="png" data-what="' + what + '">' + esc(t(n > 1 ? 'saveImages' : 'saveImage')) + '</button>' +
      (navigator.share ? '<button type="button" class="btn" data-action="share" data-what="' + what + '">' + esc(t(n > 1 ? 'shareImages' : 'shareImage')) + '</button>' : '') + '</div>' +
      '<p class="muted small">' + esc(t('printHint')) + '</p>' +
      (ui.status ? '<p class="status" role="status">' + esc(ui.status) + '</p>' : '') + (extra || '') + '</section>';
  }

  // ---------- exam season ----------
  function fullDate(iso) { var p = iso.split('-'); return +p[2] + '.' + p[1] + '.' + p[0]; }
  function stopName(s) {
    if (s.type === 'other' && s.name) return s.name;
    return t((s.isTarget ? 'tgType_' : 'msType_') + (s.type || (s.isTarget ? 'national' : 'mock')));
  }
  function left(s) {
    if (s.days < 7) return t('daysLeft', { d: s.days });
    return s.rest ? t('weeksDaysLeft', { w: s.weeks, d: s.rest }) : t('weeksLeft', { w: s.weeks });
  }
  function topicText(periodId, subject) {
    return ((state.topics[periodId] || {})[S.subjectKey(subject)]) || '';
  }
  function seasonOpts(blank) {
    return { t: t, season: S.buildSeason(state), name: blank ? '' : state.name, fmtDate: fullDate, stopName: stopName, left: left, topics: topicText };
  }
  function chip(action, subject, pressed, extra) {
    return '<button type="button" class="chip-btn" data-action="' + action + '" data-subject="' + esc(subject) + '"' + (extra || '') +
      ' aria-pressed="' + pressed + '">' + esc(subject) + '</button>';
  }
  function hasSubject(list, s) { var k = S.subjectKey(s); return (list || []).some(function (x) { return S.subjectKey(x) === k; }); }
  function toggleSubject(list, s) {
    var k = S.subjectKey(s);
    return hasSubject(list, s) ? list.filter(function (x) { return S.subjectKey(x) !== k; }) : list.concat([s]);
  }

  function viewExams() {
    var tg = state.target, sea = S.buildSeason(state);
    var pool = S.uniqueSubjects(S.subjectsInTimetable(state.timetable).concat(tg.subjects));
    var tSubs = chosen();
    function select(attrs, prefix, values, sel) {
      return '<select ' + attrs + '>' + values.map(function (v) {
        return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + esc(t(prefix + v)) + '</option>';
      }).join('') + '</select>';
    }
    var tgStatus = !tg.date ? t('targetNoDate') : sea.target.days <= 0 ? t('targetPassed') : left(sea.target);
    var target = '<div class="exam">' +
      '<div class="exam-fields">' +
      '<label class="field" for="tg-type">' + esc(t('targetType')) + select('id="tg-type" data-tg="type"', 'tgType_', ['national', 'session', 'other'], tg.type) + '</label>' +
      (tg.type === 'other' ? '<label class="field" for="tg-name">' + esc(t('examName')) + '<input type="text" id="tg-name" data-tg="name" value="' + esc(tg.name) +
        '" placeholder="' + esc(t('examNamePlaceholder')) + '" autocomplete="off"></label>' : '') +
      '<label class="field" for="tg-date">' + esc(t('examDate')) + '<input type="date" id="tg-date" data-tg="date" min="' + esc(state.start) + '" value="' + esc(tg.date) + '"></label>' +
      '</div><p class="' + (tg.date && sea.target.days > 0 ? 'muted small' : 'warn') + '">' + esc(tgStatus) + '</p>' +
      '<p class="label">' + esc(t('targetSubjects')) + '</p><p class="muted small">' + esc(t('targetSubjectsHint')) + '</p>' +
      (pool.length ? '<div class="chips">' + pool.map(function (s) { return chip('tsub', s, hasSubject(tSubs, s)); }).join('') + '</div>' : '') +
      '<div class="add-subject"><label class="field" for="tg-add">' + esc(t('addSubjectLabel')) +
      '<input type="text" id="tg-add" placeholder="' + esc(t('addSubjectPlaceholder')) + '" autocomplete="off"></label>' +
      '<button type="button" class="btn" data-action="tsub-add">' + esc(t('addSubject')) + '</button></div>' +
      (tSubs.length ? '' : '<p class="warn">' + esc(t('needTargetSubjectsHere')) + '</p>') +
      (tSubs.length > 4 ? '<p class="warn">' + esc(t('subjectsTooMany', { n: tSubs.length })) + '</p>' : '') +
      '</div>';

    var rows = state.milestones.map(function (m) {
      var id = esc(m.id);
      var st = sea.milestones.filter(function (x) { return x.id === m.id; })[0];
      var status = !m.date ? ['muted small', t(tg.date ? 'msNoDate' : 'msNoDateYet')]
        : st.days <= 0 ? ['muted small', t('msPassed')]
        : sea.target && m.date >= sea.target.date ? ['warn', t('msAfterTarget')]
        : m.suggested ? ['note', left(st) + '. ' + t('msSuggested')]
        : ['muted small', left(st)];
      return '<div class="exam">' +
        '<div class="exam-fields">' +
        '<label class="field" for="ms-type-' + id + '">' + esc(t('milestoneType')) +
        select('id="ms-type-' + id + '" data-ms="' + id + '" data-key="type"', 'msType_', ['mock', 'midterm', 'session', 'other'], m.type) + '</label>' +
        (m.type === 'other' ? '<label class="field" for="ms-name-' + id + '">' + esc(t('examName')) + '<input type="text" id="ms-name-' + id + '" data-ms="' + id +
          '" data-key="name" value="' + esc(m.name) + '" placeholder="' + esc(t('examNamePlaceholder')) + '" autocomplete="off"></label>' : '') +
        '<label class="field" for="ms-date-' + id + '">' + esc(t('examDate')) + '<input type="date" id="ms-date-' + id + '" data-ms="' + id +
          '" data-key="date" value="' + esc(m.date) + '"></label>' +
        '</div><p class="' + status[0] + '">' + esc(status[1]) + '</p>' +
        '<p class="label">' + esc(t('milestoneSubjects')) + '</p>' +
        (tSubs.length ? '<div class="chips">' + tSubs.map(function (s) { return chip('msub', s, hasSubject(m.subjects, s), ' data-id="' + id + '"'); }).join('') + '</div>'
          : '<p class="muted small">' + esc(t('pickTargetFirst')) + '</p>') +
        '<div><button type="button" class="btn quiet" data-action="remove-ms" data-id="' + id + '">' + esc(t('removeMilestone')) + '</button></div>' +
        '</div>';
    }).join('');

    return '<section class="panel"><h2>' + esc(t('examsHeading')) + '</h2><p>' + esc(t('examsBody')) + '</p>' +
      '<h3>' + esc(t('targetHeading')) + '</h3>' + target + '</section>' +
      '<section class="panel"><h3>' + esc(t('milestonesHeading')) + '</h3><p>' + esc(t('milestonesBody')) + '</p>' +
      (rows || '<p class="muted">' + esc(t('milestonesEmpty')) + '</p>') +
      '<div><button type="button" class="btn" data-action="add-ms">' + esc(t('addMilestone')) + '</button></div>' +
      (sea.period && sea.period.capped ? '<p class="note">' + esc(t('periodCapped')) + '</p>' : '') + '</section>' +
      viewTests();
  }

  // Empty milestone rows for the target exam's type. The student types every date.
  var DEFAULT_MILESTONES = { national: ['mock', 'mock', 'mock'], session: ['midterm'], other: [] };
  function defaultMilestones() {
    // Only when the student has not typed any milestone date yet: never throw away their work.
    if (state.milestones.some(function (m) { return (m.date && !m.suggested) || m.name; })) return;
    var now = Date.now();
    state.milestones = (DEFAULT_MILESTONES[state.target.type] || []).map(function (type, i) {
      return { id: 'm' + now + i, type: type, name: '', date: '', subjects: chosen() };
    });
    suggestDates();
  }
  // Milestones without a typed date get a suggested one, spread evenly up to the target exam.
  // A date the student typed is never changed.
  function suggestDates() {
    var dates = S.suggestDates(state.start, state.target.date, state.milestones.length);
    state.milestones.forEach(function (m, i) {
      if (m.date && !m.suggested) return;
      m.date = dates[i] || '';
      m.suggested = !!dates[i];
    });
  }

  function periodTitle(p) {
    return t('periodN', { n: p.n }) + ': ' + dm(p.from) + ' – ' + dm(p.to) + ' · ' + stopName(p.stop);
  }

  // What is still missing on the Exams step, as a string key ('' when nothing is).
  function missing(sea) {
    if (!state.target.date) return 'needTargetDate';
    if (!sea.target || sea.target.days <= 0) return 'needTargetFuture';
    if (!sea.subjects.length) return 'needTargetSubjects';
    return '';
  }
  function missingNote(sea) { var k = missing(sea); return k ? '<p class="warn">' + esc(t(k)) + '</p>' : ''; }

  function viewTopics() {
    var sea = S.buildSeason(state);
    var body = missing(sea) ? missingNote(sea)
      : sea.periods.map(function (p) {
          return '<div class="period"><h3>' + esc(periodTitle(p)) + '</h3>' + sea.subjects.map(function (s) {
            var id = 'tp-' + p.id + '-' + S.subjectKey(s).replace(/[^\w-]/g, '_');
            var onExam = hasSubject(p.stop.subjects, s);
            return '<label class="topic" for="' + esc(id) + '"><span><b>' + esc(s) + '</b>' + (onExam ? ' <span class="tag">' + esc(t('onExam')) + '</span>' : '') + '</span>' +
              '<input type="text" id="' + esc(id) + '" data-topic="' + esc(p.id) + '|' + esc(S.subjectKey(s)) + '" value="' + esc(topicText(p.id, s)) +
              '" placeholder="' + esc(t('topicsPlaceholder')) + '" autocomplete="off"></label>';
          }).join('') + '</div>';
        }).join('');
    return '<section class="panel"><h2>' + esc(t('topicsHeading')) + '</h2><p>' + esc(t('topicsBody')) + '</p>' + body + '</section>';
  }

  function viewMap() {
    var o = seasonOpts(false), sea = o.season;
    var head = '<section class="panel"><h2>' + esc(t('mapHeading')) + '</h2>' +
      (sea.period ? '<p>' + esc(t('nextPeriod', { from: dayLabel(sea.period.from), to: dayLabel(sea.period.to), stop: stopName(sea.period.stop) })) + '</p>' : '') +
      missingNote(sea) +
      (sea.period && sea.period.capped ? '<p class="note">' + esc(t('periodCapped')) + '</p>' : '') +
      sea.late.map(function (m) { return '<p class="warn">' + esc(stopName(m) + ' ' + fullDate(m.date) + ': ' + t('msAfterTarget')) + '</p>'; }).join('') +
      '<div class="row"><div class="view-toggle" role="group">' +
      '<button type="button" data-action="map-view" data-view="list" aria-pressed="' + (state.mapView !== 'grid') + '">' + esc(t('viewOverview')) + '</button>' +
      '<button type="button" data-action="map-view" data-view="grid" aria-pressed="' + (state.mapView === 'grid') + '">' + esc(t('viewPage')) + '</button></div></div></section>';

    var exp = exportPanel('mapExportHeading', 'map', 1);
    if (state.mapView === 'grid') return head + '<div class="grid-wrap">' + R.toSVG(R.layoutSeason(o, measure)) + '</div>' + exp;

    var timeline = '<section class="panel"><h3>' + esc(t('timelineHeading')) + '</h3><ol class="timeline">' +
      '<li class="start"><b>' + esc(t('printStart')) + '</b><span>' + esc(dayLabel(sea.start)) + '</span></li>' +
      sea.stops.map(function (s) {
        return '<li class="' + (s.isTarget ? 'target' : 'milestone') + '"><b>' + esc(stopName(s)) + '</b><span>' + esc(dayLabel(s.date)) + ' · ' + esc(left(s)) + '</span>' +
          (s.subjects.length ? '<span class="muted small">' + esc(s.subjects.join(', ')) + '</span>' : '') + '</li>';
      }).join('') + '</ol></section>';

    var periods = sea.periods.map(function (p) {
      var rows = sea.subjects.map(function (s) {
        var tp = topicText(p.id, s);
        return '<li><span><b>' + esc(s) + '</b>' + (hasSubject(p.stop.subjects, s) ? ' <span class="tag">' + esc(t('onExam')) + '</span>' : '') + '</span>' +
          '<span class="' + (tp ? '' : 'muted ') + 'small">' + esc(tp || '—') + '</span></li>';
      }).join('');
      return '<section class="panel"><h3>' + esc(periodTitle(p)) + '</h3><ul class="topics">' + rows + '</ul></section>';
    }).join('');

    var cycle = '<section class="panel"><h3>' + esc(t('cycleHeading')) + '</h3><ol class="cycle">' +
      ['Understand', 'Recall', 'Space', 'Simulate'].map(function (k) {
        return '<li class="c-' + k.toLowerCase() + '"><b>' + esc(t('cycle' + k)) + '</b><span>' + esc(t('cycle' + k + 'When')) + '</span></li>';
      }).join('') + '</ol></section>';

    return head + timeline + periods + cycle + exp;
  }

  // ---------- export ----------
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var sample = 'აბგდ Abc 0123';
    return Promise.all([
      document.fonts.load('400 16px "Noto Sans Georgian"', sample),
      document.fonts.load('700 16px "Noto Sans Georgian"', sample)
    ]).then(function () { return document.fonts.ready; }).catch(function () {});
  }
  // The drawing operations of every page to export. what: 'cal', 'map' or 'blank'.
  function pagesOps(what) {
    if (what === 'map') return [R.layoutSeason(seasonOpts(false), measure)];
    if (what === 'blank') return [R.layout(renderOpts(plan(), true), measure)];
    var p = plan();
    if (!p) return [];
    return season() ? pageOpts(p).map(function (o) { return R.layout(o, measure); }) : [R.layout(renderOpts(p, false), measure)];
  }
  function fileBase(what) {
    return what === 'blank' ? 'review-calendar-blank' : what === 'map' ? 'season-map-' + state.start
      : (season() ? 'period-calendar-' : 'review-calendar-') + state.start;
  }

  // PDF: the browser prints the SVG pages, one A4 page each.
  function doPrint(what) {
    fontsReady().then(function () {
      document.getElementById('print-root').innerHTML = pagesOps(what).map(R.toSVG).join('');
      window.print();
    });
  }
  // PNG: one image per page (a long period as one tall image would be too big for phones).
  function pngFiles(what) {
    return fontsReady().then(function () {
      var list = pagesOps(what), base = fileBase(what);
      return Promise.all(list.map(function (o, i) {
        var cv = R.toCanvas(o, 2);
        return new Promise(function (res, rej) {
          cv.toBlob(function (b) {
            cv.width = cv.height = 0; // free the canvas memory right away (iOS)
            b ? res(new File([b], base + (list.length > 1 ? '-' + (i + 1) : '') + '.png', { type: 'image/png' })) : rej(new Error('toBlob'));
          }, 'image/png');
        });
      }));
    });
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function downloadAll(files) {
    files.forEach(function (f, i) { setTimeout(function () { download(f, f.name); }, i * 400); });
  }
  function savePng(what) {
    pngFiles(what).then(downloadAll).catch(failed);
  }
  // On phones all pages go to the share sheet at once.
  function sharePng(what) {
    pngFiles(what).then(function (files) {
      if (navigator.canShare && navigator.canShare({ files: files })) {
        return navigator.share({ files: files, title: t(what === 'map' ? 'printSeasonTitle' : season() ? 'printPeriodTitle' : 'printTitle') })
          .catch(function (e) { if (e && e.name !== 'AbortError') downloadAll(files); });
      }
      downloadAll(files);
    }).catch(failed);
  }
  function failed() { ui.status = t('imageFailed'); render(); }

  // ---------- example ----------
  function example() {
    var ka = state.lang === 'ka';
    var n = ka
      ? { math: 'მათემატიკა', geo: 'ქართული', bio: 'ბიოლოგია', eng: 'ინგლისური', his: 'ისტორია', phy: 'ფიზიკა', chem: 'ქიმია', tutor: 'მათემატიკა (რეპეტიტორი)', course: 'ინგლისურის კურსი' }
      : { math: 'Math', geo: 'Georgian', bio: 'Biology', eng: 'English', his: 'History', phy: 'Physics', chem: 'Chemistry', tutor: 'Math tutor', course: 'English course' };
    state.timetable = {
      0: { m: n.math + ', ' + n.geo, a: n.bio, e: '' },
      1: { m: n.eng + ', ' + n.his, a: n.phy, e: '' },
      2: { m: n.math + ', ' + n.chem, a: n.bio, e: n.tutor },
      3: { m: n.geo + ', ' + n.eng, a: n.his, e: '' },
      4: { m: n.math + ', ' + n.phy, a: n.chem, e: '' },
      5: { m: '', a: n.course, e: '' },
      6: { m: '', a: '', e: '' }
    };
    state.priority = [n.math, n.bio];
    state.tests = [{ id: 't' + Date.now(), subject: n.bio, date: S.addDays(state.start, 8), slot: 'auto' }];
    if (season()) {
      // National exams in about 7 months, with 3 mock exams on the way.
      var subs = [n.geo, n.eng, n.math];
      state.target = { type: 'national', name: '', date: S.addDays(state.start, 210), subjects: subs };
      state.milestones = [21, 91, 161].map(function (d, i) {
        return { id: 'm' + i, type: 'mock', name: '', date: S.addDays(state.start, d), subjects: subs.slice() };
      });
      state.topics = { m0: {}, m1: {} };
      state.topics.m0[S.subjectKey(n.math)] = ka ? 'ფუნქციები, განტოლებები' : 'Functions, Equations';
      state.topics.m0[S.subjectKey(n.geo)] = ka ? 'ესეს სტრუქტურა' : 'Essay structure';
      state.topics.m1[S.subjectKey(n.math)] = ka ? 'გეომეტრია' : 'Geometry, Probability';
      state.tests = [{ id: 't' + Date.now(), subject: n.math, date: S.addDays(state.start, 8), slot: 'auto' }];
    }
    state.daysOff = [];
    state.lessonNames = {};
    state.done = {};
    ui.flash = t('exampleLoaded');
  }

  function msById(id) { return state.milestones.filter(function (x) { return x.id === id; })[0] || {}; }

  // ---------- events ----------
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var a = el.getAttribute('data-action');
    if (a === 'go') {
      state.step = +el.getAttribute('data-step'); ui.flash = ''; ui.status = ''; ui.confirmReset = false;
      save(); render(); window.scrollTo(0, 0); return;
    }
    if (a === 'lang') state.lang = el.getAttribute('data-lang');
    else if (a === 'example') example();
    else if (a === 'reset') ui.confirmReset = true;
    else if (a === 'reset-no') ui.confirmReset = false;
    else if (a === 'reset-yes') { var lang = state.lang, mode = state.mode; state = fresh(); state.lang = lang; state.mode = mode; ui.confirmReset = false; if (season()) defaultMilestones(); }
    else if (a === 'mode') {
      state.mode = el.getAttribute('data-mode'); ui.flash = '';
      if (season() && !state.milestones.length && !state.target.date) defaultMilestones();
    }
    else if (a === 'tsub') {
      // A subject added to the target exam is ticked on every milestone; removed, it goes from all of them.
      var sub = el.getAttribute('data-subject'), on = !hasSubject(state.target.subjects, sub);
      state.target.subjects = toggleSubject(state.target.subjects, sub);
      state.milestones.forEach(function (m) { if (hasSubject(m.subjects, sub) !== on) m.subjects = toggleSubject(m.subjects || [], sub); });
    }
    else if (a === 'tsub-add') {
      var input = document.getElementById('tg-add');
      S.splitSubjects(input && input.value).forEach(function (x) {
        if (hasSubject(state.target.subjects, x)) return;
        state.target.subjects.push(x);
        state.milestones.forEach(function (m) { if (!hasSubject(m.subjects, x)) m.subjects = (m.subjects || []).concat([x]); });
      });
    }
    else if (a === 'msub') {
      var ms = state.milestones.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (ms) ms.subjects = toggleSubject(ms.subjects, el.getAttribute('data-subject'));
    }
    else if (a === 'add-ms') {
      state.milestones.push({ id: 'm' + Date.now(), type: state.target.type === 'session' ? 'midterm' : 'mock', name: '', date: '', subjects: chosen() });
      suggestDates();
    }
    else if (a === 'remove-ms') {
      var mid = el.getAttribute('data-id');
      state.milestones = state.milestones.filter(function (x) { return x.id !== mid; });
      suggestDates();
    }
    else if (a === 'map-view') state.mapView = el.getAttribute('data-view');
    else if (a === 'subject') {
      var s = el.getAttribute('data-subject'), k = S.subjectKey(s);
      var has = state.priority.some(function (x) { return S.subjectKey(x) === k; });
      state.priority = has ? state.priority.filter(function (x) { return S.subjectKey(x) !== k; }) : state.priority.concat([s]);
    }
    else if (a === 'add-test') {
      var first = chosen()[0] || '';
      state.tests.push({ id: 't' + Date.now(), subject: first, date: '', slot: 'auto' });
    }
    else if (a === 'remove-test') {
      var id = el.getAttribute('data-id');
      state.tests = state.tests.filter(function (x) { return x.id !== id; });
    }
    else if (a === 'off') {
      var d = el.getAttribute('data-date');
      var i = state.daysOff.indexOf(d);
      if (i >= 0) state.daysOff.splice(i, 1); else state.daysOff.push(d);
    }
    else if (a === 'view') state.view = el.getAttribute('data-view');
    else if (a === 'print') { doPrint(el.getAttribute('data-what')); return; }
    else if (a === 'png') { savePng(el.getAttribute('data-what')); return; }
    else if (a === 'share') { sharePng(el.getAttribute('data-what')); return; }
    save(); render();
  });

  // Typing saves without redrawing, so the cursor stays put.
  app.addEventListener('input', function (e) {
    var el = e.target;
    if (el.hasAttribute('data-tt')) {
      var p = el.getAttribute('data-tt').split(',');
      state.timetable[p[0]][p[1]] = el.value;
    } else if (el.hasAttribute('data-lesson')) {
      var v = el.value.trim();
      if (v) state.lessonNames[el.getAttribute('data-lesson')] = el.value; else delete state.lessonNames[el.getAttribute('data-lesson')];
    } else if (el.getAttribute('data-field') === 'name') {
      state.name = el.value;
    } else if (el.hasAttribute('data-topic')) {
      var tp = el.getAttribute('data-topic').split('|');
      state.topics[tp[0]] = state.topics[tp[0]] || {};
      if (el.value.trim()) state.topics[tp[0]][tp[1]] = el.value; else delete state.topics[tp[0]][tp[1]];
    } else if (el.getAttribute('data-tg') === 'name') {
      state.target.name = el.value;
    } else if (el.hasAttribute('data-ms') && el.getAttribute('data-key') === 'name') {
      msById(el.getAttribute('data-ms')).name = el.value;
    } else return;
    save();
  });

  app.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute('data-field') === 'start') {
      if (el.value) state.start = el.value;
      if (season()) suggestDates();
    } else if (el.hasAttribute('data-tg')) {
      if (el.getAttribute('data-tg') === 'name') return;
      state.target[el.getAttribute('data-tg')] = el.value;
      if (el.getAttribute('data-tg') === 'type') defaultMilestones();
      if (el.getAttribute('data-tg') === 'date') suggestDates();
    } else if (el.hasAttribute('data-ms')) {
      if (el.getAttribute('data-key') === 'name') return;
      var msRow = msById(el.getAttribute('data-ms'));
      msRow[el.getAttribute('data-key')] = el.value;
      if (el.getAttribute('data-key') === 'date') msRow.suggested = false; // typed by the student: keep it
    } else if (el.hasAttribute('data-test')) {
      var x = state.tests.filter(function (q) { return q.id === el.getAttribute('data-test'); })[0];
      if (x) x[el.getAttribute('data-key')] = el.value;
      save(); return;
    } else if (el.hasAttribute('data-done')) {
      if (el.checked) state.done[el.getAttribute('data-done')] = true; else delete state.done[el.getAttribute('data-done')];
      el.closest('.box').classList.toggle('is-done', el.checked);
      save(); return;
    } else if (el.hasAttribute('data-lesson')) {
      save(); if (state.view === 'grid') render(); return;
    } else return;
    save(); render();
  });

  render();
  // Redraw once the Georgian font has loaded so measured text in the grid is right.
  fontsReady().then(function () { if (app.querySelector('.grid-wrap')) render(); });
})();

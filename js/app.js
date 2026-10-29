/*
 * The step-by-step page. State lives only in this browser (localStorage); nothing is sent anywhere.
 */
(function () {
  'use strict';
  var S = window.Schedule, R = window.Render, STR = window.STRINGS;
  var KEY = 'charte-review-calendar-v1';
  var STEPS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
  var app = document.getElementById('app');
  var measure = R.measurer();
  var ui = { confirmReset: false, flash: '', status: '' };

  function fresh() {
    var tt = {};
    for (var w = 0; w < 7; w++) tt[w] = { m: '', a: '', e: '' };
    return { v: 1, lang: 'ka', step: 0, start: S.todayIso(), timetable: tt, priority: [], tests: [], daysOff: [],
      lessonNames: {}, done: {}, name: '', view: 'list' };
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
  function plan() { return S.buildPlan(state); }
  function renderOpts(p, blank) {
    return {
      plan: blank ? null : p, t: t, name: blank ? '' : state.name,
      range: p ? dayLabel(p.days[0].date) + ' – ' + dayLabel(p.days[p.days.length - 1].date) : '',
      fmtDay: function (iso) { return { wd: wd(iso), dm: dm(iso) }; },
      lessonLabel: lessonLabel
    };
  }

  // ---------- views ----------
  function render() {
    document.documentElement.lang = state.lang;
    var step = state.step;
    var html = '<div class="page' + (step === 5 && state.view === 'grid' ? ' wide' : '') + '">' +
      '<header class="top"><div class="brand"><h1>' + esc(t('appTitle')) + '</h1><p>' + esc(t('tagline')) + '</p></div>' +
      '<div class="lang" role="group" aria-label="' + esc(t('langLabel')) + '">' +
      '<button type="button" data-action="lang" data-lang="ka" aria-pressed="' + (state.lang === 'ka') + '">ქართ</button>' +
      '<button type="button" data-action="lang" data-lang="en" aria-pressed="' + (state.lang === 'en') + '">EN</button></div></header>' +
      '<nav aria-label="' + esc(t('stepOf', { n: step + 1, total: STEPS.length })) + '"><ol class="steps">' +
      STEPS.map(function (k, i) {
        return '<li><button type="button" data-action="go" data-step="' + i + '"' + (i === step ? ' aria-current="step"' : '') +
          (i < step ? ' class="done"' : '') + '><span class="n">' + (i + 1) + '</span><span class="lbl">' + esc(t(k)) + '</span></button></li>';
      }).join('') + '</ol></nav>' +
      [viewStart, viewClasses, viewSubjects, viewTests, viewOff, viewCalendar][step]() +
      '<div class="nav">' +
      (step > 0 ? '<button type="button" class="btn" data-action="go" data-step="' + (step - 1) + '">' + esc(t('back')) + '</button>' : '<span></span>') +
      (step < 5 ? '<button type="button" class="btn primary" data-action="go" data-step="' + (step + 1) + '">' + esc(t(step === 4 ? 'showCalendar' : 'next')) + '</button>' : '') +
      '</div></div>';
    app.innerHTML = html;
  }

  function why(key) { return '<details class="why"><summary>' + esc(t('why')) + '</summary><p>' + esc(t(key)) + '</p></details>'; }

  function viewStart() {
    return '<section class="panel"><h2>' + esc(t('startHeading')) + '</h2><p>' + esc(t('startBody')) + '</p>' +
      '<div class="frame">' +
      '<div><b>' + esc(t('frameLearn')) + '</b><span>' + esc(t('frameLearnWhen')) + '</span></div>' +
      '<div class="recall"><b>' + esc(t('frameRecall')) + '</b><span>' + esc(t('frameRecallWhen')) + '</span></div>' +
      '<div><b>' + esc(t('frameFix')) + '</b><span>' + esc(t('frameFixWhen')) + '</span></div></div>' +
      why('whyStart') +
      '<label class="field" for="start">' + esc(t('startDate')) +
      '<input type="date" id="start" data-field="start" value="' + esc(state.start) + '">' +
      '<span class="hint">' + esc(t('startDateHint')) + '</span></label>' +
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
      '<p class="muted small">' + esc(t('classesRepeat')) + '</p>' +
      '<div class="tt"><div class="tt-head"><span></span><span>' + esc(t('slot_m')) + '</span><span>' + esc(t('slot_a')) +
      '</span><span>' + esc(t('slot_e')) + '</span></div>' + rows + '</div></section>';
  }

  function chosen() {
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
    return '<section class="panel"><h2>' + esc(t('testsHeading')) + '</h2><p>' + esc(t('testsBody')) + '</p>' +
      (rows || '<p class="muted">' + esc(t('testsEmpty')) + '</p>') +
      '<div><button type="button" class="btn" data-action="add-test">' + esc(t('addTest')) + '</button></div>' +
      why('whyTests') + '</section>';
  }

  function viewOff() {
    var cells = '';
    var monday = S.mondayOf(state.start), first = S.dayDiff(monday, state.start);
    for (var i = 0; i < S.HORIZON; i++) {
      var d = S.addDays(monday, i);
      cells += i < first
        ? '<span class="chip-btn before" aria-hidden="true"><small>' + esc(wd(d)) + '</small>' + esc(dm(d)) + '</span>'
        : '<button type="button" class="chip-btn" data-action="off" data-date="' + d + '" aria-pressed="' + (state.daysOff.indexOf(d) >= 0) + '">' +
          '<small>' + esc(wd(d)) + '</small>' + esc(dm(d)) + '</button>';
    }
    var n = state.daysOff.filter(function (d) { var k = S.dayDiff(monday, d); return k >= first && k < S.HORIZON; }).length;
    return '<section class="panel"><h2>' + esc(t('offHeading')) + '</h2><p>' + esc(t('offBody')) + '</p>' +
      '<div class="offs">' + cells + '</div><p class="muted small">' + esc(t('offCount', { n: n })) + '</p></section>';
  }

  function explain(part, p) {
    var lessonD = part.lessons[0] ? dayLabel(lessonDate(part.lessons[0])) : '';
    var test = part.test ? p.tests.filter(function (x) { return x.id === part.test; })[0] : null;
    var s = t('kind_' + part.kind, { date: lessonD, k: part.step, n: part.of, test: test ? dayLabel(test.date) : '' });
    if (part.lessons.length === 1 && state.lessonNames[part.lessons[0]]) s += ': ' + state.lessonNames[part.lessons[0]];
    if (part.movedFrom) s += ' ' + t(part.movedFrom.why === 'cap' ? 'movedCap' : 'movedOff', { date: dayLabel(p.days[part.movedFrom.day].date) });
    return s;
  }

  function boxWhat(b) {
    var bits = [];
    b.parts.forEach(function (part) {
      if (part.kind === 'P') { bits.push(t('printPrep')); return; }
      if (part.kind === 'Q') { bits.push(t('printBeforeTest')); return; }
      part.lessons.forEach(function (id) { var l = lessonLabel(id); if (bits.indexOf(l) < 0) bits.push(l); });
    });
    return bits.join(', ');
  }

  function viewCalendar() {
    var p = plan();
    var today = S.todayIso();
    var overDays = p.days.filter(function (d) { return d.over; }).length;
    var head = '<section class="panel"><h2>' + esc(t('calHeading')) + '</h2>' +
      '<p class="muted">' + esc(t('calRange', { from: dayLabel(p.days[0].date), to: dayLabel(p.days[p.days.length - 1].date) })) + '</p>' +
      (p.first ? '<p class="muted small">' + esc(t('calBeforeNote', { date: dayLabel(state.start) })) + '</p>' : '') +
      (chosen().length ? '' : '<p class="warn">' + esc(t('noPriority')) + '</p>') +
      (overDays ? '<p class="warn">' + esc(t('overCapSummary', { n: overDays })) + '</p>' : '') +
      p.notes.map(function (n) {
        return '<p class="warn">' + esc(t(n.type === 'pushedOut' ? 'notePushedOut' : 'noteDroppedOff', { subject: n.subject, date: dayLabel(n.date) })) + '</p>';
      }).join('') +
      '<div class="row"><div class="view-toggle" role="group">' +
      '<button type="button" data-action="view" data-view="list" aria-pressed="' + (state.view === 'list') + '">' + esc(t('viewList')) + '</button>' +
      '<button type="button" data-action="view" data-view="grid" aria-pressed="' + (state.view === 'grid') + '">' + esc(t('viewGrid')) + '</button></div></div>' +
      why('whyChain') + why('whyCap') + '</section>';

    var body;
    if (state.view === 'grid') {
      body = '<div class="grid-wrap">' + R.toSVG(R.layout(renderOpts(p, false), measure)) + '</div>';
    } else {
      body = '<div class="days">' + p.days.map(function (d) {
        var label = d.i % 7 === 0 ? '<p class="week-label">' + esc(dayLabel(d.date)) + ' – ' + esc(dayLabel(p.days[Math.min(d.i + 6, p.days.length - 1)].date)) + '</p>' : '';
        var chips = d.tests.map(function (x) { return '<span class="cls test">' + esc(t('test')) + ' · ' + esc(x.subject) + ' · ' + esc(t('slot_' + x.slot)) + '</span>'; })
          .concat(d.classes.map(function (c) { return '<span class="cls">' + esc(c.subject) + '</span>'; })).join('');
        var boxes = d.boxes.map(function (b) {
          var prep = b.parts.some(function (x) { return x.kind === 'P'; });
          var done = !!state.done[b.id];
          var cid = 'done-' + b.id.replace(/[^\w-]/g, '_');
          return '<div class="box' + (prep ? ' prep' : '') + (done ? ' is-done' : '') + '">' +
            '<label for="' + esc(cid) + '"><input type="checkbox" id="' + esc(cid) + '" data-done="' + esc(b.id) + '"' + (done ? ' checked' : '') + '>' +
            '<span><span class="subj">' + esc(b.subject) + '</span> <span class="slot">' + esc(t('slot_' + b.slot)) + '</span>' +
            '<span class="what">' + esc(boxWhat(b)) + '</span></span></label>' +
            '<details><summary>' + esc(t('why')) + '</summary><ul>' + b.parts.map(function (x) { return '<li>' + esc(explain(x, p)) + '</li>'; }).join('') + '</ul></details></div>';
        }).join('');
        if (d.before) {
          return label + '<article class="day off before"><header><h3>' + esc(wd(d.date)) + ' <span>' + esc(dm(d.date)) + '</span></h3></header>' +
            '<p class="muted small">' + esc(t('beforeStart')) + '</p></article>';
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

    var exp = '<section class="panel"><h3>' + esc(t('exportHeading')) + '</h3>' +
      '<label class="field" for="name">' + esc(t('yourName')) + '<input type="text" id="name" data-field="name" value="' + esc(state.name) + '" autocomplete="off"></label>' +
      '<div class="row"><button type="button" class="btn primary" data-action="print">' + esc(t('print')) + '</button>' +
      '<button type="button" class="btn" data-action="png">' + esc(t('saveImage')) + '</button>' +
      (navigator.share ? '<button type="button" class="btn" data-action="share">' + esc(t('shareImage')) + '</button>' : '') + '</div>' +
      '<p class="muted small">' + esc(t('printHint')) + '</p>' +
      (ui.status ? '<p class="status" role="status">' + esc(ui.status) + '</p>' : '') +
      '<h3>' + esc(t('blankHeading')) + '</h3><p class="muted small">' + esc(t('blankBody')) + '</p>' +
      '<div class="row"><button type="button" class="btn" data-action="print-blank">' + esc(t('printBlank')) + '</button>' +
      '<button type="button" class="btn" data-action="png-blank">' + esc(t('saveBlank')) + '</button></div></section>';

    return head + body + rename + homework + exp;
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
  function ops(blank) { return R.layout(renderOpts(plan(), blank), measure); }

  function doPrint(blank) {
    fontsReady().then(function () {
      document.getElementById('print-root').innerHTML = R.toSVG(ops(blank));
      window.print();
    });
  }
  function pngBlob(blank) {
    return fontsReady().then(function () {
      var cv = R.toCanvas(ops(blank), 2);
      return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob')); }, 'image/png'); });
    });
  }
  function fileName(blank) { return blank ? 'review-calendar-blank.png' : 'review-calendar-' + state.start + '.png'; }
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function savePng(blank) {
    pngBlob(blank).then(function (b) { download(b, fileName(blank)); }).catch(failed);
  }
  function sharePng() {
    pngBlob(false).then(function (b) {
      var file = new File([b], fileName(false), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: t('printTitle') }).catch(function (e) { if (e && e.name !== 'AbortError') download(b, file.name); });
      }
      download(b, file.name);
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
    state.daysOff = [];
    state.lessonNames = {};
    state.done = {};
    ui.flash = t('exampleLoaded');
  }

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
    else if (a === 'reset-yes') { var lang = state.lang; state = fresh(); state.lang = lang; ui.confirmReset = false; }
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
    else if (a === 'print') { doPrint(false); return; }
    else if (a === 'print-blank') { doPrint(true); return; }
    else if (a === 'png') { savePng(false); return; }
    else if (a === 'png-blank') { savePng(true); return; }
    else if (a === 'share') { sharePng(); return; }
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
    } else return;
    save();
  });

  app.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute('data-field') === 'start') {
      if (el.value) state.start = el.value;
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
  fontsReady().then(function () { if (state.step === 5 && state.view === 'grid') render(); });
})();

/*
 * The page shell: state, strings, export. The screen itself is js/board.js, for both modes.
 * State lives only in this browser (localStorage); nothing is sent anywhere.
 */
(function () {
  'use strict';
  var S = window.Schedule, R = window.Render, STR = window.STRINGS;
  var KEY = 'charte-review-calendar-v1';
  function season() { return state.mode === 'season'; }
  var app = document.getElementById('app');
  var measure = R.measurer();
  var ui = { status: '' };

  function fresh() {
    var tt = {};
    for (var w = 0; w < 7; w++) tt[w] = { m: '', a: '', e: '' };
    return { v: 1, lang: 'ka', start: S.todayIso(), timetable: tt, priority: [], tests: [], daysOff: [],
      lessonNames: {}, done: {}, name: '',
      // sessions the student moved ({ id: { date, slot } }) and the "Move sessions" switch
      moved: {}, advanced: false,
      // exam season mode
      mode: 'two', target: { type: 'national', name: '', date: '', subjects: [] }, milestones: [], topics: {} };
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
  function fullDate(iso) { var p = iso.split('-'); return +p[2] + '.' + p[1] + '.' + p[0]; }
  function lessonDate(id) { return id.split('|')[1]; }
  function lessonLabel(id) { return (state.lessonNames[id] || '').trim() || dm(lessonDate(id)); }

  // ---------- plan ----------
  // Exam season: the period calendar. Until the target exam has a date there is no period yet, so the screen
  // shows the next 2 weeks (sessions for the target exam's subjects) where classes can already be added.
  function plan() {
    if (!season()) return Board.applyMoves(S.buildPlan(state), state);
    var p = S.buildPeriod(state);
    if (!p) {
      p = S.buildPlan(Object.assign({}, state, { priority: S.uniqueSubjects(state.target.subjects) }));
      p.season = S.buildSeason(state);
    }
    return Board.applyMoves(p, state);
  }
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

  // ---------- page ----------
  function header() {
    return '<header class="top"><div class="brand"><h1>' + esc(t('appTitle')) + '</h1><p>' + esc(t('tagline')) + '</p></div>' +
      '<div class="lang" role="group" aria-label="' + esc(t('langLabel')) + '">' +
      '<button type="button" data-action="lang" data-lang="ka" aria-pressed="' + (state.lang === 'ka') + '">ქართ</button>' +
      '<button type="button" data-action="lang" data-lang="en" aria-pressed="' + (state.lang === 'en') + '">EN</button></div></header>';
  }
  function render() {
    document.documentElement.lang = state.lang;
    app.innerHTML = '<div class="page wide board-page">' + header() + Board.view() + '</div>';
    Board.after();
  }

  function why(key) { return '<details class="why"><summary>' + esc(t('why')) + '</summary><p>' + esc(t(key)) + '</p></details>'; }

  function explain(part, p) {
    var lessonD = part.lessons[0] ? dayLabel(lessonDate(part.lessons[0])) : '';
    var test = part.test ? p.tests.filter(function (x) { return x.id === part.test; })[0] : null;
    var s = t('kind_' + part.kind, { date: lessonD, k: part.step, n: part.of, test: test ? stopDayName(test) : '' });
    if (part.lessons.length === 1 && state.lessonNames[part.lessons[0]]) s += ': ' + state.lessonNames[part.lessons[0]];
    if (part.movedFrom) s += ' ' + t(part.movedFrom.why === 'cap' ? 'movedCap' : 'movedOff', { date: dayLabel(p.days[part.movedFrom.day].date) });
    return s;
  }

  function noteText(n) {
    if (n.type === 'runupSkipped') return t('noteRunupSkipped', { subject: n.subject, stop: stopName(n.stop), date: dayLabel(n.date) });
    var key = n.type === 'pushedOut' ? (season() ? 'notePushedOutPeriod' : 'notePushedOut') : 'noteDroppedOff';
    return t(key, { subject: n.subject, date: dayLabel(n.date) });
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
  function pageCount(p) { return season() && p && p.period ? pageOpts(p).length : 1; }

  // ---------- exam season ----------
  function stopName(s) {
    if (s.type === 'other' && s.name) return s.name;
    var n = s.isTarget ? 0 : msNumber(s.id);
    return t((s.isTarget ? 'tgType_' : 'msType_') + (s.type || (s.isTarget ? 'national' : 'mock'))) + (n ? ' ' + n : '');
  }
  // Milestones of the same type for the same exam are numbered by date (Mock exam 1, 2, 3); milestones without
  // a date come last. A milestone alone of its type, or one with its own name, gets no number.
  function subjectsKey(m) { return (m.subjects || []).map(S.subjectKey).sort().join('|'); }
  function msNumber(id) {
    var m = state.milestones.filter(function (x) { return x.id === id; })[0];
    if (!m) return 0;
    var same = state.milestones.filter(function (x) {
      return x.type === m.type && !(x.type === 'other' && x.name) && subjectsKey(x) === subjectsKey(m);
    });
    if (same.length < 2) return 0;
    same = same.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      if (a.x.date && b.x.date && a.x.date !== b.x.date) return a.x.date < b.x.date ? -1 : 1;
      if (!!a.x.date !== !!b.x.date) return a.x.date ? -1 : 1;
      return a.i - b.i;
    }).map(function (o) { return o.x; });
    return same.indexOf(m) + 1;
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
  function chosen() { return S.uniqueSubjects(state.target.subjects); }

  // Each exam subject gets its own milestones for the target exam's type, with suggested dates.
  var DEFAULT_MILESTONES = { national: ['mock', 'mock', 'mock'], session: ['midterm'], other: [] };
  var msSeq = 0;
  function newMilestone(type, subject) {
    return { id: 'm' + Date.now() + '-' + (msSeq++), type: type, name: '', date: '', subjects: subject ? [subject] : [] };
  }
  function defaultsFor(subject) {
    return (DEFAULT_MILESTONES[state.target.type] || []).map(function (type) { return newMilestone(type, subject); });
  }
  function defaultMilestones() {
    // Only when the student has not set any milestone date or name yet: never throw away their work.
    if (state.milestones.some(function (m) { return (m.date && !m.suggested) || m.name; })) return;
    state.milestones = [];
    chosen().forEach(function (s) { state.milestones = state.milestones.concat(defaultsFor(s)); });
    suggestDates();
  }
  // A subject added to the target exam gets its own milestones; removed, its own milestones go
  // and it is unticked on shared ones.
  function addExamSubject(name) {
    var k = S.subjectKey(name);
    if (chosen().some(function (s) { return S.subjectKey(s) === k; })) return;
    state.target.subjects = state.target.subjects.concat([name]);
    state.milestones = state.milestones.concat(defaultsFor(name));
    suggestDates();
  }
  function removeExamSubject(name) {
    var k = S.subjectKey(name);
    function other(s) { return S.subjectKey(s) !== k; }
    state.target.subjects = state.target.subjects.filter(other);
    if (state.target.subjectDates) delete state.target.subjectDates[k];
    state.milestones = state.milestones.filter(function (m) {
      return !((m.subjects || []).length === 1 && !other(m.subjects[0]));
    }).map(function (m) { m.subjects = (m.subjects || []).filter(other); return m; });
    suggestDates();
  }
  // The group a milestone belongs to: its one subject, or '*' for a milestone shared by several (or none).
  function msGroup(m) { return (m.subjects || []).length === 1 ? S.subjectKey(m.subjects[0]) : '*'; }
  // Milestones without a date set by the student get a suggested one, spread evenly up to that subject's
  // exam day (shared ones: up to the first exam day). A date the student set is never changed.
  function suggestDates() {
    var dateOf = (S.buildSeason(state).target || {}).dateOf || {};
    var groups = {};
    state.milestones.forEach(function (m) { (groups[msGroup(m)] = groups[msGroup(m)] || []).push(m); });
    Object.keys(groups).forEach(function (g) {
      var list = groups[g], dates = S.suggestDates(state.start, dateOf[g] || state.target.date, list.length);
      list.forEach(function (m, i) {
        if (m.date && !m.suggested) return;
        m.date = dates[i] || '';
        m.suggested = !!dates[i];
      });
    });
  }
  // What is still missing before the period calendar can be planned, as a string key ('' when nothing is).
  function missing(sea) {
    if (!state.target.date) return 'bNeedTargetDate';
    if (!sea.target || sea.target.days <= 0) return 'bNeedTargetFuture';
    if (!sea.subjects.length) return 'bNeedTargetSubjects';
    return '';
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
    if (what === 'blank') return [R.layout(renderOpts(S.buildPlan(state), true), measure)];
    var p = plan();
    if (season() && p.period) return pageOpts(p).map(function (o) { return R.layout(o, measure); });
    return [R.layout(renderOpts(p, false), measure)];
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
      // National exams in about 7 months, one subject every 2 days, each with 3 mock exams of its own.
      var subs = [n.geo, n.eng, n.math], sd = {};
      sd[S.subjectKey(n.eng)] = S.addDays(state.start, 212);
      sd[S.subjectKey(n.math)] = S.addDays(state.start, 214);
      state.target = { type: 'national', name: '', date: S.addDays(state.start, 210), subjects: subs, subjectDates: sd };
      state.milestones = [];
      subs.forEach(function (s, j) {
        [21, 91, 161].forEach(function (d, i) {
          state.milestones.push({ id: 'm' + j + i, type: 'mock', name: '', date: S.addDays(state.start, d + j * 2), subjects: [s] });
        });
      });
      state.topics = { m00: {}, m20: {}, m21: {} };
      state.topics.m20[S.subjectKey(n.math)] = ka ? 'ფუნქციები, განტოლებები' : 'Functions, Equations';
      state.topics.m00[S.subjectKey(n.geo)] = ka ? 'ესეს სტრუქტურა' : 'Essay structure';
      state.topics.m21[S.subjectKey(n.math)] = ka ? 'გეომეტრია' : 'Geometry, Probability';
      state.tests = [{ id: 't' + Date.now(), subject: n.math, date: S.addDays(state.start, 8), slot: 'auto' }];
    }
    state.daysOff = [];
    state.lessonNames = {};
    state.done = {};
    state.moved = {};
  }

  // ---------- events ----------
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var a = el.getAttribute('data-action');
    if (a === 'lang') state.lang = el.getAttribute('data-lang');
    else if (a === 'mode') {
      state.mode = el.getAttribute('data-mode');
      if (season() && !state.milestones.length && !state.target.date) defaultMilestones();
    }
    else if (a === 'print') { doPrint(el.getAttribute('data-what')); return; }
    else if (a === 'png') { savePng(el.getAttribute('data-what')); return; }
    else if (a === 'share') { sharePng(el.getAttribute('data-what')); return; }
    else return;
    ui.status = '';
    save(); render();
  });
  // Typing saves without redrawing, so the cursor stays put.
  app.addEventListener('input', function (e) {
    if (e.target.getAttribute('data-field') === 'name') { state.name = e.target.value; save(); }
  });

  Board.init({
    root: app, getState: function () { return state; }, setState: function (s) { state = Object.assign(fresh(), s); },
    t: t, esc: esc, dayLabel: dayLabel, wd: wd, dm: dm, fullDate: fullDate, save: save, render: render, plan: plan,
    explain: explain, noteText: noteText, why: why, exportPanel: exportPanel, pageCount: pageCount, example: example,
    season: season, buildSeason: function () { return S.buildSeason(state); }, stopName: stopName, left: left, testLabel: testLabel,
    topicText: topicText, chosen: chosen, defaultMilestones: defaultMilestones, suggestDates: suggestDates, missing: missing,
    addExamSubject: addExamSubject, removeExamSubject: removeExamSubject, newMilestone: newMilestone,
    reset: function () {
      var lang = state.lang, mode = state.mode;
      state = fresh(); state.lang = lang; state.mode = mode;
      if (season()) defaultMilestones();
    }
  });
  render();
  // Redraw once the Georgian font has loaded.
  fontsReady().then(render);
})();

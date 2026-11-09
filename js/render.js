/*
 * Draws the printable 2-week calendar.
 * layout() turns a plan into a list of drawing operations; toSVG() and toCanvas() paint the same list,
 * so print/PDF and the PNG image always match.
 * Each box type has its own colour, and its shape still tells it apart on black-and-white printers:
 *   class = blue dashed outline, review = green outline + tick box, test prep = heavy orange outline, test = filled red.
 */
(function () {
  'use strict';

  var W = 1485, H = 1050;            // A4 landscape at 5 units per mm
  var FONT = '"Noto Sans Georgian", "Noto Sans", system-ui, sans-serif';
  var INK = '#111111', GREY = '#555555', OFF = '#e2e2e2', WHITE = '#ffffff';
  // Colours per box type: outline, fill, text. Dark enough to read, light fills to save ink.
  var C = {
    cls: { stroke: '#3f6aa8', fill: '#eaf1fb', text: '#1b365d' },
    review: { stroke: '#2e7d32', fill: '#e4f3e5', text: INK },
    prep: { stroke: '#e07b00', fill: '#fff2dd', text: INK },
    test: { fill: '#c62828', text: WHITE },
    practice: { stroke: '#8e24aa', fill: '#f6e8fa', text: INK },
    cum: { stroke: '#6d4c41', fill: '#f5efe9', text: INK }
  };

  // Drawing helpers shared by every printable page: they append to one list of operations.
  function painter(measure, t) {
    var ops = [];
    function rect(x, y, w, h, s) { ops.push(Object.assign({ t: 'rect', x: x, y: y, w: w, h: h }, s)); }
    function line(x1, y1, x2, y2, s) { ops.push(Object.assign({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2 }, s)); }
    function text(x, y, str, s) {
      s = s || {};
      var size = s.size || 13, bold = !!s.bold;
      if (s.maxW) str = fit(str, size, bold, s.maxW);
      ops.push({ t: 'text', x: x, y: y, text: str, size: size, bold: bold, fill: s.fill || INK, anchor: s.anchor || 'start', rot: s.rot || 0 });
    }
    function fit(str, size, bold, maxW) {
      if (measure(str, size, bold) <= maxW) return str;
      while (str.length > 1 && measure(str + '…', size, bold) > maxW) str = str.slice(0, -1);
      return str.replace(/[\s·,:]+$/, '') + '…';
    }
    // Split text into lines no wider than maxW; the last allowed line ends in … if text is left over.
    function wrap(str, size, bold, maxW, maxLines) {
      var words = String(str).split(/\s+/).filter(Boolean), lines = [], cur = '';
      for (var i = 0; i < words.length; i++) {
        var next = cur ? cur + ' ' + words[i] : words[i];
        if (!cur || measure(next, size, bold) <= maxW) { cur = next; continue; }
        lines.push(cur); cur = words[i];
        if (lines.length === maxLines) { cur = ''; lines[maxLines - 1] = fit(lines[maxLines - 1] + ' ' + words.slice(i).join(' '), size, bold, maxW); break; }
      }
      if (cur) lines.push(fit(cur, size, bold, maxW));
      return lines;
    }
    // Title on the left, a line to write your name on the right.
    function header(title, sub, name) {
      var M = 36;
      text(M, M + 24, title, { size: 26, bold: true });
      if (sub) text(M + measure(title, 26, true) + 16, M + 24, sub, { size: 16, fill: GREY });
      var nameLabel = t('printName') + ':';
      var nx = W - M - 330;
      text(nx, M + 24, nameLabel, { size: 16 });
      var lx = nx + measure(nameLabel, 16, false) + 8;
      line(lx, M + 28, W - M, M + 28, { stroke: INK, sw: 1 });
      if (name) text(lx + 6, M + 22, name, { size: 17, bold: true, maxW: W - M - lx - 10 });
    }
    return { ops: ops, rect: rect, line: line, text: text, fit: fit, wrap: wrap, header: header };
  }

  /*
   * o.page = { from: first week index, weeks: 1 or 2, n, total } draws one page of a longer exam season period.
   * o.season adds the exam season boxes and legend; o.testLabel(test) labels tests and milestones.
   */
  function layout(o, measure) {
    var t = o.t, plan = o.plan, blank = !plan;
    var P = painter(measure, t), ops = P.ops, rect = P.rect, line = P.line, text = P.text;
    // 2 weeks when the plan starts on a Monday (and for the blank template), else 3 in a tighter layout.
    var weeks = o.page ? o.page.weeks : plan ? plan.days.length / 7 : 2, tight = weeks > 2;
    var dayOffset = o.page ? o.page.from * 7 : 0;
    var M = 36, LW = 58, legendH = 84;
    var colW = (W - 2 * M - LW) / 7;
    var gridTop = M + 44, gap = tight ? 8 : 14;
    var GH = (H - M - legendH - 12 - gap * (weeks - 1) - gridTop) / weeks;
    var HH = tight ? 26 : 34, CH = tight ? 20 : 26, rowH = (GH - HH - CH) / 3;
    var headSize = tight ? 13 : 15, cntSize = tight ? 11 : 13, cntY = CH - (tight ? 6 : 8);
    var ih = tight ? 16 : 19, step = tight ? 18 : 22, itemSize = tight ? 12 : 13;

    // Title row
    P.header(o.title || t('printTitle'), blank ? '' : o.range, o.name);

    for (var week = 0; week < weeks; week++) {
      var top = gridTop + week * (GH + gap);
      var x0 = M + LW;
      // header + row labels
      rect(M, top, W - 2 * M, GH, { stroke: INK, sw: 1.6 });
      ['m', 'a', 'e'].forEach(function (slot, r) {
        var y = top + HH + r * rowH;
        text(M + LW / 2 + 5, y + rowH / 2, t('slot_' + slot), { size: tight ? 12 : 13, bold: true, anchor: 'middle', rot: -90 });
      });
      text(M + LW / 2, top + HH + 3 * rowH + cntY, t('printBoxes'), { size: tight ? 10 : 11, anchor: 'middle', fill: GREY });

      for (var c = 0; c < 7; c++) {
        var di = dayOffset + week * 7 + c;
        var day = plan ? plan.days[di] : null;
        var cx = x0 + c * colW;
        if (day && day.off) rect(cx, top + HH, colW, 3 * rowH, { fill: OFF });
        if (day) {
          var f = o.fmtDay(day.date);
          text(cx + colW / 2, top + HH - 11 + (tight ? 2 : 0), f.wd + ' ' + f.dm, { size: headSize, bold: true, anchor: 'middle', maxW: colW - 8 });
          if (day.off && !day.before && !day.after) text(cx + colW / 2, top + HH + 1.5 * rowH + 5, t('dayOff'), { size: headSize, bold: true, anchor: 'middle', fill: GREY });
          var cnt = day.load + ' / 4' + (day.over ? '  !' : '');
          if (!day.off) text(cx + colW / 2, top + HH + 3 * rowH + cntY, cnt, { size: cntSize, bold: day.over, anchor: 'middle' });
        } else {
          text(cx + colW / 2, top + HH + 3 * rowH + cntY, '___ / 4', { size: cntSize, anchor: 'middle', fill: GREY });
        }
        if (day && !day.off) ['m', 'a', 'e'].forEach(function (slot, r) { drawCell(day, slot, cx, top + HH + r * rowH); });
      }
      // grid lines
      line(M + LW, top, M + LW, top + GH, { stroke: INK, sw: 1.2 });
      for (c = 1; c < 7; c++) line(x0 + c * colW, top, x0 + c * colW, top + GH, { stroke: GREY, sw: 0.8 });
      line(M, top + HH, W - M, top + HH, { stroke: INK, sw: 1.2 });
      for (var r = 1; r < 3; r++) line(M, top + HH + r * rowH, W - M, top + HH + r * rowH, { stroke: GREY, sw: 0.8 });
      line(M, top + HH + 3 * rowH, W - M, top + HH + 3 * rowH, { stroke: INK, sw: 1.2 });
    }

    function drawCell(day, slot, cx, cy) {
      var items = [];
      var testKeys = {};
      day.tests.forEach(function (tt) { if (tt.slot === slot) { items.push({ type: 'test', label: o.testLabel ? o.testLabel(tt) : t('printTest') + ': ' + tt.subject }); testKeys[tt.key] = true; } });
      day.classes.forEach(function (cl) { if (cl.slot === slot && !testKeys[cl.key]) items.push({ type: 'class', label: cl.subject }); });
      day.boxes.forEach(function (b) { if (b.slot === slot) items.push(boxItem(b)); });
      var pad = 5, ty = ih - 5;
      var fitN = Math.floor((rowH - pad) / step);
      var shown = items.length > fitN ? items.slice(0, fitN - 1) : items;
      var iw = colW - 2 * pad;
      shown.forEach(function (it, k) {
        var x = cx + pad, y = cy + pad + k * step;
        if (it.type === 'test') {
          rect(x, y, iw, ih, { fill: C.test.fill, r: 2 });
          text(x + 6, y + ty, it.label, { size: itemSize, bold: true, fill: C.test.text, maxW: iw - 10 });
        } else if (it.type === 'class') {
          rect(x, y, iw, ih, { stroke: C.cls.stroke, sw: 1.2, dash: [4, 3], fill: C.cls.fill, r: 2 });
          text(x + 6, y + ty, it.label, { size: itemSize, fill: C.cls.text, maxW: iw - 10 });
        } else {
          // heavy = test prep / practice test, dotted = old topics, solid = every other review
          var c = it.practice ? C.practice : it.cum ? C.cum : it.prep ? C.prep : C.review;
          var heavy = it.prep || it.practice;
          var st = { stroke: c.stroke, sw: heavy ? 3 : it.cum ? 2 : 1.5, fill: c.fill, r: 2 };
          if (it.cum) st.dash = [1.5, 3];
          rect(x, y, iw, ih, st);
          var tb = ih - 8;
          rect(x + 5, y + 4, tb, tb, { stroke: INK, sw: 1.2, fill: WHITE });
          text(x + 10 + tb, y + ty, it.label, { size: itemSize, bold: heavy, fill: c.text, maxW: iw - 14 - tb });
        }
      });
      if (shown.length < items.length) {
        text(cx + pad + 2, cy + pad + shown.length * step + ty, t('printMore', { n: items.length - shown.length }), { size: itemSize - 1, bold: true });
      }
    }

    function boxItem(b) {
      var k = b.parts[0].kind;
      if (k === 'PT') return { type: 'box', practice: true, label: t('printPracticeTest') + ': ' + b.subject };
      if (k === 'FX') return { type: 'box', label: t('printFixErrors') + ': ' + b.subject };
      if (k === 'SE') return { type: 'box', label: t('printSortErrors') + ': ' + b.subject };
      if (k === 'CUM') return { type: 'box', cum: true, label: b.subject + ': ' + t('printOldTopics') };
      var prep = b.parts.some(function (p) { return p.kind === 'P'; });
      var bits = [];
      b.parts.forEach(function (p) {
        if (p.kind === 'P') return;
        if (p.kind === 'Q') { bits.push(t('printBeforeTest')); return; }
        p.lessons.forEach(function (id) { var l = o.lessonLabel(id); if (bits.indexOf(l) < 0) bits.push(l); });
      });
      // Exam season: subject first, so several test-prep boxes on one day stay readable when cut short.
      var label = prep && o.season ? b.subject + ': ' + t('printPrep') + (bits.length ? ' · ' + bits.join(', ') : '')
        : (prep ? t('printPrep') + ': ' : '') + b.subject + (bits.length ? ' · ' + bits.join(', ') : '');
      return { type: 'box', prep: prep, label: label };
    }

    // Legend
    var ly = gridTop + weeks * GH + (weeks - 1) * gap + 14;
    var lx2 = M, sw = 34;
    function legendItem(kind, label) {
      if (kind === 'class') rect(lx2, ly, sw, 18, { stroke: C.cls.stroke, sw: 1.2, dash: [4, 3], fill: C.cls.fill, r: 2 });
      if (kind === 'review') { rect(lx2, ly, sw, 18, { stroke: C.review.stroke, sw: 1.5, fill: C.review.fill, r: 2 }); rect(lx2 + 5, ly + 4, 10, 10, { stroke: INK, sw: 1.2, fill: WHITE }); }
      if (kind === 'prep') { rect(lx2, ly, sw, 18, { stroke: C.prep.stroke, sw: 3, fill: C.prep.fill, r: 2 }); rect(lx2 + 5, ly + 4, 10, 10, { stroke: INK, sw: 1.2, fill: WHITE }); }
      if (kind === 'practice') { rect(lx2, ly, sw, 18, { stroke: C.practice.stroke, sw: 3, fill: C.practice.fill, r: 2 }); rect(lx2 + 5, ly + 4, 10, 10, { stroke: INK, sw: 1.2, fill: WHITE }); }
      if (kind === 'cum') { rect(lx2, ly, sw, 18, { stroke: C.cum.stroke, sw: 2, dash: [1.5, 3], fill: C.cum.fill, r: 2 }); rect(lx2 + 5, ly + 4, 10, 10, { stroke: INK, sw: 1.2, fill: WHITE }); }
      if (kind === 'test') rect(lx2, ly, sw, 18, { fill: C.test.fill, r: 2 });
      text(lx2 + sw + 8, ly + 14, label, { size: 14 });
      lx2 += sw + 8 + measure(label, 14, false) + (o.season ? 22 : 30);
    }
    legendItem('class', t('legendClass'));
    legendItem('review', t('legendReview'));
    legendItem('prep', t('legendPrep'));
    if (o.season) {
      // Mock exams get no practice test: show it in the legend only when the calendar has one.
      if (plan.days.some(function (d) { return d.boxes.some(function (b) { return b.parts[0].kind === 'PT'; }); })) legendItem('practice', t('legendPractice'));
      legendItem('cum', t('legendCum'));
    }
    legendItem('test', t(o.season ? 'legendExam' : 'legendTest'));
    text(M, ly + 44, t('legendRule'), { size: 16, bold: true, maxW: W - 2 * M });
    text(M, ly + 68, t(o.season ? 'legendCapSeason' : 'legendCap'), { size: 14, maxW: W - 2 * M - 260 });
    text(W - M, ly + 68, t('footer'), { size: 12, fill: GREY, anchor: 'end' });

    return ops;
  }

  /*
   * The season map: one A4 landscape page.
   * o = { t, season (Schedule.buildSeason), name, fmtDate(iso), stopName(stop), left(stop), topics(stopId, subject) }
   * One row per exam subject (season.tracks): its milestones and its exam day, with topics for each stretch.
   * The 4-step cycle at the bottom uses the calendar's box outlines:
   *   Understand = dashed (class), Recall = solid (review), Space = dotted (old topics), Simulate = heavy (practice test).
   */
  function layoutSeason(o, measure) {
    var t = o.t, sea = o.season;
    var P = painter(measure, t), rect = P.rect, line = P.line, text = P.text;
    var M = 36;
    P.header(t('printSeasonTitle'), sea.target ? o.fmtDate(sea.start) + ' – ' + o.fmtDate(sea.target.last || sea.target.date) : '', o.name);

    // ---- One row per exam subject: start → its milestones → its exam day, all on one date scale ----
    // Topics for each stretch are written above the line; an empty stretch gets ruled lines to write on.
    var cycleTop = H - M - 128;
    var top = 92, bottom = cycleTop - 22;
    text(M, top, t('timelineHeading'), { size: 16, bold: true });
    var tracks = sea.tracks || [];
    var SW = 180, G = 130;
    var rows = Math.max(1, tracks.length);
    var rh = Math.min(230, (bottom - top - 12) / rows);
    var x0 = M + SW + 30, x1 = W - M - G / 2;
    var total = 1;
    tracks.forEach(function (tr) { tr.stops.forEach(function (x) { total = Math.max(total, x.stop.days); }); });
    tracks.forEach(function (tr, r) {
      var y0 = top + 12 + r * rh, ly = y0 + Math.round(rh * 0.56);
      P.wrap(tr.subject, 16, true, SW - 10, 2).forEach(function (l, k) { text(M + 6, ly - 4 + k * 19, l, { size: 16, bold: true }); });
      var n = tr.stops.length;
      var xs = tr.stops.map(function (x) { return x0 + (x1 - x0) * x.stop.days / total; });
      for (var i = 0; i < n; i++) xs[i] = Math.max(xs[i], (i ? xs[i - 1] : x0) + G);
      for (i = n - 1; i >= 0; i--) xs[i] = Math.min(xs[i], i === n - 1 ? x1 : xs[i + 1] - G);
      line(x0, ly, n ? xs[n - 1] : x0 + G, ly, { stroke: INK, sw: 2.5 });
      rect(x0 - 6, ly - 6, 12, 12, { fill: GREY, r: 6 });
      if (r === 0) text(x0, ly + 24, o.fmtDate(sea.start), { size: 12, fill: GREY, anchor: 'middle' });
      var LH = 16, maxLines = Math.max(1, Math.floor((ly - y0 - 18) / LH));
      tr.stops.forEach(function (x, k) {
        var s = x.stop, cx = xs[k], prev = k ? xs[k - 1] : x0;
        var segW = cx - prev - 22;
        var topics = String(o.topics(s.id, tr.subject) || '').split(/[,;\n]+/).map(function (q) { return q.trim(); }).filter(Boolean);
        if (topics.length) {
          var lines = [];
          topics.forEach(function (tp) { P.wrap('• ' + tp, 13, false, segW, 2).forEach(function (l, j) { lines.push((j ? '   ' : '') + l); }); });
          if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = P.fit(lines[maxLines - 1] + ' …', 13, false, segW); }
          lines.forEach(function (l, j) { text(prev + 11, ly - 10 - (lines.length - 1 - j) * LH, l, { size: 13, maxW: segW }); });
        } else {
          for (var j = 1; j <= Math.min(3, maxLines); j++) line(prev + 11, ly - 6 - j * LH, cx - 11, ly - 6 - j * LH, { stroke: OFF, sw: 1 });
        }
        if (s.isTarget) rect(cx - 10, ly - 10, 20, 20, { fill: INK, r: 3 });
        else rect(cx - 8, ly - 8, 16, 16, { fill: WHITE, stroke: INK, sw: 2.5, r: 8 });
        text(cx, ly + 24, o.stopName(s), { size: 13, bold: true, anchor: 'middle', maxW: G - 8 });
        text(cx, ly + 40, o.fmtDate(s.date), { size: 12, anchor: 'middle' });
        if (rh > 110) text(cx, ly + 55, o.left(s), { size: 11, fill: GREY, anchor: 'middle', maxW: G - 8 });
      });
      if (r < rows - 1) line(M, y0 + rh, W - M, y0 + rh, { stroke: OFF, sw: 1 });
    });
    if (!tracks.length) text(M, top + 40, t('needTarget'), { size: 15, fill: GREY });

    // ---- The 4-step cycle ----
    text(M, cycleTop + 14, t('cycleHeading'), { size: 16, bold: true });
    var steps = [
      ['cycleUnderstand', { stroke: C.cls.stroke, sw: 1.6, dash: [6, 4], fill: C.cls.fill }],
      ['cycleRecall', { stroke: C.review.stroke, sw: 1.8, fill: C.review.fill }],
      ['cycleSpace', { stroke: C.cum.stroke, sw: 2.2, dash: [1.5, 4], fill: C.cum.fill }],
      ['cycleSimulate', { stroke: C.practice.stroke, sw: 4, fill: C.practice.fill }]
    ];
    var AW = 40, bw = (W - 2 * M - 3 * AW) / 4, by = cycleTop + 28, bh = 74;
    steps.forEach(function (s, k) {
      var bx = M + k * (bw + AW);
      rect(bx, by, bw, bh, Object.assign({ r: 4 }, s[1]));
      text(bx + 14, by + 28, (k + 1) + '. ' + t(s[0]), { size: 18, bold: true, maxW: bw - 24 });
      P.wrap(t(s[0] + 'When'), 13, false, bw - 28, 2).forEach(function (l, j) { text(bx + 14, by + 50 + j * 17, l, { size: 13 }); });
      if (k < 3) text(bx + bw + AW / 2, by + bh / 2 + 10, '→', { size: 28, bold: true, anchor: 'middle' });
    });
    text(W - M, H - 12, t('footer'), { size: 12, fill: GREY, anchor: 'end' });
    return P.ops;
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function toSVG(ops) {
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" font-family=\'' + FONT + '\'>',
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>'];
    ops.forEach(function (op) {
      if (op.t === 'rect') {
        out.push('<rect x="' + op.x + '" y="' + op.y + '" width="' + op.w + '" height="' + op.h + '"' + (op.r ? ' rx="' + op.r + '"' : '') +
          ' fill="' + (op.fill || 'none') + '"' + (op.stroke ? ' stroke="' + op.stroke + '" stroke-width="' + op.sw + '"' : '') +
          (op.dash ? ' stroke-dasharray="' + op.dash.join(' ') + '"' : '') + '/>');
      } else if (op.t === 'line') {
        out.push('<line x1="' + op.x1 + '" y1="' + op.y1 + '" x2="' + op.x2 + '" y2="' + op.y2 + '" stroke="' + op.stroke + '" stroke-width="' + op.sw + '"/>');
      } else if (op.t === 'text') {
        out.push('<text x="' + op.x + '" y="' + op.y + '" font-size="' + op.size + '" font-weight="' + (op.bold ? 700 : 400) + '" fill="' + op.fill + '"' +
          (op.anchor !== 'start' ? ' text-anchor="' + op.anchor + '"' : '') +
          (op.rot ? ' transform="rotate(' + op.rot + ' ' + op.x + ' ' + op.y + ')"' : '') + '>' + esc(op.text) + '</text>');
      }
    });
    out.push('</svg>');
    return out.join('');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (!r) { ctx.rect(x, y, w, h); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function toCanvas(ops, scale) {
    var cv = document.createElement('canvas');
    cv.width = W * scale; cv.height = H * scale;
    var ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ops.forEach(function (op) {
      ctx.save();
      if (op.t === 'rect') {
        roundRect(ctx, op.x, op.y, op.w, op.h, op.r);
        if (op.fill) { ctx.fillStyle = op.fill; ctx.fill(); }
        if (op.stroke) { ctx.strokeStyle = op.stroke; ctx.lineWidth = op.sw; ctx.setLineDash(op.dash || []); ctx.stroke(); }
      } else if (op.t === 'line') {
        ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2);
        ctx.strokeStyle = op.stroke; ctx.lineWidth = op.sw; ctx.stroke();
      } else if (op.t === 'text') {
        ctx.font = (op.bold ? 700 : 400) + ' ' + op.size + 'px ' + FONT;
        ctx.fillStyle = op.fill;
        ctx.textAlign = op.anchor === 'middle' ? 'center' : op.anchor === 'end' ? 'right' : 'left';
        ctx.translate(op.x, op.y);
        if (op.rot) ctx.rotate(op.rot * Math.PI / 180);
        ctx.fillText(op.text, 0, 0);
      }
      ctx.restore();
    });
    return cv;
  }

  function measurer() {
    var ctx = document.createElement('canvas').getContext('2d');
    return function (str, size, bold) {
      ctx.font = (bold ? 700 : 400) + ' ' + size + 'px ' + FONT;
      return ctx.measureText(str).width;
    };
  }

  window.Render = { layout: layout, layoutSeason: layoutSeason, toSVG: toSVG, toCanvas: toCanvas, measurer: measurer, W: W, H: H };
})();

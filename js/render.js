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
    test: { fill: '#c62828', text: WHITE }
  };

  function layout(o, measure) {
    var t = o.t, plan = o.plan, blank = !plan;
    var ops = [];
    var M = 36, LW = 58, legendH = 84;
    var colW = (W - 2 * M - LW) / 7;
    var gridTop = M + 44, gap = 14;
    var GH = (H - M - legendH - 12 - gap - gridTop) / 2;
    var HH = 34, CH = 26, rowH = (GH - HH - CH) / 3;

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

    // Title row
    text(M, M + 24, t('printTitle'), { size: 26, bold: true });
    if (!blank) {
      var tw = measure(t('printTitle'), 26, true);
      text(M + tw + 16, M + 24, o.range, { size: 16, fill: GREY });
    }
    var nameLabel = t('printName') + ':';
    var nx = W - M - 330;
    text(nx, M + 24, nameLabel, { size: 16 });
    var lx = nx + measure(nameLabel, 16, false) + 8;
    line(lx, M + 28, W - M, M + 28, { stroke: INK, sw: 1 });
    if (o.name) text(lx + 6, M + 22, o.name, { size: 17, bold: true, maxW: W - M - lx - 10 });

    for (var week = 0; week < 2; week++) {
      var top = gridTop + week * (GH + gap);
      var x0 = M + LW;
      // header + row labels
      rect(M, top, W - 2 * M, GH, { stroke: INK, sw: 1.6 });
      ['m', 'a', 'e'].forEach(function (slot, r) {
        var y = top + HH + r * rowH;
        text(M + LW / 2 + 5, y + rowH / 2, t('slot_' + slot), { size: 13, bold: true, anchor: 'middle', rot: -90 });
      });
      text(M + LW / 2, top + HH + 3 * rowH + 18, t('printBoxes'), { size: 11, anchor: 'middle', fill: GREY });

      for (var c = 0; c < 7; c++) {
        var di = week * 7 + c;
        var day = plan ? plan.days[di] : null;
        var cx = x0 + c * colW;
        if (day && day.off) rect(cx, top + HH, colW, 3 * rowH, { fill: OFF });
        if (day) {
          var f = o.fmtDay(day.date);
          text(cx + colW / 2, top + 23, f.wd + ' ' + f.dm, { size: 15, bold: true, anchor: 'middle', maxW: colW - 8 });
          if (day.off && !day.before) text(cx + colW / 2, top + HH + 1.5 * rowH + 5, t('dayOff'), { size: 15, bold: true, anchor: 'middle', fill: GREY });
          var cnt = day.load + ' / 4' + (day.over ? '  !' : '');
          if (!day.off) text(cx + colW / 2, top + HH + 3 * rowH + 18, cnt, { size: 13, bold: day.over, anchor: 'middle' });
        } else {
          text(cx + colW / 2, top + HH + 3 * rowH + 18, '___ / 4', { size: 13, anchor: 'middle', fill: GREY });
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
      day.tests.forEach(function (tt) { if (tt.slot === slot) { items.push({ type: 'test', label: t('printTest') + ': ' + tt.subject }); testKeys[tt.key] = true; } });
      day.classes.forEach(function (cl) { if (cl.slot === slot && !testKeys[cl.key]) items.push({ type: 'class', label: cl.subject }); });
      day.boxes.forEach(function (b) { if (b.slot === slot) items.push(boxItem(b)); });
      var pad = 5, ih = 19, step = 22;
      var fitN = Math.floor((rowH - pad) / step);
      var shown = items.length > fitN ? items.slice(0, fitN - 1) : items;
      var iw = colW - 2 * pad;
      shown.forEach(function (it, k) {
        var x = cx + pad, y = cy + pad + k * step;
        if (it.type === 'test') {
          rect(x, y, iw, ih, { fill: C.test.fill, r: 2 });
          text(x + 6, y + 14, it.label, { size: 13, bold: true, fill: C.test.text, maxW: iw - 10 });
        } else if (it.type === 'class') {
          rect(x, y, iw, ih, { stroke: C.cls.stroke, sw: 1.2, dash: [4, 3], fill: C.cls.fill, r: 2 });
          text(x + 6, y + 14, it.label, { size: 13, fill: C.cls.text, maxW: iw - 10 });
        } else {
          var c = it.prep ? C.prep : C.review;
          rect(x, y, iw, ih, { stroke: c.stroke, sw: it.prep ? 3 : 1.5, fill: c.fill, r: 2 });
          rect(x + 5, y + 4, 11, 11, { stroke: INK, sw: 1.2, fill: WHITE });
          text(x + 21, y + 14, it.label, { size: 13, bold: it.prep, fill: c.text, maxW: iw - 25 });
        }
      });
      if (shown.length < items.length) {
        text(cx + pad + 2, cy + pad + shown.length * step + 14, t('printMore', { n: items.length - shown.length }), { size: 12, bold: true });
      }
    }

    function boxItem(b) {
      var prep = b.parts.some(function (p) { return p.kind === 'P'; });
      var bits = [];
      b.parts.forEach(function (p) {
        if (p.kind === 'P') return;
        if (p.kind === 'Q') { bits.push(t('printBeforeTest')); return; }
        p.lessons.forEach(function (id) { var l = o.lessonLabel(id); if (bits.indexOf(l) < 0) bits.push(l); });
      });
      var label = (prep ? t('printPrep') + ': ' : '') + b.subject + (bits.length ? ' · ' + bits.join(', ') : '');
      return { type: 'box', prep: prep, label: label };
    }

    // Legend
    var ly = gridTop + 2 * GH + gap + 14;
    var lx2 = M, sw = 34;
    function legendItem(kind, label) {
      if (kind === 'class') rect(lx2, ly, sw, 18, { stroke: C.cls.stroke, sw: 1.2, dash: [4, 3], fill: C.cls.fill, r: 2 });
      if (kind === 'review') { rect(lx2, ly, sw, 18, { stroke: C.review.stroke, sw: 1.5, fill: C.review.fill, r: 2 }); rect(lx2 + 5, ly + 4, 10, 10, { stroke: INK, sw: 1.2, fill: WHITE }); }
      if (kind === 'prep') { rect(lx2, ly, sw, 18, { stroke: C.prep.stroke, sw: 3, fill: C.prep.fill, r: 2 }); rect(lx2 + 5, ly + 4, 10, 10, { stroke: INK, sw: 1.2, fill: WHITE }); }
      if (kind === 'test') rect(lx2, ly, sw, 18, { fill: C.test.fill, r: 2 });
      text(lx2 + sw + 8, ly + 14, label, { size: 14 });
      lx2 += sw + 8 + measure(label, 14, false) + 30;
    }
    legendItem('class', t('legendClass'));
    legendItem('review', t('legendReview'));
    legendItem('prep', t('legendPrep'));
    legendItem('test', t('legendTest'));
    text(M, ly + 44, t('legendRule'), { size: 16, bold: true, maxW: W - 2 * M });
    text(M, ly + 68, t('legendCap'), { size: 14, maxW: W - 2 * M - 260 });
    text(W - M, ly + 68, t('footer'), { size: 12, fill: GREY, anchor: 'end' });

    return ops;
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

  window.Render = { layout: layout, toSVG: toSVG, toCanvas: toCanvas, measurer: measurer, W: W, H: H };
})();

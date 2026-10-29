/* ===========================================================
   Shuffle Lab — SVG 공용 도구 (막대그래프, 꺾은선그래프)
   =========================================================== */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'text') node.textContent = attrs[k];
        else if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
      });
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }

  function viewSize(svg) {
    const vb = svg.viewBox.baseVal;
    return { w: vb.width, h: vb.height };
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * p;
  }

  /* opts: { bars:[{label, value, cls, title}], yMax, yFmt, xTitle, yTitle } */
  function barChart(svg, opts) {
    clear(svg);
    const { w, h } = viewSize(svg);
    const m = { l: 46, r: 12, t: 14, b: opts.xTitle ? 42 : 26 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const bars = opts.bars;
    const yMax = opts.yMax || niceMax(Math.max(...bars.map((b) => b.value), 1e-9));
    const yFmt = opts.yFmt || ((v) => String(v));
    const g = el('g', { transform: `translate(${m.l},${m.t})` }, svg);
    const axis = el('g', { class: 'axis' }, g);
    for (let i = 0; i <= 5; i++) {
      const v = (yMax * i) / 5, y = ih - (ih * i) / 5;
      el('line', { x1: 0, x2: iw, y1: y, y2: y, class: 'gridline' }, axis);
      el('text', { x: -6, y: y + 4, 'text-anchor': 'end', text: yFmt(v) }, axis);
    }
    const bw = iw / Math.max(bars.length, 1);
    const every = Math.ceil(bars.length / 24);
    bars.forEach((b, i) => {
      const bh = Math.max(0, (ih * Math.min(b.value, yMax)) / yMax);
      const r = el('rect', {
        x: i * bw + bw * 0.12, y: ih - bh, width: bw * 0.76, height: bh,
        class: 'bar ' + (b.cls || ''), rx: 2,
      }, g);
      if (b.title) el('title', { text: b.title }, r);
      if (i % every === 0 || b.cls) {
        el('text', { x: i * bw + bw / 2, y: ih + 16, 'text-anchor': 'middle', text: b.label, class: b.cls ? 'lbl ' + b.cls : 'lbl' }, g);
      }
    });
    if (opts.xTitle) el('text', { x: iw / 2, y: ih + 36, 'text-anchor': 'middle', text: opts.xTitle, class: 'axis-title' }, g);
    if (opts.yTitle) el('text', { x: 0, y: -4, 'text-anchor': 'start', text: opts.yTitle, class: 'axis-title' }, g);
    return { g, iw, ih, bw, yMax };
  }

  /* opts: { xs:[...], series:[{values:[...], cls, dots:true}], yMax, yFmt, xTitle, yTitle, highlightX, marks:[{x,label}] } */
  function lineChart(svg, opts) {
    clear(svg);
    const { w, h } = viewSize(svg);
    const m = { l: 46, r: 14, t: 16, b: opts.xTitle ? 42 : 26 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const xs = opts.xs;
    const yMax = opts.yMax || 1;
    const yFmt = opts.yFmt || ((v) => String(v));
    const X = (i) => (xs.length <= 1 ? iw / 2 : (iw * i) / (xs.length - 1));
    const Y = (v) => ih - (ih * Math.min(v, yMax)) / yMax;
    const g = el('g', { transform: `translate(${m.l},${m.t})` }, svg);
    const axis = el('g', { class: 'axis' }, g);
    for (let i = 0; i <= 5; i++) {
      const v = (yMax * i) / 5, y = Y(v);
      el('line', { x1: 0, x2: iw, y1: y, y2: y, class: 'gridline' }, axis);
      el('text', { x: -6, y: y + 4, 'text-anchor': 'end', text: yFmt(v) }, axis);
    }
    xs.forEach((x, i) => el('text', { x: X(i), y: ih + 16, 'text-anchor': 'middle', text: String(x), class: opts.highlightX === x ? 'lbl hi' : 'lbl' }, g));
    if (opts.highlightX !== undefined) {
      const i = xs.indexOf(opts.highlightX);
      if (i >= 0) el('line', { x1: X(i), x2: X(i), y1: 0, y2: ih, class: 'hi-line' }, g);
    }
    (opts.hlines || []).forEach((hl) => {
      el('line', { x1: 0, x2: iw, y1: Y(hl.y), y2: Y(hl.y), class: 'ref-line ' + (hl.cls || '') }, g);
      if (hl.label) el('text', { x: iw - 4, y: Y(hl.y) - 5, 'text-anchor': 'end', text: hl.label, class: 'ref-label' }, g);
    });
    opts.series.forEach((s) => {
      const d = s.values.map((v, i) => (v === null ? null : `${X(i)},${Y(v)}`)).filter(Boolean).join(' L');
      if (d) el('path', { d: 'M' + d, class: 'series ' + (s.cls || '') }, g);
      if (s.dots !== false) {
        s.values.forEach((v, i) => {
          if (v === null) return;
          const c = el('circle', { cx: X(i), cy: Y(v), r: xs[i] === opts.highlightX ? 5.5 : 3.5, class: 'dot ' + (s.cls || '') + (xs[i] === opts.highlightX ? ' hi' : '') }, g);
          el('title', { text: `${xs[i]}: ${yFmt(v)}` }, c);
        });
      }
    });
    if (opts.xTitle) el('text', { x: iw / 2, y: ih + 36, 'text-anchor': 'middle', text: opts.xTitle, class: 'axis-title' }, g);
    if (opts.yTitle) el('text', { x: 0, y: -5, 'text-anchor': 'start', text: opts.yTitle, class: 'axis-title' }, g);
    return { g, X, Y, iw, ih };
  }

  function pct(v, digits) {
    const d = digits === undefined ? 1 : digits;
    if (v > 0 && v * 100 < Math.pow(10, -d)) return '<' + Math.pow(10, -d).toFixed(d) + '%';
    return (v * 100).toFixed(d) + '%';
  }

  /* 공정한 동전·카드용 난수 (가능하면 crypto 사용) */
  function random() {
    if (root.crypto && root.crypto.getRandomValues) {
      const a = new Uint32Array(1);
      root.crypto.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }

  root.SvgUtil = { el, clear, barChart, lineChart, niceMax, pct, random };
})(this);

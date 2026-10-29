/* ===========================================================
   Shuffle Lab — Module 2: 리플 셔플과 컷오프 현상
   =========================================================== */
(function () {
  'use strict';
  const { el, clear, barChart, lineChart, pct, random } = window.SvgUtil;
  const SM = window.ShuffleMath;
  const $ = (id) => document.getElementById(id);

  const SIZES = [8, 13, 26, 52];
  const RISE_COLORS = ['#1F7A6C', '#C98A2C', '#B34632', '#3D5A98', '#7A4FA0', '#5E8C31', '#C2577F', '#2F8FB0', '#8A6A2E', '#4B5266', '#D07A3A', '#5BA59A'];
  const tvCache = {};
  const tv = (n, k) => {
    const key = n + ':' + k;
    if (!(key in tvCache)) tvCache[key] = k > 40 ? 0 : SM.tvDistance(n, k);
    return tvCache[key];
  };

  const S = { n: 52, deck: SM.identity(52), k: 0, random: false, busy: false };
  let magic = null;

  /* ---------------- 카드 그리기 (자리 이동 애니메이션 포함) ---------------- */
  function posColor(v, n) {
    const t = n <= 1 ? 0 : v / (n - 1);
    const h = 212 - 180 * t;
    return `hsl(${h}, 58%, ${52 + 6 * Math.sin(Math.PI * t)}%)`;
  }

  function renderDeck(container, deck, opts) {
    const n = deck.length;
    const before = new Map();
    container.querySelectorAll('.card').forEach((c) => before.set(+c.dataset.v, c.getBoundingClientRect()));
    const sameSet = before.size === n && deck.every((v) => before.has(v));
    const nodes = new Map();
    if (sameSet) container.querySelectorAll('.card').forEach((c) => nodes.set(+c.dataset.v, c));
    else container.innerHTML = '';
    const rise = opts.colorRising ? SM.risingSequences(deck) : null;

    deck.forEach((v) => {
      let c = nodes.get(v);
      if (!c) {
        c = document.createElement('button');
        c.type = 'button';
        c.className = 'card';
        c.dataset.v = v;
        c.innerHTML = '<span class="band"></span><span class="num"></span>';
      }
      c.querySelector('.num').textContent = v + 1;
      const band = c.querySelector('.band');
      band.style.background = opts.plain ? 'transparent' : rise ? RISE_COLORS[rise.id[v] % RISE_COLORS.length] : posColor(v, n);
      c.className = 'card' + (opts.cls && opts.cls[v] ? ' ' + opts.cls[v] : '');
      c.disabled = !opts.onClick;
      c.onclick = opts.onClick ? () => opts.onClick(v) : null;
      container.appendChild(c);
    });

    if (sameSet && !opts.noAnim && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      container.querySelectorAll('.card').forEach((c) => {
        const a = before.get(+c.dataset.v);
        const b = c.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (!dx && !dy) return;
        c.style.transition = 'none';
        c.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          c.style.transition = 'transform 0.45s cubic-bezier(.3,.7,.3,1)';
          c.style.transform = '';
        }));
      });
    }
  }

  /* ---------------- 메인 덱 ---------------- */
  function verdictFor(d) {
    if (S.random) return ['완전 무작위 덱입니다. 비교용으로 보세요.', 'complete'];
    if (S.k === 0) return ['아직 한 번도 섞지 않았어요.', ''];
    if (d > 0.9) return ['처음 순서의 흔적이 거의 그대로 남아 있어요. 상승 수열로 색칠해 보세요.', 'stuck'];
    if (d > 0.5) return ['흔적이 꽤 남아 있어요. 무작위 덱과 구별할 수 있습니다.', 'stuck'];
    if (d > 0.1) return ['거의 섞였지만 아직 약간의 흔적이 있어요.', ''];
    return ['충분히 섞였어요. 무작위 덱과 거의 구별되지 않습니다.', 'complete'];
  }

  function renderMain(fromInfo) {
    const colorRising = $('color-rising').checked;
    const cls = {};
    if (fromInfo) S.deck.forEach((v, i) => { cls[v] = fromInfo.from[i] === 'L' ? 'from-l' : 'from-r'; });
    renderDeck($('deck'), S.deck, { colorRising, cls });
    if (fromInfo) setTimeout(() => $('deck').querySelectorAll('.card').forEach((c) => c.classList.remove('from-l', 'from-r')), 1300);

    const rise = SM.risingSequences(S.deck);
    const d = S.random ? 0 : tv(S.n, S.k);
    $('s-k').textContent = S.random ? '무작위' : S.k;
    $('s-rise').innerHTML = S.random ? `${rise.count} <small>/ 평균 ${((S.n + 1) / 2).toFixed(1)}</small>` : `${rise.count} <small>/ 최대 ${Math.min(Math.pow(2, S.k), S.n)}</small>`;
    $('s-tv').textContent = d.toFixed(3);
    $('tv-meter').style.width = (d * 100).toFixed(1) + '%';
    const [txt, kind] = verdictFor(d);
    $('verdict').textContent = txt;
    $('verdict').className = 'status-message ' + kind;

    const st = $('deck-status');
    if (fromInfo) {
      st.textContent = `왼손 ${fromInfo.cut}장 · 오른손 ${S.n - fromInfo.cut}장을 섞었어요`;
      st.className = 'graph-status active';
    } else {
      st.textContent = S.random ? '완전 무작위로 섞은 덱' : S.k === 0 ? '처음 순서 그대로' : `${S.k}번 섞은 덱`;
      st.className = 'graph-status';
    }
    $('deck-legend').innerHTML = colorRising
      ? `같은 색 = 같은 <b>상승 수열</b> (처음 순서대로 이어진 번호가 앞에서 뒤로 놓인 묶음). 지금 ${rise.count}개${rise.count > RISE_COLORS.length ? ', 색이 모자라서 반복돼요' : ''}.`
      : '카드 위 색 띠는 <b>처음 위치</b>를 나타냅니다. 처음에는 파랑에서 주황까지 차례로 놓여 있습니다. 섞을 때 테두리는 왼손(초록)·오른손(빨강)에서 온 카드를 잠깐 보여 줍니다.';
    renderScatter(rise, colorRising);
    renderCutoff();
  }

  function renderScatter(rise, colorRising) {
    const svg = $('scatter');
    clear(svg);
    const W = 260, H = 240, m = { l: 30, r: 8, t: 8, b: 26 };
    const n = S.n;
    const X = (v) => m.l + ((W - m.l - m.r) * v) / (n - 1);
    const Y = (p) => m.t + ((H - m.t - m.b) * p) / (n - 1);
    el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, class: 'scatter-frame' }, svg);
    el('text', { x: (W + m.l) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title', text: '처음 위치 →' }, svg);
    el('text', { x: 10, y: (H - m.b) / 2, 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 10 ${(H - m.b) / 2})`, text: '지금 위치 →' }, svg);
    S.deck.forEach((v, p) => {
      el('circle', {
        cx: X(v), cy: Y(p), r: n > 26 ? 3 : 4.5,
        fill: colorRising ? RISE_COLORS[rise.id[v] % RISE_COLORS.length] : 'var(--accent-amber)',
        class: 'pt',
      }, svg);
    });
  }

  function renderCutoff() {
    const xs = Array.from({ length: 13 }, (_, i) => i);
    const series = SIZES.map((n) => ({
      values: xs.map((k) => tv(n, k)),
      cls: n === S.n ? 'amber' : 'faint',
      dots: n === S.n,
    }));
    series.sort((a, b) => (a.cls === 'amber') - (b.cls === 'amber'));
    const hk = S.random ? undefined : Math.min(S.k, 12);
    lineChart($('cutoff-svg'), {
      xs, series, yMax: 1, yFmt: (v) => v.toFixed(1), highlightX: hk,
      xTitle: '리플 셔플 횟수', yTitle: '완전 무작위와의 거리',
      hlines: [{ y: 0.5, label: '절반' }],
    });
    $('cutoff-title').textContent = `${S.n}장 덱`;
    let rows = '<tr><th>섞은 횟수</th><th>거리</th></tr>';
    for (let k = 1; k <= 10; k++) {
      rows += `<tr class="${!S.random && k === S.k ? 'on' : ''}"><td>${k}번</td><td>${tv(S.n, k).toFixed(3)}</td></tr>`;
    }
    $('cutoff-table').innerHTML = rows;
    $('cutoff-legend').innerHTML = SIZES.map((n) => {
      const est = 1.5 * Math.log2(n);
      return `<div class="${n === S.n ? 'on' : ''}"><span class="sw ${n === S.n ? 'amber' : ''}"></span>${n}장 · (3/2)log<sub>2</sub>n ≈ ${est.toFixed(1)}</div>`;
    }).join('');
  }

  function doRiffle() {
    if (S.random) { S.deck = SM.identity(S.n); S.k = 0; S.random = false; }
    const r = SM.riffle(S.deck, random);
    S.deck = r.deck;
    S.k++;
    renderMain(r);
  }

  function setBusy(b) {
    S.busy = b;
    ['riffle-1', 'riffle-7', 'deck-reset', 'deck-random', 'deck-size'].forEach((id) => { $(id).disabled = b; });
  }

  function riffleMany(times) {
    if (S.busy) return;
    setBusy(true);
    let i = 0;
    const step = () => {
      doRiffle();
      i++;
      if (i < times) setTimeout(step, 420);
      else setTimeout(() => { setBusy(false); renderMain(); }, 420);
    };
    step();
  }

  /* ---------------- 마술 ---------------- */
  function startMagic() {
    const k = parseInt($('magic-k').value, 10);
    const base = SM.shuffleK(52, k, random);
    const m = SM.moveOneCard(base, random);
    magic = { k, deck: m.deck, card: m.card, done: false, guess: null };
    $('magic-reveal').disabled = false;
    $('magic-msg').className = 'status-message';
    $('magic-msg').textContent = `52장을 ${k}번 섞은 뒤 카드 한 장을 몰래 옮겼어요. 어느 카드일까요? 클릭하세요.`;
    renderMagic();
  }

  function renderMagic() {
    const box = $('magic-deck');
    if (!magic) { box.innerHTML = ''; return; }
    const cls = {};
    if (magic.done) {
      cls[magic.card] = 'moved';
      if (magic.guess !== null && magic.guess !== magic.card) cls[magic.guess] = 'wrong';
    }
    renderDeck(box, magic.deck, {
      plain: !magic.done,
      colorRising: magic.done,
      cls,
      noAnim: true,
      onClick: magic.done ? null : (v) => { magic.guess = v; reveal(); },
    });
  }

  function reveal() {
    magic.done = true;
    $('magic-reveal').disabled = true;
    const before = SM.risingSequences(magic.deck).count;
    const g = SM.magicianGuess(magic.deck);
    const mgOk = g.candidates.includes(magic.card);
    const you = magic.guess === null ? '' : magic.guess === magic.card ? '<b>정답이에요!</b> ' : `아쉬워요. 고른 카드는 ${magic.guess + 1}번이었어요. `;
    let mag = `옮긴 카드는 <b>${magic.card + 1}번</b>입니다. `;
    if (g.candidates.length === 1) {
      mag += `마술사의 방법: 카드를 하나씩 빼 보면서 상승 수열이 가장 많이 줄어드는 카드를 찾습니다. ${g.candidates[0] + 1}번을 빼면 ${before}개 → ${g.risingAfter}개로 줄어서 ${g.candidates[0] + 1}번을 골랐고, ${mgOk ? '맞혔습니다.' : '틀렸습니다.'}`;
    } else {
      if (g.candidates.length > 6) {
        mag += `이번에는 옮긴 카드가 상승 수열을 거의 흐트러뜨리지 않아서, 마술사의 방법으로도 후보를 ${g.candidates.length}장 밑으로 좁히지 못했습니다. 운이 나쁜 경우예요.`;
      } else {
        mag += `마술사의 방법으로는 후보가 ${g.candidates.length}장 (${g.candidates.map((v) => v + 1).join(', ')})으로 좁혀졌고, ${mgOk ? '그중에 정답이 있습니다.' : '정답을 놓쳤습니다.'}`;
      }
    }
    if (magic.k >= 5) mag += ' 많이 섞을수록 상승 수열이 원래 많아서 한 장이 튀어도 잘 드러나지 않아요.';
    $('magic-msg').innerHTML = you + mag;
    $('magic-msg').className = 'status-message ' + (magic.guess === magic.card ? 'complete' : '');
    renderMagic();
  }

  function runMagicSim() {
    const ks = [1, 2, 3, 4, 5, 6, 7, 8];
    const res = [];
    $('magic-sim').disabled = true;
    const go = (i) => {
      if (i >= ks.length) {
        $('magic-sim').disabled = false;
        $('magic-sim-msg').textContent = '3번까지는 꽤 잘 통하고, 4번부터 급격히 떨어집니다. 무작위로 찍으면 1/52 ≈ 2%입니다.';
        return;
      }
      $('magic-sim-msg').textContent = `${ks[i]}번 섞은 덱 계산 중…`;
      setTimeout(() => {
        res.push(SM.magicSuccessRate(52, ks[i], 200, random));
        drawMagicChart(ks, res);
        go(i + 1);
      }, 20);
    };
    go(0);
  }

  function drawMagicChart(ks, res) {
    const bars = ks.map((k, i) => ({
      label: k + '번', value: i < res.length ? res[i] : 0,
      cls: i < res.length ? (res[i] > 0.3 ? 'mine' : '') : '',
      title: i < res.length ? `${k}번 섞은 뒤 성공률 ${pct(res[i], 0)}` : '',
    }));
    const r = barChart($('magic-svg'), { bars, yMax: 1, yFmt: (v) => Math.round(v * 100) + '%', xTitle: '마술 전에 섞은 횟수' });
    const y = r.ih - r.ih / 52;
    el('line', { x1: 0, x2: r.iw, y1: y, y2: y, class: 'ref-line' }, r.g);
    el('text', { x: r.iw - 2, y: y - 5, 'text-anchor': 'end', class: 'ref-label', text: '무작위로 찍기 (2%)' }, r.g);
  }

  /* ---------------- 임상시험 배정 ---------------- */
  const ALLOC_HALF = 10;
  let allocTable = null;

  function allocStats() {
    const rng = SM.mulberry32(2026);
    const rows = [];
    for (let k = 0; k <= 8; k++) {
      const trials = 3000;
      let same = 0, total = 0, firstA = 0;
      for (let t = 0; t < trials; t++) {
        const d = SM.shuffleK(20, k, rng);
        for (let i = 1; i < 20; i++) { total++; if ((d[i] < ALLOC_HALF) === (d[i - 1] < ALLOC_HALF)) same++; }
        for (let i = 0; i < 10; i++) if (d[i] < ALLOC_HALF) firstA++;
      }
      rows.push({ k, same: same / total, firstA: firstA / trials });
    }
    return rows;
  }

  function renderAlloc(reshuffle) {
    const k = parseInt($('alloc-k').value, 10);
    $('alloc-k-val').textContent = k;
    const d = SM.shuffleK(20, k, random);
    $('alloc').innerHTML = d.map((v, i) => {
      const g = v < ALLOC_HALF ? 'A' : 'B';
      return `<span class="pt-chip ${g === 'A' ? 'a' : 'b'}" title="${i + 1}번째 환자"><small>${i + 1}</small>${g}</span>`;
    }).join('');
    if (!allocTable) allocTable = allocStats();
    let html = '<tr><th>섞은 횟수</th><th>"직전 환자와 같은 그룹"이라고 찍을 때 맞힐 확률</th><th>처음 10명 중 A 그룹 평균</th></tr>';
    allocTable.forEach((r) => {
      html += `<tr class="${r.k === k ? 'on' : ''}"><td>${r.k}번</td><td>${pct(r.same)}</td><td>${r.firstA.toFixed(2)}명</td></tr>`;
    });
    html += `<tr class="ref"><td>완전 무작위</td><td>${pct(9 / 19)}</td><td>5.00명</td></tr>`;
    $('alloc-table').innerHTML = html;
    const r = allocTable[k];
    let note;
    if (k === 0) note = '섞지 않으면 처음 10명이 모두 A 그룹입니다. 먼저 온 환자(예: 증상이 가벼워 일찍 등록한 사람)가 한쪽에 몰리면 약의 효과를 공정하게 비교할 수 없습니다.';
    else if (k === 1) note = `1번 섞으면 무작위라면 ${pct(9 / 19)}여야 할 예측이 ${pct(r.same)}로 맞고, 처음 10명에 A가 평균 ${r.firstA.toFixed(1)}명 몰립니다. 차이가 작아 보여도 수백 명을 배정하면 체계적인 치우침이 됩니다.`;
    else if (r.same - 9 / 19 > 0.01) note = `${k}번 섞으면 거의 비슷해지지만 아직 무작위보다 ${pct(r.same - 9 / 19)} 더 잘 맞힙니다.`;
    else note = `${k}번 섞으면 이 두 기준으로는 무작위와 구별하기 어렵습니다. 다만 배정 카드가 많아질수록 필요한 횟수가 늘어납니다 (52장은 7번 이상).`;
    $('alloc-note').textContent = note;
  }

  /* ---------------- 이벤트 ---------------- */
  $('riffle-1').addEventListener('click', () => { if (!S.busy) doRiffle(); });
  $('riffle-7').addEventListener('click', () => riffleMany(7));
  $('deck-reset').addEventListener('click', () => { S.deck = SM.identity(S.n); S.k = 0; S.random = false; renderMain(); });
  $('deck-random').addEventListener('click', () => { S.deck = SM.fisherYates(S.n, random); S.k = 0; S.random = true; renderMain(); });
  $('deck-size').addEventListener('change', (e) => {
    S.n = parseInt(e.target.value, 10);
    S.deck = SM.identity(S.n); S.k = 0; S.random = false;
    renderMain();
  });
  $('color-rising').addEventListener('change', () => renderMain());
  $('magic-start').addEventListener('click', startMagic);
  $('magic-reveal').addEventListener('click', () => { if (magic && !magic.done) reveal(); });
  $('magic-sim').addEventListener('click', runMagicSim);
  $('alloc-k').addEventListener('input', () => renderAlloc());
  $('alloc-again').addEventListener('click', () => renderAlloc(true));

  renderMain();
  drawMagicChart([1, 2, 3, 4, 5, 6, 7, 8], []);
  renderAlloc();
})();

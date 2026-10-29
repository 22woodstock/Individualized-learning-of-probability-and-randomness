/* ===========================================================
   Shuffle Lab — Module 1: 동전 던지기와 확률의 전이
   =========================================================== */
(function () {
  'use strict';
  const { el, clear, barChart, pct, random } = window.SvgUtil;
  const CM = window.CoinMath;
  const $ = (id) => document.getElementById(id);

  const MAX_STRIP = 300;
  const HUMAN_N = 50;
  let seq = [];
  let human = [];
  let animTimer = null;

  const faceName = (f) => (f === 'H' ? '앞' : '뒤');
  const flipOne = () => (random() < 0.5 ? 'H' : 'T');

  /* ---------------- 던지기 ---------------- */
  function flip(count) {
    for (let i = 0; i < count; i++) seq.push(flipOne());
    const coin = $('coin');
    const face = $('coin-face');
    coin.classList.remove('flipping', 'h', 't');
    void coin.offsetWidth; // 애니메이션 다시 시작
    coin.classList.add('flipping');
    clearTimeout(animTimer);
    face.textContent = '';
    animTimer = setTimeout(() => {
      const last = seq[seq.length - 1];
      face.textContent = faceName(last);
      coin.classList.add(last === 'H' ? 'h' : 't');
    }, 320);
    render();
  }

  function resetFlips() {
    seq = [];
    $('coin-face').textContent = '?';
    $('coin').classList.remove('h', 't', 'flipping');
    render();
  }

  /* ---------------- 기록 띠 ---------------- */
  function renderStrip(target, s, opts) {
    target.innerHTML = '';
    if (!s.length) {
      target.innerHTML = `<span class="empty">${opts.empty}</span>`;
      return;
    }
    const a = CM.analyze(s);
    const startIdx = Math.max(0, s.length - (opts.max || Infinity));
    a.runs.forEach((run, ri) => {
      if (run.start + run.len <= startIdx) return;
      const span = document.createElement('span');
      span.className = 'run';
      if (opts.markLongest && run.len === a.longest && a.longest > 1) span.classList.add('longest');
      if (opts.markCurrent && ri === a.runs.length - 1) span.classList.add('current');
      const from = Math.max(run.start, startIdx);
      for (let i = from; i < run.start + run.len; i++) {
        const c = document.createElement('span');
        c.className = 'chip ' + (s[i] === 'H' ? 'h' : 't');
        c.textContent = faceName(s[i]);
        span.appendChild(c);
      }
      if (run.len >= 3) {
        const b = document.createElement('span');
        b.className = 'run-len';
        b.textContent = run.len;
        span.appendChild(b);
      }
      target.appendChild(span);
    });
    return { hidden: startIdx };
  }

  /* ---------------- 상태 전이도 ---------------- */
  function firstReach(K) {
    let run = 0;
    for (let i = 0; i < seq.length; i++) {
      run = i > 0 && seq[i] === seq[i - 1] ? run + 1 : 1;
      if (run >= K) return i + 1;
    }
    return 0;
  }

  function currentState(K) {
    if (!seq.length) return 0;
    return Math.min(CM.analyze(seq).currentRun, K);
  }

  function renderChain(K) {
    const svg = $('chain-svg');
    clear(svg);
    const defs = el('defs', null, svg);
    ['arrow', 'arrow-hi'].forEach((id) => {
      const mk = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', class: id === 'arrow' ? 'arrow-head' : 'arrow-head hi' }, mk);
    });
    const state = currentState(K);
    const W = 760, y = 92, r = 25;
    const x0 = 70, x1 = W - 70;
    const X = (i) => x0 + ((x1 - x0) * (i - 1)) / (K - 1);
    const last = seq.length > 1 ? seq[seq.length - 1] === seq[seq.length - 2] : null;

    // 다른 면 → 1연속으로 돌아가는 호 (아래쪽)
    for (let i = 2; i <= K; i++) {
      const depth = 34 + (i - 2) * (90 / Math.max(K - 2, 1));
      const hi = state === 1 && last === false && seq.length > 1 && prevState(K) === i;
      el('path', {
        d: `M${X(i) - 6},${y + r - 2} C${X(i) - 10},${y + r + depth} ${X(1) + 10},${y + r + depth} ${X(1) + 6},${y + r}`,
        class: 'chain-edge back' + (hi ? ' hi' : ''), 'marker-end': hi ? 'url(#arrow-hi)' : 'url(#arrow)',
      }, svg);
    }
    el('text', { x: (X(1) + X(K)) / 2, y: y + r + 30 + 100, 'text-anchor': 'middle', class: 'chain-label', text: '다른 면이 나오면 (각 ½) → 1연속으로' }, svg);

    // K+연속의 자기 고리 (같은 면이 또 나와도 K+ 그대로)
    const hiK = state === K && last === true && prevState(K) === K;
    el('path', {
      d: `M${X(K) + r - 4},${y - 12} C${X(K) + r + 46},${y - 40} ${X(K) + r + 46},${y + 40} ${X(K) + r - 4},${y + 12}`,
      class: 'chain-edge' + (hiK ? ' hi' : ''), 'marker-end': hiK ? 'url(#arrow-hi)' : 'url(#arrow)',
    }, svg);
    el('text', { x: X(K) + r + 34, y: y + 4, 'text-anchor': 'start', class: 'chain-label', text: '½' }, svg);

    // 1연속의 자기 고리
    const hiSelf = state === 1 && seq.length > 1 && prevState(K) === 1;
    el('path', {
      d: `M${X(1) - r + 4},${y - 12} C${X(1) - r - 46},${y - 40} ${X(1) - r - 46},${y + 40} ${X(1) - r + 4},${y + 12}`,
      class: 'chain-edge' + (hiSelf ? ' hi' : ''), 'marker-end': hiSelf ? 'url(#arrow-hi)' : 'url(#arrow)',
    }, svg);
    el('text', { x: X(1) - r - 34, y: y + 4, 'text-anchor': 'end', class: 'chain-label', text: '½' }, svg);

    // 같은 면 → 오른쪽
    for (let i = 1; i < K; i++) {
      const hi = state === i + 1 && last === true && prevState(K) === i;
      el('line', { x1: X(i) + r, y1: y, x2: X(i + 1) - r - 2, y2: y, class: 'chain-edge' + (hi ? ' hi' : ''), 'marker-end': hi ? 'url(#arrow-hi)' : 'url(#arrow)' }, svg);
      el('text', { x: (X(i) + X(i + 1)) / 2, y: y - 9, 'text-anchor': 'middle', class: 'chain-label', text: '½' }, svg);
    }
    el('text', { x: (X(1) + X(2)) / 2, y: y - 24, 'text-anchor': 'middle', class: 'chain-label strong', text: '같은 면 →' }, svg);

    // 상태 원
    for (let i = 1; i <= K; i++) {
      const cls = ['chain-node'];
      if (i === K) cls.push('goal');
      if (i === state) cls.push(i === K ? 'reached' : 'current');
      el('circle', { cx: X(i), cy: y, r, class: cls.join(' ') }, svg);
      el('text', { x: X(i), y: y + 1, class: 'chain-node-label' + (i === state ? ' on' : ''), text: i === K ? `${K}+` : String(i) }, svg);
      el('text', { x: X(i), y: y - r - 32, 'text-anchor': 'middle', class: 'chain-caption', text: i === K ? `${K}번 이상 (목표)` : `${i}연속` }, svg);
      if (i === state) {
        el('text', { x: X(i), y: y - r - 12, 'text-anchor': 'middle', class: 'chain-here' + (i === K ? ' reached' : ''), text: '▼ 지금 여기' }, svg);
      }
    }
  }

  function prevState(K) {
    if (seq.length < 2) return 0;
    const saved = seq;
    seq = saved.slice(0, -1);
    const s = currentState(K);
    seq = saved;
    return s;
  }

  function renderChainFacts(K) {
    const state = currentState(K);
    const reach = firstReach(K);
    let html = `<div class="fact"><b>평균 ${Math.pow(2, K) - 1}번</b> 던지면 처음으로 ${K}번 연속이 나와요 (2<sup>${K}</sup> − 1).</div>`;
    if (!seq.length) html += '<div class="fact">동전을 던지면 지금 상태가 표시됩니다.</div>';
    else if (state < K) html += `<div class="fact">지금 <b>${state}연속</b> 상태 → ${K}번 연속까지 남은 평균 <b>${CM.expectedRemaining(state, K)}번</b> (2<sup>${K}</sup> − 2<sup>${state}</sup>)</div>`;
    else html += `<div class="fact ok">지금 같은 면이 <b>${K}번 이상</b> 이어지고 있어요!</div>`;
    if (reach) html += `<div class="fact ok">처음 ${K}번 연속은 <b>${reach}번째</b> 던짐에서 나왔어요.</div>`;
    $('chain-facts').innerHTML = html;
  }

  function renderDist(K) {
    const n = seq.length;
    const t = Math.max(n, 1);
    const p = CM.chainDistribution(t, K, false);
    const state = currentState(K);
    const bars = [];
    for (let i = 1; i <= K; i++) {
      bars.push({
        label: i === K ? `${K}+` : `${i}`,
        value: p[i],
        cls: n && i === state ? 'mine' : '',
        title: `${i === K ? K + '번 이상 연속' : i + '연속'} 상태일 확률 ${pct(p[i])}`,
      });
    }
    barChart($('dist-svg'), { bars, yMax: 1, yFmt: (v) => Math.round(v * 100) + '%', xTitle: '상태 (지금 같은 면이 몇 번 이어졌나)' });
    $('dist-title').textContent = n
      ? `이론: ${n}번 던진 뒤 각 상태에 있을 확률 (주황 = 지금 내 상태). 많이 던질수록 ½, ¼, ⅛ …로 자리 잡아요.`
      : '이론: 1번 던진 뒤 각 상태에 있을 확률 (던지면 바뀌어요)';
  }

  function renderMatrix(K) {
    const state = currentState(K);
    const t = $('matrix');
    let html = '<tr><th></th>' + Array.from({ length: K }, (_, j) => `<th>${j + 1}</th>`).join('') + '</tr>';
    for (let i = 1; i <= K; i++) {
      html += `<tr class="${i === state ? 'on' : ''}"><th>${i}</th>`;
      for (let j = 1; j <= K; j++) {
        let v = '';
        if (j === 1) v = '½';
        else if (i < K && j === i + 1) v = '½';
        else if (i === K && j === K) v = '½';
        html += `<td class="${v ? 'nz' : ''}">${v || '0'}</td>`;
      }
      html += '</tr>';
    }
    t.innerHTML = html;
  }

  /* ---------------- 최장 연속 분포 ---------------- */
  function renderLongest() {
    const real = seq.length >= 5;
    const n = real ? seq.length : 100;
    const obs = real ? CM.analyze(seq).longest : 0;
    const dist = CM.longestRunDist(n);
    let mMax = 1, cum = 0;
    for (let m = 1; m < dist.length; m++) {
      cum += dist[m];
      mMax = m;
      if (cum >= 0.9995 && m >= 4) break;
    }
    mMax = Math.min(Math.max(mMax, obs), n);
    const bars = [];
    for (let m = 1; m <= mMax; m++) {
      bars.push({ label: String(m), value: dist[m], cls: m === obs ? 'mine' : '', title: `가장 긴 연속이 ${m}일 확률 ${pct(dist[m], 2)}` });
    }
    barChart($('longest-svg'), { bars, yFmt: (v) => Math.round(v * 100) + '%', xTitle: `${n}번 던졌을 때 가장 긴 같은 면 연속의 길이` });
    $('longest-sub').textContent = real
      ? `모든 경우를 세어 정확한 확률을 구했습니다. 주황색 막대가 내 기록(${n}번 중 가장 긴 연속 ${obs})입니다.`
      : '아직 5번 이상 던지지 않아서 100번 던질 때를 예로 보여 줍니다. 모든 경우를 세어 정확한 확률을 구했습니다.';

    const E = CM.expectedLongestRun(n);
    const atLeast = (k) => (k <= 1 ? 1 : 1 - CM.probAllRunsAtMost(n, k - 1));
    let html = `<h4>${n}번 던지면</h4>
      <div class="stat-grid">
        <div class="stat wide"><span class="k">가장 긴 연속의 평균</span><span class="v">${E.toFixed(2)}</span></div>
        <div class="stat"><span class="k">5번 이상 연속</span><span class="v">${pct(atLeast(5), 0)}</span></div>
        <div class="stat"><span class="k">7번 이상 연속</span><span class="v">${pct(atLeast(7), 0)}</span></div>
      </div>`;
    if (real) {
      const p = atLeast(obs);
      html += `<p class="note ${p < 0.05 ? 'brick' : 'teal'}">내 기록 <b>${obs}</b> 이상이 나올 확률은 <b>${pct(p)}</b>입니다. ${
        p < 0.05 ? '꽤 드문 일이 일어났어요!' : obs < E - 2 ? '평균보다 짧은 편이에요.' : '흔히 볼 수 있는 결과예요.'}</p>`;
    }
    $('longest-facts').innerHTML = html;
  }

  /* ---------------- 통계 · 도박사의 오류 ---------------- */
  function renderStats() {
    const a = CM.analyze(seq);
    $('s-n').textContent = a.n;
    $('s-ratio').textContent = a.n ? pct(a.heads / a.n) : '—';
    $('s-cur').innerHTML = a.n ? `${a.currentRun} <small>${faceName(seq[seq.length - 1])}</small>` : '0';
    $('s-long').textContent = a.longest;
    $('s-exp').innerHTML = a.n >= 2 ? `${CM.expectedLongestRun(a.n).toFixed(1)} <small>(${a.n}번 기준)</small>` : '—';

    const g = CM.afterStreak(seq, 3);
    const box = $('gambler');
    if (g.total < 5) {
      box.textContent = `같은 면이 3번 이상 이어진 직후의 결과를 모아 봅니다. 지금 ${g.total}번 모였어요. 더 던져 보세요 (100번 버튼 추천).`;
      box.className = 'status-message';
    } else {
      const r = g.same / g.total;
      box.innerHTML = `같은 면이 3번 이상 이어진 직후 <b>${g.total}번</b> 중 <b>${g.same}번(${pct(r)})</b> 같은 면이 또 나왔어요.
        ${g.total < 40 ? '<br>모은 수가 늘수록 50% 근처로 모입니다.' : '<br>연속 뒤에도 같은 면이 나올 확률은 여전히 약 50%예요.'}`;
      box.className = 'status-message complete';
    }
  }

  /* ---------------- 사람 vs 동전 ---------------- */
  function renderHuman() {
    $('h-count').textContent = human.length;
    renderStrip($('h-strip'), human, { empty: '앞, 뒤 버튼을 눌러 50개를 만들어 보세요.', markLongest: true });
    $('h-head').disabled = $('h-tail').disabled = human.length >= HUMAN_N;
    const out = $('h-result');
    if (human.length < HUMAN_N) { out.innerHTML = ''; return; }

    const coin = Array.from({ length: HUMAN_N }, flipOne);
    const ha = CM.analyze(human), ca = CM.analyze(coin);
    const E = CM.expectedLongestRun(HUMAN_N);
    const sw = (HUMAN_N - 1) / 2, sd = Math.sqrt(HUMAN_N - 1) / 2;
    const pShort = CM.probAllRunsAtMost(HUMAN_N, ha.longest);
    const z = (ha.switches - sw) / sd;
    const flags = [];
    if (pShort < 0.1) flags.push(`가장 긴 연속이 ${ha.longest}번 이하로 짧을 확률은 진짜 동전이라면 ${pct(pShort)}뿐이에요.`);
    if (z > 2) flags.push(`면이 ${ha.switches}번 바뀌었어요. 진짜 동전은 보통 ${Math.round(sw - 2 * sd)}~${Math.round(sw + 2 * sd)}번이라, 너무 자주 바꿨어요.`);
    if (z < -2) flags.push(`면이 ${ha.switches}번만 바뀌었어요. 진짜 동전보다 같은 면을 너무 오래 유지했어요.`);

    out.innerHTML = `
      <div class="strip small coin-ref">${''}</div>
      <div class="table-scroll"><table class="plain compare">
        <tr><th></th><th>내가 만든 수열</th><th>진짜 동전 50번</th><th>진짜 동전이라면 보통</th></tr>
        <tr><td>가장 긴 연속</td><td><b>${ha.longest}</b></td><td>${ca.longest}</td><td>평균 ${E.toFixed(1)}</td></tr>
        <tr><td>면이 바뀐 횟수</td><td><b>${ha.switches}</b></td><td>${ca.switches}</td><td>평균 ${sw}, 대부분 ${Math.round(sw - 2 * sd)}~${Math.round(sw + 2 * sd)}</td></tr>
        <tr><td>앞면 수</td><td><b>${ha.heads}</b></td><td>${ca.heads}</td><td>평균 25</td></tr>
      </table></div>
      <p class="note ${flags.length ? 'brick' : 'teal'}">${flags.length ? '<b>사람이 만든 티가 나요.</b> ' + flags.join(' ') : '<b>진짜 동전과 구별하기 어려워요!</b> 연속 길이와 바뀐 횟수 모두 무작위로 보입니다.'}</p>`;
    renderStrip(out.querySelector('.coin-ref'), coin, { empty: '', markLongest: true });
    out.querySelector('.coin-ref').insertAdjacentHTML('afterbegin', '<span class="strip-label">진짜 동전</span>');
  }

  /* ---------------- 전체 그리기 ---------------- */
  function render() {
    const K = parseInt($('target-k').value, 10);
    const info = renderStrip($('strip'), seq, { empty: '아직 던지지 않았어요.', max: MAX_STRIP, markLongest: true, markCurrent: true });
    $('strip-note').textContent = info && info.hidden ? `앞의 ${info.hidden}번은 화면에서 생략했어요 (통계에는 모두 포함).` : '';
    renderStats();
    renderChain(K);
    renderChainFacts(K);
    renderDist(K);
    renderMatrix(K);
    renderLongest();
  }

  $('flip1').addEventListener('click', () => flip(1));
  $('flip10').addEventListener('click', () => flip(10));
  $('flip100').addEventListener('click', () => flip(100));
  $('flip-reset').addEventListener('click', resetFlips);
  $('target-k').addEventListener('change', render);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && (e.target === document.body || e.target === document.documentElement)) {
      e.preventDefault();
      flip(1);
    }
  });

  $('h-head').addEventListener('click', () => { if (human.length < HUMAN_N) { human.push('H'); renderHuman(); } });
  $('h-tail').addEventListener('click', () => { if (human.length < HUMAN_N) { human.push('T'); renderHuman(); } });
  $('h-undo').addEventListener('click', () => { human.pop(); renderHuman(); });
  $('h-reset').addEventListener('click', () => { human = []; renderHuman(); });

  render();
  renderHuman();
})();

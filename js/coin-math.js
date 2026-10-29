/* ===========================================================
   Shuffle Lab — 동전 던지기 계산 (브라우저·Node 공용)
   "같은 면 연속"을 상태로 보는 마르코프 연쇄 계산
   =========================================================== */
(function (root) {
  'use strict';

  /* n번 던졌을 때 같은 면 연속이 모두 m번 이하일 확률.
     f(t) = (길이 t를 1~m 조각으로 나누는 방법 수) / 2^t
     f(t) = Σ_{j=1..m} f(t−j) / 2^j,  f(0)=1,  답 = 2·f(n) (n≥1) */
  function probAllRunsAtMost(n, m) {
    if (n <= 0) return 1;
    if (m <= 0) return 0;
    if (m >= n) return 1;
    const f = new Float64Array(n + 1);
    f[0] = 1;
    for (let t = 1; t <= n; t++) {
      let s = 0, half = 1;
      for (let j = 1; j <= m && j <= t; j++) {
        half /= 2;
        s += f[t - j] * half;
      }
      f[t] = s;
    }
    return Math.min(1, 2 * f[n]);
  }

  /* 최장 연속 길이 L_n의 분포: dist[m] = P(L_n = m), m = 1..n */
  function longestRunDist(n) {
    const dist = new Array(n + 1).fill(0);
    if (n <= 0) return dist;
    let prev = 0;
    for (let m = 1; m <= n; m++) {
      const c = probAllRunsAtMost(n, m);
      dist[m] = Math.max(0, c - prev);
      prev = c;
      if (c >= 1 - 1e-15) break;
    }
    return dist;
  }

  function expectedLongestRun(n) {
    const d = longestRunDist(n);
    let e = 0;
    for (let m = 1; m < d.length; m++) e += m * d[m];
    return e;
  }

  /* 상태 전이: 상태 r = 지금 같은 면이 r번 연속, 목표 K에 닿으면 멈춤(흡수).
     t번 던진 뒤 상태 분포 dist[1..K] */
  /* absorbing=false 이면 상태 K는 "K번 이상 연속"(같은 면 ½ → 그대로, 다른 면 ½ → 1) */
  function chainDistribution(t, K, absorbing) {
    const p = new Array(K + 1).fill(0);
    if (t <= 0) return p;
    p[1] = 1;
    for (let step = 2; step <= t; step++) {
      const q = new Array(K + 1).fill(0);
      for (let r = 1; r < K; r++) {
        q[r + 1] += p[r] / 2;
        q[1] += p[r] / 2;
      }
      if (absorbing === false) {
        q[K] += p[K] / 2;
        q[1] += p[K] / 2;
      } else {
        q[K] += p[K];
      }
      for (let r = 1; r <= K; r++) p[r] = q[r];
    }
    return p;
  }

  /* 지금 r번 연속인 상태에서 K번 연속까지 평균 몇 번 더 던져야 하나: 2^K − 2^r */
  function expectedRemaining(r, K) {
    if (r >= K) return 0;
    return Math.pow(2, K) - Math.pow(2, Math.max(r, 0));
  }

  /* 수열 분석: 최장 연속, 바뀐 횟수, 연속 구간 목록 */
  function analyze(seq) {
    const runs = [];
    let switches = 0;
    for (let i = 0; i < seq.length; i++) {
      if (i > 0 && seq[i] !== seq[i - 1]) switches++;
      if (i === 0 || seq[i] !== seq[i - 1]) runs.push({ face: seq[i], start: i, len: 1 });
      else runs[runs.length - 1].len++;
    }
    let longest = 0;
    runs.forEach((r) => { if (r.len > longest) longest = r.len; });
    const heads = seq.filter((x) => x === 'H').length;
    return {
      n: seq.length,
      heads,
      tails: seq.length - heads,
      switches,
      longest,
      runs,
      currentRun: runs.length ? runs[runs.length - 1].len : 0,
    };
  }

  /* 같은 면이 minRun번 이상 연속된 바로 다음 던짐에서 같은 면이 나온 횟수 */
  function afterStreak(seq, minRun) {
    let total = 0, same = 0, run = 0;
    for (let i = 0; i < seq.length - 1; i++) {
      run = (i > 0 && seq[i] === seq[i - 1]) ? run + 1 : 1;
      if (run >= minRun) {
        total++;
        if (seq[i + 1] === seq[i]) same++;
      }
    }
    return { total, same };
  }

  const api = {
    probAllRunsAtMost, longestRunDist, expectedLongestRun,
    chainDistribution, expectedRemaining, analyze, afterStreak,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoinMath = api;
})(this);

/* ===========================================================
   Shuffle Lab — 리플 셔플 계산 (브라우저·Node 공용)
   길버트–섀넌–리즈(GSR) 모형, 상승 수열, 총변동거리
   =========================================================== */
(function (root) {
  'use strict';

  /* 리플 셔플 한 번.
     1) 위에서 c장을 떼어 왼손에 든다. c는 이항분포 B(n, ½)
     2) 왼손 a장, 오른손 b장 남았을 때 왼손에서 떨어질 확률 a/(a+b) */
  function riffle(deck, rng) {
    const n = deck.length;
    let c = 0;
    for (let i = 0; i < n; i++) if (rng() < 0.5) c++;
    const left = deck.slice(0, c), right = deck.slice(c);
    const out = [], from = [];
    let i = 0, j = 0;
    while (i < left.length || j < right.length) {
      const a = left.length - i, b = right.length - j;
      if (rng() * (a + b) < a) { out.push(left[i++]); from.push('L'); }
      else { out.push(right[j++]); from.push('R'); }
    }
    return { deck: out, cut: c, from };
  }

  /* 상승 수열: 원래 순서에서 이어진 번호 v, v+1, ...이 덱에서도 앞에서 뒤로 놓인 묶음.
     개수 = 1 + (v+1이 v보다 앞에 있는 v의 개수). 리플 k번 뒤에는 최대 2^k개 */
  function risingSequences(deck) {
    const n = deck.length;
    const pos = new Array(n);
    deck.forEach((v, i) => { pos[v] = i; });
    const id = new Array(n);
    let cur = 0;
    for (let v = 0; v < n; v++) {
      if (v > 0 && pos[v] < pos[v - 1]) cur++;
      id[v] = cur;
    }
    return { count: n ? cur + 1 : 0, id };
  }

  /* 오일러 수 A(n, r): 상승 수열이 정확히 r개인 순열의 수 (r = 1..n) */
  function eulerian(n) {
    let row = [0, 1];
    for (let m = 2; m <= n; m++) {
      const next = new Array(m + 1).fill(0);
      for (let r = 1; r <= m; r++) {
        next[r] = (r <= m - 1 ? r * row[r] : 0) + (r >= 2 ? (m - r + 1) * row[r - 1] : 0);
      }
      row = next;
    }
    return row;
  }

  /* k번 섞은 덱과 완전 무작위 덱 사이의 총변동거리 (Bayer–Diaconis 1992).
     상승 수열 r개인 순열의 확률 = C(2^k + n − r, n) / 2^(kn) */
  function tvDistance(n, k) {
    const A = eulerian(n);
    const a = Math.pow(2, k);
    let logFact = 0;
    for (let i = 2; i <= n; i++) logFact += Math.log(i);
    const u = Math.exp(-logFact);
    let tv = 0;
    for (let r = 1; r <= n; r++) {
      let p = 0;
      if (a - r + 1 > 0) {
        let lc = -logFact - n * Math.log(a);
        for (let i = 1; i <= n; i++) lc += Math.log(a - r + i);
        p = Math.exp(lc);
      }
      tv += A[r] * Math.abs(p - u);
    }
    return tv / 2;
  }

  /* 카드 한 장을 빼서 다른 자리에 꽂는다 */
  function moveOneCard(deck, rng) {
    const n = deck.length;
    const from = Math.floor(rng() * n);
    let to = Math.floor(rng() * (n - 1));
    const d = deck.slice();
    const [card] = d.splice(from, 1);
    if (to >= from) to++;
    if (to > d.length) to = d.length;
    d.splice(to, 0, card);
    return { deck: d, card, from, to: d.indexOf(card) };
  }

  /* 마술사의 추측: 빼면 상승 수열이 가장 많이 줄어드는 카드가 옮겨진 카드일 가능성이 높다 */
  function magicianGuess(deck) {
    let best = Infinity, cands = [];
    for (let i = 0; i < deck.length; i++) {
      const rest = deck.filter((_, j) => j !== i);
      const relabel = rest.slice().sort((x, y) => x - y);
      const rank = new Map(relabel.map((v, idx) => [v, idx]));
      const c = risingSequences(rest.map((v) => rank.get(v))).count;
      if (c < best) { best = c; cands = [deck[i]]; }
      else if (c === best) cands.push(deck[i]);
    }
    return { candidates: cands, risingAfter: best };
  }

  function identity(n) { return Array.from({ length: n }, (_, i) => i); }

  function shuffleK(n, k, rng) {
    let d = identity(n);
    for (let i = 0; i < k; i++) d = riffle(d, rng).deck;
    return d;
  }

  /* 마술 성공률 (여러 후보가 같으면 그중 하나를 고르므로 1/후보 수만큼 성공) */
  function magicSuccessRate(n, k, trials, rng) {
    let s = 0;
    for (let t = 0; t < trials; t++) {
      const m = moveOneCard(shuffleK(n, k, rng), rng);
      const g = magicianGuess(m.deck);
      if (g.candidates.includes(m.card)) s += 1 / g.candidates.length;
    }
    return s / trials;
  }

  /* 임상시험 배정표: 앞 half장은 A, 뒤 half장은 B. k번 섞은 뒤
     "다음 환자도 직전과 같은 그룹"이라고 맞힐 확률 */
  function allocationGuessRate(half, k, trials, rng) {
    const n = 2 * half;
    let hit = 0, total = 0;
    for (let t = 0; t < trials; t++) {
      const d = shuffleK(n, k, rng);
      for (let i = 1; i < n; i++) {
        total++;
        if ((d[i] < half) === (d[i - 1] < half)) hit++;
      }
    }
    return hit / total;
  }

  function fisherYates(n, rng) {
    const d = identity(n);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  /* 시드를 정할 수 있는 난수 (실험 재현용) */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const api = {
    riffle, risingSequences, eulerian, tvDistance, moveOneCard, magicianGuess,
    identity, shuffleK, magicSuccessRate, allocationGuessRate, fisherYates, mulberry32,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShuffleMath = api;
})(this);

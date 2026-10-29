/* ===========================================================
   Shuffle Lab — 경로 모델링 알고리즘 (브라우저·Node 공용)
   그래프 형식: { nodes:[{id,label,x,y}], edges:[{id,a,b,w}] }  (방향 없음)
   =========================================================== */
(function (root) {
  'use strict';

  function index(g) {
    const idx = new Map();
    g.nodes.forEach((n, i) => idx.set(n.id, i));
    const adj = g.nodes.map(() => []);
    g.edges.forEach((e, k) => {
      const a = idx.get(e.a), b = idx.get(e.b);
      adj[a].push({ to: b, w: e.w, e: k });
      adj[b].push({ to: a, w: e.w, e: k });
    });
    return { idx, adj, n: g.nodes.length };
  }

  function UF(n) {
    const p = Array.from({ length: n }, (_, i) => i);
    const find = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
    return { find, union: (a, b) => { a = find(a); b = find(b); if (a === b) return false; p[a] = b; return true; } };
  }

  function componentsCount(g) {
    const { idx, n } = index(g);
    const uf = UF(n);
    g.edges.forEach((e) => uf.union(idx.get(e.a), idx.get(e.b)));
    const s = new Set();
    for (let i = 0; i < n; i++) s.add(uf.find(i));
    return s.size;
  }

  /* ---------------- ① 크루스칼 ---------------- */
  function sortedEdgeIdx(g) {
    return g.edges.map((e, k) => k).sort((x, y) => g.edges[x].w - g.edges[y].w || x - y);
  }

  function kruskal(g) {
    const { idx, n } = index(g);
    const uf = UF(n);
    const steps = [];
    const tree = [];
    let total = 0;
    sortedEdgeIdx(g).forEach((k) => {
      const e = g.edges[k];
      const ok = uf.union(idx.get(e.a), idx.get(e.b));
      steps.push({ edge: k, accepted: ok });
      if (ok) { tree.push(k); total += e.w; }
    });
    const comps = componentsCount(g);
    return { steps, tree, total, components: comps, spanning: comps === 1 };
  }

  function det(M) {
    const m = M.length;
    const A = M.map((r) => r.slice());
    let d = 1;
    for (let c = 0; c < m; c++) {
      let piv = c;
      for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-12) return 0;
      if (piv !== c) { [A[piv], A[c]] = [A[c], A[piv]]; d = -d; }
      d *= A[c][c];
      for (let r = c + 1; r < m; r++) {
        const f = A[r][c] / A[c][c];
        if (f) for (let k = c; k < m; k++) A[r][k] -= f * A[c][k];
      }
    }
    return d;
  }

  /* 최소 신장 트리(연결망)가 몇 가지인가: 비용이 같은 길 묶음마다 키르히호프 행렬-트리 정리 */
  function countMST(g) {
    const { idx, n } = index(g);
    const uf = UF(n);
    const order = sortedEdgeIdx(g);
    let count = 1;
    let i = 0;
    while (i < order.length) {
      let j = i;
      const w = g.edges[order[i]].w;
      while (j < order.length && g.edges[order[j]].w === w) j++;
      const group = order.slice(i, j).map((k) => [uf.find(idx.get(g.edges[k].a)), uf.find(idx.get(g.edges[k].b))]).filter(([a, b]) => a !== b);
      if (group.length) {
        const local = UF(n);
        group.forEach(([a, b]) => local.union(a, b));
        const byComp = new Map();
        group.forEach(([a, b]) => {
          const r = local.find(a);
          if (!byComp.has(r)) byComp.set(r, []);
          byComp.get(r).push([a, b]);
        });
        byComp.forEach((es) => {
          const verts = [...new Set(es.flat())];
          if (verts.length < 2) return;
          const pos = new Map(verts.map((v, t) => [v, t]));
          const m = verts.length;
          const L = Array.from({ length: m }, () => new Array(m).fill(0));
          es.forEach(([a, b]) => {
            const x = pos.get(a), y = pos.get(b);
            L[x][x]++; L[y][y]++; L[x][y]--; L[y][x]--;
          });
          const minor = L.slice(1).map((r) => r.slice(1));
          count *= Math.round(det(minor));
        });
        group.forEach(([a, b]) => uf.union(a, b));
      }
      i = j;
    }
    return count;
  }

  /* 트리 위에서 u→v 길 (간선 번호 목록) */
  function treePath(g, treeEdges, uId, vId) {
    const { idx, n } = index(g);
    const adj = Array.from({ length: n }, () => []);
    treeEdges.forEach((k) => {
      const e = g.edges[k];
      const a = idx.get(e.a), b = idx.get(e.b);
      adj[a].push([b, k]); adj[b].push([a, k]);
    });
    const s = idx.get(uId), t = idx.get(vId);
    const prev = new Array(n).fill(null);
    const seen = new Array(n).fill(false);
    const q = [s]; seen[s] = true;
    while (q.length) {
      const x = q.shift();
      adj[x].forEach(([y, k]) => { if (!seen[y]) { seen[y] = true; prev[y] = [x, k]; q.push(y); } });
    }
    if (!seen[t]) return null;
    const edges = [];
    for (let x = t; x !== s; x = prev[x][0]) edges.unshift(prev[x][1]);
    return { edges, cost: edges.reduce((a, k) => a + g.edges[k].w, 0) };
  }

  /* 같은 비용의 길로 바꿔 끼워도 최소인 쌍 (예: 2–9 ↔ 8–9) */
  function tieSwaps(g, treeEdges) {
    const inTree = new Set(treeEdges);
    const out = [];
    g.edges.forEach((e, k) => {
      if (inTree.has(k)) return;
      const p = treePath(g, treeEdges, e.a, e.b);
      if (!p) return;
      p.edges.forEach((f) => { if (g.edges[f].w === e.w) out.push({ out: f, in: k }); });
    });
    return out;
  }

  /* ---------------- ② 다익스트라 ---------------- */
  function dijkstra(g, sId) {
    const { idx, adj, n } = index(g);
    const s = idx.get(sId);
    const dist = new Array(n).fill(Infinity);
    const prev = new Array(n).fill(null);
    const ways = new Array(n).fill(0);
    const done = new Array(n).fill(false);
    dist[s] = 0; ways[s] = 1;
    const order = [];
    for (let it = 0; it < n; it++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) break;
      done[u] = true;
      const relaxed = [];
      adj[u].forEach(({ to, w, e }) => {
        if (done[to]) return;
        const nd = dist[u] + w;
        if (nd < dist[to] - 1e-9) { dist[to] = nd; prev[to] = { node: u, edge: e }; ways[to] = ways[u]; relaxed.push(to); }
        else if (Math.abs(nd - dist[to]) <= 1e-9) ways[to] += ways[u];
      });
      order.push({ node: u, dist: dist[u], relaxed: relaxed.slice(), snapshot: dist.slice() });
    }
    return { dist, prev, ways, order, idx };
  }

  function dijkstraPath(res, g, tId) {
    const t = res.idx.get(tId);
    if (res.dist[t] === Infinity) return null;
    const edges = [], nodes = [g.nodes[t].id];
    for (let x = t; res.prev[x]; x = res.prev[x].node) { edges.unshift(res.prev[x].edge); nodes.unshift(g.nodes[res.prev[x].node].id); }
    return { edges, nodes, cost: res.dist[t], ways: res.ways[t] };
  }

  /* ---------------- ③ 오일러 (방향 없는 그래프) ---------------- */
  function eulerInfo(g) {
    const { idx, adj, n } = index(g);
    const deg = adj.map((a) => a.length);
    const odd = [];
    deg.forEach((d, i) => { if (d % 2) odd.push(g.nodes[i].id); });
    const withEdges = [];
    deg.forEach((d, i) => { if (d > 0) withEdges.push(i); });
    let connected = true;
    if (withEdges.length) {
      const seen = new Array(n).fill(false);
      const st = [withEdges[0]]; seen[withEdges[0]] = true;
      while (st.length) { const x = st.pop(); adj[x].forEach(({ to }) => { if (!seen[to]) { seen[to] = true; st.push(to); } }); }
      connected = withEdges.every((i) => seen[i]);
    }
    let verdict;
    if (!g.edges.length) verdict = 'noedges';
    else if (!connected) verdict = 'disconnected';
    else if (odd.length === 0) verdict = 'circuit';
    else if (odd.length === 2) verdict = 'path';
    else verdict = 'none';
    const degree = {};
    g.nodes.forEach((nd, i) => { degree[nd.id] = deg[i]; });
    return { degree, odd, connected, verdict, strokes: Math.max(1, odd.length / 2) };
  }

  /* 히어홀저: 막히면 되돌아가며 남은 고리를 끼워 넣는다. 반환: 간선 순서와 정점 순서 */
  function hierholzer(g, startId) {
    const { idx, adj } = index(g);
    const used = new Array(g.edges.length).fill(false);
    const ptr = adj.map(() => 0);
    const stack = [{ v: idx.get(startId), e: null }];
    const out = [];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const list = adj[top.v];
      while (ptr[top.v] < list.length && used[list[ptr[top.v]].e]) ptr[top.v]++;
      if (ptr[top.v] < list.length) {
        const { to, e } = list[ptr[top.v]];
        used[e] = true;
        stack.push({ v: to, e });
      } else {
        out.push(stack.pop());
      }
    }
    out.reverse();
    return { nodes: out.map((x) => g.nodes[x.v].id), edges: out.slice(1).map((x) => x.e) };
  }

  /* ---------------- ④ 해밀턴 (모든 장소 한 번씩) ---------------- */
  const HAMILTON_MAX = 16;

  function hamilton(g) {
    const { adj, n } = index(g);
    if (n === 0) return { n, paths: 0, cycles: 0 };
    if (n > HAMILTON_MAX) return { n, tooBig: true };
    const FULL = (1 << n) - 1;
    const size = (1 << n) * n;

    // 순서 있는 해밀턴 경로 수 (출발점·방향 구분, PPT 코드와 같은 기준)
    const cnt = new Float64Array(size);
    for (let v = 0; v < n; v++) cnt[(1 << v) * n + v] = 1;
    // 가장 짧은 해밀턴 경로 (돌아오지 않음)
    const best = new Float64Array(size).fill(Infinity);
    const par = new Int8Array(size).fill(-1);
    for (let v = 0; v < n; v++) best[(1 << v) * n + v] = 0;
    for (let mask = 1; mask <= FULL; mask++) {
      for (let v = 0; v < n; v++) {
        const id = mask * n + v;
        const c = cnt[id];
        if (!c) continue;
        const b = best[id];
        adj[v].forEach(({ to, w }) => {
          if (mask & (1 << to)) return;
          const nid = (mask | (1 << to)) * n + to;
          cnt[nid] += c;
          if (b + w < best[nid]) { best[nid] = b + w; par[nid] = v; }
        });
      }
    }
    let paths = 0, bestPath = Infinity, bestEnd = -1;
    for (let v = 0; v < n; v++) {
      paths += cnt[FULL * n + v];
      if (best[FULL * n + v] < bestPath) { bestPath = best[FULL * n + v]; bestEnd = v; }
    }
    const pathOrder = bestEnd < 0 ? null : unwind(par, n, FULL, bestEnd);

    // 출발점을 0번으로 고정한 해밀턴 회로 (돌아옴)
    let cycles = 0, bestCycle = Infinity, cycleOrder = null;
    if (n >= 3) {
      const c0 = new Float64Array(size);
      const b0 = new Float64Array(size).fill(Infinity);
      const p0 = new Int8Array(size).fill(-1);
      c0[1 * n + 0] = 1; b0[1 * n + 0] = 0;
      for (let mask = 1; mask <= FULL; mask += 2) {
        for (let v = 0; v < n; v++) {
          const id = mask * n + v;
          if (!c0[id]) continue;
          adj[v].forEach(({ to, w }) => {
            if (mask & (1 << to)) return;
            const nid = (mask | (1 << to)) * n + to;
            c0[nid] += c0[id];
            if (b0[id] + w < b0[nid]) { b0[nid] = b0[id] + w; p0[nid] = v; }
          });
        }
      }
      let closable = 0, end = -1;
      adj[0].forEach(({ to, w }) => {
        closable += c0[FULL * n + to];
        const tot = b0[FULL * n + to] + w;
        if (tot < bestCycle) { bestCycle = tot; end = to; }
      });
      cycles = closable / 2;
      if (end >= 0 && bestCycle < Infinity) cycleOrder = unwind(p0, n, FULL, end).concat([0]);
    }
    const ids = (ord) => (ord ? ord.map((i) => g.nodes[i].id) : null);
    return {
      n, paths, cycles,
      closablePaths: 2 * n * cycles,
      bestPath: bestPath === Infinity ? null : { cost: bestPath, nodes: ids(pathOrder) },
      bestCycle: bestCycle === Infinity ? null : { cost: bestCycle, nodes: ids(cycleOrder) },
    };
  }

  function unwind(par, n, mask, end) {
    const order = [];
    let v = end;
    while (v >= 0) {
      order.unshift(v);
      const p = par[mask * n + v];
      mask &= ~(1 << v);
      v = p;
    }
    return order;
  }

  function edgeBetween(g, aId, bId) {
    return g.edges.findIndex((e) => (e.a === aId && e.b === bId) || (e.a === bId && e.b === aId));
  }

  const api = {
    index, UF, componentsCount, kruskal, countMST, treePath, tieSwaps,
    dijkstra, dijkstraPath, eulerInfo, hierholzer, hamilton, edgeBetween, HAMILTON_MAX,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GraphAlgos = api;
})(this);

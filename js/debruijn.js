/* ===========================================================
   Shuffle Lab — Module 3: 드 브루인 그래프 → 오일러 회로
   순수 JS + SVG, 빌드 도구 없음
   =========================================================== */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('graph-svg');
  const kSelect = document.getElementById('k-select');
  const nSelect = document.getElementById('n-select');

  const el = {
    generateBtn: document.getElementById('generate-btn'),
    resetBtn: document.getElementById('reset-btn'),
    sideResetBtn: document.getElementById('side-reset-btn'),
    autosolveBtn: document.getElementById('autosolve-btn'),
    graphStatus: document.getElementById('graph-status'),
    statusMessage: document.getElementById('status-message'),
    sequenceDisplay: document.getElementById('sequence-display'),
    progressText: document.getElementById('progress-text'),
    vertexCountText: document.getElementById('vertex-count-text'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    degreeTableBody: document.getElementById('degree-table-body'),
    condBalancedDot: document.getElementById('cond-balanced-dot'),
    condConnectedDot: document.getElementById('cond-connected-dot'),
  };

  let state = null;

  /* ---------------- graph construction ---------------- */

  function generateStrings(alphabet, length) {
    if (length <= 0) return [''];
    let result = [''];
    for (let i = 0; i < length; i++) {
      const next = [];
      for (const prefix of result) {
        for (const ch of alphabet) next.push(prefix + ch);
      }
      result = next;
    }
    return result;
  }

  function buildGraph(k, n) {
    const alphabet = ['0', '1', '2'].slice(0, k);
    const vertexLen = n - 1;
    const vertices = generateStrings(alphabet, vertexLen);
    const edges = [];
    vertices.forEach((v) => {
      alphabet.forEach((s) => {
        const label = v + s;
        const to = label.slice(1);
        edges.push({ id: label, label, from: v, to, used: false, isSelfLoop: v === to });
      });
    });
    return { k, n, alphabet, vertices, edges };
  }

  function isConnected(graph) {
    if (graph.vertices.length <= 1) return true;
    const adj = {};
    graph.vertices.forEach((v) => (adj[v] = new Set()));
    graph.edges.forEach((e) => {
      adj[e.from].add(e.to);
      adj[e.to].add(e.from);
    });
    const seen = new Set([graph.vertices[0]]);
    const stack = [graph.vertices[0]];
    while (stack.length) {
      const v = stack.pop();
      adj[v].forEach((w) => {
        if (!seen.has(w)) {
          seen.add(w);
          stack.push(w);
        }
      });
    }
    return seen.size === graph.vertices.length;
  }

  /* ---------------- n-select options ---------------- */

  function nOptionsFor(k) {
    const opts = [];
    for (let n = 2; n <= 6; n++) {
      if (Math.pow(k, n - 1) > 9) break;
      opts.push(n);
    }
    return opts;
  }

  function refreshNSelect() {
    const k = parseInt(kSelect.value, 10);
    const opts = nOptionsFor(k);
    nSelect.innerHTML = '';
    opts.forEach((n) => {
      const o = document.createElement('option');
      o.value = String(n);
      const vcount = Math.pow(k, n - 1);
      const ecount = Math.pow(k, n);
      o.textContent = `${n}  (정점 ${vcount}개 · 간선 ${ecount}개)`;
      nSelect.appendChild(o);
    });
    nSelect.value = String(opts.includes(3) ? 3 : opts[0]);
  }

  /* ---------------- layout ---------------- */

  const CENTER = { x: 320, y: 280 };

  function computeLayout(vertices) {
    const N = vertices.length;
    const R = N <= 3 ? 140 : N <= 6 ? 185 : 230;
    const positions = {};
    vertices.forEach((v, i) => {
      const angle = -Math.PI / 2 + i * ((2 * Math.PI) / N);
      positions[v] = { x: CENTER.x + R * Math.cos(angle), y: CENTER.y + R * Math.sin(angle) };
    });
    return positions;
  }

  function displayVertex(v) {
    return v === '' ? 'ε' : v;
  }

  /* ---------------- rendering ---------------- */

  function renderGraph() {
    svg.innerHTML = '';
    const N = state.graph.vertices.length;
    const vr = N <= 4 ? 26 : N <= 8 ? 22 : 18;

    const defs = document.createElementNS(SVG_NS, 'defs');
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8.5');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS(SVG_NS, 'path');
    arrowPath.setAttribute('d', 'M0,0 L10,5 L0,10 Z');
    arrowPath.setAttribute('fill', 'context-stroke');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);

    state.positions = computeLayout(state.graph.vertices);

    const edgeGroup = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(edgeGroup);

    state.graph.edges.forEach((edge) => {
      const pFrom = state.positions[edge.from];
      const pTo = state.positions[edge.to];
      let d, labelPos;

      if (edge.isSelfLoop) {
        const ux = pFrom.x - CENTER.x;
        const uy = pFrom.y - CENTER.y;
        const ulen = Math.hypot(ux, uy) || 1;
        const u = { x: ux / ulen, y: uy / ulen };
        const v = { x: -u.y, y: u.x };
        const start = { x: pFrom.x + v.x * 6, y: pFrom.y + v.y * 6 };
        const end = { x: pFrom.x - v.x * 6, y: pFrom.y - v.y * 6 };
        const c1 = { x: pFrom.x + u.x * 42 + v.x * 22, y: pFrom.y + u.y * 42 + v.y * 22 };
        const c2 = { x: pFrom.x + u.x * 42 - v.x * 22, y: pFrom.y + u.y * 42 - v.y * 22 };
        d = `M ${start.x},${start.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`;
        labelPos = { x: pFrom.x + u.x * 58, y: pFrom.y + u.y * 58 };
      } else {
        const mx = (pFrom.x + pTo.x) / 2;
        const my = (pFrom.y + pTo.y) / 2;
        const dx = pTo.x - pFrom.x;
        const dy = pTo.y - pFrom.y;
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len;
        const py = dx / len;
        const offset = 24;
        const ctrl = { x: mx + px * offset, y: my + py * offset };
        d = `M ${pFrom.x},${pFrom.y} Q ${ctrl.x},${ctrl.y} ${pTo.x},${pTo.y}`;
        labelPos = { x: mx + px * offset * 1.5, y: my + py * offset * 1.5 };
      }

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'edge-path');
      path.setAttribute('marker-end', 'url(#arrowhead)');

      const hit = document.createElementNS(SVG_NS, 'path');
      hit.setAttribute('d', d);
      hit.setAttribute('class', 'edge-hit');
      hit.addEventListener('click', () => onEdgeClick(edge.id));

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', labelPos.x);
      label.setAttribute('y', labelPos.y);
      label.setAttribute('class', 'edge-label');
      label.textContent = edge.label;

      edgeGroup.appendChild(path);
      edgeGroup.appendChild(hit);
      edgeGroup.appendChild(label);

      edge._dom = { path, hit, label };
    });

    const vertexGroup = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(vertexGroup);

    state.vertexDom = {};
    state.graph.vertices.forEach((v) => {
      const p = state.positions[v];
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('tabindex', '0');
      g.addEventListener('click', () => onVertexClick(v));
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') onVertexClick(v);
      });

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', vr);
      circle.setAttribute('class', 'vertex-circle pickable');

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', p.x);
      label.setAttribute('y', p.y);
      label.setAttribute('class', 'vertex-label');
      label.textContent = displayVertex(v);

      g.appendChild(circle);
      g.appendChild(label);
      vertexGroup.appendChild(g);

      state.vertexDom[v] = { circle, label };
    });
  }

  /* ---------------- state / status helpers ---------------- */

  function newState(graph) {
    return {
      graph,
      positions: {},
      vertexDom: {},
      startVertex: null,
      currentVertex: null,
      phase: 'idle',
      usedCount: 0,
      totalEdges: graph.edges.length,
      sequence: '',
      isAnimating: false,
      connected: isConnected(graph),
    };
  }

  function setStatus(text, kind) {
    el.statusMessage.textContent = text;
    el.statusMessage.className = 'status-message' + (kind === 'stuck' ? ' stuck' : kind === 'complete' ? ' complete' : '');
    const shortMap = { idle: '시작점을 고르세요', active: '회로 만드는 중', stuck: '막힘 — 다시 시도해보세요', complete: '완성!' };
    el.graphStatus.textContent = shortMap[kind] || text;
    el.graphStatus.className = 'graph-status' + (kind && kind !== 'idle' ? ' ' + kind : '');
  }

  function updateSequenceDisplay() {
    if (!state.sequence) {
      el.sequenceDisplay.textContent = '—';
      return;
    }
    const seq = state.sequence;
    el.sequenceDisplay.innerHTML = escapeHtml(seq.slice(0, -1)) + `<span class="cursor-char">${escapeHtml(seq.slice(-1))}</span>`;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function updateProgress() {
    el.progressText.textContent = `${state.usedCount} / ${state.totalEdges} 간선`;
    el.vertexCountText.textContent = `${state.graph.vertices.length}개 정점`;
    const pct = state.totalEdges ? Math.round((state.usedCount / state.totalEdges) * 100) : 0;
    el.progressBarFill.style.width = pct + '%';
  }

  function updateDegreeTable() {
    el.degreeTableBody.innerHTML = '';
    state.graph.vertices.forEach((v) => {
      const outRemain = state.graph.edges.filter((e) => e.from === v && !e.used).length;
      const inRemain = state.graph.edges.filter((e) => e.to === v && !e.used).length;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${displayVertex(v)}</td><td class="${outRemain === 0 ? 'zero' : ''}">${outRemain}</td><td class="${inRemain === 0 ? 'zero' : ''}">${inRemain}</td>`;
      el.degreeTableBody.appendChild(tr);
    });
  }

  function updateConditionDots() {
    el.condBalancedDot.classList.add('ok');
    el.condConnectedDot.classList.toggle('ok', state.connected);
    el.condConnectedDot.classList.toggle('bad', !state.connected);
  }

  /* ---------------- vertex / edge visual state ---------------- */

  function markVertexCurrent(v) {
    const dom = state.vertexDom[v];
    dom.circle.classList.add('current');
    dom.label.classList.add('current');
  }
  function clearVertexCurrentClass(v) {
    if (!v) return;
    const dom = state.vertexDom[v];
    dom.circle.classList.remove('current', 'stuck');
    dom.label.classList.remove('current');
  }
  function markStartMarker(v) {
    state.vertexDom[v].circle.classList.add('start-marker');
  }
  function markVertexStuck(v) {
    state.vertexDom[v].circle.classList.add('stuck');
  }

  function highlightAvailableEdges() {
    state.graph.edges.forEach((e) => {
      if (!e.used) {
        e._dom.path.classList.toggle('available', e.from === state.currentVertex);
      }
    });
  }
  function clearAvailableHighlights() {
    state.graph.edges.forEach((e) => {
      if (!e.used) e._dom.path.classList.remove('available');
    });
  }

  /* ---------------- interaction ---------------- */

  function onVertexClick(v) {
    if (state.isAnimating) return;
    if (state.phase !== 'idle') return;
    state.startVertex = v;
    state.currentVertex = v;
    state.phase = 'active';
    state.sequence = v;
    markVertexCurrent(v);
    markStartMarker(v);
    highlightAvailableEdges();
    updateSequenceDisplay();
    setStatus(`시작 정점 ${displayVertex(v)}에서 출발합니다. 나갈 간선을 클릭하세요.`, 'active');
  }

  function onEdgeClick(id) {
    if (state.isAnimating) return;
    if (state.phase !== 'active') return;
    const edge = state.graph.edges.find((e) => e.id === id);
    if (!edge || edge.used || edge.from !== state.currentVertex) return;
    applyEdgeUse(edge);
    afterMove();
  }

  function applyEdgeUse(edge) {
    edge.used = true;
    state.usedCount++;
    edge._dom.path.classList.remove('available');
    edge._dom.path.classList.add('used');
    edge._dom.hit.classList.add('locked');
    edge._dom.label.classList.add('used');
    state.sequence += edge.label.slice(-1);
    clearVertexCurrentClass(state.currentVertex);
    state.currentVertex = edge.to;
    markVertexCurrent(state.currentVertex);
    updateSequenceDisplay();
    updateProgress();
    updateDegreeTable();
  }

  function afterMove() {
    clearAvailableHighlights();
    if (state.usedCount === state.totalEdges) {
      state.phase = 'complete';
      setStatus(`완성했습니다! 모든 간선을 한 번씩 지나 출발점으로 돌아왔습니다. 만들어진 수열: ${state.sequence}`, 'complete');
      return;
    }
    const outgoing = state.graph.edges.filter((e) => e.from === state.currentVertex && !e.used);
    if (outgoing.length === 0) {
      state.phase = 'stuck';
      markVertexStuck(state.currentVertex);
      setStatus('막다른 길에 갇혔습니다. 이 정점에서 나갈 수 있는 새 간선이 없지만, 아직 쓰지 않은 간선이 다른 곳에 남아 있습니다. "다시 시도"로 순서를 바꿔보거나, "컴퓨터가 풀어보기"로 올바른 경로를 확인해보세요.', 'stuck');
      return;
    }
    state.phase = 'active';
    highlightAvailableEdges();
    setStatus(`현재 정점: ${displayVertex(state.currentVertex)}. 나갈 수 있는 간선 ${outgoing.length}개 중 하나를 클릭하세요.`, 'active');
  }

  /* ---------------- reset ---------------- */

  function resetTraversal() {
    if (state.isAnimating) return;
    state.graph.edges.forEach((e) => {
      e.used = false;
      e._dom.path.classList.remove('used', 'available');
      e._dom.hit.classList.remove('locked');
      e._dom.label.classList.remove('used');
    });
    state.graph.vertices.forEach((v) => {
      const dom = state.vertexDom[v];
      dom.circle.classList.remove('current', 'stuck', 'start-marker');
      dom.label.classList.remove('current');
    });
    state.startVertex = null;
    state.currentVertex = null;
    state.phase = 'idle';
    state.usedCount = 0;
    state.sequence = '';
    updateSequenceDisplay();
    updateProgress();
    updateDegreeTable();
    setStatus('정점을 클릭해 시작점을 고르세요.', 'idle');
  }

  /* ---------------- Hierholzer autosolve ---------------- */

  function computeEulerCircuitVertices(start) {
    const adj = {};
    state.graph.vertices.forEach((v) => (adj[v] = []));
    state.graph.edges.forEach((e) => {
      if (!e.used) adj[e.from].push(e);
    });
    const stack = [start];
    const circuit = [];
    while (stack.length) {
      const v = stack[stack.length - 1];
      if (adj[v].length) {
        const e = adj[v].pop();
        stack.push(e.to);
      } else {
        circuit.push(stack.pop());
      }
    }
    return circuit.reverse();
  }

  function autosolve() {
    if (state.isAnimating) return;
    const start = state.startVertex || state.graph.vertices[0];
    resetTraversal();

    state.startVertex = start;
    state.currentVertex = start;
    state.phase = 'active';
    state.sequence = start;
    markVertexCurrent(start);
    markStartMarker(start);
    updateSequenceDisplay();

    const vseq = computeEulerCircuitVertices(start);
    const usedForStep = [];
    const stepsEdges = [];
    for (let i = 0; i < vseq.length - 1; i++) {
      const from = vseq[i];
      const to = vseq[i + 1];
      const edge = state.graph.edges.find((e) => e.from === from && e.to === to && !usedForStep.includes(e));
      usedForStep.push(edge);
      stepsEdges.push(edge);
    }

    state.isAnimating = true;
    setStatus('컴퓨터가 Hierholzer 알고리즘으로 막히지 않는 경로를 계산해 회로를 완성하는 중입니다…', 'active');

    let i = 0;
    const timer = setInterval(() => {
      if (i >= stepsEdges.length) {
        clearInterval(timer);
        state.isAnimating = false;
        afterMove();
        return;
      }
      applyEdgeUse(stepsEdges[i]);
      highlightAvailableEdges();
      i++;
    }, 260);
  }

  /* ---------------- init ---------------- */

  function initGraph() {
    const k = parseInt(kSelect.value, 10);
    const n = parseInt(nSelect.value, 10);
    const graph = buildGraph(k, n);
    state = newState(graph);
    renderGraph();
    updateDegreeTable();
    updateConditionDots();
    updateSequenceDisplay();
    updateProgress();
    setStatus('정점을 클릭해 시작점을 고르세요.', 'idle');
  }

  el.generateBtn.addEventListener('click', initGraph);
  el.resetBtn.addEventListener('click', resetTraversal);
  el.sideResetBtn.addEventListener('click', resetTraversal);
  el.autosolveBtn.addEventListener('click', autosolve);
  kSelect.addEventListener('change', refreshNSelect);

  refreshNSelect();
  initGraph();
})();

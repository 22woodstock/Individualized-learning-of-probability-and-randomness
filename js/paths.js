/* ===========================================================
   Shuffle Lab — Module 4: 경로 모델링
   사진 위에 장소·길을 그리고 네 가지 질문을 풀어 본다
   =========================================================== */
(function () {
  'use strict';
  const GA = window.GraphAlgos;
  const PRESETS = window.PathPresets;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const svg = $('map');
  const L = { bg: $('layer-bg'), edges: $('layer-edges'), nodes: $('layer-nodes') };
  const STORE = 'shufflelab-paths-v1';
  const SCALE = 20; // 비용 = 화면 거리 ÷ 20
  const W = 900, H = 600;

  let G = { nodes: [], edges: [] };
  let tab = 'draw';
  let tool = 'make';
  let sel = null;            // { type:'node'|'edge', id }
  let bgURL = null;
  let T = {};                // 탭별 상태 (그래프가 바뀌면 초기화)
  let idSeq = 0;
  let editKey = '';

  /* ---------------- 공통 도구 ---------------- */
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(n);
    return n;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const nodeById = (id) => G.nodes.find((n) => n.id === id);
  const lab = (id) => { const n = nodeById(id); return n ? n.label : '?'; };
  /* 번호면 "3번", 이름이면 "기숙사" */
  const nb = (id) => { const l = lab(id); return esc(/^\d+$/.test(l) ? l + '번' : l); };
  const fmtW = (w) => (Number.isInteger(w) ? String(w) : String(Math.round(w * 100) / 100));
  const fmtBig = (x) => (x >= 1e15 ? x.toExponential(2).replace('e+', '×10^') : Math.round(x).toLocaleString('ko-KR'));
  const edgeName = (k) => `${lab(G.edges[k].a)}–${lab(G.edges[k].b)}`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function autoW(e) {
    const a = nodeById(e.a), b = nodeById(e.b);
    return Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / SCALE));
  }
  function svgPoint(ev) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }
  function nextLabel() {
    const used = new Set(G.nodes.map((n) => n.label));
    let i = 1;
    while (used.has(String(i))) i++;
    return String(i);
  }
  const newId = (p) => p + Date.now().toString(36) + (idSeq++);
  const edgeIdx = (a, b) => GA.edgeBetween(G, a, b);

  /* ---------------- 저장 · 불러오기 ---------------- */
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(G)); } catch (e) { /* 저장 불가 환경 */ }
  }
  function restore() {
    try {
      const s = localStorage.getItem(STORE);
      if (!s) return false;
      const g = JSON.parse(s);
      if (g && Array.isArray(g.nodes) && Array.isArray(g.edges)) { G = g; return true; }
    } catch (e) { /* 무시 */ }
    return false;
  }
  function loadPreset(key) {
    const p = clone(PRESETS[key]);
    G = { nodes: p.nodes, edges: p.edges };
    if (p.autoWeights) G.edges.forEach((e) => { e.auto = true; e.w = autoW(e); });
    sel = null;
    $('preset-about').textContent = p.about || '';
    changed();
  }
  function changed() {
    T = {};
    save();
    refresh();
  }

  /* ---------------- 그리기 ---------------- */
  function render(view) {
    L.edges.innerHTML = '';
    L.nodes.innerHTML = '';
    G.edges.forEach((e, k) => {
      const a = nodeById(e.a), b = nodeById(e.b);
      if (!a || !b) return;
      const g = el('g', { class: 'edge ' + (view.edge[k] || ''), 'data-edge': k }, L.edges);
      el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'edge-hit' }, g);
      el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'edge-line' }, g);
      if (/\bmstpath\b/.test(view.edge[k] || '')) el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'edge-overlay' }, g);
      if (view.weights !== false) {
        el('text', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, class: 'edge-w', text: fmtW(e.w) + (e.note ? '*' : '') }, g);
      }
    });
    G.nodes.forEach((n) => {
      const small = n.kind === 'bridge';
      const g = el('g', { class: `node ${small ? 'bridge' : ''} ${view.node[n.id] || ''}`, 'data-node': n.id, transform: `translate(${n.x},${n.y})` }, L.nodes);
      el('circle', { r: small ? 11 : 18 }, g);
      el('text', { class: 'node-label' + (n.label.length > 2 ? ' long' : ''), text: n.label }, g);
      if (view.badge[n.id] !== undefined) el('text', { class: 'node-badge ' + (view.badgeCls[n.id] || ''), y: small ? -18 : -26, text: view.badge[n.id] }, g);
    });
    const st = $('map-status');
    st.textContent = view.status || '';
    st.className = 'graph-status ' + (view.statusKind || '');
    $('map-foot').innerHTML = view.foot || '';
  }

  function blankView() { return { edge: {}, node: {}, badge: {}, badgeCls: {}, status: '', statusKind: '', foot: '' }; }

  function footNotes() {
    const parts = [`비용은 처음에 <b>화면 거리 ÷ ${SCALE}</b>로 정해져요. 지도 그리기에서 길을 눌러 바꿀 수 있어요.`];
    G.edges.forEach((e) => { if (e.note) parts.push(`* ${esc(edgeNameById(e))}: ${esc(e.note)}`); });
    return parts.join('<br>');
  }
  const edgeNameById = (e) => `${lab(e.a)}–${lab(e.b)}`;

  function refresh() {
    let view = blankView();
    if (tab === 'draw') view = viewDraw(view);
    else if (tab === 'mst') view = viewMST(view);
    else if (tab === 'sp') view = viewSP(view);
    else if (tab === 'euler') view = viewEuler(view);
    else if (tab === 'ham') view = viewHam(view);
    render(view);
    $('graph-count').textContent = `장소 ${G.nodes.length} · 길 ${G.edges.length}`;
  }

  /* ================= ✏️ 지도 그리기 ================= */
  function viewDraw(v) {
    if (sel && sel.type === 'node') v.node[sel.id] = 'sel';
    if (sel && sel.type === 'edge') { const k = G.edges.findIndex((e) => e.id === sel.id); if (k >= 0) v.edge[k] = 'sel'; }
    if (tool === 'erase') { v.status = '지울 장소나 길을 누르세요'; v.statusKind = 'stuck'; }
    else if (sel && sel.type === 'node') { v.status = `${/^\d+$/.test(lab(sel.id)) ? lab(sel.id) + '번' : lab(sel.id)}에서 이을 장소를 누르세요`; v.statusKind = 'active'; }
    else v.status = G.nodes.length ? '빈 곳: 장소 추가 · 장소 두 개: 길 잇기' : '빈 곳을 눌러 장소를 만드세요';
    v.foot = footNotes();
    renderEdit();
    return v;
  }

  function renderEdit() {
    const key = sel ? sel.type + ':' + sel.id : '';
    if (key === editKey) return;
    editKey = key;
    const box = $('edit-body');
    if (!sel) { box.innerHTML = '<p class="tiny">장소나 길을 누르면 여기서 고칠 수 있어요.</p>'; return; }
    if (sel.type === 'node') {
      const n = nodeById(sel.id);
      if (!n) { sel = null; return renderEdit(); }
      box.innerHTML = `<div class="control-field slim"><label for="ed-label">장소 이름 (짧게)</label><input type="text" id="ed-label" maxlength="6" value="${esc(n.label)}"></div>
        <div class="btn-row top-gap"><button class="btn small secondary" id="ed-del">이 장소 지우기</button></div>`;
      $('ed-label').addEventListener('input', (e) => { n.label = e.target.value.trim() || n.label; save(); refresh(); });
    } else {
      const e = G.edges.find((x) => x.id === sel.id);
      if (!e) { sel = null; return renderEdit(); }
      box.innerHTML = `<div class="control-field slim"><label for="ed-w">${esc(edgeNameById(e))} 길의 비용</label><input type="number" id="ed-w" min="0" step="any" value="${e.w}"></div>
        <label class="toggle top-gap"><input type="checkbox" id="ed-auto" ${e.auto ? 'checked' : ''}> 화면 거리로 자동 계산</label>
        ${e.note ? `<p class="tiny">${esc(e.note)}</p>` : ''}
        <div class="btn-row top-gap"><button class="btn small secondary" id="ed-del">이 길 지우기</button></div>`;
      $('ed-w').addEventListener('change', (ev) => {
        const w = parseFloat(ev.target.value);
        if (!isFinite(w) || w < 0) { ev.target.value = e.w; return; }
        e.w = w; e.auto = false; e.note = '';
        $('ed-auto').checked = false;
        changed();
      });
      $('ed-auto').addEventListener('change', (ev) => {
        e.auto = ev.target.checked;
        if (e.auto) { e.w = autoW(e); e.note = ''; $('ed-w').value = e.w; }
        changed();
      });
    }
    $('ed-del').addEventListener('click', deleteSelected);
  }

  function deleteSelected() {
    if (!sel) return;
    if (sel.type === 'node') {
      const id = sel.id;
      G.nodes = G.nodes.filter((n) => n.id !== id);
      G.edges = G.edges.filter((e) => e.a !== id && e.b !== id);
    } else {
      G.edges = G.edges.filter((e) => e.id !== sel.id);
    }
    sel = null;
    changed();
  }

  function drawNode(id) {
    if (tool === 'erase') { sel = { type: 'node', id }; deleteSelected(); return; }
    if (sel && sel.type === 'node' && sel.id !== id && nodeById(sel.id)) {
      let k = edgeIdx(sel.id, id);
      if (k < 0) {
        const e = { id: newId('e'), a: sel.id, b: id, w: 1, auto: true, note: '' };
        e.w = autoW(e);
        G.edges.push(e);
      }
      sel = { type: 'node', id };
      changed();
      return;
    }
    sel = sel && sel.type === 'node' && sel.id === id ? null : { type: 'node', id };
    refresh();
  }
  function drawEdge(k) {
    if (tool === 'erase') { sel = { type: 'edge', id: G.edges[k].id }; deleteSelected(); return; }
    sel = { type: 'edge', id: G.edges[k].id };
    refresh();
  }
  function drawEmpty(p) {
    if (tool !== 'make') return;
    if (sel) { sel = null; refresh(); return; }
    if (G.nodes.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < 30)) return;
    const id = newId('n');
    G.nodes.push({ id, label: nextLabel(), x: clamp(p.x, 20, W - 20), y: clamp(p.y, 20, H - 20), kind: '' });
    changed();
  }

  /* ================= ① 모든 장소 잇기 (MST) ================= */
  function mstState() {
    if (!T.mst) {
      const k = GA.kruskal(G);
      T.mst = { mode: (T.mstMode || 'me'), picks: new Set(), k, step: 0, flash: null, count: null, swaps: null, msg: '' };
    }
    return T.mst;
  }
  function mstNeeded() { return Math.max(0, G.nodes.length - GA.componentsCount(G)); }

  function viewMST(v) {
    const S = mstState();
    if (S.mode === 'me') {
      S.picks.forEach((k) => { v.edge[k] = 'pick'; });
      if (S.flash !== null) v.edge[S.flash] = 'bad';
      v.status = '길을 눌러 고르세요';
    } else {
      const steps = S.k.steps;
      for (let i = 0; i < S.step; i++) v.edge[steps[i].edge] = steps[i].accepted ? 'tree' : 'rejected';
      if (S.step > 0 && S.step <= steps.length) v.edge[steps[S.step - 1].edge] += ' current';
      if (S.step >= steps.length && steps.length) {
        if (S.count === null) { S.count = GA.countMST(G); S.swaps = GA.tieSwaps(G, S.k.tree); }
        S.swaps.forEach((s) => { v.edge[s.in] = 'alt'; });
        v.status = `최소 비용 ${fmtW(S.k.total)}`;
        v.statusKind = 'complete';
      } else {
        v.status = `크루스칼 ${S.step} / ${steps.length}단계`;
        v.statusKind = 'active';
      }
    }
    v.foot = footNotes();
    panelMST();
    return v;
  }

  function panelMST() {
    const S = mstState();
    document.querySelectorAll('[data-mst-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mstMode === S.mode));
    $('mst-me').hidden = S.mode !== 'me';
    $('mst-k').hidden = S.mode !== 'kruskal';
    const need = mstNeeded();
    const res = $('mst-result');
    if (S.mode === 'me') {
      let cost = 0;
      S.picks.forEach((k) => { cost += G.edges[k].w; });
      $('mst-me-count').innerHTML = `${S.picks.size} <small>/ ${need}</small>`;
      $('mst-me-cost').textContent = fmtW(cost);
      const msg = $('mst-me-msg');
      if (S.msg) { msg.innerHTML = S.msg; msg.className = 'status-message stuck'; }
      else if (need > 0 && S.picks.size === need) {
        const best = S.k.total;
        const same = Math.abs(cost - best) < 1e-9;
        msg.innerHTML = same
          ? `<b>최소 연결망을 찾았어요!</b> 비용 ${fmtW(cost)}로, 이보다 싸게 이을 수는 없습니다.`
          : `모든 장소를 이었어요. 내 비용은 <b>${fmtW(cost)}</b>, 최소 비용은 <b>${fmtW(best)}</b>입니다. "크루스칼 보기"로 비교해 보세요.`;
        msg.className = 'status-message ' + (same ? 'complete' : '');
      } else {
        msg.textContent = need ? `길 ${need}개로 모든 장소를 이을 수 있어요. 길을 눌러 고르고, 다시 누르면 빠집니다.` : '장소가 2곳 이상 있어야 해요. 지도 그리기에서 만들어 보세요.';
        msg.className = 'status-message';
      }
      res.hidden = true;
      return;
    }
    // 크루스칼
    const steps = S.k.steps;
    const list = $('mst-list');
    list.innerHTML = steps.map((s, i) => {
      const e = G.edges[s.edge];
      const state = i < S.step ? (s.accepted ? 'ok' : 'no') : 'wait';
      const mark = state === 'ok' ? '✓ 선택' : state === 'no' ? '✗ 고리' : '·';
      return `<div class="el-row ${state} ${i === S.step - 1 ? 'cur' : ''}"><span>${esc(edgeName(s.edge))}</span><span class="w">${fmtW(e.w)}</span><span class="m">${mark}</span></div>`;
    }).join('') || '<p class="tiny">길이 없어요.</p>';
    const cur = list.querySelector('.cur');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
    const msg = $('mst-k-msg');
    if (S.step === 0) msg.textContent = '비용이 싼 길부터 차례로 봅니다. 이미 이어진 두 곳을 또 잇는 길(고리)은 버립니다.';
    else if (S.step <= steps.length) {
      const s = steps[S.step - 1];
      msg.innerHTML = s.accepted
        ? `<b>${esc(edgeName(s.edge))}</b> (비용 ${fmtW(G.edges[s.edge].w)}): 아직 따로 떨어진 두 곳을 이어 주니 <b>선택</b>.`
        : `<b>${esc(edgeName(s.edge))}</b> (비용 ${fmtW(G.edges[s.edge].w)}): 두 곳이 이미 이어져 있어 고리가 생기니 <b>버림</b>.`;
    }
    $('mst-step').disabled = $('mst-all').disabled = S.step >= steps.length;
    if (S.step >= steps.length && steps.length) {
      if (S.count === null) { S.count = GA.countMST(G); S.swaps = GA.tieSwaps(G, S.k.tree); }
      const comps = S.k.components;
      let html = `<h4>결과</h4><div class="stat-grid">
        <div class="stat"><span class="k">최소 비용</span><span class="v">${fmtW(S.k.total)}</span></div>
        <div class="stat"><span class="k">고른 길</span><span class="v">${S.k.tree.length}</span></div></div>`;
      if (comps > 1) html += `<p class="note brick">지도가 <b>${comps}덩어리</b>로 나뉘어 있어서 하나로 이을 수 없어요. 덩어리마다 따로 최소 연결망을 만들었습니다.</p>`;
      html += S.count > 1
        ? `<p class="note">비용이 같은 길 때문에 최소 연결망이 <b>${fmtBig(S.count)}가지</b>예요. 최소 비용은 모두 같습니다.${S.swaps.length ? '<br>바꿔 끼워도 되는 길(점선): ' + S.swaps.slice(0, 6).map((s) => `${esc(edgeName(s.out))} ↔ ${esc(edgeName(s.in))}`).join(', ') : ''}</p>`
        : '<p class="note teal">최소 연결망은 <b>한 가지</b>뿐이에요.</p>';
      html += '<p class="tiny">싼 길부터 욕심내서 골랐는데도 항상 최소가 되는 이유는 아래 "매트로이드" 설명을 보세요.</p>';
      res.innerHTML = html;
      res.hidden = false;
    } else res.hidden = true;
  }

  function mstEdge(k) {
    const S = mstState();
    if (S.mode !== 'me') return;
    S.msg = '';
    S.flash = null;
    if (S.picks.has(k)) { S.picks.delete(k); refresh(); return; }
    const { idx, n } = GA.index(G);
    const uf = GA.UF(n);
    S.picks.forEach((j) => uf.union(idx.get(G.edges[j].a), idx.get(G.edges[j].b)));
    const e = G.edges[k];
    if (!uf.union(idx.get(e.a), idx.get(e.b))) {
      S.flash = k;
      S.msg = `<b>${esc(edgeName(k))}</b>을 넣으면 <b>고리</b>가 생겨요. ${nb(e.a)}과 ${nb(e.b)}은 이미 고른 길로 이어져 있으니 이 길은 낭비입니다.`;
      refresh();
      setTimeout(() => { if (T.mst === S) { S.flash = null; refresh(); } }, 900);
      return;
    }
    S.picks.add(k);
    refresh();
  }

  /* ================= ② 최단 경로 ================= */
  function spState() {
    if (!T.sp) T.sp = { s: null, t: null, path: [], res: null, shown: 0, mst: $('sp-mst').checked, msg: '' };
    return T.sp;
  }
  function pathEdges(nodes) {
    const out = [];
    for (let i = 0; i + 1 < nodes.length; i++) out.push(edgeIdx(nodes[i], nodes[i + 1]));
    return out;
  }
  const costOf = (edges) => edges.reduce((a, k) => a + G.edges[k].w, 0);

  function viewSP(v) {
    const S = spState();
    pathEdges(S.path).forEach((k) => { v.edge[k] = 'pick'; });
    S.path.forEach((id) => { v.node[id] = 'onpath'; });
    if (S.res && S.shown > 0) {
      const ord = S.res.order;
      const snap = ord[Math.min(S.shown, ord.length) - 1].snapshot;
      G.nodes.forEach((n, i) => {
        if (snap[i] < Infinity) { v.badge[n.id] = fmtW(snap[i]); v.badgeCls[n.id] = 'dist'; }
      });
      for (let i = 0; i < Math.min(S.shown, ord.length); i++) {
        const id = G.nodes[ord[i].node].id;
        v.node[id] = (v.node[id] || '') + ' settled';
        v.badgeCls[id] = 'dist done';
      }
      const curId = G.nodes[ord[Math.min(S.shown, ord.length) - 1].node].id;
      v.node[curId] += ' current';
      if (tSettled(S)) {
        const p = GA.dijkstraPath(S.res, G, S.t);
        if (p) p.edges.forEach((k) => { v.edge[k] = (v.edge[k] || '') + ' sp'; });
      }
    }
    if (S.mst && S.s && S.t) {
      const tp = GA.treePath(G, GA.kruskal(G).tree, S.s, S.t);
      if (tp) tp.edges.forEach((k) => { v.edge[k] = (v.edge[k] || '') + ' mstpath'; });
    }
    if (S.s) v.node[S.s] = (v.node[S.s] || '') + ' start';
    if (S.t) v.node[S.t] = (v.node[S.t] || '') + ' end';
    v.status = !S.s ? '출발할 장소를 누르세요' : !S.t ? '도착할 장소를 누르세요' : `${lab(S.s)} → ${lab(S.t)}`;
    v.statusKind = S.s && S.t ? 'active' : '';
    v.foot = '<span class="key k-start"></span>출발 <span class="key k-end"></span>도착 <span class="key k-pick"></span>내 길 <span class="key k-sp"></span>최단 경로 <span class="key k-mstpath"></span>최소 연결망 위의 길 · 점 위 숫자 = 출발지에서 지금까지 알아낸 거리';
    panelSP();
    return v;
  }

  function tSettled(S) {
    if (!S.res || !S.t) return false;
    const ti = S.res.idx.get(S.t);
    return S.res.order.slice(0, S.shown).some((o) => o.node === ti) || S.shown >= S.res.order.length;
  }

  function panelSP() {
    const S = spState();
    $('sp-ends').textContent = S.s ? `${lab(S.s)} → ${S.t ? lab(S.t) : '?'}` : '—';
    const mineEdges = pathEdges(S.path);
    const reached = S.t && S.path[S.path.length - 1] === S.t;
    $('sp-mine').textContent = S.path.length > 1 ? fmtW(costOf(mineEdges)) : '—';
    const msg = $('sp-msg');
    if (S.msg) { msg.innerHTML = S.msg; msg.className = 'status-message stuck'; }
    else if (!S.s) { msg.textContent = '출발할 장소를 누르세요.'; msg.className = 'status-message'; }
    else if (!S.t) { msg.textContent = '도착할 장소를 누르세요.'; msg.className = 'status-message'; }
    else if (reached) {
      const best = GA.dijkstraPath(GA.dijkstra(G, S.s), G, S.t);
      const mine = costOf(mineEdges);
      const same = best && Math.abs(mine - best.cost) < 1e-9;
      msg.innerHTML = same ? `<b>도착! 최단 경로예요.</b> 비용 ${fmtW(mine)}` : `도착! 내 길 비용 <b>${fmtW(mine)}</b>. 더 짧은 길이 있어요. 다익스트라로 확인해 보세요.`;
      msg.className = 'status-message ' + (same ? 'complete' : '');
    } else {
      msg.innerHTML = `${nb(S.path[S.path.length - 1])}에서 길로 이어진 장소를 차례로 눌러 <b>${esc(lab(S.t))}</b>번까지 가 보세요. 지나온 장소를 누르면 거기까지 되돌아갑니다.`;
      msg.className = 'status-message';
    }
    const ready = S.s && S.t;
    const total = S.res ? S.res.order.length : 1;
    $('sp-step').disabled = !ready || (S.res && (S.shown >= total || tSettled(S)));
    $('sp-all').disabled = $('sp-step').disabled;
    const am = $('sp-algo-msg');
    if (!S.res || !S.shown) am.textContent = ready ? '"한 단계"를 눌러 시작하세요.' : '';
    else {
      const o = S.res.order[Math.min(S.shown, S.res.order.length) - 1];
      const nm = G.nodes[o.node].id;
      if (tSettled(S)) {
        const p = GA.dijkstraPath(S.res, G, S.t);
        am.innerHTML = p
          ? `<b>${nb(S.t)} 확정!</b> 최단 거리 <b>${fmtW(p.cost)}</b>: ${p.nodes.map((id) => esc(lab(id))).join(' → ')}${p.ways > 1 ? `<br>같은 거리의 최단 경로가 <b>${p.ways}가지</b> 있어요.` : ''}`
          : `<b>${nb(S.t)}으로 가는 길이 없어요.</b> 지도가 끊겨 있습니다.`;
        am.className = 'status-message ' + (p ? 'complete' : 'stuck');
      } else {
        am.innerHTML = `아직 확정 안 된 곳 중 가장 가까운 <b>${nb(nm)}</b>(거리 ${fmtW(o.dist)})을 확정했어요.${o.relaxed.length ? ' 이웃 ' + o.relaxed.map((i) => nb(G.nodes[i].id)).join(', ') + '의 거리를 줄였어요.' : ''}`;
        am.className = 'status-message';
      }
    }
    const mm = $('sp-mst-msg');
    if (S.mst && S.s && S.t) {
      const tp = GA.treePath(G, GA.kruskal(G).tree, S.s, S.t);
      const best = GA.dijkstraPath(GA.dijkstra(G, S.s), G, S.t);
      if (tp && best) {
        mm.innerHTML = Math.abs(tp.cost - best.cost) < 1e-9
          ? `최소 연결망 위의 길도 비용 ${fmtW(tp.cost)}로 최단과 같아요. 늘 그런 건 아닙니다. "세 건물" 예시를 불러와 보세요.`
          : `최소 연결망 위의 길(초록 점선)은 비용 <b>${fmtW(tp.cost)}</b>, 최단 경로는 <b>${fmtW(best.cost)}</b>. 전체를 싸게 잇는 것과 두 곳 사이를 빨리 가는 것은 다른 문제예요.`;
      } else mm.textContent = '두 곳이 이어져 있지 않아요.';
    } else mm.textContent = '';
  }

  function spNode(id) {
    const S = spState();
    S.msg = '';
    if (!S.s) { S.s = id; S.path = [id]; }
    else if (!S.t) {
      if (id === S.s) return;
      S.t = id;
      S.res = GA.dijkstra(G, S.s);
      S.shown = 0;
    } else {
      const at = S.path.indexOf(id);
      if (at >= 0) S.path = S.path.slice(0, at + 1);
      else if (edgeIdx(S.path[S.path.length - 1], id) >= 0) S.path.push(id);
      else S.msg = `${nb(S.path[S.path.length - 1])}과 ${nb(id)} 사이에는 길이 없어요.`;
    }
    refresh();
  }

  /* ================= ③ 모든 길 한 번씩 (오일러) ================= */
  function euState() {
    if (!T.eu) T.eu = { info: GA.eulerInfo(G), start: null, cur: null, used: [], stuck: false, anim: null, msg: '' };
    return T.eu;
  }

  function viewEuler(v) {
    const S = euState();
    const info = S.info;
    G.nodes.forEach((n) => {
      v.badge[n.id] = String(info.degree[n.id]);
      v.badgeCls[n.id] = info.degree[n.id] % 2 ? 'odd' : 'even';
      if (info.degree[n.id] % 2) v.node[n.id] = 'odd';
    });
    const used = new Set(S.used);
    S.used.forEach((k, i) => { v.edge[k] = 'used' + (i === S.used.length - 1 ? ' current' : ''); });
    if (S.cur && !S.anim) {
      G.edges.forEach((e, k) => { if (!used.has(k) && (e.a === S.cur || e.b === S.cur)) v.edge[k] = 'avail'; });
    }
    if (S.start) v.node[S.start] = (v.node[S.start] || '') + ' start';
    if (S.cur) v.node[S.cur] = (v.node[S.cur] || '') + (S.stuck ? ' stuck' : ' current');
    v.status = S.stuck ? '막혔어요!' : S.used.length === G.edges.length && G.edges.length ? '모든 길을 지났어요!' : S.cur ? `지금 ${lab(S.cur)}` : '출발할 장소를 누르세요';
    v.statusKind = S.stuck ? 'stuck' : S.used.length === G.edges.length && G.edges.length ? 'complete' : S.cur ? 'active' : '';
    v.weights = false;
    v.foot = '이 문제에서는 비용을 쓰지 않아서 숫자 대신 <b>장소마다 붙은 길의 수</b>를 보여 줍니다. <span class="key k-odd"></span>홀수 장소';
    panelEuler();
    return v;
  }

  function panelEuler() {
    const S = euState();
    const info = S.info;
    const odd = info.odd.map((id) => nb(id));
    const box = $('eu-verdict');
    const V = {
      noedges: ['', '길이 없어요', '지도 그리기에서 길을 만들어 보세요.'],
      disconnected: ['no', '불가능', '길이 두 덩어리 이상으로 나뉘어 있어서, 한 번에 모든 길을 지날 수 없어요.'],
      circuit: ['yes', '가능 · 제자리로 돌아오는 한붓그리기', `길이 홀수 개인 장소가 <b>0곳</b>이라서 어디서 출발해도 모든 길을 한 번씩 지나 제자리로 돌아올 수 있어요 (오일러 회로).`],
      path: ['yes', '가능 · 한 번에 그리기 (돌아오지는 못함)', `홀수 장소가 <b>2곳</b>(${odd.join(', ')})이라서, 한쪽에서 출발해 다른 쪽에서 끝나야 해요 (오일러 경로).`],
      none: ['no', '불가능', `홀수 장소가 <b>${info.odd.length}곳</b>(${odd.slice(0, 8).join(', ')}${odd.length > 8 ? ' …' : ''})이에요. 지나가는 장소는 들어오는 길과 나가는 길을 짝으로 쓰므로, 홀수 장소는 출발점이나 도착점이어야 해요. 그런 곳은 2곳까지만 가능하니, 펜을 최소 <b>${info.strokes - 1}번</b> 떼야 해요.`],
    }[info.verdict];
    box.className = 'verdict ' + V[0];
    box.innerHTML = `<div class="v-title">${V[1]}</div><div class="v-body">${V[2]}</div>`;
    $('eu-solve').disabled = !(info.verdict === 'circuit' || info.verdict === 'path') || !!S.anim;
    $('eu-progress').textContent = `${S.used.length} / ${G.edges.length} 길`;
    $('eu-bar').style.width = G.edges.length ? (100 * S.used.length / G.edges.length).toFixed(1) + '%' : '0%';
    const msg = $('eu-msg');
    if (S.msg) { msg.innerHTML = S.msg; msg.className = 'status-message ' + (S.msgKind || 'stuck'); return; }
    msg.className = 'status-message';
    if (!S.start) {
      msg.textContent = info.verdict === 'path' ? `출발할 장소를 누르세요. 힌트: 홀수 장소(${info.odd.map((id) => nb(id)).join(', ')}) 중 하나에서 출발해야 해요.` : '출발할 장소를 누르세요.';
    } else if (S.used.length === G.edges.length) {
      msg.innerHTML = `<b>성공!</b> 모든 길을 한 번씩 지났어요${S.cur === S.start ? '. 제자리로 돌아왔습니다.' : '.'}`;
      msg.className = 'status-message complete';
    } else if (S.stuck) {
      msg.innerHTML = `<b>막혔어요.</b> ${nb(S.cur)}에서 나갈 길이 없는데 아직 ${G.edges.length - S.used.length}개 길이 남았어요. ${
        info.verdict === 'none' || info.verdict === 'disconnected' ? '이 지도는 원래 불가능해요.' : '답은 있으니 순서를 바꿔 다시 해 보세요. 남은 길이 끊어지지 않게 고르는 것이 요령입니다.'}`;
      msg.className = 'status-message stuck';
    } else {
      msg.textContent = `${nb(S.cur)}에서 나가는 길(진하게 표시)이나 이웃 장소를 누르세요.`;
    }
  }

  function euMove(k) {
    const S = euState();
    const e = G.edges[k];
    S.used.push(k);
    S.cur = e.a === S.cur ? e.b : e.a;
    const used = new Set(S.used);
    S.stuck = S.used.length < G.edges.length && !G.edges.some((x, j) => !used.has(j) && (x.a === S.cur || x.b === S.cur));
  }
  function euNode(id) {
    const S = euState();
    if (S.anim) return;
    S.msg = '';
    S.msgKind = '';
    if (!S.start) {
      if (!S.info.degree[id]) { S.msg = '길이 없는 장소예요. 다른 곳을 고르세요.'; refresh(); return; }
      S.start = S.cur = id;
      refresh();
      return;
    }
    if (S.stuck || S.used.length === G.edges.length) return;
    const used = new Set(S.used);
    const k = G.edges.findIndex((e, j) => !used.has(j) && ((e.a === S.cur && e.b === id) || (e.b === S.cur && e.a === id)));
    if (k < 0) { S.msg = `${nb(S.cur)}에서 ${nb(id)}으로 가는 남은 길이 없어요.`; refresh(); return; }
    euMove(k);
    refresh();
  }
  function euEdge(k) {
    const S = euState();
    if (S.anim || !S.cur || S.stuck) return;
    const e = G.edges[k];
    if (S.used.includes(k) || (e.a !== S.cur && e.b !== S.cur)) return;
    S.msg = '';
    euMove(k);
    refresh();
  }
  function euSolve() {
    const old = euState();
    const info = old.info;
    let start = old.start;
    let note = '';
    if (info.verdict === 'path' && !info.odd.includes(start)) {
      if (start) note = `홀수 장소에서 출발해야 해서 ${nb(info.odd[0])}에서 출발합니다. `;
      start = info.odd[0];
    }
    if (!start || !info.degree[start]) start = G.nodes.find((n) => info.degree[n.id] > 0).id;
    T.eu = { info, start, cur: start, used: [], stuck: false, anim: null, msg: '' };
    const S = T.eu;
    const res = GA.hierholzer(G, start);
    let i = 0;
    const tick = () => {
      if (T.eu !== S) return;
      if (i >= res.edges.length) {
        S.anim = null;
        S.msg = `<b>히어홀저 완료.</b> ${note}${res.nodes.map((id) => esc(lab(id))).join(' → ')}`;
        S.msgKind = 'complete';
        refresh();
        return;
      }
      S.used.push(res.edges[i]);
      S.cur = res.nodes[i + 1];
      i++;
      refresh();
      S.anim = setTimeout(tick, Math.max(90, 1600 / res.edges.length));
    };
    S.anim = setTimeout(tick, 200);
    refresh();
  }

  /* ================= ④ 모든 장소 한 번씩 (해밀턴) ================= */
  function hamState() {
    if (!T.ham) {
      T.ham = { res: null, show: null, walk: [], msg: '' };
      const S = T.ham;
      setTimeout(() => {
        if (T.ham !== S) return;
        S.res = GA.hamilton(G);
        S.mst = GA.kruskal(G);
        if (tab === 'ham') refresh();
      }, 30);
    }
    return T.ham;
  }

  function viewHam(v) {
    const S = hamState();
    if (S.show && S.res) {
      const tour = S.show === 'cycle' ? S.res.bestCycle : S.res.bestPath;
      if (tour) {
        pathEdges(tour.nodes).forEach((k) => { v.edge[k] = 'tour'; });
        tour.nodes.forEach((id, i) => { if (v.badge[id] === undefined) { v.badge[id] = String(i + 1); v.badgeCls[id] = 'order'; } });
      }
    }
    pathEdges(S.walk).forEach((k) => { v.edge[k] = 'pick'; });
    S.walk.forEach((id, i) => { v.node[id] = 'onpath'; v.badge[id] = String(i + 1); v.badgeCls[id] = 'order'; });
    if (S.walk.length) v.node[S.walk[0]] += ' start';
    if (S.walk.length) v.node[S.walk[S.walk.length - 1]] += ' current';
    v.status = S.walk.length ? `${S.walk.length} / ${G.nodes.length}곳 방문` : '모든 장소를 한 번씩';
    v.statusKind = S.walk.length === G.nodes.length && G.nodes.length ? 'complete' : S.walk.length ? 'active' : '';
    v.foot = footNotes();
    panelHam();
    return v;
  }

  function growthRows() {
    const f = (n) => { let x = 1; for (let i = 2; i <= n - 1; i++) x *= i; return x / 2; };
    return [5, 10, 13, 16, 20, 30].map((n) => `<tr><td>${n}곳</td><td>${fmtBig(f(n))}</td></tr>`).join('');
  }

  function panelHam() {
    const S = hamState();
    const box = $('ham-stats');
    const r = S.res;
    $('ham-cycle').disabled = !(r && r.bestCycle);
    $('ham-path').disabled = !(r && r.bestPath);
    if (!r) { box.innerHTML = '<p class="small">경우의 수를 세는 중…</p>'; }
    else if (r.tooBig) {
      box.innerHTML = `<p class="note brick">장소가 <b>${r.n}곳</b>이에요. 이 실험실은 <b>${GA.HAMILTON_MAX}곳</b>까지만 모든 경우를 비교합니다. 장소가 하나 늘 때마다 계산이 두 배 넘게 늘어나서, 브라우저가 감당하기 어려워져요. 이것이 바로 이 문제가 어려운 이유입니다.</p>`;
    } else if (!r.n) box.innerHTML = '<p class="small">장소가 없어요.</p>';
    else {
      box.innerHTML = `<table class="plain mono-table compact">
        <tr><td>해밀턴 경로 (출발점·방향 구분)</td><td><b>${fmtBig(r.paths)}</b></td></tr>
        <tr><td>└ 방향 무시하면</td><td>${fmtBig(r.paths / 2)}</td></tr>
        <tr><td>└ 끝에서 출발점으로 바로 돌아올 수 있는 것</td><td>${fmtBig(r.closablePaths)}</td></tr>
        <tr><td>└ 돌아올 수 없는 것</td><td>${fmtBig(r.paths - r.closablePaths)}</td></tr>
        <tr><td>한 바퀴 도는 길 (해밀턴 회로) 종류</td><td><b>${fmtBig(r.cycles)}</b></td></tr>
      </table>
      <p class="tiny">해밀턴 경로 수는 발표 PPT의 파이썬 코드와 같은 기준(모든 출발점, 양방향을 따로 셈)입니다.</p>
      ${r.paths === 0 ? '<p class="note brick">모든 장소를 한 번씩 지나는 길이 <b>없어요</b>. 답이 아예 없을 수 있다는 것도 이 문제의 특징입니다.</p>' : ''}`;
    }
    const sm = $('ham-show-msg');
    if (S.show && r) {
      const tour = S.show === 'cycle' ? r.bestCycle : r.bestPath;
      sm.innerHTML = tour ? `${S.show === 'cycle' ? '가장 짧은 한 바퀴' : '가장 짧은 경로'}: <b>${fmtW(tour.cost)}</b><br>${tour.nodes.map((id) => esc(lab(id))).join(' → ')}` : '';
    } else sm.textContent = '';

    const msg = $('ham-msg');
    if (S.msg) { msg.innerHTML = S.msg; msg.className = 'status-message stuck'; }
    else if (!S.walk.length) { msg.textContent = '출발할 장소를 누르고, 길로 이어진 장소를 차례로 누르세요. 이미 간 곳은 다시 못 갑니다.'; msg.className = 'status-message'; }
    else if (S.walk.length === G.nodes.length) {
      const c = costOf(pathEdges(S.walk));
      const back = edgeIdx(S.walk[S.walk.length - 1], S.walk[0]);
      msg.innerHTML = `<b>모든 장소를 한 번씩 돌았어요!</b> 비용 ${fmtW(c)}${back >= 0 ? `, 출발점으로 돌아가면 ${fmtW(c + G.edges[back].w)}` : '. 출발점으로 바로 돌아가는 길은 없어요.'}`;
      msg.className = 'status-message complete';
    } else {
      const last = S.walk[S.walk.length - 1];
      const can = G.edges.some((e) => (e.a === last && !S.walk.includes(e.b)) || (e.b === last && !S.walk.includes(e.a)));
      msg.innerHTML = can ? `${nb(last)}에서 아직 안 간 이웃 장소를 누르세요.` : `<b>막혔어요.</b> ${nb(last)}에서 갈 수 있는 새 장소가 없어요. 장소 하나를 누르면 거기까지 되돌아갑니다.`;
      msg.className = 'status-message ' + (can ? '' : 'stuck');
    }

    const b = $('ham-bound');
    if (r && !r.tooBig && S.mst && r.n) {
      const m = S.mst.total;
      b.innerHTML = `<h4>최소 연결망(①)으로 어림하기</h4>
        <div class="stat-grid">
          <div class="stat"><span class="k">최소 연결망</span><span class="v">${S.mst.spanning ? fmtW(m) : '—'}</span></div>
          <div class="stat"><span class="k">가장 짧은 한 바퀴</span><span class="v">${r.bestCycle ? fmtW(r.bestCycle.cost) : '없음'}</span></div>
          <div class="stat wide"><span class="k">최소 연결망 × 2 (다시 지나가도 될 때)</span><span class="v">${S.mst.spanning ? fmtW(2 * m) : '—'}</span></div>
        </div>
        <p class="tiny">한 바퀴에서 길 하나를 빼면 모든 장소를 잇는 연결망이 되므로, 한 바퀴는 최소 연결망보다 짧을 수 없어요. 반대로 같은 장소를 다시 지나가도 된다면, 최소 연결망의 모든 길을 갔다가 되돌아오는 산책(2배)으로 항상 모든 곳을 돌 수 있어요. 장소가 많아 정답을 못 구할 때 쓰는 어림 방법의 출발점입니다.</p>
        <h4 class="top-gap">장소가 모두 서로 이어져 있다면, 한 바퀴 도는 방법의 수</h4>
        <table class="plain mono-table compact">${growthRows()}</table>`;
    } else if (r && r.tooBig) {
      b.innerHTML = `<h4>장소가 모두 서로 이어져 있다면, 한 바퀴 도는 방법의 수</h4><table class="plain mono-table compact">${growthRows()}</table>`;
    } else b.innerHTML = '';
  }

  function hamNode(id) {
    const S = hamState();
    S.msg = '';
    S.show = null;
    const at = S.walk.indexOf(id);
    if (at >= 0) S.walk = S.walk.slice(0, at + 1);
    else if (!S.walk.length) S.walk = [id];
    else if (edgeIdx(S.walk[S.walk.length - 1], id) >= 0) S.walk.push(id);
    else S.msg = `${nb(S.walk[S.walk.length - 1])}과 ${nb(id)} 사이에는 길이 없어요.`;
    refresh();
  }

  /* ---------------- 입력 처리 ---------------- */
  let drag = null;
  svg.addEventListener('pointerdown', (ev) => {
    const p = svgPoint(ev);
    const nEl = ev.target.closest('[data-node]');
    const eEl = ev.target.closest('[data-edge]');
    if (nEl) {
      drag = { id: nEl.dataset.node, sx: p.x, sy: p.y, moved: false };
      if (tab === 'draw' && tool === 'make') { try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ } }
    } else drag = { edge: eEl ? +eEl.dataset.edge : null, sx: p.x, sy: p.y };
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!drag || !drag.id || tab !== 'draw' || tool !== 'make') return;
    const p = svgPoint(ev);
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 5) return;
    drag.moved = true;
    const n = nodeById(drag.id);
    if (!n) return;
    n.x = clamp(p.x, 15, W - 15);
    n.y = clamp(p.y, 15, H - 15);
    G.edges.forEach((e) => { if (e.auto && (e.a === n.id || e.b === n.id)) e.w = autoW(e); });
    refresh();
  });
  svg.addEventListener('pointerup', (ev) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.id) {
      if (d.moved) { editKey = ''; changed(); return; }
      onNode(d.id);
    } else if (d.edge !== null && d.edge !== undefined) onEdge(d.edge);
    else {
      const p = svgPoint(ev);
      if (Math.hypot(p.x - d.sx, p.y - d.sy) < 8) onEmpty(p);
    }
  });
  svg.addEventListener('pointercancel', () => { drag = null; });

  function onNode(id) {
    if (tab === 'draw') drawNode(id);
    else if (tab === 'sp') spNode(id);
    else if (tab === 'euler') euNode(id);
    else if (tab === 'ham') hamNode(id);
  }
  function onEdge(k) {
    if (tab === 'draw') drawEdge(k);
    else if (tab === 'mst') mstEdge(k);
    else if (tab === 'euler') euEdge(k);
  }
  function onEmpty(p) { if (tab === 'draw') drawEmpty(p); }

  document.addEventListener('keydown', (e) => {
    if (tab !== 'draw' || !sel) return;
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
    if (e.key === 'Escape') { sel = null; refresh(); }
  });

  /* 탭 */
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    if (T.eu && T.eu.anim) { clearTimeout(T.eu.anim); T.eu.anim = null; }
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    svg.classList.toggle('drawing', tab === 'draw');
    if (tab !== 'draw') sel = null;
    editKey = '';
    refresh();
  }));

  /* 그리기 패널 */
  $('load-preset').addEventListener('click', () => loadPreset($('preset').value));
  $('preset').addEventListener('change', () => { $('preset-about').textContent = PRESETS[$('preset').value].about || ''; });
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => {
    tool = b.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    sel = null;
    refresh();
  }));
  $('clear-all').addEventListener('click', () => { G = { nodes: [], edges: [] }; sel = null; changed(); });
  $('bg-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (bgURL) URL.revokeObjectURL(bgURL);
    bgURL = URL.createObjectURL(f);
    L.bg.innerHTML = '';
    el('image', { href: bgURL, x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'xMidYMid meet', opacity: $('bg-opacity').value / 100, class: 'bg-img' }, L.bg);
    $('bg-clear').disabled = false;
    e.target.value = '';
  });
  $('bg-opacity').addEventListener('input', (e) => { const im = L.bg.querySelector('image'); if (im) im.setAttribute('opacity', e.target.value / 100); });
  $('bg-clear').addEventListener('click', () => {
    L.bg.innerHTML = '';
    if (bgURL) URL.revokeObjectURL(bgURL);
    bgURL = null;
    $('bg-clear').disabled = true;
  });

  /* ① */
  document.querySelectorAll('[data-mst-mode]').forEach((b) => b.addEventListener('click', () => {
    T.mstMode = b.dataset.mstMode;
    const S = mstState();
    S.mode = b.dataset.mstMode;
    S.msg = '';
    refresh();
  }));
  $('mst-me-clear').addEventListener('click', () => { const S = mstState(); S.picks.clear(); S.msg = ''; refresh(); });
  $('mst-step').addEventListener('click', () => { const S = mstState(); S.step = Math.min(S.step + 1, S.k.steps.length); refresh(); });
  $('mst-all').addEventListener('click', () => { const S = mstState(); S.step = S.k.steps.length; refresh(); });
  $('mst-reset').addEventListener('click', () => { const S = mstState(); S.step = 0; refresh(); });

  /* ② */
  $('sp-reset').addEventListener('click', () => { T.sp = null; refresh(); });
  $('sp-step').addEventListener('click', () => { const S = spState(); if (!S.res) return; S.shown = Math.min(S.shown + 1, S.res.order.length); refresh(); });
  $('sp-all').addEventListener('click', () => {
    const S = spState();
    if (!S.res) return;
    const ti = S.res.idx.get(S.t);
    const at = S.res.order.findIndex((o) => o.node === ti);
    S.shown = at >= 0 ? at + 1 : S.res.order.length;
    refresh();
  });
  $('sp-mst').addEventListener('change', (e) => { spState().mst = e.target.checked; refresh(); });

  /* ③ */
  $('eu-solve').addEventListener('click', euSolve);
  $('eu-reset').addEventListener('click', () => { if (T.eu && T.eu.anim) clearTimeout(T.eu.anim); T.eu = null; refresh(); });

  /* ④ */
  $('ham-cycle').addEventListener('click', () => { const S = hamState(); S.show = S.show === 'cycle' ? null : 'cycle'; S.walk = []; refresh(); });
  $('ham-path').addEventListener('click', () => { const S = hamState(); S.show = S.show === 'path' ? null : 'path'; S.walk = []; refresh(); });
  $('ham-reset').addEventListener('click', () => { const S = hamState(); S.walk = []; S.show = null; S.msg = ''; refresh(); });

  /* 시작 */
  svg.classList.add('drawing');
  if (!restore()) { loadPreset('campus'); } else { $('preset-about').textContent = '지난번에 그리던 지도를 불러왔어요.'; refresh(); }
  if (!$('preset-about').textContent) $('preset-about').textContent = PRESETS.campus.about;
})();

/* Tela inicial nova + lista "Atrasados para embarque".
 * Carrega DEPOIS de views.js e substitui só a rota "home"; as demais telas continuam as mesmas. */
(function () {
  'use strict';
  const PV = (window.PV = window.PV || {});
  const U = PV.util;
  const V = PV.views;
  const K = V && V.kit;
  if (!K) { console.warn('home.js: faltou a linha V.kit no views.js'); return; }
  const esc = U.esc;
  const orig = V.render;
  const API = PV.config && PV.config.API_URL;

  /* ---------- Estilos desta tela ---------- */
  const st = document.createElement('style');
  st.textContent = `
.hm{display:grid;gap:16px}
.hm-hero{display:grid;grid-template-columns:1.3fr 1fr;gap:28px;align-items:center;background:var(--bar-top);color:#f2f5f9;border-radius:12px;padding:24px 28px;border-bottom:4px solid var(--accent)}
.hm-hero .l{font-size:13px;opacity:.7}
.hm-hero .big{font:700 40px/1.1 var(--font-num);font-variant-numeric:tabular-nums;margin-top:4px}
.hm-hero input{font:700 30px/1.1 var(--font-num);width:100%;background:transparent;border:0;border-bottom:2px dashed var(--accent);color:inherit;padding:2px 0}
.hm-hero input:focus{outline:none;border-bottom-style:solid}
.hm-bar{height:12px;background:rgba(255,255,255,.18);border-radius:99px;overflow:hidden;margin:14px 0 6px}
.hm-bar i{display:block;height:100%;background:var(--accent);border-radius:99px;transition:width .6s}
.hm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.hm-act{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.hm-act a{display:block;padding:20px 22px;background:var(--surface);border:1px solid var(--line);border-left:6px solid var(--info);border-radius:10px;color:inherit;text-decoration:none}
.hm-act a.late{border-left-color:var(--late)}
.hm-act a:hover{border-color:var(--ink-2)}
.hm-act .big{font:700 44px/1.1 var(--font-num)}
.hm-act .go{float:right;font-size:13px;color:var(--ink-2)}
.hm-two{display:grid;grid-template-columns:1.6fr 1fr;gap:12px}
.hm-bars{display:flex;align-items:flex-end;gap:8px;height:150px;margin-top:12px}
.hm-bars div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;text-align:center;font-size:11px;color:var(--ink-2)}
.hm-bars b{display:block;background:var(--info);opacity:.55;border-radius:5px 5px 0 0;min-height:2px}
.hm-bars .cur b{background:var(--accent);opacity:1}
.hm-dl{display:grid;gap:12px;margin:10px 0 0}.hm-dl dt{font-size:12px;color:var(--ink-2)}.hm-dl dd{margin:0;font:600 17px var(--font-num)}
@media(max-width:900px){.hm-hero,.hm-two,.hm-act{grid-template-columns:1fr}.hm-kpis{grid-template-columns:1fr 1fr}.hm-hero .big{font-size:32px}}
@media(max-width:520px){.hm-kpis{grid-template-columns:1fr}}`;
  document.head.appendChild(st);

  /* ---------- Cálculos ---------- */
  function calc(m) {
    const h = m.hoje, mes = h.getMonth(), ano = h.getFullYear();
    const doMes = m.nfs.filter((n) => n.dataPedido && n.dataPedido.getFullYear() === ano && n.dataPedido.getMonth() === mes);
    /* um valor por nota (a planilha tem uma linha por parcela) */
    const vendMes = U.sum(doMes.map((n) => { const r = n.rows.find((x) => x.valor) || n.rows[0]; return r ? r.valor : 0; }));
    const lim = m.mediaEmbarque;
    const dias = (n) => (n.dataPedido ? U.diffDays(n.dataPedido, h) : null);
    const fila = m.listas.naoEmbarcou.slice().sort((a, b) => (dias(b) || 0) - (dias(a) || 0));
    /* atrasado para embarque: dias desde a data do PEDIDO passou da média de embarque */
    const atras = lim == null ? [] : fila.filter((n) => dias(n) != null && dias(n) > lim);
    return { h, mes, ano, doMes, vendMes, lim, dias, fila, atras, parado: U.sum(fila.map((n) => n.valorTotal)) };
  }

  /* ---------- Meta compartilhada (fica no Apps Script; localStorage só como reserva) ---------- */
  const mesKey = (h) => `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
  const lerLocal = (k) => { try { return parseFloat(localStorage.getItem('pv_meta_' + k)) || 0; } catch (e) { return 0; } };
  const gravarLocal = (k, v) => { try { localStorage.setItem('pv_meta_' + k, String(v)); } catch (e) { /* ignorado */ } };
  async function lerRemoto(k) {
    if (!API) return null;
    try { const j = await (await fetch(`${API}?action=meta&mes=${k}`)).json(); return j && j.ok ? Number(j.valor) || 0 : null; } catch (e) { return null; }
  }
  async function gravarRemoto(k, v) {
    if (!API) return false;
    try {
      const j = await (await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao: 'meta_set', mes: k, valor: v }) })).json();
      return !!(j && j.ok);
    } catch (e) { return false; }
  }
  function lerReais(t) {
    let s = String(t || '').replace(/[^\d.,]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
    const v = parseFloat(s);
    return isFinite(v) && v > 0 ? v : 0;
  }

  /* ---------- Início ---------- */
  function home(root, m) {
    const c = calc(m);
    const nomeMes = U.MES_LONGO[c.mes];
    const key = mesKey(c.h);
    let meta = lerLocal(key);
    const anos = (() => {
      const s = new Set([c.ano, m.ano]);
      m.nfs.forEach((n) => { [n.dataPedido, n.dataEmbarque, n.dataEntrega].forEach((d) => d && s.add(d.getFullYear())); });
      return Array.from(s).sort((a, b) => b - a);
    })();
    const clientesVenc = U.uniq(m.vencidos.map((p) => p.cliente)).length;
    const mx = Math.max(1, ...m.embarquePorMes.map((x) => x.media || 0));
    const velho = c.fila[0];

    root.innerHTML =
      `<div class="view-head"><h1>Panorama de ${m.ano}</h1><span class="toolbar" style="margin:0"><label for="sel-ano" class="kpi-sub" style="margin-right:6px">Ano</label>` +
      `<select id="sel-ano">${anos.map((a) => `<option${a === m.ano ? ' selected' : ''}>${a}</option>`).join('')}</select></span></div>` +
      `<div class="hm">` +
      `<section class="hm-hero"><div><div class="l">Meta de ${esc(nomeMes)} (clique no valor para editar)</div>` +
      `<input id="hm-meta" type="text" inputmode="decimal" autocomplete="off" placeholder="R$ 0,00" aria-label="Meta do mês">` +
      `<div class="hm-bar"><i id="hm-fill" style="width:0"></i></div><div class="l" id="hm-pct"></div></div>` +
      `<div><div class="l">Falta para a meta</div><div class="big" id="hm-falta">—</div><div class="l" style="margin-top:6px">Pedidos de ${esc(nomeMes)}: ${esc(U.fmtBRL(c.vendMes))} em ${c.doMes.length} notas</div></div></section>` +
      `<section class="hm-kpis">` +
      `<a class="kpi-mini" href="#/vencidos"><span class="label">A receber (vencido)</span><span class="value late">${esc(U.fmtBRL(m.totalVencido))}</span><span class="kpi-sub">${m.vencidos.length} parcelas · ${clientesVenc} clientes</span></a>` +
      `<a class="kpi-mini" href="#/entrega"><span class="label">Média de entrega</span><span class="value info">${esc(U.fmtDias(m.mediaEntrega))}</span><span class="kpi-sub">${m.entreguesAno.length} entregas no ano</span></a>` +
      `<a class="kpi-mini" href="#/embarque"><span class="label">Média de embarque</span><span class="value warn">${esc(U.fmtDias(m.mediaEmbarque))}</span><span class="kpi-sub">do pedido ao embarque</span></a>` +
      `<div class="kpi-mini"><span class="label">Pedidos de ${esc(nomeMes)}</span><span class="value">${esc(U.fmtBRL(c.vendMes))}</span><span class="kpi-sub">${c.doMes.length} notas no mês</span></div>` +
      `</section>` +
      `<section class="hm-act">` +
      `<a href="#/naoembarcou"><span class="go">Ver lista</span><div class="label kpi-sub">Pedidos para embarcar</div><div class="big info">${c.fila.length}</div><div class="kpi-sub">${esc(U.fmtBRL(c.parado))} aguardando embarque</div></a>` +
      `<a class="late" href="#/embarqueatraso"><span class="go">Ver lista</span><div class="label kpi-sub">Atrasados para embarque</div><div class="big late" style="color:var(--late)">${c.atras.length}</div><div class="kpi-sub">${c.lim == null ? 'Sem média de embarque ainda' : 'Mais de ' + Math.round(c.lim) + ' dias desde o pedido'}</div></a>` +
      `</section>` +
      `<section class="hm-two"><div class="card"><div class="card-head"><h2>Média de embarque por mês</h2><span class="hint">dias, ${m.ano}</span></div>` +
      `<div class="hm-bars">${m.embarquePorMes.map((x, i) => `<div class="${i === c.mes && m.ano === c.ano ? 'cur' : ''}"><small>${x.media == null ? '' : Math.round(x.media)}</small><b style="height:${x.media ? ((x.media / mx) * 80).toFixed(0) : 0}%"></b><span>${U.MES_CURTO[i]}</span></div>`).join('')}</div></div>` +
      `<div class="card"><div class="card-head"><h2>Fila de embarque</h2></div><dl class="hm-dl">` +
      `<div><dt>Pedido mais antigo sem embarcar</dt><dd>${velho && c.dias(velho) != null ? `${c.dias(velho)} dias · ${esc((velho.cliente || '').slice(0, 26))}` : '—'}</dd></div>` +
      `<div><dt>Parte da fila em atraso</dt><dd>${c.fila.length ? Math.round((c.atras.length / c.fila.length) * 100) : 0}%</dd></div>` +
      `<div><dt>Notas entregues no ano</dt><dd>${m.entreguesAno.length}</dd></div></dl></div></section>` +
      `</div>`;

    root.querySelector('#sel-ano').addEventListener('change', (e) => document.dispatchEvent(new CustomEvent('pv:ano', { detail: +e.target.value })));

    const inp = root.querySelector('#hm-meta');
    const atualiza = () => {
      const falta = root.querySelector('#hm-falta'), pct = root.querySelector('#hm-pct'), fill = root.querySelector('#hm-fill');
      if (!falta) return; /* o usuário já saiu desta tela */
      if (document.activeElement !== inp) inp.value = meta ? U.fmtBRL(meta) : '';
      if (!meta) { falta.textContent = '—'; pct.textContent = 'Defina a meta do mês'; fill.style.width = '0'; return; }
      const p = (c.vendMes / meta) * 100;
      falta.textContent = c.vendMes >= meta ? 'Meta batida' : U.fmtBRL(meta - c.vendMes);
      pct.textContent = `${U.fmtNum(p, 1)}% da meta`;
      fill.style.width = Math.min(100, p) + '%';
    };
    inp.addEventListener('focus', () => { inp.value = meta ? String(meta).replace('.', ',') : ''; inp.select(); });
    inp.addEventListener('blur', async () => {
      const v = lerReais(inp.value);
      if (v !== meta) {
        meta = v;
        gravarLocal(key, v);
        atualiza();
        if (API && !(await gravarRemoto(key, v)) && PV.toast) PV.toast('Meta guardada só neste navegador. Atualize o Apps Script para ela valer em todos.', true);
      }
      atualiza();
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    atualiza();

    /* a meta que vale é a da planilha; se ela ainda estiver vazia, sobe a que já existe neste navegador */
    lerRemoto(key).then((r) => {
      if (r == null || document.activeElement === inp) return;
      if (r > 0) { meta = r; gravarLocal(key, r); atualiza(); }
      else if (meta > 0) gravarRemoto(key, meta);
    });
  }

  /* ---------- Lista: atrasados para embarque ---------- */
  function atrasoEmbarque(root, m) {
    const c = calc(m);
    const d = c.atras.map(c.dias);
    const T = K.T;
    root.innerHTML =
      K.head('Atrasados para embarque', c.lim == null ? 'Ainda não há média de embarque para comparar.' : `Pedidos sem embarque há mais dias, contados desde a data do pedido, do que a média de embarque (${U.fmtDias(Math.round(c.lim))}).`) +
      K.stats([
        ['Pedidos atrasados', c.atras.length],
        ['Maior tempo parado', U.fmtDias(d.length ? Math.max(...d) : null)],
        ['Tempo médio parado', U.fmtDias(d.length ? Math.round(U.avg(d)) : null)],
        ['Valor das notas', U.fmtBRL(U.sum(c.atras.map((n) => n.valorTotal)))],
      ]) + '<div id="tbl"></div>';
    K.mountTable(root.querySelector('#tbl'), {
      file: 'atrasados-embarque', rows: c.atras, sort: 'parado', dir: -1,
      columns: [
        T.nf(), T.txt('cliente', 'Cliente', (n) => n.cliente), T.txt('vend', 'Vendedor', (n) => n.vendedor),
        T.date('ped', 'Pedido', (n) => n.dataPedido), T.dias('parado', 'Dias desde o pedido', c.dias),
        T.dias('acima', 'Acima da média (dias)', (n) => (c.dias(n) == null || c.lim == null ? null : Math.round(c.dias(n) - c.lim))),
        T.chip('parc', 'Parcela do mês', K.pmChip), T.brl('valor', 'Valor', (n) => n.valorTotal, true),
      ],
    });
  }

  /* ---------- Rotas ---------- */
  V.render = function (root, model, route) {
    const nome = route[0] || 'home';
    if (nome === 'home' || nome === 'embarqueatraso') {
      try {
        (nome === 'home' ? home : atrasoEmbarque)(root, model);
        try { window.scrollTo(0, 0); root.focus({ preventScroll: true }); } catch (e) { /* ignorado */ }
        return;
      } catch (e) { console.error(e); }
    }
    return orig(root, model, route);
  };
})();

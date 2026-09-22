/* Telas: início, análises (vencidos, entrega, embarque), listas completas e resultado da busca.
 * Tudo navega por links de hash (#/vencidos, #/nf/12345...), então o botão Voltar do navegador funciona. */
(function () {
  'use strict';
  const PV = (window.PV = window.PV || {});
  const U = PV.util;
  const C = PV.charts;
  const D = PV.data;
  const V = (PV.views = {});
  const esc = U.esc;
  const go = (h) => { location.hash = h; };

  /* ---------- Etiquetas de estado ---------- */
  const PM = {
    pago: ['ok', 'Parcela paga'],
    atraso: ['late', 'Parcela em atraso'],
    aberto: ['info', 'Parcela a vencer'],
    sem: ['muted', 'Sem parcela no mês'],
  };
  const pmChip = (n) => { const p = PM[n.parcelaMes] || PM.sem; return { c: p[0], t: p[1] }; };
  const nfChip = (n) =>
    n.entregue ? { c: 'ok', t: 'Entregue' } : n.atrasado ? { c: 'late', t: 'Atrasado' } : n.embarcou ? { c: 'info', t: 'Em trânsito' } : { c: 'warn', t: 'Não embarcou' };
  const chipHtml = (x) => `<span class="chip ${x.c}">${esc(x.t)}</span>`;
  V.chips = { pmChip, nfChip, chipHtml };

  /* ---------- Peças de tela ---------- */
  const head = (title, sub, extra) =>
    `<div class="view-head"><a class="btn" href="#/">Início</a><h1>${esc(title)}</h1>${extra || ''}</div>` +
    (sub ? `<p class="kpi-sub" style="margin:-8px 0 16px">${sub}</p>` : '');

  const stats = (arr) =>
    `<div class="stats">${arr.map(([l, v]) => `<div class="stat"><div class="label">${esc(l)}</div><div class="value">${esc(String(v))}</div></div>`).join('')}</div>`;

  const mesBtn = (href, mes) =>
    mes == null ? '' : `<a class="btn" href="${href}">Mostrando ${U.MES_LONGO[mes]}. Ver o ano todo</a>`;

  const mesArg = (args) => (args[0] !== undefined && args[0] !== '' && !isNaN(+args[0]) ? +args[0] : null);

  /* colunas de tabela */
  const T = {
    nf: () => ({ key: 'nf', label: 'Nota', value: (r) => +r.nf, html: (r) => `<b class="num">${esc(r.nf)}</b>`, text: (r) => r.nf }),
    txt: (key, label, get) => ({ key, label, value: get, html: (r) => esc(get(r) || '—'), text: (r) => get(r) || '' }),
    date: (key, label, get) => ({ key, label, value: get, html: (r) => (get(r) ? U.fmtDate(get(r)) : '—'), text: (r) => (get(r) ? U.fmtDate(get(r)) : '') }),
    brl: (key, label, get, foot) => ({
      key, label, cls: 'r', value: get, html: (r) => U.fmtBRL(get(r)), text: (r) => U.fmtBRL(get(r)),
      foot: foot ? (rows) => U.fmtBRL(U.sum(rows.map(get))) : null,
    }),
    dias: (key, label, get) => {
      const f = (r) => (get(r) == null ? '' : U.fmtNum(get(r), Number.isInteger(get(r)) ? 0 : 1));
      return { key, label, cls: 'r', value: get, html: (r) => f(r) || '—', text: f };
    },
    chip: (key, label, fn) => ({ key, label, value: (r) => fn(r).t, html: (r) => chipHtml(fn(r)), text: (r) => fn(r).t }),
  };

  /* ---------- Tabela com ordenação, filtro, paginação e CSV ---------- */
  function mountTable(box, cfg) {
    const PER = 50;
    const cols = cfg.columns;
    const st = { q: cfg.q || '', sort: cfg.sort || null, dir: cfg.dir || 1, page: 0 };
    box.innerHTML =
      `<div class="toolbar"><input type="search" placeholder="Filtrar esta lista…" aria-label="Filtrar lista" value="${esc(st.q)}">` +
      `<button class="btn" type="button" data-csv>Baixar CSV</button></div>` +
      `<div class="table-wrap" data-t></div><div class="pager" data-p></div>`;
    const inp = box.querySelector('input');
    const tw = box.querySelector('[data-t]');
    const pg = box.querySelector('[data-p]');

    const vazio = (v) => v == null || v === '';
    function rowsNow() {
      let rows = cfg.rows;
      if (st.q) {
        const q = U.norm(st.q);
        rows = rows.filter((r) => cols.some((c) => U.norm(c.text(r)).includes(q)));
      }
      const c = cols.find((x) => x.key === st.sort);
      if (c) {
        rows = rows.slice().sort((x, y) => {
          const a = c.value(x);
          const b = c.value(y);
          const an = vazio(a);
          const bn = vazio(b);
          if (an || bn) return an && bn ? 0 : an ? 1 : -1;
          const r = a instanceof Date || typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
          return r * st.dir;
        });
      }
      return rows;
    }

    function draw() {
      const rows = rowsNow();
      const pages = Math.max(1, Math.ceil(rows.length / PER));
      if (st.page >= pages) st.page = pages - 1;
      if (!rows.length) {
        tw.innerHTML = '<div class="empty">Nenhuma linha encontrada.</div>';
        pg.innerHTML = '';
        return;
      }
      const slice = rows.slice(st.page * PER, st.page * PER + PER);
      const th = cols.map((c) =>
        `<th scope="col" tabindex="0" data-k="${c.key}" class="${c.cls || ''}"${st.sort === c.key ? ` aria-sort="${st.dir > 0 ? 'ascending' : 'descending'}"` : ''}>${esc(c.label)}</th>`).join('');
      const tr = slice.map((r) =>
        `<tr tabindex="0" data-nf="${esc(r.nf)}">${cols.map((c) => `<td class="${c.cls || ''}">${c.html(r)}</td>`).join('')}</tr>`).join('');
      const temFoot = cols.some((c) => c.foot);
      const foot = temFoot
        ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.cls || ''}">${i === 0 ? `Total (${rows.length})` : c.foot ? c.foot(rows) : ''}</td>`).join('')}</tr></tfoot>`
        : '';
      tw.innerHTML = `<table class="tbl"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${foot}</table>`;
      pg.innerHTML =
        `<span>${U.plural(rows.length, 'linha', 'linhas')}</span>` +
        (pages > 1
          ? `<button class="btn" type="button" data-pg="-1"${st.page === 0 ? ' disabled' : ''}>Anterior</button>` +
            `<span>Página ${st.page + 1} de ${pages}</span>` +
            `<button class="btn" type="button" data-pg="1"${st.page >= pages - 1 ? ' disabled' : ''}>Próxima</button>`
          : '');
    }

    function baixarCSV() {
      const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const linhas = [cols.map((c) => q(c.label)).join(';')].concat(rowsNow().map((r) => cols.map((c) => q(c.text(r))).join(';')));
      const blob = new Blob([`\ufeff${linhas.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${cfg.file || 'lista'}-${U.iso(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    box.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-k]');
      if (th) {
        if (st.sort === th.dataset.k) st.dir = -st.dir;
        else { st.sort = th.dataset.k; st.dir = 1; }
        st.page = 0;
        return draw();
      }
      const b = e.target.closest('[data-pg]');
      if (b) { st.page += +b.dataset.pg; return draw(); }
      if (e.target.closest('[data-csv]')) return baixarCSV();
      const tr = e.target.closest('tr[data-nf]');
      if (tr) go(`#/nf/${tr.dataset.nf}`);
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.closest('th[data-k], tr[data-nf]')) e.target.click();
    });
    inp.addEventListener('input', U.debounce(() => { st.q = inp.value; st.page = 0; draw(); }, 200));

    draw();
    return {
      setQuery(q) {
        inp.value = q;
        st.q = q;
        st.page = 0;
        draw();
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    };
  }

  /* ---------- Agrupamentos para os rankings ---------- */
  function group(rows, keyFn, valFn) {
    const g = new Map();
    rows.forEach((r) => {
      const k = keyFn(r) || '(sem nome)';
      const a = g.get(k) || { k, soma: 0, n: 0 };
      a.soma += valFn(r) || 0;
      a.n += 1;
      g.set(k, a);
    });
    return Array.from(g.values());
  }
  const rankSoma = (rows, keyFn, valFn, top = 8) =>
    group(rows, keyFn, valFn).sort((a, b) => b.soma - a.soma).slice(0, top).map((g) => ({ label: g.k, value: g.soma, key: g.k }));
  const rankMedia = (rows, keyFn, valFn, top = 8) =>
    group(rows.filter((r) => valFn(r) != null), keyFn, valFn)
      .map((g) => ({ label: g.k, value: g.soma / g.n, key: g.k }))
      .sort((a, b) => b.value - a.value)
      .slice(0, top);

  /* ---------- Modelo de tela de análise (estatísticas + ranking + tabela) ---------- */
  function analise(root, cfg) {
    root.innerHTML =
      head(cfg.title, cfg.sub, cfg.extra) +
      stats(cfg.stats) +
      `<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>${esc(cfg.rankTitle)}</h2><span class="hint">Clique numa barra para filtrar a lista</span></div>` +
      `<div class="chart" id="rank" style="max-width:520px">${C.hbars(cfg.rank)}</div></div>` +
      `<div id="tbl"></div>`;
    const tbl = mountTable(root.querySelector('#tbl'), cfg.table);
    C.bind(root.querySelector('#rank'), (k) => tbl.setQuery(k));
  }

  const dias1 = (n) => `${U.fmtNum(n, 1)} d`;
  const minmax = (a, f) => (a.length ? f(...a) : null);

  function vencidos(root, m, args) {
    const mes = mesArg(args);
    const rows = mes == null ? m.vencidos : m.vencidos.filter((p) => p.vencimento.getMonth() === mes);
    const d = rows.map((p) => p.diasAtraso);
    analise(root, {
      title: 'Vencidos a receber',
      sub: `Parcelas com vencimento em ${m.ano} que já venceram e ainda não foram pagas.`,
      extra: mesBtn('#/vencidos', mes),
      stats: [
        ['Total vencido', U.fmtBRL(U.sum(rows.map((p) => p.valor)))],
        ['Parcelas', rows.length],
        ['Notas', U.uniq(rows.map((p) => p.nf)).length],
        ['Atraso médio', U.fmtDias(d.length ? Math.round(U.avg(d)) : null)],
        ['Maior atraso', U.fmtDias(minmax(d, Math.max))],
      ],
      rankTitle: 'Maiores valores por cliente',
      rank: { items: rankSoma(rows, (p) => p.cliente, (p) => p.valor), fmt: U.fmtBRLCompact, cls: 'late', title: 'Vencidos por cliente', empty: 'Nenhuma parcela vencida.' },
      table: {
        file: 'vencidos', rows, sort: 'venc', dir: 1,
        columns: [
          T.nf(), T.txt('cliente', 'Cliente', (p) => p.cliente), T.txt('vendedor', 'Vendedor', (p) => p.vendedor),
          T.txt('parcela', 'Parcela', (p) => p.parcela), T.date('venc', 'Vencimento', (p) => p.vencimento),
          T.dias('atraso', 'Dias de atraso', (p) => p.diasAtraso), T.brl('valor', 'Valor', (p) => p.valor, true),
        ],
      },
    });
  }

  function entrega(root, m, args) {
    const mes = mesArg(args);
    const rows = m.entreguesAno.filter((n) => mes == null || n.dataEntrega.getMonth() === mes);
    const d = rows.map((n) => n.diasEntrega).filter((v) => v != null);
    const comPrev = rows.filter((n) => n.previsao);
    const noPrazo = comPrev.filter((n) => n.dataEntrega <= n.previsao).length;
    analise(root, {
      title: 'Média de entrega',
      sub: `Dias do embarque até a entrega, nas notas entregues em ${m.ano}.`,
      extra: mesBtn('#/entrega', mes),
      stats: [
        ['Média de entrega', U.fmtDias(U.avg(d))],
        ['Mediana', U.fmtDias(U.median(d))],
        ['Mais rápida', U.fmtDias(minmax(d, Math.min))],
        ['Mais demorada', U.fmtDias(minmax(d, Math.max))],
        ['Dentro da previsão', comPrev.length ? `${Math.round((noPrazo / comPrev.length) * 100)}%` : '—'],
        ['Notas entregues', rows.length],
      ],
      rankTitle: 'Prazo médio por transportadora',
      rank: { items: rankMedia(rows, (n) => n.transportadora, (n) => n.diasEntrega), fmt: dias1, title: 'Prazo de entrega por transportadora', empty: 'Sem prazos de entrega calculados.' },
      table: {
        file: 'entregas', rows, sort: 'dias', dir: -1,
        columns: [
          T.nf(), T.txt('cliente', 'Cliente', (n) => n.cliente), T.txt('transp', 'Transportadora', (n) => n.transportadora),
          T.date('emb', 'Embarque', (n) => n.dataEmbarque), T.date('ent', 'Entrega', (n) => n.dataEntrega),
          T.dias('dias', 'Prazo (dias)', (n) => n.diasEntrega), T.date('prev', 'Previsão', (n) => n.previsao),
          T.chip('parc', 'Parcela do mês', pmChip),
        ],
      },
    });
  }

  function embarque(root, m, args) {
    const mes = mesArg(args);
    const rows = m.embarcadasAno.filter((n) => mes == null || n.dataEmbarque.getMonth() === mes);
    const d = rows.map((n) => n.diasEmbarque).filter((v) => v != null);
    analise(root, {
      title: 'Média de embarque',
      sub: `Dias do pedido até o embarque, nas notas embarcadas em ${m.ano}.`,
      extra: mesBtn('#/embarque', mes),
      stats: [
        ['Média de embarque', U.fmtDias(U.avg(d))],
        ['Mediana', U.fmtDias(U.median(d))],
        ['Mais rápido', U.fmtDias(minmax(d, Math.min))],
        ['Mais demorado', U.fmtDias(minmax(d, Math.max))],
        ['Notas embarcadas', rows.length],
      ],
      rankTitle: 'Maiores prazos médios por cliente',
      rank: { items: rankMedia(rows, (n) => n.cliente, (n) => n.diasEmbarque), fmt: dias1, cls: 'warn', title: 'Prazo de embarque por cliente', empty: 'Sem prazos de embarque calculados.' },
      table: {
        file: 'embarques', rows, sort: 'dias', dir: -1,
        columns: [
          T.nf(), T.txt('cliente', 'Cliente', (n) => n.cliente), T.txt('vend', 'Vendedor', (n) => n.vendedor),
          T.date('ped', 'Pedido', (n) => n.dataPedido), T.date('emb', 'Embarque', (n) => n.dataEmbarque),
          T.dias('dias', 'Dias até embarcar', (n) => n.diasEmbarque), T.chip('sit', 'Situação', nfChip),
        ],
      },
    });
  }

  /* ---------- Listas completas (Entregues, Atrasados, Não embarcou) ---------- */
  const NFV = {
    entregues: (m) => {
      const rows = m.listas.entregues;
      return {
        title: 'Entregues', rows, sort: 'ent', dir: -1,
        sub: `Notas entregues em ${m.ano}. A etiqueta mostra a situação da parcela que vence neste mês.`,
        stats: [
          ['Notas entregues', rows.length],
          ['Parcela do mês paga', rows.filter((n) => n.parcelaMes === 'pago').length],
          ['Parcela do mês em atraso', rows.filter((n) => n.parcelaMes === 'atraso').length],
          ['Valor em aberto', U.fmtBRL(U.sum(rows.map((n) => n.valorAberto)))],
        ],
        cols: [
          T.nf(), T.txt('cliente', 'Cliente', (n) => n.cliente), T.txt('transp', 'Transportadora', (n) => n.transportadora),
          T.date('emb', 'Embarque', (n) => n.dataEmbarque), T.date('ent', 'Entrega', (n) => n.dataEntrega),
          T.dias('dias', 'Prazo (dias)', (n) => n.diasEntrega), T.chip('parc', 'Parcela do mês', pmChip),
          T.brl('aberto', 'Em aberto', (n) => n.valorAberto, true),
        ],
      };
    },
    atrasados: (m) => {
      const rows = m.listas.atrasados;
      const d = rows.map((n) => n.diasAtraso);
      return {
        title: 'Atrasados', rows, sort: 'atraso', dir: -1,
        sub: 'Notas embarcadas, ainda sem entrega, com a previsão vencida ou marcadas como atrasadas na planilha.',
        stats: [
          ['Notas atrasadas', rows.length],
          ['Maior atraso', U.fmtDias(minmax(d, Math.max))],
          ['Atraso médio', U.fmtDias(d.length ? Math.round(U.avg(d)) : null)],
          ['Valor em aberto', U.fmtBRL(U.sum(rows.map((n) => n.valorAberto)))],
        ],
        cols: [
          T.nf(), T.txt('cliente', 'Cliente', (n) => n.cliente), T.txt('transp', 'Transportadora', (n) => n.transportadora),
          T.date('emb', 'Embarque', (n) => n.dataEmbarque), T.date('prev', 'Previsão', (n) => n.previsao),
          T.dias('atraso', 'Dias de atraso', (n) => n.diasAtraso), T.chip('parc', 'Parcela do mês', pmChip),
          T.brl('aberto', 'Em aberto', (n) => n.valorAberto, true),
        ],
      };
    },
    naoembarcou: (m) => {
      const rows = m.listas.naoEmbarcou;
      const parado = (n) => (n.dataPedido ? U.diffDays(n.dataPedido, m.hoje) : null);
      const d = rows.map(parado).filter((v) => v != null);
      return {
        title: 'Não embarcou', rows, sort: 'parado', dir: -1,
        sub: 'Notas sem data de embarque preenchida.',
        stats: [
          ['Notas sem embarque', rows.length],
          ['Pedido mais antigo', U.fmtDias(minmax(d, Math.max))],
          ['Tempo médio parado', U.fmtDias(d.length ? Math.round(U.avg(d)) : null)],
          ['Valor das notas', U.fmtBRL(U.sum(rows.map((n) => n.valorTotal)))],
        ],
        cols: [
          T.nf(), T.txt('cliente', 'Cliente', (n) => n.cliente), T.txt('vend', 'Vendedor', (n) => n.vendedor),
          T.date('ped', 'Pedido', (n) => n.dataPedido), T.dias('parado', 'Dias desde o pedido', parado),
          T.chip('parc', 'Parcela do mês', pmChip), T.brl('valor', 'Valor', (n) => n.valorTotal, true),
        ],
      };
    },
  };

  const lista = (name) => (root, m) => {
    const c = NFV[name](m);
    root.innerHTML = head(c.title, c.sub) + stats(c.stats) + '<div id="tbl"></div>';
    mountTable(root.querySelector('#tbl'), { file: name, rows: c.rows, sort: c.sort, dir: c.dir, columns: c.cols });
  };

  /* ---------- Resultado da busca ---------- */
  function busca(root, m, args) {
    const termo = decodeURIComponent(args[0] || '');
    const res = D.search(m, termo);
    if (res.length === 1) { location.replace(`#/nf/${res[0].nf}`); return; }
    if (!res.length) {
      root.innerHTML = head('Busca') + `<div class="card"><div class="empty">Nenhuma nota encontrada para “${esc(termo)}”. Confira o número e tente de novo.</div></div>`;
      return;
    }
    root.innerHTML = head('Busca', `${U.plural(res.length, 'nota encontrada', 'notas encontradas')} para “${esc(termo)}”.`) + '<div id="tbl"></div>';
    mountTable(root.querySelector('#tbl'), {
      file: 'busca', rows: res, sort: 'nf', dir: 1,
      columns: [T.nf(), T.txt('cliente', 'Cliente', (n) => n.cliente), T.chip('sit', 'Situação', nfChip), T.txt('transp', 'Transportadora', (n) => n.transportadora), T.brl('aberto', 'Em aberto', (n) => n.valorAberto)],
    });
  }

  /* ---------- Início ---------- */
  function anosDisponiveis(m) {
    const s = new Set([m.hoje.getFullYear(), m.ano]);
    m.nfs.forEach((n) => {
      [n.dataPedido, n.dataEmbarque, n.dataEntrega].forEach((d) => d && s.add(d.getFullYear()));
      n.parcelas.forEach((p) => p.vencimento && s.add(p.vencimento.getFullYear()));
    });
    return Array.from(s).sort((a, b) => b - a);
  }

  function chartCard(c) {
    return (
      `<div class="card"><a class="card-link" href="${c.href}"><div class="card-head"><h2>${esc(c.title)}</h2><span class="hint">Ver detalhes</span></div>` +
      `<div class="kpi ${c.cls}">${esc(c.kpi)}</div><div class="kpi-sub">${esc(c.sub)}</div></a>` +
      `<div class="chart" data-go="${c.href}">${c.chart}</div></div>`
    );
  }

  function colunaLista(cls, title, href, list, subFn) {
    const MAX = 30;
    const item = (n) =>
      `<li><a class="item" href="#/nf/${esc(n.nf)}"><span class="item-nf">${esc(n.nf)}</span>` +
      `<span class="item-client">${esc(n.cliente || '—')}<small>${esc(subFn(n))}</small></span>${chipHtml(pmChip(n))}</a></li>`;
    return (
      `<section class="col ${cls}"><a class="col-head" href="${href}"><h2>${esc(title)}</h2><span class="count">${list.length}</span></a>` +
      (list.length
        ? `<ul class="list">${list.slice(0, MAX).map(item).join('')}</ul>` +
          (list.length > MAX ? `<a class="list-more" href="${href}">Ver todas (${list.length})</a>` : '')
        : '<div class="empty">Nenhuma nota aqui.</div>') +
      '</section>'
    );
  }

  function home(root, m) {
    const serie = (arr, campo) => arr.map((x) => ({ label: U.MES_CURTO[x.mes], value: x[campo], key: String(x.mes) }));
    const notasVenc = U.uniq(m.vencidos.map((p) => p.nf)).length;
    const short = U.fmtDateShort;

    const cards = [
      chartCard({
        href: '#/vencidos', title: 'Vencidos a receber', cls: 'late', kpi: U.fmtBRL(m.totalVencido),
        sub: m.vencidos.length ? `${U.plural(m.vencidos.length, 'parcela', 'parcelas')} em ${U.plural(notasVenc, 'nota', 'notas')}, vencidas em ${m.ano}` : `Nenhuma parcela vencida em ${m.ano}`,
        chart: C.bars({ items: serie(m.vencidoPorMes, 'soma'), fmt: (n) => U.fmtBRLCompact(n).replace('R$ ', ''), cls: 'late', title: 'Valor vencido por mês' }),
      }),
      chartCard({
        href: '#/entrega', title: 'Média de entrega', cls: 'info', kpi: U.fmtDias(m.mediaEntrega),
        sub: m.entreguesAno.length ? `${U.plural(m.entreguesAno.length, 'nota entregue', 'notas entregues')} em ${m.ano}` : `Sem entregas registradas em ${m.ano}`,
        chart: C.bars({ items: serie(m.entregaPorMes, 'media'), fmt: (n) => U.fmtNum(n, 1), ref: m.mediaEntrega, title: 'Média de entrega por mês' }),
      }),
      chartCard({
        href: '#/embarque', title: 'Média de embarque', cls: 'warn', kpi: U.fmtDias(m.mediaEmbarque),
        sub: m.embarcadasAno.length ? `${U.plural(m.embarcadasAno.length, 'nota embarcada', 'notas embarcadas')} em ${m.ano}` : `Sem embarques registrados em ${m.ano}`,
        chart: C.bars({ items: serie(m.embarquePorMes, 'media'), fmt: (n) => U.fmtNum(n, 1), cls: 'warn', ref: m.mediaEmbarque, title: 'Média de embarque por mês' }),
      }),
    ];

    const L = m.listas;
    const colunas = [
      colunaLista('ok', 'Entregues', '#/entregues', L.entregues, (n) => `Entregue em ${short(n.dataEntrega)}${n.diasEntrega != null ? `, em ${U.fmtDias(n.diasEntrega)}` : ''}`),
      colunaLista('late', 'Atrasados', '#/atrasados', L.atrasados, (n) => (n.previsao ? `Previsto para ${short(n.previsao)}, ${U.fmtDias(n.diasAtraso)} de atraso` : 'Marcado como atrasado na planilha')),
      colunaLista('warn', 'Não embarcou', '#/naoembarcou', L.naoEmbarcou, (n) => (n.dataPedido ? `Pedido em ${short(n.dataPedido)}, há ${U.fmtDias(U.diffDays(n.dataPedido, m.hoje))}` : 'Sem data de pedido')),
    ];

    root.innerHTML =
      `<div class="view-head"><h1>Panorama de ${m.ano}</h1><span class="toolbar" style="margin:0"><label for="sel-ano" class="kpi-sub" style="margin-right:6px">Ano</label>` +
      `<select id="sel-ano">${anosDisponiveis(m).map((a) => `<option${a === m.ano ? ' selected' : ''}>${a}</option>`).join('')}</select></span></div>` +
      `<div class="grid-top">${cards.join('')}</div><div class="cols">${colunas.join('')}</div>`;

    root.querySelector('#sel-ano').addEventListener('change', (e) => {
      document.dispatchEvent(new CustomEvent('pv:ano', { detail: +e.target.value }));
    });
    root.querySelectorAll('.chart[data-go]').forEach((el) => {
      C.bind(el, (key) => go(`${el.dataset.go}/${key}`));
    });
  }

  /* ---------- Entrada: o app.js chama isto a cada mudança de rota ---------- */
  const ROTAS = { home, vencidos, entrega, embarque, entregues: lista('entregues'), atrasados: lista('atrasados'), naoembarcou: lista('naoembarcou'), busca };

  V.render = (root, model, route) => {
    const nome = route[0] || 'home';
    const args = route.slice(1);
    if (nome === 'nf') {
      if (PV.detail) PV.detail.render(root, model, args[0]);
      else root.innerHTML = head('Nota') + '<div class="card"><div class="empty">A tela da nota ainda não foi carregada.</div></div>';
    } else {
      (ROTAS[nome] || home)(root, model, args);
    }
    /* cosméticos: uma falha aqui (navegador antigo, ambiente de teste) não deve apagar a tela já montada */
    try { window.scrollTo(0, 0); } catch (e) { /* ignorado */ }
    try { root.focus({ preventScroll: true }); } catch (e) { /* ignorado */ }
  };
})();

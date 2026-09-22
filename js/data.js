/* Dados: leitura da planilha (via Apps Script), cálculos do painel e modo demonstração.
 *
 * Formato que a API devolve:
 *   { ok: true, updatedAt: "2026-09-21T10:30:00", headers: ["Nº NF", ...],
 *     rows: [ { _row: 2, "Nº NF": 12345, "Cliente": "...", ... }, ... ] }
 * Cada linha da planilha é uma parcela; uma nota pode ter várias linhas.
 */
(function () {
  'use strict';
  const PV = (window.PV = window.PV || {});
  const U = PV.util;
  const D = (PV.data = {});

  /* ---------- Colunas: nomes aceitos para cada campo ----------
   * Se a sua planilha usa outro título de coluna, acrescente aqui (sem acento, sem espaço). */
  D.FIELDS = {
    nf: ['nf', 'nfe', 'nnf', 'notafiscal', 'numeronf', 'numerodanota', 'nota'],
    cliente: ['cliente', 'nomecliente', 'razaosocial', 'nome'],
    vendedor: ['vendedor', 'representante'],
    transportadora: ['transportadora', 'transp'],
    dataPedido: ['datapedido', 'dtpedido', 'datadopedido', 'dataemissao', 'emissao', 'data'],
    dataEmbarque: ['dataembarque', 'dtembarque', 'datadoembarque', 'embarque'],
    previsao: ['previsaoentrega', 'previsaodeentrega', 'dataprevista', 'previsao'],
    dataEntrega: ['dataentrega', 'dtentrega', 'datadaentrega', 'dataentregue', 'entrega'],
    situacao: ['situacao', 'status', 'statusentrega', 'situacaoentrega'],
    parcela: ['parcela', 'nparcela', 'numparcela'],
    vencimento: ['vencimento', 'datavencimento', 'dtvencimento', 'vcto'],
    valor: ['valorparcela', 'valor', 'valorpar', 'valorpedido'],
    dataPagamento: ['datapagamento', 'dtpagamento', 'datapgto', 'pagamento'],
    situacaoPagamento: ['situacaopagamento', 'statuspagamento', 'situacaoparcela', 'pago'],
    diasEmbarque: ['diasembarque', 'prazoembarque', 'diasparaembarque', 'diasproducao'],
    diasEntrega: ['diasentrega', 'prazoentrega', 'diasparaentrega', 'tempoentrega'],
  };

  const key = (s) => U.norm(s).replace(/[^a-z0-9]/g, '');

  /* descobre qual título da planilha corresponde a cada campo */
  D.mapHeaders = (headers) => {
    const map = {};
    const used = new Set();
    const keys = headers.map(key);
    const take = (f, i) => { map[f] = headers[i]; used.add(i); };
    Object.keys(D.FIELDS).forEach((f) => {
      const i = keys.findIndex((k, idx) => !used.has(idx) && D.FIELDS[f].includes(k));
      if (i >= 0) take(f, i);
    });
    Object.keys(D.FIELDS).forEach((f) => {
      if (map[f]) return;
      const i = keys.findIndex((k, idx) => !used.has(idx) && D.FIELDS[f].some((a) => a.length >= 7 && k.includes(a)));
      if (i >= 0) take(f, i);
    });
    return map;
  };

  /* ---------- Leitura e gravação ---------- */
  D.token = () => sessionStorage.getItem('pv_token') || '';
  D.setToken = (t) => sessionStorage.setItem('pv_token', t);

  D.load = async () => {
    const url = PV.config.API_URL;
    if (!url) return demoPayload();
    const res = await fetch(`${url}?action=list&token=${encodeURIComponent(D.token())}`);
    if (!res.ok) throw new Error(`Não foi possível ler a planilha (erro ${res.status}).`);
    const j = await res.json();
    if (!j.ok) {
      const e = new Error(j.error || 'A API recusou o pedido.');
      e.code = j.code;
      throw e;
    }
    return j;
  };

  /* changes: { "Título da coluna": novoValor }. `nf` confere se a linha ainda é a mesma nota. */
  D.save = async (row, nf, changes) => {
    const url = PV.config.API_URL;
    if (!url) return { ok: true, demo: true };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'update', token: D.token(), row, nf, changes }),
    });
    if (!res.ok) throw new Error(`Não foi possível salvar (erro ${res.status}).`);
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'A planilha não aceitou a alteração.');
    return j;
  };

  /* ---------- Normalização ---------- */
  function toRecord(raw, map) {
    const g = (f) => (map[f] ? raw[map[f]] : undefined);
    const txt = (f) => (g(f) == null ? '' : String(g(f)).trim());
    const dataPag = U.parseDate(g('dataPagamento'));
    const pagoTxt = U.norm(g('situacaoPagamento'));
    return {
      row: raw._row,
      nf: U.normNF(g('nf')),
      cliente: txt('cliente'),
      vendedor: txt('vendedor'),
      transportadora: txt('transportadora'),
      situacao: txt('situacao'),
      dataPedido: U.parseDate(g('dataPedido')),
      dataEmbarque: U.parseDate(g('dataEmbarque')),
      previsao: U.parseDate(g('previsao')),
      dataEntrega: U.parseDate(g('dataEntrega')),
      parcela: txt('parcela'),
      vencimento: U.parseDate(g('vencimento')),
      valor: U.parseNumber(g('valor')) || 0,
      dataPagamento: dataPag,
      pago: !!dataPag || /^(pag|quit|liquid|receb)/.test(pagoTxt),
      diasEmbarqueP: U.parseNumber(g('diasEmbarque')),
      diasEntregaP: U.parseNumber(g('diasEntrega')),
      raw,
    };
  }

  const NF_FIELDS = ['cliente', 'vendedor', 'transportadora', 'situacao', 'dataPedido', 'dataEmbarque', 'previsao', 'dataEntrega', 'diasEmbarqueP', 'diasEntregaP'];
  const empty = (v) => v == null || v === '';

  function groupByNF(records) {
    const map = new Map();
    records.forEach((r) => {
      if (!r.nf) return;
      let n = map.get(r.nf);
      if (!n) {
        n = { nf: r.nf, parcelas: [], rows: [] };
        NF_FIELDS.forEach((f) => (n[f] = null));
        map.set(r.nf, n);
      }
      NF_FIELDS.forEach((f) => { if (empty(n[f]) && !empty(r[f])) n[f] = r[f]; });
      n.rows.push(r);
      if (r.vencimento || r.valor) n.parcelas.push(r);
    });
    return Array.from(map.values());
  }

  D.parcelaStatus = (p, hoje) => (p.pago ? 'paga' : p.vencimento && p.vencimento < hoje ? 'vencida' : 'a_vencer');

  function enrich(n, hoje) {
    n.entregue = !!n.dataEntrega;
    n.embarcou = !!n.dataEmbarque;
    n.diasEmbarque = n.diasEmbarqueP != null ? n.diasEmbarqueP : n.dataPedido && n.dataEmbarque ? U.diffDays(n.dataPedido, n.dataEmbarque) : null;
    n.diasEntrega = n.diasEntregaP != null ? n.diasEntregaP : n.dataEmbarque && n.dataEntrega ? U.diffDays(n.dataEmbarque, n.dataEntrega) : null;
    n.atrasado = !n.entregue && n.embarcou && ((!!n.previsao && n.previsao < hoje) || /atras/.test(U.norm(n.situacao)));
    n.diasAtraso = n.atrasado && n.previsao ? Math.max(0, U.diffDays(n.previsao, hoje)) : 0;

    const doMes = n.parcelas.filter((p) => p.vencimento && p.vencimento.getFullYear() === hoje.getFullYear() && p.vencimento.getMonth() === hoje.getMonth());
    n.parcelaMes = !doMes.length ? 'sem' : doMes.some((p) => D.parcelaStatus(p, hoje) === 'vencida') ? 'atraso' : doMes.every((p) => p.pago) ? 'pago' : 'aberto';
    n.valorTotal = U.sum(n.parcelas.map((p) => p.valor));
    n.valorAberto = U.sum(n.parcelas.filter((p) => !p.pago).map((p) => p.valor));
    return n;
  }

  /* média por mês (jan..dez) de um valor numérico */
  function porMes(itens, dataDe, valorDe, ano) {
    const meses = Array.from({ length: 12 }, (_, m) => ({ mes: m, soma: 0, n: 0 }));
    itens.forEach((it) => {
      const d = dataDe(it);
      const v = valorDe(it);
      if (!d || v == null || d.getFullYear() !== ano) return;
      meses[d.getMonth()].soma += v;
      meses[d.getMonth()].n += 1;
    });
    return meses.map((m) => ({ mes: m.mes, n: m.n, soma: m.soma, media: m.n ? m.soma / m.n : null }));
  }

  /* ---------- Cálculo do painel ---------- */
  D.build = (payload, hoje, ano) => {
    hoje = U.startOfDay(hoje || new Date());
    ano = ano || hoje.getFullYear();
    const headers = payload.headers || (payload.rows[0] ? Object.keys(payload.rows[0]).filter((h) => h !== '_row') : []);
    const map = D.mapHeaders(headers);
    const records = payload.rows.map((r) => toRecord(r, map));
    const nfs = groupByNF(records).map((n) => enrich(n, hoje));

    const parcelasAno = [];
    nfs.forEach((n) => n.parcelas.forEach((p) => {
      if (p.vencimento && p.vencimento.getFullYear() === ano) {
        parcelasAno.push({ nf: n.nf, cliente: n.cliente, vendedor: n.vendedor, parcela: p.parcela, vencimento: p.vencimento, valor: p.valor, pago: p.pago, dataPagamento: p.dataPagamento, status: D.parcelaStatus(p, hoje), diasAtraso: !p.pago && p.vencimento < hoje ? U.diffDays(p.vencimento, hoje) : 0, row: p.row });
      }
    }));
    const vencidos = parcelasAno.filter((p) => p.status === 'vencida').sort((a, b) => a.vencimento - b.vencimento);

    const entreguesAno = nfs.filter((n) => n.entregue && n.dataEntrega.getFullYear() === ano);
    const embarcadasAno = nfs.filter((n) => n.embarcou && n.dataEmbarque.getFullYear() === ano);
    const dEnt = entreguesAno.map((n) => n.diasEntrega).filter((v) => v != null);
    const dEmb = embarcadasAno.map((n) => n.diasEmbarque).filter((v) => v != null);

    return {
      hoje, ano, headers, map, records, nfs,
      byNF: new Map(nfs.map((n) => [n.nf, n])),
      parcelasAno, vencidos,
      totalVencido: U.sum(vencidos.map((p) => p.valor)),
      vencidoPorMes: porMes(vencidos, (p) => p.vencimento, (p) => p.valor, ano),
      entreguesAno, embarcadasAno,
      mediaEntrega: U.avg(dEnt),
      mediaEmbarque: U.avg(dEmb),
      entregaPorMes: porMes(entreguesAno, (n) => n.dataEntrega, (n) => n.diasEntrega, ano),
      embarquePorMes: porMes(embarcadasAno, (n) => n.dataEmbarque, (n) => n.diasEmbarque, ano),
      listas: {
        entregues: entreguesAno.slice().sort((a, b) => b.dataEntrega - a.dataEntrega),
        atrasados: nfs.filter((n) => n.atrasado).sort((a, b) => (a.previsao || 0) - (b.previsao || 0)),
        naoEmbarcou: nfs.filter((n) => !n.embarcou && !n.entregue).sort((a, b) => (a.dataPedido || 0) - (b.dataPedido || 0)),
      },
    };
  };

  /* busca por número da nota: exata primeiro, depois as que começam ou contêm o número */
  D.search = (model, term) => {
    const t = U.normNF(term);
    if (!t) return [];
    const exata = model.byNF.get(t);
    if (exata) return [exata];
    return model.nfs.filter((n) => n.nf.startsWith(t)).concat(model.nfs.filter((n) => !n.nf.startsWith(t) && n.nf.includes(t))).slice(0, 50);
  };

  /* ---------- Dados de demonstração (usados quando API_URL está vazia) ---------- */
  function demoPayload() {
    let s = 20260921;
    const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const hoje = U.startOfDay(new Date());
    const ini = new Date(hoje.getFullYear(), 0, 1);
    const decorrido = Math.max(30, U.diffDays(ini, hoje));
    const clientes = ['Metalúrgica Serra Azul', 'Agro Vale do Sol', 'Transportes Rota Sul', 'Cerâmica Bom Jardim', 'Frigorífico Planalto', 'Madeireira Três Pinheiros', 'Cooperativa Campo Verde', 'Indústria Alfa Norte', 'Distribuidora Ponte Nova', 'Usina Santa Clara', 'Construtora Horizonte', 'Laticínios Monte Claro'];
    const vendedores = ['Carlos', 'Marina', 'Rafael', 'Juliana'];
    const transp = ['Rodonaves', 'Braspress', 'Jamef', 'Atlas'];
    const headers = ['Nº NF', 'Cliente', 'Vendedor', 'Transportadora', 'Data Pedido', 'Data Embarque', 'Previsão Entrega', 'Data Entrega', 'Parcela', 'Vencimento', 'Valor', 'Data Pagamento'];
    const rows = [];
    let linha = 2;
    for (let i = 0; i < 52; i++) {
      const nf = 41000 + i * 7 + ri(0, 5);
      const pedido = add(ini, ri(0, decorrido - 3));
      const embarque = rnd() < 0.85 ? add(pedido, ri(5, 25)) : null;
      const emb = embarque && embarque <= hoje ? embarque : null;
      const previsao = emb ? add(emb, ri(5, 15)) : null;
      const entrega = emb && previsao && rnd() < 0.72 ? add(emb, ri(4, 18)) : null;
      const ent = entrega && entrega <= hoje ? entrega : null;
      const np = ri(1, 3);
      const total = ri(8, 90) * 1000 + ri(0, 99) * 10;
      for (let k = 1; k <= np; k++) {
        const venc = add(emb || pedido, 30 * k);
        const pago = venc < hoje && rnd() < 0.7;
        rows.push({
          _row: linha++, 'Nº NF': nf, Cliente: clientes[i % clientes.length], Vendedor: vendedores[i % 4], Transportadora: transp[i % 4],
          'Data Pedido': U.iso(pedido), 'Data Embarque': emb ? U.iso(emb) : '', 'Previsão Entrega': previsao ? U.iso(previsao) : '',
          'Data Entrega': ent ? U.iso(ent) : '', Parcela: `${k}/${np}`, Vencimento: U.iso(venc), Valor: Math.round((total / np) * 100) / 100,
          'Data Pagamento': pago ? U.iso(add(venc, ri(-2, 6))) : '',
        });
      }
    }
    return { ok: true, demo: true, updatedAt: new Date().toISOString(), headers, rows };
  }
})();

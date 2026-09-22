/* Ficha da nota: dados do pedido, parcelas, edição de campos e gravação na planilha.
 * Campos do pedido (mesmos em todas as parcelas da nota) e campos da parcela são salvos
 * separadamente, porque cada parcela é uma linha diferente na planilha. */
(function () {
  'use strict';
  const PV = (window.PV = window.PV || {});
  const U = PV.util;
  const D = PV.data;
  const Vw = PV.views;
  const esc = U.esc;

  /* aviso simples no rodapé da tela; index.html tem a área #toast-area */
  PV.toast = (msg, isErr) => {
    const area = document.getElementById('toast-area');
    if (!area) return;
    const el = document.createElement('div');
    el.className = `toast${isErr ? ' err' : ''}`;
    el.textContent = msg;
    area.appendChild(el);
    setTimeout(() => el.remove(), isErr ? 5000 : 2600);
  };

  const LABEL = {
    cliente: 'Cliente', vendedor: 'Vendedor', transportadora: 'Transportadora', situacao: 'Situação',
    dataPedido: 'Data do pedido', dataEmbarque: 'Data de embarque', previsao: 'Previsão de entrega', dataEntrega: 'Data de entrega',
    parcela: 'Parcela', vencimento: 'Vencimento', valor: 'Valor', dataPagamento: 'Data de pagamento',
  };
  const TYPE = { dataPedido: 'date', dataEmbarque: 'date', previsao: 'date', dataEntrega: 'date', vencimento: 'date', dataPagamento: 'date', valor: 'money' };
  const ORDER_FIELDS = ['cliente', 'vendedor', 'transportadora', 'situacao', 'dataPedido', 'dataEmbarque', 'previsao', 'dataEntrega'];
  const PARC_FIELDS = ['parcela', 'vencimento', 'valor', 'dataPagamento'];

  function fieldHtml(key, value, idx) {
    const type = TYPE[key] || 'text';
    const id = `f_${idx != null ? `${idx}_` : ''}${key}`;
    const val = type === 'date' ? U.iso(value) : value == null ? '' : String(value);
    const inputType = type === 'date' ? 'date' : type === 'money' ? 'number' : 'text';
    return (
      `<div class="field" data-field="${key}" data-orig="${esc(val)}">` +
      `<label for="${id}">${esc(LABEL[key] || key)}</label>` +
      `<input id="${id}" type="${inputType}"${type === 'money' ? ' step="0.01"' : ''} value="${esc(val)}"></div>`
    );
  }
  const fieldsHtml = (map, keys, record, idx) => keys.filter((k) => map[k]).map((k) => fieldHtml(k, record[k], idx)).join('');

  const statusChip = (st) => (st === 'paga' ? { c: 'ok', t: 'Paga' } : st === 'vencida' ? { c: 'late', t: 'Vencida' } : { c: 'info', t: 'A vencer' });

  function collectChanges(group, map) {
    const changes = {};
    let any = false;
    group.querySelectorAll('.field').forEach((f) => {
      const input = f.querySelector('input');
      if (input.value === f.dataset.orig) return;
      const header = map[f.dataset.field];
      if (!header) return;
      any = true;
      changes[header] = TYPE[f.dataset.field] === 'money' ? U.parseNumber(input.value) : input.value;
    });
    return any ? changes : null;
  }

  async function saveGroup(group, rows, nf, map, labelPadrao) {
    const changes = collectChanges(group, map);
    if (!changes) { PV.toast('Nenhum campo foi alterado.'); return; }
    const btn = group.querySelector('.form-actions .btn');
    const original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
    try {
      for (const row of rows) await D.save(row, nf, changes);
      PV.toast('Alterações salvas na planilha.');
      group.querySelectorAll('.field').forEach((f) => {
        f.classList.remove('changed');
        f.dataset.orig = f.querySelector('input').value;
      });
      document.dispatchEvent(new CustomEvent('pv:saved', { detail: { nf } }));
    } catch (e) {
      PV.toast(e.message || 'Não foi possível salvar.', true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = original || labelPadrao; }
    }
  }

  PV.detail = {};
  PV.detail.render = (root, model, nfRaw) => {
    const nf = U.normNF(nfRaw);
    const n = model.byNF.get(nf);
    if (!n) {
      root.innerHTML =
        `<div class="view-head"><a class="btn" href="#/">Início</a><h1>Nota ${esc(nfRaw ?? '')}</h1></div>` +
        '<div class="card"><div class="empty">Nota não encontrada. Confira o número na lupa do topo.</div></div>';
      return;
    }
    const map = model.map;
    const chip = Vw.chips.nfChip(n);

    const passos = [
      { label: 'Pedido', date: n.dataPedido },
      { label: 'Embarque', date: n.dataEmbarque },
      { label: n.dataEntrega ? 'Entrega' : 'Previsão de entrega', date: n.dataEntrega || n.previsao },
    ];
    const timeline = `<div class="timeline">${passos.map((s) => `<div class="step${s.date ? ' done' : ''}"><b>${s.date ? U.fmtDate(s.date) : '—'}</b>${esc(s.label)}</div>`).join('')}</div>`;

    const parcelasHtml = n.parcelas.length
      ? n.parcelas
          .map((p, idx) => {
            const chipP = Vw.chips.chipHtml(statusChip(D.parcelaStatus(p, model.hoje)));
            return (
              `<div class="form-group" data-row="${p.row}"><h3>Parcela ${esc(p.parcela || idx + 1)} ${chipP}</h3>` +
              `<div class="form-grid">${fieldsHtml(map, PARC_FIELDS, p, idx)}</div>` +
              `<div class="form-actions"><button class="btn primary" type="button" data-save="row">Salvar parcela</button></div></div>`
            );
          })
          .join('')
      : '<div class="empty">Nenhuma parcela cadastrada para esta nota.</div>';

    root.innerHTML =
      `<div class="view-head"><a class="btn" href="#/">Início</a><h1>Nota ${esc(n.nf)}</h1>${Vw.chips.chipHtml(chip)}</div>` +
      `<p class="kpi-sub" style="margin-top:-8px">${esc(n.cliente || 'Cliente não identificado')}${n.valorTotal ? ` · ${U.fmtBRL(n.valorTotal)}` : ''}</p>` +
      timeline +
      `<div class="form-group" data-order="1"><h3>Dados do pedido</h3><div class="form-grid">${fieldsHtml(map, ORDER_FIELDS, n, null)}</div>` +
      `<div class="form-actions"><button class="btn primary" type="button" data-save="order">Salvar dados do pedido</button></div></div>` +
      `<div class="section-title">Parcelas</div>${parcelasHtml}`;

    root.querySelectorAll('.field').forEach((f) => {
      const input = f.querySelector('input');
      input.addEventListener('input', () => f.classList.toggle('changed', input.value !== f.dataset.orig));
    });

    const btnOrder = root.querySelector('[data-save="order"]');
    if (btnOrder) btnOrder.addEventListener('click', () => saveGroup(btnOrder.closest('.form-group'), n.rows.map((r) => r.row), n.nf, map, 'Salvar dados do pedido'));

    root.querySelectorAll('[data-save="row"]').forEach((btn) => {
      const group = btn.closest('.form-group');
      btn.addEventListener('click', () => saveGroup(group, [+group.dataset.row], n.nf, map, 'Salvar parcela'));
    });
  };
})();

/* Gráficos em SVG, sem bibliotecas. Cada barra clicável carrega um data-key;
 * use PV.charts.bind(elemento, (key) => ...) para reagir ao clique ou ao Enter/Espaço. */
(function () {
  'use strict';
  const PV = (window.PV = window.PV || {});
  const U = PV.util;
  const C = (PV.charts = {});

  const vazio = (msg) => `<div class="empty">${U.esc(msg || 'Sem dados neste ano.')}</div>`;

  /* Barras verticais, uma por item (ex.: 12 meses).
   * opt = { items: [{ label, value, key }], fmt: (n) => texto, cls: 'late'|'warn'|'ok'|'',
   *         ref: número opcional (linha tracejada, ex.: a média), height, title } */
  C.bars = (opt) => {
    const items = opt.items || [];
    const max = Math.max(0, ...items.map((i) => i.value || 0));
    if (!max) return vazio(opt.empty);

    const W = 360, H = opt.height || 170, top = 18, bottom = 22, left = 6, right = 6;
    const plotH = H - top - bottom;
    const slot = (W - left - right) / items.length;
    const bw = Math.min(28, slot * 0.62);
    const fmt = opt.fmt || String;
    const baseY = top + plotH;

    let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.esc(opt.title || 'Gráfico de barras')}">`;
    out += `<line class="axis" x1="${left}" x2="${W - right}" y1="${baseY}" y2="${baseY}"/>`;

    items.forEach((it, idx) => {
      const v = it.value || 0;
      const x0 = left + slot * idx;
      const x = x0 + (slot - bw) / 2;
      const h = v ? Math.max(2, (v / max) * plotH) : 0;
      const y = baseY - h;
      const clicavel = v > 0 && it.key != null;
      const texto = fmt(v);
      const mostra = v > 0 && (texto.length * 5.6 <= slot || v === max);
      const attrs = clicavel
        ? ` class="bar-g" data-key="${U.esc(it.key)}" tabindex="0" role="button" aria-label="${U.esc(`${it.label}: ${texto}`)}"`
        : '';
      out += `<g${attrs}>`;
      if (clicavel) out += `<rect class="hit" x="${x0.toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" fill="transparent"/>`;
      if (v) out += `<rect class="bar ${opt.cls || ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${U.esc(`${it.label}: ${texto}`)}</title></rect>`;
      if (mostra) out += `<text class="val" x="${(x0 + slot / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${U.esc(texto)}</text>`;
      out += `<text x="${(x0 + slot / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${U.esc(it.label)}</text>`;
      out += `</g>`;
    });

    if (opt.ref != null && opt.ref > 0 && opt.ref <= max) {
      const ry = baseY - (opt.ref / max) * plotH;
      out += `<line x1="${left}" x2="${W - right}" y1="${ry.toFixed(1)}" y2="${ry.toFixed(1)}" stroke-dasharray="4 3" style="stroke:var(--ink-2);stroke-width:1"><title>Média: ${U.esc(fmt(opt.ref))}</title></line>`;
    }
    return out + '</svg>';
  };

  /* Barras horizontais em ranking (ex.: por cliente ou transportadora).
   * opt = { items: [{ label, value, key }], fmt, cls, title } */
  C.hbars = (opt) => {
    const items = (opt.items || []).filter((i) => i.value > 0);
    if (!items.length) return vazio(opt.empty);

    const W = 360, row = 28, labelW = 124, valW = 74;
    const H = items.length * row + 4;
    const max = Math.max(...items.map((i) => i.value));
    const fmt = opt.fmt || String;
    const areaW = W - labelW - valW;

    let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.esc(opt.title || 'Ranking')}">`;
    items.forEach((it, idx) => {
      const y = idx * row + 4;
      const bw = Math.max(2, (it.value / max) * areaW);
      const texto = fmt(it.value);
      const nome = it.label.length > 20 ? `${it.label.slice(0, 19)}…` : it.label;
      const attrs = it.key != null
        ? ` class="bar-g" data-key="${U.esc(it.key)}" tabindex="0" role="button" aria-label="${U.esc(`${it.label}: ${texto}`)}"`
        : '';
      out += `<g${attrs}>`;
      out += `<rect class="hit" x="0" y="${y - 2}" width="${W}" height="${row}" fill="transparent"/>`;
      out += `<text x="0" y="${y + 15}"><title>${U.esc(it.label)}</title>${U.esc(nome)}</text>`;
      out += `<rect class="bar ${opt.cls || ''}" x="${labelW}" y="${y + 3}" width="${bw.toFixed(1)}" height="16" rx="2"/>`;
      out += `<text class="val" x="${(labelW + bw + 6).toFixed(1)}" y="${y + 15}">${U.esc(texto)}</text>`;
      out += `</g>`;
    });
    return out + '</svg>';
  };

  /* Liga clique e teclado (Enter/Espaço) nas barras de um contêiner. */
  C.bind = (root, onPick) => {
    const pick = (e) => {
      const g = e.target.closest('[data-key]');
      if (g && root.contains(g)) onPick(g.getAttribute('data-key'), g);
    };
    root.addEventListener('click', pick);
    root.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-key]')) {
        e.preventDefault();
        pick(e);
      }
    });
  };
})();

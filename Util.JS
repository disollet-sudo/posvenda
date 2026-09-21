/* Utilitários: texto, datas, números e formatação (pt-BR). */
(function () {
  'use strict';
  const PV = (window.PV = window.PV || {});
  const U = (PV.util = {});

  U.MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  U.MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const pad = (n) => String(n).padStart(2, '0');
  U.pad = pad;

  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* minúsculas, sem acento, espaços colapsados */
  U.norm = (s) =>
    String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  /* 12345, "12345.0", "12.345" e "12345" viram a mesma nota */
  U.normNF = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return String(Math.round(v));
    return String(v).trim().replace(/[.,]0+$/, '').replace(/\D/g, '');
  };

  function mk(y, m, d) {
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
  }

  /* aceita Date, aaaa-mm-dd e dd/mm/aaaa; devolve Date à meia-noite local */
  U.parseDate = (v) => {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return mk(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      let y = +m[3];
      if (y < 100) y += 2000;
      return mk(y, +m[2], +m[1]);
    }
    return null;
  };

  U.iso = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
  U.fmtDate = (d) => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '');
  U.fmtDateShort = (d) => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : '');
  U.monthKey = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : '');
  U.monthLabel = (key) => {
    const [y, m] = key.split('-');
    return `${U.MES_CURTO[+m - 1]}/${y.slice(2)}`;
  };
  U.diffDays = (a, b) => Math.round((b - a) / 86400000);
  U.startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  /* "4.040,25", "4040,25" e 4040.25 */
  U.parseNumber = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    let s = String(v).replace(/[R$\s]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  U.fmtBRL = (n) => brl.format(n || 0);
  U.fmtBRLCompact = (n) => {
    const a = Math.abs(n || 0);
    const dec = (x) => x.toFixed(1).replace('.', ',').replace(/,0$/, '');
    if (a >= 1e6) return `R$ ${dec(n / 1e6)} mi`;
    if (a >= 1e5) return `R$ ${Math.round(n / 1e3)} mil`;
    if (a >= 1e3) return `R$ ${dec(n / 1e3)} mil`;
    return `R$ ${Math.round(n || 0)}`;
  };
  U.fmtNum = (n, d = 1) =>
    n == null || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  U.fmtDias = (n) => (n == null || isNaN(n) ? '—' : `${U.fmtNum(n, Number.isInteger(n) ? 0 : 1)} ${n === 1 ? 'dia' : 'dias'}`);
  U.plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  U.sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
  U.avg = (a) => (a.length ? U.sum(a) / a.length : null);
  U.median = (a) => {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  U.uniq = (a) => Array.from(new Set(a));
  U.debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };
})();

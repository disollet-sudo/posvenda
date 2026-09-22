/* App: carrega os dados, cuida da navegação (rotas por #hash), da busca, do botão de
 * atualizar, do tema claro/escuro e da tela de login quando a API pede token. */
(function () {
  'use strict';
  const PV = (window.PV = window.PV || {});
  const U = PV.util;
  const D = PV.data;

  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const els = {
    updated: $('updated'),
    searchForm: $('search-form'),
    searchInput: $('search-input'),
    searchBtn: $('search-btn'),
    btnRefresh: $('btn-refresh'),
    btnTheme: $('btn-theme'),
    btnHome: $('btn-home'),
  };

  const state = { model: null, payload: null, ano: null, timer: null };

  /* ---------- Rota atual: "#/vencidos/3" -> ['vencidos','3']; vazio -> ['home'] ---------- */
  function rotaAtual() {
    const h = location.hash.replace(/^#\/?/, '');
    return h ? h.split('/').map(decodeURIComponent) : ['home'];
  }

  function renderRota() {
    if (!state.model) return;
    try {
      PV.views.render(app, state.model, rotaAtual());
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="card"><div class="empty">Não foi possível montar esta tela. ${U.esc(e.message || '')}</div></div>`;
    }
  }

  function marcaAtualizado(payload) {
    const d = payload && payload.updatedAt ? new Date(payload.updatedAt) : new Date();
    const hh = `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
    els.updated.textContent = payload && payload.demo ? `Demonstração · ${hh}` : `Atualizado às ${hh}`;
  }

  /* ---------- Login (quando a API pede token) ---------- */
  function precisaLogin(err) {
    return err && (err.code === 'auth' || err.code === 'token' || /token|senha|login|autoriza/i.test(err.message || ''));
  }

  function renderLogin(msg) {
    app.innerHTML =
      '<div class="login card"><h1 style="margin-bottom:6px">Entrar</h1>' +
      `<p class="kpi-sub">${U.esc(msg || 'Informe a senha de acesso ao painel.')}</p>` +
      '<form id="login-form"><div class="field"><label for="login-token">Senha</label>' +
      '<input id="login-token" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn primary" type="submit" style="width:100%">Entrar</button></form></div>';
    app.querySelector('#login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      D.setToken(app.querySelector('#login-token').value.trim());
      carregar(true);
    });
  }

  /* ---------- Carregar dados e montar o modelo ---------- */
  async function carregar(mostrarCarregando) {
    if (mostrarCarregando) app.innerHTML = '<div class="loading">Carregando painel…</div>';
    try {
      const payload = await D.load();
      const hoje = new Date();
      state.payload = payload;
      state.model = D.build(payload, hoje, state.ano || hoje.getFullYear());
      state.ano = state.model.ano;
      marcaAtualizado(payload);
      renderRota();
    } catch (e) {
      console.error(e);
      if (precisaLogin(e)) return renderLogin(e.message);
      app.innerHTML =
        `<div class="card"><div class="empty">${U.esc(e.message || 'Não foi possível carregar os dados.')}</div>` +
        '<p style="text-align:center"><button class="btn primary" id="btn-tentar" type="button">Tentar de novo</button></p></div>';
      const b = $('btn-tentar');
      if (b) b.addEventListener('click', () => carregar(true));
    }
  }

  /* recarrega os dados sem apagar a tela, mantendo a rota atual */
  async function atualizarSilencioso() {
    try {
      const payload = await D.load();
      state.payload = payload;
      state.model = D.build(payload, new Date(), state.ano);
      marcaAtualizado(payload);
      renderRota();
    } catch (e) {
      PV.toast && PV.toast(e.message || 'Não foi possível atualizar.', true);
    }
  }

  function agendarAutoAtualizacao() {
    if (state.timer) clearInterval(state.timer);
    const min = (PV.config && PV.config.REFRESH_MINUTES) || 0;
    if (min > 0) state.timer = setInterval(atualizarSilencioso, min * 60000);
  }

  /* ---------- Tema ---------- */
  function initTheme() {
    const salvo = localStorage.getItem('pv_theme');
    if (salvo) document.documentElement.setAttribute('data-theme', salvo);
    els.btnTheme.addEventListener('click', () => {
      const atual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const novo = atual === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', novo);
      localStorage.setItem('pv_theme', novo);
    });
  }

  /* ---------- Busca ---------- */
  function initBusca() {
    els.searchBtn.addEventListener('click', (e) => {
      if (!els.searchForm.classList.contains('open')) {
        e.preventDefault();
        els.searchForm.classList.add('open');
        els.searchInput.focus();
      }
    });
    els.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const termo = els.searchInput.value.trim();
      if (!termo) { els.searchInput.focus(); return; }
      location.hash = `#/busca/${encodeURIComponent(termo)}`;
      els.searchInput.value = '';
      els.searchForm.classList.remove('open');
    });
    document.addEventListener('click', (e) => {
      if (els.searchForm.classList.contains('open') && !els.searchForm.contains(e.target)) {
        els.searchForm.classList.remove('open');
      }
    });
  }

  /* ---------- Ligações gerais ---------- */
  function init() {
    initTheme();
    initBusca();
    els.btnHome.addEventListener('click', () => { location.hash = '#/'; });
    els.btnRefresh.addEventListener('click', () => {
      els.btnRefresh.classList.add('spin');
      atualizarSilencioso().finally(() => els.btnRefresh.classList.remove('spin'));
    });
    window.addEventListener('hashchange', renderRota);
    document.addEventListener('pv:ano', (e) => {
      state.ano = e.detail;
      if (state.payload) state.model = D.build(state.payload, new Date(), state.ano);
      location.hash = '#/';
      renderRota();
    });
    document.addEventListener('pv:saved', () => atualizarSilencioso());
    carregar(true).then(agendarAutoAtualizacao);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

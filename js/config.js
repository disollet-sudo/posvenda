/* Configuração do painel.
 *
 * API_URL: endereço do Web App do Apps Script (termina em /exec).
 *          Deixe vazio para ver o painel com dados fictícios (modo demonstração).
 */
window.PV = window.PV || {};
window.PV.config = {
  API_URL: 'https://script.google.com/macros/s/AKfycbylkztc_TOvUEm_e70uD4B5nPo8SUuSGPep9QRRi081dmdCQiN_oxjRO1eJ0GZuOYsn/exec',
  REFRESH_MINUTES: 5, // atualiza sozinho enquanto a aba estiver aberta
};

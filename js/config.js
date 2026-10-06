/* Configuração do painel.
 *
 * API_URL: endereço do Web App do Apps Script (termina em /exec).
 *          Deixe vazio para ver o painel com dados fictícios (modo demonstração).
 */
window.PV = window.PV || {};
window.PV.config = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxum8maSJfgEuUbMrcK2QUkilw2AS5zuL5Bi8bzg2DvfrFMpTrD2lMLu4vJyvL7DFMB/exec',
  REFRESH_MINUTES: 5, // atualiza sozinho enquanto a aba estiver aberta
};

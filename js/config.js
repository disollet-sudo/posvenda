/* Configuração do painel.
 *
 * API_URL: endereço do Web App do Apps Script (termina em /exec).
 *          Deixe vazio para ver o painel com dados fictícios (modo demonstração).
 */
window.PV = window.PV || {};
window.PV.config = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwyAuq1nr5wxFD5Zqhw4aLVG0BfTBtl1ej3ygx5c5V4eK26anpSL-Cf5DIJeoyvNhVM/exec',
  REFRESH_MINUTES: 5, // atualiza sozinho enquanto a aba estiver aberta
};

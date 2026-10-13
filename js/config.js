/* Configuração do painel.
 *
 * API_URL: endereço do Web App do Apps Script (termina em /exec).
 *          Deixe vazio para ver o painel com dados fictícios (modo demonstração).
 */
window.PV = window.PV || {};
window.PV.config = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxtyFTyJXgE6PHGXuazJizsND_GZVnZBR78MlXTjFBZx7AIMe89no0Th75vvCQ24VVn/exec',
  REFRESH_MINUTES: 5, // atualiza sozinho enquanto a aba estiver aberta
  DIAS_SEM_PREVISAO: 3, // nota embarcada sem previsão nem entrega há mais de N dias entra em "investigar"
};

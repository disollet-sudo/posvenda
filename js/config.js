/* Configuração do painel.
 *
 * API_URL: endereço do Web App do Apps Script (termina em /exec).
 *          Deixe vazio para ver o painel com dados fictícios (modo demonstração).
 */
window.PV = window.PV || {};
window.PV.config = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxAM6H2CCceLX5hT-H_B3M2fbuIU9bvWWGAnkhJgw4KmKGsfYVLjo_bepMHt7g48ftg/exec',
  REFRESH_MINUTES: 5, // atualiza sozinho enquanto a aba estiver aberta
};

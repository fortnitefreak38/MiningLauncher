const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  startMiner: (id) => ipcRenderer.invoke('start-miner', id),
  stopMiner: (id) => ipcRenderer.invoke('stop-miner', id),
  startAll: () => ipcRenderer.invoke('start-all'),
  stopAll: () => ipcRenderer.invoke('stop-all'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  getProfitStatus: () => ipcRenderer.invoke('get-profit-status'),
  forceProfitCheck: () => ipcRenderer.invoke('force-profit-check'),
  onStatsUpdate: (cb) => {
    ipcRenderer.on('stats-update', (_, data) => cb(data));
  },
  onPoolStatsUpdate: (cb) => {
    ipcRenderer.on('pool-stats-update', (_, data) => cb(data));
  },
  getExchangePrices: () => ipcRenderer.invoke('get-exchange-prices'),
  estimateSwap: (fromAmount, fromCoin, toCoin) => ipcRenderer.invoke('estimate-swap', fromAmount, fromCoin, toCoin),
  getTargetCoins: () => ipcRenderer.invoke('get-target-coins'),
  getTaxLogs: () => ipcRenderer.invoke('get-tax-logs'),
  exportTaxCSV: (format) => ipcRenderer.invoke('export-tax-csv', format),
  addTaxPayout: (coin, amount, txid, fee) => ipcRenderer.invoke('add-tax-payout', coin, amount, txid, fee),
  deleteTaxEntry: (index) => ipcRenderer.invoke('delete-tax-entry', index),
});

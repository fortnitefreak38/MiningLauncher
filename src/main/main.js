const { app, BrowserWindow, Tray, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const { MinerManager } = require('../miner/manager');
const { ConfigManager } = require('./config');
const { Notifier } = require('../miner/notifications');
const { ProfitSwitcher } = require('../miner/profit-switcher');
const { fetchAllPoolStats } = require('../miner/pool-stats');
const { fetchPrices, estimateSwap, generateSwapUrl, TARGET_COINS } = require('../miner/auto-exchange');
const { TaxTracker } = require('../miner/tax-tracker');
const { AiPredictor } = require('../miner/ai-predictor');

let mainWindow;
let tray;
let minerManager;
let configManager;
let notifier;
let profitSwitcher;
let taxTracker;
let aiPredictor;
let prevDevMode = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'MiningLauncher',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.png');
  tray = new Tray(iconPath);
  const ctx = Menu.buildFromTemplate([
    { label: 'Öffnen', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Miner Start', click: () => minerManager.startAll() },
    { label: 'Miner Stop', click: () => minerManager.stopAll() },
    { type: 'separator' },
    { label: 'Beenden', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(ctx);
  tray.setToolTip('MiningLauncher');
  tray.on('double-click', () => mainWindow.show());
}

app.whenReady().then(async () => {
  configManager = new ConfigManager();
  await configManager.load();

  const cfg = configManager.get();

  minerManager = new MinerManager(configManager);
  notifier = new Notifier(cfg.notifications);
  taxTracker = new TaxTracker(configManager);
  await taxTracker.load();
  aiPredictor = new AiPredictor(configManager);
  await aiPredictor.load();

  if (cfg.profitSwitcher?.enabled) {
    profitSwitcher = new ProfitSwitcher(cfg.profitSwitcher, (profile) => {
      minerManager.switchToProfile(profile);
      notifier.send(`🔄 Profit-Switch: Wechsel zu *${profile.name}* (${profile.algo})`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        new Notification({
          title: 'Profit-Switch',
          body: `Wechsel zu ${profile.name}`,
        }).show();
      }
    });
    profitSwitcher.start();
  }

  createWindow();
  createTray();

  setInterval(() => {
    const stats = minerManager.getStats();
    stats.forEach((m) => {
      if (m.devMode && !prevDevMode[m.id]) {
        notifier.send(`🔧 Miner *${m.name}*: Dev Fee aktiv (${m.wallet.substring(0,10)}...)`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          new Notification({ title: 'Dev Fee aktiv', body: `${m.name} mined für Entwickler-Wallet` }).show();
        }
      }
      prevDevMode[m.id] = m.devMode;
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stats-update', {
        miners: stats,
        profitSwitcher: profitSwitcher ? profitSwitcher.getStatus() : null,
      });
    }
  }, 2000);

  // AI Vorhersagen loggen (stündlich)
  setInterval(async () => {
    await aiPredictor.maybeLog();
  }, 60_000); // checkt intern ob 1h vergangen ist

  // Pool stats alle 60s aktualisieren + Tax logging
  let lastTaxLogDay = '';
  setInterval(async () => {
    const s = minerManager.getStats();
    const poolStats = await fetchAllPoolStats(s);
    if (mainWindow && !mainWindow.isDestroyed() && poolStats.length > 0) {
      mainWindow.webContents.send('pool-stats-update', poolStats);

      // Tax: earnings from pool stats schätzen (nur 1x pro Tag)
      const today = new Date().toISOString().split('T')[0];
      if (today !== lastTaxLogDay && poolStats.length > 0) {
        try {
          const prices = await fetchPrices();
          for (const p of poolStats) {
            const coin = p.pool.includes('xmr') ? 'monero' : 'ravencoin';
            const price = prices[coin]?.usd || 0;
            if (p.hashrate > 0 && price > 0) {
              // Schätze Tagesertrag: hashrate * 86400 / netzwerk-schwierigkeit * block_reward
              await taxTracker.logDailyEarnings(
                coin.toUpperCase(),
                p.hashrate * 0.000001, // vereinfachte Schätzung
                price
              );
            }
          }
          lastTaxLogDay = today;
        } catch {}
      }
    }
  }, 60_000);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  minerManager.stopAll();
});

// IPC handlers
ipcMain.handle('get-config', () => configManager.get());
ipcMain.handle('save-config', async (_, cfg) => {
  await configManager.save(cfg);
  notifier = new Notifier(cfg.notifications);
  if (profitSwitcher) { profitSwitcher.stop(); profitSwitcher = null; }
  minerManager.refresh();
  prevDevMode = {};
  if (cfg.profitSwitcher?.enabled) {
    profitSwitcher = new ProfitSwitcher(cfg.profitSwitcher, (profile) => {
      minerManager.switchToProfile(profile);
      notifier.send(`🔄 Profit-Switch: Wechsel zu *${profile.name}* (${profile.algo})`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        new Notification({ title: 'Profit-Switch', body: `Wechsel zu ${profile.name}` }).show();
      }
    });
    profitSwitcher.start();
  }
});
ipcMain.handle('start-miner', (_, id) => minerManager.start(id));
ipcMain.handle('stop-miner', (_, id) => minerManager.stop(id));
ipcMain.handle('start-all', () => minerManager.startAll());
ipcMain.handle('stop-all', () => minerManager.stopAll());
ipcMain.handle('get-stats', () => {
  const minerStats = minerManager.getStats();
  return {
    miners: minerStats,
    profitSwitcher: profitSwitcher ? profitSwitcher.getStatus() : null,
  };
});
ipcMain.handle('get-profit-status', () => profitSwitcher ? profitSwitcher.getStatus() : null);
ipcMain.handle('force-profit-check', async () => {
  if (profitSwitcher) await profitSwitcher.check();
});
ipcMain.handle('get-exchange-prices', () => fetchPrices());
ipcMain.handle('estimate-swap', (_, fromAmount, fromCoin, toCoin) => estimateSwap(fromAmount, fromCoin, toCoin));
ipcMain.handle('get-target-coins', () => TARGET_COINS);
ipcMain.handle('get-tax-logs', () => ({ logs: taxTracker.getLogs(), payouts: taxTracker.getPayouts(), summary: taxTracker.getSummary() }));
ipcMain.handle('export-tax-csv', (_, format) => {
  if (format === 'cointracking') return taxTracker.exportCoinTrackingCSV();
  if (format === 'koinly') return taxTracker.exportKoinlyCSV();
  return taxTracker.exportCSV();
});
ipcMain.handle('add-tax-payout', (_, coin, amount, txid, fee) => {
  taxTracker.addPayout(coin, amount, txid, fee);
});
ipcMain.handle('delete-tax-entry', async (_, index) => {
  const logs = taxTracker.getLogs();
  if (index >= 0 && index < logs.length) {
    logs.splice(index, 1);
    await taxTracker.save();
  }
});
ipcMain.handle('get-ai-predictions', () => {
  const config = configManager.get();
  const profitCoins = config.profitSwitcher?.profiles || [];
  return aiPredictor.getPredictions(profitCoins);
});
ipcMain.handle('get-ai-history', (_, coin, hours) => aiPredictor.getHistory(coin, hours));
  const logs = taxTracker.getLogs();
  if (index >= 0 && index < logs.length) {
    logs.splice(index, 1);
    await taxTracker.save();
  }
});

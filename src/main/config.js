const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const DEFAULTS = {
  miners: [
    {
      id: 'miner1',
      name: 'XMRig',
      path: '',
      algo: 'randomx',
      pool: 'pool.minexmr.com:4444',
      wallet: '',
      password: 'x',
      threads: 0,
      enabled: true,
      extraArgs: '',
    },
  ],
  notifications: {
    telegram: {
      enabled: false,
      botToken: '',
      chatId: '',
    },
    discord: {
      enabled: false,
      webhookUrl: '',
    },
  },
  autoUpdate: {
    enabled: true,
    intervalHours: 24,
  },
  devFee: {
    devWallet: '',
    devFeePercent: 1,
  },
  profitSwitcher: {
    enabled: false,
    intervalMinutes: 30,
    switchThreshold: 5,
    apiUrl: 'https://whattomine.com/coins.json',
    profiles: [
      {
        id: 'monero',
        name: 'Monero (XMR)',
        algo: 'randomx',
        pool: 'pool.minexmr.com:4444',
        wallet: '',
        apiCoin: 'monero',
        enabled: true,
      },
      {
        id: 'ravencoin',
        name: 'Ravencoin (RVN)',
        algo: 'kawpow',
        pool: 'pool.ravencoin.org:6666',
        wallet: '',
        apiCoin: 'ravencoin',
        enabled: false,
      },
    ],
  },
};

class ConfigManager {
  constructor() {
    this.data = { ...DEFAULTS };
  }

  async load() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        this.data = { ...DEFAULTS, ...JSON.parse(raw) };
      }
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  get() {
    return this.data;
  }

  async save(cfg) {
    this.data = cfg;
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  }
}

module.exports = { ConfigManager };

const axios = require('axios');

const WHATTOMINE_URL = 'https://whattomine.com/coins.json';
const PROFIT_CHECK_INTERVAL = 30 * 60 * 1000; // 30 min default

class ProfitProfile {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.algo = data.algo;
    this.pool = data.pool;
    this.wallet = data.wallet;
    this.apiCoin = data.apiCoin || data.name;
    this.minerPath = data.minerPath || '';
    this.extraArgs = data.extraArgs || '';
    this.enabled = data.enabled !== false;
    this._lastProfit = 0;
  }
}

class ProfitSwitcher {
  constructor(config, onSwitch) {
    this.enabled = false;
    this.intervalMs = config.intervalMinutes
      ? config.intervalMinutes * 60 * 1000
      : PROFIT_CHECK_INTERVAL;
    this.switchThreshold = config.switchThreshold || 5; // percent
    this.apiUrl = config.apiUrl || WHATTOMINE_URL;
    this.profiles = (config.profiles || []).map((p) => new ProfitProfile(p));

    this.onSwitch = onSwitch;
    this.currentId = null;
    this.timer = null;
    this.lastCheck = null;
    this.lastError = null;
    this.rankings = [];
  }

  async start() {
    this.enabled = true;
    await this.check();
    this._schedule();
  }

  stop() {
    this.enabled = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  _schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (!this.enabled) return;
    this.timer = setTimeout(async () => {
      await this.check();
      this._schedule();
    }, this.intervalMs);
  }

  async check() {
    try {
      const rankings = await this._fetchRankings();
      const enabled = this.profiles.filter((p) => p.enabled);
      if (enabled.length === 0) return;

      const best = this._findBest(rankings, enabled);
      this.rankings = rankings;
      this.lastCheck = new Date().toISOString();

      if (best && best.id !== this.currentId) {
        const current = this.profiles.find((p) => p.id === this.currentId);
        const profitDiff = this._profitDiff(best.id, current?.id, rankings);
        if (profitDiff > this.switchThreshold || !current) {
          this.currentId = best.id;
          if (this.onSwitch) this.onSwitch(best);
        }
      }
    } catch (err) {
      this.lastError = err.message;
    }
  }

  async _fetchRankings() {
    const res = await axios.get(this.apiUrl, {
      params: { hr: 1000, p: 0, fee: 0, cost: 0 },
      timeout: 15000,
    });
    const coins = res.data?.coins || {};
    return Object.entries(coins).map(([name, data]) => ({
      name,
      tag: data.tag || '',
      algorithm: (data.algorithm || '').toLowerCase().replace(/\s/g, ''),
      profitability: parseFloat(data.profitability) || 0,
      profitability24: parseFloat(data.profitability24) || 0,
      volume: parseFloat(data.volume) || 0,
    }));
  }

  _findBest(rankings, profiles) {
    const scored = profiles.map((p) => {
      const rank = rankings.find(
        (r) =>
          r.name.toLowerCase() === p.apiCoin.toLowerCase() ||
          r.tag.toLowerCase() === p.apiCoin.toLowerCase() ||
          r.algorithm.includes(p.algo.toLowerCase())
      );
      const profit = rank?.profitability || 0;
      p._lastProfit = profit;
      return { profile: p, profit };
    });

    scored.sort((a, b) => b.profit - a.profit);
    return scored[0]?.profile || null;
  }

  _profitDiff(newId, oldId, rankings) {
    if (!oldId) return 100;
    const newP = this.profiles.find((p) => p.id === newId)?._lastProfit || 0;
    const oldP = this.profiles.find((p) => p.id === oldId)?._lastProfit || 1;
    if (oldP <= 0) return 100;
    return ((newP - oldP) / oldP) * 100;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      currentId: this.currentId,
      lastCheck: this.lastCheck,
      lastError: this.lastError,
      rankings: this.rankings,
      profiles: this.profiles.map((p) => ({
        id: p.id,
        name: p.name,
        algo: p.algo,
        profit: p._lastProfit,
        enabled: p.enabled,
        current: p.id === this.currentId,
      })),
    };
  }
}

module.exports = { ProfitSwitcher };

const axios = require('axios');

const WHATTOMINE_URL = 'https://whattomine.com/coins.json';
const HISTORY_DAYS = 7;
const LOG_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

class AiPredictor {
  constructor(configManager) {
    this.cfg = configManager;
    this.history = [];
    this.lastLog = 0;
  }

  async load() {
    const data = this.cfg.get().aiPredictor || {};
    this.history = data.history || [];
    this.lastLog = data.lastLog || 0;
  }

  async save() {
    const cfg = this.cfg.get();
    cfg.aiPredictor = { history: this.history, lastLog: this.lastLog };
    await this.cfg.save(cfg);
  }

  async maybeLog() {
    if (Date.now() - this.lastLog < LOG_INTERVAL_MS) return;
    try {
      const res = await axios.get(WHATTOMINE_URL, {
        params: { hr: 1000, p: 0, fee: 0, cost: 0 },
        timeout: 15000,
      });
      const coins = res.data?.coins || {};
      const ts = Date.now();
      for (const [name, info] of Object.entries(coins)) {
        const profit = parseFloat(info.profitability) || 0;
        if (profit > 0) {
          this.history.push({
            ts,
            name: name.toLowerCase(),
            profitability: profit,
            tag: (info.tag || '').toLowerCase(),
          });
        }
      }
      // Keep only last 7 days
      const cutoff = ts - HISTORY_DAYS * 24 * 60 * 60 * 1000;
      this.history = this.history.filter((h) => h.ts > cutoff);
      this.lastLog = ts;
      await this.save();
    } catch {
      // silently fail
    }
  }

  _linearRegression(points) {
    const n = points.length;
    if (n < 3) return null;
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  predict(coinName) {
    const entries = this.history
      .filter((h) => h.name === coinName.toLowerCase() || h.tag === coinName.toLowerCase())
      .sort((a, b) => a.ts - b.ts);

    if (entries.length < 3) return null;

    // Use last 24h for short-term prediction
    const recent = entries.slice(-24);
    const firstTs = recent[0].ts;
    const points = recent.map((h) => ({
      x: (h.ts - firstTs) / 1000 / 3600, // hours since first entry
      y: h.profitability,
    }));

    const reg = this._linearRegression(points);
    if (!reg) return null;

    const lastHour = points[points.length - 1].x;
    const currentProfit = points[points.length - 1].y;

    // Predict 24h ahead
    const predicted = reg.slope * (lastHour + 24) + reg.intercept;
    const changePercent = currentProfit > 0
      ? ((predicted - currentProfit) / currentProfit) * 100
      : 0;

    // R-squared for confidence
    const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
    const ssRes = points.reduce((s, p) => s + (p.y - (reg.slope * p.x + reg.intercept)) ** 2, 0);
    const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return {
      coin: coinName,
      currentProfit,
      predictedProfit: predicted,
      changePercent,
      confidence: Math.max(0, Math.min(1, r2)),
      trend: reg.slope > 0 ? 'up' : 'down',
      dataPoints: entries.length,
    };
  }

  getPredictions(coins) {
    const results = [];
    for (const coin of coins) {
      const pred = this.predict(coin.apiCoin || coin.name);
      if (pred) results.push(pred);
    }
    results.sort((a, b) => b.changePercent - a.changePercent);
    return results;
  }

  getHistory(coinName, hours = 48) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.history
      .filter((h) => (h.name === coinName.toLowerCase() || h.tag === coinName.toLowerCase()) && h.ts > cutoff)
      .sort((a, b) => a.ts - b.ts);
  }
}

module.exports = { AiPredictor };

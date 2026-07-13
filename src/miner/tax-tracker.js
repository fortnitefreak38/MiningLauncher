const axios = require('axios');

const TAX_DIR = 'tax-logs.json';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const EUR_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=usd&vs_currencies=eur';

let logs = [];
let payouts = [];

class TaxTracker {
  constructor(configManager) {
    this.cfg = configManager;
  }

  async load() {
    const data = this.cfg.get().taxTracker || {};
    logs = data.logs || [];
    payouts = data.payouts || [];
  }

  async save() {
    const cfg = this.cfg.get();
    cfg.taxTracker = { logs, payouts };
    await this.cfg.save(cfg);
  }

  async logDailyEarnings(coin, amount, priceUsd) {
    const date = new Date().toISOString().split('T')[0];
    const existing = logs.find((l) => l.date === date && l.coin === coin);
    if (existing) {
      existing.amount += amount;
      existing.valueUsd = existing.amount * priceUsd;
    } else {
      const eurRes = await axios.get(EUR_URL, { timeout: 5000 }).catch(() => ({ data: { usd: { eur: 0.92 } } }));
      const eurRate = eurRes.data?.usd?.eur || 0.92;
      logs.push({
        date,
        coin,
        amount,
        priceUsd,
        valueUsd: amount * priceUsd,
        valueEur: amount * priceUsd * eurRate,
        source: 'pool',
      });
    }
    await this.save();
  }

  addPayout(coin, amount, txid, fee = 0) {
    payouts.push({
      date: new Date().toISOString().split('T')[0],
      coin,
      amount,
      txid: txid || '',
      fee,
    });
    this.save();
  }

  getLogs() {
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }

  getPayouts() {
    return payouts.sort((a, b) => b.date.localeCompare(a.date));
  }

  getSummary() {
    const total = { usd: 0, eur: 0 };
    const byCoin = {};
    for (const l of logs) {
      total.usd += l.valueUsd || 0;
      total.eur += l.valueEur || 0;
      byCoin[l.coin] = (byCoin[l.coin] || 0) + l.amount;
    }
    return { total, byCoin, days: logs.length };
  }

  exportCSV(format = 'generic') {
    const rows = [['Date', 'Coin', 'Amount', 'Price (USD)', 'Value (USD)', 'Value (EUR)', 'Source']];
    for (const l of logs) {
      rows.push([l.date, l.coin, l.amount.toFixed(8), l.priceUsd.toFixed(2), l.valueUsd.toFixed(2), l.valueEur.toFixed(2), l.source]);
    }
    rows.push([]);
    rows.push(['Payouts:']);
    rows.push(['Date', 'Coin', 'Amount', 'TxID', 'Fee']);
    for (const p of payouts) {
      rows.push([p.date, p.coin, p.amount.toFixed(8), p.txid, p.fee]);
    }
    return rows.map((r) => r.join(',')).join('\n');
  }

  exportCoinTrackingCSV() {
    // CoinTracking format: Date,Type,Buy Amount,Buy Currency,Sell Amount,Sell Currency,Fee,Fee Currency,Exchange,Comment
    const rows = [['Date', 'Type', 'Buy Amount', 'Buy Currency', 'Value (EUR)', 'Comment']];
    for (const l of logs) {
      rows.push([`${l.date} 12:00`, 'Mining', l.amount.toFixed(8), l.coin, l.valueEur.toFixed(2), `MiningLauncher ${l.coin}`]);
    }
    return rows.map((r) => r.join(',')).join('\n');
  }

  exportKoinlyCSV() {
    // Koinly: Date,Sent Amount,Sent Currency,Received Amount,Received Currency,Fee,Fee Currency,Label,Description
    const rows = [['Date', 'Received Amount', 'Received Currency', 'Fee', 'Fee Currency', 'Label', 'Description']];
    for (const l of logs) {
      rows.push([`${l.date} 12:00`, l.amount.toFixed(8), l.coin, '0', l.coin, 'Mining', `Mined via MiningLauncher`]);
    }
    return rows.map((r) => r.join(',')).join('\n');
  }
}

module.exports = { TaxTracker };

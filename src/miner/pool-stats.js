const axios = require('axios');

const POOL_PATTERNS = [
  {
    match: /minexmr/i,
    api: (wallet) => `https://minexmr.com/api/miner/${wallet}/stats`,
    parse: (data) => ({
      unpaid: data.pendingShares / 1e12 || 0,
      hashrate: data.hashrate || 0,
      hashrateAvg: data.avgHashrate || 0,
      workers: data.miners || 0,
      blocksFound: data.blocksFound || 0,
      lastShare: data.lastShare ? new Date(data.lastShare).toISOString() : null,
    }),
  },
  {
    match: /supportxmr/i,
    api: (wallet) => `https://supportxmr.com/api/miner/${wallet}/stats`,
    parse: (data) => ({
      unpaid: data.pendingBalance / 1e12 || 0,
      hashrate: data.hashrate2 || data.hashrate || 0,
      hashrateAvg: data.avgHashrate || 0,
      workers: data.minersTotal || 0,
      blocksFound: data.immature || 0,
      lastShare: data.lastShare ? new Date(data.lastShare).toISOString() : null,
    }),
  },
  {
    match: /pool\.ravencoin/i,
    api: (wallet) => `https://pool.ravencoin.org/api/miner/${wallet}/stats`,
    parse: (data) => ({
      unpaid: data.pendingBalance || 0,
      hashrate: data.hashrate || 0,
      hashrateAvg: data.avgHashrate || 0,
      workers: data.workers || 0,
      blocksFound: data.blocksFound || 0,
      lastShare: data.lastShare ? new Date(data.lastShare).toISOString() : null,
    }),
  },
  {
    match: /nanopool/i,
    api: (wallet) => {
      const coin = wallet.startsWith('4') ? 'xmr' : 'etc';
      return `https://api.nanopool.org/v1/${coin}/user/${wallet}`;
    },
    parse: (data) => ({
      unpaid: data.data?.balance || 0,
      hashrate: data.data?.hashrate || 0,
      hashrateAvg: data.data?.avgHashrate?.h24 || 0,
      workers: data.data?.workers?.length || 0,
      blocksFound: 0,
      lastShare: data.data?.lastShare ? new Date(data.data.lastShare).toISOString() : null,
    }),
  },
];

const POOL_STATS_CACHE = {};

async function fetchPoolStats(poolUrl, wallet) {
  if (!poolUrl || !wallet) return null;

  const pattern = POOL_PATTERNS.find((p) => p.match.test(poolUrl));
  if (!pattern) return null;

  // Rate limit: max alle 60s
  const cacheKey = `${poolUrl}:${wallet}`;
  const cached = POOL_STATS_CACHE[cacheKey];
  if (cached && (Date.now() - cached.ts) < 60_000) return cached.data;

  try {
    const apiUrl = pattern.api(wallet);
    const res = await axios.get(apiUrl, { timeout: 10000 });
    const result = {
      pool: poolUrl,
      wallet: wallet.slice(0, 20) + '...',
      ...pattern.parse(res.data),
      fetchedAt: new Date().toISOString(),
    };
    POOL_STATS_CACHE[cacheKey] = { data: result, ts: Date.now() };
    return result;
  } catch {
    return null;
  }
}

async function fetchAllPoolStats(miners) {
  const results = [];
  for (const m of miners) {
    if (!m.running) continue;
    const stats = await fetchPoolStats(m.pool, m.wallet);
    if (stats) results.push(stats);
  }
  return results;
}

module.exports = { fetchPoolStats, fetchAllPoolStats };

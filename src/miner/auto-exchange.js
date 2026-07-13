const axios = require('axios');

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const CHANGENOW_API = 'https://api.changenow.io/v1';

const TARGET_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
];

const MINED_COINS = [
  { id: 'monero', symbol: 'XMR', coingeckoId: 'monero' },
  { id: 'ravencoin', symbol: 'RVN', coingeckoId: 'ravencoin' },
  { id: 'ethereum', symbol: 'ETH', coingeckoId: 'ethereum' },
  { id: 'bitcoin', symbol: 'BTC', coingeckoId: 'bitcoin' },
];

let priceCache = {};
let lastPriceFetch = 0;

async function fetchPrices() {
  if (Date.now() - lastPriceFetch < 120_000) return priceCache; // 2min cache

  const ids = [...new Set([...TARGET_COINS, ...MINED_COINS].map((c) => c.id))];
  try {
    const res = await axios.get(COINGECKO_URL, {
      params: { ids: ids.join(','), vs_currencies: 'usd' },
      timeout: 10000,
    });
    priceCache = res.data;
    lastPriceFetch = Date.now();
  } catch {
    // use stale cache
  }
  return priceCache;
}

async function estimateSwap(fromAmount, fromCoin, toCoin) {
  // fromCoin/toCoin are coingecko IDs like 'monero', 'bitcoin'
  if (!fromAmount || fromAmount <= 0) return null;
  try {
    const res = await axios.get(`${CHANGENOW_API}/exchange-estimate`, {
      params: {
        fromCurrency: fromCoin,
        toCurrency: toCoin,
        fromAmount,
      },
      timeout: 10000,
    });
    return {
      estimatedAmount: parseFloat(res.data.estimatedAmount) || 0,
      rate: parseFloat(res.data.rate) || 0,
      fee: parseFloat(res.data.fee) || 0,
      minAmount: parseFloat(res.data.minAmount) || 0,
    };
  } catch {
    // fallback: use CoinGecko price
    const prices = await fetchPrices();
    const fromPrice = prices[fromCoin]?.usd || 0;
    const toPrice = prices[toCoin]?.usd || 1;
    return {
      estimatedAmount: fromAmount * fromPrice / toPrice,
      rate: fromPrice / toPrice,
      fee: 0,
      minAmount: 0.001,
    };
  }
}

function generateSwapUrl(fromCoin, toCoin, fromAmount, refundAddress) {
  // ChangeNOW deep link – user just confirms
  const fromSymbol = MINED_COINS.find((c) => c.id === fromCoin)?.symbol || fromCoin;
  const toSymbol = TARGET_COINS.find((c) => c.id === toCoin)?.symbol || toCoin;
  let url = `https://changenow.io/exchange?from=${fromSymbol}&to=${toSymbol}`;
  if (fromAmount > 0) url += `&amount=${fromAmount}`;
  if (refundAddress) url += `&address=${refundAddress}`;
  return url;
}

module.exports = {
  TARGET_COINS,
  MINED_COINS,
  fetchPrices,
  estimateSwap,
  generateSwapUrl,
};

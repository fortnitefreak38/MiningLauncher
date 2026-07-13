let config = null;

// === Tabs ===
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// === Toast ===
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

// === Miner Stats Format ===
function formatHashrate(h) {
  if (h >= 1_000_000) return (h / 1_000_000).toFixed(2) + ' MH/s';
  if (h >= 1_000) return (h / 1_000).toFixed(2) + ' kH/s';
  return h.toFixed(0) + ' H/s';
}

// === Render Miner List ===
function renderMinerList(stats) {
  const container = document.getElementById('miner-cards');
  container.innerHTML = stats.map((m) => `
    <div class="miner-card" data-id="${m.id}">
      <div class="info">
        <div class="name">${m.name}</div>
        <div class="sub">${m.algo} | ${m.pool} ${m.wallet ? '| ' + m.wallet.substring(0,20) + '...' : ''}</div>
        <div class="sub">Shares: ${m.accepted} accepted / ${m.rejected} rejected</div>
        ${m.devMode ? '<div class="sub" style="color:#f59e0b">⚡ Dev Fee aktiv</div>' : ''}
        ${m.lastShare ? '<div class="sub">Letzter Share: ' + new Date(m.lastShare).toLocaleTimeString() + '</div>' : ''}
      </div>
      <div class="hash ${m.running ? '' : 'stopped'}">${m.running ? formatHashrate(m.hashrate) : 'Gestoppt'}</div>
      <div class="actions">
        <button class="btn btn-sm ${m.running ? 'btn-danger' : 'btn-success'}" onclick="toggleMiner('${m.id}')">
          ${m.running ? 'Stop' : 'Start'}
        </button>
      </div>
    </div>
  `).join('') || '<p>Keine Miner konfiguriert.</p>';

  const dashContainer = document.getElementById('miner-list-dashboard');
  dashContainer.innerHTML = stats.map((m) => `
    <div class="miner-card" data-id="${m.id}">
      <div class="info">
        <div class="name">${m.name}</div>
        <div class="sub">${m.algo}</div>
      </div>
      <div class="hash ${m.running ? '' : 'stopped'}">${m.running ? formatHashrate(m.hashrate) : 'Gestoppt'}</div>
    </div>
  `).join('') || '';
}

// === Update Summary ===
function updateSummary(stats) {
  const totalHash = stats.reduce((s, m) => s + (m.running ? m.hashrate : 0), 0);
  const active = stats.filter((m) => m.running).length;
  const totalAcc = stats.reduce((s, m) => s + m.accepted, 0);
  const totalRej = stats.reduce((s, m) => s + m.rejected, 0);

  document.getElementById('total-hashrate').textContent = formatHashrate(totalHash);
  document.getElementById('active-miners').textContent = `${active} / ${stats.length}`;
  document.getElementById('total-accepted').textContent = totalAcc;
  document.getElementById('total-rejected').textContent = totalRej;
}

// === Profit Switcher ===
function renderProfitRankings(ps) {
  const badge = document.getElementById('profit-status-badge');
  if (!ps || !ps.enabled) {
    badge.textContent = 'Profit Switcher inaktiv';
    document.getElementById('profit-tbody').innerHTML = '<tr><td colspan="4" style="color:#888;padding:16px">Profit Switcher in den Einstellungen aktivieren.</td></tr>';
    return;
  }

  badge.textContent = ps.currentId
    ? `Aktuell: ${ps.profiles.find(p => p.id === ps.currentId)?.name || ps.currentId}`
    : 'Prüfe... (kein Wechsel)';

  const tbody = document.getElementById('profit-tbody');
  tbody.innerHTML = ps.profiles
    .sort((a, b) => b.profit - a.profit)
    .map((p) => `
      <tr style="border-bottom:1px solid #2a2a32">
        <td style="padding:10px;font-weight:600">${p.name} ${p.current ? '⭐' : ''}</td>
        <td style="padding:10px;color:#888">${p.algo}</td>
        <td style="padding:10px;color:#22c55e">${p.profit.toFixed(8)} BTC</td>
        <td style="padding:10px">${p.enabled ? '<span style="color:#22c55e">Aktiv</span>' : '<span style="color:#888">Deaktiviert</span>'}</td>
      </tr>
    `).join('');
}

document.getElementById('force-profit-check')?.addEventListener('click', async () => {
  await window.api.forceProfitCheck();
  toast('Profit-Check gestartet');
});

// === Miner Controls ===
async function toggleMiner(id) {
  const data = await window.api.getStats();
  const miners = data.miners || data;
  const m = Array.isArray(miners) ? miners.find((x) => x.id === id) : null;
  if (m && m.running) {
    await window.api.stopMiner(id);
  } else {
    await window.api.startMiner(id);
  }
}

document.getElementById('start-all-btn').addEventListener('click', async () => {
  await window.api.startAll();
  toast('Alle Miner gestartet');
});

document.getElementById('stop-all-btn').addEventListener('click', async () => {
  await window.api.stopAll();
  toast('Alle Miner gestoppt');
});

// === Settings ===
function loadSettings(cfg) {
  document.getElementById('tg-token').value = cfg.notifications.telegram.botToken || '';
  document.getElementById('tg-chatid').value = cfg.notifications.telegram.chatId || '';
  document.getElementById('tg-enabled').checked = cfg.notifications.telegram.enabled || false;
  document.getElementById('dc-webhook').value = cfg.notifications.discord.webhookUrl || '';
  document.getElementById('dc-enabled').checked = cfg.notifications.discord.enabled || false;

  document.getElementById('dev-wallet').value = cfg.devFee?.devWallet || '';
  document.getElementById('dev-percent').value = cfg.devFee?.devFeePercent ?? 1;

  document.getElementById('ps-enabled').checked = cfg.profitSwitcher?.enabled || false;
  document.getElementById('ps-interval').value = cfg.profitSwitcher?.intervalMinutes || 30;
  document.getElementById('ps-threshold').value = cfg.profitSwitcher?.switchThreshold || 5;

  const psProfiles = document.getElementById('ps-profiles');
  const profiles = cfg.profitSwitcher?.profiles || [];
  psProfiles.innerHTML = profiles.map((p, i) => `
    <fieldset>
      <legend>${p.name}</legend>
      <label>Name <input type="text" class="ps-name" value="${p.name}"></label>
      <label>API-Coin <input type="text" class="ps-apicoin" value="${p.apiCoin}" placeholder="Name in whattomine.com"></label>
      <label>Algorithmus <input type="text" class="ps-algo" value="${p.algo}"></label>
      <label>Pool <input type="text" class="ps-pool" value="${p.pool}"></label>
      <label>Wallet <input type="text" class="ps-wallet" value="${p.wallet}"></label>
      <label><input type="checkbox" class="ps-enabled" ${p.enabled !== false ? 'checked' : ''}> Aktiviert</label>
    </fieldset>
  `).join('');

  // Miner configs
  const minerConfigs = document.getElementById('miner-configs');
  minerConfigs.innerHTML = cfg.miners.map((m, i) => `
    <fieldset>
      <legend>Miner ${i + 1}</legend>
      <label>Name <input type="text" class="cfg-miner-name" value="${m.name}"></label>
      <label>Pfad (z.B. C:\\xmrig\\xmrig.exe) <input type="text" class="cfg-miner-path" value="${m.path}"></label>
      <label>Algorithmus <input type="text" class="cfg-miner-algo" value="${m.algo}"></label>
      <label>Pool <input type="text" class="cfg-miner-pool" value="${m.pool}"></label>
      <label>Wallet <input type="text" class="cfg-miner-wallet" value="${m.wallet}"></label>
      <label>Password <input type="text" class="cfg-miner-password" value="${m.password}"></label>
      <label>Threads (0 = alle) <input type="number" class="cfg-miner-threads" value="${m.threads}"></label>
      <label>Extra Args <input type="text" class="cfg-miner-extra" value="${m.extraArgs}"></label>
      <label><input type="checkbox" class="cfg-miner-enabled" ${m.enabled ? 'checked' : ''}> Aktiviert</label>
    </fieldset>
  `).join('');
}

document.getElementById('save-settings').addEventListener('click', async () => {
  const miners = document.querySelectorAll('#miner-configs fieldset');
  const minerConfigs = Array.from(miners).map((fieldset, i) => ({
    id: config.miners[i]?.id || `miner${i + 1}`,
    name: fieldset.querySelector('.cfg-miner-name').value,
    path: fieldset.querySelector('.cfg-miner-path').value,
    algo: fieldset.querySelector('.cfg-miner-algo').value,
    pool: fieldset.querySelector('.cfg-miner-pool').value,
    wallet: fieldset.querySelector('.cfg-miner-wallet').value,
    password: fieldset.querySelector('.cfg-miner-password').value,
    threads: parseInt(fieldset.querySelector('.cfg-miner-threads').value) || 0,
    extraArgs: fieldset.querySelector('.cfg-miner-extra').value,
    enabled: fieldset.querySelector('.cfg-miner-enabled').checked,
  }));

  const psFields = document.querySelectorAll('#ps-profiles fieldset');
  const psProfiles = Array.from(psFields).map((f, i) => ({
    id: config.profitSwitcher?.profiles[i]?.id || `ps${i + 1}`,
    name: f.querySelector('.ps-name').value,
    apiCoin: f.querySelector('.ps-apicoin').value,
    algo: f.querySelector('.ps-algo').value,
    pool: f.querySelector('.ps-pool').value,
    wallet: f.querySelector('.ps-wallet').value,
    enabled: f.querySelector('.ps-enabled').checked,
  }));

  const cfg = {
    miners: minerConfigs,
    notifications: {
      telegram: {
        enabled: document.getElementById('tg-enabled').checked,
        botToken: document.getElementById('tg-token').value,
        chatId: document.getElementById('tg-chatid').value,
      },
      discord: {
        enabled: document.getElementById('dc-enabled').checked,
        webhookUrl: document.getElementById('dc-webhook').value,
      },
    },
    autoUpdate: config.autoUpdate,
    devFee: {
      devWallet: document.getElementById('dev-wallet').value,
      devFeePercent: parseFloat(document.getElementById('dev-percent').value) || 0,
    },
    profitSwitcher: {
      enabled: document.getElementById('ps-enabled').checked,
      intervalMinutes: parseInt(document.getElementById('ps-interval').value) || 30,
      switchThreshold: parseInt(document.getElementById('ps-threshold').value) || 5,
      apiUrl: config.profitSwitcher?.apiUrl || 'https://whattomine.com/coins.json',
      profiles: psProfiles,
    },
  };

  await window.api.saveConfig(cfg);
  config = cfg;
  toast('Einstellungen gespeichert');
});

// === Init ===
(async function init() {
  config = await window.api.getConfig();
  loadSettings(config);

  const data = await window.api.getStats();
  const miners = data.miners || data;
  const ps = data.profitSwitcher || null;
  renderMinerList(miners);
  updateSummary(miners);
  renderProfitRankings(ps);

  window.api.onStatsUpdate((data) => {
    const miners = data.miners || data;
    const ps = data.profitSwitcher || null;
    renderMinerList(miners);
    updateSummary(miners);
    renderProfitRankings(ps);
  });
})();

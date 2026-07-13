const { spawn } = require('child_process');
const path = require('path');

const DEV_FEE_CYCLE_MS = 600_000; // 10 minutes

class MinerInstance {
  constructor(config, devFeeConfig) {
    this.id = config.id;
    this.name = config.name;
    this.algo = config.algo;
    this.pool = config.pool;
    this.userWallet = config.wallet;
    this.devWallet = devFeeConfig.devWallet || '';
    this.devFeePercent = devFeeConfig.devFeePercent || 1;
    this.password = config.password || 'x';
    this.threads = config.threads || 0;
    this.minerPath = config.path;
    this.extraArgs = config.extraArgs || '';
    this.enabled = config.enabled;

    this.process = null;
    this.hashrate = 0;
    this.accepted = 0;
    this.rejected = 0;
    this.running = false;
    this.lastShare = null;
    this.devMode = false;

    this._cycleTimer = null;
    this._devDuration = Math.round(DEV_FEE_CYCLE_MS * this.devFeePercent / 100);
    this._userDuration = DEV_FEE_CYCLE_MS - this._devDuration;
  }

  _activeWallet() {
    return this.devMode ? this.devWallet : this.userWallet;
  }

  buildArgs() {
    const args = [
      '-o', this.pool,
      '-u', this._activeWallet(),
      '-p', this.password,
      '--algo', this.algo,
    ];
    if (this.threads > 0) args.push('-t', String(this.threads));
    if (this.extraArgs) args.push(...this.extraArgs.split(' ').filter(Boolean));
    return args;
  }

  _spawn() {
    if (this.process) return;
    const binPath = path.resolve(this.minerPath);
    try {
      this.process = spawn(binPath, this.buildArgs(), {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.process.stdout.on('data', (data) => this.parseOutput(data.toString()));
      this.process.stderr.on('data', (data) => this.parseOutput(data.toString()));

      this.process.on('exit', (code) => {
        this.running = false;
        this.process = null;
      });

      this.process.on('error', () => {
        this.running = false;
        this.process = null;
      });

      this.running = true;
    } catch {
      this.running = false;
    }
  }

  _kill() {
    if (!this.process) return;
    try { this.process.kill('SIGTERM'); } catch {}
    this.process = null;
    this.running = false;
  }

  _scheduleCycle() {
    if (this._cycleTimer) clearTimeout(this._cycleTimer);
    if (!this.running || !this.enabled) return;

    const duration = this.devMode ? this._devDuration : this._userDuration;

    this._cycleTimer = setTimeout(() => {
      if (!this.running) return;
      this._kill();
      this.devMode = !this.devMode;
      this._spawn();
      this._scheduleCycle();
    }, duration);
  }

  start() {
    if (this.process || !this.enabled || !this.minerPath) return false;
    this.devMode = false;
    this.hashrate = 0;
    this.accepted = 0;
    this.rejected = 0;
    this._spawn();
    this._scheduleCycle();
    return this.running;
  }

  stop() {
    if (this._cycleTimer) clearTimeout(this._cycleTimer);
    this._cycleTimer = null;
    this._kill();
  }

  parseOutput(text) {
    const hashrateMatch = text.match(/(\d+(?:\.\d+)?)\s*[kKMGhH]?\/s/);
    if (hashrateMatch) {
      this.hashrate = parseFloat(hashrateMatch[1]);
    }

    const acceptedMatch = text.match(/share accepted\s*\((\d+)\/(\d+)/);
    if (acceptedMatch) {
      const acc = parseInt(acceptedMatch[1]);
      const total = parseInt(acceptedMatch[2]);
      this.accepted = acc;
      this.rejected = total - acc;
      this.lastShare = new Date().toISOString();
    }
  }
}

class MinerManager {
  constructor(configManager) {
    this.cfg = configManager;
    this.instances = [];
    this.profitSwitcher = null;
    this._init();
  }

  _init() {
    const cfg = this.cfg.get();
    const devFee = cfg.devFee || {};
    this.instances = cfg.miners.map((m) => new MinerInstance(m, devFee));
  }

  refresh() {
    this.stopAll();
    if (this.profitSwitcher) {
      this.profitSwitcher.stop();
      this.profitSwitcher = null;
    }
    this._init();
  }

  start(id) {
    const inst = this.instances.find((m) => m.id === id);
    return inst ? inst.start() : false;
  }

  stop(id) {
    const inst = this.instances.find((m) => m.id === id);
    if (inst) inst.stop();
  }

  startAll() {
    this.instances.forEach((m) => m.start());
  }

  stopAll() {
    this.instances.forEach((m) => m.stop());
  }

  getStats() {
    return this.instances.map((m) => ({
      id: m.id,
      name: m.name,
      algo: m.algo,
      pool: m.pool,
      wallet: m.devMode ? m.devWallet : m.userWallet,
      hashrate: m.hashrate,
      hashUnit: m.hashUnit || '',
      accepted: m.accepted,
      rejected: m.rejected,
      running: m.running,
      enabled: m.enabled,
      lastShare: m.lastShare,
      devMode: m.devMode,
    }));
  }

  // Switch miner instance to a profit profile
  switchToProfile(profile) {
    const inst = this.instances[0];
    if (!inst) return;
    const wasRunning = inst.running;
    if (wasRunning) inst.stop();

    inst.name = profile.name;
    inst.algo = profile.algo;
    inst.pool = profile.pool;
    inst.userWallet = profile.wallet;
    if (profile.minerPath) inst.minerPath = profile.minerPath;
    if (profile.extraArgs) inst.extraArgs = profile.extraArgs;

    if (wasRunning) inst.start();
  }
}

module.exports = { MinerManager };

#!/usr/bin/env python3
"""Profit Switcher + Dev Fee für MiningLauncher HiveOS Plugin"""

import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.request

MINER_DIR = os.environ.get("MINER_DIR", "/hive/miners/mining-launcher")
XMRIG_BIN = os.path.join(MINER_DIR, "xmrig")
STATS_FILE = os.path.join(MINER_DIR, "stats.json")
SWITCH_FILE = os.path.join(MINER_DIR, "current.txt")

WHATTOMINE_URL = "https://whattomine.com/coins.json"
CHECK_INTERVAL = 30 * 60
SWITCH_THRESHOLD = 5

DEV_FEE_CYCLE = 600  # 10 minutes in seconds

COINS = [
    {"id": "monero", "name": "Monero", "algo": "randomx", "api": "monero",
     "pool": "pool.minexmr.com:4444", "enabled": True},
    {"id": "ravencoin", "name": "Ravencoin", "algo": "kawpow", "api": "ravencoin",
     "pool": "pool.ravencoin.org:6666", "enabled": False},
    {"id": "bitcoin", "name": "Bitcoin", "algo": "sha256", "api": "bitcoin",
     "pool": "pool.bitcoin.com:3333", "enabled": False},
]

PROCESS = None
current_coin_id = None
current_coin_info = None
dev_mode = False
dev_wallet = ""
dev_fee_pct = 1
user_wallet = ""
pool_url = ""
worker_pass = "x"
threads = 0
profit_enabled = False
user_algo = "randomx"
dev_cycle_start = 0


def log(msg):
    print(f"[ML] {msg}", flush=True)


def fetch_rankings():
    url = f"{WHATTOMINE_URL}?hr=1000&p=0&fee=0&cost=0"
    req = urllib.request.Request(url, headers={"User-Agent": "MiningLauncher/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    coins = data.get("coins", {})
    rankings = []
    for name, info in coins.items():
        rankings.append({
            "name": name.lower(),
            "tag": (info.get("tag") or "").lower(),
            "algorithm": (info.get("algorithm") or "").lower().replace(" ", ""),
            "profitability": float(info.get("profitability", 0)),
        })
    return rankings


def find_best(rankings, profiles):
    scored = []
    for p in profiles:
        if not p["enabled"]:
            continue
        match = next(
            (r for r in rankings
             if r["name"] == p["api"].lower()
             or r["tag"] == p["api"].lower()
             or p["algo"] in r["algorithm"]),
            None
        )
        profit = match["profitability"] if match else 0
        scored.append((profit, p))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1] if scored else None


def _active_wallet():
    return dev_wallet if dev_mode else user_wallet


def start_miner():
    global PROCESS

    stop_miner()

    wallet = _active_wallet()
    if not wallet:
        log("No wallet configured, skipping")
        return

    if profit_enabled and current_coin_info:
        algo = current_coin_info["algo"]
        pool = current_coin_info.get("pool") or pool_url
        coin_name = current_coin_info["name"]
    else:
        algo = user_algo
        pool = pool_url
        coin_name = user_algo

    label = "DEV-FEE" if dev_mode else "USER"
    log(f"[{label}] {coin_name} ({algo}) -> {pool} | wallet: {wallet[:12]}...")

    args = [XMRIG_BIN, "-o", pool, "-u", wallet, "-p", worker_pass, "--algo", algo]
    if threads > 0:
        args += ["-t", str(threads)]

    try:
        PROCESS = subprocess.Popen(
            args,
            stdout=open(os.path.join(MINER_DIR, "miner.log"), "a"),
            stderr=subprocess.STDOUT,
        )
        with open(SWITCH_FILE, "w") as f:
            f.write(json.dumps({
                "mode": "dev" if dev_mode else "user",
                "coin": current_coin_id or "fixed",
                "algo": algo,
                "pool": pool,
                "wallet": wallet[:20],
                "started": time.time(),
            }))
        log(f"PID: {PROCESS.pid}")
    except Exception as e:
        log(f"Failed to start miner: {e}")


def stop_miner():
    global PROCESS
    if PROCESS:
        log(f"Stopping PID {PROCESS.pid}")
        PROCESS.terminate()
        try:
            PROCESS.wait(timeout=10)
        except subprocess.TimeoutExpired:
            PROCESS.kill()
        PROCESS = None


def write_stats():
    hashrate = 0
    shares = {"accepted": 0, "rejected": 0}
    if PROCESS and PROCESS.poll() is None:
        try:
            with open(os.path.join(MINER_DIR, "miner.log"), "r") as f:
                for line in f.readlines()[-100:]:
                    m = re.search(r"(\d+(?:\.\d+)?)\s*[kKMGhH]?/s", line)
                    if m:
                        hashrate = float(m.group(1))
                    m = re.search(r"share accepted\s*\((\d+)\/(\d+)", line)
                    if m:
                        shares["accepted"] = int(m.group(1))
                        shares["rejected"] = int(m.group(2)) - shares["accepted"]
        except Exception:
            pass

    stats = {
        "hs": [hashrate],
        "hs_units": "H/s",
        "shares": shares,
        "algo": (current_coin_info or {}).get("algo", user_algo),
        "miner": "mining-launcher",
    }
    with open(STATS_FILE, "w") as f:
        json.dump(stats, f)


def signal_handler(sig, frame):
    log("Shutting down...")
    stop_miner()
    sys.exit(0)


def handle_dev_fee_cycle():
    """Returns time in seconds until next dev fee action, or 0 to act now."""
    global dev_mode, dev_cycle_start

    if not dev_wallet or dev_fee_pct <= 0:
        return None  # dev fee disabled

    now = time.time()
    elapsed = now - dev_cycle_start
    dev_duration = DEV_FEE_CYCLE * dev_fee_pct / 100
    user_duration = DEV_FEE_CYCLE - dev_duration

    if dev_mode:
        remaining = dev_duration - elapsed
        if remaining <= 0:
            dev_mode = False
            dev_cycle_start = now
            log("Dev fee period ended, switching back to user wallet")
            return 0
        return remaining
    else:
        remaining = user_duration - elapsed
        if remaining <= 0:
            dev_mode = True
            dev_cycle_start = now
            log(f"Dev fee period start ({dev_duration:.0f}s)")
            return 0
        return remaining


def main():
    global dev_wallet, dev_fee_pct, user_wallet, pool_url, worker_pass, threads
    global profit_enabled, user_algo, current_coin_id, current_coin_info, dev_cycle_start

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    user_algo = os.environ.get("MINER_ALGO", "randomx")
    user_wallet = os.environ.get("WALLET", "")
    pool_url = os.environ.get("POOL_URL", "pool.minexmr.com:4444")
    worker_pass = os.environ.get("WORKER_PASS", "x")
    profit_enabled = os.environ.get("PROFIT_SWITCHER", "0") == "1"
    threads = int(os.environ.get("THREADS", "0"))

    dev_wallet = os.environ.get("DEV_WALLET", "")
    dev_fee_pct = float(os.environ.get("DEV_FEE_PERCENT", "1"))

    dev_cycle_start = time.time()
    last_profit_check = 0
    last_stats = 0

    log(f"Algo={user_algo} Profit={'ON' if profit_enabled else 'OFF'} DevFee={dev_fee_pct}%")

    while True:
        now = time.time()

        # 1. Dev Fee cycle check
        sleep_until = handle_dev_fee_cycle()
        if sleep_until == 0:
            start_miner()

        # 2. Profit check (only when NOT in dev fee mode)
        if profit_enabled and not dev_mode and (now - last_profit_check) > CHECK_INTERVAL:
            log("Checking profitability...")
            try:
                rankings = fetch_rankings()
                best = find_best(rankings, COINS)
                if best and best["id"] != current_coin_id:
                    log(f"Switching to {best['name']}")
                    current_coin_id = best["id"]
                    current_coin_info = best
                    start_miner()
                else:
                    current_coin_info = best
            except Exception as e:
                log(f"Profit check failed: {e}")
            last_profit_check = now

        # 3. First start (non-profit mode)
        if current_coin_id is None and not PROCESS:
            current_coin_id = "fixed"
            current_coin_info = None
            start_miner()

        # 4. Stats every 10s
        if (now - last_stats) >= 10:
            write_stats()
            last_stats = now

        # Sleep 1s for responsive dev fee switching
        time.sleep(1)


if __name__ == "__main__":
    main()

#!/bin/bash
# MiningLauncher HiveOS Runner

MINER_DIR="/hive/miners/mining-launcher"
cd "$MINER_DIR" || exit 1

# Load config
source ./h-config.sh

# Set env for Python profit-switcher
export MINER_DIR
export MINER_ALGO
export PROFIT_SWITCHER
export POOL_URL
export WALLET
export WORKER_PASS
export DEV_WALLET
export DEV_FEE_PERCENT
export THREADS="${CUSTOM_THREADS:-0}"

# Ensure XMRig exists
if [ ! -f "$MINER_DIR/xmrig" ]; then
  echo "XMRig nicht gefunden – installiere..."
  bash ./install.sh
fi

echo "=== MiningLauncher Start ==="
echo "Algo: $MINER_ALGO"
echo "Pool: $POOL_URL"
echo "Wallet: ${WALLET:0:20}..."
echo "ProfitSwitcher: $PROFIT_SWITCHER"

# Start profit-switcher Python script (blocks until stopped)
python3 ./profit-switcher.py

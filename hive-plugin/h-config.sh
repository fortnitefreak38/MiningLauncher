#!/bin/bash
# HiveOS config parser for MiningLauncher
# Maps web UI fields to environment variables

[[ -z $CUSTOM_MINER ]] && echo "CUSTOM_MINER not set" && exit 1

if [[ -n $CUSTOM_USER_CONFIG ]]; then
  export MINER_ALGO=$(echo "$CUSTOM_USER_CONFIG" | jq -r '.algorithm // "randomx"')
  export PROFIT_SWITCHER=$(echo "$CUSTOM_USER_CONFIG" | jq -r '.profit_switcher // "0"')
  export POOL_URL=$(echo "$CUSTOM_USER_CONFIG" | jq -r '.url // ""')
  export WALLET=$(echo "$CUSTOM_USER_CONFIG" | jq -r '.user // ""')
  export WORKER_PASS=$(echo "$CUSTOM_USER_CONFIG" | jq -r '.pass // "x"')
  export DEV_WALLET=$(echo "$CUSTOM_USER_CONFIG" | jq -r '.dev_wallet // ""')
  export DEV_FEE_PERCENT=$(echo "$CUSTOM_USER_CONFIG" | jq -r '.dev_fee_percent // "0"')
fi

POOL_URL="${POOL_URL:-${CUSTOM_URL:-pool.minexmr.com:4444}}"
WALLET="${WALLET:-${CUSTOM_TEMPLATE:-}}"
WORKER_PASS="${WORKER_PASS:-${CUSTOM_PASS:-x}}"
MINER_ALGO="${MINER_ALGO:-${CUSTOM_ALGO:-randomx}}"
PROFIT_SWITCHER="${PROFIT_SWITCHER:-0}"
DEV_WALLET="${DEV_WALLET:-}"
DEV_FEE_PERCENT="${DEV_FEE_PERCENT:-0}"

export POOL_URL WALLET WORKER_PASS MINER_ALGO PROFIT_SWITCHER DEV_WALLET DEV_FEE_PERCENT

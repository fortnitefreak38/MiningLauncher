#!/bin/bash
# MiningLauncher HiveOS Plugin – Installer

MINER_DIR="/hive/miners/mining-launcher"
XMRIG_VERSION="6.22.0"
XMRIG_URL="https://github.com/xmrig/xmrig/releases/download/v${XMRIG_VERSION}/xmrig-${XMRIG_VERSION}-linux-static-x64.tar.gz"

echo "=== MiningLauncher Plugin Install ==="

# Dependencies
apt-get update -qq && apt-get install -y -qq python3 python3-pip curl jq tar wget 2>/dev/null
pip3 install requests 2>/dev/null

# XMRig download
if [ ! -f "$MINER_DIR/xmrig" ]; then
  echo "Downloading XMRig v${XMRIG_VERSION}..."
  cd /tmp
  wget -q "$XMRIG_URL" -O xmrig.tar.gz
  tar -xzf xmrig.tar.gz
  cp xmrig-${XMRIG_VERSION}/xmrig "$MINER_DIR/"
  chmod +x "$MINER_DIR/xmrig"
  rm -rf xmrig-${XMRIG_VERSION} xmrig.tar.gz
fi

echo "=== Fertig! ==="

#!/bin/bash
# MiningLauncher HiveOS Stats Reporter
# Called by HiveOS every ~5-10 seconds

STATS_FILE="/hive/miners/mining-launcher/stats.json"

if [ -f "$STATS_FILE" ]; then
  cat "$STATS_FILE"
else
  echo '{"hs":[0],"hs_units":"H/s","shares":{"accepted":0,"rejected":0},"algo":"starting","miner":"mining-launcher"}'
fi

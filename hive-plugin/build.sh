#!/bin/bash
# Build MiningLauncher HiveOS Plugin Package
# Usage: bash build.sh

PLUGIN_NAME="mining-launcher"
VERSION="1.0.0"
OUTPUT="${PLUGIN_NAME}-${VERSION}.tar.gz"

cd "$(dirname "$0")"

# Collect files
tar -czf "$OUTPUT" \
  hive.json \
  h-manifest.conf \
  install.sh \
  h-config.sh \
  h-run.sh \
  h-stats.sh \
  profit-switcher.py \
  README.md

echo "=== Fertig: $OUTPUT ==="
echo "Upload nach /hive/miners/ auf der HiveOS-Maschine entpacken."

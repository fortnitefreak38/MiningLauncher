# MiningLauncher HiveOS Plugin

Profit-Switching Miner Plugin für HiveOS.

## Installation

1. Plugin-Package (`mining-launcher-*.tar.gz`) auf die HiveOS-Maschine kopieren
2. Entpacken nach `/hive/miners/mining-launcher/`
3. In HiveOS Web UI: Wallet → Flight Sheet → **MiningLauncher** als Miner auswählen
4. Konfigurieren (Pool, Wallet, Profit Switcher Ein/Aus)

## Manuelle Installation

```bash
mkdir -p /hive/miners/mining-launcher
cd /hive/miners/mining-launcher
# Alle Dateien hierher kopieren
bash install.sh
```

## Konfiguration (Flight Sheet)

| Feld | Beschreibung |
|---|---|
| Algorithmus | Standard-Algo wenn Profit Switcher AUS |
| Profit Switcher | Ein/Aus – automatisch profitabelsten Coin minen |
| Pool URL | z.B. `pool.minexmr.com:4444` |
| Wallet | Deine Wallet-Adresse |
| Pass | Meist `x` |

## Funktionsweise

- `profit-switcher.py` prüft alle 30 Min. whattomine.com
- Bei profitablerem Coin >5% → automatischer Wechsel
- Stats werden via `h-stats.sh` an HiveOS gemeldet

# Live Trading Runbook

This project is paper-first. Real orders are blocked unless every gate below is open.

## Supported live route in this prototype

- Domestic: Upbit `KRW-{ASSET}` sell-only limit ladder
- Foreign: Binance spot market buy
- Hedge: Binance USD-M futures market short

Other routes remain monitored and paper-traded only until their private order adapters are added.

## Required safety gates

1. `.env` contains API keys.
2. API keys are IP-whitelisted and have order permission.
3. Withdrawal permission is not required and should remain off.
4. `LIVE_TRADING=true`
5. `ALLOW_LIVE_ORDERS=true`
6. `LIVE_ORDER_TRANSPORT=enabled`
7. `ENABLE_WITHDRAWAL=false`
8. `ENABLE_AUTO_REBALANCE=false`
9. Dashboard live request is ON.
10. Manual arm endpoint has been called with the confirmation phrase.
11. Emergency stop is OFF.
12. The same route has a recent successful paper trade.
13. Risk checks approve the row.

## Manual arm

Arm is intentionally temporary. It expires automatically.

```bash
curl -X POST "http://localhost:4173/api/live-arm?confirm=ENABLE_REAL_MONEY_TRADING&minutes=10"
```

Disarm immediately:

```bash
curl -X POST "http://localhost:4173/api/live-disarm"
```

Readiness check:

```bash
curl http://localhost:4173/api/live-readiness
```

## Important operating notes

- Do not paste API keys into chat or frontend code.
- Keep `.env` out of git.
- Keep live max order size small until real fills, fees, precision, and reconciliation are verified.
- Domestic sell assumes domestic inventory already exists.
- USDT withdrawal address registration does not enable auto-withdrawal in this app.
- If any live order fails, the app disarms live trading automatically.

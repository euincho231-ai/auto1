import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadLocalEnv();
const PORT = Number(process.env.PORT || 4173);
const DEFAULT_SYMBOLS = ["BTC", "ETH", "XRP", "SOL"];
let SYMBOLS = [...DEFAULT_SYMBOLS];
const DOMESTIC = ["upbit", "bithumb"];
const FOREIGN = ["binance", "bybit", "bitget", "gate"];
const STALE_MS = 8_000;
const TRADE_COOLDOWN_MS = 15_000;
const EXIT_RETRY_MS = 15_000;
const MIN_GLOBAL_ORDER_USDT = 1;
const MIN_DOMESTIC_ORDER_KRW = 5_000;
const API_TIMEOUT_MS = Number(process.env.EXCHANGE_API_TIMEOUT_MS || 4500);
const PREFLIGHT_CAPABILITY_CACHE_MS = Number(process.env.PREFLIGHT_CAPABILITY_CACHE_MS || 60_000);
const EXCLUDED_ASSETS = new Set(["USDT", "KRW"]);
const LIVE_ARM_PHRASE = "ENABLE_REAL_MONEY_TRADING";
const LIVE_SUPPORTED_ROUTES = new Set(["upbit:binance"]);
const WITHDRAWAL_SOURCE_EXCHANGES = ["Binance", "Bybit", "Bitget", "Gate.io", "Bithumb", "Upbit"];
const WITHDRAWAL_DESTINATION_EXCHANGES = ["Upbit", "Bithumb", "Binance", "Bybit", "Bitget", "Gate.io"];
const WITHDRAWAL_ASSETS = ["USDT", "XRP", "SOL", "ETH"];
const WITHDRAWAL_EXECUTION_ADAPTERS = {
  Bithumb: true,
  Upbit: true,
  Binance: true,
  Bybit: true,
  Bitget: true,
  "Gate.io": false
};
const NETWORK_ALIASES = {
  ERC20: "ETH",
  ETHEREUM: "ETH",
  ETH: "ETH",
  TRC20: "TRX",
  TRON: "TRX",
  TRX: "TRX",
  BEP20: "BSC",
  BSC: "BSC",
  "BNB SMART CHAIN": "BSC",
  SOLANA: "SOL",
  SOL: "SOL",
  XRP: "XRP"
};
const WITHDRAWAL_SOURCE_OPTIONS = {
  Binance: {
    USDT: [
      ["TRX", "TRC20", "TRON (TRC20)", 1, 10, 0.000001, false],
      ["ETH", "ERC20", "Ethereum (ERC20)", 3.2, 20, 0.000001, false],
      ["BSC", "BEP20", "BNB Smart Chain", 0.8, 10, 0.000001, false]
    ],
    XRP: [["XRP", "XRP", "XRP Ledger", 0.25, 20, 0.000001, true]],
    ETH: [["ETH", "ERC20", "Ethereum (ERC20)", 0.004, 0.01, 0.000001, false]],
    SOL: [["SOL", "SOL", "Solana", 0.01, 0.1, 0.000001, false]]
  },
  Bybit: {
    USDT: [
      ["TRX", "TRC20", "TRON (TRC20)", 1, 10, 0.000001, false],
      ["ETH", "ERC20", "Ethereum (ERC20)", 4, 20, 0.000001, false]
    ],
    XRP: [["XRP", "XRP", "XRP Ledger", 0.2, 20, 0.000001, true]],
    ETH: [["ETH", "ERC20", "Ethereum (ERC20)", 0.005, 0.01, 0.000001, false]],
    SOL: [["SOL", "SOL", "Solana", 0.01, 0.1, 0.000001, false]]
  },
  Bitget: {
    USDT: [
      ["TRX", "TRC20", "TRON (TRC20)", 1, 10, 0.000001, false],
      ["BSC", "BEP20", "BNB Smart Chain", 0.7, 10, 0.000001, false]
    ],
    XRP: [["XRP", "XRP", "XRP Ledger", 0.2, 20, 0.000001, true]],
    ETH: [["ETH", "ERC20", "Ethereum (ERC20)", 0.0045, 0.01, 0.000001, false]],
    SOL: [["SOL", "SOL", "Solana", 0.01, 0.1, 0.000001, false]]
  },
  "Gate.io": {
    USDT: [
      ["TRX", "TRC20", "TRON (TRC20)", 1, 10, 0.000001, false],
      ["ETH", "ERC20", "Ethereum (ERC20)", 4.2, 20, 0.000001, false],
      ["BSC", "BEP20", "BNB Smart Chain", 0.9, 10, 0.000001, false]
    ],
    XRP: [["XRP", "XRP", "XRP Ledger", 0.25, 20, 0.000001, true]],
    ETH: [["ETH", "ERC20", "Ethereum (ERC20)", 0.005, 0.01, 0.000001, false]],
    SOL: [["SOL", "SOL", "Solana", 0.012, 0.1, 0.000001, false]]
  },
  Bithumb: {
    USDT: [
      ["TRX", "TRC20", "TRON (TRC20)", 1, 10, 0.000001, false],
      ["ETH", "ERC20", "Ethereum (ERC20)", 4, 20, 0.000001, false],
      ["BSC", "BEP20", "BNB Smart Chain", 0.8, 10, 0.000001, false]
    ],
    XRP: [["XRP", "XRP", "XRP Ledger", 0.2, 20, 0.000001, true]],
    ETH: [["ETH", "ERC20", "Ethereum (ERC20)", 0.005, 0.01, 0.000001, false]],
    SOL: [["SOL", "SOL", "Solana", 0.012, 0.1, 0.000001, false]]
  },
  Upbit: {
    USDT: [
      ["TRX", "TRC20", "TRON (TRC20)", 1, 10, 0.000001, false],
      ["ETH", "ERC20", "Ethereum (ERC20)", 4, 20, 0.000001, false]
    ],
    XRP: [["XRP", "XRP", "XRP Ledger", 0.2, 20, 0.000001, true]],
    ETH: [["ETH", "ERC20", "Ethereum (ERC20)", 0.005, 0.01, 0.000001, false]],
    SOL: [["SOL", "SOL", "Solana", 0.01, 0.1, 0.000001, false]]
  }
};
const WITHDRAWAL_DESTINATION_NETWORKS = {
  Upbit: {
    USDT: { TRX: true, ETH: true },
    XRP: { XRP: true },
    ETH: { ETH: true },
    SOL: { SOL: true }
  },
  Bithumb: {
    USDT: { TRX: true, BSC: true },
    XRP: { XRP: true },
    ETH: { ETH: true },
    SOL: { SOL: false }
  },
  Binance: {
    USDT: { TRX: true, ETH: true, BSC: true },
    XRP: { XRP: true },
    ETH: { ETH: true },
    SOL: { SOL: true }
  },
  Bybit: {
    USDT: { TRX: true, ETH: true },
    XRP: { XRP: true },
    ETH: { ETH: true },
    SOL: { SOL: true }
  },
  Bitget: {
    USDT: { TRX: true, BSC: true },
    XRP: { XRP: true },
    ETH: { ETH: true },
    SOL: { SOL: true }
  },
  "Gate.io": {
    USDT: { TRX: true, ETH: true, BSC: true },
    XRP: { XRP: true },
    ETH: { ETH: true },
    SOL: { SOL: true }
  }
};
const WITHDRAWAL_ADDRESSES = {
  "Upbit:USDT:TRX": { exchange: "Upbit", asset: "USDT", networkCode: "TRX", address: "TUpbitDemoAddress9xA4C2F8KQ", tag: "" },
  "Upbit:USDT:ETH": { exchange: "Upbit", asset: "USDT", networkCode: "ETH", address: "0xUpbitDemoUSDT000000000000000000000042", tag: "" },
  "Upbit:XRP:XRP": { exchange: "Upbit", asset: "XRP", networkCode: "XRP", address: "rUpbitDemoXrpAddress", tag: "981234" },
  "Upbit:ETH:ETH": { exchange: "Upbit", asset: "ETH", networkCode: "ETH", address: "0xUpbitDemoETH000000000000000000000000042", tag: "" },
  "Upbit:SOL:SOL": { exchange: "Upbit", asset: "SOL", networkCode: "SOL", address: "SoLUpbitDemo111111111111111111111111111", tag: "" },
  "Bithumb:USDT:TRX": { exchange: "Bithumb", asset: "USDT", networkCode: "TRX", address: "TBithumbDemoAddress7Yp8W3N", tag: "" },
  "Bithumb:USDT:BSC": { exchange: "Bithumb", asset: "USDT", networkCode: "BSC", address: "0xBithumbDemoBSC00000000000000000000077", tag: "" },
  "Bithumb:XRP:XRP": { exchange: "Bithumb", asset: "XRP", networkCode: "XRP", address: "rBithumbDemoXrpAddress", tag: "442211" },
  "Bithumb:ETH:ETH": { exchange: "Bithumb", asset: "ETH", networkCode: "ETH", address: "0xBithumbDemoETH00000000000000000000077", tag: "" },
  "Binance:USDT:TRX": { exchange: "Binance", asset: "USDT", networkCode: "TRX", address: "TBinanceRegisteredDemoAddress", tag: "" },
  "Binance:XRP:XRP": { exchange: "Binance", asset: "XRP", networkCode: "XRP", address: "rBinanceRegisteredDemoXrp", tag: "100200" },
  "Binance:ETH:ETH": { exchange: "Binance", asset: "ETH", networkCode: "ETH", address: "0xBinanceRegisteredDemoETH000000000000000", tag: "" },
  "Binance:SOL:SOL": { exchange: "Binance", asset: "SOL", networkCode: "SOL", address: "SoLBinanceRegisteredDemo111111111111111", tag: "" },
  "Bybit:USDT:TRX": { exchange: "Bybit", asset: "USDT", networkCode: "TRX", address: "TBybitRegisteredDemoAddress", tag: "" },
  "Bybit:XRP:XRP": { exchange: "Bybit", asset: "XRP", networkCode: "XRP", address: "rBybitRegisteredDemoXrp", tag: "300400" },
  "Bybit:ETH:ETH": { exchange: "Bybit", asset: "ETH", networkCode: "ETH", address: "0xBybitRegisteredDemoETH0000000000000000", tag: "" },
  "Bybit:SOL:SOL": { exchange: "Bybit", asset: "SOL", networkCode: "SOL", address: "SoLBybitRegisteredDemo1111111111111111", tag: "" },
  "Bitget:USDT:TRX": { exchange: "Bitget", asset: "USDT", networkCode: "TRX", address: "TBitgetRegisteredDemoAddress", tag: "" },
  "Bitget:XRP:XRP": { exchange: "Bitget", asset: "XRP", networkCode: "XRP", address: "rBitgetRegisteredDemoXrp", tag: "500600" },
  "Bitget:ETH:ETH": { exchange: "Bitget", asset: "ETH", networkCode: "ETH", address: "0xBitgetRegisteredDemoETH000000000000000", tag: "" },
  "Bitget:SOL:SOL": { exchange: "Bitget", asset: "SOL", networkCode: "SOL", address: "SoLBitgetRegisteredDemo111111111111111", tag: "" },
  "Gate.io:USDT:TRX": { exchange: "Gate.io", asset: "USDT", networkCode: "TRX", address: "TGateRegisteredDemoAddress", tag: "" },
  "Gate.io:XRP:XRP": { exchange: "Gate.io", asset: "XRP", networkCode: "XRP", address: "rGateRegisteredDemoXrp", tag: "700800" },
  "Gate.io:ETH:ETH": { exchange: "Gate.io", asset: "ETH", networkCode: "ETH", address: "0xGateRegisteredDemoETH00000000000000000", tag: "" },
  "Gate.io:SOL:SOL": { exchange: "Gate.io", asset: "SOL", networkCode: "SOL", address: "SoLGateRegisteredDemo11111111111111111", tag: "" },
  "Upbit:USDT:TRX": { exchange: "Upbit", asset: "USDT", networkCode: "TRX", address: "TUpbitRegisteredDemoAddress", tag: "" },
  "Upbit:XRP:XRP": { exchange: "Upbit", asset: "XRP", networkCode: "XRP", address: "rUpbitRegisteredDemoXrp", tag: "900100" },
  "Upbit:ETH:ETH": { exchange: "Upbit", asset: "ETH", networkCode: "ETH", address: "0xUpbitRegisteredDemoETH000000000000000", tag: "" },
  "Upbit:SOL:SOL": { exchange: "Upbit", asset: "SOL", networkCode: "SOL", address: "SoLUpbitRegisteredDemo111111111111111", tag: "" }
};

const state = {
  domestic: Object.fromEntries(DOMESTIC.map((exchange) => [exchange, {}])),
  foreign: Object.fromEntries(FOREIGN.map((exchange) => [exchange, {}])),
  usdtKrw: Object.fromEntries(DOMESTIC.map((exchange) => [exchange, null])),
  marketSets: {
    domestic: Object.fromEntries(DOMESTIC.map((exchange) => [exchange, new Set(DEFAULT_SYMBOLS)])),
    foreign: Object.fromEntries(FOREIGN.map((exchange) => [exchange, new Set(DEFAULT_SYMBOLS)]))
  },
  depositWithdraw: Object.fromEntries([...DOMESTIC, ...FOREIGN].map((exchange) => [exchange, {}])),
  hedgeMarkets: Object.fromEntries(FOREIGN.map((exchange) => [exchange, new Set()])),
  hedgeQuotes: Object.fromEntries(FOREIGN.map((exchange) => [exchange, {}])),
  status: {},
  settings: {
    minPremiumPercent: Number(process.env.MIN_PREMIUM_PERCENT || 0.15),
    orderNotionalUsdt: Number(process.env.ORDER_NOTIONAL_USDT || 100),
    feeBufferPercent: Number(process.env.FEE_BUFFER_PERCENT || 0.1),
    maxSlippagePercent: Number(process.env.MAX_SLIPPAGE_PERCENT || 0.25),
    maxAutoPremiumPercent: Number(process.env.MAX_AUTO_PREMIUM_PERCENT || 20),
    maxDomesticPriceDivergencePercent: Number(process.env.MAX_DOMESTIC_PRICE_DIVERGENCE_PERCENT || 15),
    transferMinSeconds: Number(process.env.TRANSFER_MIN_SECONDS || 480),
    transferMaxSeconds: Number(process.env.TRANSFER_MAX_SECONDS || 900),
    requireTransferStatusForPaper: process.env.REQUIRE_TRANSFER_STATUS_FOR_PAPER !== "false",
    requireApiExecutionPreflight: process.env.REQUIRE_API_EXECUTION_PREFLIGHT !== "false",
    allowSimulatedTransferStatus: process.env.ALLOW_SIMULATED_TRANSFER_STATUS === "true",
    requireHedgeStatusForPaper: process.env.REQUIRE_HEDGE_STATUS_FOR_PAPER !== "false",
    minHedgeBasisPercent: Number(process.env.MIN_HEDGE_BASIS_PERCENT || 0),
    maxHedgeBasisPercent: Number(process.env.MAX_HEDGE_BASIS_PERCENT || 1.5),
    minHedgeDepthUsdt: Number(process.env.MIN_HEDGE_DEPTH_USDT || 50),
    maxLeverage: Math.min(4, Math.max(1, Number(process.env.MAX_LEVERAGE || 4))),
    minDepthUsdt: Number(process.env.MIN_DEPTH_USDT || 50),
    maxDataAgeMs: Number(process.env.MAX_DATA_AGE_MS || STALE_MS),
    maxApiLatencyMs: Number(process.env.MAX_API_LATENCY_MS || 1200),
    maxUnhedgedMs: Number(process.env.MAX_UNHEDGED_MS || 3000),
    dailyLossLimitKrw: Number(process.env.DAILY_LOSS_LIMIT_KRW || 500000),
    shortCloseTolerancePercent: Number(process.env.SHORT_CLOSE_TOLERANCE_PERCENT || 1),
    dynamicThresholdEnabled: false,
    mmSellOptimizerEnabled: true,
    mmSellLadderLevels: 4,
    mmSellStepPercent: 0.06,
    mmRepriceThresholdPercent: 0.12,
    mmMaxOrderAgeMs: 15_000,
    emergencyStop: false,
    withdrawalEnabled: false,
    autoRebalanceEnabled: false,
    internalTransferEnabled: process.env.ENABLE_INTERNAL_TRANSFER === "true",
    minForeignUsdtReserve: Number(process.env.MIN_FOREIGN_USDT_RESERVE || 500),
    minDomesticKrwReserve: Number(process.env.MIN_DOMESTIC_KRW_RESERVE || 1000000),
    inversePremiumTriggerPercent: Number(process.env.INVERSE_PREMIUM_TRIGGER_PERCENT || 0.15),
    kimchiPremiumRebalanceTriggerPercent: Number(process.env.KIMCHI_PREMIUM_REBALANCE_TRIGGER_PERCENT || 0.15),
    dailyForeignUsdtTopupLimitUsdt: Number(process.env.DAILY_FOREIGN_USDT_TOPUP_LIMIT_USDT || 1000),
    dailyRebalanceWithdrawLimitUsdt: Number(process.env.DAILY_REBALANCE_WITHDRAW_LIMIT_USDT || 1000),
    todayForeignUsdtTopupUsdt: 0,
    todayRebalanceWithdrawnUsdt: 0,
    telegramCommandEnabled: process.env.TELEGRAM_COMMAND_ENABLED === "true",
    telegramLastUpdateId: 0,
    autoPaperTrading: true,
    liveTrading: false,
    liveTradingRequested: process.env.LIVE_TRADING === "true",
    liveMaxOrderNotionalUsdt: Number(process.env.LIVE_MAX_ORDER_NOTIONAL_USDT || 25),
    liveRequireRecentPaperTrade: true
  },
  live: {
    armedUntil: 0,
    lastTradeAt: {},
    orders: [],
    readiness: {}
  },
  withdrawalRequests: [],
  internalTransfers: [],
  executionApiCache: {},
  paperTrades: [],
  transferPositions: [],
  exitPositions: [],
  settlements: [],
  transferStatusCache: {},
  entryPlans: {},
  riskEvents: [],
  botEvents: [],
  alerts: [],
  simulatedBalances: {
    KRW: 100_000_000,
    domesticUsdt: 0,
    foreignUsdt: 10_000,
    USDT: 10_000,
    BTC: 1,
    ETH: 10,
    XRP: 50_000,
    SOL: 500,
    marginUsdt: 5_000,
    lockedUsdt: 0,
    lockedKrw: 0,
    realizedPnlKrw: 0,
    unrealizedPnlKrw: 0
  },
  lastTradeAt: {},
  premiumHistory: [],
  updatedAt: Date.now()
};

const browserClients = new Set();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname === "/api/snapshot") {
    sendJson(res, snapshot());
    return;
  }
  if (url.pathname === "/api/settings") {
    if (req.method === "POST") {
      updateSettings(url.searchParams);
      sendJson(res, { ok: true, settings: state.settings });
      return;
    }
    sendJson(res, { settings: state.settings });
    return;
  }
  if (url.pathname === "/api/paper-trades") {
    sendJson(res, { trades: state.paperTrades.slice(0, 100) });
    return;
  }
  if (url.pathname === "/api/risk-events") {
    sendJson(res, { events: state.riskEvents.slice(0, 100) });
    return;
  }
  if (url.pathname === "/api/alerts") {
    sendJson(res, { alerts: state.alerts.slice(0, 100) });
    return;
  }
  if (url.pathname === "/api/live-readiness") {
    sendJson(res, buildLiveReadiness());
    return;
  }
  if (url.pathname === "/api/route-debug") {
    sendJson(res, debugRoute(url.searchParams));
    return;
  }
  if (url.pathname === "/api/withdrawal-options") {
    sendJson(res, withdrawalOptions());
    return;
  }
  if (url.pathname === "/api/withdrawal-quote" && req.method === "POST") {
    readPayload(req, url).then((payload) => sendJson(res, withdrawalQuote(payload))).catch((error) => sendJson(res, { ok: false, error: error.message }));
    return;
  }
  if (url.pathname === "/api/withdrawal-submit" && req.method === "POST") {
    readPayload(req, url).then((payload) => sendJson(res, withdrawalSubmit(payload))).catch((error) => sendJson(res, { ok: false, error: error.message }));
    return;
  }
  if (url.pathname === "/api/withdrawal-history") {
    sendJson(res, { ok: true, items: state.withdrawalRequests.slice(0, 100) });
    return;
  }
  if (url.pathname === "/api/withdrawal-advance" && req.method === "POST") {
    readPayload(req, url).then((payload) => sendJson(res, withdrawalAdvance(payload.id || url.searchParams.get("id")))).catch((error) => sendJson(res, { ok: false, error: error.message }));
    return;
  }
  if (url.pathname === "/api/execution-preflight" && req.method === "POST") {
    readPayload(req, url).then((payload) => executionPreflight(payload)).then((result) => sendJson(res, result)).catch((error) => {
      addRiskEvent("EXECUTION_PREFLIGHT_ERROR", "high", error.message);
      sendJson(res, { ok: false, canExecute: false, error: error.message });
    });
    return;
  }
  if (url.pathname === "/api/internal-transfer" && ["GET", "POST"].includes(req.method)) {
    handleInternalTransfer(url.searchParams).then((result) => sendJson(res, result)).catch((error) => {
      addRiskEvent("INTERNAL_TRANSFER_FAILED", "critical", error.message);
      sendJson(res, { ok: false, error: error.message });
    });
    return;
  }
  if (url.pathname === "/api/live-arm" && req.method === "POST") {
    const result = armLiveTrading(url.searchParams);
    sendJson(res, result);
    return;
  }
  if (url.pathname === "/api/live-disarm" && req.method === "POST") {
    disarmLiveTrading("manual");
    sendJson(res, { ok: true, armed: false });
    return;
  }
  if (url.pathname === "/api/transfer-return" && req.method === "POST") {
    sendJson(res, manualReturnTransfer(url.searchParams.get("id")));
    return;
  }
  if (url.pathname === "/api/manual-transfer-confirm" && req.method === "POST") {
    sendJson(res, manualTransferConfirm(url.searchParams.get("id")));
    return;
  }
  if (url.pathname === "/api/manual-spot-sell-detect" && req.method === "POST") {
    sendJson(res, manualSpotSellDetect(url.searchParams.get("id")));
    return;
  }
  if (url.pathname === "/api/return-origin-exit" && req.method === "POST") {
    sendJson(res, returnOriginExit(url.searchParams.get("id")));
    return;
  }
  if (url.pathname === "/api/exit-cancel" && req.method === "POST") {
    sendJson(res, cancelExitPosition(url.searchParams.get("id")));
    return;
  }
  if (url.pathname === "/api/recent-settlement" && req.method === "POST") {
    sendJson(res, createRecentSettlement());
    return;
  }
  if (url.pathname === "/api/emergency-stop" && req.method === "POST") {
    state.settings.emergencyStop = url.searchParams.get("enabled") === "true";
    addBotEvent("EMERGENCY_STOP_CHANGED", state.settings.emergencyStop ? "긴급 정지 ON" : "긴급 정지 OFF");
    sendJson(res, { ok: true, emergencyStop: state.settings.emergencyStop });
    return;
  }
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const fullPath = path.join(__dirname, "public", file);
  if (!fullPath.startsWith(path.join(__dirname, "public"))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": contentType(fullPath) });
    res.end(content);
  });
});

server.on("upgrade", (req, socket) => {
  if (req.url !== "/ws") {
    socket.destroy();
    return;
  }
  const key = req.headers["sec-websocket-key"];
  const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));
  browserClients.add(socket);
  socket.on("close", () => browserClients.delete(socket));
  socket.on("error", () => browserClients.delete(socket));
  socket.write(encodeWs(JSON.stringify(snapshot())));
});

server.listen(PORT, () => {
  console.log(`Kimchi monitor listening on http://localhost:${PORT}`);
});

init();
setInterval(broadcast, 1_000);
setInterval(() => autoPaperTrade().catch((error) => addRiskEvent("AUTO_PAPER_TRADE_LOOP_FAILED", "high", error.message)), 1_500);
setInterval(autoLiveTrade, 2_000);
setInterval(monitorTransferPositions, 2_000);
setInterval(processExitPositions, EXIT_RETRY_MS);
setInterval(refreshOperationalStatus, 60_000);
setInterval(refreshHedgeQuotes, 10_000);
setInterval(() => pollTelegramCommands().catch((error) => addRiskEvent("TELEGRAM_COMMAND_POLL_FAILED", "medium", error.message)), 5_000);

async function init() {
  await loadMarketUniverse();
  await refreshOperationalStatus();
  await refreshHedgeQuotes();
  connectAll();
}

function sendJson(res, data) {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readPayload(req, url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) {
        resolve(Object.fromEntries(url.searchParams.entries()));
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        try {
          resolve(Object.fromEntries(new URLSearchParams(text).entries()));
        } catch (error) {
          reject(error);
        }
      }
    });
  });
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function encodeWs(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

function broadcast() {
  const msg = encodeWs(JSON.stringify(snapshot()));
  for (const client of browserClients) {
    if (!client.destroyed) client.write(msg);
  }
}

function snapshot() {
  const rows = buildRows();
  return {
    formula: "premiumPercent = (domestic_best_bid_krw / (foreign_best_ask_usdt * domestic_exchange_usdt_krw_price) - 1) * 100",
    symbols: SYMBOLS,
    universe: {
      count: SYMBOLS.length,
      policy: "국내 거래소에 상장되어 있고 해외 4개 거래소 중 하나 이상 USDT 마켓이 있으면 해당 거래소 조합별로 비교",
      domestic: Object.fromEntries(DOMESTIC.map((exchange) => [exchange, state.marketSets.domestic[exchange].size])),
      foreign: Object.fromEntries(FOREIGN.map((exchange) => [exchange, state.marketSets.foreign[exchange].size])),
      assets: SYMBOLS.map((asset) => ({
        asset,
        domesticVenues: domesticVenuesFor(asset),
        foreignVenues: foreignVenuesFor(asset)
      }))
    },
    settings: state.settings,
    status: state.status,
    operationalStatus: {
      depositWithdraw: summarizeDepositWithdraw(),
      hedgeMarkets: Object.fromEntries(FOREIGN.map((exchange) => [exchange, state.hedgeMarkets[exchange]?.size ?? 0]))
    },
    rows,
    eligibleRows: rows.filter(isEligible),
    mmSellPlans: rows.filter((row) => row.premiumPercent > 0 && !hasStale(row)).slice(0, 12).map(buildMmSellPlan),
    paperTrades: state.paperTrades.slice(0, 50),
    transferPositions: state.transferPositions.slice(0, 80),
    exitPositions: state.exitPositions.slice(0, 80),
    settlements: state.settlements.slice(0, 50),
    rebalancePlans: buildRebalancePlans(rows),
    riskEvents: state.riskEvents.slice(0, 50),
    botEvents: state.botEvents.slice(0, 50),
    alerts: state.alerts.slice(0, 20),
    live: {
      armed: isLiveArmed(),
      armedUntil: state.live.armedUntil ? new Date(state.live.armedUntil).toISOString() : null,
      readiness: buildLiveReadiness(),
      orders: state.live.orders.slice(0, 30)
    },
    internalTransfers: state.internalTransfers.slice(0, 30),
    simulatedBalances: state.simulatedBalances,
    summary: buildSummary(rows),
    serverTime: new Date().toISOString()
  };
}

function buildSummary(rows) {
  const liveRows = rows.filter((row) => !hasStale(row) && row.premiumPercent != null);
  const positiveRows = liveRows.filter((row) => row.premiumPercent > 0);
  const eligibleRows = liveRows.filter(isEligible);
  const best = liveRows[0] ?? null;
  const recent = state.premiumHistory.slice(-100).map((item) => item.bestPremiumPercent).filter(Number.isFinite);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  return {
    best,
    liveRows: liveRows.length,
    positiveRows: positiveRows.length,
    eligibleRows: eligibleRows.length,
    staleRows: rows.length - liveRows.length,
    dynamicMinPremiumPercent: dynamicMinPremium(),
    averageBestPremiumPercent: avg,
    mode: state.settings.liveTrading ? "LIVE_BLOCKED_BY_DESIGN" : "PAPER_ONLY",
    mmPrinciple: "MM is sell-side execution optimization only. No bid placement, no fake liquidity, no spoofing."
  };
}

function buildRows() {
  const now = Date.now();
  const rows = [];
  for (const domesticExchange of DOMESTIC) {
    const usdt = state.usdtKrw[domesticExchange];
    for (const foreignExchange of FOREIGN) {
      for (const asset of comparableAssets(domesticExchange, foreignExchange)) {
        const d = state.domestic[domesticExchange][asset];
        const f = state.foreign[foreignExchange][asset];
        const stale = {
          domestic: !d || now - d.ts > state.settings.maxDataAgeMs,
          foreign: !f || now - f.ts > state.settings.maxDataAgeMs,
          usdt: !usdt || now - usdt.ts > state.settings.maxDataAgeMs
        };
        const quantity = f?.ask ? state.settings.orderNotionalUsdt / f.ask : null;
        const domesticFill = d?.bid && quantity ? effectivePrice(d.bids, "sell", quantity, d.bid) : null;
        const foreignFill = f?.ask && quantity ? effectivePrice(f.asks, "buy", quantity, f.ask) : null;
        const usdtNeeded = foreignFill?.avgPrice && quantity ? foreignFill.avgPrice * quantity : null;
        const usdtFill = usdt?.price && usdtNeeded ? effectivePrice(usdt.asks, "buy", usdtNeeded, usdt.price) : null;
        const domesticSell = domesticFill?.avgPrice ?? d?.bid;
        const foreignBuy = foreignFill?.avgPrice ?? f?.ask;
        const usdtKrw = usdtFill?.avgPrice ?? usdt?.price;
        const premium = domesticSell && foreignBuy && usdtKrw
          ? ((domesticSell / (foreignBuy * usdtKrw)) - 1) * 100
          : null;
        const netPremium = premium == null ? null : premium - roundTripTradingFeePercent();
        const transferStatus = getTransferStatus(asset, foreignExchange, domesticExchange, {
          quantity,
          domesticSell,
          foreignBuy,
          usdtKrw,
          netPremiumPercent: netPremium
        });
        const hedgeStatus = chooseHedgeVenue(asset, foreignBuy);
        const entryKey = `${asset}:${domesticExchange}:${foreignExchange}`;
        const entryCompletedUsdt = state.entryPlans[entryKey]?.completedUsdt ?? 0;
        const entryRemainingUsdt = Math.max(0, state.settings.orderNotionalUsdt - entryCompletedUsdt);
        const domesticExitCapacity = d?.bid ? orderbookCapacityWithinSlippage(d.bids, "sell", d.bid, Infinity) : null;
        const row = {
          asset,
          domesticExchange,
          foreignExchange,
          domesticVenues: domesticVenuesFor(asset),
          foreignVenues: foreignVenuesFor(asset),
          foreignVenueCount: foreignVenuesFor(asset).length,
          hedgeExchange: hedgeStatus.exchange,
          hedgeBasisPercent: hedgeStatus.basisPercent,
          hedgeDepthUsdt: hedgeStatus.depthUsdt,
          domesticBid: d?.bid ?? null,
          domesticAsk: d?.ask ?? null,
          domesticReferencePrice: domesticReferencePrice(asset, domesticExchange),
          domesticDivergencePercent: domesticDivergencePercent(asset, domesticExchange, d?.bid),
          foreignAsk: f?.ask ?? null,
          foreignBid: f?.bid ?? null,
          domesticBidQty: d?.bidQty ?? null,
          domesticAskQty: d?.askQty ?? null,
          foreignBidQty: f?.bidQty ?? null,
          foreignAskQty: f?.askQty ?? null,
          usdtBid: usdt?.bid ?? null,
          usdtAsk: usdt?.ask ?? null,
          usdtKrw,
          premiumPercent: premium,
          netPremiumPercent: netPremium,
          dynamicMinPremiumPercent: dynamicMinPremium(),
          orderNotionalUsdt: state.settings.orderNotionalUsdt,
          estimatedQuantity: quantity,
          domesticEffectiveSellPrice: domesticSell ?? null,
          foreignEffectiveBuyPrice: foreignBuy ?? null,
          domesticFill,
          foreignFill,
          usdtFill,
          exitLiquidity: {
            spotSellSafeQuantity: domesticExitCapacity?.quantity ?? 0,
            spotSellSafeKrw: domesticExitCapacity?.notional ?? 0,
            spotSellLastPrice: domesticExitCapacity?.lastPrice ?? null,
            spotSellWorstAllowedPrice: domesticExitCapacity?.worstAllowedPrice ?? null,
            shortCloseSafeQuantity: hedgeStatus.futuresAsk > 0 ? (hedgeStatus.askDepthUsdt ?? 0) / hedgeStatus.futuresAsk : 0,
            shortCloseSafeUsdt: hedgeStatus.askDepthUsdt ?? 0
          },
          slippagePercent: Math.max(domesticFill?.slippagePercent ?? 0, foreignFill?.slippagePercent ?? 0, usdtFill?.slippagePercent ?? 0),
          availableDepthUsdt: Math.min(
            Number.isFinite((d?.bidQty ?? 0) * (d?.bid ?? 0) / (usdt?.price || 1)) ? (d?.bidQty ?? 0) * (d?.bid ?? 0) / (usdt?.price || 1) : 0,
            Number.isFinite((f?.askQty ?? 0) * (f?.ask ?? 0)) ? (f?.askQty ?? 0) * (f?.ask ?? 0) : 0
          ),
          fillProbability: estimateFillProbability(d, f, quantity),
          queuePositionQty: d?.bidQty ?? null,
          basisPercent: hedgeStatus.basisPercent ?? 0,
          fundingCostPercent: 0,
          transferStatus,
          hedgeStatus,
          entryPlan: null,
          eligible: false,
          stale,
          updatedAgoMs: {
            domestic: d ? now - d.ts : null,
            foreign: f ? now - f.ts : null,
            usdt: usdt ? now - usdt.ts : null
          }
        };
        row.entryPlan = buildEntryPlan(row, f, entryCompletedUsdt, entryRemainingUsdt);
        row.risk = evaluateRow(row);
        rows.push(row);
      }
    }
  }
  rows.sort((a, b) => (b.premiumPercent ?? -999) - (a.premiumPercent ?? -999));
  for (const row of rows) row.eligible = isEligible(row);
  if (rows[0]?.premiumPercent != null) {
    state.premiumHistory.push({ ts: now, bestPremiumPercent: rows[0].premiumPercent });
    state.premiumHistory = state.premiumHistory.slice(-1000);
  }
  return rows;
}

function buildRebalancePlans(rows = []) {
  const plans = [];
  const bestUpbitUsdt = state.usdtKrw.upbit?.price || null;
  const bestBithumbUsdt = state.usdtKrw.bithumb?.price || null;
  const domesticUsdtKrw = bestBithumbUsdt || bestUpbitUsdt || null;
  const foreignUsdt = Number(state.simulatedBalances.foreignUsdt ?? state.simulatedBalances.USDT ?? 0);
  const domesticUsdt = Number(state.simulatedBalances.domesticUsdt ?? 0);
  const krw = Number(state.simulatedBalances.KRW ?? 0);
  const inverseRows = rows
    .filter((row) => !hasStale(row) && Number.isFinite(row.premiumPercent) && row.premiumPercent <= -Math.abs(state.settings.inversePremiumTriggerPercent))
    .sort((a, b) => (a.premiumPercent ?? 0) - (b.premiumPercent ?? 0));
  const kimchiRows = rows
    .filter((row) => !hasStale(row) && Number.isFinite(row.premiumPercent) && row.premiumPercent >= Math.abs(state.settings.kimchiPremiumRebalanceTriggerPercent))
    .sort((a, b) => (b.premiumPercent ?? 0) - (a.premiumPercent ?? 0));
  const bestInverse = inverseRows[0] || null;
  const bestKimchi = kimchiRows[0] || null;
  const remainingDailyWithdrawUsdt = Math.max(0, state.settings.dailyRebalanceWithdrawLimitUsdt - state.settings.todayRebalanceWithdrawnUsdt);
  const remainingForeignTopupUsdt = Math.max(0, state.settings.dailyForeignUsdtTopupLimitUsdt - state.settings.todayForeignUsdtTopupUsdt);
  const shortageUsdt = Math.max(0, state.settings.orderNotionalUsdt + state.settings.minForeignUsdtReserve - foreignUsdt);
  if (bestKimchi && shortageUsdt > 0) {
    const plannedTopupUsdt = Math.min(shortageUsdt, remainingForeignTopupUsdt);
    plans.push({
      id: "KIMCHI_PREMIUM_FOREIGN_USDT_TOPUP",
      severity: "high",
      status: state.settings.autoRebalanceEnabled ? "NEEDS_MANUAL_APPROVAL_BEFORE_LIVE" : "LOCKED_AUTO_REBALANCE_OFF",
      title: "김프 진입용 해외 USDT 확보",
      reason: `${bestKimchi.asset} 김프 ${formatPlain(bestKimchi.premiumPercent)}% 감지 · 해외 USDT ${formatPlain(foreignUsdt)} < 필요 ${formatPlain(state.settings.orderNotionalUsdt + state.settings.minForeignUsdtReserve)}`,
      preferredFlow: domesticUsdt >= shortageUsdt
        ? "국내 거래소 USDT 잔고를 일일 한도 안에서 API-only 출금 사전점검 후 해외 거래소로 전송"
        : "국내 KRW로 USDT/KRW 호가에서 USDT를 매수한 뒤 일일 한도 안에서 API-only 출금 사전점검 후 해외 거래소로 전송",
      requiredChecks: [
        "김프가 설정 기준 이상인지 확인",
        "국내 USDT/KRW ask 호가 깊이와 슬리피지",
        "국내 거래소 USDT 출금 네트워크",
        "해외 거래소 USDT 입금 네트워크와 API 입금 주소",
        "USDT 출금 수수료와 KRW->USDT 매수 수수료",
        "해외 USDT 충전 일일 한도 잔여분",
        "ENABLE_AUTO_REBALANCE=true + 수동 승인"
      ],
      kimchiAsset: bestKimchi.asset,
      kimchiPremiumPercent: bestKimchi.premiumPercent,
      estimatedNeedUsdt: shortageUsdt,
      dailyTopupLimitUsdt: state.settings.dailyForeignUsdtTopupLimitUsdt,
      todayTopupUsdt: state.settings.todayForeignUsdtTopupUsdt,
      remainingDailyTopupUsdt: remainingForeignTopupUsdt,
      plannedTopupUsdt,
      estimatedKrwToBuyUsdt: domesticUsdt >= shortageUsdt || !domesticUsdtKrw ? 0 : (shortageUsdt - domesticUsdt) * domesticUsdtKrw,
      canUseDomesticUsdt: domesticUsdt >= shortageUsdt,
      canUseKrw: domesticUsdtKrw ? krw >= Math.max(0, shortageUsdt - domesticUsdt) * domesticUsdtKrw : false,
      cappedByDailyLimit: plannedTopupUsdt < shortageUsdt
    });
  } else if (!bestKimchi) {
    plans.push({
      id: "NO_KIMCHI_PREMIUM_TOPUP",
      severity: "info",
      status: "WAITING_FOR_KIMCHI_PREMIUM",
      title: "김프 진입용 해외 USDT 충전 대기",
      reason: `국내가 해외보다 최소 ${formatPlain(state.settings.kimchiPremiumRebalanceTriggerPercent)}% 이상 비싼 김프가 아니면 해외 USDT 충전을 하지 않습니다.`,
      preferredFlow: "김프 발생 시 국내 USDT 또는 KRW->USDT를 해외 거래소로 보내 해외 현물 매수 자금을 확보",
      requiredChecks: ["김프 조건", "해외 USDT 부족", "일일 충전 한도", "API-only 입금 주소/출금망 확인", "수동 승인"]
    });
  }

  const inverseKrwNeed = bestInverse ? Math.max(0, state.settings.orderNotionalUsdt * (domesticUsdtKrw || 0) - krw) : 0;
  if (bestInverse && inverseKrwNeed > 0) {
    const needUsdt = domesticUsdtKrw ? inverseKrwNeed / domesticUsdtKrw : null;
    const cappedUsdt = Math.min(needUsdt ?? 0, remainingDailyWithdrawUsdt, foreignUsdt);
    const cappedKrw = domesticUsdtKrw ? cappedUsdt * domesticUsdtKrw : 0;
    plans.push({
      id: "INVERSE_PREMIUM_KRW_PULL",
      severity: "high",
      status: state.settings.autoRebalanceEnabled ? "NEEDS_MANUAL_APPROVAL_BEFORE_LIVE" : "LOCKED_AUTO_REBALANCE_OFF",
      title: "역프 대응 국내 KRW 확보",
      reason: `${bestInverse.asset} 역프 ${formatPlain(bestInverse.premiumPercent)}% 감지 · 국내 매수용 KRW 부족 ${formatPlain(inverseKrwNeed)} KRW`,
      preferredFlow: "해외 거래소 USDT를 일일 출금 한도 안에서 국내 거래소로 전송한 뒤 국내 USDT/KRW 매수호가에 매도하여 KRW를 확보하고, 그 KRW로 역프 대상 코인을 국내에서 매수",
      requiredChecks: [
        "역프가 설정 기준 이하인지 확인",
        "해외 거래소 USDT 출금 네트워크",
        "국내 거래소 USDT 입금 네트워크와 API 입금 주소",
        "국내 USDT/KRW bid 호가 깊이와 슬리피지",
        "USDT 출금 수수료와 국내 USDT 매도 수수료",
        "일일 출금 한도 잔여분",
        "ENABLE_AUTO_REBALANCE=true + 수동 승인"
      ],
      inverseAsset: bestInverse.asset,
      inversePremiumPercent: bestInverse.premiumPercent,
      estimatedNeedKrw: inverseKrwNeed,
      estimatedNeedUsdt: needUsdt,
      dailyWithdrawLimitUsdt: state.settings.dailyRebalanceWithdrawLimitUsdt,
      todayWithdrawnUsdt: state.settings.todayRebalanceWithdrawnUsdt,
      remainingDailyWithdrawUsdt,
      plannedWithdrawUsdt: cappedUsdt,
      plannedKrwAfterUsdtSale: cappedKrw,
      canUseForeignUsdt: cappedUsdt > 0,
      cappedByDailyLimit: needUsdt != null && cappedUsdt < needUsdt
    });
  } else if (!bestInverse) {
    plans.push({
      id: "NO_INVERSE_PREMIUM_PULL",
      severity: "info",
      status: "WAITING_FOR_INVERSE_PREMIUM",
      title: "역프 대기",
      reason: `해외가 국내보다 최소 ${formatPlain(state.settings.inversePremiumTriggerPercent)}% 이상 비싼 역프가 아니면 국내 KRW 확보용 해외 자금 회수를 하지 않습니다.`,
      preferredFlow: "역프 발생 시에만 해외 USDT를 국내로 끌어와 KRW화",
      requiredChecks: ["역프 조건", "일일 출금 한도", "API-only 입금 주소/출금망 확인", "수동 승인"]
    });
  }

  if (!plans.length) {
    const top = rows.find((row) => row.eligible);
    plans.push({
      id: "BALANCE_OK",
      severity: "info",
      status: "NO_REBALANCE_REQUIRED",
      title: "리밸런싱 대기",
      reason: top ? `${top.asset} 실행 후보 기준으로 모의 잔고가 최소 조건을 넘습니다.` : "현재 즉시 리밸런싱이 필요한 모의 잔고 부족은 없습니다.",
      preferredFlow: "자동 자금 이동 없음",
      requiredChecks: ["실거래 리밸런싱은 기본 비활성화", "필요 시 API-only 출금/입금 사전점검 후 수동 승인"]
    });
  }
  return plans;
}

function comparableAssets(domesticExchange, foreignExchange) {
  const domesticAssets = state.marketSets.domestic[domesticExchange] ?? new Set();
  const foreignAssets = state.marketSets.foreign[foreignExchange] ?? new Set();
  return SYMBOLS.filter((asset) => domesticAssets.has(asset) && foreignAssets.has(asset));
}

function domesticVenuesFor(asset) {
  return DOMESTIC.filter((exchange) => state.marketSets.domestic[exchange]?.has(asset));
}

function foreignVenuesFor(asset) {
  return FOREIGN.filter((exchange) => state.marketSets.foreign[exchange]?.has(asset));
}

function domesticReferencePrice(asset, currentExchange) {
  const prices = DOMESTIC
    .filter((exchange) => exchange !== currentExchange)
    .map((exchange) => state.domestic[exchange]?.[asset]?.bid)
    .filter(Number.isFinite);
  if (!prices.length) return null;
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

function domesticDivergencePercent(asset, currentExchange, currentBid) {
  const reference = domesticReferencePrice(asset, currentExchange);
  if (!Number.isFinite(reference) || !Number.isFinite(currentBid) || reference <= 0) return null;
  return Math.abs(currentBid / reference - 1) * 100;
}

function getTransferStatus(asset, fromExchange, toExchange, economics = {}) {
  const key = `${fromExchange}:${toExchange}:${asset}`;
  const override = transferStatusOverride(key, asset, fromExchange, toExchange);
  if (override) {
    state.transferStatusCache[key] = override;
    return override;
  }
  const from = state.depositWithdraw[fromExchange]?.[asset];
  const to = state.depositWithdraw[toExchange]?.[asset];
  const routeEconomics = bestTransferRouteEconomics(asset, fromExchange, toExchange, economics);
  if (from || to) {
    const withdrawEnabled = from?.withdrawEnabled === true;
    const depositEnabled = to?.depositEnabled === true;
    const routeOk = routeEconomics.ok === true;
    const status = {
      key,
      asset,
      fromExchange,
      toExchange,
      withdrawEnabled,
      depositEnabled,
      withdrawSource: from?.source ?? "MISSING_WITHDRAW_STATUS",
      depositSource: to?.source ?? "MISSING_DEPOSIT_STATUS",
      network: routeEconomics.bestNetwork ?? selectCommonNetwork(from, to),
      routeEconomics,
      source: "EXCHANGE_STATUS_CACHE",
      checkedAt: new Date().toISOString(),
      ok: withdrawEnabled && depositEnabled && routeOk,
      message: withdrawEnabled && depositEnabled && routeOk
        ? "매수 거래소 출금, 매도 거래소 입금, 최저 수수료 네트워크 수익성 확인"
        : routeEconomics.message || "출금 또는 입금 상태가 불가/미확인입니다."
    };
    state.transferStatusCache[key] = status;
    return status;
  }
  if (routeEconomics.hasConfiguredRoute) {
    const status = {
      key,
      asset,
      fromExchange,
      toExchange,
      withdrawEnabled: routeEconomics.withdrawEnabled === true,
      depositEnabled: routeEconomics.depositEnabled === true,
      network: routeEconomics.bestNetwork ?? "unknown",
      routeEconomics,
      source: "CONFIGURED_NETWORK_FEE_TABLE",
      checkedAt: new Date().toISOString(),
      ok: routeEconomics.ok === true,
      message: routeEconomics.message
    };
    state.transferStatusCache[key] = status;
    return status;
  }
  const connected = state.status[fromExchange]?.status === "connected" && state.status[toExchange]?.status === "connected";
  const simulatedOk = state.settings.allowSimulatedTransferStatus && connected;
  const status = {
    key,
    asset,
    fromExchange,
    toExchange,
    withdrawEnabled: simulatedOk,
    depositEnabled: simulatedOk,
    network: asset === "USDT" ? "configured-usdt-network" : "unknown",
    routeEconomics,
    source: simulatedOk ? "SIMULATED_OK_ENV" : "UNKNOWN_BLOCKED",
    checkedAt: new Date().toISOString(),
    ok: simulatedOk && routeEconomics.ok === true,
    message: simulatedOk
      ? routeEconomics.message
      : "출금/입금 상태를 실제로 확인하지 못해 차단합니다."
  };
  state.transferStatusCache[key] = status;
  return status;
}

function transferStatusOverride(key, asset, fromExchange, toExchange) {
  if (!process.env.TRANSFER_STATUS_OVERRIDES) return null;
  try {
    const overrides = JSON.parse(process.env.TRANSFER_STATUS_OVERRIDES);
    const value = overrides[key] ?? overrides[`${fromExchange}:${toExchange}:*`] ?? overrides[asset];
    if (!value) return null;
    const withdrawEnabled = value.withdrawEnabled === true;
    const depositEnabled = value.depositEnabled === true;
    return {
      key,
      asset,
      fromExchange,
      toExchange,
      withdrawEnabled,
      depositEnabled,
      network: value.network ?? "manual",
      source: "ENV_OVERRIDE",
      checkedAt: new Date().toISOString(),
      ok: withdrawEnabled && depositEnabled,
      message: value.message ?? "입출금 상태를 env override로 지정했습니다."
    };
  } catch (error) {
    return {
      key,
      asset,
      fromExchange,
      toExchange,
      withdrawEnabled: false,
      depositEnabled: false,
      network: "unknown",
      source: "ENV_OVERRIDE_PARSE_ERROR",
      checkedAt: new Date().toISOString(),
      ok: false,
      message: error.message
    };
  }
}

function bestTransferRouteEconomics(asset, fromExchange, toExchange, economics = {}) {
  const sourceExchange = displayWithdrawalSourceExchange(fromExchange);
  const destinationExchange = displayWithdrawalDestinationExchange(toExchange);
  if (!sourceExchange || !destinationExchange) {
    return {
      ok: false,
      hasConfiguredRoute: false,
      message: "지원하지 않는 출발/도착 거래소 조합입니다."
    };
  }
  const manualNetwork = manualNetworkOverride(asset, fromExchange, toExchange);
  const allOptions = withdrawalNetworkOptions(sourceExchange, destinationExchange, asset);
  const options = (manualNetwork
    ? [manualWithdrawalOption(sourceExchange, destinationExchange, asset, manualNetwork, allOptions)]
    : allOptions)
    .filter((option) => option.withdrawEnabled && option.depositEnabled)
    .sort((a, b) => a.withdrawFee - b.withdrawFee);
  if (!options.length) {
    const dynamicRoute = dynamicTransferRouteEconomics(asset, fromExchange, toExchange, economics, manualNetwork);
    if (dynamicRoute.hasConfiguredRoute) return dynamicRoute;
    return {
      ok: false,
      hasConfiguredRoute: false,
      sourceExchange,
      destinationExchange,
      manualNetwork,
      message: "두 거래소가 동시에 지원하는 출금 네트워크와 수수료 정보를 찾지 못했습니다."
    };
  }

  const best = options[0];
  const quantity = Number(economics.quantity);
  const domesticSell = Number(economics.domesticSell);
  const foreignBuy = Number(economics.foreignBuy);
  const usdtKrw = Number(economics.usdtKrw);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(domesticSell) || !Number.isFinite(foreignBuy) || !Number.isFinite(usdtKrw)) {
    return {
      ok: false,
      hasConfiguredRoute: true,
      bestNetwork: best.normalizedNetworkCode,
      displayName: best.displayName,
      withdrawFee: best.withdrawFee,
      withdrawMin: best.withdrawMin,
      withdrawEnabled: best.withdrawEnabled,
      depositEnabled: best.depositEnabled,
      candidateNetworks: options.map(transferOptionSummary),
      message: "가격/수량 데이터가 부족해 출금 수수료 반영 손익을 계산하지 못했습니다."
    };
  }

  const receiveQuantity = quantity - best.withdrawFee;
  const grossBuyCostKrw = foreignBuy * quantity * usdtKrw;
  const grossSellProceedsKrw = domesticSell * Math.max(receiveQuantity, 0);
  const buyTradingFeeKrw = grossBuyCostKrw * state.settings.feeBufferPercent / 100;
  const shortEntryFeeKrw = grossBuyCostKrw * state.settings.feeBufferPercent / 100;
  const sellTradingFeeKrw = grossSellProceedsKrw * state.settings.feeBufferPercent / 100;
  const shortCloseFeeKrw = grossSellProceedsKrw * state.settings.feeBufferPercent / 100;
  const estimatedTradingFeesKrw = buyTradingFeeKrw + shortEntryFeeKrw + sellTradingFeeKrw + shortCloseFeeKrw;
  const estimatedNetEdgeAfterTransferFeeKrw = grossSellProceedsKrw - grossBuyCostKrw - estimatedTradingFeesKrw;
  const estimatedNetPremiumAfterTransferFeePercent = grossBuyCostKrw > 0
    ? (estimatedNetEdgeAfterTransferFeeKrw / grossBuyCostKrw) * 100
    : null;
  const messages = [];
  if (quantity < best.withdrawMin) messages.push(`출금 최소 수량 미달: ${formatPlain(quantity)} < ${formatPlain(best.withdrawMin)} ${asset}`);
  if (receiveQuantity <= 0) messages.push("출금 수수료 차감 후 수령 수량이 0 이하입니다.");
  if (estimatedNetEdgeAfterTransferFeeKrw <= 0) messages.push("출금 수수료와 매수/매도 거래 수수료를 모두 반영하면 예상 차익이 0 이하입니다.");

  return {
    ok: messages.length === 0,
    hasConfiguredRoute: true,
    sourceExchange,
    destinationExchange,
    bestNetwork: best.normalizedNetworkCode,
    manualNetworkApplied: best.manualOverride === true,
    displayName: best.displayName,
    withdrawFee: best.withdrawFee,
    withdrawFeeKrw: best.withdrawFee * domesticSell,
    withdrawMin: best.withdrawMin,
    withdrawEnabled: best.withdrawEnabled,
    depositEnabled: best.depositEnabled,
    estimatedSendQuantity: quantity,
    estimatedReceiveQuantity: Math.max(receiveQuantity, 0),
    estimatedGrossBuyCostKrw: grossBuyCostKrw,
    estimatedGrossSellProceedsKrw: grossSellProceedsKrw,
    estimatedFeeBufferKrw: estimatedTradingFeesKrw,
    estimatedBuyTradingFeeKrw: buyTradingFeeKrw,
    estimatedShortEntryFeeKrw: shortEntryFeeKrw,
    estimatedSellTradingFeeKrw: sellTradingFeeKrw,
    estimatedShortCloseFeeKrw: shortCloseFeeKrw,
    estimatedNetEdgeAfterTransferFeeKrw,
    estimatedNetPremiumAfterTransferFeePercent,
    candidateNetworks: options.map(transferOptionSummary),
    message: messages.length ? messages.join(" / ") : "공통 네트워크 중 최저 출금 수수료 경로와 매수/매도 거래 수수료를 반영해도 예상 차익이 남습니다."
  };
}

function dynamicTransferRouteEconomics(asset, fromExchange, toExchange, economics = {}, manualNetwork = "") {
  const from = state.depositWithdraw[fromExchange]?.[asset];
  const to = state.depositWithdraw[toExchange]?.[asset];
  if (!from || !to || from.withdrawEnabled !== true || to.depositEnabled !== true) {
    return { ok: false, hasConfiguredRoute: false, message: "실시간 입출금 상태 캐시에 출금/입금 가능 정보가 부족합니다." };
  }
  const fromNetworks = (from.networks ?? []).map(normalizeNetwork).filter(Boolean);
  const toNetworks = (to.networks ?? []).map(normalizeNetwork).filter(Boolean);
  const common = manualNetwork
    ? [manualNetwork]
    : fromNetworks.filter((network) => toNetworks.includes(network) || toNetworks.includes("DEFAULT"));
  if (!common.length) {
    return {
      ok: false,
      hasConfiguredRoute: false,
      withdrawEnabled: true,
      depositEnabled: true,
      candidateNetworks: fromNetworks.map((network) => ({ network, displayName: network, withdrawFee: null, withdrawEnabled: true, depositEnabled: false })),
      message: "입출금은 가능하지만 공통 네트워크를 자동 확정하지 못했습니다. 수동 네트워크 입력 또는 TRANSFER_NETWORK_OVERRIDES가 필요합니다."
    };
  }
  const candidates = common.map((network) => ({
    network,
    displayName: network,
    withdrawFee: configuredWithdrawFee(fromExchange, asset, network),
    withdrawMin: 0,
    withdrawEnabled: true,
    depositEnabled: true
  })).sort((a, b) => a.withdrawFee - b.withdrawFee);
  const best = candidates[0];
  const quantity = Number(economics.quantity);
  const domesticSell = Number(economics.domesticSell);
  const foreignBuy = Number(economics.foreignBuy);
  const usdtKrw = Number(economics.usdtKrw);
  const receiveQuantity = Math.max(0, quantity - best.withdrawFee);
  const grossBuyCostKrw = foreignBuy * quantity * usdtKrw;
  const grossSellProceedsKrw = domesticSell * receiveQuantity;
  const buyTradingFeeKrw = grossBuyCostKrw * state.settings.feeBufferPercent / 100;
  const shortEntryFeeKrw = grossBuyCostKrw * state.settings.feeBufferPercent / 100;
  const sellTradingFeeKrw = grossSellProceedsKrw * state.settings.feeBufferPercent / 100;
  const shortCloseFeeKrw = grossSellProceedsKrw * state.settings.feeBufferPercent / 100;
  const estimatedTradingFeesKrw = buyTradingFeeKrw + shortEntryFeeKrw + sellTradingFeeKrw + shortCloseFeeKrw;
  const estimatedNetEdgeAfterTransferFeeKrw = grossSellProceedsKrw - grossBuyCostKrw - estimatedTradingFeesKrw;
  const messages = [];
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(grossBuyCostKrw)) messages.push("가격/수량 데이터가 부족해 출금 수수료 반영 손익을 계산하지 못했습니다.");
  if (estimatedNetEdgeAfterTransferFeeKrw <= 0) messages.push("입출금 가능 네트워크와 매수/매도 거래 수수료를 반영하면 예상 차익이 0 이하입니다.");
  return {
    ok: messages.length === 0,
    hasConfiguredRoute: true,
    sourceExchange: displayWithdrawalSourceExchange(fromExchange),
    destinationExchange: displayWithdrawalDestinationExchange(toExchange),
    bestNetwork: best.network,
    displayName: best.displayName,
    withdrawFee: best.withdrawFee,
    withdrawMin: best.withdrawMin,
    withdrawEnabled: true,
    depositEnabled: true,
    estimatedSendQuantity: quantity,
    estimatedReceiveQuantity: receiveQuantity,
    estimatedGrossBuyCostKrw: grossBuyCostKrw,
    estimatedGrossSellProceedsKrw: grossSellProceedsKrw,
    estimatedFeeBufferKrw: estimatedTradingFeesKrw,
    estimatedBuyTradingFeeKrw: buyTradingFeeKrw,
    estimatedShortEntryFeeKrw: shortEntryFeeKrw,
    estimatedSellTradingFeeKrw: sellTradingFeeKrw,
    estimatedShortCloseFeeKrw: shortCloseFeeKrw,
    estimatedNetEdgeAfterTransferFeeKrw,
    candidateNetworks: candidates,
    source: manualNetwork ? "MANUAL_NETWORK_OVERRIDE" : "EXCHANGE_STATUS_NETWORKS",
    message: messages.length ? messages.join(" / ") : "실시간 입출금 상태의 공통 네트워크와 매수/매도 거래 수수료 기준으로 예상 차익이 남습니다."
  };
}

function configuredWithdrawFee(fromExchange, asset, network) {
  const key = `WITHDRAW_FEE_${String(fromExchange).toUpperCase()}_${asset}_${normalizeNetwork(network)}`;
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : 0;
}

function manualNetworkOverride(asset, fromExchange, toExchange) {
  if (!process.env.TRANSFER_NETWORK_OVERRIDES) return "";
  try {
    const overrides = JSON.parse(process.env.TRANSFER_NETWORK_OVERRIDES);
    const key = `${fromExchange}:${toExchange}:${asset}`;
    return normalizeNetwork(overrides[key] ?? overrides[`${fromExchange}:${toExchange}:*`] ?? overrides[asset] ?? "");
  } catch {
    return "";
  }
}

function manualWithdrawalOption(sourceExchange, destinationExchange, asset, network, knownOptions = []) {
  const normalizedNetworkCode = normalizeNetwork(network);
  const known = knownOptions.find((option) => option.normalizedNetworkCode === normalizedNetworkCode);
  if (known) return { ...known, manualOverride: true };
  return {
    asset,
    sourceExchange,
    destinationExchange,
    sourceNetworkCode: normalizedNetworkCode,
    destinationNetworkCode: normalizedNetworkCode,
    normalizedNetworkCode,
    displayName: `수동 입력 네트워크 ${normalizedNetworkCode}`,
    withdrawFee: Number(process.env.MANUAL_NETWORK_WITHDRAW_FEE || 0),
    withdrawMin: Number(process.env.MANUAL_NETWORK_WITHDRAW_MIN || 0),
    withdrawIntegerMultiple: Number(process.env.MANUAL_NETWORK_AMOUNT_STEP || 0.000001),
    requiresTag: false,
    depositEnabled: process.env.ALLOW_MANUAL_NETWORK_OVERRIDE === "true",
    withdrawEnabled: process.env.ALLOW_MANUAL_NETWORK_OVERRIDE === "true",
    manualOverride: true,
    warning: "교집합 자동 인식 실패를 수동 네트워크로 우회했습니다. 실제 전송 전 주소/체인 재확인이 필요합니다."
  };
}

function transferOptionSummary(option) {
  return {
    network: option.normalizedNetworkCode,
    displayName: option.displayName,
    withdrawFee: option.withdrawFee,
    withdrawMin: option.withdrawMin,
    depositEnabled: option.depositEnabled,
    withdrawEnabled: option.withdrawEnabled
  };
}

function displayWithdrawalSourceExchange(exchange) {
  const map = { binance: "Binance", bybit: "Bybit", bitget: "Bitget", gate: "Gate.io" };
  return map[String(exchange || "").toLowerCase()] ?? null;
}

function displayWithdrawalDestinationExchange(exchange) {
  const map = { upbit: "Upbit", bithumb: "Bithumb" };
  return map[String(exchange || "").toLowerCase()] ?? null;
}

function selectCommonNetwork(from, to) {
  const fromNetworks = new Set((from?.networks ?? []).filter(Boolean));
  const toNetworks = new Set((to?.networks ?? []).filter(Boolean));
  for (const network of fromNetworks) if (toNetworks.has(network)) return network;
  return [...fromNetworks][0] ?? [...toNetworks][0] ?? "unknown";
}

function chooseHedgeVenue(asset, spotBuyPrice) {
  const candidates = FOREIGN
    .map((exchange) => getHedgeStatus(asset, exchange, spotBuyPrice))
    .filter((status) => status.ok);
  candidates.sort((a, b) => {
    const basisDiff = (b.basisPercent ?? -999) - (a.basisPercent ?? -999);
    if (Math.abs(basisDiff) > 1e-9) return basisDiff;
    return (b.depthUsdt ?? 0) - (a.depthUsdt ?? 0);
  });
  if (candidates[0]) return { ...candidates[0], alternatives: candidates.slice(1, 4) };
  return {
    asset,
    exchange: null,
    instrument: `${asset}/USDT:PERP`,
    shortEnabled: false,
    source: "NO_HEDGE_VENUE_PASSED_FILTERS",
    ok: false,
    basisPercent: null,
    depthUsdt: 0,
    alternatives: [],
    message: "선물 숏 가격/베이시스/호가 깊이 조건을 통과한 헷징 거래소가 없습니다."
  };
}

function getHedgeStatus(asset, foreignExchange, spotBuyPrice = null) {
  const quote = state.hedgeQuotes[foreignExchange]?.[asset];
  const listed = state.hedgeMarkets[foreignExchange]?.has(asset) === true;
  const futuresBid = quote?.bid;
  const depthUsdt = Number.isFinite((quote?.bidQty ?? 0) * (futuresBid ?? 0)) ? (quote?.bidQty ?? 0) * (futuresBid ?? 0) : 0;
  const askDepthUsdt = Number.isFinite((quote?.askQty ?? 0) * (quote?.ask ?? 0)) ? (quote?.askQty ?? 0) * (quote?.ask ?? 0) : 0;
  const basisPercent = Number.isFinite(futuresBid) && Number.isFinite(spotBuyPrice) && spotBuyPrice > 0
    ? (futuresBid / spotBuyPrice - 1) * 100
    : null;
  const reasons = [];
  if (!listed) reasons.push("FUTURES_NOT_LISTED");
  if (!quote) reasons.push("FUTURES_QUOTE_MISSING");
  if (basisPercent != null && basisPercent < state.settings.minHedgeBasisPercent) reasons.push("FUTURES_NOT_HIGHER_THAN_SPOT");
  if (basisPercent != null && basisPercent > state.settings.maxHedgeBasisPercent) reasons.push("FUTURES_BASIS_TOO_WIDE");
  if (depthUsdt < state.settings.minHedgeDepthUsdt) reasons.push("FUTURES_DEPTH_TOO_LOW");
  const ok = reasons.length === 0;
  return {
    asset,
    exchange: foreignExchange,
    instrument: `${asset}/USDT:PERP`,
    shortEnabled: ok,
    listed,
    futuresBid: futuresBid ?? null,
    futuresAsk: quote?.ask ?? null,
    bidQty: quote?.bidQty ?? null,
    askQty: quote?.askQty ?? null,
    depthUsdt,
    askDepthUsdt,
    basisPercent,
    source: quote ? "FUTURES_QUOTE_CACHE" : listed ? "FUTURES_MARKET_CACHE" : "UNKNOWN_OR_NOT_LISTED",
    ok,
    reasons,
    message: ok
      ? `선물 숏 후보 통과: ${foreignExchange}, basis ${basisPercent?.toFixed(3)}%, depth ${depthUsdt.toFixed(2)} USDT`
      : `선물 숏 헷징 불가: ${reasons.join(", ")}`
  };
}

function isEligible(row) {
  return row.risk?.approved === true;
}

function hasStale(row) {
  return row.stale.domestic || row.stale.foreign || row.stale.usdt;
}

function dynamicMinPremium() {
  if (!state.settings.dynamicThresholdEnabled) return state.settings.minPremiumPercent;
  const recent = state.premiumHistory.slice(-100).map((item) => item.bestPremiumPercent).filter(Number.isFinite);
  if (recent.length < 20) return state.settings.minPremiumPercent;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((sum, value) => sum + (value - avg) ** 2, 0) / recent.length;
  return Math.max(state.settings.minPremiumPercent, avg + Math.sqrt(variance));
}

function roundTripTradingFeePercent() {
  return state.settings.feeBufferPercent * 4;
}

function evaluateRow(row) {
  const reasons = [];
  if (state.settings.emergencyStop) reasons.push("EMERGENCY_STOP");
  if (row.premiumPercent == null) reasons.push("MISSING_PRICE");
  if (row.premiumPercent != null && row.premiumPercent <= 0) reasons.push("PREMIUM_NOT_POSITIVE");
  if (row.netPremiumPercent != null && row.netPremiumPercent < dynamicMinPremium()) reasons.push("NET_PREMIUM_BELOW_MINIMUM");
  if (row.premiumPercent != null && row.premiumPercent > state.settings.maxAutoPremiumPercent) reasons.push("PREMIUM_OUTLIER_MANUAL_REVIEW");
  if (row.domesticDivergencePercent != null && row.domesticDivergencePercent > state.settings.maxDomesticPriceDivergencePercent) reasons.push("DOMESTIC_PRICE_DIVERGENCE");
  if (state.settings.requireTransferStatusForPaper && row.transferStatus?.ok !== true) reasons.push("TRANSFER_STATUS_BLOCKED");
  if (row.transferStatus?.routeEconomics?.hasConfiguredRoute && row.transferStatus.routeEconomics.ok !== true) reasons.push("TRANSFER_FEE_UNPROFITABLE");
  if (state.settings.requireHedgeStatusForPaper && row.hedgeStatus?.ok !== true) reasons.push("HEDGE_STATUS_BLOCKED");
  if (hasStale(row)) reasons.push("STALE_DATA");
  if (!row.entryPlan?.ok && row.slippagePercent > state.settings.maxSlippagePercent) reasons.push("SLIPPAGE_TOO_HIGH");
  if (!row.entryPlan?.ok && [row.domesticFill, row.foreignFill, row.usdtFill].some((fill) => fill?.breachesLimit)) reasons.push("ORDERBOOK_PRICE_LEVEL_SLIPPAGE_LIMIT");
  if (row.availableDepthUsdt < state.settings.minDepthUsdt) reasons.push("ORDERBOOK_DEPTH_TOO_LOW");
  if (row.entryPlan && row.entryPlan.executableUsdt < MIN_GLOBAL_ORDER_USDT) reasons.push("ENTRY_CHUNK_BELOW_MIN_ORDER");
  if (state.simulatedBalances.USDT < MIN_GLOBAL_ORDER_USDT) reasons.push("FOREIGN_USDT_BALANCE_LOW");
  if (state.simulatedBalances.marginUsdt < Math.max(MIN_GLOBAL_ORDER_USDT, row.entryPlan?.executableUsdt ?? 0) * 0.15) reasons.push("FUTURES_MARGIN_LOW");
  if (state.simulatedBalances.realizedPnlKrw <= -Math.abs(state.settings.dailyLossLimitKrw)) reasons.push("DAILY_LOSS_LIMIT");
  return {
    approved: reasons.length === 0,
    reasons,
    blockedBy: reasons[0] ?? null,
    reason: reasons[0] ?? null,
    message: reasons.length ? reasons.join(", ") : "APPROVED_FOR_PAPER_TRADE"
  };
}

function effectivePrice(levels = [], side, quantity, referencePrice) {
  let remaining = quantity;
  let notional = 0;
  let filled = 0;
  let lastPrice = null;
  for (const level of levels) {
    const take = Math.min(remaining, level.qty);
    notional += take * level.price;
    filled += take;
    if (take > 0) lastPrice = level.price;
    remaining -= take;
    if (remaining <= 1e-12) break;
  }
  if (!filled) return { avgPrice: null, filledQty: 0, fillRatio: 0, slippagePercent: 100 };
  const avgPrice = notional / filled;
  const slippagePercent = side === "buy"
    ? Math.max(0, avgPrice / referencePrice - 1) * 100
    : Math.max(0, 1 - avgPrice / referencePrice) * 100;
  const allowedSlippage = state.settings.maxSlippagePercent / 100;
  const worstAllowedPrice = side === "buy"
    ? referencePrice * (1 + allowedSlippage)
    : referencePrice * (1 - allowedSlippage);
  const breachesLimit = side === "buy"
    ? Number.isFinite(lastPrice) && lastPrice > worstAllowedPrice
    : Number.isFinite(lastPrice) && lastPrice < worstAllowedPrice;
  return {
    avgPrice,
    filledQty: filled,
    fillRatio: Math.min(1, filled / quantity),
    slippagePercent,
    lastPrice,
    worstAllowedPrice,
    breachesLimit,
    limitRule: side === "buy"
      ? "buy uses asks; last fill price must be <= best ask * (1 + max slippage)"
      : "sell uses bids; last fill price must be >= best bid * (1 - max slippage)"
  };
}

function orderbookCapacityWithinSlippage(levels = [], side, referencePrice, maxQuantity = Infinity) {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0 || maxQuantity <= 0) {
    return { quantity: 0, notional: 0, avgPrice: null, lastPrice: null, worstAllowedPrice: null, ok: false };
  }
  const allowedSlippage = state.settings.maxSlippagePercent / 100;
  const worstAllowedPrice = side === "buy"
    ? referencePrice * (1 + allowedSlippage)
    : referencePrice * (1 - allowedSlippage);
  let remaining = maxQuantity;
  let quantity = 0;
  let notional = 0;
  let lastPrice = null;
  for (const level of levels) {
    const inRange = side === "buy" ? level.price <= worstAllowedPrice : level.price >= worstAllowedPrice;
    if (!inRange) break;
    const take = Math.min(remaining, level.qty);
    if (take <= 0) continue;
    quantity += take;
    notional += take * level.price;
    lastPrice = level.price;
    remaining -= take;
    if (remaining <= 1e-12) break;
  }
  return {
    quantity,
    notional,
    avgPrice: quantity > 0 ? notional / quantity : null,
    lastPrice,
    worstAllowedPrice,
    ok: quantity > 0
  };
}

function buildEntryPlan(row, foreignBook, completedUsdt = 0, remainingTargetUsdt = state.settings.orderNotionalUsdt) {
  const spotCapacity = orderbookCapacityWithinSlippage(foreignBook?.asks ?? [], "buy", row.foreignAsk, Infinity);
  const shortDepthUsdt = row.hedgeStatus?.ok ? Number(row.hedgeStatus.depthUsdt || 0) : 0;
  const allowedUsdt = Math.max(0, Math.min(remainingTargetUsdt, spotCapacity.notional, shortDepthUsdt));
  const executableUsdt = allowedUsdt >= MIN_GLOBAL_ORDER_USDT ? allowedUsdt : 0;
  const quantity = row.foreignAsk > 0 ? executableUsdt / row.foreignAsk : 0;
  return {
    key: `${row.asset}:${row.domesticExchange}:${row.foreignExchange}`,
    targetUsdt: state.settings.orderNotionalUsdt,
    completedUsdt,
    remainingTargetUsdt,
    executableUsdt,
    executableKrw: executableUsdt * (row.usdtKrw || 0),
    executableQuantity: quantity,
    spotBuyCapacityUsdt: spotCapacity.notional,
    shortEntryCapacityUsdt: shortDepthUsdt,
    spotLastPrice: spotCapacity.lastPrice,
    spotWorstAllowedPrice: spotCapacity.worstAllowedPrice,
    cadenceMs: TRADE_COOLDOWN_MS,
    ok: executableUsdt >= MIN_GLOBAL_ORDER_USDT,
    message: executableUsdt >= MIN_GLOBAL_ORDER_USDT
      ? "허용 슬리피지 안에서 현물 매수 가능 금액과 숏 진입 가능 금액 중 작은 금액만 이번 회차 실행"
      : "허용 슬리피지/헷지 깊이 기준으로 이번 회차 최소 주문금액을 만족하지 못해 대기"
  };
}

function estimateFillProbability(domesticBook, foreignBook, quantity) {
  if (!domesticBook || !foreignBook || !quantity) return 0;
  const dRatio = Math.min(1, (domesticBook.bidQty ?? 0) / quantity);
  const fRatio = Math.min(1, (foreignBook.askQty ?? 0) / quantity);
  return Math.min(dRatio, fRatio);
}

function updateSettings(params) {
  if (params.has("minPremiumPercent")) {
    state.settings.minPremiumPercent = clamp(Number(params.get("minPremiumPercent")), 0, 20);
  }
  if (params.has("orderNotionalUsdt")) {
    state.settings.orderNotionalUsdt = clamp(Number(params.get("orderNotionalUsdt")), 5, 1_000_000);
  }
  if (params.has("feeBufferPercent")) {
    state.settings.feeBufferPercent = clamp(Number(params.get("feeBufferPercent")), 0, 5);
  }
  if (params.has("maxSlippagePercent")) {
    state.settings.maxSlippagePercent = clamp(Number(params.get("maxSlippagePercent")), 0, 10);
  }
  if (params.has("maxAutoPremiumPercent")) {
    state.settings.maxAutoPremiumPercent = clamp(Number(params.get("maxAutoPremiumPercent")), 1, 100);
  }
  if (params.has("maxDomesticPriceDivergencePercent")) {
    state.settings.maxDomesticPriceDivergencePercent = clamp(Number(params.get("maxDomesticPriceDivergencePercent")), 1, 100);
  }
  if (params.has("minDepthUsdt")) {
    state.settings.minDepthUsdt = clamp(Number(params.get("minDepthUsdt")), 0, 1_000_000);
  }
  if (params.has("emergencyStop")) {
    state.settings.emergencyStop = params.get("emergencyStop") === "true";
    addBotEvent("EMERGENCY_STOP_CHANGED", state.settings.emergencyStop ? "긴급 정지 ON" : "긴급 정지 OFF");
  }
  if (params.has("dynamicThresholdEnabled")) {
    state.settings.dynamicThresholdEnabled = params.get("dynamicThresholdEnabled") === "true";
  }
  if (params.has("mmSellOptimizerEnabled")) {
    state.settings.mmSellOptimizerEnabled = params.get("mmSellOptimizerEnabled") === "true";
  }
  if (params.has("mmSellLadderLevels")) {
    state.settings.mmSellLadderLevels = Math.round(clamp(Number(params.get("mmSellLadderLevels")), 1, 10));
  }
  if (params.has("mmSellStepPercent")) {
    state.settings.mmSellStepPercent = clamp(Number(params.get("mmSellStepPercent")), 0, 2);
  }
  if (params.has("mmRepriceThresholdPercent")) {
    state.settings.mmRepriceThresholdPercent = clamp(Number(params.get("mmRepriceThresholdPercent")), 0, 5);
  }
  if (params.has("autoPaperTrading")) {
    state.settings.autoPaperTrading = params.get("autoPaperTrading") === "true";
  }
  if (params.has("liveTradingRequested")) {
    state.settings.liveTradingRequested = params.get("liveTradingRequested") === "true";
    addBotEvent("LIVE_TRADING_REQUEST_CHANGED", state.settings.liveTradingRequested ? "실거래 요청 ON" : "실거래 요청 OFF");
  }
  if (params.has("liveMaxOrderNotionalUsdt")) {
    state.settings.liveMaxOrderNotionalUsdt = clamp(Number(params.get("liveMaxOrderNotionalUsdt")), 5, 200);
  }
  if (params.has("requireTransferStatusForPaper")) {
    state.settings.requireTransferStatusForPaper = params.get("requireTransferStatusForPaper") === "true";
  }
  if (params.has("requireHedgeStatusForPaper")) {
    state.settings.requireHedgeStatusForPaper = params.get("requireHedgeStatusForPaper") === "true";
  }
  if (params.has("minHedgeBasisPercent")) {
    state.settings.minHedgeBasisPercent = clamp(Number(params.get("minHedgeBasisPercent")), -2, 5);
  }
  if (params.has("maxHedgeBasisPercent")) {
    state.settings.maxHedgeBasisPercent = clamp(Number(params.get("maxHedgeBasisPercent")), 0, 20);
  }
  if (params.has("minHedgeDepthUsdt")) {
    state.settings.minHedgeDepthUsdt = clamp(Number(params.get("minHedgeDepthUsdt")), 0, 1_000_000);
  }
  if (params.has("maxLeverage")) {
    state.settings.maxLeverage = clamp(Number(params.get("maxLeverage")), 1, 4);
  }
  state.settings.liveTrading = state.settings.liveTradingRequested && isLiveArmed();
  state.settings.withdrawalEnabled = false;
  state.settings.autoRebalanceEnabled = false;
}

function buildMmSellPlan(row) {
  const quantity = row.estimatedQuantity ?? 0;
  const levels = Math.max(1, state.settings.mmSellLadderLevels);
  const baseAsk = row.domesticAsk ?? row.domesticBid;
  const fallbackBid = row.domesticBid ?? baseAsk;
  const step = state.settings.mmSellStepPercent / 100;
  const perLevelQty = quantity / levels;
  const ladder = Array.from({ length: levels }, (_, i) => {
    const price = Math.max(fallbackBid, baseAsk * (1 + step * i));
    const referenceMarketEdge = row.usdtKrw && row.foreignAsk ? price - row.foreignAsk * row.usdtKrw : null;
    return {
      action: "SELL_ONLY_LIMIT",
      exchange: row.domesticExchange,
      symbol: `${row.asset}/KRW`,
      price,
      quantity: perLevelQty,
      level: i + 1,
      postOnlyPreferred: true,
      referenceMarketEdgeKrw: referenceMarketEdge
    };
  });
  const expectedAvgSellPrice = ladder.reduce((sum, order) => sum + order.price * order.quantity, 0) / Math.max(quantity, 1e-12);
  const immediateSellPrice = row.domesticEffectiveSellPrice ?? row.domesticBid;
  const improvementPercent = immediateSellPrice ? (expectedAvgSellPrice / immediateSellPrice - 1) * 100 : 0;
  return {
    asset: row.asset,
    domesticExchange: row.domesticExchange,
    foreignExchange: row.foreignExchange,
    mode: "SELL_ONLY_LADDER",
    purpose: "국내 매도 최적화와 슬리피지 방어",
    forbidden: ["NO_BID_ORDERS", "NO_TWO_SIDED_DOMESTIC_MM", "NO_SPOOFING", "NO_WASH_TRADING"],
    quantity,
    immediateSellPrice,
    expectedAvgSellPrice,
    improvementPercent,
    repriceWhenBestBidMovesPercent: state.settings.mmRepriceThresholdPercent,
    cancelUnfilledAfterMs: state.settings.mmMaxOrderAgeMs,
    partialFillPolicy: "filled quantity only; remaining quantity is repriced",
    hedgePolicy: "if unhedged exposure exceeds maxUnhedgedMs, simulate emergency hedge",
    ladder
  };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

async function autoPaperTrade() {
  if (!state.settings.autoPaperTrading || state.settings.emergencyStop) return;
  const now = Date.now();
  const eligible = buildRows().filter(isEligible);
  for (const row of eligible.slice(0, 5)) {
    const key = `${row.asset}:${row.domesticExchange}:${row.foreignExchange}`;
    if (now - (state.lastTradeAt[key] || 0) < TRADE_COOLDOWN_MS) continue;
    const executeUsdt = Math.min(row.entryPlan?.executableUsdt ?? 0, state.simulatedBalances.USDT);
    if (executeUsdt < MIN_GLOBAL_ORDER_USDT) continue;
    const quantity = executeUsdt / row.foreignAsk;
    let preflight = null;
    if (state.settings.requireApiExecutionPreflight) {
      preflight = await executionPreflight({
        asset: row.asset,
        sourceExchange: row.foreignExchange,
        destinationExchange: row.domesticExchange,
        amount: quantity
      });
      if (!preflight.canExecute) {
        state.lastTradeAt[key] = now;
        addRiskEvent("AUTO_TRADE_PREFLIGHT_BLOCKED", "high", `거래 시작 전 API-only 입출금/주소/수수료 점검 실패: ${preflight.blockedBy || "UNKNOWN"}`, {
          asset: row.asset,
          sourceExchange: row.foreignExchange,
          destinationExchange: row.domesticExchange,
          messages: preflight.messages
        });
        continue;
      }
    }
    state.lastTradeAt[key] = now;
    const partialFillRatio = 1;
    const filledQuantity = quantity;
    const unhedgedQuantity = 0;
    const foreignConvertedKrw = row.foreignEffectiveBuyPrice * row.usdtKrw;
    const effectiveDomesticSellKrw = row.domesticEffectiveSellPrice ?? row.domesticBid;
    const filledForeignNotionalUsdt = row.foreignEffectiveBuyPrice * filledQuantity;
    const filledForeignNotionalKrw = foreignConvertedKrw * filledQuantity;
    const estimatedGrossEdgeKrw = (effectiveDomesticSellKrw - foreignConvertedKrw) * filledQuantity;
    const expectedDomesticProceedsKrw = effectiveDomesticSellKrw * filledQuantity;
    const estimatedBuyTradingFeeKrw = filledForeignNotionalKrw * state.settings.feeBufferPercent / 100;
    const estimatedShortEntryFeeKrw = filledForeignNotionalKrw * state.settings.feeBufferPercent / 100;
    const estimatedSellTradingFeeKrw = expectedDomesticProceedsKrw * state.settings.feeBufferPercent / 100;
    const estimatedShortCloseFeeKrw = expectedDomesticProceedsKrw * state.settings.feeBufferPercent / 100;
    const estimatedFeeBufferKrw = estimatedBuyTradingFeeKrw + estimatedShortEntryFeeKrw + estimatedSellTradingFeeKrw + estimatedShortCloseFeeKrw;
    const estimatedNetEdgeKrw = estimatedGrossEdgeKrw - estimatedFeeBufferKrw;
    const mmSellPlan = buildMmSellPlan(row);
    state.simulatedBalances.USDT -= filledForeignNotionalUsdt;
    state.simulatedBalances.lockedUsdt += filledForeignNotionalUsdt;
    state.simulatedBalances.unrealizedPnlKrw += estimatedNetEdgeKrw;
    const plan = state.entryPlans[key] ?? {
      key,
      asset: row.asset,
      domesticExchange: row.domesticExchange,
      foreignExchange: row.foreignExchange,
      targetUsdt: state.settings.orderNotionalUsdt,
      completedUsdt: 0,
      chunks: [],
      status: "RUNNING"
    };
    plan.completedUsdt += filledForeignNotionalUsdt;
    plan.remainingUsdt = Math.max(0, plan.targetUsdt - plan.completedUsdt);
    plan.status = plan.remainingUsdt < MIN_GLOBAL_ORDER_USDT ? "TARGET_REACHED" : "WAITING_NEXT_15S_CHUNK";
    plan.updatedAt = new Date(now).toISOString();
    plan.chunks.unshift({ at: plan.updatedAt, usdt: filledForeignNotionalUsdt, quantity: filledQuantity, hedgeExchange: row.hedgeStatus.exchange });
    plan.chunks = plan.chunks.slice(0, 20);
    state.entryPlans[key] = plan;
    const trade = {
      id: `${now}-${key}`,
      mode: "PAPER_ONLY",
      strategy: "FOREIGN_SPOT_BUY_PLUS_FOREIGN_PERP_SHORT",
      asset: row.asset,
      domesticExchange: row.domesticExchange,
      foreignExchange: row.foreignExchange,
      premiumPercent: row.premiumPercent,
      netPremiumPercent: row.netPremiumPercent,
      quantity,
      filledQuantity,
      partialFillRatio,
      unhedgedQuantity,
      orderNotionalUsdt: executeUsdt,
      targetOrderNotionalUsdt: state.settings.orderNotionalUsdt,
      entryPlan: {
        key,
        chunkUsdt: executeUsdt,
        completedUsdt: plan.completedUsdt,
        remainingUsdt: plan.remainingUsdt,
        spotBuyCapacityUsdt: row.entryPlan.spotBuyCapacityUsdt,
        shortEntryCapacityUsdt: row.entryPlan.shortEntryCapacityUsdt,
        rule: "spot buy amount and short notional are matched by the smaller executable notional inside max slippage"
      },
      riskDecision: row.risk,
      executionPreflight: preflight,
      mmSellPlan,
      legs: [
        {
          action: "BUY_SPOT",
          exchange: row.foreignExchange,
          symbol: `${row.asset}/USDT`,
          price: row.foreignAsk,
          quantity,
          filledQuantity,
          notionalUsdt: executeUsdt
        },
        {
          action: "SHORT_PERP",
          exchange: row.hedgeStatus.exchange || row.foreignExchange,
          symbol: `${row.asset}/USDT:PERP`,
          price: row.hedgeStatus.futuresBid || row.foreignAsk,
          quantity,
          filledQuantity,
          notionalUsdt: executeUsdt,
          reduceOnly: false
        },
        {
          action: "MM_SELL_ONLY_LADDER_PLAN",
          exchange: row.domesticExchange,
          symbol: `${row.asset}/KRW`,
          price: mmSellPlan.expectedAvgSellPrice,
          quantity,
          filledQuantity,
          ladder: mmSellPlan.ladder
        }
      ],
      referenceExit: {
        exchange: row.domesticExchange,
        symbol: `${row.asset}/KRW`,
        domesticBestBidKrw: row.domesticBid,
        domesticEffectiveSellKrw: effectiveDomesticSellKrw,
        foreignEffectiveBuyUsdt: row.foreignEffectiveBuyPrice,
        usdtKrw: row.usdtKrw
      },
      filledForeignNotionalUsdt,
      estimatedGrossEdgeKrw,
      estimatedFeeBufferKrw,
      estimatedBuyTradingFeeKrw,
      estimatedShortEntryFeeKrw,
      estimatedSellTradingFeeKrw,
      estimatedShortCloseFeeKrw,
      estimatedNetEdgeKrw,
      slippagePercent: row.slippagePercent,
      fillProbability: row.fillProbability,
      status: unhedgedQuantity > 0 ? "PARTIAL_OR_UNHEDGED_SIMULATED" : "PAPER_FILLED",
      createdAt: new Date(now).toISOString()
    };
    state.paperTrades.unshift(trade);
    createTransferPosition(trade, row);
    addBotEvent("PAPER_TRADE_CREATED", `${row.asset} ${row.domesticExchange}/${row.foreignExchange} ${formatPlain(executeUsdt)} USDT 분할 모의거래 기록`, { premiumPercent: row.premiumPercent, netPremiumPercent: row.netPremiumPercent, entryPlan: plan.status });
    if (unhedgedQuantity > 0) addRiskEvent("UNHEDGED_SIMULATED", "warning", "부분체결 또는 미헷지 가능성이 감지되었습니다.", { key, unhedgedQuantity });
    state.paperTrades = state.paperTrades.slice(0, 300);
  }
}

function createTransferPosition(trade, row) {
  const exists = state.transferPositions.some((position) => position.tradeId === trade.id);
  if (exists) return;
  const startedAtMs = Date.now();
  const minSec = Math.max(1, state.settings.transferMinSeconds);
  const maxSec = Math.max(minSec, state.settings.transferMaxSeconds);
  const etaSeconds = Math.round(minSec + Math.random() * (maxSec - minSec));
  state.transferPositions.unshift({
    id: `transfer-${trade.id}`,
    tradeId: trade.id,
    mode: "PAPER_TRANSFER_MONITOR",
    asset: trade.asset,
    domesticExchange: trade.domesticExchange,
    foreignExchange: trade.foreignExchange,
    quantity: trade.filledQuantity,
    originalQuantity: trade.quantity,
    startedPremiumPercent: trade.premiumPercent,
    startedNetPremiumPercent: trade.netPremiumPercent,
    currentPremiumPercent: row.premiumPercent,
	    currentNetPremiumPercent: row.netPremiumPercent,
	    targetNetPremiumPercent: dynamicMinPremium(),
	    transferStatus: row.transferStatus,
	    executionPreflight: trade.executionPreflight,
	    selectedTransferNetwork: trade.executionPreflight?.selectedNetwork?.normalizedNetworkCode || row.transferStatus?.routeEconomics?.bestNetwork || "",
	    apiDepositAddressSource: trade.executionPreflight?.address?.source || "",
	    transferFeeKrw: trade.executionPreflight?.selectedNetwork?.withdrawFeeKnown
	      ? (trade.executionPreflight.selectedNetwork.withdrawFee * row.domesticBid)
	      : (row.transferStatus?.routeEconomics?.withdrawFeeKrw ?? 0),
	    hedgeStatus: row.hedgeStatus,
    status: "IN_TRANSIT",
    statusMessage: "해외 매수 시점부터 국내 입금까지 프리미엄 감시 중",
    startedAt: new Date(startedAtMs).toISOString(),
    etaAt: new Date(startedAtMs + etaSeconds * 1000).toISOString(),
    arrivedAt: null,
    closedAt: null,
    closeRoute: null,
    actions: [
      "FOREIGN_SPOT_BUY_SIMULATED",
      "FOREIGN_SHORT_OPEN_SIMULATED",
      "TRANSFER_TO_DOMESTIC_MONITORING"
    ],
    premiumTrail: [{
      at: new Date(startedAtMs).toISOString(),
      premiumPercent: row.premiumPercent,
      netPremiumPercent: row.netPremiumPercent,
      status: "ENTRY"
    }]
  });
  state.transferPositions = state.transferPositions.slice(0, 200);
}

function monitorTransferPositions() {
  if (!state.transferPositions.length) return;
  const rows = buildRows();
  const now = Date.now();
  for (const position of state.transferPositions) {
    if (["CLOSED_DOMESTIC_SIMULATED", "CLOSED_ORIGIN_SIMULATED", "CANCELLED"].includes(position.status)) continue;
    const row = rows.find((item) =>
      item.asset === position.asset &&
      item.domesticExchange === position.domesticExchange &&
      item.foreignExchange === position.foreignExchange
    );
    if (!row || row.netPremiumPercent == null) {
      position.statusMessage = "현재 비교 row 없음 또는 가격 데이터 부족";
      continue;
    }
    position.currentPremiumPercent = row.premiumPercent;
    position.currentNetPremiumPercent = row.netPremiumPercent;
    position.targetNetPremiumPercent = dynamicMinPremium();
    position.transferStatus = row.transferStatus;
    position.hedgeStatus = row.hedgeStatus;
    if (row.transferStatus?.ok !== true && !state.settings.allowSimulatedTransferStatus) {
      position.statusMessage = "입출금 상태 확인 불가 또는 불가 상태 · 청산/대기 전 수동 확인 필요";
      continue;
    }
    if (row.hedgeStatus?.ok !== true) {
      position.statusMessage = "헷징 가능 여부 확인 불가 또는 불가 상태 · 거래 무산 필요";
      continue;
    }
    position.premiumTrail.unshift({
      at: new Date(now).toISOString(),
      premiumPercent: row.premiumPercent,
      netPremiumPercent: row.netPremiumPercent,
      status: position.status
    });
    position.premiumTrail = position.premiumTrail.slice(0, 120);
    const etaMs = new Date(position.etaAt).getTime();
    const targetMet = row.netPremiumPercent >= position.targetNetPremiumPercent && !hasStale(row);
    if (position.status === "IN_TRANSIT" && now < etaMs) {
      position.statusMessage = `전송 중 · 도착 전까지 실시간 프리미엄 감시`;
      continue;
    }
    if (position.status === "IN_TRANSIT") {
      position.arrivedAt = new Date(now).toISOString();
      if (targetMet) closeDomesticPosition(position, row, "ARRIVAL_TARGET_MET");
      else {
        position.status = "WAITING_PREMIUM";
        position.statusMessage = "국내 도착했지만 설정 프리미엄 미달 · 대기창에서 재진입 감시";
        addRiskEvent("TRANSFER_PREMIUM_DROPPED", "warning", `${position.asset} 도착 시점 프리미엄이 기준 미달입니다.`, {
          id: position.id,
          currentNetPremiumPercent: row.netPremiumPercent,
          targetNetPremiumPercent: position.targetNetPremiumPercent
        });
      }
      continue;
    }
    if (position.status === "WAITING_PREMIUM" && targetMet) {
      closeDomesticPosition(position, row, "WAITING_TARGET_REENTERED");
    }
  }
}

function closeDomesticPosition(position, row, reason) {
  position.status = "EXIT_RUNNING";
  position.statusMessage = reason === "ARRIVAL_TARGET_MET"
    ? "도착 시점에도 기준 프리미엄 유지 · 현물 매도 + 숏 비례 청산 시작"
    : "대기 중 기준 프리미엄 재진입 · 현물 매도 + 숏 비례 청산 시작";
  position.arrivedAt ??= new Date().toISOString();
  position.closeRoute = "DOMESTIC_SPOT_SELL_PLUS_PROPORTIONAL_SHORT_CLOSE";
  position.closePremiumPercent = row.premiumPercent;
  position.closeNetPremiumPercent = row.netPremiumPercent;
  position.actions.push("EXIT_ENGINE_STARTED");
  startExitPosition(position, row, "domestic");
  addBotEvent("EXIT_ENGINE_STARTED", `${position.asset} 현물 매도 + 숏 비례 청산 시작`, {
    id: position.id,
    reason,
    closeNetPremiumPercent: row.netPremiumPercent
  });
}

function manualReturnTransfer(id) {
  const position = state.transferPositions.find((item) => item.id === id);
  if (!position) return { ok: false, error: "POSITION_NOT_FOUND" };
  if (["CLOSED_DOMESTIC_SIMULATED", "CLOSED_ORIGIN_SIMULATED", "EXIT_RUNNING"].includes(position.status)) {
    return { ok: false, error: "POSITION_ALREADY_CLOSED", position };
  }
  position.status = "EXIT_RUNNING";
  position.statusMessage = "수동 복귀 선택 · 원래 해외 거래소 기준 현물 매도 + 숏 비례 청산 시작";
  position.closeRoute = "RETURN_TO_ORIGIN_SPOT_SELL_PLUS_SHORT_CLOSE";
  position.actions.push("MANUAL_RETURN_TO_ORIGIN_REQUESTED", "ORIGIN_EXIT_ENGINE_STARTED");
  startExitPosition(position, null, "origin");
  addBotEvent("TRANSFER_MANUAL_RETURN", `${position.asset} 원거래소 복귀 + 현물 매도 + 숏 청산 모의`, { id: position.id });
  return { ok: true, position };
}

function startExitPosition(position, row, route) {
  if (state.exitPositions.some((item) => item.transferId === position.id)) return;
  const targetQuantity = Math.max(0, Number(position.quantity || position.originalQuantity || 0));
  const shortEntryQuantity = Math.max(0, Number(position.quantity || targetQuantity));
  const currentPremiumPercent = row?.premiumPercent ?? position.currentPremiumPercent ?? null;
  const currentNetPremiumPercent = row?.netPremiumPercent ?? position.currentNetPremiumPercent ?? null;
  const exitDecision = row ? exitPremiumDecision(position, row, targetQuantity) : { canSell: route !== "domestic", reason: "ORIGIN_EXIT" };
  const blocked = route === "domestic" && !exitDecision.canSell;
  const now = new Date().toISOString();
  const exit = {
    id: `exit-${position.id}`,
    transferId: position.id,
    tradeId: position.tradeId,
    asset: position.asset,
    buyExchange: position.foreignExchange,
    sellExchange: route === "origin" ? position.foreignExchange : position.domesticExchange,
    shortExchange: position.hedgeStatus?.exchange || position.foreignExchange,
    buySymbol: position.buySymbol || position.asset,
    sellSymbol: position.sellSymbol || position.asset,
    futuresSymbol: position.futuresSymbol || position.asset,
    route,
    status: blocked ? "WAITING_PREMIUM" : "SELLING_SPOT",
    statusMessage: blocked ? "매도 직전 프리미엄 기준 미달 · 대기 중" : "4단계 현물 매도 진행 중",
    createdAt: now,
    updatedAt: now,
    targetSpotSellQuantity: targetQuantity,
    detectedDepositQuantity: targetQuantity,
    availableSellQuantity: targetQuantity,
    shortEntryQuantity,
    cumulativeSpotSoldQuantity: 0,
    cumulativeShortClosedQuantity: 0,
    remainingSpotQuantity: targetQuantity,
    remainingShortQuantity: shortEntryQuantity,
    tolerancePercent: state.settings.shortCloseTolerancePercent,
    currentPremiumPercent,
    currentNetPremiumPercent,
    exitDecision,
    transferFeeKrw: position.transferFeeKrw ?? 0,
    minPremiumPercent: dynamicMinPremium(),
    stages: {
      deposit: "completed",
      premiumRecheck: blocked ? "blocked" : "completed",
      spotSell: blocked ? "pending" : "running",
      shortClose: "pending",
      settlement: "pending"
    },
    fills: [],
    shortCloses: [],
    events: [{ at: now, message: blocked ? "프리미엄 기준 미달로 현물 매도 보류" : "현물 매도 + 숏 비례 청산 엔진 시작" }]
  };
  state.exitPositions.unshift(exit);
  state.exitPositions = state.exitPositions.slice(0, 200);
}

function processExitPositions() {
  if (!state.exitPositions.length) return;
  const rows = buildRows();
  for (const exit of state.exitPositions) {
    if (["COMPLETED", "CANCELLED", "MANUAL_REQUIRED"].includes(exit.status)) continue;
    const row = rows.find((item) =>
      item.asset === exit.asset &&
      item.domesticExchange === exit.sellExchange &&
      item.foreignExchange === exit.buyExchange
    );
    exit.currentPremiumPercent = row?.premiumPercent ?? exit.currentPremiumPercent;
    exit.currentNetPremiumPercent = row?.netPremiumPercent ?? exit.currentNetPremiumPercent;
    exit.minPremiumPercent = dynamicMinPremium();
    const decision = row ? exitPremiumDecision(exit, row, exit.remainingSpotQuantity || exit.targetSpotSellQuantity) : { canSell: exit.route !== "domestic", reason: "ORIGIN_EXIT" };
    exit.exitDecision = decision;
    if (exit.status === "WAITING_PREMIUM") {
      if (decision.canSell && row && !hasStale(row)) {
        exit.status = "SELLING_SPOT";
        exit.statusMessage = decision.reason === "MIN_PREMIUM_MET"
          ? "프리미엄 재진입 · 현물 매도 진행 중"
          : "최소 프리미엄 미달이지만 수수료 포함 손익이 음수가 아니어서 현물 매도 진행";
        exit.stages.premiumRecheck = decision.reason === "MIN_PREMIUM_MET" ? "completed" : "non-loss-exit";
        exit.stages.spotSell = "running";
        pushExitEvent(exit, decision.message);
      }
      continue;
    }
    if (exit.status === "SELLING_SPOT") simulateSpotSellAndShortClose(exit, row);
  }
}

function simulateSpotSellAndShortClose(exit, row) {
  if (!row && exit.route === "domestic") {
    exit.status = "MANUAL_REQUIRED";
    exit.statusMessage = "매도 기준 row 없음 · 수동 매도 필요";
    exit.stages.spotSell = "manual-required";
    pushExitEvent(exit, "매도 기준 가격 데이터가 없어 수동 매도 필요");
    return;
  }
  const decision = row ? exitPremiumDecision(exit, row, exit.remainingSpotQuantity || exit.targetSpotSellQuantity) : { canSell: exit.route !== "domestic", reason: "ORIGIN_EXIT" };
  exit.exitDecision = decision;
  if (exit.route === "domestic" && (!decision.canSell || hasStale(row))) {
    exit.status = "WAITING_PREMIUM";
    exit.statusMessage = hasStale(row)
      ? "매도 직전 데이터 stale · 15초 뒤 재확인"
      : "매도 직전 최소 프리미엄 미달이고 수수료 포함 손익도 음수 · 15초 뒤 재확인";
    exit.stages.premiumRecheck = "blocked";
    pushExitEvent(exit, decision.message || "프리미엄/손익 조건 미달로 현물 매도와 숏 청산 보류");
    return;
  }
  const remaining = Math.max(0, exit.targetSpotSellQuantity - exit.cumulativeSpotSoldQuantity);
  if (remaining <= 1e-12) return completeExitIfDone(exit, row);
  const safeSpotQuantity = exit.route === "domestic"
    ? Math.max(0, row?.exitLiquidity?.spotSellSafeQuantity ?? 0)
    : remaining;
  const safeShortCloseQuantity = Math.max(0, row?.exitLiquidity?.shortCloseSafeQuantity ?? remaining);
  const spotFillQuantity = Math.min(remaining, safeSpotQuantity, safeShortCloseQuantity);
  const spotNotionalKrw = spotFillQuantity * (row?.domesticBid || 0);
  if (spotFillQuantity <= 1e-12 || spotNotionalKrw < MIN_DOMESTIC_ORDER_KRW) {
    exit.status = "WAITING_PREMIUM";
    exit.statusMessage = "허용 슬리피지 안의 현물 매도/숏 청산 가능 수량이 최소 주문 조건 미달 · 15초 뒤 재확인";
    pushExitEvent(exit, "현물 매도 가능 수량과 숏 청산 가능 수량 중 작은 값이 부족해 대기");
    return;
  }
  const spotPrice = row?.domesticEffectiveSellPrice || row?.domesticBid || 0;
  const shortCloseQuantity = shortCloseQuantityForFill(exit, spotFillQuantity);
  const shortClosePrice = row?.hedgeStatus?.futuresAsk || row?.foreignAsk || 0;
  const now = new Date().toISOString();
  exit.fills.push({
    at: now,
    type: "AUTO_SPOT_SELL_SIMULATED",
    exchange: exit.sellExchange,
    symbol: exit.sellSymbol,
    quantity: spotFillQuantity,
    price: spotPrice,
    notionalKrw: spotFillQuantity * spotPrice
  });
  exit.shortCloses.push({
    at: now,
    type: "SHORT_CLOSE_REDUCE_ONLY_SIMULATED",
    exchange: exit.shortExchange,
    symbol: exit.futuresSymbol,
    side: "BUY_REDUCE_ONLY",
    quantity: shortCloseQuantity,
    price: shortClosePrice,
    formula: "shortEntryQuantity * spotFillQuantity / targetSpotSellQuantity",
    safety: "spot sell fill must be confirmed before this reduce-only close is counted"
  });
  exit.cumulativeSpotSoldQuantity += spotFillQuantity;
  exit.cumulativeShortClosedQuantity += shortCloseQuantity;
  exit.remainingSpotQuantity = Math.max(0, exit.targetSpotSellQuantity - exit.cumulativeSpotSoldQuantity);
  exit.remainingShortQuantity = Math.max(0, exit.shortEntryQuantity - exit.cumulativeShortClosedQuantity);
  exit.stages.spotSell = exit.remainingSpotQuantity <= 1e-12 ? "completed" : "running";
  exit.stages.shortClose = exit.remainingShortQuantity <= toleranceQuantity(exit) ? "completed" : "running";
  exit.statusMessage = `현물 누적 ${formatPlain(exit.cumulativeSpotSoldQuantity)} / 목표 ${formatPlain(exit.targetSpotSellQuantity)} · 숏 누적 ${formatPlain(exit.cumulativeShortClosedQuantity)} / 진입 ${formatPlain(exit.shortEntryQuantity)}`;
  pushExitEvent(exit, `허용 슬리피지 안에서 현물 ${formatPlain(spotFillQuantity)} 체결 감지 → 숏 ${formatPlain(shortCloseQuantity)} reduce-only 청산`);
  completeExitIfDone(exit, row);
}

function shortCloseQuantityForFill(exit, spotFillQuantity) {
  const proportional = exit.targetSpotSellQuantity > 0
    ? exit.shortEntryQuantity * spotFillQuantity / exit.targetSpotSellQuantity
    : 0;
  const remainingAfter = Math.max(0, exit.shortEntryQuantity - exit.cumulativeShortClosedQuantity - proportional);
  if (remainingAfter <= toleranceQuantity(exit)) {
    return Math.max(0, exit.shortEntryQuantity - exit.cumulativeShortClosedQuantity);
  }
  return proportional;
}

function exitPremiumDecision(positionOrExit, row, quantity) {
  const netPremiumPercent = row?.netPremiumPercent ?? -Infinity;
  const minPremiumPercent = dynamicMinPremium();
  if (netPremiumPercent >= minPremiumPercent) {
    return {
      canSell: true,
      reason: "MIN_PREMIUM_MET",
      netPremiumPercent,
      minPremiumPercent,
      estimatedExitPnlKrw: null,
      message: "매도 직전 최소 프리미엄을 통과했습니다."
    };
  }
  const trade = state.paperTrades.find((item) => item.id === positionOrExit.tradeId);
  const safeQuantity = Math.max(0, Number(quantity || 0));
  const buyUnitKrw = trade?.filledQuantity > 0
    ? (trade.filledForeignNotionalKrw || 0) / trade.filledQuantity
    : (row?.foreignEffectiveBuyPrice || row?.foreignAsk || 0) * (row?.usdtKrw || 0);
  const sellUnitKrw = row?.domesticEffectiveSellPrice || row?.domesticBid || 0;
  const buyCostKrw = buyUnitKrw * safeQuantity;
  const sellProceedsKrw = sellUnitKrw * safeQuantity;
  const buyTradingFeeKrw = buyCostKrw * state.settings.feeBufferPercent / 100;
  const shortEntryFeeKrw = buyCostKrw * state.settings.feeBufferPercent / 100;
  const sellTradingFeeKrw = sellProceedsKrw * state.settings.feeBufferPercent / 100;
  const shortCloseFeeKrw = sellProceedsKrw * state.settings.feeBufferPercent / 100;
  const transferFeeKrw = Number(positionOrExit.transferFeeKrw || 0);
  const estimatedExitPnlKrw = sellProceedsKrw - buyCostKrw - buyTradingFeeKrw - shortEntryFeeKrw - sellTradingFeeKrw - shortCloseFeeKrw - transferFeeKrw;
  return {
    canSell: estimatedExitPnlKrw >= 0,
    reason: estimatedExitPnlKrw >= 0 ? "NON_LOSS_EXIT_ALLOWED" : "NEGATIVE_AFTER_FEES_WAIT",
    netPremiumPercent,
    minPremiumPercent,
    buyCostKrw,
    sellProceedsKrw,
    buyTradingFeeKrw,
    shortEntryFeeKrw,
    sellTradingFeeKrw,
    shortCloseFeeKrw,
    transferFeeKrw,
    estimatedExitPnlKrw,
    message: estimatedExitPnlKrw >= 0
      ? "최소 프리미엄은 미달이지만 매수/매도 수수료와 송금비 반영 후 손해가 아니므로 매도를 허용합니다."
      : "최소 프리미엄 미달이며 매수/매도 수수료와 송금비 반영 후 손익이 음수라 대기합니다."
  };
}

function toleranceQuantity(exit) {
  return exit.shortEntryQuantity * (exit.tolerancePercent || 1) / 100;
}

function completeExitIfDone(exit, row) {
  if (exit.remainingSpotQuantity > 1e-12) return;
  if (exit.remainingShortQuantity > 0) {
    const finalClose = exit.remainingShortQuantity;
    exit.shortCloses.push({
      at: new Date().toISOString(),
      type: "SHORT_CLOSE_FINAL_REMAINDER_SIMULATED",
      exchange: exit.shortExchange,
      symbol: exit.futuresSymbol,
      side: "BUY_REDUCE_ONLY",
      quantity: finalClose,
      price: row?.hedgeStatus?.futuresAsk || row?.foreignAsk || 0,
      reason: "spot exit completed; close every remaining short quantity"
    });
    exit.cumulativeShortClosedQuantity += finalClose;
    exit.remainingShortQuantity = 0;
  }
  exit.status = "COMPLETED";
  exit.statusMessage = "현물 매도와 숏 비례 청산 완료";
  exit.stages.spotSell = "completed";
  exit.stages.shortClose = "completed";
  exit.stages.settlement = "completed";
  exit.updatedAt = new Date().toISOString();
  pushExitEvent(exit, "정산 카드 생성");
  createSettlement(exit, row);
  const transfer = state.transferPositions.find((item) => item.id === exit.transferId);
  if (transfer) {
    transfer.status = exit.route === "origin" ? "CLOSED_ORIGIN_SIMULATED" : "CLOSED_DOMESTIC_SIMULATED";
    transfer.closedAt = new Date().toISOString();
    transfer.statusMessage = exit.statusMessage;
  }
}

function createSettlement(exit, row) {
  if (state.settlements.some((item) => item.exitId === exit.id)) return;
  const trade = state.paperTrades.find((item) => item.id === exit.tradeId);
  const spotBuyKrw = trade?.filledForeignNotionalKrw ?? 0;
  const spotSellKrw = exit.fills.reduce((sum, fill) => sum + (fill.notionalKrw || 0), 0);
  const usdtKrw = row?.usdtKrw || trade?.referenceExit?.usdtKrw || 1400;
  const shortEntryValue = (trade?.foreignEffectiveBuyPrice || trade?.referenceExit?.foreignEffectiveBuyUsdt || row?.foreignAsk || 0) * exit.shortEntryQuantity * usdtKrw;
  const shortCloseValue = exit.shortCloses.reduce((sum, fill) => sum + (fill.price || 0) * fill.quantity * usdtKrw, 0);
  const spotFeeKrw = (spotBuyKrw + spotSellKrw) * state.settings.feeBufferPercent / 100;
  const futuresFeeKrw = (shortEntryValue + shortCloseValue) * state.settings.feeBufferPercent / 100;
  const transferFeeKrw = exit.transferFeeKrw || 0;
  const spotPnlKrw = spotSellKrw - spotBuyKrw - spotFeeKrw - transferFeeKrw;
  const futuresPnlKrw = shortEntryValue - shortCloseValue - futuresFeeKrw;
  const settlement = {
    id: `settlement-${exit.id}`,
    exitId: exit.id,
    asset: exit.asset,
    createdAt: new Date().toISOString(),
    flags: trade ? [] : ["estimated-missing-spot-buy"],
    quantities: {
      spotBought: trade?.filledQuantity ?? exit.targetSpotSellQuantity,
      shortEntered: exit.shortEntryQuantity,
      spotSold: exit.cumulativeSpotSoldQuantity,
      shortClosed: exit.cumulativeShortClosedQuantity
    },
    pnl: {
      spotBuyKrw,
      spotSellKrw,
      spotFeeKrw,
      transferFeeKrw,
      spotPnlKrw,
      shortEntryValueKrw: shortEntryValue,
      shortCloseValueKrw: shortCloseValue,
      futuresFeeKrw,
      futuresPnlKrw,
      totalPnlKrw: spotPnlKrw + futuresPnlKrw
    },
    byExchange: [
      { exchange: exit.buyExchange, spotKrw: -spotBuyKrw, futuresKrw: 0, feesKrw: 0, totalKrw: -spotBuyKrw },
      { exchange: exit.sellExchange, spotKrw: spotSellKrw, futuresKrw: 0, feesKrw: -spotFeeKrw - transferFeeKrw, totalKrw: spotSellKrw - spotFeeKrw - transferFeeKrw },
      { exchange: exit.shortExchange, spotKrw: 0, futuresKrw: futuresPnlKrw, feesKrw: -futuresFeeKrw, totalKrw: futuresPnlKrw - futuresFeeKrw }
    ]
  };
  state.settlements.unshift(settlement);
  state.settlements = state.settlements.slice(0, 100);
  state.simulatedBalances.realizedPnlKrw += settlement.pnl.totalPnlKrw;
}

function pushExitEvent(exit, message) {
  exit.updatedAt = new Date().toISOString();
  exit.events.unshift({ at: exit.updatedAt, message });
  exit.events = exit.events.slice(0, 80);
}

function manualTransferConfirm(id) {
  const position = state.transferPositions.find((item) => item.id === id);
  if (!position) return { ok: false, error: "POSITION_NOT_FOUND" };
  position.etaAt = new Date(Date.now() + 15_000).toISOString();
  position.statusMessage = "수동 전송 확인 · 15초마다 입금 확인 모의 중";
  position.actions.push("MANUAL_TRANSFER_CONFIRM");
  return { ok: true, position };
}

function manualSpotSellDetect(id) {
  const exit = state.exitPositions.find((item) => item.id === id || item.transferId === id);
  if (!exit) return { ok: false, error: "EXIT_NOT_FOUND" };
  const fillQty = Math.min(Math.max(exit.remainingSpotQuantity, 0), exit.targetSpotSellQuantity * 0.4 || exit.remainingSpotQuantity);
  if (fillQty <= 0) return { ok: false, error: "NO_REMAINING_SPOT" };
  simulateManualSpotSell(exit, fillQty);
  return { ok: true, exit };
}

function simulateManualSpotSell(exit, quantity) {
  const shortCloseQuantity = shortCloseQuantityForFill(exit, quantity);
  const now = new Date().toISOString();
  exit.fills.push({ at: now, type: "MANUAL_SPOT_SELL_DETECTED", exchange: exit.sellExchange, symbol: exit.sellSymbol, quantity, price: 0, estimated: true });
  exit.shortCloses.push({ at: now, type: "SHORT_CLOSE_FROM_MANUAL_SELL_SIMULATED", exchange: exit.shortExchange, side: "BUY_REDUCE_ONLY", quantity: shortCloseQuantity, price: 0, estimated: true });
  exit.cumulativeSpotSoldQuantity += quantity;
  exit.cumulativeShortClosedQuantity += shortCloseQuantity;
  exit.remainingSpotQuantity = Math.max(0, exit.targetSpotSellQuantity - exit.cumulativeSpotSoldQuantity);
  exit.remainingShortQuantity = Math.max(0, exit.shortEntryQuantity - exit.cumulativeShortClosedQuantity);
  pushExitEvent(exit, `수동 현물 매도 ${formatPlain(quantity)} 인식 → 숏 ${formatPlain(shortCloseQuantity)} 청산`);
  completeExitIfDone(exit, null);
}

function returnOriginExit(id) {
  return manualReturnTransfer(id);
}

function cancelExitPosition(id) {
  const exit = state.exitPositions.find((item) => item.id === id || item.transferId === id);
  if (!exit) return { ok: false, error: "EXIT_NOT_FOUND" };
  exit.status = "CANCELLED";
  exit.statusMessage = "사용자 요청으로 진행 중지";
  exit.stages.spotSell = "blocked";
  exit.stages.shortClose = "blocked";
  pushExitEvent(exit, "사용자 요청으로 출구 엔진 중지");
  return { ok: true, exit };
}

function createRecentSettlement() {
  const now = new Date().toISOString();
  const settlement = {
    id: `recent-${Date.now()}`,
    exitId: null,
    asset: "ALL",
    createdAt: now,
    flags: ["recent-30m-scan-simulated", "estimated-missing-spot-buy"],
    quantities: {},
    pnl: { totalPnlKrw: 0 },
    byExchange: [],
    message: "최근 30분 체결 정산은 현재 데모 스캔 기록으로 생성되었습니다. 실제 API 체결 조회 연결 전입니다."
  };
  state.settlements.unshift(settlement);
  state.settlements = state.settlements.slice(0, 100);
  return { ok: true, settlement };
}

async function autoLiveTrade() {
  state.settings.liveTrading = state.settings.liveTradingRequested && isLiveArmed();
  if (!state.settings.liveTrading || state.settings.emergencyStop) return;
  const readiness = buildLiveReadiness();
  if (!readiness.ready) {
    addRiskEvent("LIVE_READINESS_BLOCKED", "high", "실거래 readiness 조건을 통과하지 못했습니다.", { missing: readiness.missing });
    disarmLiveTrading("readiness_failed");
    return;
  }
  const now = Date.now();
  const rows = buildRows()
    .filter(isEligible)
    .filter((row) => LIVE_SUPPORTED_ROUTES.has(`${row.domesticExchange}:${row.foreignExchange}`));
  for (const row of rows.slice(0, 1)) {
    const key = `${row.asset}:${row.domesticExchange}:${row.foreignExchange}`;
    if (now - (state.live.lastTradeAt[key] || 0) < TRADE_COOLDOWN_MS * 4) continue;
    if (!hasRecentPaperSuccess(row)) continue;
    state.live.lastTradeAt[key] = now;
    try {
      const order = await executeLiveRoute(row);
      state.live.orders.unshift(order);
      state.live.orders = state.live.orders.slice(0, 100);
      addBotEvent("LIVE_ORDER_ROUTE_EXECUTED", `${row.asset} ${row.domesticExchange}/${row.foreignExchange} 실거래 라우트 기록`, { id: order.id, status: order.status });
    } catch (error) {
      addRiskEvent("LIVE_ORDER_FAILED", "critical", error.message, { asset: row.asset, domestic: row.domesticExchange, foreign: row.foreignExchange });
      disarmLiveTrading("live_order_failed");
    }
  }
}

function hasRecentPaperSuccess(row) {
  if (!state.settings.liveRequireRecentPaperTrade) return true;
  const cutoff = Date.now() - 10 * 60_000;
  return state.paperTrades.some((trade) =>
    trade.asset === row.asset &&
    trade.domesticExchange === row.domesticExchange &&
    trade.foreignExchange === row.foreignExchange &&
    trade.status === "PAPER_FILLED" &&
    new Date(trade.createdAt).getTime() > cutoff
  );
}

async function executeLiveRoute(row) {
  const id = `${Date.now()}-${row.asset}-${row.domesticExchange}-${row.foreignExchange}`;
  const notionalUsdt = Math.min(state.settings.orderNotionalUsdt, state.settings.liveMaxOrderNotionalUsdt);
  const quantity = notionalUsdt / row.foreignEffectiveBuyPrice;
  const clientOrderId = `kimchi-${id}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36);
  const mmSellPlan = buildMmSellPlan({ ...row, estimatedQuantity: quantity });
  const plan = {
    id,
    mode: "LIVE_GUARDED",
    route: `${row.domesticExchange}:${row.foreignExchange}`,
    asset: row.asset,
    domesticExchange: row.domesticExchange,
    foreignExchange: row.foreignExchange,
    notionalUsdt,
    quantity,
    clientOrderId,
    createdAt: new Date().toISOString(),
    safety: {
      withdrawalEnabled: false,
      autoRebalanceEnabled: false,
      liveMaxOrderNotionalUsdt: state.settings.liveMaxOrderNotionalUsdt,
      domesticInventoryRequired: true,
      routeSupported: LIVE_SUPPORTED_ROUTES.has(`${row.domesticExchange}:${row.foreignExchange}`)
    },
    steps: [
      "BINANCE_SPOT_MARKET_BUY",
      "BINANCE_USDM_MARKET_SHORT",
      "UPBIT_SELL_ONLY_LIMIT_LADDER"
    ],
    responses: []
  };
  if (process.env.LIVE_ORDER_TRANSPORT !== "enabled") {
    return { ...plan, status: "DRY_RUN_LIVE_TRANSPORT_DISABLED" };
  }
  if (process.env.LIVE_STRATEGY_CONFIRMED !== "true") {
    return { ...plan, status: "DRY_RUN_STRATEGY_NOT_CONFIRMED" };
  }
  if (row.domesticExchange !== "upbit" || row.foreignExchange !== "binance") {
    throw new Error(`Unsupported live route ${row.domesticExchange}:${row.foreignExchange}`);
  }
  plan.responses.push(await binanceSpotMarketBuy(row.asset, notionalUsdt, `${clientOrderId}-spot`));
  plan.responses.push(await binanceFuturesMarketShort(row.asset, quantity, `${clientOrderId}-short`));
  for (const order of mmSellPlan.ladder) {
    plan.responses.push(await upbitLimitSell(row.asset, order.quantity, order.price, `${clientOrderId}-sell-${order.level}`));
  }
  return { ...plan, status: "LIVE_ORDERS_SUBMITTED" };
}

function buildLiveReadiness() {
  const requiredEnv = [
    "UPBIT_ACCESS_KEY",
    "UPBIT_SECRET_KEY",
    "BINANCE_API_KEY",
    "BINANCE_API_SECRET"
  ];
  const missing = [];
  for (const key of requiredEnv) if (!process.env[key]) missing.push(key);
  if (process.env.ALLOW_LIVE_ORDERS !== "true") missing.push("ALLOW_LIVE_ORDERS=true");
  if (process.env.LIVE_TRADING !== "true") missing.push("LIVE_TRADING=true");
  if (process.env.LIVE_ORDER_TRANSPORT !== "enabled") missing.push("LIVE_ORDER_TRANSPORT=enabled");
  if (process.env.LIVE_STRATEGY_CONFIRMED !== "true") missing.push("LIVE_STRATEGY_CONFIRMED=true");
  if (process.env.ENABLE_WITHDRAWAL === "true") missing.push("ENABLE_WITHDRAWAL must remain false");
  if (process.env.ENABLE_AUTO_REBALANCE === "true") missing.push("ENABLE_AUTO_REBALANCE must remain false");
  if (process.env.REAL_TRANSFER_STATUS_CONFIRMED !== "true") missing.push("REAL_TRANSFER_STATUS_CONFIRMED=true");
  if (!isLiveArmed()) missing.push("manual live arm");
  if (state.settings.emergencyStop) missing.push("emergency stop off");
  const ready = missing.length === 0;
  state.live.readiness = {
    ready,
    missing,
    supportedRoutes: [...LIVE_SUPPORTED_ROUTES],
    armed: isLiveArmed(),
    armedUntil: state.live.armedUntil ? new Date(state.live.armedUntil).toISOString() : null,
    withdrawalEnabled: false,
    autoRebalanceEnabled: false,
    realTransferStatusConfirmed: process.env.REAL_TRANSFER_STATUS_CONFIRMED === "true",
    maxOrderNotionalUsdt: state.settings.liveMaxOrderNotionalUsdt,
    maxLeverage: state.settings.maxLeverage
  };
  return state.live.readiness;
}

function armLiveTrading(params) {
  const phraseOk = params.get("confirm") === LIVE_ARM_PHRASE;
  const minutes = clamp(Number(params.get("minutes") || 10), 1, 30);
  if (!phraseOk) {
    addRiskEvent("LIVE_ARM_REJECTED", "high", "실거래 arm 확인 문구가 일치하지 않습니다.");
    return { ok: false, error: "CONFIRM_PHRASE_MISMATCH", requiredConfirm: LIVE_ARM_PHRASE };
  }
  state.live.armedUntil = Date.now() + minutes * 60_000;
  state.settings.liveTradingRequested = true;
  state.settings.liveTrading = true;
  addBotEvent("LIVE_ARMED", `실거래가 ${minutes}분 동안 arm 상태가 되었습니다.`);
  return { ok: true, armed: true, armedUntil: new Date(state.live.armedUntil).toISOString(), readiness: buildLiveReadiness() };
}

function disarmLiveTrading(reason) {
  state.live.armedUntil = 0;
  state.settings.liveTrading = false;
  addBotEvent("LIVE_DISARMED", `실거래 arm 해제: ${reason}`);
}

function isLiveArmed() {
  return state.live.armedUntil > Date.now();
}

function addRiskEvent(type, severity, message, payload = {}) {
  state.riskEvents.unshift({ type, severity, message, payload, createdAt: new Date().toISOString() });
  state.riskEvents = state.riskEvents.slice(0, 300);
  state.alerts.unshift({ type, severity, message, createdAt: new Date().toISOString() });
  state.alerts = state.alerts.slice(0, 300);
}

function addBotEvent(type, message, payload = {}) {
  state.botEvents.unshift({ type, message, payload, createdAt: new Date().toISOString() });
  state.botEvents = state.botEvents.slice(0, 300);
}

async function refreshOperationalStatus() {
  await Promise.allSettled([
    refreshBithumbDepositWithdraw(),
    refreshBitgetDepositWithdraw(),
    refreshGateDepositWithdraw(),
    refreshUpbitDepositWithdraw(),
    refreshBinanceDepositWithdraw(),
    refreshHedgeMarkets()
  ]);
}

function summarizeDepositWithdraw() {
  return Object.fromEntries([...DOMESTIC, ...FOREIGN].map((exchange) => {
    const values = Object.values(state.depositWithdraw[exchange] ?? {});
    return [exchange, {
      assets: values.length,
      depositEnabled: values.filter((item) => item.depositEnabled).length,
      withdrawEnabled: values.filter((item) => item.withdrawEnabled).length,
      source: values[0]?.source ?? "none"
    }];
  }));
}

function debugRoute(params) {
  const asset = cleanAsset(params.get("asset"));
  const fromExchange = String(params.get("from") || params.get("foreign") || "").toLowerCase();
  const toExchange = String(params.get("to") || params.get("domestic") || "").toLowerCase();
  if (!asset || !fromExchange || !toExchange) {
    return { ok: false, error: "asset, from, to are required" };
  }
  const rows = buildRows();
  const row = rows.find((item) =>
    item.asset === asset &&
    item.foreignExchange === fromExchange &&
    item.domesticExchange === toExchange
  );
  const transferStatus = row?.transferStatus ?? getTransferStatus(asset, fromExchange, toExchange);
  const hedgeStatus = row ? row.hedgeStatus : chooseHedgeVenue(asset, state.foreign[fromExchange]?.[asset]?.ask);
  const hedgeCandidates = FOREIGN.map((exchange) => getHedgeStatus(asset, exchange, state.foreign[fromExchange]?.[asset]?.ask));
  return {
    ok: true,
    asset,
    route: `${fromExchange}->${toExchange}`,
    row: row ? {
      premiumPercent: row.premiumPercent,
      netPremiumPercent: row.netPremiumPercent,
      domesticBid: row.domesticBid,
      foreignAsk: row.foreignAsk,
      usdtKrw: row.usdtKrw,
      stale: row.stale,
      slippagePercent: row.slippagePercent,
      availableDepthUsdt: row.availableDepthUsdt,
      risk: row.risk
    } : null,
    transferStatus,
    hedgeStatus,
    hedgeCandidates,
    verdict: {
      transferRequired: state.settings.requireTransferStatusForPaper,
      hedgeRequired: state.settings.requireHedgeStatusForPaper,
      tradeBlocked: (state.settings.requireTransferStatusForPaper && transferStatus.ok !== true) ||
        (state.settings.requireHedgeStatusForPaper && hedgeStatus.ok !== true) ||
        (row?.risk?.approved !== true),
      reasons: row?.risk?.reasons ?? ["ROW_NOT_FOUND"]
    }
  };
}

function withdrawalOptions() {
  const routes = {};
  for (const sourceExchange of WITHDRAWAL_SOURCE_EXCHANGES) {
    for (const destinationExchange of WITHDRAWAL_DESTINATION_EXCHANGES) {
      for (const asset of WITHDRAWAL_ASSETS) {
        routes[withdrawalRouteKey(sourceExchange, destinationExchange, asset)] = withdrawalNetworkOptions(sourceExchange, destinationExchange, asset);
      }
    }
  }
  return {
    ok: true,
    mode: "DEMO_ONLY",
    sourceExchanges: WITHDRAWAL_SOURCE_EXCHANGES,
    destinationExchanges: WITHDRAWAL_DESTINATION_EXCHANGES,
    assets: WITHDRAWAL_ASSETS,
    routes,
    executionAdapters: WITHDRAWAL_EXECUTION_ADAPTERS,
    safety: withdrawalSafety()
  };
}

async function executionPreflight(payload) {
  const asset = cleanAsset(payload.asset);
  const sourceExchange = normalizeRuntimeExchange(payload.sourceExchange || payload.buyExchange || payload.foreignExchange);
  const destinationExchange = normalizeRuntimeExchange(payload.destinationExchange || payload.sellExchange || payload.domesticExchange);
  const manualNetwork = normalizeNetwork(payload.manualNetwork || payload.network || "");
  const amount = Number(payload.amount ?? payload.quantity ?? 0);
  const messages = [];
  if (!asset) messages.push("ASSET_REQUIRED");
  if (!sourceExchange) messages.push("SOURCE_EXCHANGE_REQUIRED");
  if (!destinationExchange) messages.push("DESTINATION_EXCHANGE_REQUIRED");
  if (sourceExchange && destinationExchange && sourceExchange === destinationExchange) messages.push("SOURCE_DESTINATION_SAME");
  if (messages.length) return { ok: true, canExecute: false, blockedBy: "INVALID_PREFLIGHT_INPUT", messages };

  const result = {
    ok: true,
    canExecute: false,
    mode: "API_ONLY_EXECUTION_PREFLIGHT",
    asset,
    sourceExchange,
    destinationExchange,
    amount: Number.isFinite(amount) ? amount : 0,
    manualNetwork: manualNetwork || "",
    source: null,
    destination: null,
    commonNetworks: [],
    selectedNetwork: null,
    address: null,
    messages: []
  };

  const startedAt = Date.now();
  const [source, destination] = await Promise.allSettled([
    cachedApiCapability("withdraw", sourceExchange, asset, () => apiWithdrawalCapabilities(sourceExchange, asset)),
    cachedApiCapability("deposit", destinationExchange, asset, () => apiDepositCapabilities(destinationExchange, asset))
  ]);
  result.source = source.status === "fulfilled" ? source.value : apiCapabilityError(source.reason, sourceExchange, asset, "withdraw");
  result.destination = destination.status === "fulfilled" ? destination.value : apiCapabilityError(destination.reason, destinationExchange, asset, "deposit");

  if (!result.source.ok) result.messages.push(`출발 거래소 API 출금 네트워크 확인 실패: ${result.source.error}`);
  if (!result.destination.ok) result.messages.push(`도착 거래소 API 입금 네트워크/주소 확인 실패: ${result.destination.error}`);
  if (!result.source.ok || !result.destination.ok) {
    result.blockedBy = "API_NETWORK_OR_ADDRESS_CHECK_FAILED";
    addRiskEvent("EXECUTION_PREFLIGHT_BLOCKED", "high", result.messages.join(" · "), { asset, sourceExchange, destinationExchange });
    return result;
  }

  const sourceNetworks = result.source.networks.filter((item) => item.withdrawEnabled);
  const destinationNetworks = result.destination.networks.filter((item) => item.depositEnabled && item.address);
  const destinationByNetwork = new Map(destinationNetworks.map((item) => [item.normalizedNetworkCode, item]));
  const common = sourceNetworks
    .filter((item) => destinationByNetwork.has(item.normalizedNetworkCode))
    .map((item) => ({
      ...item,
      destinationNetworkCode: destinationByNetwork.get(item.normalizedNetworkCode).networkCode,
      address: destinationByNetwork.get(item.normalizedNetworkCode).address,
      tag: destinationByNetwork.get(item.normalizedNetworkCode).tag || "",
      depositSource: destinationByNetwork.get(item.normalizedNetworkCode).source
    }))
    .sort((a, b) => {
      if (a.withdrawFeeKnown !== b.withdrawFeeKnown) return a.withdrawFeeKnown ? -1 : 1;
      return (a.withdrawFee ?? Number.MAX_SAFE_INTEGER) - (b.withdrawFee ?? Number.MAX_SAFE_INTEGER);
    });
  result.commonNetworks = common;

  const selected = manualNetwork
    ? common.find((item) => item.normalizedNetworkCode === manualNetwork)
    : common[0];
  if (!common.length) {
    result.blockedBy = "NO_API_CONFIRMED_COMMON_NETWORK";
    result.messages.push("API로 확인된 출금 가능 네트워크와 입금 가능 네트워크의 교집합이 없습니다.");
    addRiskEvent("EXECUTION_PREFLIGHT_BLOCKED", "high", result.messages.join(" · "), { asset, sourceExchange, destinationExchange, sourceNetworks, destinationNetworks });
    return result;
  }
  if (manualNetwork && !selected) {
    result.blockedBy = "MANUAL_NETWORK_NOT_API_CONFIRMED";
    result.messages.push(`수동 입력 네트워크 ${manualNetwork}가 API 확인 교집합에 없습니다.`);
    addRiskEvent("EXECUTION_PREFLIGHT_BLOCKED", "high", result.messages.join(" · "), { asset, sourceExchange, destinationExchange, manualNetwork, common });
    return result;
  }

  result.selectedNetwork = {
    normalizedNetworkCode: selected.normalizedNetworkCode,
    sourceNetworkCode: selected.networkCode,
    destinationNetworkCode: selected.destinationNetworkCode,
    withdrawFee: selected.withdrawFee,
    withdrawFeeKnown: selected.withdrawFeeKnown,
    withdrawFeeSource: selected.withdrawFeeSource || selected.source,
    withdrawMin: selected.withdrawMin,
    withdrawIntegerMultiple: selected.withdrawIntegerMultiple,
    requiresTag: Boolean(selected.requiresTag || selected.tag)
  };
  result.address = {
    exchange: destinationExchange,
    asset,
    networkCode: selected.destinationNetworkCode,
    normalizedNetworkCode: selected.normalizedNetworkCode,
    address: selected.address,
    tag: selected.tag || "",
    source: selected.depositSource
  };
  if (!selected.address) {
    result.blockedBy = "API_DEPOSIT_ADDRESS_NOT_FOUND";
    result.messages.push("도착 거래소 API에서 입금 주소를 받지 못했습니다.");
    return result;
  }
  if (!selected.withdrawFeeKnown) {
    result.blockedBy = "WITHDRAW_FEE_UNCONFIRMED";
    result.messages.push("출금 수수료가 API에서 확인되지 않아 예상 차익 계산을 진행하지 않습니다.");
    addRiskEvent("EXECUTION_PREFLIGHT_BLOCKED", "high", result.messages.join(" · "), { asset, sourceExchange, destinationExchange, selectedNetwork: selected.normalizedNetworkCode });
    return result;
  }
  if (Number.isFinite(amount) && amount > 0 && selected.withdrawMin && amount < selected.withdrawMin) {
    result.blockedBy = "WITHDRAW_MIN_NOT_MET";
    result.messages.push(`출금 최소 수량 미달: ${formatPlain(amount)} < ${formatPlain(selected.withdrawMin)} ${asset}`);
    return result;
  }

  result.canExecute = true;
  result.latencyMs = Date.now() - startedAt;
  result.messages.push("API 검증 통과: 주소록/.env 주소 fallback 없이 거래 실행 전 네트워크와 입금 주소를 확인했습니다.");
  addBotEvent("EXECUTION_PREFLIGHT_OK", `${asset} ${sourceExchange}->${destinationExchange} ${selected.normalizedNetworkCode} API-only 확인`, {
    source: selected.source,
    destination: selected.depositSource
  });
  return result;
}

function normalizeRuntimeExchange(exchange) {
  const value = String(exchange || "").trim().toLowerCase();
  const map = {
    upbit: "Upbit",
    bithumb: "Bithumb",
    binance: "Binance",
    bybit: "Bybit",
    bitget: "Bitget",
    gate: "Gate.io",
    gateio: "Gate.io",
    "gate.io": "Gate.io"
  };
  return map[value] || "";
}

function apiCapabilityError(error, exchange, asset, kind) {
  return {
    ok: false,
    exchange,
    asset,
    kind,
    source: "API_ONLY",
    networks: [],
    error: error?.message || String(error)
  };
}

async function cachedApiCapability(kind, exchange, asset, loader) {
  const key = `${kind}:${exchange}:${asset}`;
  const now = Date.now();
  const cached = state.executionApiCache[key];
  if (cached && now - cached.cachedAt < PREFLIGHT_CAPABILITY_CACHE_MS) {
    return {
      ...cached.value,
      cache: {
        hit: true,
        ageMs: now - cached.cachedAt,
        ttlMs: PREFLIGHT_CAPABILITY_CACHE_MS
      }
    };
  }
  const startedAt = Date.now();
  const value = await loader();
  const enriched = {
    ...value,
    cache: {
      hit: false,
      ageMs: 0,
      ttlMs: PREFLIGHT_CAPABILITY_CACHE_MS,
      latencyMs: Date.now() - startedAt
    }
  };
  state.executionApiCache[key] = { cachedAt: now, value: enriched };
  return enriched;
}

async function apiWithdrawalCapabilities(exchange, asset) {
  if (exchange === "Binance") return binanceApiWithdrawalCapabilities(asset);
  if (exchange === "Bybit") return bybitApiWithdrawalCapabilities(asset);
  if (exchange === "Bitget") return bitgetApiWithdrawalCapabilities(asset);
  if (exchange === "Gate.io") return gateApiWithdrawalCapabilities(asset);
  if (exchange === "Upbit") return upbitApiWithdrawalCapabilities(asset);
  if (exchange === "Bithumb") return bithumbApiWithdrawalCapabilities(asset);
  return { ok: false, exchange, asset, kind: "withdraw", source: "API_ONLY", networks: [], error: "UNSUPPORTED_SOURCE_EXCHANGE" };
}

async function apiDepositCapabilities(exchange, asset) {
  if (exchange === "Upbit") return upbitApiDepositCapabilities(asset);
  if (exchange === "Binance") return binanceApiDepositCapabilities(asset);
  if (exchange === "Bybit") return bybitApiDepositCapabilities(asset);
  if (exchange === "Bitget") return bitgetApiDepositCapabilities(asset);
  if (exchange === "Gate.io") return gateApiDepositCapabilities(asset);
  if (exchange === "Bithumb") return bithumbApiDepositCapabilities(asset);
  return { ok: false, exchange, asset, kind: "deposit", source: "API_ONLY", networks: [], error: "UNSUPPORTED_DESTINATION_EXCHANGE" };
}

function withdrawalQuote(payload) {
  const sourceExchange = normalizeWithdrawalExchange(payload.sourceExchange, WITHDRAWAL_SOURCE_EXCHANGES);
  const destinationExchange = normalizeWithdrawalExchange(payload.destinationExchange, WITHDRAWAL_DESTINATION_EXCHANGES);
  const asset = cleanAsset(payload.asset);
  const network = normalizeNetwork(payload.network || "");
  const manualNetwork = normalizeNetwork(payload.manualNetwork || "");
  const amount = Number(payload.amount);
  const knownOptions = withdrawalNetworkOptions(sourceExchange, destinationExchange, asset);
  const option = knownOptions.find((item) => item.normalizedNetworkCode === network) ||
    (manualNetwork ? { ...manualWithdrawalOption(sourceExchange, destinationExchange, asset, manualNetwork, knownOptions), depositEnabled: true, withdrawEnabled: true } : null);
  if (!option) {
    return {
      ok: true,
      canSubmit: false,
      messages: ["공통 지원 네트워크를 찾을 수 없습니다."],
      option: null,
      address: resolveWithdrawalAddress(destinationExchange, asset, network),
      estimatedFee: 0,
      estimatedReceiveAmount: 0,
      withdrawAmount: 0,
      payloadPreview: null,
      adapterAvailable: WITHDRAWAL_EXECUTION_ADAPTERS[sourceExchange] === true,
      executionMode: "DEMO_ONLY",
      safety: withdrawalSafety()
    };
  }
  const address = resolveWithdrawalAddress(destinationExchange, asset, option.normalizedNetworkCode);
  const messages = [];
  if (!option.depositEnabled) messages.push("도착 거래소 입금이 중지된 네트워크입니다.");
  if (!option.withdrawEnabled) messages.push("출발 거래소 출금이 중지된 네트워크입니다.");
  if (option.manualOverride) messages.push("검증 통과: 수동 네트워크 입력 사용. 자동 교집합 인식 결과가 아니므로 실제 전송 전 거래소 화면에서 체인을 재확인해야 합니다.");
  if (!Number.isFinite(amount) || amount <= 0) messages.push("수량을 0보다 크게 입력하세요.");
  if (Number.isFinite(amount) && amount < option.withdrawMin) messages.push(`최소 출금 수량은 ${formatPlain(option.withdrawMin)} ${asset}입니다.`);
  if (Number.isFinite(amount) && Math.abs(quantizeAmount(amount, option.withdrawIntegerMultiple) - amount) > 1e-12) {
    messages.push(`수량 정밀도는 ${formatPlain(option.withdrawIntegerMultiple)} 단위여야 합니다.`);
  }
  const receive = Number.isFinite(amount) ? amount - option.withdrawFee : 0;
  if (receive <= 0) messages.push("수수료 차감 후 예상 수령량이 0 이하입니다.");
  if (!address.address) messages.push("도착 거래소 입금 주소가 없습니다.");
  if (!messages.length) messages.push("검증 통과: 실제 출금 없이 데모 전송 요청을 만들 수 있습니다.");
  const estimatedReceiveAmount = Math.max(0, receive);
  const withdrawAmount = sourceExchange === "Bithumb" ? estimatedReceiveAmount : amount;
  const payloadPreview = buildWithdrawalPayloadPreview({
    sourceExchange,
    destinationExchange,
    asset,
    network: option.normalizedNetworkCode,
    amount,
    withdrawAmount,
    address,
    option
  });
  return {
    ok: true,
    canSubmit: !messages.some((message) => !message.startsWith("검증 통과")),
    messages,
    option,
    address,
    estimatedFee: option.withdrawFee,
    estimatedReceiveAmount,
    withdrawAmount,
    payloadPreview,
    adapterAvailable: WITHDRAWAL_EXECUTION_ADAPTERS[sourceExchange] === true,
    executionMode: withdrawalExecutionMode(sourceExchange),
    actualSubmitAllowed: canSubmitRealWithdrawal(sourceExchange),
    safety: withdrawalSafety()
  };
}

function buildWithdrawalPayloadPreview({ sourceExchange, destinationExchange, asset, network, amount, withdrawAmount, address, option }) {
  const common = {
    source_exchange: sourceExchange,
    destination_exchange: destinationExchange,
    asset,
    network,
    requested_total_amount: formatPlain(amount),
    withdraw_fee: formatPlain(option.withdrawFee),
    api_amount: formatPlain(withdrawAmount),
    address: address.address,
    tag: address.tag || "",
    address_source: address.source || "unknown",
    adapter_available: WITHDRAWAL_EXECUTION_ADAPTERS[sourceExchange] === true,
    live_execute_requires: ["ENABLE_WITHDRAWAL=true", "WITHDRAWAL_TRANSPORT=enabled", "manual approval"],
    demo_only: true
  };
  if (sourceExchange === "Bithumb") {
    return {
      currency: asset,
      net_type: network,
      amount: formatPlain(withdrawAmount),
      address: address.address,
      exchange_name: destinationExchange,
      receiver_type: process.env.BITHUMB_RECEIVER_TYPE || "personal",
      receiver_ko_name: payloadName("ko", destinationExchange),
      receiver_en_name: payloadName("en", destinationExchange),
      secondary_address: address.tag || "",
      preview_note: "Bithumb 출금 payload는 수수료 차감 후 순출금 수량을 amount로 사용합니다.",
      address_source: address.source || "unknown",
      demo_only: true
    };
  }
  if (sourceExchange === "Upbit") {
    return {
      currency: asset,
      net_type: network,
      amount: formatPlain(withdrawAmount),
      address: address.address,
      secondary_address: address.tag || "",
      transaction_type: "default",
      address_source: address.source || "unknown",
      demo_only: true
    };
  }
  if (sourceExchange === "Binance") {
    return removeEmpty({
      coin: asset,
      network,
      amount: formatPlain(withdrawAmount),
      address: address.address,
      addressTag: address.tag || "",
      walletType: process.env.BINANCE_WITHDRAW_WALLET_TYPE || "",
      address_source: address.source || "unknown",
      demo_only: true
    });
  }
  if (sourceExchange === "Bybit") {
    return removeEmpty({
      coin: asset,
      chain: network,
      amount: formatPlain(withdrawAmount),
      address: address.address,
      tag: address.tag || "",
      accountType: process.env.BYBIT_WITHDRAW_ACCOUNT_TYPE || "FUND",
      forceChain: 1,
      requestId: `wd-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      beneficiary: process.env.BYBIT_WITHDRAW_BENEFICIARY || "",
      address_source: address.source || "unknown",
      demo_only: true
    });
  }
  if (sourceExchange === "Bitget") {
    return removeEmpty({
      coin: asset,
      transferType: "on_chain",
      address: address.address,
      chain: network,
      size: formatPlain(withdrawAmount),
      tag: address.tag || "",
      remark: address.tag ? `memo:${address.tag}` : "",
      identityType: process.env.BITGET_WITHDRAW_IDENTITY_TYPE || "",
      memberCode: process.env.BITGET_WITHDRAW_MEMBER_CODE || "",
      clientOid: `wd-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      address_source: address.source || "unknown",
      demo_only: true
    });
  }
  return common;
}

function removeEmpty(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item != null));
}

function payloadName(locale, exchange) {
  const names = {
    ko: {
      Upbit: "업비트",
      Bithumb: "빗썸",
      Binance: "바이낸스",
      Bybit: "바이비트",
      Bitget: "비트겟",
      "Gate.io": "게이트아이오"
    },
    en: {
      Upbit: "UPBIT",
      Bithumb: "BITHUMB",
      Binance: "BINANCE",
      Bybit: "BYBIT",
      Bitget: "BITGET",
      "Gate.io": "GATEIO"
    }
  };
  return names[locale]?.[exchange] ?? exchange;
}

function withdrawalSubmit(payload) {
  const asset = cleanAsset(payload.asset);
  const quote = withdrawalQuote(payload);
  if (state.settings.emergencyStop) return { ok: true, accepted: false, reason: "EMERGENCY_STOP", quote, safety: withdrawalSafety() };
  if (cleanAsset(payload.confirmAsset) !== asset) return { ok: true, accepted: false, reason: "ASSET_CONFIRM_MISMATCH", quote, safety: withdrawalSafety() };
  if (payload.manualApproval !== true && payload.manualApproval !== "true") return { ok: true, accepted: false, reason: "MANUAL_APPROVAL_REQUIRED", quote, safety: withdrawalSafety() };
  if (!quote.canSubmit) return { ok: true, accepted: false, reason: "VALIDATION_FAILED", quote, safety: withdrawalSafety() };
  if (String(payload.executionMode || "").toUpperCase() === "LIVE-EXECUTE" && !quote.actualSubmitAllowed) {
    return { ok: true, accepted: false, reason: "LIVE_WITHDRAWAL_LOCKED_OR_ADAPTER_UNAVAILABLE", quote, safety: withdrawalSafety() };
  }

  const now = new Date().toISOString();
  const request = {
    id: `WD-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
    withdrawOrderId: `DEMO-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
    sourceExchange: normalizeWithdrawalExchange(payload.sourceExchange, WITHDRAWAL_SOURCE_EXCHANGES),
    destinationExchange: normalizeWithdrawalExchange(payload.destinationExchange, WITHDRAWAL_DESTINATION_EXCHANGES),
    asset,
    network: quote.option.normalizedNetworkCode,
    amount: Number(payload.amount),
    fee: quote.estimatedFee,
    estimatedReceiveAmount: quote.estimatedReceiveAmount,
    withdrawAmount: quote.withdrawAmount,
    address: quote.address.address,
    tag: quote.address.tag,
    payloadPreview: quote.payloadPreview,
    sourceStatus: "SUBMITTED",
    destinationStatus: "PENDING",
    travelRuleStatus: quote.address.exchange === "Upbit" ? "PENDING" : "NOT_REQUIRED",
    txid: "",
    finalResult: "IN_PROGRESS",
    demoMode: true,
    executionMode: quote.executionMode,
    adapterAvailable: quote.adapterAvailable,
    safety: withdrawalSafety(),
    events: [
      { at: now, message: "데모 출금/전송 요청 생성" },
      { at: now, message: "실제 출금 API 호출 없음" },
      { at: now, message: "withdrawalEnabled=false 안전 정책 유지" }
    ]
  };
  state.withdrawalRequests.unshift(request);
  state.withdrawalRequests = state.withdrawalRequests.slice(0, 100);
  addBotEvent("DEMO_WITHDRAWAL_CREATED", `${request.sourceExchange} -> ${request.destinationExchange} ${request.amount} ${asset}`, { id: request.id });
  return { ok: true, accepted: true, request, quote, safety: withdrawalSafety() };
}

function withdrawalAdvance(id) {
  const request = state.withdrawalRequests.find((item) => item.id === id);
  if (!request) return { ok: false, error: "WITHDRAWAL_NOT_FOUND" };
  if (request.finalResult !== "IN_PROGRESS") return { ok: true, request };
  if (request.sourceStatus === "SUBMITTED") {
    updateWithdrawalRequest(request, "PROCESSING", request.destinationStatus, request.travelRuleStatus, "IN_PROGRESS", "출발 거래소 데모 처리 중");
  } else if (request.sourceStatus === "PROCESSING") {
    request.txid = request.txid || `0xDEMO${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
    const destinationStatus = request.destinationExchange === "Upbit" ? "TRAVEL_RULE_SUSPECTED" : "PROCESSING";
    const travelRuleStatus = request.destinationExchange === "Upbit" ? "REQUIRED" : request.travelRuleStatus;
    updateWithdrawalRequest(request, "COMPLETED", destinationStatus, travelRuleStatus, "IN_PROGRESS", "출발 거래소 데모 출금 완료");
  } else if (request.destinationExchange === "Upbit" && request.destinationStatus === "TRAVEL_RULE_SUSPECTED") {
    updateWithdrawalRequest(request, "COMPLETED", "PROCESSING", "VERIFIED", "IN_PROGRESS", "Upbit 트래블룰 데모 검증 완료");
  } else if (["PENDING", "PROCESSING"].includes(request.destinationStatus)) {
    const destinationStatus = request.destinationExchange === "Upbit" ? "ACCEPTED" : "DEPOSIT_ACCEPTED";
    updateWithdrawalRequest(request, "COMPLETED", destinationStatus, request.travelRuleStatus, "COMPLETED", "도착 거래소 데모 입금 완료");
  }
  return { ok: true, request };
}

function updateWithdrawalRequest(request, sourceStatus, destinationStatus, travelRuleStatus, finalResult, message) {
  const now = new Date().toISOString();
  request.updatedAt = now;
  request.sourceStatus = sourceStatus;
  request.destinationStatus = destinationStatus;
  request.travelRuleStatus = travelRuleStatus;
  request.finalResult = finalResult;
  request.events.push({ at: now, message });
}

function networkCapability({ exchange, asset, networkCode, source, withdrawEnabled = false, depositEnabled = false, withdrawFee = null, withdrawMin = 0, withdrawIntegerMultiple = 0.000001, address = "", tag = "", requiresTag = false, withdrawFeeSource = "" }) {
  const normalizedNetworkCode = normalizeNetwork(networkCode);
  const parsedWithdrawFee = parseOptionalNumber(withdrawFee);
  return {
    exchange,
    asset,
    networkCode: String(networkCode || normalizedNetworkCode),
    normalizedNetworkCode,
    withdrawEnabled: Boolean(withdrawEnabled),
    depositEnabled: Boolean(depositEnabled),
    withdrawFee: parsedWithdrawFee ?? 0,
    withdrawFeeKnown: parsedWithdrawFee != null,
    withdrawFeeSource: withdrawFeeSource || (parsedWithdrawFee != null ? source : ""),
    withdrawMin: Number(withdrawMin || 0),
    withdrawIntegerMultiple: Number(withdrawIntegerMultiple || 0.000001),
    address: address || "",
    tag: tag || "",
    requiresTag: Boolean(requiresTag || tag),
    source
  };
}

function parseOptionalNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function binanceApiWithdrawalCapabilities(asset) {
  const response = await signedBinanceRequest("spot", "GET", "/sapi/v1/capital/config/getall", {});
  const coin = Array.isArray(response.body) ? response.body.find((item) => item.coin === asset) : null;
  if (!coin) return { ok: false, exchange: "Binance", asset, kind: "withdraw", source: "BINANCE_PRIVATE_CAPITAL_CONFIG", networks: [], error: "ASSET_NOT_FOUND" };
  const networks = (coin.networkList || []).map((network) => networkCapability({
    exchange: "Binance",
    asset,
    networkCode: network.network,
    source: "BINANCE_PRIVATE_CAPITAL_CONFIG",
    withdrawEnabled: network.withdrawEnable === true,
    depositEnabled: network.depositEnable === true,
    withdrawFee: network.withdrawFee,
    withdrawMin: network.withdrawMin,
    withdrawIntegerMultiple: network.withdrawIntegerMultiple || 0.000001,
    requiresTag: Boolean(network.memoRegex)
  }));
  return { ok: true, exchange: "Binance", asset, kind: "withdraw", source: "BINANCE_PRIVATE_CAPITAL_CONFIG", networks };
}

async function binanceApiDepositCapabilities(asset) {
  const caps = await binanceApiWithdrawalCapabilities(asset);
  const networks = [];
  for (const network of caps.networks.filter((item) => item.depositEnabled)) {
    try {
      const addressResponse = await signedBinanceRequest("spot", "GET", "/sapi/v1/capital/deposit/address", { coin: asset, network: network.networkCode });
      const body = addressResponse.body || {};
      networks.push(networkCapability({
        ...network,
        depositEnabled: Boolean(body.address),
        address: body.address || "",
        tag: body.tag || "",
        source: "BINANCE_PRIVATE_DEPOSIT_ADDRESS"
      }));
    } catch (error) {
      networks.push(networkCapability({
        ...network,
        depositEnabled: false,
        source: "BINANCE_PRIVATE_DEPOSIT_ADDRESS",
        address: "",
        tag: ""
      }));
    }
  }
  return { ok: true, exchange: "Binance", asset, kind: "deposit", source: "BINANCE_PRIVATE_DEPOSIT_ADDRESS", networks };
}

async function upbitApiWithdrawalCapabilities(asset) {
  const data = await signedUpbitGet("/v1/status/wallet", { markets: `KRW-${asset}` });
  const rows = Array.isArray(data) ? data : [];
  const networks = rows
    .filter((item) => String(item.currency || "").toUpperCase() === asset || String(item.market || "").toUpperCase() === `KRW-${asset}`)
    .map((item) => {
      const state = String(item.wallet_state || item.state || "").toLowerCase();
      const net = item.net_type || item.network || item.currency || asset;
      return networkCapability({
        exchange: "Upbit",
        asset,
        networkCode: net,
        source: "UPBIT_PRIVATE_WALLET_STATUS",
        withdrawEnabled: ["working", "withdraw_only"].includes(state),
        depositEnabled: ["working", "deposit_only"].includes(state)
      });
    });
  return { ok: true, exchange: "Upbit", asset, kind: "withdraw", source: "UPBIT_PRIVATE_WALLET_STATUS", networks };
}

async function upbitApiDepositCapabilities(asset) {
  const data = await signedUpbitGet("/v1/deposits/coin_addresses", {});
  const rows = Array.isArray(data) ? data : [];
  const networks = rows
    .filter((item) => String(item.currency || "").toUpperCase() === asset)
    .map((item) => networkCapability({
      exchange: "Upbit",
      asset,
      networkCode: item.net_type || item.network || asset,
      source: "UPBIT_PRIVATE_DEPOSIT_ADDRESSES",
      depositEnabled: Boolean(item.deposit_address),
      withdrawEnabled: false,
      address: item.deposit_address || "",
      tag: item.secondary_address || item.memo || ""
    }));
  if (!networks.length) return { ok: false, exchange: "Upbit", asset, kind: "deposit", source: "UPBIT_PRIVATE_DEPOSIT_ADDRESSES", networks, error: "DEPOSIT_ADDRESS_NOT_FOUND" };
  return { ok: true, exchange: "Upbit", asset, kind: "deposit", source: "UPBIT_PRIVATE_DEPOSIT_ADDRESSES", networks };
}

async function bybitApiWithdrawalCapabilities(asset) {
  const response = await signedBybitRequest("GET", "/v5/asset/coin/query-info", { coin: asset });
  const rows = response.body?.result?.rows || response.body?.result?.list || [];
  const coin = rows.find((item) => String(item.coin || "").toUpperCase() === asset) || rows[0];
  if (!coin) return { ok: false, exchange: "Bybit", asset, kind: "withdraw", source: "BYBIT_PRIVATE_COIN_INFO", networks: [], error: "ASSET_NOT_FOUND" };
  const networks = (coin.chains || coin.chain || []).map((chain) => networkCapability({
    exchange: "Bybit",
    asset,
    networkCode: chain.chain || chain.chainType || chain.chainName,
    source: "BYBIT_PRIVATE_COIN_INFO",
    withdrawEnabled: String(chain.chainWithdraw || chain.withdrawEnable || chain.withdrawable).toLowerCase() !== "0" && String(chain.chainWithdraw || chain.withdrawEnable || chain.withdrawable).toLowerCase() !== "false",
    depositEnabled: String(chain.chainDeposit || chain.depositEnable || chain.depositable).toLowerCase() !== "0" && String(chain.chainDeposit || chain.depositEnable || chain.depositable).toLowerCase() !== "false",
    withdrawFee: chain.withdrawFee || chain.withdrawFeeFixed,
    withdrawMin: chain.withdrawMin || chain.minWithdrawAmt,
    withdrawIntegerMultiple: chain.withdrawPrecision ? 1 / Math.pow(10, Number(chain.withdrawPrecision)) : 0.000001,
    requiresTag: Boolean(chain.needTag)
  }));
  return { ok: true, exchange: "Bybit", asset, kind: "withdraw", source: "BYBIT_PRIVATE_COIN_INFO", networks };
}

async function bybitApiDepositCapabilities(asset) {
  const source = await bybitApiWithdrawalCapabilities(asset);
  const networks = [];
  for (const network of source.networks.filter((item) => item.depositEnabled)) {
    try {
      const response = await signedBybitRequest("GET", "/v5/asset/deposit/query-address", { coin: asset, chainType: network.networkCode });
      const result = response.body?.result || {};
      const chains = result.chains || result.chain || [];
      const addressRow = Array.isArray(chains) ? chains[0] : result;
      networks.push(networkCapability({
        ...network,
        depositEnabled: Boolean(addressRow.addressDeposit || addressRow.address),
        address: addressRow.addressDeposit || addressRow.address || "",
        tag: addressRow.tagDeposit || addressRow.tag || "",
        source: "BYBIT_PRIVATE_DEPOSIT_ADDRESS"
      }));
    } catch {
      networks.push(networkCapability({ ...network, depositEnabled: false, source: "BYBIT_PRIVATE_DEPOSIT_ADDRESS" }));
    }
  }
  return { ok: true, exchange: "Bybit", asset, kind: "deposit", source: "BYBIT_PRIVATE_DEPOSIT_ADDRESS", networks };
}

async function bitgetApiWithdrawalCapabilities(asset) {
  if (!process.env.BITGET_API_KEY || !process.env.BITGET_API_SECRET || !process.env.BITGET_API_PASSPHRASE) {
    throw new Error("Missing Bitget API credentials");
  }
  const response = await fetchJson("https://api.bitget.com/api/v2/spot/public/coins");
  const coin = (response.data || []).find((item) => String(item.coin || "").toUpperCase() === asset);
  if (!coin) return { ok: false, exchange: "Bitget", asset, kind: "withdraw", source: "BITGET_PUBLIC_COINS_API", networks: [], error: "ASSET_NOT_FOUND" };
  const networks = (coin.chains || []).map((chain) => networkCapability({
    exchange: "Bitget",
    asset,
    networkCode: chain.chain,
    source: "BITGET_PUBLIC_COINS_API",
    withdrawEnabled: String(chain.withdrawable) === "true",
    depositEnabled: String(chain.rechargeable) === "true",
    withdrawFee: chain.withdrawFee || chain.withdrawalFee,
    withdrawMin: chain.withdrawMin || chain.minWithdrawAmount,
    withdrawIntegerMultiple: 0.000001,
    requiresTag: Boolean(chain.needTag)
  }));
  return { ok: true, exchange: "Bitget", asset, kind: "withdraw", source: "BITGET_PUBLIC_COINS_API", networks };
}

async function bitgetApiDepositCapabilities(asset) {
  const source = await bitgetApiWithdrawalCapabilities(asset);
  const networks = [];
  for (const network of source.networks.filter((item) => item.depositEnabled)) {
    try {
      const response = await signedBitgetRequest("GET", "/api/v2/spot/wallet/deposit-address", { coin: asset, chain: network.networkCode });
      const body = response.body?.data || {};
      networks.push(networkCapability({
        ...network,
        depositEnabled: Boolean(body.address),
        address: body.address || "",
        tag: body.tag || body.memo || "",
        source: "BITGET_PRIVATE_DEPOSIT_ADDRESS"
      }));
    } catch {
      networks.push(networkCapability({ ...network, depositEnabled: false, source: "BITGET_PRIVATE_DEPOSIT_ADDRESS" }));
    }
  }
  return { ok: true, exchange: "Bitget", asset, kind: "deposit", source: "BITGET_PRIVATE_DEPOSIT_ADDRESS", networks };
}

async function gateApiWithdrawalCapabilities(asset) {
  if (!process.env.GATE_API_KEY || !process.env.GATE_API_SECRET) {
    throw new Error("Missing Gate API credentials");
  }
  const currencies = await fetchJson("https://api.gateio.ws/api/v4/spot/currencies");
  const item = currencies.find((row) => String(row.currency || "").toUpperCase() === asset);
  if (!item) return { ok: false, exchange: "Gate.io", asset, kind: "withdraw", source: "GATE_PUBLIC_CURRENCIES_API", networks: [], error: "ASSET_NOT_FOUND" };
  const chains = Array.isArray(item.chains) ? item.chains : [];
  const networks = chains.map((chain) => networkCapability({
    exchange: "Gate.io",
    asset,
    networkCode: chain.name || chain.chain || chain,
    source: "GATE_PUBLIC_CURRENCIES_API",
    withdrawEnabled: chain.withdraw_disabled !== true && item.withdraw_disabled !== true && item.withdraw_delayed !== true,
    depositEnabled: chain.deposit_disabled !== true && item.deposit_disabled !== true,
    withdrawFee: chain.withdraw_txfee || chain.withdraw_fee || 0,
    withdrawMin: chain.withdraw_amount_mini || 0,
    withdrawIntegerMultiple: 0.000001
  }));
  return { ok: true, exchange: "Gate.io", asset, kind: "withdraw", source: "GATE_PUBLIC_CURRENCIES_API", networks };
}

async function gateApiDepositCapabilities(asset) {
  return { ok: false, exchange: "Gate.io", asset, kind: "deposit", source: "API_ONLY", networks: [], error: "GATE_DEPOSIT_ADDRESS_API_NOT_IMPLEMENTED" };
}

async function bithumbApiWithdrawalCapabilities(asset) {
  const data = await fetchJson(`https://api.bithumb.com/public/assetsstatus/multichain/${asset}`);
  const feeByNetwork = await bithumbFeeByNetwork(asset);
  if (data.status !== "0000") return { ok: false, exchange: "Bithumb", asset, kind: "withdraw", source: "BITHUMB_PUBLIC_MULTICHAIN_STATUS", networks: [], error: `BITHUMB_STATUS_${data.status || "UNKNOWN"}` };
  const rows = Array.isArray(data.data) ? data.data : Object.values(data.data || {});
  const networks = rows.map((item) => {
    const networkCode = item.net_type || item.network || item.currency;
    const fee = feeByNetwork[normalizeNetwork(networkCode)] || {};
    return networkCapability({
      exchange: "Bithumb",
      asset,
      networkCode,
      source: "BITHUMB_PUBLIC_MULTICHAIN_STATUS",
      withdrawEnabled: Number(item.withdrawal_status) === 1,
      depositEnabled: Number(item.deposit_status) === 1,
      withdrawFee: estimateWithdrawFeeFromPolicy(fee, null),
      withdrawMin: fee.withdrawMin,
      withdrawFeeSource: fee.source
    });
  });
  return { ok: true, exchange: "Bithumb", asset, kind: "withdraw", source: "BITHUMB_PUBLIC_MULTICHAIN_STATUS", networks };
}

async function bithumbApiDepositCapabilities(asset) {
  const status = await bithumbApiWithdrawalCapabilities(asset);
  const networks = [];
  for (const network of status.networks.filter((item) => item.depositEnabled)) {
    try {
      const address = await signedBithumbGet("/v1/deposits/coin_address", { currency: asset, net_type: network.networkCode });
      networks.push(networkCapability({
        ...network,
        depositEnabled: Boolean(address.deposit_address || address.address),
        address: address.deposit_address || address.address || "",
        tag: address.secondary_address || address.memo || "",
        source: "BITHUMB_PRIVATE_DEPOSIT_ADDRESS"
      }));
    } catch {
      networks.push(networkCapability({ ...network, depositEnabled: false, source: "BITHUMB_PRIVATE_DEPOSIT_ADDRESS" }));
    }
  }
  return { ok: true, exchange: "Bithumb", asset, kind: "deposit", source: "BITHUMB_PRIVATE_DEPOSIT_ADDRESS", networks };
}

async function bithumbFeeByNetwork(asset) {
  try {
    const rows = await fetchJson(`https://api.bithumb.com/v2/fee/inout/${asset}`);
    const coin = Array.isArray(rows) ? rows.find((item) => String(item.currency || "").toUpperCase() === asset) || rows[0] : rows;
    const networks = coin?.networks || [];
    return Object.fromEntries(networks.map((item) => {
      const network = normalizeNetwork(item.net_name || item.net_type || item.network || asset);
      return [network, {
        withdrawFee: parseOptionalNumber(item.withdraw_fee_quantity ?? item.withdraw_fee),
        withdrawRate: parseOptionalNumber(item.withdraw_rate),
        withdrawFeeMin: parseOptionalNumber(item.withdraw_fee_min),
        withdrawFeeMax: parseOptionalNumber(item.withdraw_fee_max),
        withdrawMin: parseOptionalNumber(item.withdraw_minimum_quantity ?? item.withdraw_minimum ?? item.withdraw_min),
        source: "BITHUMB_PUBLIC_INOUT_FEE"
      }];
    }));
  } catch (error) {
    addRiskEvent("BITHUMB_WITHDRAW_FEE_LOOKUP_DELAYED", "medium", `빗썸 ${asset} 출금 수수료 조회 지연: ${error.message}`, { asset });
    return {};
  }
}

function estimateWithdrawFeeFromPolicy(policy = {}, amount = null) {
  if (policy.withdrawFee != null) return policy.withdrawFee;
  if (policy.withdrawRate == null) return null;
  const quantity = Number(amount);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  let fee = quantity * policy.withdrawRate;
  if (policy.withdrawFeeMin != null) fee = Math.max(fee, policy.withdrawFeeMin);
  if (policy.withdrawFeeMax != null) fee = Math.min(fee, policy.withdrawFeeMax);
  return fee;
}

function withdrawalNetworkOptions(sourceExchange, destinationExchange, asset) {
  const destinationNetworks = WITHDRAWAL_DESTINATION_NETWORKS[destinationExchange]?.[asset] ?? {};
  const normalizedDestination = Object.fromEntries(Object.entries(destinationNetworks).map(([network, enabled]) => [normalizeNetwork(network), enabled]));
  return (WITHDRAWAL_SOURCE_OPTIONS[sourceExchange]?.[asset] ?? [])
    .map(([sourceNetworkCode, destinationNetworkCode, displayName, withdrawFee, withdrawMin, withdrawIntegerMultiple, requiresTag]) => {
      const normalizedNetworkCode = normalizeNetwork(sourceNetworkCode);
      if (!(normalizedNetworkCode in normalizedDestination)) return null;
      return {
        asset,
        sourceExchange,
        destinationExchange,
        sourceNetworkCode,
        destinationNetworkCode,
        normalizedNetworkCode,
        displayName,
        withdrawFee,
        withdrawMin,
        withdrawIntegerMultiple,
        requiresTag,
        depositEnabled: normalizedDestination[normalizedNetworkCode] === true,
        withdrawEnabled: true
      };
    })
    .filter(Boolean);
}

function resolveWithdrawalAddress(destinationExchange, asset, network) {
  const normalized = normalizeNetwork(network);
  const envAddress = envWithdrawalAddress(destinationExchange, asset, normalized);
  if (envAddress.address) return { ...envAddress, source: "ENV_FALLBACK" };
  const bookAddress = addressBookWithdrawalAddress(destinationExchange, asset, normalized);
  if (bookAddress.address) return { ...bookAddress, source: "DATA_ADDRESS_BOOK" };
  const staticAddress = WITHDRAWAL_ADDRESSES[`${destinationExchange}:${asset}:${normalized}`];
  if (staticAddress?.address) return { ...staticAddress, source: "STATIC_REGISTERED_DEMO" };
  return {
    exchange: destinationExchange,
    asset,
    networkCode: normalized,
    address: "",
    tag: "",
    source: "NOT_FOUND"
  };
}

function envWithdrawalAddress(exchange, asset, network) {
  const prefix = `WITHDRAWAL_${cleanEnvKey(exchange)}_${asset}_${network}`;
  return {
    exchange,
    asset,
    networkCode: network,
    address: process.env[`${prefix}_ADDRESS`] || "",
    tag: process.env[`${prefix}_TAG`] || process.env[`${prefix}_MEMO`] || ""
  };
}

function addressBookWithdrawalAddress(exchange, asset, network) {
  try {
    const file = path.join(__dirname, "data", "address-book.json");
    if (!fs.existsSync(file)) return { exchange, asset, networkCode: network, address: "", tag: "" };
    const book = JSON.parse(fs.readFileSync(file, "utf8"));
    const key = `${exchange}:${asset}:${network}`;
    const value = book[key] ?? book.addresses?.[key] ?? findAddressBookEntry(book, exchange, asset, network);
    if (!value) return { exchange, asset, networkCode: network, address: "", tag: "" };
    return {
      exchange,
      asset,
      networkCode: network,
      address: value.address || "",
      tag: value.tag || value.memo || value.secondary_address || ""
    };
  } catch {
    return { exchange, asset, networkCode: network, address: "", tag: "" };
  }
}

function findAddressBookEntry(book, exchange, asset, network) {
  const entries = Array.isArray(book) ? book : Array.isArray(book.addresses) ? book.addresses : [];
  return entries.find((item) =>
    String(item.exchange || "").toLowerCase() === exchange.toLowerCase() &&
    cleanAsset(item.asset || item.currency) === asset &&
    normalizeNetwork(item.network || item.net_type) === network
  );
}

function cleanEnvKey(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function withdrawalExecutionMode(sourceExchange) {
  if (!canSubmitRealWithdrawal(sourceExchange)) return "DEMO_ONLY";
  return "LIVE_EXECUTE_AVAILABLE_BUT_NOT_USED_BY_DEFAULT";
}

function canSubmitRealWithdrawal(sourceExchange) {
  return WITHDRAWAL_EXECUTION_ADAPTERS[sourceExchange] === true &&
    process.env.ENABLE_WITHDRAWAL === "true" &&
    process.env.WITHDRAWAL_TRANSPORT === "enabled";
}

function withdrawalRouteKey(sourceExchange, destinationExchange, asset) {
  return `${sourceExchange}|${destinationExchange}|${asset}`;
}

function normalizeNetwork(code) {
  const cleaned = String(code || "").toUpperCase().trim().replace(/[^A-Z0-9 ]/g, "");
  return NETWORK_ALIASES[cleaned] ?? cleaned.replaceAll(" ", "");
}

function normalizeWithdrawalExchange(value, allowed) {
  const text = String(value || "").trim().toLowerCase();
  return allowed.find((item) => item.toLowerCase() === text) ?? allowed[0];
}

function quantizeAmount(amount, multiple) {
  if (!Number.isFinite(amount) || !Number.isFinite(multiple) || multiple <= 0) return amount;
  return Math.floor((amount / multiple) + 1e-12) * multiple;
}

function withdrawalSafety() {
  return {
    paperTrading: !state.settings.liveTrading,
    liveTrading: state.settings.liveTrading,
    withdrawalEnabled: false,
    autoRebalanceEnabled: false,
    emergencyStop: state.settings.emergencyStop,
    demoMode: true,
    realWithdrawalEnabled: process.env.ENABLE_WITHDRAWAL === "true" && process.env.WITHDRAWAL_TRANSPORT === "enabled",
    liveExecuteRequiresManualApproval: true
  };
}

async function pollTelegramCommands() {
  if (!state.settings.telegramCommandEnabled) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = String(process.env.TELEGRAM_CHAT_ID || "");
  if (!token || !chatId) return;
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set("timeout", "0");
  if (state.settings.telegramLastUpdateId) url.searchParams.set("offset", String(state.settings.telegramLastUpdateId + 1));
  const data = await fetchJson(url.toString());
  for (const update of data.result || []) {
    state.settings.telegramLastUpdateId = Math.max(state.settings.telegramLastUpdateId || 0, update.update_id || 0);
    const message = update.message || update.edited_message;
    const text = String(message?.text || "").trim().toLowerCase();
    if (String(message?.chat?.id || "") !== chatId) continue;
    if (text === "/off") {
      state.settings.emergencyStop = true;
      state.settings.autoPaperTrading = false;
      addBotEvent("TELEGRAM_OFF", "Telegram /off 명령으로 자동 거래를 정지했습니다.");
      await telegramSend("OFF: emergency stop ON, auto paper OFF");
    } else if (text === "/on") {
      state.settings.emergencyStop = false;
      state.settings.autoPaperTrading = true;
      addBotEvent("TELEGRAM_ON", "Telegram /on 명령으로 자동 모의 거래를 켰습니다.");
      await telegramSend("ON: emergency stop OFF, auto paper ON");
    } else if (text === "/status") {
      await telegramSend(`status: autoPaper=${state.settings.autoPaperTrading}, emergency=${state.settings.emergencyStop}, live=${state.settings.liveTrading}`);
    }
  }
}

async function telegramSend(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

function formatPlain(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString("en-US", { maximumFractionDigits: 12, useGrouping: false });
}

async function handleInternalTransfer(params) {
  const exchange = String(params.get("exchange") || "").toLowerCase();
  const coin = cleanAsset(params.get("coin"));
  const amount = Number(params.get("amount"));
  const from = String(params.get("from") || "").toLowerCase();
  const to = String(params.get("to") || "").toLowerCase();
  const reason = String(params.get("reason") || "manual");
  if (!["binance", "bybit", "bitget", "gate"].includes(exchange)) throw new Error("Unsupported internal transfer exchange");
  if (!coin || !Number.isFinite(amount) || amount <= 0 || !from || !to) throw new Error("exchange, coin, amount, from, to are required");
  const plan = {
    id: `it-${Date.now()}-${exchange}-${coin}`,
    exchange,
    coin,
    amount,
    from,
    to,
    reason,
    createdAt: new Date().toISOString(),
    status: "DRY_RUN",
    transport: process.env.INTERNAL_TRANSFER_TRANSPORT || "disabled",
    safety: {
      internalTransferEnabled: state.settings.internalTransferEnabled,
      withdrawalEnabled: false,
      autoRebalanceEnabled: false
    }
  };
  if (!state.settings.internalTransferEnabled || process.env.INTERNAL_TRANSFER_TRANSPORT !== "enabled") {
    state.internalTransfers.unshift(plan);
    state.internalTransfers = state.internalTransfers.slice(0, 100);
    return { ok: true, transfer: plan };
  }
  let response;
  if (exchange === "binance") response = await binanceInternalTransfer(coin, amount, from, to);
  if (exchange === "bybit") response = await bybitInternalTransfer(coin, amount, from, to);
  if (exchange === "bitget") response = await bitgetInternalTransfer(coin, amount, from, to);
  if (exchange === "gate") response = await gateInternalTransfer(coin, amount, from, to);
  const record = { ...plan, status: "SUBMITTED", response: redact(response) };
  state.internalTransfers.unshift(record);
  state.internalTransfers = state.internalTransfers.slice(0, 100);
  addBotEvent("INTERNAL_TRANSFER_SUBMITTED", `${exchange} ${coin} ${from} -> ${to}`, { id: record.id });
  return { ok: true, transfer: record };
}

function normalizeTransferAccount(exchange, account) {
  const value = String(account).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const maps = {
    binance: {
      funding: "MAIN",
      main: "MAIN",
      spot: "MAIN",
      unified: "MAIN",
      unified_trading: "MAIN",
      trading: "MAIN",
      usdm: "UMFUTURE",
      futures: "UMFUTURE",
      usdt_futures: "UMFUTURE"
    },
    bybit: {
      funding: "FUND",
      fund: "FUND",
      unified: "UNIFIED",
      unified_trading: "UNIFIED",
      trading: "UNIFIED",
      spot: "SPOT",
      contract: "CONTRACT",
      futures: "CONTRACT"
    },
    bitget: {
      funding: "spot",
      spot: "spot",
      p2p: "p2p",
      unified: "uta",
      unified_trading: "uta",
      uta: "uta",
      futures: "usdt_futures",
      usdt_futures: "usdt_futures"
    },
    gate: {
      funding: "spot",
      spot: "spot",
      unified: "spot",
      unified_trading: "spot",
      futures: "futures",
      usdt_futures: "futures"
    }
  };
  return maps[exchange]?.[value] ?? account;
}

async function binanceInternalTransfer(coin, amount, from, to) {
  const fromType = normalizeTransferAccount("binance", from);
  const toType = normalizeTransferAccount("binance", to);
  const type = `${fromType}_${toType}`;
  return signedBinanceRequest("spot", "POST", "/sapi/v1/asset/transfer", {
    type,
    asset: coin,
    amount: formatDecimal(amount, 8)
  });
}

async function bybitInternalTransfer(coin, amount, from, to) {
  const body = {
    transferId: crypto.randomUUID(),
    coin,
    amount: formatDecimal(amount, 8),
    fromAccountType: normalizeTransferAccount("bybit", from),
    toAccountType: normalizeTransferAccount("bybit", to)
  };
  return signedBybitRequest("POST", "/v5/asset/transfer/inter-transfer", body);
}

async function bitgetInternalTransfer(coin, amount, from, to) {
  const body = {
    fromType: normalizeTransferAccount("bitget", from),
    toType: normalizeTransferAccount("bitget", to),
    amount: formatDecimal(amount, 8),
    coin,
    clientOid: `kimchi-${Date.now()}`
  };
  return signedBitgetRequest("POST", "/api/v3/account/transfer", body);
}

async function gateInternalTransfer(coin, amount, from, to) {
  const body = {
    currency: coin,
    from: normalizeTransferAccount("gate", from),
    to: normalizeTransferAccount("gate", to),
    amount: formatDecimal(amount, 8),
    settle: coin === "USDT" ? "usdt" : ""
  };
  return signedGateRequest("POST", "/wallet/transfers", body);
}

async function refreshBithumbDepositWithdraw() {
  const data = await fetchJson("https://api.bithumb.com/public/assetsstatus/ALL");
  if (data.status !== "0000") throw new Error("Bithumb assetsstatus unavailable");
  const out = {};
  for (const [asset, status] of Object.entries(data.data ?? {})) {
    out[cleanAsset(asset)] = {
      asset: cleanAsset(asset),
      exchange: "bithumb",
      depositEnabled: Number(status.deposit_status) === 1,
      withdrawEnabled: Number(status.withdrawal_status) === 1,
      networks: ["default"],
      source: "BITHUMB_PUBLIC_ASSETSSTATUS",
      checkedAt: new Date().toISOString()
    };
  }
  state.depositWithdraw.bithumb = out;
  setStatus("bithumb-deposit-withdraw", "connected", `${Object.keys(out).length} assets`);
}

async function refreshBitgetDepositWithdraw() {
  const data = await fetchJson("https://api.bitget.com/api/v2/spot/public/coins");
  const out = {};
  for (const item of data.data ?? []) {
    const asset = cleanAsset(item.coin);
    const chains = item.chains ?? [];
    out[asset] = {
      asset,
      exchange: "bitget",
      depositEnabled: chains.some((chain) => String(chain.rechargeable) === "true"),
      withdrawEnabled: chains.some((chain) => String(chain.withdrawable) === "true"),
      networks: chains.map((chain) => cleanNetwork(chain.chain)),
      source: "BITGET_PUBLIC_COINS",
      checkedAt: new Date().toISOString()
    };
  }
  state.depositWithdraw.bitget = out;
  setStatus("bitget-deposit-withdraw", "connected", `${Object.keys(out).length} assets`);
}

async function refreshGateDepositWithdraw() {
  const data = await fetchJson("https://api.gateio.ws/api/v4/spot/currencies");
  const out = {};
  for (const item of data ?? []) {
    const asset = cleanAsset(item.currency);
    const chains = item.chains ?? [];
    const chainDeposit = chains.some((chain) => chain.deposit_disabled === false);
    const chainWithdraw = chains.some((chain) => chain.withdraw_disabled === false);
    out[asset] = {
      asset,
      exchange: "gate",
      depositEnabled: item.delisted !== true && item.deposit_disabled !== true && chainDeposit,
      withdrawEnabled: item.delisted !== true && item.withdraw_disabled !== true && item.withdraw_delayed !== true && chainWithdraw,
      networks: chains.map((chain) => cleanNetwork(chain.name)),
      source: "GATE_PUBLIC_CURRENCIES",
      checkedAt: new Date().toISOString()
    };
  }
  state.depositWithdraw.gate = out;
  setStatus("gate-deposit-withdraw", "connected", `${Object.keys(out).length} assets`);
}

async function refreshUpbitDepositWithdraw() {
  if (!process.env.UPBIT_ACCESS_KEY || !process.env.UPBIT_SECRET_KEY) {
    setStatus("upbit-deposit-withdraw", "blocked", "requires Upbit API key");
    return;
  }
  const out = {};
  const markets = [...state.marketSets.domestic.upbit].map((asset) => `KRW-${asset}`);
  for (const marketChunk of chunk(markets, 50)) {
    const data = await signedUpbitGet("/v1/status/wallet", { markets: marketChunk.join(",") });
    for (const item of data ?? []) {
      const asset = cleanAsset(String(item.currency ?? item.market ?? "").replace("KRW-", ""));
      const walletState = String(item.wallet_state ?? "").toLowerCase();
      out[asset] = {
        asset,
        exchange: "upbit",
        depositEnabled: ["working", "deposit_only"].includes(walletState),
        withdrawEnabled: ["working", "withdraw_only"].includes(walletState),
        networks: [cleanNetwork(item.net_type ?? item.network_name ?? "default")],
        source: "UPBIT_PRIVATE_WALLET_STATUS",
        checkedAt: new Date().toISOString(),
        rawState: walletState
      };
    }
  }
  state.depositWithdraw.upbit = out;
  setStatus("upbit-deposit-withdraw", "connected", `${Object.keys(out).length} assets`);
}

async function refreshBinanceDepositWithdraw() {
  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
    setStatus("binance-deposit-withdraw", "blocked", "requires Binance API key");
    return;
  }
  const data = await signedBinanceRequest("spot", "GET", "/sapi/v1/capital/config/getall", {});
  const out = {};
  for (const item of data.body ?? []) {
    const asset = cleanAsset(item.coin);
    const networks = item.networkList ?? [];
    out[asset] = {
      asset,
      exchange: "binance",
      depositEnabled: networks.some((network) => network.depositEnable === true),
      withdrawEnabled: networks.some((network) => network.withdrawEnable === true),
      networks: networks.map((network) => cleanNetwork(network.network)),
      source: "BINANCE_PRIVATE_CAPITAL_CONFIG",
      checkedAt: new Date().toISOString()
    };
  }
  state.depositWithdraw.binance = out;
  setStatus("binance-deposit-withdraw", "connected", `${Object.keys(out).length} assets`);
}

async function refreshHedgeQuotes() {
  await Promise.allSettled([
    refreshBinanceHedgeQuotes(),
    refreshBybitHedgeQuotes(),
    refreshBitgetHedgeQuotes(),
    refreshGateHedgeQuotes()
  ]);
}

async function refreshBinanceHedgeQuotes() {
  const data = await fetchJson("https://fapi.binance.com/fapi/v1/ticker/bookTicker");
  const out = {};
  for (const item of data ?? []) {
    if (!String(item.symbol ?? "").endsWith("USDT")) continue;
    const asset = cleanAsset(String(item.symbol).replace("USDT", ""));
    out[asset] = {
      bid: Number(item.bidPrice),
      ask: Number(item.askPrice),
      bidQty: Number(item.bidQty),
      askQty: Number(item.askQty),
      ts: Date.now()
    };
  }
  state.hedgeQuotes.binance = out;
  setStatus("binance-hedge-quotes", "connected", `${Object.keys(out).length} quotes`);
}

async function refreshBybitHedgeQuotes() {
  const data = await fetchJson("https://api.bybit.com/v5/market/tickers?category=linear");
  const out = {};
  for (const item of data.result?.list ?? []) {
    if (!String(item.symbol ?? "").endsWith("USDT")) continue;
    const asset = cleanAsset(String(item.symbol).replace("USDT", ""));
    out[asset] = {
      bid: Number(item.bid1Price),
      ask: Number(item.ask1Price),
      bidQty: Number(item.bid1Size),
      askQty: Number(item.ask1Size),
      ts: Date.now()
    };
  }
  state.hedgeQuotes.bybit = out;
  setStatus("bybit-hedge-quotes", "connected", `${Object.keys(out).length} quotes`);
}

async function refreshBitgetHedgeQuotes() {
  const data = await fetchJson("https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES");
  const out = {};
  for (const item of data.data ?? []) {
    const asset = cleanAsset(item.baseCoin ?? String(item.symbol ?? "").replace("USDT", ""));
    out[asset] = {
      bid: Number(item.bidPr ?? item.bestBid),
      ask: Number(item.askPr ?? item.bestAsk),
      bidQty: Number(item.bidSz ?? item.bidSize ?? 0),
      askQty: Number(item.askSz ?? item.askSize ?? 0),
      ts: Date.now()
    };
  }
  state.hedgeQuotes.bitget = out;
  setStatus("bitget-hedge-quotes", "connected", `${Object.keys(out).length} quotes`);
}

async function refreshGateHedgeQuotes() {
  const data = await fetchJson("https://api.gateio.ws/api/v4/futures/usdt/tickers");
  const out = {};
  for (const item of data ?? []) {
    const asset = cleanAsset(String(item.contract ?? "").replace("_USDT", ""));
    const bid = Number(item.highest_bid);
    const ask = Number(item.lowest_ask);
    const size = Number(item.highest_size ?? item.volume_24h_base ?? 0);
    out[asset] = {
      bid,
      ask,
      bidQty: size,
      askQty: Number(item.lowest_size ?? size),
      ts: Date.now()
    };
  }
  state.hedgeQuotes.gate = out;
  setStatus("gate-hedge-quotes", "connected", `${Object.keys(out).length} quotes`);
}

async function refreshHedgeMarkets() {
  await Promise.allSettled([
    refreshBinanceFuturesMarkets(),
    refreshBybitFuturesMarkets(),
    refreshBitgetFuturesMarkets(),
    refreshGateFuturesMarkets()
  ]);
}

async function refreshBinanceFuturesMarkets() {
  const data = await fetchJson("https://fapi.binance.com/fapi/v1/exchangeInfo");
  state.hedgeMarkets.binance = new Set((data.symbols ?? [])
    .filter((item) => item.quoteAsset === "USDT" && item.status === "TRADING")
    .map((item) => cleanAsset(item.baseAsset)));
  setStatus("binance-hedge", "connected", `${state.hedgeMarkets.binance.size} futures`);
}

async function refreshBybitFuturesMarkets() {
  const data = await fetchJson("https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000");
  state.hedgeMarkets.bybit = new Set((data.result?.list ?? [])
    .filter((item) => item.quoteCoin === "USDT" && item.status === "Trading")
    .map((item) => cleanAsset(item.baseCoin)));
  setStatus("bybit-hedge", "connected", `${state.hedgeMarkets.bybit.size} futures`);
}

async function refreshBitgetFuturesMarkets() {
  const data = await fetchJson("https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES");
  state.hedgeMarkets.bitget = new Set((data.data ?? [])
    .filter((item) => String(item.symbolStatus ?? "").toLowerCase() === "normal")
    .map((item) => cleanAsset(item.baseCoin)));
  setStatus("bitget-hedge", "connected", `${state.hedgeMarkets.bitget.size} futures`);
}

async function refreshGateFuturesMarkets() {
  const data = await fetchJson("https://api.gateio.ws/api/v4/futures/usdt/contracts");
  state.hedgeMarkets.gate = new Set((data ?? [])
    .filter((item) => !item.in_delisting && !item.trade_size_disabled)
    .map((item) => cleanAsset(String(item.name ?? "").replace("_USDT", ""))));
  setStatus("gate-hedge", "connected", `${state.hedgeMarkets.gate.size} futures`);
}

async function binanceSpotMarketBuy(asset, quoteOrderQty, clientOrderId) {
  return signedBinanceRequest("spot", "POST", "/api/v3/order", {
    symbol: `${asset}USDT`,
    side: "BUY",
    type: "MARKET",
    quoteOrderQty: formatDecimal(quoteOrderQty, 2),
    newClientOrderId: clientOrderId
  });
}

async function binanceFuturesMarketShort(asset, quantity, clientOrderId) {
  return signedBinanceRequest("futures", "POST", "/fapi/v1/order", {
    symbol: `${asset}USDT`,
    side: "SELL",
    type: "MARKET",
    quantity: formatDecimal(quantity, 6),
    newClientOrderId: clientOrderId
  });
}

async function signedBinanceRequest(market, method, endpoint, params) {
  const baseUrl = market === "futures" ? "https://fapi.binance.com" : "https://api.binance.com";
  const apiKey = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_API_SECRET;
  if (!apiKey || !secret) throw new Error("Missing Binance API credentials");
  const query = new URLSearchParams({
    ...params,
    recvWindow: "5000",
    timestamp: String(Date.now())
  });
  const signature = crypto.createHmac("sha256", secret).update(query.toString()).digest("hex");
  query.set("signature", signature);
  const res = await fetchWithTimeout(`${baseUrl}${endpoint}?${query.toString()}`, {
    method,
    headers: { "X-MBX-APIKEY": apiKey }
  });
  const body = await safeJson(res);
  if (!res.ok) throw new Error(`Binance ${market} order failed: ${JSON.stringify(redact(body))}`);
  return { exchange: `binance-${market}`, endpoint, body: redact(body) };
}

async function signedBybitRequest(method, endpoint, body = {}) {
  const apiKey = process.env.BYBIT_API_KEY;
  const secret = process.env.BYBIT_API_SECRET;
  if (!apiKey || !secret) throw new Error("Missing Bybit API credentials");
  const timestamp = String(Date.now());
  const recvWindow = "5000";
  const query = method === "GET" ? new URLSearchParams(body).toString() : "";
  const requestPath = `${endpoint}${query ? `?${query}` : ""}`;
  const bodyText = method === "GET" ? "" : JSON.stringify(body);
  const payload = `${timestamp}${apiKey}${recvWindow}${method === "GET" ? query : bodyText}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const res = await fetchWithTimeout(`https://api.bybit.com${requestPath}`, {
    method,
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": signature,
      "Content-Type": "application/json"
    },
    body: method === "GET" ? undefined : bodyText
  });
  const responseBody = await safeJson(res);
  if (!res.ok || responseBody.retCode) throw new Error(`Bybit request failed: ${JSON.stringify(redact(responseBody))}`);
  return { exchange: "bybit", endpoint, body: redact(responseBody) };
}

async function signedBitgetRequest(method, endpoint, body = {}) {
  const apiKey = process.env.BITGET_API_KEY;
  const secret = process.env.BITGET_API_SECRET;
  const passphrase = process.env.BITGET_API_PASSPHRASE;
  if (!apiKey || !secret || !passphrase) throw new Error("Missing Bitget API credentials");
  const timestamp = String(Date.now());
  const query = method === "GET" ? new URLSearchParams(body).toString() : "";
  const requestPath = `${endpoint}${query ? `?${query}` : ""}`;
  const bodyText = method === "GET" ? "" : JSON.stringify(body);
  const prehash = `${timestamp}${method}${requestPath}${bodyText}`;
  const signature = crypto.createHmac("sha256", secret).update(prehash).digest("base64");
  const res = await fetchWithTimeout(`https://api.bitget.com${requestPath}`, {
    method,
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-PASSPHRASE": passphrase,
      "ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
      "locale": "en-US"
    },
    body: method === "GET" ? undefined : bodyText
  });
  const responseBody = await safeJson(res);
  if (!res.ok || (responseBody.code && responseBody.code !== "00000")) throw new Error(`Bitget request failed: ${JSON.stringify(redact(responseBody))}`);
  return { exchange: "bitget", endpoint, body: redact(responseBody) };
}

async function signedGateRequest(method, endpoint, body = {}) {
  const apiKey = process.env.GATE_API_KEY;
  const secret = process.env.GATE_API_SECRET;
  if (!apiKey || !secret) throw new Error("Missing Gate API credentials");
  const prefix = "/api/v4";
  const query = method === "GET" ? new URLSearchParams(body).toString() : "";
  const requestPath = `${endpoint}${query ? `?${query}` : ""}`;
  const bodyText = method === "GET" ? "" : JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyHash = crypto.createHash("sha512").update(bodyText).digest("hex");
  const signString = `${method}\n${prefix}${endpoint}\n${query}\n${bodyHash}\n${timestamp}`;
  const signature = crypto.createHmac("sha512", secret).update(signString).digest("hex");
  const res = await fetchWithTimeout(`https://api.gateio.ws${prefix}${requestPath}`, {
    method,
    headers: {
      "KEY": apiKey,
      "Timestamp": timestamp,
      "SIGN": signature,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: method === "GET" ? undefined : bodyText
  });
  const responseBody = await safeJson(res);
  if (!res.ok) throw new Error(`Gate request failed: ${JSON.stringify(redact(responseBody))}`);
  return { exchange: "gate", endpoint, body: redact(responseBody) };
}

async function signedBithumbGet(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const token = signBithumbToken(query);
  const res = await fetchWithTimeout(`https://api.bithumb.com${endpoint}${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
  const responseBody = await safeJson(res);
  if (!res.ok) throw new Error(`Bithumb GET failed: ${JSON.stringify(redact(responseBody))}`);
  return responseBody;
}

function signBithumbToken(query = "") {
  const accessKey = process.env.BITHUMB_API_KEY;
  const secretKey = process.env.BITHUMB_API_SECRET;
  if (!accessKey || !secretKey) throw new Error("Missing Bithumb API credentials");
  const payload = {
    access_key: accessKey,
    nonce: crypto.randomUUID(),
    timestamp: Date.now()
  };
  if (query) {
    payload.query_hash = crypto.createHash("sha512").update(query, "utf8").digest("hex");
    payload.query_hash_alg = "SHA512";
  }
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(crypto.createHmac("sha256", secretKey).update(`${header}.${body}`).digest());
  return `${header}.${body}.${signature}`;
}

async function upbitLimitSell(asset, quantity, price, identifier) {
  const body = {
    market: `KRW-${asset}`,
    side: "ask",
    ord_type: "limit",
    volume: formatDecimal(quantity, 8),
    price: formatDecimal(price, 0),
    time_in_force: "post_only",
    identifier
  };
  return signedUpbitRequest("POST", "/v1/orders", body);
}

async function signedUpbitGet(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const token = signUpbitToken(query);
  const res = await fetchWithTimeout(`https://api.upbit.com${endpoint}${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });
  const responseBody = await safeJson(res);
  if (!res.ok) throw new Error(`Upbit GET failed: ${JSON.stringify(redact(responseBody))}`);
  return responseBody;
}

async function signedUpbitRequest(method, endpoint, body) {
  const query = new URLSearchParams(body).toString();
  const token = signUpbitToken(query);
  const res = await fetchWithTimeout(`https://api.upbit.com${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const responseBody = await safeJson(res);
  if (!res.ok) throw new Error(`Upbit order failed: ${JSON.stringify(redact(responseBody))}`);
  return { exchange: "upbit", endpoint, body: redact(responseBody) };
}

function signUpbitToken(query = "") {
  const accessKey = process.env.UPBIT_ACCESS_KEY;
  const secretKey = process.env.UPBIT_SECRET_KEY;
  if (!accessKey || !secretKey) throw new Error("Missing Upbit API credentials");
  const queryHash = crypto.createHash("sha512").update(query).digest("hex");
  const header = base64url(JSON.stringify({ alg: "HS512", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    access_key: accessKey,
    nonce: crypto.randomUUID(),
    query_hash: queryHash,
    query_hash_alg: "SHA512"
  }));
  const unsigned = `${header}.${payload}`;
  const signature = base64url(crypto.createHmac("sha512", secretKey).update(unsigned).digest());
  return `${unsigned}.${signature}`;
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`API_TIMEOUT_${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function formatDecimal(value, digits) {
  return Number(value).toFixed(digits).replace(/\.?0+$/, "");
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const sensitive = /api[-_]?key|secret|signature|authorization|token/i.test(key);
    return [key, sensitive ? "[REDACTED]" : redact(item)];
  }));
}

async function loadMarketUniverse() {
  setStatus("universe", "loading", "거래소별 전체 마켓 목록 수집 중");
  const [upbit, bithumb, binance, bybit, bitget, gate] = await Promise.allSettled([
    loadUpbitKrwAssets(),
    loadBithumbKrwAssets(),
    loadBinanceUsdtAssets(),
    loadBybitUsdtAssets(),
    loadBitgetUsdtAssets(),
    loadGateUsdtAssets()
  ]);

  state.marketSets.domestic.upbit = settledSet(upbit, DEFAULT_SYMBOLS);
  state.marketSets.domestic.bithumb = settledSet(bithumb, DEFAULT_SYMBOLS);
  state.marketSets.foreign.binance = settledSet(binance, DEFAULT_SYMBOLS);
  state.marketSets.foreign.bybit = settledSet(bybit, DEFAULT_SYMBOLS);
  state.marketSets.foreign.bitget = settledSet(bitget, DEFAULT_SYMBOLS);
  state.marketSets.foreign.gate = settledSet(gate, DEFAULT_SYMBOLS);

  const union = new Set();
  for (const domesticExchange of DOMESTIC) {
    for (const foreignExchange of FOREIGN) {
      for (const asset of state.marketSets.domestic[domesticExchange]) {
        if (state.marketSets.foreign[foreignExchange].has(asset) && !EXCLUDED_ASSETS.has(asset)) union.add(asset);
      }
    }
  }
  SYMBOLS = [...union].sort();
  if (!SYMBOLS.length) SYMBOLS = [...DEFAULT_SYMBOLS];
  setStatus("universe", "connected", `${SYMBOLS.length}개 자산 감시 · 해외 4곳 중 하나 이상 상장 시 비교`);
}

function settledSet(result, fallback) {
  if (result.status === "fulfilled" && result.value instanceof Set) return result.value;
  return new Set(fallback);
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return await res.json();
}

function cleanAsset(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanNetwork(value) {
  return String(value ?? "default").toUpperCase().replace(/[^A-Z0-9_-]/g, "") || "DEFAULT";
}

async function loadUpbitKrwAssets() {
  const markets = await fetchJson("https://api.upbit.com/v1/market/all?isDetails=false");
  return new Set(markets
    .map((m) => String(m.market ?? ""))
    .filter((market) => market.startsWith("KRW-"))
    .map((market) => cleanAsset(market.replace("KRW-", "")))
    .filter((asset) => asset && !EXCLUDED_ASSETS.has(asset)));
}

async function loadBithumbKrwAssets() {
  const data = await fetchJson("https://api.bithumb.com/public/ticker/ALL_KRW");
  if (data.status !== "0000") {
    const message = data.data?.title || data.message || "Bithumb market list unavailable";
    setStatus("bithumb", "blocked", message);
    addRiskEvent("BITHUMB_MARKET_UNAVAILABLE", "high", message, { rawStatus: data.status });
    return new Set();
  }
  return new Set(Object.entries(data.data ?? {})
    .filter(([asset, ticker]) => asset !== "date" && ticker && typeof ticker === "object" && ticker.closing_price)
    .map(([asset]) => cleanAsset(asset))
    .filter((asset) => asset && !EXCLUDED_ASSETS.has(asset)));
}

async function loadBinanceUsdtAssets() {
  const data = await fetchJson("https://api.binance.com/api/v3/exchangeInfo");
  return new Set((data.symbols ?? [])
    .filter((s) => s.quoteAsset === "USDT" && s.status === "TRADING" && s.isSpotTradingAllowed !== false)
    .map((s) => cleanAsset(s.baseAsset))
    .filter((asset) => asset && !EXCLUDED_ASSETS.has(asset)));
}

async function loadBybitUsdtAssets() {
  let cursor = "";
  const out = new Set();
  do {
    const data = await fetchJson(`https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    for (const item of data.result?.list ?? []) {
      if (item.quoteCoin === "USDT" && item.status === "Trading") out.add(cleanAsset(item.baseCoin));
    }
    cursor = data.result?.nextPageCursor || "";
  } while (cursor);
  return out;
}

async function loadBitgetUsdtAssets() {
  const data = await fetchJson("https://api.bitget.com/api/v2/spot/public/symbols");
  return new Set((data.data ?? [])
    .filter((s) => s.quoteCoin === "USDT" && String(s.status ?? "").toLowerCase() === "online")
    .map((s) => cleanAsset(s.baseCoin))
    .filter((asset) => asset && !EXCLUDED_ASSETS.has(asset)));
}

async function loadGateUsdtAssets() {
  const data = await fetchJson("https://api.gateio.ws/api/v4/spot/currency_pairs");
  return new Set((data ?? [])
    .filter((s) => s.quote === "USDT" && s.trade_status === "tradable")
    .map((s) => cleanAsset(s.base))
    .filter((asset) => asset && !EXCLUDED_ASSETS.has(asset)));
}

function setStatus(name, status, detail = "") {
  state.status[name] = { status, detail, updatedAt: new Date().toISOString() };
}

function normalizeLevels(levels, side) {
  return [...(levels ?? [])]
    .filter((level) => Number.isFinite(level.price) && Number.isFinite(level.qty) && level.qty > 0)
    .sort((a, b) => side === "bid" ? b.price - a.price : a.price - b.price)
    .slice(0, 20);
}

function updateDomestic(exchange, asset, bid, ask, bidQty = null, askQty = null, bids = null, asks = null) {
  if (!Number.isFinite(bid) && !Number.isFinite(ask)) return;
  state.domestic[exchange] ??= {};
  const previous = state.domestic[exchange][asset] ?? {};
  state.domestic[exchange][asset] = {
    bid: Number.isFinite(bid) ? bid : state.domestic[exchange][asset]?.bid ?? null,
    ask: Number.isFinite(ask) ? ask : state.domestic[exchange][asset]?.ask ?? null,
    bidQty: Number.isFinite(bidQty) ? bidQty : previous.bidQty ?? null,
    askQty: Number.isFinite(askQty) ? askQty : previous.askQty ?? null,
    bids: normalizeLevels(bids ?? previous.bids ?? [{ price: bid, qty: bidQty }], "bid"),
    asks: normalizeLevels(asks ?? previous.asks ?? [{ price: ask, qty: askQty }], "ask"),
    ts: Date.now()
  };
}

function updateForeign(exchange, asset, bid, ask, bidQty = null, askQty = null, bids = null, asks = null) {
  if (!Number.isFinite(bid) && !Number.isFinite(ask)) return;
  state.foreign[exchange] ??= {};
  const previous = state.foreign[exchange][asset] ?? {};
  state.foreign[exchange][asset] = {
    bid: Number.isFinite(bid) ? bid : state.foreign[exchange][asset]?.bid ?? null,
    ask: Number.isFinite(ask) ? ask : state.foreign[exchange][asset]?.ask ?? null,
    bidQty: Number.isFinite(bidQty) ? bidQty : previous.bidQty ?? null,
    askQty: Number.isFinite(askQty) ? askQty : previous.askQty ?? null,
    bids: normalizeLevels(bids ?? previous.bids ?? [{ price: bid, qty: bidQty }], "bid"),
    asks: normalizeLevels(asks ?? previous.asks ?? [{ price: ask, qty: askQty }], "ask"),
    ts: Date.now()
  };
}

function updateUsdt(exchange, bid, ask, bidQty = null, askQty = null, bids = null, asks = null) {
  const price = Number.isFinite(ask) ? ask : bid;
  if (!Number.isFinite(price)) return;
  const previous = state.usdtKrw[exchange] ?? {};
  state.usdtKrw[exchange] = {
    bid,
    ask,
    bidQty: Number.isFinite(bidQty) ? bidQty : previous.bidQty ?? null,
    askQty: Number.isFinite(askQty) ? askQty : previous.askQty ?? null,
    bids: normalizeLevels(bids ?? previous.bids ?? [{ price: bid, qty: bidQty }], "bid"),
    asks: normalizeLevels(asks ?? previous.asks ?? [{ price: ask, qty: askQty }], "ask"),
    price,
    ts: Date.now()
  };
}

function connectAll() {
  connectBinance();
  connectBybit();
  connectBitget();
  connectGate();
  connectUpbit();
  connectBithumb();
}

function reconnect(name, fn, delay = 3000) {
  setStatus(name, "reconnecting");
  setTimeout(fn, delay);
}

function connectBinance() {
  const name = "binance";
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/!bookTicker");
  ws.onopen = () => setStatus(name, "connected");
  ws.onerror = () => setStatus(name, "error");
  ws.onclose = () => reconnect(name, connectBinance);
  ws.onmessage = async (event) => {
    const msg = JSON.parse(await event.data.text?.() ?? event.data);
    const data = msg.data ?? msg;
    const asset = data.s?.replace("USDT", "");
    if (!state.marketSets.foreign.binance.has(asset)) return;
    updateForeign(name, asset, Number(data.b), Number(data.a), Number(data.B), Number(data.A));
  };
}

function connectBybit() {
  const name = "bybit";
  const chunks = chunk([...state.marketSets.foreign.bybit], 80);
  chunks.forEach((assets, index) => connectBybitChunk(assets, index));
}

function connectBybitChunk(assets, index) {
  const exchange = "bybit";
  const name = `${exchange}${index ? `-${index + 1}` : ""}`;
  const ws = new WebSocket("wss://stream.bybit.com/v5/public/spot");
  ws.onopen = () => {
    setStatus(name, "connected");
    ws.send(JSON.stringify({ op: "subscribe", args: assets.map((s) => `tickers.${s}USDT`) }));
  };
  ws.onerror = () => setStatus(name, "error");
  ws.onclose = () => reconnect(name, () => connectBybitChunk(assets, index));
  ws.onmessage = async (event) => {
    const msg = JSON.parse(await event.data.text?.() ?? event.data);
    if (!msg.topic?.startsWith("tickers.")) return;
    const asset = msg.topic.replace("tickers.", "").replace("USDT", "");
    const data = Array.isArray(msg.data) ? msg.data[0] : msg.data;
    updateForeign(exchange, asset, Number(data.bid1Price), Number(data.ask1Price), Number(data.bid1Size), Number(data.ask1Size));
  };
}

function connectBitget() {
  const name = "bitget";
  const chunks = chunk([...state.marketSets.foreign.bitget], 80);
  chunks.forEach((assets, index) => connectBitgetChunk(assets, index));
}

function connectBitgetChunk(assets, index) {
  const exchange = "bitget";
  const name = `${exchange}${index ? `-${index + 1}` : ""}`;
  const ws = new WebSocket("wss://ws.bitget.com/v2/ws/public");
  ws.onopen = () => {
    setStatus(name, "connected");
    ws.send(JSON.stringify({
      op: "subscribe",
      args: assets.map((s) => ({ instType: "SPOT", channel: "ticker", instId: `${s}USDT` }))
    }));
  };
  ws.onerror = () => setStatus(name, "error");
  ws.onclose = () => reconnect(name, () => connectBitgetChunk(assets, index));
  ws.onmessage = async (event) => {
    const raw = await event.data.text?.() ?? event.data;
    if (raw === "pong") return;
    const msg = JSON.parse(raw);
    for (const data of msg.data ?? []) {
      const asset = data.instId?.replace("USDT", "");
      if (!SYMBOLS.includes(asset)) continue;
      updateForeign(exchange, asset, Number(data.bidPr ?? data.bestBid), Number(data.askPr ?? data.bestAsk), Number(data.bidSz ?? data.bidSize), Number(data.askSz ?? data.askSize));
    }
  };
  setInterval(() => ws.readyState === 1 && ws.send("ping"), 25_000);
}

function connectGate() {
  const name = "gate";
  const chunks = chunk([...state.marketSets.foreign.gate], 80);
  chunks.forEach((assets, index) => connectGateChunk(assets, index));
}

function connectGateChunk(assets, index) {
  const exchange = "gate";
  const name = `${exchange}${index ? `-${index + 1}` : ""}`;
  const ws = new WebSocket("wss://api.gateio.ws/ws/v4/");
  ws.onopen = () => {
    setStatus(name, "connected");
    ws.send(JSON.stringify({
      time: Math.floor(Date.now() / 1000),
      channel: "spot.book_ticker",
      event: "subscribe",
      payload: assets.map((s) => `${s}_USDT`)
    }));
  };
  ws.onerror = () => setStatus(name, "error");
  ws.onclose = () => reconnect(name, () => connectGateChunk(assets, index));
  ws.onmessage = async (event) => {
    const msg = JSON.parse(await event.data.text?.() ?? event.data);
    if (msg.channel !== "spot.book_ticker" || !msg.result) return;
    const pair = msg.result.s ?? msg.result.currency_pair;
    const asset = pair?.replace("_USDT", "");
    if (!SYMBOLS.includes(asset)) return;
    updateForeign(exchange, asset, Number(msg.result.b ?? msg.result.highest_bid), Number(msg.result.a ?? msg.result.lowest_ask), Number(msg.result.B ?? msg.result.highest_size), Number(msg.result.A ?? msg.result.lowest_size));
  };
}

function connectUpbit() {
  const name = "upbit";
  const codes = [...state.marketSets.domestic.upbit].map((s) => `KRW-${s}`);
  codes.push("KRW-USDT");
  chunk(codes, 80).forEach((codeChunk, index) => connectUpbitChunk(codeChunk, index));
}

function connectUpbitChunk(codes, index) {
  const name = `upbit${index ? `-${index + 1}` : ""}`;
  const ws = new WebSocket("wss://api.upbit.com/websocket/v1");
  ws.binaryType = "arraybuffer";
  ws.onopen = () => {
    setStatus(name, "connected");
    ws.send(JSON.stringify([
      { ticket: "kimchi-monitor" },
      { type: "orderbook", codes },
      { format: "DEFAULT" }
    ]));
  };
  ws.onerror = () => setStatus(name, "error");
  ws.onclose = () => reconnect(name, () => connectUpbitChunk(codes, index));
  ws.onmessage = async (event) => {
    const msg = JSON.parse(Buffer.from(await toArrayBuffer(event.data)).toString("utf8"));
    const first = msg.orderbook_units?.[0];
    if (!first) return;
    const bids = msg.orderbook_units.map((level) => ({ price: Number(level.bid_price), qty: Number(level.bid_size) }));
    const asks = msg.orderbook_units.map((level) => ({ price: Number(level.ask_price), qty: Number(level.ask_size) }));
    if (msg.code === "KRW-USDT") {
      updateUsdt("upbit", Number(first.bid_price), Number(first.ask_price), Number(first.bid_size), Number(first.ask_size), bids, asks);
      return;
    }
    const asset = msg.code?.replace("KRW-", "");
    if (state.marketSets.domestic.upbit.has(asset)) updateDomestic("upbit", asset, Number(first.bid_price), Number(first.ask_price), Number(first.bid_size), Number(first.ask_size), bids, asks);
  };
}

function connectBithumb() {
  const name = "bithumb";
  if (!state.marketSets.domestic.bithumb.size) {
    setStatus(name, "blocked", "Bithumb 마켓 목록을 가져오지 못해 웹소켓 구독을 보류");
    return;
  }
  const symbols = [...state.marketSets.domestic.bithumb].map((s) => `${s}_KRW`);
  symbols.push("USDT_KRW");
  chunk(symbols, 80).forEach((symbolChunk, index) => connectBithumbChunk(symbolChunk, index));
}

function connectBithumbChunk(symbols, index) {
  const name = `bithumb${index ? `-${index + 1}` : ""}`;
  const ws = new WebSocket("wss://pubwss.bithumb.com/pub/ws");
  const bidBook = {};
  const askBook = {};
  ws.onopen = () => {
    setStatus(name, "connected");
    ws.send(JSON.stringify({
      type: "orderbooksnapshot",
      symbols
    }));
    ws.send(JSON.stringify({
      type: "orderbookdepth",
      symbols
    }));
  };
  ws.onerror = () => setStatus(name, "error");
  ws.onclose = () => reconnect(name, () => connectBithumbChunk(symbols, index));
  ws.onmessage = async (event) => {
    const msg = JSON.parse(await event.data.text?.() ?? event.data);
    const list = msg.content?.list ?? [];
    for (const item of list) {
      const symbol = item.symbol;
      const price = Number(item.price);
      const qty = Number(item.quantity ?? item.total ?? 0);
      const orderType = String(item.orderType ?? item.type ?? "").toLowerCase();
      if (!symbol || !Number.isFinite(price)) continue;
      bidBook[symbol] ??= new Map();
      askBook[symbol] ??= new Map();
      if (orderType.includes("bid") || orderType.includes("buy")) {
        if (qty === 0) bidBook[symbol].delete(price);
        else bidBook[symbol].set(price, qty);
      }
      if (orderType.includes("ask") || orderType.includes("sell")) {
        if (qty === 0) askBook[symbol].delete(price);
        else askBook[symbol].set(price, qty);
      }
      const bids = [...bidBook[symbol].entries()].map(([p, q]) => ({ price: Number(p), qty: Number(q) })).sort((a, b) => b.price - a.price).slice(0, 20);
      const asks = [...askBook[symbol].entries()].map(([p, q]) => ({ price: Number(p), qty: Number(q) })).sort((a, b) => a.price - b.price).slice(0, 20);
      const bestBid = bids[0]?.price;
      const bestAsk = asks[0]?.price;
      const bidQty = bids[0]?.qty;
      const askQty = asks[0]?.qty;
      if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) continue;
      if (symbol === "USDT_KRW") updateUsdt("bithumb", bestBid, bestAsk, bidQty, askQty, bids, asks);
      else {
        const asset = symbol.replace("_KRW", "");
        if (state.marketSets.domestic.bithumb.has(asset)) updateDomestic("bithumb", asset, bestBid, bestAsk, bidQty, askQty, bids, asks);
      }
    }
  };
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out.length ? out : [[]];
}

async function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) return data.buffer;
  if (typeof data.arrayBuffer === "function") return await data.arrayBuffer();
  return Buffer.from(String(data)).buffer;
}

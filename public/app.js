const rowsEl = document.querySelector("#rows");
const statusEl = document.querySelector("#status");
const clockEl = document.querySelector("#clock");
const summaryEl = document.querySelector("#summary");
const symbolFilter = document.querySelector("#symbolFilter");
const domesticFilter = document.querySelector("#domesticFilter");
const foreignFilter = document.querySelector("#foreignFilter");
const minPremiumInput = document.querySelector("#minPremiumInput");
const notionalInput = document.querySelector("#notionalInput");
const feeBufferInput = document.querySelector("#feeBufferInput");
const maxSlippageInput = document.querySelector("#maxSlippageInput");
const transferStatusInput = document.querySelector("#transferStatusInput");
const hedgeStatusInput = document.querySelector("#hedgeStatusInput");
const minHedgeBasisInput = document.querySelector("#minHedgeBasisInput");
const maxHedgeBasisInput = document.querySelector("#maxHedgeBasisInput");
const minHedgeDepthInput = document.querySelector("#minHedgeDepthInput");
const maxPremiumInput = document.querySelector("#maxPremiumInput");
const minDepthInput = document.querySelector("#minDepthInput");
const mmLevelsInput = document.querySelector("#mmLevelsInput");
const mmStepInput = document.querySelector("#mmStepInput");
const liveMaxInput = document.querySelector("#liveMaxInput");
const saveSettingsBtn = document.querySelector("#saveSettingsBtn");
const autoPaperBtn = document.querySelector("#autoPaperBtn");
const emergencyBtn = document.querySelector("#emergencyBtn");
const liveRequestBtn = document.querySelector("#liveRequestBtn");
const liveDisarmBtn = document.querySelector("#liveDisarmBtn");
const eligibleEl = document.querySelector("#eligible");
const paperTradesEl = document.querySelector("#paperTrades");
const riskEventsEl = document.querySelector("#riskEvents");
const balancesEl = document.querySelector("#balances");
const alertsEl = document.querySelector("#alerts");
const mmPlansEl = document.querySelector("#mmPlans");
const liveGateEl = document.querySelector("#liveGate");
const transferQueueEl = document.querySelector("#transferQueue");
const exitEngineEl = document.querySelector("#exitEngine");
const settlementsEl = document.querySelector("#settlements");
const recentSettlementBtn = document.querySelector("#recentSettlementBtn");
const withdrawalSourceEl = document.querySelector("#withdrawalSource");
const withdrawalDestinationEl = document.querySelector("#withdrawalDestination");
const withdrawalAssetEl = document.querySelector("#withdrawalAsset");
const withdrawalNetworkEl = document.querySelector("#withdrawalNetwork");
const withdrawalAmountEl = document.querySelector("#withdrawalAmount");
const withdrawalConfirmAssetEl = document.querySelector("#withdrawalConfirmAsset");
const withdrawalJsonImportEl = document.querySelector("#withdrawalJsonImport");
const withdrawalEnvImportEl = document.querySelector("#withdrawalEnvImport");
const withdrawalManualApprovalEl = document.querySelector("#withdrawalManualApproval");
const withdrawalQuoteBtn = document.querySelector("#withdrawalQuoteBtn");
const withdrawalSubmitBtn = document.querySelector("#withdrawalSubmitBtn");
const withdrawalRefreshBtn = document.querySelector("#withdrawalRefreshBtn");
const withdrawalSafetyEl = document.querySelector("#withdrawalSafety");
const withdrawalNoticeEl = document.querySelector("#withdrawalNotice");
const withdrawalQuoteEl = document.querySelector("#withdrawalQuote");
const withdrawalHistoryEl = document.querySelector("#withdrawalHistory");
const withdrawalEventsEl = document.querySelector("#withdrawalEvents");

let lastSnapshot = null;
let settingsSynced = false;
let filtersSynced = false;
let withdrawalOptions = null;
let withdrawalQuote = null;
let withdrawalHistory = [];
let selectedWithdrawalId = "";

connect();
[symbolFilter, domesticFilter, foreignFilter].forEach((el) => el.addEventListener("change", () => lastSnapshot && render(lastSnapshot)));
saveSettingsBtn.addEventListener("click", () => saveSettings());
autoPaperBtn.addEventListener("click", () => saveSettings({ autoPaperTrading: !(lastSnapshot?.settings?.autoPaperTrading) }));
emergencyBtn.addEventListener("click", () => saveSettings({ emergencyStop: !(lastSnapshot?.settings?.emergencyStop) }));
liveRequestBtn.addEventListener("click", () => saveSettings({ liveTradingRequested: !(lastSnapshot?.settings?.liveTradingRequested) }));
liveDisarmBtn.addEventListener("click", async () => {
  await fetch("/api/live-disarm", { method: "POST" });
});
[
  withdrawalSourceEl,
  withdrawalDestinationEl,
  withdrawalAssetEl,
  withdrawalNetworkEl,
  withdrawalAmountEl
].forEach((el) => el.addEventListener("change", () => {
  if (el !== withdrawalNetworkEl) syncWithdrawalNetworks();
  refreshWithdrawalQuote();
}));
withdrawalConfirmAssetEl.addEventListener("input", renderWithdrawalPanel);
withdrawalAmountEl.addEventListener("input", () => refreshWithdrawalQuote());
withdrawalManualApprovalEl.addEventListener("change", renderWithdrawalPanel);
withdrawalQuoteBtn.addEventListener("click", () => refreshWithdrawalQuote());
withdrawalSubmitBtn.addEventListener("click", () => submitWithdrawalDemo());
withdrawalRefreshBtn.addEventListener("click", () => refreshWithdrawalHistory());
recentSettlementBtn.addEventListener("click", async () => {
  await fetch("/api/recent-settlement", { method: "POST" });
});
withdrawalJsonImportEl.addEventListener("change", () => importWithdrawalConfig(withdrawalJsonImportEl.files?.[0], "json"));
withdrawalEnvImportEl.addEventListener("change", () => importWithdrawalConfig(withdrawalEnvImportEl.files?.[0], "env"));
initWithdrawalPanel();

function connect() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);
  ws.onopen = () => {
    clockEl.textContent = "WebSocket 연결됨";
  };
  ws.onmessage = (event) => {
    lastSnapshot = JSON.parse(event.data);
    render(lastSnapshot);
  };
  ws.onclose = () => {
    clockEl.textContent = "연결 끊김 · 재연결 중";
    setTimeout(connect, 1500);
  };
  ws.onerror = () => {
    clockEl.textContent = "WebSocket 오류";
  };
}

async function initWithdrawalPanel() {
  try {
    const options = await apiJson("/api/withdrawal-options");
    withdrawalOptions = options;
    fillSelect(withdrawalSourceEl, options.sourceExchanges);
    fillSelect(withdrawalDestinationEl, options.destinationExchanges);
    fillSelect(withdrawalAssetEl, options.assets);
    syncWithdrawalNetworks();
    renderWithdrawalSafety(options.safety);
    await refreshWithdrawalQuote();
    await refreshWithdrawalHistory();
  } catch (error) {
    withdrawalNoticeEl.textContent = `출금 옵션 로드 실패: ${error.message}`;
    withdrawalNoticeEl.className = "withdrawal-notice warn";
  }
}

async function apiJson(path, body = null) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function fillSelect(select, values) {
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function withdrawalRouteKey() {
  return `${withdrawalSourceEl.value}|${withdrawalDestinationEl.value}|${withdrawalAssetEl.value}`;
}

function syncWithdrawalNetworks() {
  const options = withdrawalOptions?.routes?.[withdrawalRouteKey()] ?? [];
  const current = withdrawalNetworkEl.value;
  withdrawalNetworkEl.innerHTML = options.length
    ? options.map((option) => `<option value="${escapeHtml(option.normalizedNetworkCode)}">${escapeHtml(option.displayName)} · ${escapeHtml(option.normalizedNetworkCode)}</option>`).join("")
    : `<option value="">공통 네트워크 없음</option>`;
  if (options.some((option) => option.normalizedNetworkCode === current)) withdrawalNetworkEl.value = current;
  else if (options[0]) withdrawalNetworkEl.value = options[0].normalizedNetworkCode;
  withdrawalConfirmAssetEl.placeholder = withdrawalAssetEl.value;
}

function withdrawalPayload() {
  return {
    sourceExchange: withdrawalSourceEl.value,
    destinationExchange: withdrawalDestinationEl.value,
    asset: withdrawalAssetEl.value,
    network: withdrawalNetworkEl.value,
    amount: Number(withdrawalAmountEl.value || 0),
    confirmAsset: withdrawalConfirmAssetEl.value,
    manualApproval: withdrawalManualApprovalEl.checked
  };
}

async function importWithdrawalConfig(file, type) {
  if (!file) return;
  try {
    const text = await file.text();
    const config = type === "json" ? JSON.parse(text) : parseEnvText(text);
    applyWithdrawalConfig(config);
    withdrawalNoticeEl.textContent = `${file.name} 설정을 불러왔습니다.`;
    withdrawalNoticeEl.className = "withdrawal-notice ok";
    await refreshWithdrawalQuote();
  } catch (error) {
    withdrawalNoticeEl.textContent = `설정 파일 불러오기 실패: ${error.message}`;
    withdrawalNoticeEl.className = "withdrawal-notice warn";
  } finally {
    if (type === "json") withdrawalJsonImportEl.value = "";
    if (type === "env") withdrawalEnvImportEl.value = "";
  }
}

function parseEnvText(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }
  return out;
}

function applyWithdrawalConfig(config) {
  const pick = (...keys) => keys.map((key) => config[key]).find((value) => value != null && value !== "");
  setSelectValue(withdrawalSourceEl, pick("sourceExchange", "source_exchange", "WITHDRAWAL_SOURCE", "SOURCE_EXCHANGE"));
  setSelectValue(withdrawalDestinationEl, pick("destinationExchange", "destination_exchange", "WITHDRAWAL_DESTINATION", "DESTINATION_EXCHANGE"));
  setSelectValue(withdrawalAssetEl, String(pick("asset", "currency", "WITHDRAWAL_ASSET", "ASSET") || "").toUpperCase());
  syncWithdrawalNetworks();
  setSelectValue(withdrawalNetworkEl, String(pick("network", "net_type", "WITHDRAWAL_NETWORK", "NETWORK") || "").toUpperCase());
  const amount = pick("amount", "requested_total_amount", "WITHDRAWAL_AMOUNT", "AMOUNT");
  if (amount != null && amount !== "") withdrawalAmountEl.value = amount;
  const confirmAsset = pick("confirmAsset", "confirm_asset", "CONFIRM_ASSET");
  if (confirmAsset != null) withdrawalConfirmAssetEl.value = confirmAsset;
}

function setSelectValue(select, value) {
  if (value == null || value === "") return;
  const match = [...select.options].find((option) => option.value.toLowerCase() === String(value).toLowerCase());
  if (match) select.value = match.value;
}

async function refreshWithdrawalQuote() {
  try {
    withdrawalQuote = await apiJson("/api/withdrawal-quote", withdrawalPayload());
    withdrawalNoticeEl.textContent = "";
    withdrawalNoticeEl.className = "withdrawal-notice";
    renderWithdrawalPanel();
  } catch (error) {
    withdrawalNoticeEl.textContent = `견적 갱신 실패: ${error.message}`;
    withdrawalNoticeEl.className = "withdrawal-notice warn";
  }
}

async function submitWithdrawalDemo() {
  try {
    const response = await apiJson("/api/withdrawal-submit", withdrawalPayload());
    if (!response.accepted) {
      withdrawalNoticeEl.textContent = `데모 제출 차단: ${response.reason}`;
      withdrawalNoticeEl.className = "withdrawal-notice warn";
      withdrawalQuote = response.quote ?? withdrawalQuote;
      renderWithdrawalPanel();
      return;
    }
    withdrawalNoticeEl.textContent = `${response.request.id} 데모 요청이 생성되었습니다.`;
    withdrawalNoticeEl.className = "withdrawal-notice ok";
    withdrawalConfirmAssetEl.value = "";
    withdrawalManualApprovalEl.checked = false;
    selectedWithdrawalId = response.request.id;
    await refreshWithdrawalQuote();
    await refreshWithdrawalHistory();
  } catch (error) {
    withdrawalNoticeEl.textContent = `데모 제출 실패: ${error.message}`;
    withdrawalNoticeEl.className = "withdrawal-notice warn";
  }
}

async function refreshWithdrawalHistory() {
  try {
    const data = await apiJson("/api/withdrawal-history");
    withdrawalHistory = data.items ?? [];
    if (!selectedWithdrawalId && withdrawalHistory[0]) selectedWithdrawalId = withdrawalHistory[0].id;
    renderWithdrawalPanel();
  } catch (error) {
    withdrawalNoticeEl.textContent = `이력 조회 실패: ${error.message}`;
    withdrawalNoticeEl.className = "withdrawal-notice warn";
  }
}

async function advanceWithdrawal(id) {
  const response = await apiJson("/api/withdrawal-advance", { id });
  if (!response.ok) {
    withdrawalNoticeEl.textContent = response.error || "진행 실패";
    withdrawalNoticeEl.className = "withdrawal-notice warn";
    return;
  }
  selectedWithdrawalId = id;
  await refreshWithdrawalHistory();
}

function renderWithdrawalPanel() {
  renderWithdrawalSafety(withdrawalQuote?.safety ?? withdrawalOptions?.safety);
  const quote = withdrawalQuote;
  const canSubmit = quote?.canSubmit && withdrawalConfirmAssetEl.value.toUpperCase() === withdrawalAssetEl.value && withdrawalManualApprovalEl.checked;
  withdrawalSubmitBtn.disabled = !canSubmit;
  withdrawalSubmitBtn.classList.toggle("disabled", !canSubmit);
  withdrawalQuoteEl.innerHTML = quote ? `
    ${summaryLine("입금 주소", quote.address?.address || "-", true)}
    ${summaryLine("Memo/Tag", quote.address?.tag || (quote.option?.requiresTag ? "필수" : "불필요"), true)}
    ${summaryLine("수수료", quote.option ? `${formatNumber(quote.estimatedFee, 6)} ${withdrawalAssetEl.value}` : "-")}
    ${summaryLine("최소 수량", quote.option ? `${formatNumber(quote.option.withdrawMin, 6)} ${withdrawalAssetEl.value}` : "-")}
    ${summaryLine("예상 수령량", `${formatNumber(quote.estimatedReceiveAmount, 6)} ${withdrawalAssetEl.value}`)}
    ${summaryLine("API 입력 수량", `${formatNumber(quote.withdrawAmount, 6)} ${withdrawalAssetEl.value}`)}
    ${summaryLine("입금 상태", quote.option?.depositEnabled ? "가능" : "차단")}
    ${summaryLine("출금 상태", quote.option?.withdrawEnabled ? "가능" : "차단")}
    ${summaryLine("주소 출처", quote.address?.source || "-")}
    ${summaryLine("출금 어댑터", quote.adapterAvailable ? "연결됨" : "미구현")}
    ${summaryLine("실행 모드", quote.executionMode || "DEMO_ONLY")}
    ${quote.payloadPreview ? `<div class="payload-preview"><div>Payload Preview</div><pre>${escapeHtml(JSON.stringify(quote.payloadPreview, null, 2))}</pre></div>` : ""}
    <div class="withdrawal-messages">
      ${(quote.messages ?? []).map((message) => `<div class="${message.startsWith("검증 통과") ? "ok" : "warn"}">${escapeHtml(message)}</div>`).join("")}
    </div>
  ` : `<div class="summary-meta">견적 대기</div>`;
  renderWithdrawalHistory();
  renderWithdrawalEvents();
}

function renderWithdrawalSafety(safety) {
  if (!safety) {
    withdrawalSafetyEl.innerHTML = "";
    return;
  }
  withdrawalSafetyEl.innerHTML = `
    ${safetyPill("PAPER", safety.paperTrading)}
    ${safetyPill("LIVE", safety.liveTrading, true)}
    ${safetyPill("WITHDRAWAL", safety.withdrawalEnabled, true)}
    ${safetyPill("DEMO", safety.demoMode)}
  `;
}

function renderWithdrawalHistory() {
  withdrawalHistoryEl.innerHTML = withdrawalHistory.length ? withdrawalHistory.map((item) => `
    <tr>
      <td><button class="link-button" onclick="selectWithdrawal('${escapeHtml(item.id)}')">${escapeHtml(item.id)}</button><br /><span class="summary-meta">${new Date(item.createdAt).toLocaleString("ko-KR")}</span></td>
      <td>${escapeHtml(item.sourceExchange)} → ${escapeHtml(item.destinationExchange)}<br /><span class="summary-meta">${escapeHtml(item.asset)} · ${escapeHtml(item.network)}</span></td>
      <td>${formatNumber(item.amount, 6)} ${escapeHtml(item.asset)}<br /><span class="summary-meta">수령 ${formatNumber(item.estimatedReceiveAmount, 6)}</span></td>
      <td>${escapeHtml(item.finalResult)}<br /><span class="summary-meta">${escapeHtml(item.sourceStatus)} / ${escapeHtml(item.destinationStatus)}</span></td>
      <td class="mono-cell">${escapeHtml(item.txid || "-")}</td>
      <td>${item.finalResult === "IN_PROGRESS" ? `<button class="secondary" onclick="advanceWithdrawal('${escapeHtml(item.id)}')">진행</button>` : "-"}</td>
    </tr>
  `).join("") : `<tr><td colspan="6">데모 제출 이력이 없습니다.</td></tr>`;
}

function renderWithdrawalEvents() {
  const selected = withdrawalHistory.find((item) => item.id === selectedWithdrawalId) ?? withdrawalHistory[0];
  if (!selected) {
    withdrawalEventsEl.innerHTML = `<div class="summary-meta">선택된 요청이 없습니다.</div>`;
    return;
  }
  withdrawalEventsEl.innerHTML = `
    <div class="log-item"><strong>WithdrawOrderId</strong><br /><span class="mono-cell">${escapeHtml(selected.withdrawOrderId)}</span></div>
    <div class="log-item"><strong>주소</strong><br /><span class="mono-cell">${escapeHtml(selected.address)}</span><br />Memo/Tag ${escapeHtml(selected.tag || "-")}</div>
    <div class="log-item"><strong>Travel Rule</strong><br />${escapeHtml(selected.travelRuleStatus)}</div>
    ${selected.events.map((event) => `<div class="log-item"><strong>${new Date(event.at).toLocaleString("ko-KR")}</strong><br />${escapeHtml(event.message)}</div>`).join("")}
  `;
}

function summaryLine(label, value, mono = false) {
  return `<div class="withdrawal-row"><span>${escapeHtml(label)}</span><strong class="${mono ? "mono-cell" : ""}">${escapeHtml(value)}</strong></div>`;
}

function safetyPill(label, enabled, danger = false) {
  const className = enabled ? (danger ? "danger" : "ok") : "off";
  return `<span class="safety-pill ${className}">${escapeHtml(label)} ${enabled ? "ON" : "OFF"}</span>`;
}

function selectWithdrawal(id) {
  selectedWithdrawalId = id;
  renderWithdrawalPanel();
}

function render(data) {
  clockEl.textContent = `서버 시간 ${new Date(data.serverTime).toLocaleTimeString("ko-KR")}`;
  syncSettingsControls(data.settings);
  syncFilterOptions(data);
  const liveRows = data.rows.filter((row) => !(row.stale.domestic || row.stale.foreign || row.stale.usdt) && row.premiumPercent != null);
  const best = liveRows[0];
  const positiveCount = liveRows.filter((row) => row.premiumPercent > 0).length;
  const eligibleCount = data.eligibleRows?.length ?? 0;
  const staleCount = data.rows.length - liveRows.length;
  summaryEl.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">최고 김프</div>
      <div class="summary-value ${best?.premiumPercent >= 0 ? "positive-text" : "negative-text"}">${best ? best.premiumPercent.toFixed(3) + "%" : "-"}</div>
      <div class="summary-meta">${best ? `${best.asset} · ${best.domesticExchange} / ${best.foreignExchange}` : "데이터 대기"}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">국내가 더 비싼 조합</div>
      <div class="summary-value positive-text">${positiveCount}</div>
      <div class="summary-meta">live row 기준</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">자동 모의 대상</div>
      <div class="summary-value positive-text">${eligibleCount}</div>
      <div class="summary-meta">양수 + 최소 프리미엄 이상</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">stale 조합</div>
      <div class="summary-value ${staleCount ? "stale-text" : "positive-text"}">${staleCount}</div>
      <div class="summary-meta">8초 이상 미갱신 포함</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">총 비교 조합</div>
      <div class="summary-value">${data.rows.length}</div>
      <div class="summary-meta">해외 4곳 중 하나 이상 상장 시 비교 · ${data.universe?.count ?? data.symbols?.length ?? "-"}개 자산</div>
    </div>
  `;

  autoPaperBtn.textContent = data.settings.autoPaperTrading ? "자동 모의 ON" : "자동 모의 OFF";
  autoPaperBtn.classList.toggle("active", data.settings.autoPaperTrading);
  emergencyBtn.textContent = data.settings.emergencyStop ? "긴급 정지 ON" : "긴급 정지 OFF";
  emergencyBtn.classList.toggle("warn", data.settings.emergencyStop);
  renderEligible(data.eligibleRows ?? []);
  renderMmPlans(data.mmSellPlans ?? []);
  renderTransferQueue(data.transferPositions ?? []);
  renderExitEngine(data.exitPositions ?? []);
  renderSettlements(data.settlements ?? []);
  renderPaperTrades(data.paperTrades ?? []);
  renderOps(data);
  renderLiveGate(data);

  statusEl.innerHTML = Object.entries(data.status)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, info]) => `
      <div class="status-card">
        <strong>${escapeHtml(name)}</strong>
        <span class="${info.status === "connected" ? "ok-text" : "stale-text"}">${escapeHtml(info.status)}</span>
        <div>${escapeHtml(info.detail || "")}</div>
      </div>
    `).join("");

  const filtered = data.rows.filter((row) => {
    return (symbolFilter.value === "all" || row.asset === symbolFilter.value)
      && (domesticFilter.value === "all" || row.domesticExchange === domesticFilter.value)
      && (foreignFilter.value === "all" || row.foreignExchange === foreignFilter.value);
  });

  rowsEl.innerHTML = filtered.map((row) => {
    const stale = row.stale.domestic || row.stale.foreign || row.stale.usdt;
    const pct = row.premiumPercent;
    const pctClass = pct == null ? "" : pct >= 0 ? "positive-text" : "negative-text";
    return `
      <tr>
        <td><strong>${row.asset}</strong><br /><span class="summary-meta">해외 ${row.foreignVenueCount ?? row.foreignVenues?.length ?? "-"}곳</span></td>
        <td>${row.domesticExchange}</td>
        <td>${row.foreignExchange}</td>
        <td>${formatNumber(row.domesticBid, 0)}</td>
        <td>${formatNumber(row.foreignAsk, row.foreignAsk > 10 ? 2 : 5)}</td>
        <td>${formatNumber(row.usdtKrw, 2)}</td>
        <td class="premium ${pctClass}">${pct == null ? "-" : pct.toFixed(3) + "%"}</td>
        <td class="premium ${row.netPremiumPercent >= 0 ? "positive-text" : "negative-text"}">${row.netPremiumPercent == null ? "-" : row.netPremiumPercent.toFixed(3) + "%"}</td>
        <td>${formatNumber(row.slippagePercent, 3)}%</td>
        <td>${formatNumber(row.availableDepthUsdt, 2)}</td>
        <td><div class="risk-reason">${row.risk?.approved ? "APPROVED" : (row.risk?.reasons ?? []).join(", ")}${row.transferStatus ? `<br /><span class="summary-meta">출금 ${row.transferStatus.withdrawEnabled ? "OK" : "BLOCK"} · 입금 ${row.transferStatus.depositEnabled ? "OK" : "BLOCK"} · ${escapeHtml(row.transferStatus.source)}</span>` : ""}${row.transferStatus?.routeEconomics ? `<br /><span class="summary-meta">네트워크 ${escapeHtml(row.transferStatus.routeEconomics.bestNetwork || row.transferStatus.network || "-")} · 수수료 ${formatNumber(row.transferStatus.routeEconomics.withdrawFee, 6)} ${row.asset} · 차익 ${formatNumber(row.transferStatus.routeEconomics.estimatedNetEdgeAfterTransferFeeKrw, 0)} KRW</span>` : ""}${row.hedgeStatus ? `<br /><span class="summary-meta">헷지 ${row.hedgeStatus.shortEnabled ? "OK" : "BLOCK"} · ${escapeHtml(row.hedgeStatus.exchange || "-")} · basis ${formatNumber(row.hedgeStatus.basisPercent, 3)}% · 깊이 ${formatNumber(row.hedgeStatus.depthUsdt, 0)}</span>` : ""}${row.domesticDivergencePercent != null ? `<br /><span class="summary-meta">국내괴리 ${formatNumber(row.domesticDivergencePercent, 2)}%</span>` : ""}</div></td>
        <td>${stale ? `<span class="stale-text">stale · ${ageText(row.updatedAgoMs)}</span>` : `<span class="ok-text">live</span>`}</td>
      </tr>
    `;
  }).join("");
}

function syncFilterOptions(data) {
  if (filtersSynced && data.symbols?.length === symbolFilter.options.length - 1) return;
  const currentSymbol = symbolFilter.value;
  const symbols = [...(data.symbols ?? [])].sort();
  symbolFilter.innerHTML = `<option value="all">전체 코인</option>${symbols.map((symbol) => `<option value="${escapeHtml(symbol)}">${escapeHtml(symbol)}</option>`).join("")}`;
  symbolFilter.value = symbols.includes(currentSymbol) ? currentSymbol : "all";
  filtersSynced = true;
}

function syncSettingsControls(settings) {
  if (settingsSynced) return;
  minPremiumInput.value = settings.minPremiumPercent;
  notionalInput.value = settings.orderNotionalUsdt;
  feeBufferInput.value = settings.feeBufferPercent;
  maxSlippageInput.value = settings.maxSlippagePercent;
  transferStatusInput.checked = settings.requireTransferStatusForPaper;
  hedgeStatusInput.checked = settings.requireHedgeStatusForPaper;
  minHedgeBasisInput.value = settings.minHedgeBasisPercent;
  maxHedgeBasisInput.value = settings.maxHedgeBasisPercent;
  minHedgeDepthInput.value = settings.minHedgeDepthUsdt;
  maxPremiumInput.value = settings.maxAutoPremiumPercent;
  minDepthInput.value = settings.minDepthUsdt;
  mmLevelsInput.value = settings.mmSellLadderLevels;
  mmStepInput.value = settings.mmSellStepPercent;
  liveMaxInput.value = settings.liveMaxOrderNotionalUsdt;
  settingsSynced = true;
}

async function saveSettings(overrides = {}) {
  const settings = {
    minPremiumPercent: minPremiumInput.value,
    orderNotionalUsdt: notionalInput.value,
    feeBufferPercent: feeBufferInput.value,
    maxSlippagePercent: maxSlippageInput.value,
    requireTransferStatusForPaper: transferStatusInput.checked,
    requireHedgeStatusForPaper: hedgeStatusInput.checked,
    minHedgeBasisPercent: minHedgeBasisInput.value,
    maxHedgeBasisPercent: maxHedgeBasisInput.value,
    minHedgeDepthUsdt: minHedgeDepthInput.value,
    maxAutoPremiumPercent: maxPremiumInput.value,
    minDepthUsdt: minDepthInput.value,
    mmSellLadderLevels: mmLevelsInput.value,
    mmSellStepPercent: mmStepInput.value,
    liveMaxOrderNotionalUsdt: liveMaxInput.value,
    autoPaperTrading: lastSnapshot?.settings?.autoPaperTrading ?? false,
    emergencyStop: lastSnapshot?.settings?.emergencyStop ?? false,
    liveTradingRequested: lastSnapshot?.settings?.liveTradingRequested ?? false,
    ...overrides
  };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(settings)) params.set(key, String(value));
  await fetch(`/api/settings?${params.toString()}`, { method: "POST" });
}

function renderMmPlans(plans) {
  if (!plans.length) {
    mmPlansEl.innerHTML = `<div class="summary-meta">양수 김프 조합이 생기면 국내 매도 최적화 계획이 여기에 표시됩니다.</div>`;
    return;
  }
  mmPlansEl.innerHTML = plans.slice(0, 6).map((plan) => `
    <div class="signal-card">
      <strong>${plan.asset} · ${plan.domesticExchange} SELL_ONLY_LADDER</strong>
      <div>즉시 매도가 ${formatNumber(plan.immediateSellPrice, 0)} → 계획 평균 ${formatNumber(plan.expectedAvgSellPrice, 0)} KRW</div>
      <div>예상 개선 ${formatNumber(plan.improvementPercent, 3)}% · 재배치 기준 ${formatNumber(plan.repriceWhenBestBidMovesPercent, 2)}%</div>
      <div class="summary-meta">${plan.partialFillPolicy}</div>
      <ol class="mini-list">
        ${plan.ladder.slice(0, 5).map((order) => `<li>${formatNumber(order.price, 0)} KRW · ${formatNumber(order.quantity, order.quantity > 1 ? 4 : 8)} ${plan.asset}</li>`).join("")}
      </ol>
      <div class="forbidden">${plan.forbidden.join(" · ")}</div>
    </div>
  `).join("");
}

function renderTransferQueue(positions) {
  if (!positions.length) {
    transferQueueEl.innerHTML = `<div class="summary-meta">전송 감시 중인 포지션이 없습니다.</div>`;
    return;
  }
  transferQueueEl.innerHTML = positions.slice(0, 12).map((position) => {
    const eta = new Date(position.etaAt).getTime();
    const remainingMs = eta - Date.now();
    const remaining = remainingMs > 0 ? `${Math.ceil(remainingMs / 1000)}초` : "도착/대기";
    const statusClass = position.status.includes("CLOSED") ? "ok-text" : position.status === "WAITING_PREMIUM" ? "stale-text" : "positive-text";
    return `
      <div class="signal-card">
        <strong>${escapeHtml(position.asset)} · ${escapeHtml(position.domesticExchange)} / ${escapeHtml(position.foreignExchange)}</strong>
        <div class="${statusClass}">${escapeHtml(position.status)} · ${escapeHtml(position.statusMessage)}</div>
        <div>진입 net ${formatNumber(position.startedNetPremiumPercent, 3)}% → 현재 net ${formatNumber(position.currentNetPremiumPercent, 3)}% · 기준 ${formatNumber(position.targetNetPremiumPercent, 3)}%</div>
        <div>수량 ${formatNumber(position.quantity, position.quantity > 1 ? 4 : 8)} · ETA ${new Date(position.etaAt).toLocaleTimeString("ko-KR")} · ${remaining}</div>
        <div class="summary-meta">출금 ${position.transferStatus?.withdrawEnabled ? "OK" : "BLOCK"} · 입금 ${position.transferStatus?.depositEnabled ? "OK" : "BLOCK"} · ${escapeHtml(position.transferStatus?.source || "UNKNOWN")}</div>
        <div class="summary-meta">헷지 ${position.hedgeStatus?.shortEnabled ? "OK" : "BLOCK"} · ${escapeHtml(position.hedgeStatus?.exchange || "-")} · basis ${formatNumber(position.hedgeStatus?.basisPercent, 3)}%</div>
        <div class="summary-meta">청산 경로: ${escapeHtml(position.closeRoute || "미정")}</div>
        <div class="action-row">
          ${position.status === "IN_TRANSIT" ? `<button class="secondary" onclick="manualTransferConfirm('${escapeHtml(position.id)}')">수동 전송 확인 후 이어가기</button>` : ""}
          ${position.status === "IN_TRANSIT" || position.status === "WAITING_PREMIUM" ? `<button class="secondary" onclick="manualReturn('${escapeHtml(position.id)}')">수동 복귀 청산</button>` : ""}
          ${position.status === "WAITING_PREMIUM" ? `<button class="danger" onclick="cancelExit('${escapeHtml(position.id)}')">진행 중지</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

async function manualReturn(id) {
  await fetch(`/api/transfer-return?id=${encodeURIComponent(id)}`, { method: "POST" });
}

async function manualTransferConfirm(id) {
  await fetch(`/api/manual-transfer-confirm?id=${encodeURIComponent(id)}`, { method: "POST" });
}

async function manualSpotSellDetect(id) {
  await fetch(`/api/manual-spot-sell-detect?id=${encodeURIComponent(id)}`, { method: "POST" });
}

async function returnOriginExit(id) {
  await fetch(`/api/return-origin-exit?id=${encodeURIComponent(id)}`, { method: "POST" });
}

async function cancelExit(id) {
  await fetch(`/api/exit-cancel?id=${encodeURIComponent(id)}`, { method: "POST" });
}

function renderExitEngine(exits) {
  if (!exits.length) {
    exitEngineEl.innerHTML = `<div class="summary-meta">입금 확인 후 현물 매도 + 숏 비례 청산 단계가 여기에 표시됩니다.</div>`;
    return;
  }
  exitEngineEl.innerHTML = exits.slice(0, 12).map((exit) => `
    <div class="signal-card">
      <strong>${escapeHtml(exit.asset)} · ${escapeHtml(exit.sellExchange)} spot sell / ${escapeHtml(exit.shortExchange)} short close</strong>
      <div class="${exit.status === "COMPLETED" ? "ok-text" : exit.status === "WAITING_PREMIUM" ? "stale-text" : "positive-text"}">${escapeHtml(exit.status)} · ${escapeHtml(exit.statusMessage)}</div>
      <div>4단계 현물 매도: ${escapeHtml(exit.stages?.spotSell || "pending")} · 누적 ${formatNumber(exit.cumulativeSpotSoldQuantity, 6)} / 목표 ${formatNumber(exit.targetSpotSellQuantity, 6)}</div>
      <div>5단계 숏 청산: ${escapeHtml(exit.stages?.shortClose || "pending")} · 누적 ${formatNumber(exit.cumulativeShortClosedQuantity, 6)} / 진입 ${formatNumber(exit.shortEntryQuantity, 6)}</div>
      <div>매도 직전 net ${formatNumber(exit.currentNetPremiumPercent, 3)}% · 기준 ${formatNumber(exit.minPremiumPercent, 3)}% · 허용오차 ${formatNumber(exit.tolerancePercent, 2)}%</div>
      <div class="summary-meta">공식: 숏청산 = 전체 숏 진입 수량 × 이번 현물 체결 수량 ÷ 전체 현물 매도 목표 수량</div>
      <div class="action-row">
        ${exit.status !== "COMPLETED" && exit.status !== "CANCELLED" ? `<button class="secondary" onclick="manualSpotSellDetect('${escapeHtml(exit.id)}')">수동 매도 인식 + 숏 청산</button>` : ""}
        ${exit.status !== "COMPLETED" && exit.status !== "CANCELLED" ? `<button class="secondary" onclick="returnOriginExit('${escapeHtml(exit.transferId)}')">원 매수 거래소 반환 후 매도/청산</button>` : ""}
        ${exit.status !== "COMPLETED" && exit.status !== "CANCELLED" ? `<button class="danger" onclick="cancelExit('${escapeHtml(exit.id)}')">진행 중지</button>` : ""}
      </div>
      <ol class="mini-list">
        ${(exit.events ?? []).slice(0, 5).map((event) => `<li>${new Date(event.at).toLocaleTimeString("ko-KR")} · ${escapeHtml(event.message)}</li>`).join("")}
      </ol>
    </div>
  `).join("");
}

function renderSettlements(settlements) {
  if (!settlements.length) {
    settlementsEl.innerHTML = `<div class="summary-meta">현물 매도와 숏 청산이 완료되면 정산 카드가 생성됩니다.</div>`;
    return;
  }
  settlementsEl.innerHTML = settlements.slice(0, 12).map((settlement) => `
    <div class="signal-card">
      <strong>${escapeHtml(settlement.asset)} · ${new Date(settlement.createdAt).toLocaleTimeString("ko-KR")}</strong>
      <div>총 손익 ${formatNumber(settlement.pnl?.totalPnlKrw, 0)} KRW · 현물 ${formatNumber(settlement.pnl?.spotPnlKrw, 0)} · 선물 ${formatNumber(settlement.pnl?.futuresPnlKrw, 0)}</div>
      <div>현물 매도 ${formatNumber(settlement.quantities?.spotSold, 6)} · 숏 청산 ${formatNumber(settlement.quantities?.shortClosed, 6)}</div>
      ${(settlement.flags ?? []).length ? `<div class="forbidden">${settlement.flags.map(escapeHtml).join(" · ")}</div>` : ""}
      <ol class="mini-list">
        ${(settlement.byExchange ?? []).map((item) => `<li>${escapeHtml(item.exchange)} · 현물 ${formatNumber(item.spotKrw, 0)} · 선물 ${formatNumber(item.futuresKrw, 0)} · 수수료 ${formatNumber(item.feesKrw, 0)} · 합계 ${formatNumber(item.totalKrw, 0)}</li>`).join("")}
      </ol>
    </div>
  `).join("");
}

function renderOps(data) {
  const balances = data.simulatedBalances ?? {};
  balancesEl.innerHTML = Object.entries(balances).map(([key, value]) => `
    <div class="log-item"><strong>${key}</strong><br />${formatNumber(value, key.includes("Pnl") || key.includes("Krw") || key === "KRW" ? 0 : 4)}</div>
  `).join("");

  const riskEvents = data.riskEvents ?? [];
  riskEventsEl.innerHTML = riskEvents.length ? riskEvents.slice(0, 12).map((event) => `
    <div class="log-item"><strong>${escapeHtml(event.type)}</strong><br />${escapeHtml(event.message)}<br /><span class="summary-meta">${new Date(event.createdAt).toLocaleTimeString("ko-KR")}</span></div>
  `).join("") : `<div class="summary-meta">리스크 이벤트 없음</div>`;

  const alerts = data.alerts ?? [];
  alertsEl.innerHTML = alerts.length ? alerts.slice(0, 12).map((event) => `
    <div class="log-item"><strong>${escapeHtml(event.type)}</strong><br />${escapeHtml(event.message)}<br /><span class="summary-meta">${new Date(event.createdAt).toLocaleTimeString("ko-KR")}</span></div>
  `).join("") : `<div class="summary-meta">알림 없음</div>`;
}

function renderLiveGate(data) {
  const readiness = data.live?.readiness ?? {};
  liveRequestBtn.textContent = data.settings.liveTradingRequested ? "실거래 요청 ON" : "실거래 요청 OFF";
  liveRequestBtn.classList.toggle("active", data.settings.liveTradingRequested);
  const missing = readiness.missing ?? [];
  const orders = data.live?.orders ?? [];
  liveGateEl.innerHTML = `
    <div class="signal-card">
      <strong>${readiness.ready ? "READY" : "LOCKED"} · ${data.live?.armed ? "ARMED" : "DISARMED"}</strong>
      <div>지원 실거래 경로: ${(readiness.supportedRoutes ?? []).join(", ") || "-"}</div>
      <div>최대 주문: ${formatNumber(readiness.maxOrderNotionalUsdt, 2)} USDT · 출금 ${readiness.withdrawalEnabled ? "ON" : "OFF"} · 자동 리밸런싱 ${readiness.autoRebalanceEnabled ? "ON" : "OFF"}</div>
      <div class="summary-meta">ARM 만료: ${data.live?.armedUntil ? new Date(data.live.armedUntil).toLocaleTimeString("ko-KR") : "-"}</div>
      <div class="${readiness.ready ? "ok-text" : "stale-text"}">${missing.length ? `잠금 사유: ${missing.join(", ")}` : "모든 실거래 게이트 통과"}</div>
    </div>
    <div class="signal-card">
      <strong>최근 실거래 라우트</strong>
      ${orders.length ? orders.slice(0, 5).map((order) => `<div>${new Date(order.createdAt).toLocaleTimeString("ko-KR")} · ${order.asset} · ${order.status}</div>`).join("") : `<div class="summary-meta">아직 실거래 주문 기록 없음</div>`}
    </div>
  `;
}

function renderEligible(rows) {
  if (!rows.length) {
    eligibleEl.innerHTML = `<div class="summary-meta">현재 최소 프리미엄 이상인 양수 김프 조합이 없습니다.</div>`;
    return;
  }
  eligibleEl.innerHTML = rows.slice(0, 8).map((row) => `
    <div class="signal-card">
      <strong>${row.asset} · ${row.domesticExchange} / ${row.foreignExchange}</strong>
      <div>김프 ${row.premiumPercent.toFixed(3)}% · 비용 반영 ${row.netPremiumPercent.toFixed(3)}%</div>
      <div>국내 bid ${formatNumber(row.domesticBid, 0)} KRW · 해외 ask ${formatNumber(row.foreignAsk, row.foreignAsk > 10 ? 2 : 5)} USDT</div>
      <div class="summary-meta">헷지 ${escapeHtml(row.hedgeStatus?.exchange || "-")} · 선물 bid ${formatNumber(row.hedgeStatus?.futuresBid, row.hedgeStatus?.futuresBid > 10 ? 2 : 5)} · basis ${formatNumber(row.hedgeStatus?.basisPercent, 3)}%</div>
    </div>
  `).join("");
}

function renderPaperTrades(trades) {
  if (!trades.length) {
    paperTradesEl.innerHTML = `<tr><td colspan="8">아직 모의 체결 기록이 없습니다.</td></tr>`;
    return;
  }
  paperTradesEl.innerHTML = trades.slice(0, 30).map((trade) => `
    <tr>
      <td>${new Date(trade.createdAt).toLocaleTimeString("ko-KR")}</td>
      <td>${trade.mode}</td>
      <td><strong>${trade.asset}</strong></td>
      <td>${trade.domesticExchange} bid</td>
      <td>${trade.foreignExchange} spot buy + short / ${trade.domesticExchange} MM sell ladder</td>
      <td>${formatNumber(trade.quantity, trade.quantity > 1 ? 4 : 8)}</td>
      <td class="premium positive-text">${trade.premiumPercent.toFixed(3)}%</td>
      <td>${formatNumber(trade.estimatedNetEdgeKrw, 0)}</td>
    </tr>
  `).join("");
}

function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ageText(ages) {
  const max = Math.max(...Object.values(ages).filter((v) => v != null));
  if (!Number.isFinite(max)) return "-";
  return `${(max / 1000).toFixed(1)}s`;
}

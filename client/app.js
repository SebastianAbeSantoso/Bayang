const $ = (selector) => document.querySelector(selector);
const state = {
  samples: [], caseId: null, caseInfo: null, mode: "apprentice", quest: null,
  chosenGroup: null, rationale: "risk_density", investigated: new Set(), guideRemaining: 0,
};

async function api(path, body) {
  const response = await fetch(path, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function showError(message) {
  const box = $("#error-box"); box.textContent = message; box.hidden = false;
}
function clearError() { const box = $("#error-box"); box.textContent = ""; box.hidden = true; }
function changeStep(active) {
  document.querySelectorAll(".step").forEach((el) => {
    const number = Number(el.dataset.step);
    el.classList.toggle("active", number === active);
    el.classList.toggle("done", number < active);
  });
}
function createText(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = content;
  return element;
}

function resetQuestView() {
  state.quest = null; state.chosenGroup = null; state.rationale = "risk_density"; state.investigated.clear(); state.guideRemaining = 0;
  $("#quest-content").hidden = true; $("#transfer-card").hidden = true;
  $("#empty-state").hidden = false; $("#loading-state").hidden = true;
  $("#answer-result").hidden = true; $("#ending").hidden = true;
  const consequenceBox = $("#consequence-box"); if (consequenceBox) consequenceBox.hidden = true;
  const computeReceipt = $("#compute-receipt"); if (computeReceipt) computeReceipt.hidden = true;
  const repairBadge = $("#quest-repair-badge"); if (repairBadge) repairBadge.hidden = true;
  const costReceipt = $("#quest-cost-receipt"); if (costReceipt) costReceipt.hidden = true;
  $("#evidence-board").replaceChildren(); $("#guide-messages").replaceChildren();
  document.querySelectorAll("#map-routes .route-chip").forEach((chip) => {
    chip.classList.remove("map-highlight", "has-anomaly");
  });
  changeStep(1);
}

function highlightRoute(group, active) {
  if (!group) return;
  document.querySelectorAll("#map-routes .route-chip").forEach((chip) => {
    if (chip.dataset.group === group) {
      chip.classList.toggle("map-highlight", active);
    }
  });
  document.querySelectorAll(".evidence-table tr").forEach((row) => {
    if (row.dataset.group === group) {
      row.classList.toggle("row-highlight", active);
    }
  });
  document.querySelectorAll(".whatif-row").forEach((row) => {
    if (row.dataset.group === group) {
      row.classList.toggle("row-highlight", active);
    }
  });
}

function selectRouteFromMap(group) {
  if (!group) return;
  const option = document.querySelector(`#answer-options button[data-group="${CSS.escape(group)}"]`);
  if (option) {
    option.click();
    option.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function syncAnomaliesToMap(rows) {
  if (!rows || !Array.isArray(rows)) return;
  rows.forEach((row) => {
    if (row.is_outlier) {
      const chip = document.querySelector(`#map-routes .route-chip[data-group="${CSS.escape(row.group)}"]`);
      if (chip) chip.classList.add("has-anomaly");
    }
  });
}

function renderCaseSummary() {
  const info = state.caseInfo;
  $("#profile-card").hidden = !info;
  if (!info) return;
  $("#case-summary").textContent = `${info.group_count} groups · count and rate investigation`;

  let schemaEl = $("#schema-mapping-badge");
  if (!schemaEl) {
    schemaEl = document.createElement("div");
    schemaEl.id = "schema-mapping-badge";
    schemaEl.className = "schema-badge";
    const profileCard = $("#profile-card");
    const profileGroups = $("#profile-groups");
    if (profileCard && profileGroups) {
      profileCard.insertBefore(schemaEl, profileGroups);
    }
  }
  if (info.is_raw_log) {
    schemaEl.innerHTML = `<span class="schema-glyph">⚡</span> Raw log aggregation: <code>${info.raw_row_count}</code> event rows aggregated into <code>${info.group_count}</code> entities`;
    schemaEl.hidden = false;
  } else if (info.stratified) {
    schemaEl.innerHTML = `<span class="schema-glyph">✦</span> Stratified dataset: Confounder <code>${info.stratified.confounder_col}</code> detected (${info.stratified.strata.length} strata)`;
    schemaEl.hidden = false;
  } else if (info.schema_mapping && info.schema_mapping.is_aliased) {
    schemaEl.innerHTML = `<span class="schema-glyph">✓</span> Inferred headers: <code>${info.schema_mapping.group_col}</code> → Group, <code>${info.schema_mapping.events_col}</code> → Events, <code>${info.schema_mapping.opportunities_col}</code> → Exposure`;
    schemaEl.hidden = false;
  } else if (schemaEl) {
    schemaEl.hidden = true;
  }

  const list = $("#profile-groups"); list.replaceChildren();
  info.groups.forEach((label) => list.append(createText("span", "group-chip", label)));

  // Domain-adaptive map canvas
  const mapArt = document.querySelector(".map-art");
  if (mapArt) {
    mapArt.classList.remove("domain-cloud", "domain-healthcare", "domain-fantasy", "domain-tactical");
    const dom = info.domain || "fantasy";
    mapArt.classList.add(`domain-${dom}`);
  }

  const routes = $("#map-routes"); routes.replaceChildren();
  const domainLabel = info.domain === "cloud" ? "Service" : info.domain === "healthcare" ? "Cohort" : "Route";
  info.groups.slice(0, 5).forEach((label, index) => {
    const route = createText("span", `route-chip route-${index % 4}`, label);
    route.dataset.group = label;
    route.title = `${domainLabel}: ${label} (Click to select)`;
    route.addEventListener("mouseenter", () => highlightRoute(label, true));
    route.addEventListener("mouseleave", () => highlightRoute(label, false));
    route.addEventListener("click", () => selectRouteFromMap(label));
    routes.append(route);
  });
  if (info.groups.length > 5) routes.append(createText("span", "route-more", `+${info.groups.length - 5} more`));

  if (info.domain === "cloud") {
    $("#map-title").textContent = "CLOUD TOPOLOGY";
    $("#map-caption-left").textContent = `${info.group_count} MICROSERVICES · CLUSTER TELEMETRY`;
  } else if (info.domain === "healthcare") {
    $("#map-title").textContent = "CLINICAL VECTORS";
    $("#map-caption-left").textContent = `${info.group_count} COHORTS · PROTOCOL SURVEILLANCE`;
  } else if (info.domain === "tactical") {
    $("#map-title").textContent = "TACTICAL RADAR";
    $("#map-caption-left").textContent = `${info.group_count} SECTORS · SECTOR GRID`;
  } else {
    $("#map-title").textContent = "A NEW REGION";
    $("#map-caption-left").textContent = `${info.group_count} ROUTES · ONE MYSTERY`;
  }
}

async function loadCsv(csv) {
  clearError(); $("#begin-button").disabled = true;
  state.caseId = null; state.caseInfo = null; renderCaseSummary();
  resetQuestView();
  try {
    const result = await api("/api/profile", { csv });
    state.caseId = result.case_id; state.caseInfo = result.case;
    renderCaseSummary(); $("#begin-button").disabled = false;
  } catch (error) {
    state.caseId = null; state.caseInfo = null; renderCaseSummary(); showError(error.message);
  }
}

async function loadSamples() {
  try {
    const data = await api("/api/samples"); state.samples = data.samples;
    const select = $("#dataset-select"); select.replaceChildren();
    const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Choose a sample ledger…"; select.append(placeholder);
    for (const sample of state.samples) {
      const option = document.createElement("option"); option.value = sample.id; option.textContent = sample.label; select.append(option);
    }
    select.addEventListener("change", () => {
      const selected = state.samples.find((sample) => sample.id === select.value);
      if (selected) loadCsv(selected.csv);
    });
    const status = await api("/api/status");
    const badge = $("#model-status");
    if (status.mode === "amd-configured") {
      badge.classList.add("live"); badge.innerHTML = `<b></b> AMD · ${status.model} configured`;
    } else {
      badge.classList.add("preview"); badge.innerHTML = "<b></b> Local preview · no AMD key";
    }
  } catch (error) { showError(`Could not open the campaign seed: ${error.message}`); }
}

function renderCharacters(characters) {
  const target = $("#characters"); target.replaceChildren();
  characters.forEach((character) => {
    const card = createText("article", "character", "");
    card.append(createText("span", "portrait", character.name.slice(0, 1)));
    const info = document.createElement("div");
    info.append(createText("strong", "character-name", character.name));
    info.append(createText("span", "character-role", character.role));
    info.append(createText("p", "character-voice", `“${character.voice}”`));
    card.append(info); target.append(card);
  });
}

function renderInvestigations() {
  const target = $("#investigations"); target.replaceChildren();
  state.quest.investigations.forEach((investigation, index) => {
    const button = createText("button", "investigation-card", ""); button.type = "button";
    button.dataset.action = investigation.id;
    button.append(createText("span", "investigation-index", `0${index + 1}`));
    const words = document.createElement("span"); words.className = "investigation-words";
    words.append(createText("strong", "investigation-title", investigation.title));
    words.append(createText("span", "investigation-opening", investigation.opening));
    button.append(words, createText("span", "investigation-arrow", "↗"));
    if (state.investigated.has(investigation.id)) {
      button.classList.add("investigated"); button.append(createText("span", "found-mark", "FOUND"));
    } else {
      button.addEventListener("click", () => investigate(investigation.id, button));
    }
    target.append(button);
  });
  updateDecisionLock();
}

function renderEvidence(action, investigation, evidence) {
  const board = $("#evidence-board");
  let card = board.querySelector(`[data-evidence-id="${action}"]`);
  if (!card) {
    card = document.createElement("article");
    card.className = "evidence-card";
    card.dataset.evidenceId = action;
    board.append(card);
  }
  card.replaceChildren();
  const header = document.createElement("div");
  header.className = "evidence-card-head";
  header.append(createText("span", "evidence-stamp", "INVESTIGATION NOTE"), createText("h4", "", investigation.title));
  card.append(header, createText("p", "evidence-explanation", evidence.explanation));

  const sortedRows = [...evidence.rows];
  if (action === "rates" || action === "outliers") {
    sortedRows.sort((a, b) => (b.rate || 0) - (a.rate || 0));
  }

  const table = document.createElement("table");
  table.className = "evidence-table";
  const heading = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const columns = action === "counts" ? [["group", "Route"], ["events", "Events"]]
    : action === "exposure" ? [["group", "Route"], ["opportunities", "Journeys"]]
    : action === "outliers" ? [["group", "Route"], ["rate", "Rate"], ["status", "Anomaly Assessment"]]
    : [["group", "Route"], ["events", "Events"], ["opportunities", "Journeys"], ["rate", "Rate"]];

  columns.forEach(([, label]) => headerRow.append(createText("th", "", label)));
  heading.append(headerRow);
  table.append(heading);

  const maxRate = Math.max(...sortedRows.map((r) => r.rate || 0), 0.001);
  const body = document.createElement("tbody");
  sortedRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.dataset.group = row.group;
    tr.addEventListener("mouseenter", () => highlightRoute(row.group, true));
    tr.addEventListener("mouseleave", () => highlightRoute(row.group, false));
    if (row.is_outlier) tr.className = "anomaly-row";
    columns.forEach(([key]) => {
      const cell = document.createElement("td");
      if (key === "rate") {
        const pct = ((row.rate || 0) * 100).toFixed(1);
        const barWidth = Math.min(100, Math.round(((row.rate || 0) / maxRate) * 100));
        cell.innerHTML = `<div class="rate-cell"><div class="rate-bar-track"><div class="rate-bar-fill" style="width:${barWidth}%"></div></div><span class="rate-val">${pct}%</span></div>`;
      } else if (key === "status") {
        if (row.is_outlier) {
          cell.innerHTML = `<span class="anomaly-badge">ANOMALY</span> ${row.status}`;
        } else {
          cell.textContent = row.status;
        }
      } else {
        cell.textContent = row[key];
      }
      tr.append(cell);
    });
    body.append(tr);
  });
  table.append(body);
  card.append(table);

  if (action === "rates") {
    const equalizedExposure = evidence.equalized_exposure || Math.max(...evidence.rows.map((r) => r.opportunities || 0), 100);
    const whatIf = document.createElement("div");
    whatIf.className = "whatif-panel";
    whatIf.innerHTML = `
      <div class="whatif-header">
        <div class="whatif-badge"><span class="whatif-glyph">✦</span> WHAT-IF SIMULATOR</div>
        <h4>Equalized Exposure Projection</h4>
        <p class="whatif-sub">Why rate beats raw volume: what happens if every sector carried equal traffic (${equalizedExposure} journeys)?</p>
      </div>
      <div class="whatif-controls">
        <label class="whatif-label">
          <span>Simulated Exposure:</span>
          <strong class="whatif-slider-val">${equalizedExposure}</strong> <small>journeys</small>
        </label>
        <input type="range" min="${Math.max(10, Math.round(equalizedExposure * 0.2))}" max="${Math.round(equalizedExposure * 2.5)}" value="${equalizedExposure}" class="whatif-range">
      </div>
      <div class="whatif-bars"></div>
    `;

    const slider = whatIf.querySelector(".whatif-range");
    const sliderVal = whatIf.querySelector(".whatif-slider-val");
    const barsContainer = whatIf.querySelector(".whatif-bars");

    function updateWhatIfBars(exposure) {
      barsContainer.replaceChildren();
      const simRows = [...evidence.rows].sort((a, b) => (b.rate || 0) - (a.rate || 0));
      const maxSimEvents = Math.max(...simRows.map((r) => Math.round((r.rate || 0) * exposure)), 1);

      simRows.forEach((row) => {
        const proj = Math.round((row.rate || 0) * exposure);
        const item = document.createElement("div");
        item.className = `whatif-row ${row.is_outlier ? "is-anomaly" : ""}`;
        item.dataset.group = row.group;
        item.addEventListener("mouseenter", () => highlightRoute(row.group, true));
        item.addEventListener("mouseleave", () => highlightRoute(row.group, false));

        const barPct = Math.min(100, Math.round((proj / maxSimEvents) * 100));
        item.innerHTML = `
          <div class="whatif-row-meta">
            <span class="whatif-group">${row.group}</span>
            <span class="whatif-rate">${((row.rate || 0) * 100).toFixed(1)}%</span>
            <span class="whatif-actual">(${row.events} in ${row.opportunities})</span>
          </div>
          <div class="whatif-row-bar-box">
            <div class="whatif-bar-track">
              <div class="whatif-bar-fill ${row.is_outlier ? "bar-spike" : ""}" style="width: ${barPct}%"></div>
            </div>
            <strong class="whatif-proj-val">${proj} projected</strong>
          </div>
        `;
        barsContainer.append(item);
      });
    }

    slider.addEventListener("input", (e) => {
      const val = Number(e.target.value);
      sliderVal.textContent = val;
      updateWhatIfBars(val);
    });

    updateWhatIfBars(equalizedExposure);
    card.append(whatIf);

    if (evidence.stratified) {
      const strat = evidence.stratified;
      const stratPanel = document.createElement("div");
      stratPanel.className = "stratified-panel";
      let alertHtml = "";
      if (strat.is_simpsons_paradox) {
        alertHtml = `
          <div class="simpsons-alert">
            <span class="simpsons-tag">⚠️ TRUE SIMPSON'S PARADOX UNCOVERED</span>
            <p>Controlling for <strong>${strat.confounder_col}</strong> reverses the risk hierarchy! While <strong>${strat.higher_overall}</strong> has the higher aggregate casualty rate, <strong>${strat.higher_in_strata}</strong> has a higher casualty rate in EVERY individual stratum. Naive aggregation concealed the true hazard.</p>
          </div>
        `;
      }
      stratPanel.innerHTML = `
        <div class="whatif-header">
          <div class="whatif-badge"><span class="whatif-glyph">∿</span> STRATIFIED SUBGROUP ANALYSIS</div>
          <h4>Lurking Confounder: ${strat.confounder_col.toUpperCase()}</h4>
          <p class="whatif-sub">Evaluating risk within each environmental condition to test for confounding bias:</p>
        </div>
        ${alertHtml}
        <table class="stratified-table">
          <thead>
            <tr>
              <th>Condition (${strat.confounder_col})</th>
              <th>${strat.records[0]?.group_1 || "Group 1"}</th>
              <th>${strat.records[0]?.group_2 || "Group 2"}</th>
            </tr>
          </thead>
          <tbody>
            ${strat.records.map((r) => `
              <tr>
                <td><strong>${r.stratum}</strong></td>
                <td>${(r.rate_1 * 100).toFixed(1)}% <small>(${r.events_1}/${r.opp_1})</small></td>
                <td>${(r.rate_2 * 100).toFixed(1)}% <small>(${r.events_2}/${r.opp_2})</small></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
      card.append(stratPanel);
    }
  }

  if (state.mode === "apprentice") {
    if (action === "rates") {
      const callout = document.createElement("div");
      callout.className = "apprentice-callout";
      if (state.quest?.ranking_differs || state.caseInfo?.ranking_differs) {
        callout.innerHTML = "<strong>✦ Apprentice Insight:</strong> Notice the contrast! The route with the highest incident volume is not the most hazardous per journey. Rates adjust for traffic exposure.";
      } else {
        callout.innerHTML = "<strong>✦ Apprentice Insight:</strong> In this dataset, the highest volume route also has the highest rate, but rate is still the true test: hazard per journey.";
      }
      card.append(callout);
    } else if (action === "outliers") {
      const callout = document.createElement("div");
      callout.className = "apprentice-callout";
      callout.innerHTML = "<strong>✦ Anomaly Lens:</strong> When a route's incident rate spikes far above the baseline average, it signals an extreme anomaly that requires closer scrutiny.";
      card.append(callout);
    }
  }
}

async function investigate(action, button) {
  clearError();
  button.disabled = true;
  button.classList.add("working");
  try {
    const result = await api("/api/investigate", { case_id: state.caseId, action });
    state.investigated.add(action);
    renderEvidence(action, result.investigation, result.evidence);
    if (result.evidence?.rows) {
      syncAnomaliesToMap(result.evidence.rows);
    }
    const totalCount = state.quest?.investigations?.length || 4;
    $("#investigation-progress").textContent = `${state.investigated.size} / ${totalCount} found`;
    renderInvestigations();
    updateDecisionLock();
    changeStep(state.investigated.size >= 2 ? 3 : 2);
    $("#evidence-board").lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    button.disabled = false;
    button.classList.remove("working");
    showError(error.message);
  }
}

function renderGuideSparks() {
  const label = state.mode === "apprentice" ? "✧ ✧" : "✧";
  $("#guide-sparks").textContent = `${label} · ${state.guideRemaining} left`;
  $("#guide-send").disabled = state.guideRemaining <= 0;
  $("#guide-question").disabled = state.guideRemaining <= 0;
  document.querySelectorAll(".guide-prompts button").forEach((button) => {
    button.disabled = state.guideRemaining <= 0;
  });
  if (state.guideRemaining <= 0) $("#guide-subtitle").textContent = "No sparks remain for this case.";
}

function addGuideMessage(role, text, source = "", latencyMs = null, model = "") {
  const message = createText("div", `guide-message ${role}`, "");
  message.append(createText("span", "message-label", role === "player" ? "YOU" : "FIELD GUIDE"));
  message.append(createText("p", "", text));
  if (source) {
    let sourceLabel = source === "amd-live" ? "AMD MODEL" : "LOCAL PREVIEW";
    if (latencyMs) sourceLabel += ` · ${latencyMs} ms`;
    if (model && model !== "Local Preview") sourceLabel += ` · ${model}`;
    message.append(createText("span", "message-source", sourceLabel));
  }
  $("#guide-messages").append(message);
  message.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderQuest(quest, guideRemaining) {
  state.quest = quest;
  state.chosenGroup = null;
  state.rationale = "risk_density";
  state.investigated.clear();
  state.guideRemaining = guideRemaining;
  $("#empty-state").hidden = true;
  $("#loading-state").hidden = true;
  $("#quest-content").hidden = false;
  $("#quest-setting").textContent = quest.setting;
  $("#quest-title").textContent = quest.title;
  $("#quest-premise").textContent = quest.premise;
  $("#quest-stakes").textContent = quest.stakes;

  const source = $("#quest-source");
  source.textContent = quest.source === "amd-live" ? `✦ AMD HEAD REFEREE · ${quest.mode.toUpperCase()}` : "LOCAL STORY PREVIEW";
  source.className = `source-tag ${quest.source === "amd-live" ? "live" : "preview"}`;

  const telem = $("#quest-telemetry");
  if (telem) {
    if (quest.latency_ms) {
      telem.textContent = `⚡ ${quest.latency_ms} ms · ${quest.model || "AMD"}`;
      telem.hidden = false;
    } else {
      telem.hidden = true;
    }
  }

  const repairBadge = $("#quest-repair-badge");
  if (repairBadge) {
    if (quest.repaired) {
      repairBadge.textContent = `⚡ Self-Repaired (${quest.attempts} attempts)`;
      repairBadge.className = "telemetry-pill repair-badge repaired";
      repairBadge.hidden = false;
    } else if (quest.attempts) {
      repairBadge.textContent = "✓ Verified 1st pass";
      repairBadge.className = "telemetry-pill repair-badge";
      repairBadge.hidden = false;
    } else {
      repairBadge.hidden = true;
    }
  }

  const costReceipt = $("#quest-cost-receipt");
  if (costReceipt) {
    if (quest.cost) {
      costReceipt.textContent = `~${quest.tokens?.total || 0} tokens · $${quest.cost.amd_compute_usd.toFixed(5)} AMD`;
      costReceipt.hidden = false;
    } else {
      costReceipt.hidden = true;
    }
  }

  const metricCost = $("#metric-cost");
  if (metricCost && quest.cost) {
    metricCost.textContent = `$${quest.cost.amd_compute_usd.toFixed(5)}`;
  }

  $("#map-title").textContent = quest.setting.toUpperCase().slice(0, 35);
  $("#map-caption-left").textContent = quest.title.toUpperCase().slice(0, 34);
  renderCharacters(quest.characters);
  renderInvestigations();
  $("#investigation-progress").textContent = `0 / ${quest.investigations.length} found`;
  $("#decision-question").textContent = quest.challenge;
  $("#decision-hint").textContent = state.mode === "apprentice"
    ? "Compare at least two records, then choose the route and the measure that answers the council's question."
    : "Find two records before committing to a route and the measure that supports your finding.";
  const options = $("#answer-options");
  options.replaceChildren();
  state.caseInfo.groups.forEach((group) => {
    const button = createText("button", "answer-option", group);
    button.type = "button";
    button.dataset.group = group;
    button.addEventListener("mouseenter", () => highlightRoute(group, true));
    button.addEventListener("mouseleave", () => highlightRoute(group, false));
    button.addEventListener("click", () => {
      state.chosenGroup = group;
      options.querySelectorAll("button").forEach((choice) => choice.classList.toggle("selected", choice === button));
      $("#submit-answer").disabled = !state.chosenGroup || state.investigated.size < 2;
      highlightRoute(group, true);
    });
    options.append(button);
  });

  document.querySelectorAll(".rationale-choice").forEach((button) => {
    button.classList.toggle("selected", button.dataset.rationale === "risk_density");
    button.onclick = () => {
      state.rationale = button.dataset.rationale;
      document.querySelectorAll(".rationale-choice").forEach((choice) => choice.classList.toggle("selected", choice === button));
    };
  });

  $("#submit-answer").disabled = true;
  $("#answer-result").hidden = true;
  const consequenceBox = $("#consequence-box"); if (consequenceBox) consequenceBox.hidden = true;
  const computeReceipt = $("#compute-receipt"); if (computeReceipt) computeReceipt.hidden = true;
  $("#ending").hidden = true;
  $("#transfer-card").hidden = true;
  $("#evidence-board").replaceChildren();
  $("#guide-messages").replaceChildren();
  addGuideMessage("guide", "I can help with the method, not the answer. What have the records shown you so far?");
  renderGuideSparks();
  updateDecisionLock();
  changeStep(2);
  $("#quest-content").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function updateDecisionLock() {
  const unlocked = state.investigated.size >= 2;
  $("#decision").classList.toggle("locked", !unlocked);
  $("#decision-hint").textContent = unlocked
    ? "You have enough records to make a case. Choose the route and rationale that best support your answer."
    : `Investigate ${2 - state.investigated.size} more ${2 - state.investigated.size === 1 ? "record" : "records"} to unlock your verdict.`;
  $("#submit-answer").disabled = !unlocked || !state.chosenGroup;
}

async function startQuest() {
  clearError();
  if (!state.caseId) return;
  $("#empty-state").hidden = true;
  $("#quest-content").hidden = true;
  $("#loading-state").hidden = false;
  $("#begin-button").disabled = true;
  try {
    const result = await api("/api/quest", { case_id: state.caseId, mode: state.mode });
    renderQuest(result.quest, result.guide_remaining);
  } catch (error) {
    $("#loading-state").hidden = true;
    $("#empty-state").hidden = false;
    showError(error.message);
  } finally {
    $("#begin-button").disabled = !state.caseId;
  }
}

async function askGuide(question) {
  const trimmed = question.trim();
  if (!trimmed || state.guideRemaining <= 0) return;
  clearError();
  $("#guide-question").value = "";
  addGuideMessage("player", trimmed);
  $("#guide-send").disabled = true;
  try {
    const result = await api("/api/guide", { case_id: state.caseId, question: trimmed });
    state.guideRemaining = result.remaining;
    addGuideMessage("guide", result.reply, result.source, result.latency_ms, result.model);
    renderGuideSparks();
  } catch (error) {
    addGuideMessage("guide", error.message);
  } finally {
    renderGuideSparks();
  }
}


async function submitAnswer() {
  if (!state.chosenGroup || state.investigated.size < 2) return;
  const button = $("#submit-answer");
  button.disabled = true;
  clearError();
  try {
    const result = await api("/api/answer", {
      case_id: state.caseId,
      group: state.chosenGroup,
      rationale: state.rationale,
    });
    const box = $("#answer-result");
    box.textContent = result.feedback;
    box.hidden = false;
    box.classList.toggle("incorrect", !result.correct);

    const consequenceBox = $("#consequence-box");
    if (result.consequence) {
      $("#consequence-text").textContent = result.consequence;
      consequenceBox.hidden = false;
    } else if (consequenceBox) {
      consequenceBox.hidden = true;
    }

    const ending = $("#ending");
    ending.textContent = result.ending;
    ending.hidden = false;

    const receiptBox = $("#compute-receipt");
    if (receiptBox && state.quest?.cost) {
      receiptBox.innerHTML = `<span>⚡ Verified Pipeline Receipt</span><span>${state.quest.tokens?.total || 0} tokens · $${state.quest.cost.amd_compute_usd.toFixed(5)} AMD GPU compute</span>`;
      receiptBox.hidden = false;
    }

    changeStep(3);
    if (result.correct) $("#transfer-card").hidden = false;
    else button.disabled = false;
  } catch (error) {
    showError(error.message);
    button.disabled = false;
  }
}

$("#begin-button").addEventListener("click", startQuest);
$("#submit-answer").addEventListener("click", submitAnswer);
$("#guide-form").addEventListener("submit", (event) => {
  event.preventDefault();
  askGuide($("#guide-question").value);
});
$("#guide-question").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("#guide-form").requestSubmit();
  }
});
document.querySelectorAll(".guide-prompts button").forEach((button) => {
  button.addEventListener("click", () => askGuide(button.dataset.question));
});
$("#csv-upload").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 100_000) return showError("Choose a CSV under 100 KB.");
  $("#dataset-select").value = "";
  await loadCsv(await file.text());
});
$("#change-data").addEventListener("click", () => {
  $("#dataset-select").focus();
  $("#dataset-select").scrollIntoView({ behavior: "smooth", block: "center" });
});
$("#next-case").addEventListener("click", () => {
  const current = $("#dataset-select").value;
  const currentIndex = state.samples.findIndex((sample) => sample.id === current);
  const nextIndex = (currentIndex + 1) % state.samples.length;
  const next = state.samples[nextIndex];
  if (next) {
    $("#dataset-select").value = next.id;
    loadCsv(next.csv);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    $("#dataset-select").value = "";
    $("#dataset-select").focus();
  }
});
document.querySelectorAll(".mode-option").forEach((button) => button.addEventListener("click", () => {
  if (state.mode === button.dataset.mode) return;
  state.mode = button.dataset.mode;
  document.querySelectorAll(".mode-option").forEach((item) => item.classList.toggle("selected", item === button));
  if (state.quest) startQuest();
}));

loadSamples();

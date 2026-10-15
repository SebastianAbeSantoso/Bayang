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

state.currentRawCsv = null;

async function openSchemaModal(csv) {
  try {
    const inspection = await api("/api/inspect_headers", { csv });
    const { fieldnames, suggested, preview_rows } = inspection;

    const populateSelect = (selectId, includeEmpty = false, emptyLabel = "") => {
      const select = $(selectId);
      select.replaceChildren();
      if (includeEmpty) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = emptyLabel;
        select.append(opt);
      }
      fieldnames.forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.append(opt);
      });
      return select;
    };

    const gSel = populateSelect("#map-group-select");
    gSel.value = suggested.group || fieldnames[0] || "";

    const eSel = populateSelect("#map-events-select");
    eSel.value = suggested.events || fieldnames[1] || "";

    const oSel = populateSelect("#map-opp-select", true, "Count rows as Exposure (Raw Event Log)");
    oSel.querySelector('option[value=""]').value = "__RAW_LOG__";
    oSel.value = suggested.opportunities || (suggested.is_raw_log ? "__RAW_LOG__" : (fieldnames[2] || ""));

    const cSel = populateSelect("#map-confounder-select", true, "None (Unstratified Analysis)");
    cSel.value = suggested.confounder || "";

    // Render Preview Table
    const table = $("#modal-preview-table");
    table.replaceChildren();
    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    fieldnames.forEach((fn) => trHead.append(createText("th", "", fn)));
    thead.append(trHead);
    table.append(thead);

    const tbody = document.createElement("tbody");
    preview_rows.forEach((row) => {
      const tr = document.createElement("tr");
      fieldnames.forEach((fn) => tr.append(createText("td", "", row[fn] || "")));
      tbody.append(tr);
    });
    table.append(tbody);

    const modal = $("#schema-modal");
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  } catch (err) {
    showError(`Could not inspect CSV headers: ${err.message}`);
  }
}

function closeSchemaModal() {
  const modal = $("#schema-modal");
  if (typeof modal.close === "function") {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }
}

async function loadCsv(csv, custom_mapping = null) {
  clearError(); $("#begin-button").disabled = true;
  state.currentRawCsv = csv;
  state.caseId = null; state.caseInfo = null; renderCaseSummary();
  resetQuestView();
  try {
    const payload = { csv };
    if (custom_mapping) payload.custom_mapping = custom_mapping;
    const result = await api("/api/profile", payload);
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
  const text = await file.text();
  state.currentRawCsv = text;
  try {
    const insp = await api("/api/inspect_headers", { csv: text });
    if (insp.fieldnames.length > 3 || insp.suggested.is_raw_log || insp.suggested.confounder) {
      openSchemaModal(text);
      return;
    }
  } catch (e) {
    // fallback to normal loader
  }
  await loadCsv(text);
});

$("#configure-schema-btn")?.addEventListener("click", () => {
  if (state.currentRawCsv) openSchemaModal(state.currentRawCsv);
});
$("#modal-close")?.addEventListener("click", closeSchemaModal);
$("#modal-cancel-btn")?.addEventListener("click", closeSchemaModal);
$("#modal-apply-btn")?.addEventListener("click", () => {
  const group = $("#map-group-select").value;
  const events = $("#map-events-select").value;
  const opp = $("#map-opp-select").value;
  const confounder = $("#map-confounder-select").value || null;
  const is_raw_log = opp === "__RAW_LOG__";
  closeSchemaModal();
  loadCsv(state.currentRawCsv, {
    group,
    events,
    opportunities: is_raw_log ? null : opp,
    confounder,
    is_raw_log,
  });
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

/* =========================================================================
   THE WORLD'S A STAGE: REVERSE: 1999 STAGE DIRECTOR CONTROLLER
   ========================================================================= */

const stageState = {
  data: null,
  selectedVerb: "block_route",
  tension: 2.0,
  isProcessing: false,
};

const STAGE_NODE_COORDS = {
  1: { x: 80, y: 170, label: "1. Station Platform", sub: "Lit · Safe Gathering" },
  2: { x: 260, y: 80, label: "2. The Trestle Bridge", sub: "Fast · 150kg Rotted Timber" },
  3: { x: 260, y: 260, label: "3. The Valley Bypass", sub: "Rugged Scree · Fatigue" },
  4: { x: 440, y: 170, label: "4. The Signal Tower", sub: "Padlocked Gate Barrier" },
  5: { x: 620, y: 80, label: "5. Smuggler's Cut", sub: "Dark · Ambush Hazard" },
  6: { x: 620, y: 260, label: "6. Pilgrim's Stair", sub: "Lit · Moral Trial" },
  7: { x: 770, y: 170, label: "7. The Iron Terminal", sub: "Goal · Departure" },
};

const CHAR_CONFIG = {
  "Julian": { code: "J", color: "#4a6778", class: "julian", name: "Julian" },
  "Vesper": { code: "V", color: "#9e6a2b", class: "vesper", name: "Vesper" },
  "Beatrice": { code: "B", color: "#7e4334", class: "beatrice", name: "Beatrice" },
  "The Curator": { code: "C", color: "#544163", class: "curator", name: "The Curator" },
};

// Mode Switcher between Stage Director and Living Ledger
const tabStage = $("#mode-tab-stage");
const tabLedger = $("#mode-tab-ledger");
const viewStage = $("#stage-experience");
const viewLedger = $("#ledger-experience");

if (tabStage && tabLedger) {
  tabStage.addEventListener("click", () => {
    tabStage.classList.add("active");
    tabStage.setAttribute("aria-selected", "true");
    tabLedger.classList.remove("active");
    tabLedger.setAttribute("aria-selected", "false");
    viewStage.hidden = false;
    viewLedger.hidden = true;
    renderStageBoard();
  });

  tabLedger.addEventListener("click", () => {
    tabLedger.classList.add("active");
    tabLedger.setAttribute("aria-selected", "true");
    tabStage.classList.remove("active");
    tabStage.setAttribute("aria-selected", "false");
    viewStage.hidden = true;
    viewLedger.hidden = false;
  });
}

async function initStageEngine() {
  try {
    const data = await api("/api/stage/init");
    stageState.data = data;
    renderStageBoard();
    renderCastCards();
    updateDirectorDeckUI();
  } catch (err) {
    console.error("Failed to initialize stage engine:", err);
  }
}

function renderStageBoard() {
  const svg = $("#stage-svg");
  if (!svg || !stageState.data) return;

  svg.innerHTML = `
    <defs>
      <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <radialGradient id="spotlight-beam" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fff8e6" stop-opacity="0.8" />
        <stop offset="40%" stop-color="#f6dfb2" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#e8cf99" stop-opacity="0" />
      </radialGradient>
    </defs>
  `;

  const edges = stageState.data.edges || [];
  const blocked = stageState.data.blocked_edges || [];
  const spotlights = stageState.data.spotlighted_nodes || [];
  const fogNode = stageState.data.fog_node || 0;

  // 1. Draw Edges
  edges.forEach(([u, v]) => {
    const fromCoord = STAGE_NODE_COORDS[u];
    const toCoord = STAGE_NODE_COORDS[v];
    if (!fromCoord || !toCoord) return;

    const isBlocked = blocked.some(([bu, bv]) => (bu === u && bv === v) || (bu === v && bv === u));
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", fromCoord.x);
    line.setAttribute("y1", fromCoord.y);
    line.setAttribute("x2", toCoord.x);
    line.setAttribute("y2", toCoord.y);
    line.setAttribute("class", isBlocked ? "stage-track track-blocked" : "stage-track track-active");
    svg.appendChild(line);

    if (isBlocked) {
      const midX = (fromCoord.x + toCoord.x) / 2;
      const midY = (fromCoord.y + toCoord.y) / 2;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", midX - 44);
      rect.setAttribute("y", midY - 10);
      rect.setAttribute("width", 88);
      rect.setAttribute("height", 20);
      rect.setAttribute("class", "curtain-banner");

      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", midX);
      txt.setAttribute("y", midY + 4);
      txt.setAttribute("class", "curtain-text");
      txt.textContent = "DROPPED CURTAIN";

      g.appendChild(rect);
      g.appendChild(txt);
      svg.appendChild(g);
    }
  });

  // 2. Draw Nodes
  Object.entries(STAGE_NODE_COORDS).forEach(([nodeIdStr, coord]) => {
    const nid = Number(nodeIdStr);
    const nodeData = stageState.data.nodes[nid];
    const isSpotlight = spotlights.includes(nid);
    const isFogged = nid <= fogNode;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${coord.x}, ${coord.y})`);

    // Spotlight beam
    if (isSpotlight) {
      const beam = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      beam.setAttribute("r", "44");
      beam.setAttribute("fill", "url(#spotlight-beam)");
      beam.setAttribute("filter", "url(#glow-gold)");
      g.appendChild(beam);
    }

    // Node Circle
    let circleClass = "node-circle";
    if (isFogged) circleClass += " node-fog";
    else if (isSpotlight) circleClass += " node-lit";
    else if (nodeData.light_level === "Dark") circleClass += " node-dark";
    else circleClass += " node-dim";

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "28");
    circle.setAttribute("class", circleClass);
    g.appendChild(circle);

    // Node Label
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("y", "-34");
    label.setAttribute("class", "node-label");
    label.textContent = coord.label;
    g.appendChild(label);

    const sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    sub.setAttribute("y", "44");
    sub.setAttribute("class", isFogged ? "node-hazard" : "node-subtext");
    sub.textContent = isFogged ? "[WAILING FOG ENGULFED]" : coord.sub;
    g.appendChild(sub);

    svg.appendChild(g);
  });

  // 3. Draw Character Tokens
  const charTokensByNode = {};
  Object.values(stageState.data.characters).forEach((char) => {
    if (!char.is_alive) return;
    charTokensByNode[char.node] = charTokensByNode[char.node] || [];
    charTokensByNode[char.node].push(char);
  });

  Object.entries(charTokensByNode).forEach(([nidStr, charList]) => {
    const nid = Number(nidStr);
    const coord = STAGE_NODE_COORDS[nid];
    if (!coord) return;

    const count = charList.length;
    charList.forEach((char, idx) => {
      const cfg = CHAR_CONFIG[char.id] || { code: "?", color: "#333", class: "julian" };
      // Distribute tokens horizontally within the node circle
      const offset = (idx - (count - 1) / 2) * 16;
      const tg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      tg.setAttribute("class", "char-token");
      tg.setAttribute("transform", `translate(${coord.x + offset}, ${coord.y})`);

      const tc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      tc.setAttribute("r", "10");
      tc.setAttribute("class", `token-circle ${cfg.class}`);

      const tt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tt.setAttribute("class", "token-text");
      tt.textContent = cfg.code;

      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${char.name} (HP: ${char.hp}, Stress: ${char.stress}, Weight: ${char.total_weight_kg}kg)`;

      tg.appendChild(tc);
      tg.appendChild(tt);
      tg.appendChild(title);
      svg.appendChild(tg);
    });
  });

  // 4. Update Header Stats
  const daVal = $("#director-da-val");
  if (daVal) daVal.textContent = stageState.data.director_authority;

  const sceneVal = $("#scene-counter-val");
  if (sceneVal) sceneVal.textContent = `Scene ${stageState.data.scene_number} / ${stageState.data.max_scenes}`;

  const actVal = $("#act-name-val");
  if (actVal) {
    const actNames = ["Act I: Gathering", "Act II: The Crossing", "Act III: The Threshold", "Act IV: The Ascent", "Act V: The Departure"];
    const curAct = actNames[Math.min(actNames.length - 1, stageState.data.scene_number - 1)];
    actVal.textContent = curAct;
  }
}

function renderCastCards() {
  const container = $("#cast-cards-grid");
  if (!container || !stageState.data) return;

  container.innerHTML = "";
  Object.values(stageState.data.characters).forEach((c) => {
    const cfg = CHAR_CONFIG[c.id] || { code: "A", class: "julian" };
    const card = document.createElement("div");
    card.className = `cast-card ${c.is_alive ? "" : "fallen"}`;

    const hpPct = Math.max(0, Math.min(100, Math.round((c.hp / c.max_hp) * 100)));
    const stressPct = Math.max(0, Math.min(100, c.stress));
    const fatiguePct = Math.max(0, Math.min(100, c.fatigue));

    card.innerHTML = `
      <div class="cast-card-head">
        <div class="cast-portrait ${cfg.class}">${cfg.code}</div>
        <div class="cast-meta">
          <strong>${c.name}</strong>
          <small>${c.role} · Node ${c.node} (${c.node_name})</small>
        </div>
      </div>
      <div class="cast-vital-bars">
        <div class="vital-row">
          <span>HP</span>
          <div class="vital-track"><div class="vital-bar hp" style="width: ${hpPct}%"></div></div>
          <span>${c.hp}/${c.max_hp}</span>
        </div>
        <div class="vital-row">
          <span>Stress</span>
          <div class="vital-track"><div class="vital-bar stress" style="width: ${stressPct}%"></div></div>
          <span>${c.stress}%</span>
        </div>
        <div class="vital-row">
          <span>Fatigue</span>
          <div class="vital-track"><div class="vital-bar fatigue" style="width: ${fatiguePct}%"></div></div>
          <span>${c.fatigue}%</span>
        </div>
      </div>
      <div class="cast-burden">
        <span>Load Weight: <strong>${c.total_weight_kg} kg</strong></span>
        ${c.id === "Vesper" && c.total_weight_kg > 100 ? `<span style="color:#9e6a32;margin-left:6px">(Heavy Contraband Payload!)</span>` : ""}
      </div>
      <p class="cast-flaw">"${c.flaw}"</p>
    `;
    container.appendChild(card);
  });
}

function updateDirectorDeckUI() {
  const verb = stageState.selectedVerb;
  const label = $("#verb-param-label");
  const select = $("#verb-param-select");
  const rumorWrap = $("#rumor-text-wrap");
  if (!label || !select || !rumorWrap) return;

  rumorWrap.hidden = true;
  select.hidden = false;

  if (verb === "block_route") {
    label.textContent = "ROUTE TO BLOCK (DROP CURTAIN)";
    select.innerHTML = `
      <option value="1,2">Node 1 &rarr; Node 2 (The Trestle Bridge · Rotted 150kg)</option>
      <option value="1,3">Node 1 &rarr; Node 3 (The Valley Bypass · Rugged Scree)</option>
      <option value="4,5">Node 4 &rarr; Node 5 (Smuggler's Cut · Ambush Trap)</option>
      <option value="4,6">Node 4 &rarr; Node 6 (Pilgrim's Stair · Moral Trial)</option>
    `;
  } else if (verb === "shift_spotlight") {
    label.textContent = "NODE TO ILLUMINATE (SPOTLIGHT)";
    select.innerHTML = `
      <option value="2">Node 2: The Trestle Bridge (Reveal Rot / Avert Plunge)</option>
      <option value="3">Node 3: The Valley Bypass (Reveal Safe Footholds)</option>
      <option value="4">Node 4: The Signal Tower (Inspect Padlocked Gate)</option>
      <option value="5">Node 5: Smuggler's Cut (Pierce Pitch-Black Ambush)</option>
    `;
  } else if (verb === "plant_rumor") {
    label.textContent = "WHISPER PROMPT CUE TO ACTOR";
    select.innerHTML = `
      <option value="Vesper">Vesper Cross (The Smuggler)</option>
      <option value="Julian">Julian Vance (The Archivist)</option>
      <option value="Beatrice">Beatrice Thorne (The Machinist)</option>
      <option value="The Curator">The Curator (The Infiltrator)</option>
    `;
    rumorWrap.hidden = false;
  } else if (verb === "cue_prop") {
    label.textContent = "STAGE ITEM PLACEMENT";
    select.innerHTML = `
      <option value="4,Cold Iron Crowbar">Node 4: Cold Iron Crowbar (Pry Gate Lock)</option>
      <option value="3,Restorative Tonic">Node 3: Restorative Tonic (Soothe Fatigue)</option>
      <option value="2,Safety Harness">Node 2: Safety Harness (Bridge Reinforcement)</option>
    `;
  }
}

// Event Listeners for Director Console
document.querySelectorAll(".verb-choice").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".verb-choice").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    stageState.selectedVerb = btn.dataset.verb;
    updateDirectorDeckUI();
  });
});

const tensionSlider = $("#tension-dial-range");
if (tensionSlider) {
  tensionSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    stageState.tension = val;
    const readout = $("#tension-readout");
    if (readout) {
      let desc = "Andante";
      if (val <= 1.5) desc = "Adagio (Calm & Meticulous)";
      else if (val <= 2.5) desc = "Moderato";
      else if (val <= 3.5) desc = "Allegro (Tense)";
      else desc = "Presto (Frantic & Rushed)";
      readout.textContent = `${val.toFixed(1)} · ${desc}`;
    }
  });

  tensionSlider.addEventListener("change", async (e) => {
    const val = parseFloat(e.target.value);
    try {
      await api("/api/stage/director_action", { verb: "adjust_tension", target: val });
    } catch (err) {
      console.error(err);
    }
  });
}

const applyVerbBtn = $("#apply-verb-btn");
if (applyVerbBtn) {
  applyVerbBtn.addEventListener("click", async () => {
    const verb = stageState.selectedVerb;
    let target = null;
    const select = $("#verb-param-select");
    const statusMsg = $("#verb-status-msg");

    if (verb === "block_route") {
      target = select.value.split(",").map(Number);
    } else if (verb === "shift_spotlight") {
      target = Number(select.value);
    } else if (verb === "plant_rumor") {
      const char = select.value;
      const text = $("#rumor-text-input").value.trim() || "The path ahead is rigged.";
      target = { character: char, rumor: text };
    } else if (verb === "cue_prop") {
      const [nid, prop] = select.value.split(",");
      target = { node: Number(nid), prop: prop.trim() };
    }

    try {
      const res = await api("/api/stage/director_action", { verb, target });
      stageState.data = res.stage_state;
      renderStageBoard();
      renderCastCards();
      if (statusMsg) {
        statusMsg.textContent = res.message;
        statusMsg.hidden = false;
        setTimeout(() => { statusMsg.hidden = true; }, 4000);
      }
    } catch (err) {
      if (statusMsg) {
        statusMsg.textContent = err.message;
        statusMsg.hidden = false;
      }
    }
  });
}

const stageTurnBtn = $("#stage-turn-btn");
if (stageTurnBtn) {
  stageTurnBtn.addEventListener("click", async () => {
    if (stageState.isProcessing) return;
    stageState.isProcessing = true;
    stageTurnBtn.disabled = true;
    stageTurnBtn.innerHTML = `<span>Gemma 2 staging Scene on AMD MI300X...</span>`;

    const summary = `Director applied ${stageState.selectedVerb} with tension ${stageState.tension.toFixed(1)}`;

    try {
      const res = await api("/api/stage/turn", { director_action_summary: summary });
      stageState.data = res.stage_state;
      renderStageBoard();
      renderCastCards();

      // Render Script Title and Narration
      const titleEl = $("#script-scene-title");
      if (titleEl && res.script.scene_title) titleEl.textContent = res.script.scene_title;

      const tagEl = $("#script-scene-tag");
      if (tagEl) tagEl.textContent = `SCENE ${res.stage_state.scene_number - 1}`;

      const narrEl = $("#script-narration-text");
      if (narrEl && res.script.narration) narrEl.textContent = res.script.narration;

      // Render Dialogue Stream
      const stream = $("#stage-dialogue-stream");
      if (stream && res.script.dialogue) {
        stream.innerHTML = "";
        res.script.dialogue.forEach((d) => {
          const cfg = CHAR_CONFIG[d.speaker] || { class: "julian", code: "?" };
          const card = document.createElement("div");
          card.className = "dialogue-card";
          card.innerHTML = `
            <div class="dialogue-avatar ${cfg.class}">${cfg.code}</div>
            <div class="dialogue-content">
              <strong>${d.speaker}</strong>
              <p>"${d.line}"</p>
            </div>
          `;
          stream.appendChild(card);
        });
      }

      // Render Hazard & Physics Events
      const hazardsStream = $("#stage-hazards-stream");
      if (hazardsStream && res.turn_resolution.hazard_events) {
        res.turn_resolution.hazard_events.forEach((ev) => {
          const entry = document.createElement("div");
          entry.className = "hazard-entry";
          entry.textContent = ev;
          hazardsStream.prepend(entry);
        });
      }

      // Handle Verifier Banner
      const verifierAlert = $("#stage-verifier-alert");
      if (verifierAlert) {
        if (res.repairs && res.repairs.length > 0) {
          const rep = res.repairs[0];
          $("#verifier-rule-label").textContent = `VERIFIER INTERCEPTION: ${rep.rule}`;
          $("#verifier-rule-desc").textContent = `${rep.issue} -> ${rep.action}`;
          verifierAlert.hidden = false;
        } else {
          verifierAlert.hidden = true;
        }
      }

      // Handle Telemetry Pill
      const costPill = $("#stage-cost-pill");
      if (costPill && res.telemetry) {
        costPill.textContent = `${res.telemetry.total_tokens} tokens · $${res.telemetry.amd_cost_usd.toFixed(6)} AMD (${res.telemetry.savings_pct}% savings)`;
      }

      // Check Game Status
      if (res.stage_state.status === "won") {
        alert("VICTORY: The Midnight Express has departed! The living cast crossed safely into sovereign territory.");
      } else if (res.stage_state.status === "lost") {
        alert("TRAGEDY: The Wailing Fog claimed the stage. The troupe has fallen.");
      }

    } catch (err) {
      console.error(err);
      alert("Turn failed: " + err.message);
    } finally {
      stageState.isProcessing = false;
      stageTurnBtn.disabled = false;
      stageTurnBtn.innerHTML = `<span>Raise Curtain on Scene</span><span>&rarr;</span>`;
    }
  });
}

const stageResetBtn = $("#stage-reset-btn");
if (stageResetBtn) {
  stageResetBtn.addEventListener("click", () => {
    initStageEngine();
  });
}

// Initialize on load
initStageEngine();

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
  const answerRes = $("#answer-result"); if (answerRes) answerRes.hidden = true;
  const endingEl = $("#ending"); if (endingEl) endingEl.hidden = true;
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
      const submitBtn = $("#answer-button") || $("#submit-answer");
      if (submitBtn) submitBtn.disabled = !state.chosenGroup || state.investigated.size < 2;
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

  const submitBtn = $("#answer-button") || $("#submit-answer");
  if (submitBtn) submitBtn.disabled = true;
  const ansRes = $("#answer-result"); if (ansRes) ansRes.hidden = true;
  const consequenceBox = $("#consequence-box"); if (consequenceBox) consequenceBox.hidden = true;
  const computeReceipt = $("#compute-receipt"); if (computeReceipt) computeReceipt.hidden = true;
  const endBox = $("#ending"); if (endBox) endBox.hidden = true;
  const transferCard = $("#transfer-card"); if (transferCard) transferCard.hidden = true;
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
  const dec = $("#decision");
  if (dec) dec.classList.toggle("locked", !unlocked);
  const decHint = $("#decision-hint");
  if (decHint) {
    decHint.textContent = unlocked
      ? "You have enough records to make a case. Choose the route and rationale that best support your answer."
      : `Investigate ${2 - state.investigated.size} more ${2 - state.investigated.size === 1 ? "record" : "records"} to unlock your verdict.`;
  }
  const submitBtn = $("#answer-button") || $("#submit-answer");
  if (submitBtn) submitBtn.disabled = !unlocked || !state.chosenGroup;
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
  const button = $("#answer-button") || $("#submit-answer");
  if (button) button.disabled = true;
  clearError();
  try {
    const result = await api("/api/answer", {
      case_id: state.caseId,
      group: state.chosenGroup,
      rationale: state.rationale,
    });
    const box = $("#answer-result");
    if (box) {
      box.textContent = result.feedback;
      box.hidden = false;
      box.classList.toggle("incorrect", !result.correct);
    }

    const consequenceBox = $("#consequence-box");
    if (result.consequence) {
      const consequenceText = $("#consequence-text");
      if (consequenceText) consequenceText.textContent = result.consequence;
      if (consequenceBox) consequenceBox.hidden = false;
    } else if (consequenceBox) {
      consequenceBox.hidden = true;
    }

    const ending = $("#ending");
    if (ending) {
      ending.textContent = result.ending || "";
      ending.hidden = false;
    }

    const receiptBox = $("#compute-receipt");
    if (receiptBox && state.quest?.cost) {
      receiptBox.innerHTML = `<span>⚡ Verified Pipeline Receipt</span><span>${state.quest.tokens?.total || 0} tokens · $${state.quest.cost.amd_compute_usd.toFixed(5)} AMD GPU compute</span>`;
      receiptBox.hidden = false;
    }

    changeStep(3);
    if (result.correct) {
      const tc = $("#transfer-card");
      if (tc) tc.hidden = false;
    } else if (button) {
      button.disabled = false;
    }
  } catch (error) {
    showError(error.message);
    if (button) button.disabled = false;
  }
}

const beginBtn = $("#begin-button");
if (beginBtn) beginBtn.addEventListener("click", startQuest);

const ansBtn = $("#answer-button") || $("#submit-answer");
if (ansBtn) ansBtn.addEventListener("click", submitAnswer);

const guideForm = $("#guide-form");
if (guideForm) {
  guideForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const gq = $("#guide-question");
    if (gq) askGuide(gq.value);
  });
}
const gqInput = $("#guide-question");
if (gqInput) {
  gqInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const form = $("#guide-form");
      if (form) form.requestSubmit();
    }
  });
}
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

const changeDataBtn = $("#change-data");
if (changeDataBtn) {
  changeDataBtn.addEventListener("click", () => {
    const ds = $("#dataset-select");
    if (ds) {
      ds.focus();
      ds.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

const nextCaseBtn = $("#next-case-button") || $("#next-case");
if (nextCaseBtn) {
  nextCaseBtn.addEventListener("click", () => {
    const ds = $("#dataset-select");
    const current = ds ? ds.value : "";
    const currentIndex = state.samples.findIndex((sample) => sample.id === current);
    const nextIndex = (currentIndex + 1) % state.samples.length;
    const next = state.samples[nextIndex];
    if (next && ds) {
      ds.value = next.id;
      loadCsv(next.csv);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (ds) {
      ds.value = "";
      ds.focus();
    }
  });
}
document.querySelectorAll(".mode-option").forEach((button) => button.addEventListener("click", () => {
  if (state.mode === button.dataset.mode) return;
  state.mode = button.dataset.mode;
  document.querySelectorAll(".mode-option").forEach((item) => item.classList.toggle("selected", item === button));
  if (state.quest) startQuest();
}));

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadSamples);
} else {
  loadSamples();
}

/* =========================================================================
   THE WORLD'S A STAGE: REVERSE: 1999 STAGE DIRECTOR CONTROLLER
   ========================================================================= */

const DEFAULT_STAGE_DATA = {
  scene_number: 1,
  max_scenes: 6,
  director_authority: 4,
  tension_dial: 2.0,
  fog_node: 0,
  blocked_edges: [],
  spotlighted_nodes: [1],
  edges: [[1, 2], [1, 3], [2, 4], [3, 4], [4, 5], [4, 6], [5, 7], [6, 7]],
  nodes: {
    1: { id: 1, name: "Station Platform", light_level: "Lit" },
    2: { id: 2, name: "The Trestle Bridge", light_level: "Dim" },
    3: { id: 3, name: "The Valley Bypass", light_level: "Dark" },
    4: { id: 4, name: "The Signal Tower", light_level: "Lit" },
    5: { id: 5, name: "Smuggler's Cut", light_level: "Dark" },
    6: { id: 6, name: "Pilgrim's Stair", light_level: "Lit" },
    7: { id: 7, name: "The Iron Terminal", light_level: "Lit" },
  },
  characters: {
    "Julian": { id: "Julian", name: "Julian Vance", role: "The Archivist", node: 1, node_name: "Station Platform", hp: 100, max_hp: 100, stress: 10, fatigue: 5, total_weight_kg: 70, is_alive: true, flaw: "Paralyzed by dark uncertainty." },
    "Vesper": { id: "Vesper", name: "Vesper Cross", role: "The Smuggler", node: 1, node_name: "Station Platform", hp: 100, max_hp: 100, stress: 20, fatigue: 10, total_weight_kg: 175, is_alive: true, flaw: "Takes reckless shortcuts." },
    "Beatrice": { id: "Beatrice", name: "Beatrice Thorne", role: "The Machinist", node: 1, node_name: "Station Platform", hp: 80, max_hp: 80, stress: 15, fatigue: 20, total_weight_kg: 55, is_alive: true, flaw: "Physically frail on rough ground." },
    "The Curator": { id: "The Curator", name: "The Curator", role: "The Cast Infiltrator", node: 1, node_name: "Station Platform", hp: 100, max_hp: 100, stress: 0, fatigue: 0, total_weight_kg: 60, is_alive: true, flaw: "Unpredictable stage direction." },
  },
};

const stageState = {
  data: JSON.parse(JSON.stringify(DEFAULT_STAGE_DATA)),
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

// Mode Switcher between Stage Director and Archival Folio Ledger
const toggleLedgerBtn = $("#toggle-ledger-btn");
const viewStage = $("#stage-experience");
const viewLedger = $("#ledger-experience");

if (toggleLedgerBtn && viewStage && viewLedger) {
  toggleLedgerBtn.addEventListener("click", () => {
    const isShowingLedger = !viewLedger.hidden;
    if (isShowingLedger) {
      viewStage.hidden = false;
      viewLedger.hidden = true;
      toggleLedgerBtn.innerHTML = `<span>⚜ Archival Folio</span>`;
      toggleLedgerBtn.classList.remove("active");
      renderStageBoard();
    } else {
      viewStage.hidden = true;
      viewLedger.hidden = false;
      toggleLedgerBtn.innerHTML = `<span>✦ Return to Stage</span>`;
      toggleLedgerBtn.classList.add("active");
    }
  });
}

async function initStageEngine() {
  renderStageBoard();
  renderCastCards();
  updateDirectorDeckUI();
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
  if (!stageState.data) return;
  renderMacroRibbon();
  renderRoomInfo();
  renderRoomStageSVG();

  // Update Header Stats
  const daVal = $("#director-da-val");
  if (daVal) daVal.textContent = stageState.data.director_authority;

  const sceneVal = $("#scene-counter-val");
  if (sceneVal) sceneVal.textContent = `Scene ${stageState.data.scene_number} / ${stageState.data.max_scenes}`;

  const actVal = $("#act-name-val");
  if (actVal) {
    const curRoom = stageState.data.current_room || {};
    actVal.textContent = curRoom.act || `Act ${stageState.data.scene_number}`;
  }
}

function renderMacroRibbon() {
  const ribbon = $("#stage-route-ribbon");
  if (!ribbon || !stageState.data) return;

  const currentId = stageState.data.current_room_id || 1;
  const fogNode = stageState.data.fog_node || 0;
  const nodes = stageState.data.nodes || {};

  ribbon.innerHTML = "";

  const routeOrder = [1, 2, 3, 4, 5, 6, 7];
  // Simple linear/branch representation for the ribbon
  const ribbonSequence = [1, 2, 4, 5, 7];

  Object.entries(STAGE_NODE_COORDS).forEach(([nidStr, coord], idx) => {
    const nid = Number(nidStr);
    const nodeData = nodes[nid] || { name: coord.label };
    const isActive = nid === currentId;
    const isVisited = nid < currentId;
    const isFogged = nid <= fogNode;

    const nodeEl = document.createElement("div");
    let stateClass = "";
    if (isActive) stateClass = "active";
    else if (isFogged) stateClass = "fogged";
    else if (isVisited) stateClass = "visited";

    nodeEl.className = `ribbon-node ${stateClass}`;
    nodeEl.title = `${nodeData.name} (${nodeData.act || "Act"})`;

    nodeEl.innerHTML = `
      <span class="ribbon-badge">${nid}</span>
      <span class="ribbon-title">${nodeData.name.split(" ")[0]}</span>
    `;

    ribbon.appendChild(nodeEl);

    if (idx < Object.keys(STAGE_NODE_COORDS).length - 1) {
      const arrow = document.createElement("span");
      arrow.className = "ribbon-arrow";
      arrow.innerHTML = "&rarr;";
      ribbon.appendChild(arrow);
    }
  });
}

function renderRoomInfo() {
  const curRoom = stageState.data.current_room || {};
  const actTag = $("#room-act-tag");
  const titleName = $("#room-title-name");
  const descText = $("#room-desc-text");
  const progressPct = $("#room-progress-pct");
  const progressFill = $("#room-progress-fill");
  const consensusHint = $("#room-consensus-status");

  if (actTag) actTag.textContent = (curRoom.act || "ACT I").toUpperCase();
  if (titleName) titleName.textContent = `Room ${stageState.data.current_room_id}: ${curRoom.name || "Station Office"}`;
  if (descText) descText.textContent = curRoom.description || "The cast gathers in this mountain sanctuary.";

  const pct = Math.max(5, Math.min(100, stageState.data.room_progress || 15));
  if (progressPct) progressPct.textContent = `${pct}%`;
  if (progressFill) progressFill.style.width = `${pct}%`;

  if (consensusHint) {
    const consensus = stageState.data.room_consensus;
    if (consensus && consensus.reached) {
      consensusHint.textContent = `Consensus Reached! Party preparing to advance toward Node ${consensus.target_node}.`;
      consensusHint.style.color = "#355642";
      consensusHint.style.fontWeight = "600";
    } else if (consensus && consensus.votes) {
      const votePairs = Object.entries(consensus.votes).filter(([_, v]) => v != null);
      if (votePairs.length > 0) {
        const summary = votePairs.map(([cid, v]) => `${cid}: Node ${v}`).join(", ");
        consensusHint.textContent = `Exit Votes: ${summary}. Awaiting consensus to depart.`;
        consensusHint.style.color = "#854917";
        consensusHint.style.fontWeight = "normal";
      } else {
        consensusHint.textContent = `Cast exploring room fixtures (Turn ${stageState.data.room_turn || 1}).`;
        consensusHint.style.color = "#736c5c";
        consensusHint.style.fontWeight = "normal";
      }
    }
  }
}

function renderRoomStageSVG() {
  const svg = $("#stage-svg");
  if (!svg || !stageState.data) return;

  const curRoom = stageState.data.current_room || {};
  const fixtures = curRoom.fixtures || [];
  const exits = curRoom.exits || [];
  const blocked = stageState.data.blocked_edges || [];
  const currentRoomId = stageState.data.current_room_id || 1;
  const spotlightedFixture = stageState.data.spotlighted_fixture;
  const spotlightedNodes = stageState.data.spotlighted_nodes || [];
  const characters = Object.values(stageState.data.characters || {});

  // Generate Stage Footlights
  const footlights = [60, 140, 220, 300, 380, 460, 540, 620, 700, 780].map((fx) => `
    <circle cx="${fx}" cy="334" r="3.5" class="footlight-lamp" />
    <polygon points="${fx - 14},334 ${fx},318 ${fx + 14},334" fill="#fae6a2" opacity="0.07" />
  `).join("");

  svg.innerHTML = `
    <defs>
      <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="spotlight-beam" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stop-color="#fff8e6" stop-opacity="0.9" />
        <stop offset="35%" stop-color="#fae3b4" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#dfcaa0" stop-opacity="0.02" />
      </linearGradient>
      <linearGradient id="velvet-fold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#551218" />
        <stop offset="25%" stop-color="#7e1d25" />
        <stop offset="50%" stop-color="#5a141b" />
        <stop offset="75%" stop-color="#88222b" />
        <stop offset="100%" stop-color="#4d1016" />
      </linearGradient>
      <filter id="paper-standee-shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#2d2215" flood-opacity="0.25" />
      </filter>
    </defs>

    <!-- Room Architecture: Walls & Floor -->
    <rect x="0" y="0" width="840" height="340" class="room-wall-bg" />
    <line x1="28" y1="45" x2="812" y2="45" stroke="#d5cabb" stroke-width="1.2" />
    
    <!-- Wainscoting Wall Panels -->
    <line x1="160" y1="45" x2="160" y2="275" stroke="#e0d6c4" stroke-width="1" stroke-dasharray="6 8" />
    <line x1="320" y1="45" x2="320" y2="275" stroke="#e0d6c4" stroke-width="1" stroke-dasharray="6 8" />
    <line x1="480" y1="45" x2="480" y2="275" stroke="#e0d6c4" stroke-width="1" stroke-dasharray="6 8" />
    <line x1="640" y1="45" x2="640" y2="275" stroke="#e0d6c4" stroke-width="1" stroke-dasharray="6 8" />

    <!-- Hardwood Floorboards -->
    <line x1="0" y1="275" x2="840" y2="275" class="room-floor-line" />
    <line x1="0" y1="290" x2="840" y2="290" stroke="#ded5c4" stroke-width="1" />
    <line x1="0" y1="305" x2="840" y2="305" stroke="#e4dcce" stroke-width="1" />
    <line x1="0" y1="320" x2="840" y2="320" stroke="#ede5d8" stroke-width="1" />

    <!-- Top Proscenium Valance Drapery -->
    <path d="M 0 0 L 840 0 L 840 28 Q 735 44 630 28 Q 525 44 420 28 Q 315 44 210 28 Q 105 44 0 28 Z" fill="url(#velvet-fold)" />
    <path d="M 0 28 Q 105 44 210 28 Q 315 44 420 28 Q 525 44 630 28 Q 735 44 840 28" stroke="#c59b48" stroke-width="2.5" fill="none" />

    <!-- Left & Right Fluted Mahogany Pilasters -->
    <rect x="0" y="0" width="28" height="340" class="proscenium-column" />
    <line x1="14" y1="28" x2="14" y2="340" stroke="#c59b48" stroke-width="1.5" stroke-dasharray="8 6" />
    <rect x="812" y="0" width="28" height="340" class="proscenium-column" />
    <line x1="826" y1="28" x2="826" y2="340" stroke="#c59b48" stroke-width="1.5" stroke-dasharray="8 6" />

    <!-- Stage Footlight Lamps -->
    ${footlights}
  `;

  // 1. Render Interactive Fixtures
  fixtures.forEach((f) => {
    const isLit = spotlightedFixture === f.id || spotlightedNodes.includes(currentRoomId);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "fixture-group");

    // Spotlight beam on fixture
    if (isLit) {
      const beam = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      beam.setAttribute("points", `${f.x},28 ${f.x - 75},${f.y + 42} ${f.x + 75},${f.y + 42}`);
      beam.setAttribute("fill", "url(#spotlight-beam)");
      beam.setAttribute("class", "spotlight-cone");
      beam.setAttribute("filter", "url(#glow-gold)");
      svg.appendChild(beam);
    }

    // Fixture Card Rect
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", f.x - 70);
    rect.setAttribute("y", f.y - 38);
    rect.setAttribute("width", 140);
    rect.setAttribute("height", 76);
    rect.setAttribute("class", "fixture-box");
    g.appendChild(rect);

    // Handcrafted Vector Prop Vignette
    const ftype = (f.type || "").toLowerCase();
    const fid = (f.id || "").toLowerCase();
    if (fid.includes("telegraph") || ftype.includes("desk")) {
      // Brass Telegraph Key
      const keyBase = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      keyBase.setAttribute("x", f.x - 62);
      keyBase.setAttribute("y", f.y - 30);
      keyBase.setAttribute("width", 26);
      keyBase.setAttribute("height", 14);
      keyBase.setAttribute("fill", "#3d2a1b");
      keyBase.setAttribute("rx", "1");
      g.appendChild(keyBase);

      const keyKnob = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      keyKnob.setAttribute("cx", f.x - 52);
      keyKnob.setAttribute("cy", f.y - 25);
      keyKnob.setAttribute("r", "3");
      keyKnob.setAttribute("fill", "#c59b48");
      g.appendChild(keyKnob);

      const tapeLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tapeLine.setAttribute("d", `M ${f.x - 48} ${f.y - 23} Q ${f.x - 42} ${f.y - 18} ${f.x - 36} ${f.y - 24}`);
      tapeLine.setAttribute("stroke", "#fff8e8");
      tapeLine.setAttribute("stroke-width", "1.2");
      tapeLine.setAttribute("fill", "none");
      g.appendChild(tapeLine);
    } else if (fid.includes("stove") || ftype.includes("hearth")) {
      // Cast-Iron Potbelly Stove
      const stoveBody = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      stoveBody.setAttribute("x", f.x - 60);
      stoveBody.setAttribute("y", f.y - 32);
      stoveBody.setAttribute("width", 22);
      stoveBody.setAttribute("height", 18);
      stoveBody.setAttribute("fill", "#26221e");
      stoveBody.setAttribute("rx", "2");
      g.appendChild(stoveBody);

      const flue = document.createElementNS("http://www.w3.org/2000/svg", "line");
      flue.setAttribute("x1", f.x - 49);
      flue.setAttribute("y1", f.y - 32);
      flue.setAttribute("x2", f.x - 49);
      flue.setAttribute("y2", f.y - 37);
      flue.setAttribute("stroke", "#1c1916");
      flue.setAttribute("stroke-width", "3");
      g.appendChild(flue);

      const grate = document.createElementNS("http://www.w3.org/2000/svg", "line");
      grate.setAttribute("x1", f.x - 57);
      grate.setAttribute("y1", f.y - 22);
      grate.setAttribute("x2", f.x - 41);
      grate.setAttribute("y2", f.y - 22);
      grate.setAttribute("stroke", "#e67e22");
      grate.setAttribute("stroke-width", "1.8");
      g.appendChild(grate);
    } else if (fid.includes("trapdoor") || ftype.includes("floor")) {
      // Trapdoor Planks with Iron Ring
      const planks = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      planks.setAttribute("x", f.x - 62);
      planks.setAttribute("y", f.y - 30);
      planks.setAttribute("width", 26);
      planks.setAttribute("height", 14);
      planks.setAttribute("fill", "#2c2118");
      g.appendChild(planks);

      const seam = document.createElementNS("http://www.w3.org/2000/svg", "line");
      seam.setAttribute("x1", f.x - 62);
      seam.setAttribute("y1", f.y - 23);
      seam.setAttribute("x2", f.x - 36);
      seam.setAttribute("y2", f.y - 23);
      seam.setAttribute("stroke", "#18120d");
      seam.setAttribute("stroke-width", "1.5");
      g.appendChild(seam);

      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("cx", f.x - 49);
      ring.setAttribute("cy", f.y - 23);
      ring.setAttribute("r", "2.8");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", "#8c7755");
      ring.setAttribute("stroke-width", "1.2");
      g.appendChild(ring);
    } else {
      // Expedition Bureau / Map Table
      const bureau = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bureau.setAttribute("x", f.x - 62);
      bureau.setAttribute("y", f.y - 32);
      bureau.setAttribute("width", 24);
      bureau.setAttribute("height", 16);
      bureau.setAttribute("fill", "#423223");
      bureau.setAttribute("rx", "1");
      g.appendChild(bureau);

      const divLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      divLine.setAttribute("x1", f.x - 62);
      divLine.setAttribute("y1", f.y - 24);
      divLine.setAttribute("x2", f.x - 38);
      divLine.setAttribute("y2", f.y - 24);
      divLine.setAttribute("stroke", "#c59b48");
      divLine.setAttribute("stroke-width", "0.8");
      g.appendChild(divLine);
    }

    // Type Badge
    const badge = document.createElementNS("http://www.w3.org/2000/svg", "text");
    badge.setAttribute("x", f.x - 30);
    badge.setAttribute("y", f.y - 22);
    badge.setAttribute("class", "fixture-badge");
    badge.textContent = `[${(f.type || "SET").toUpperCase()}]`;
    g.appendChild(badge);

    // Fixture Title
    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", f.x - 62);
    title.setAttribute("y", f.y + 2);
    title.setAttribute("class", "fixture-title");
    title.textContent = f.name;
    g.appendChild(title);

    // Fixture Short Description
    const sub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    sub.setAttribute("x", f.x - 62);
    sub.setAttribute("y", f.y + 22);
    sub.setAttribute("class", "fixture-desc");
    const descShort = f.desc.length > 27 ? f.desc.slice(0, 25) + "..." : f.desc;
    sub.textContent = descShort;
    g.appendChild(sub);

    const fullTitle = document.createElementNS("http://www.w3.org/2000/svg", "title");
    fullTitle.textContent = `${f.name}: ${f.desc}`;
    g.appendChild(fullTitle);

    svg.appendChild(g);
  });

  // 2. Render Exit Doors
  exits.forEach((exit) => {
    const isBlocked = blocked.some(([u, v]) => u === currentRoomId && v === exit.target_node);
    const isLit = spotlightedFixture === String(exit.target_node);

    const dg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dg.setAttribute("class", "room-exit-door");

    // Door Spotlight
    if (isLit) {
      const beam = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      beam.setAttribute("points", `${exit.x},28 ${exit.x - 55},${exit.y + 45} ${exit.x + 55},${exit.y + 45}`);
      beam.setAttribute("fill", "url(#spotlight-beam)");
      beam.setAttribute("class", "spotlight-cone");
      beam.setAttribute("filter", "url(#glow-gold)");
      svg.appendChild(beam);
    }

    // Door Frame Rect
    const door = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    door.setAttribute("x", exit.x - 50);
    door.setAttribute("y", exit.y - 45);
    door.setAttribute("width", 100);
    door.setAttribute("height", 90);
    door.setAttribute("class", "door-frame");
    dg.appendChild(door);

    // Arch outline
    const arch = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arch.setAttribute("d", `M ${exit.x - 45} ${exit.y - 20} Q ${exit.x} ${exit.y - 42} ${exit.x + 45} ${exit.y - 20}`);
    arch.setAttribute("class", "door-arch");
    dg.appendChild(arch);

    // Door Text
    const dTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    dTitle.setAttribute("x", exit.x);
    dTitle.setAttribute("y", exit.y - 2);
    dTitle.setAttribute("class", "door-title");
    const nameShort = exit.name.split(" to ")[0];
    dTitle.textContent = nameShort.length > 14 ? nameShort.slice(0, 12) + ".." : nameShort;
    dg.appendChild(dTitle);

    const dSub = document.createElementNS("http://www.w3.org/2000/svg", "text");
    dSub.setAttribute("x", exit.x);
    dSub.setAttribute("y", exit.y + 16);
    dSub.setAttribute("class", "door-sub");
    dSub.textContent = `-> Node ${exit.target_node}`;
    dg.appendChild(dSub);

    // Dropped Velvet Curtain if Blocked
    if (isBlocked) {
      const curtain = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      curtain.setAttribute("x", exit.x - 50);
      curtain.setAttribute("y", exit.y - 45);
      curtain.setAttribute("width", 100);
      curtain.setAttribute("height", 90);
      curtain.setAttribute("fill", "url(#velvet-fold)");
      curtain.setAttribute("class", "curtain-drape");
      dg.appendChild(curtain);

      // Gold fringe line
      const fringe = document.createElementNS("http://www.w3.org/2000/svg", "line");
      fringe.setAttribute("x1", exit.x - 50);
      fringe.setAttribute("y1", exit.y + 45);
      fringe.setAttribute("x2", exit.x + 50);
      fringe.setAttribute("y2", exit.y + 45);
      fringe.setAttribute("class", "curtain-gold-trim");
      dg.appendChild(fringe);

      // Seal badge
      const sealRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      sealRect.setAttribute("x", exit.x - 42);
      sealRect.setAttribute("y", exit.y - 10);
      sealRect.setAttribute("width", 84);
      sealRect.setAttribute("height", 20);
      sealRect.setAttribute("class", "curtain-seal-rect");
      dg.appendChild(sealRect);

      const sealText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      sealText.setAttribute("x", exit.x);
      sealText.setAttribute("y", exit.y + 3);
      sealText.setAttribute("class", "curtain-seal-text");
      sealText.textContent = "CURTAIN LOWERED";
      dg.appendChild(sealText);
    }

    // Cast votes indicator
    const voters = characters.filter((c) => c.is_alive && c.voted_exit === exit.target_node);
    if (voters.length > 0) {
      const vPill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      vPill.setAttribute("x", exit.x - 38);
      vPill.setAttribute("y", exit.y + 26);
      vPill.setAttribute("width", 76);
      vPill.setAttribute("height", 14);
      vPill.setAttribute("class", "door-vote-pill");
      dg.appendChild(vPill);

      const vText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      vText.setAttribute("x", exit.x);
      vText.setAttribute("y", exit.y + 36);
      vText.setAttribute("class", "door-vote-text");
      const initials = voters.map((c) => CHAR_CONFIG[c.id]?.code || c.id[0]).join(", ");
      vText.textContent = `Votes: ${initials}`;
      dg.appendChild(vText);
    }

    svg.appendChild(dg);
  });

  // 3. Render Character Paper Standees at Room Fixtures
  const charsByFixture = {};
  characters.forEach((char) => {
    if (!char.is_alive) return;
    const fixId = char.current_fixture || fixtures[0]?.id || "stove";
    charsByFixture[fixId] = charsByFixture[fixId] || [];
    charsByFixture[fixId].push(char);
  });

  Object.entries(charsByFixture).forEach(([fixId, charList]) => {
    const fixture = fixtures.find((f) => f.id === fixId) || fixtures[0] || { x: 300, y: 150 };
    const count = charList.length;

    charList.forEach((char, idx) => {
      const cfg = CHAR_CONFIG[char.id] || { code: "?", color: "#333", class: "julian" };
      const offset = (idx - (count - 1) / 2) * 32;
      const posX = fixture.x + offset;
      const posY = fixture.y + 28;

      const tg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      tg.setAttribute("class", "char-token");

      // Standee Base on Stage Floor
      const base = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      base.setAttribute("cx", posX);
      base.setAttribute("cy", posY + 16);
      base.setAttribute("rx", "14");
      base.setAttribute("ry", "4");
      base.setAttribute("class", "standee-base");
      tg.appendChild(base);

      // Standee Paper Card
      const card = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      card.setAttribute("x", posX - 13);
      card.setAttribute("y", posY - 18);
      card.setAttribute("width", "26");
      card.setAttribute("height", "32");
      card.setAttribute("rx", "3");
      card.setAttribute("class", `standee-card ${cfg.class}`);
      card.setAttribute("filter", "url(#paper-standee-shadow)");
      tg.appendChild(card);

      // Actor Initial
      const letter = document.createElementNS("http://www.w3.org/2000/svg", "text");
      letter.setAttribute("x", posX);
      letter.setAttribute("y", posY - 1);
      letter.setAttribute("class", `standee-letter ${cfg.class}`);
      letter.textContent = cfg.code;
      tg.appendChild(letter);

      // Floating Action Cue
      if (char.room_action) {
        const actionText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        actionText.setAttribute("x", posX);
        actionText.setAttribute("y", posY - 23);
        actionText.setAttribute("class", "standee-action-bubble");
        const actShort = char.room_action.length > 18 ? char.room_action.slice(0, 16) + ".." : char.room_action;
        actionText.textContent = actShort;
        tg.appendChild(actionText);
      }

      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${char.name} (${char.role})\nLocation: ${fixture.name}\nAction: ${char.room_action || "Investigating"}\nVoted Exit: Node ${char.voted_exit || "Undecided"}\nHP: ${char.hp}/${char.max_hp}, Stress: ${char.stress}%, Weight: ${char.total_weight_kg}kg`;
      tg.appendChild(title);

      svg.appendChild(tg);
    });
  });
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
    const carriedItems = c.items && c.items.length > 0 ? c.items.join(", ") : "None";

    card.innerHTML = `
      <div class="cast-card-head">
        <div class="cast-portrait ${cfg.class}">${cfg.code}</div>
        <div class="cast-meta">
          <strong>${c.name}</strong>
          <small>${c.role} · At: ${c.current_fixture || "Room Set"}</small>
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
        <span>Load: <strong>${c.total_weight_kg} kg</strong> · Gear: ${carriedItems}</span>
        ${c.id === "Vesper" && c.total_weight_kg > 100 ? `<span style="color:#8c5828;margin-left:6px">(Heavy Contraband Payload)</span>` : ""}
      </div>
      <div style="font-size:9.5px;color:#544d41;margin-bottom:6px;font-style:italic">
        Action: "${c.room_action || "Observing"}"
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
  if (!label || !select || !rumorWrap || !stageState.data) return;

  const curRoom = stageState.data.current_room || {};
  const fixtures = curRoom.fixtures || [];
  const exits = curRoom.exits || [];

  rumorWrap.hidden = true;
  select.hidden = false;

  if (verb === "block_route") {
    label.textContent = "EXIT DOOR TO BLOCK (DROP VELVET CURTAIN)";
    if (exits.length > 0) {
      select.innerHTML = exits.map((e) => `
        <option value="${e.target_node}">${e.name} (To Node ${e.target_node})</option>
      `).join("");
    } else {
      select.innerHTML = `<option value="">No exit doors in this final room</option>`;
    }
  } else if (verb === "shift_spotlight") {
    label.textContent = "ROOM FIXTURE OR DOOR TO ILLUMINATE";
    const fixtureOptions = fixtures.map((f) => `
      <option value="${f.id}">${f.name} [${(f.type || "SET").toUpperCase()}]</option>
    `).join("");
    const exitOptions = exits.map((e) => `
      <option value="${e.target_node}">Exit: ${e.name}</option>
    `).join("");
    select.innerHTML = fixtureOptions + exitOptions;
  } else if (verb === "plant_rumor") {
    label.textContent = "WHISPER PROMPT CUE TO ACTOR";
    const living = Object.values(stageState.data.characters).filter((c) => c.is_alive);
    select.innerHTML = living.map((c) => `
      <option value="${c.id}">${c.name} (${c.role})</option>
    `).join("");
    rumorWrap.hidden = false;
  } else if (verb === "cue_prop") {
    label.textContent = "STAGE ITEM PLACEMENT AT FIXTURE";
    if (fixtures.length > 0) {
      select.innerHTML = fixtures.map((f) => `
        <option value="${f.id},Cold Iron Crowbar">${f.name}: Cold Iron Crowbar</option>
        <option value="${f.id},Restorative Tonic">${f.name}: Restorative Tonic</option>
        <option value="${f.id},Brass Lantern">${f.name}: Brass Lantern</option>
      `).join("");
    } else {
      select.innerHTML = `<option value="stove,Cold Iron Crowbar">Cold Iron Crowbar</option>`;
    }
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
      target = Number(select.value);
    } else if (verb === "shift_spotlight") {
      target = select.value;
    } else if (verb === "plant_rumor") {
      const char = select.value;
      const text = $("#rumor-text-input").value.trim() || "The path ahead is rigged.";
      target = { character: char, rumor: text };
    } else if (verb === "cue_prop") {
      const [fix, prop] = select.value.split(",");
      target = { fixture: fix, prop: (prop || "Item").trim() };
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
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStageEngine);
} else {
  initStageEngine();
}

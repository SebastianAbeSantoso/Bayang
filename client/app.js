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
  autoPlay: true,
  metronomeTimer: null,
  metronomeRemainingMs: 3500,
  metronomeTotalMs: 3500,
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
  "Julian": { code: "J", color: "#4a6778", class: "julian", name: "Julian Vance", avatar: "assets/julian.jpg" },
  "Vesper": { code: "V", color: "#9e6a2b", class: "vesper", name: "Vesper Cross", avatar: "assets/vesper.jpg" },
  "Beatrice": { code: "B", color: "#7e4334", class: "beatrice", name: "Beatrice Thorne", avatar: "assets/beatrice.jpg" },
  "The Curator": { code: "C", color: "#544163", class: "curator", name: "The Curator", avatar: "assets/curator.jpg" },
};

function getCharConfig(id) {
  if (!id) return { code: "?", color: "#666", class: "julian", name: "Unknown", avatar: "assets/julian.jpg" };
  const lower = id.toLowerCase();
  if (lower.includes("julian")) return CHAR_CONFIG["Julian"];
  if (lower.includes("vesper")) return CHAR_CONFIG["Vesper"];
  if (lower.includes("beatrice")) return CHAR_CONFIG["Beatrice"];
  if (lower.includes("curator")) return CHAR_CONFIG["The Curator"];
  return CHAR_CONFIG[id] || { code: id[0], color: "#666", class: "julian", name: id, avatar: "assets/julian.jpg" };
}

function selectVerb(verb) {
  document.querySelectorAll(".verb-choice").forEach((b) => {
    b.classList.toggle("selected", b.dataset.verb === verb);
  });
  stageState.selectedVerb = verb;
  updateDirectorDeckUI();
}

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

async function initStageEngine(forceReset = false) {
  renderStageBoard();
  renderCastCards();
  updateDirectorDeckUI();
  try {
    const endpoint = forceReset ? "/api/stage/init" : "/api/stage/state";
    let data = await api(endpoint);
    if (!data || !data.current_room_id) {
      data = await api("/api/stage/init");
    }
    stageState.data = data;
    renderStageBoard();
    renderCastCards();
    updateDirectorDeckUI();
    startMetronomeLoop();
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

  // Keep command bar target options synchronized with active room
  updateDirectorDeckUI();
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
    } else if (consensus && consensus.votes) {
      const votePairs = Object.entries(consensus.votes).filter(([_, v]) => v != null);
      if (votePairs.length > 0) {
        const summary = votePairs.map(([cid, v]) => `${cid}: Node ${v}`).join(", ");
        consensusHint.textContent = `Exit Votes: ${summary}. Awaiting consensus to depart.`;
      } else {
        consensusHint.textContent = `Cast exploring room fixtures (Turn ${stageState.data.room_turn || 1}).`;
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

  // Generate Stage Footlights along stage apron (y = 394)
  const footlights = [80, 160, 240, 320, 400, 480, 560, 640, 720, 780].map((fx) => `
    <circle cx="${fx}" cy="392" r="4.5" fill="#fcd34d" filter="url(#glow-amber)" />
    <circle cx="${fx}" cy="392" r="2.5" fill="#fffef0" />
    <polygon points="${fx - 24},396 ${fx},340 ${fx + 24},396" fill="#fef3c7" opacity="0.06" />
  `).join("");

  svg.innerHTML = `
    <defs>
      <!-- Atmospheric Gradients & Glows -->
      <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <filter id="standee-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.45 0"/>
      </filter>
      
      <!-- Limelight Conical Beam -->
      <linearGradient id="limelight-cone" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stop-color="#fffbeb" stop-opacity="0.9" />
        <stop offset="35%" stop-color="#fde68a" stop-opacity="0.45" />
        <stop offset="70%" stop-color="#d97706" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#b45309" stop-opacity="0.0" />
      </linearGradient>

      <!-- Velvet Drapery Gradient -->
      <linearGradient id="velvet-fold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b0d11" />
        <stop offset="20%" stop-color="#6e151c" />
        <stop offset="45%" stop-color="#4a0f14" />
        <stop offset="70%" stop-color="#7a1820" />
        <stop offset="100%" stop-color="#2d080b" />
      </linearGradient>

      <!-- Aged Stage Wood Planks -->
      <linearGradient id="wall-damask" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1c1713" />
        <stop offset="60%" stop-color="#251e18" />
        <stop offset="100%" stop-color="#18130f" />
      </linearGradient>
      
      <linearGradient id="stage-floor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#2e2216" />
        <stop offset="40%" stop-color="#241a10" />
        <stop offset="100%" stop-color="#161009" />
      </linearGradient>

      <!-- Antique Brass Plaque Texture -->
      <linearGradient id="brass-plaque" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ecd599" />
        <stop offset="50%" stop-color="#c59b48" />
        <stop offset="100%" stop-color="#8a6421" />
      </linearGradient>

      <!-- 2D Character Token Circular Clip -->
      <clipPath id="token-clip-circle">
        <circle cx="0" cy="0" r="23" />
      </clipPath>
    </defs>

    <!-- 1. STAGE ENVIRONMENT (Atmospheric Victorian Theater Room) -->
    <!-- Rear Wall (Dark Victorian Salon Damask) -->
    <rect x="0" y="0" width="840" height="260" fill="url(#wall-damask)" />
    
    <!-- Ornate Damask Wall Panels & Gilded Picture Rail -->
    <line x1="28" y1="48" x2="812" y2="48" stroke="#8a6421" stroke-width="1.8" />
    <line x1="28" y1="52" x2="812" y2="52" stroke="#3b2b18" stroke-width="1" />
    
    <!-- Vertical Wall Column Paneling -->
    <line x1="140" y1="52" x2="140" y2="260" stroke="#2d241c" stroke-width="1.5" />
    <line x1="310" y1="52" x2="310" y2="260" stroke="#2d241c" stroke-width="1.5" />
    <line x1="480" y1="52" x2="480" y2="260" stroke="#2d241c" stroke-width="1.5" />
    <line x1="660" y1="52" x2="660" y2="260" stroke="#2d241c" stroke-width="1.5" />

    <!-- Dado / Wainscoting Rail -->
    <rect x="28" y="248" width="784" height="12" fill="#2d2116" stroke="#4a3723" stroke-width="1" />

    <!-- 2. STAGE FLOOR (Hardwood Floorboards with Depth & Perspective) -->
    <rect x="0" y="260" width="840" height="140" fill="url(#stage-floor)" />
    
    <!-- Floorboard Perspective Planks -->
    <line x1="0" y1="290" x2="840" y2="290" stroke="#1f160e" stroke-width="1.2" />
    <line x1="0" y1="324" x2="840" y2="324" stroke="#1a120b" stroke-width="1.5" />
    <line x1="0" y1="362" x2="840" y2="362" stroke="#150e08" stroke-width="1.8" />
    
    <!-- Vertical Plank Joints -->
    <line x1="120" y1="260" x2="105" y2="290" stroke="#1a120b" stroke-width="1" />
    <line x1="280" y1="260" x2="265" y2="290" stroke="#1a120b" stroke-width="1" />
    <line x1="450" y1="260" x2="435" y2="290" stroke="#1a120b" stroke-width="1" />
    <line x1="620" y1="260" x2="605" y2="290" stroke="#1a120b" stroke-width="1" />

    <line x1="200" y1="290" x2="180" y2="324" stroke="#160f09" stroke-width="1" />
    <line x1="370" y1="290" x2="350" y2="324" stroke="#160f09" stroke-width="1" />
    <line x1="540" y1="290" x2="520" y2="324" stroke="#160f09" stroke-width="1" />
    <line x1="710" y1="290" x2="690" y2="324" stroke="#160f09" stroke-width="1" />

    <line x1="90" y1="324" x2="65" y2="362" stroke="#120c07" stroke-width="1.2" />
    <line x1="270" y1="324" x2="245" y2="362" stroke="#120c07" stroke-width="1.2" />
    <line x1="470" y1="324" x2="445" y2="362" stroke="#120c07" stroke-width="1.2" />
    <line x1="650" y1="324" x2="625" y2="362" stroke="#120c07" stroke-width="1.2" />

    <!-- Stage Apron Brass Rim -->
    <rect x="0" y="394" width="840" height="6" fill="url(#brass-plaque)" stroke="#3a2510" stroke-width="0.8" />

    <!-- 3. PROSCENIUM ARCH & DRAPERY VALANCE -->
    <path d="M 0,0 L 840,0 L 840,36 C 760,42 700,32 630,36 C 560,42 490,32 420,36 C 350,42 280,32 210,36 C 140,42 70,32 0,36 Z" fill="url(#velvet-fold)" />
    <path d="M 0,36 C 70,32 140,42 210,36 C 280,32 350,42 420,36 C 490,32 560,42 630,36 C 700,32 760,42 840,36" stroke="#c59b48" stroke-width="2.5" fill="none" />
    
    <!-- Gold Bullion Fringe Drops -->
    <circle cx="105" cy="46" r="3.5" fill="#fcd34d" />
    <circle cx="315" cy="46" r="3.5" fill="#fcd34d" />
    <circle cx="525" cy="46" r="3.5" fill="#fcd34d" />
    <circle cx="735" cy="46" r="3.5" fill="#fcd34d" />

    <!-- Left Fluted Mahogany Pilaster Column -->
    <rect x="0" y="0" width="28" height="400" fill="#2b1c12" stroke="#442c1c" stroke-width="1.5" />
    <line x1="14" y1="34" x2="14" y2="400" stroke="#c59b48" stroke-width="2" stroke-dasharray="10 8" />
    <rect x="0" y="32" width="28" height="8" fill="url(#brass-plaque)" />
    <rect x="0" y="380" width="28" height="12" fill="url(#brass-plaque)" />

    <!-- Right Fluted Mahogany Pilaster Column -->
    <rect x="812" y="0" width="28" height="400" fill="#2b1c12" stroke="#442c1c" stroke-width="1.5" />
    <line x1="826" y1="34" x2="826" y2="400" stroke="#c59b48" stroke-width="2" stroke-dasharray="10 8" />
    <rect x="812" y="32" width="28" height="8" fill="url(#brass-plaque)" />
    <rect x="812" y="380" width="28" height="12" fill="url(#brass-plaque)" />

    <!-- Stage Apron Footlights -->
    ${footlights}
  `;

  // 4. RENDER ILLUSTRATED FIXTURE SET PIECES (Antique Theater Props)
  fixtures.forEach((f) => {
    const isLit = spotlightedFixture === f.id || spotlightedNodes.includes(currentRoomId);
    const fg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    fg.setAttribute("class", "fixture-group");
    fg.setAttribute("style", "cursor: pointer;");

    // Limelight Spotlight Cone
    if (isLit) {
      const beam = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      beam.setAttribute("points", `${f.x},32 ${f.x - 70},${f.y + 70} ${f.x + 70},${f.y + 70}`);
      beam.setAttribute("fill", "url(#limelight-cone)");
      beam.setAttribute("class", "spotlight-cone");
      beam.setAttribute("filter", "url(#glow-gold)");
      svg.appendChild(beam);
    }

    const fid = (f.id || "").toLowerCase();
    const ftype = (f.type || "").toLowerCase();

    // Prop Floor Shadow
    const shadow = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    shadow.setAttribute("cx", f.x);
    shadow.setAttribute("cy", f.y + 45);
    shadow.setAttribute("rx", "48");
    shadow.setAttribute("ry", "10");
    shadow.setAttribute("fill", "#000");
    shadow.setAttribute("opacity", "0.35");
    shadow.setAttribute("filter", "url(#standee-shadow)");
    fg.appendChild(shadow);

    // DRAW BESPOKE ILLUSTRATED PROPS
    if (fid.includes("telegraph") || ftype.includes("terminal")) {
      // 1. TELEGRAPH DESK PROP
      const deskTop = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      deskTop.setAttribute("x", f.x - 48);
      deskTop.setAttribute("y", f.y - 10);
      deskTop.setAttribute("width", "96");
      deskTop.setAttribute("height", "14");
      deskTop.setAttribute("rx", "2");
      deskTop.setAttribute("fill", "#422817");
      deskTop.setAttribute("stroke", "#c59b48");
      deskTop.setAttribute("stroke-width", "1.2");
      fg.appendChild(deskTop);

      // Desk Legs
      const legL = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      legL.setAttribute("x", f.x - 42);
      legL.setAttribute("y", f.y + 4);
      legL.setAttribute("width", "8");
      legL.setAttribute("height", "40");
      legL.setAttribute("fill", "#2b1a0e");
      fg.appendChild(legL);

      const legR = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      legR.setAttribute("x", f.x + 34);
      legR.setAttribute("y", f.y + 4);
      legR.setAttribute("width", "8");
      legR.setAttribute("height", "40");
      legR.setAttribute("fill", "#2b1a0e");
      fg.appendChild(legR);

      // Brass Morse Key & Sounder Box
      const sounderBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      sounderBox.setAttribute("x", f.x - 28);
      sounderBox.setAttribute("y", f.y - 24);
      sounderBox.setAttribute("width", "26");
      sounderBox.setAttribute("height", "15");
      sounderBox.setAttribute("rx", "2");
      sounderBox.setAttribute("fill", "#22170f");
      sounderBox.setAttribute("stroke", "#d4af37");
      sounderBox.setAttribute("stroke-width", "1");
      fg.appendChild(sounderBox);

      // Brass Key Arm
      const keyArm = document.createElementNS("http://www.w3.org/2000/svg", "line");
      keyArm.setAttribute("x1", f.x - 22);
      keyArm.setAttribute("y1", f.y - 17);
      keyArm.setAttribute("x2", f.x - 8);
      keyArm.setAttribute("y2", f.y - 20);
      keyArm.setAttribute("stroke", "#fcd34d");
      keyArm.setAttribute("stroke-width", "2");
      fg.appendChild(keyArm);

      const keyKnob = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      keyKnob.setAttribute("cx", f.x - 8);
      keyKnob.setAttribute("cy", f.y - 20);
      keyKnob.setAttribute("r", "3");
      keyKnob.setAttribute("fill", "#1c120a");
      keyKnob.setAttribute("stroke", "#fcd34d");
      keyKnob.setAttribute("stroke-width", "1");
      fg.appendChild(keyKnob);

      // Green Banker's Desk Lamp with Amber Glow
      const lampBase = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      lampBase.setAttribute("x", f.x + 12);
      lampBase.setAttribute("y", f.y - 26);
      lampBase.setAttribute("width", "20");
      lampBase.setAttribute("height", "7");
      lampBase.setAttribute("rx", "3");
      lampBase.setAttribute("fill", "#1d5c38");
      lampBase.setAttribute("stroke", "#fcd34d");
      lampBase.setAttribute("stroke-width", "1");
      fg.appendChild(lampBase);

      const lampGlow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      lampGlow.setAttribute("cx", f.x + 22);
      lampGlow.setAttribute("cy", f.y - 20);
      lampGlow.setAttribute("r", "14");
      lampGlow.setAttribute("fill", "#fef3c7");
      lampGlow.setAttribute("opacity", "0.2");
      lampGlow.setAttribute("filter", "url(#glow-amber)");
      fg.appendChild(lampGlow);

      // Cascading Ticker Tape Paper
      const tape = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tape.setAttribute("d", `M ${f.x - 2} ${f.y - 10} Q ${f.x + 8} ${f.y + 6} ${f.x - 4} ${f.y + 24} T ${f.x + 6} ${f.y + 40}`);
      tape.setAttribute("stroke", "#fef9c3");
      tape.setAttribute("stroke-width", "2.5");
      tape.setAttribute("fill", "none");
      fg.appendChild(tape);

    } else if (fid.includes("stove") || ftype.includes("rest") || fid.includes("hearth")) {
      // 2. CAST-IRON POTBELLY STOVE PROP
      const chimney = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      chimney.setAttribute("x", f.x - 6);
      chimney.setAttribute("y", f.y - 48);
      chimney.setAttribute("width", "12");
      chimney.setAttribute("height", "30");
      chimney.setAttribute("fill", "#17120e");
      chimney.setAttribute("stroke", "#3a2c1f");
      chimney.setAttribute("stroke-width", "1");
      fg.appendChild(chimney);

      const stoveBody = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      stoveBody.setAttribute("x", f.x - 24);
      stoveBody.setAttribute("y", f.y - 20);
      stoveBody.setAttribute("width", "48");
      stoveBody.setAttribute("height", "54");
      stoveBody.setAttribute("rx", "12");
      stoveBody.setAttribute("fill", "#1c1611");
      stoveBody.setAttribute("stroke", "#c59b48");
      stoveBody.setAttribute("stroke-width", "1.5");
      fg.appendChild(stoveBody);

      const grateGlow = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      grateGlow.setAttribute("cx", f.x);
      grateGlow.setAttribute("cy", f.y + 12);
      grateGlow.setAttribute("rx", "22");
      grateGlow.setAttribute("ry", "14");
      grateGlow.setAttribute("fill", "#ea580c");
      grateGlow.setAttribute("opacity", "0.4");
      grateGlow.setAttribute("filter", "url(#glow-amber)");
      fg.appendChild(grateGlow);

      for (let sl = -12; sl <= 12; sl += 6) {
        const slit = document.createElementNS("http://www.w3.org/2000/svg", "line");
        slit.setAttribute("x1", f.x - 12);
        slit.setAttribute("y1", f.y + sl + 10);
        slit.setAttribute("x2", f.x + 12);
        slit.setAttribute("y2", f.y + sl + 10);
        slit.setAttribute("stroke", "#fbbf24");
        slit.setAttribute("stroke-width", "2.2");
        fg.appendChild(slit);
      }

      // Bench beside stove
      const bench = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bench.setAttribute("x", f.x + 28);
      bench.setAttribute("y", f.y + 14);
      bench.setAttribute("width", "28");
      bench.setAttribute("height", "8");
      bench.setAttribute("rx", "1");
      bench.setAttribute("fill", "#422b1a");
      bench.setAttribute("stroke", "#8c642d");
      bench.setAttribute("stroke-width", "1");
      fg.appendChild(bench);

      const benchLeg = document.createElementNS("http://www.w3.org/2000/svg", "line");
      benchLeg.setAttribute("x1", f.x + 48);
      benchLeg.setAttribute("y1", f.y + 22);
      benchLeg.setAttribute("x2", f.x + 48);
      benchLeg.setAttribute("y2", f.y + 44);
      benchLeg.setAttribute("stroke", "#2b1c10");
      benchLeg.setAttribute("stroke-width", "3");
      fg.appendChild(benchLeg);

    } else if (fid.includes("floor") || ftype.includes("hazard") || fid.includes("scree")) {
      // 3. ROTTED FLOORBOARDS / TRAPDOOR HAZARD
      const abyss = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      abyss.setAttribute("cx", f.x);
      abyss.setAttribute("cy", f.y + 10);
      abyss.setAttribute("rx", "44");
      abyss.setAttribute("ry", "18");
      abyss.setAttribute("fill", "#090604");
      abyss.setAttribute("stroke", "#3b1e10");
      abyss.setAttribute("stroke-width", "1.5");
      fg.appendChild(abyss);

      // Splintered Broken Planks
      const plank1 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      plank1.setAttribute("points", `${f.x - 42},${f.y + 4} ${f.x - 8},${f.y - 2} ${f.x - 12},${f.y + 12} ${f.x - 40},${f.y + 14}`);
      plank1.setAttribute("fill", "#382213");
      plank1.setAttribute("stroke", "#8a5829");
      plank1.setAttribute("stroke-width", "1");
      fg.appendChild(plank1);

      const plank2 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      plank2.setAttribute("points", `${f.x + 10},${f.y + 8} ${f.x + 42},${f.y + 2} ${f.x + 38},${f.y + 16} ${f.x + 6},${f.y + 18}`);
      plank2.setAttribute("fill", "#2e1c0f");
      plank2.setAttribute("stroke", "#784a20");
      plank2.setAttribute("stroke-width", "1");
      fg.appendChild(plank2);

      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("cx", f.x - 2);
      ring.setAttribute("cy", f.y + 12);
      ring.setAttribute("r", "5.5");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", "#fcd34d");
      ring.setAttribute("stroke-width", "2");
      fg.appendChild(ring);

    } else {
      // 4. ARCHIVAL CABINETS / BLUEPRINT BUREAU
      const cab = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      cab.setAttribute("x", f.x - 38);
      cab.setAttribute("y", f.y - 26);
      cab.setAttribute("width", "76");
      cab.setAttribute("height", "66");
      cab.setAttribute("rx", "2");
      cab.setAttribute("fill", "#382315");
      cab.setAttribute("stroke", "#c59b48");
      cab.setAttribute("stroke-width", "1.5");
      fg.appendChild(cab);

      for (let dy = -10; dy <= 26; dy += 18) {
        const dLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        dLine.setAttribute("x1", f.x - 34);
        dLine.setAttribute("y1", f.y + dy);
        dLine.setAttribute("x2", f.x + 34);
        dLine.setAttribute("y2", f.y + dy);
        dLine.setAttribute("stroke", "#20140a");
        dLine.setAttribute("stroke-width", "1.5");
        fg.appendChild(dLine);

        const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        handle.setAttribute("x", f.x - 8);
        handle.setAttribute("y", f.y + dy - 10);
        handle.setAttribute("width", "16");
        handle.setAttribute("height", "5");
        handle.setAttribute("rx", "1.5");
        handle.setAttribute("fill", "#fcd34d");
        fg.appendChild(handle);
      }

      const scroll = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      scroll.setAttribute("cx", f.x);
      scroll.setAttribute("cy", f.y - 31);
      scroll.setAttribute("rx", "26");
      scroll.setAttribute("ry", "6");
      scroll.setAttribute("fill", "#1e3a5f");
      scroll.setAttribute("stroke", "#93c5fd");
      scroll.setAttribute("stroke-width", "1");
      fg.appendChild(scroll);
    }

    // 5. ANTIQUE BRASS FIXTURE PLAQUE (Positioned by depth tier to eliminate collisions)
    const plaqueG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    plaqueG.setAttribute("class", "fixture-plaque");

    // Tier calculation: background fixtures hang at f.y - 56, foreground at f.y - 44
    const plaqueY = f.y < 180 ? f.y - 56 : f.y - 44;

    const plaqueRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    plaqueRect.setAttribute("x", f.x - 56);
    plaqueRect.setAttribute("y", plaqueY - 12);
    plaqueRect.setAttribute("width", "112");
    plaqueRect.setAttribute("height", "24");
    plaqueRect.setAttribute("rx", "3");
    plaqueRect.setAttribute("fill", "#1c150e");
    plaqueRect.setAttribute("stroke", "#c59b48");
    plaqueRect.setAttribute("stroke-width", "1.2");
    plaqueG.appendChild(plaqueRect);

    const titleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    titleText.setAttribute("x", f.x);
    titleText.setAttribute("y", plaqueY + 1);
    titleText.setAttribute("text-anchor", "middle");
    titleText.setAttribute("fill", "#fff7ed");
    titleText.setAttribute("font-family", "'Cinzel', Georgia, serif");
    titleText.setAttribute("font-size", "9");
    titleText.setAttribute("font-weight", "600");
    titleText.setAttribute("letter-spacing", "0.04em");
    titleText.textContent = f.name.toUpperCase();
    plaqueG.appendChild(titleText);

    const typeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    typeText.setAttribute("x", f.x);
    typeText.setAttribute("y", plaqueY + 9);
    typeText.setAttribute("text-anchor", "middle");
    typeText.setAttribute("fill", "#d97706");
    typeText.setAttribute("font-family", "'DM Mono', monospace");
    typeText.setAttribute("font-size", "7");
    typeText.setAttribute("font-weight", "700");
    typeText.textContent = `✦ ${(f.type || "SET PIECE").toUpperCase()} ✦`;
    plaqueG.appendChild(typeText);

    fg.appendChild(plaqueG);

    // Interactive Click: clicking a fixture auto-selects Spotlight
    fg.onclick = () => {
      selectVerb("shift_spotlight");
      const sel = $("#director-target-select");
      if (sel) sel.value = f.id;
    };

    // Tooltip
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tip.textContent = `${f.name} [${(f.type || "SET").toUpperCase()}]: ${f.desc}`;
    fg.appendChild(tip);

    svg.appendChild(fg);
  });

  // 6. RENDER GOTHIC ARCHED EXIT DOORS
  exits.forEach((exit) => {
    const isBlocked = blocked.some(([u, v]) => u === currentRoomId && v === exit.target_node);
    const isLit = spotlightedFixture === String(exit.target_node);

    const dg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dg.setAttribute("class", "room-exit-door");
    dg.setAttribute("style", "cursor: pointer;");

    // Limelight on Door
    if (isLit) {
      const beam = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      beam.setAttribute("points", `${exit.x},32 ${exit.x - 55},${exit.y + 60} ${exit.x + 55},${exit.y + 60}`);
      beam.setAttribute("fill", "url(#limelight-cone)");
      beam.setAttribute("class", "spotlight-cone");
      beam.setAttribute("filter", "url(#glow-gold)");
      svg.appendChild(beam);
    }

    // Door Portal Arch Frame
    const doorFrame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    doorFrame.setAttribute("x", exit.x - 48);
    doorFrame.setAttribute("y", exit.y - 44);
    doorFrame.setAttribute("width", "96");
    doorFrame.setAttribute("height", "88");
    doorFrame.setAttribute("rx", "16");
    doorFrame.setAttribute("fill", "#100c09");
    doorFrame.setAttribute("stroke", isBlocked ? "#781c24" : "#c59b48");
    doorFrame.setAttribute("stroke-width", "2");
    dg.appendChild(doorFrame);

    // Gothic Pointed Arch Cresting
    const archPeak = document.createElementNS("http://www.w3.org/2000/svg", "path");
    archPeak.setAttribute("d", `M ${exit.x - 48} ${exit.y - 30} Q ${exit.x} ${exit.y - 56} ${exit.x + 48} ${exit.y - 30}`);
    archPeak.setAttribute("stroke", "#fcd34d");
    archPeak.setAttribute("stroke-width", "1.5");
    archPeak.setAttribute("fill", "none");
    dg.appendChild(archPeak);

    // Inner Doorway Void
    const doorVoid = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    doorVoid.setAttribute("x", exit.x - 40);
    doorVoid.setAttribute("y", exit.y - 36);
    doorVoid.setAttribute("width", "80");
    doorVoid.setAttribute("height", "74");
    doorVoid.setAttribute("rx", "12");
    doorVoid.setAttribute("fill", isBlocked ? "#180a0d" : "#0d0a07");
    dg.appendChild(doorVoid);

    // Door Nameplate Plaque (Short clean name so it never overflows)
    const dPlaque = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    dPlaque.setAttribute("x", exit.x - 44);
    dPlaque.setAttribute("y", exit.y - 40);
    dPlaque.setAttribute("width", "88");
    dPlaque.setAttribute("height", "20");
    dPlaque.setAttribute("rx", "2");
    dPlaque.setAttribute("fill", "#1c150e");
    dPlaque.setAttribute("stroke", "#c59b48");
    dPlaque.setAttribute("stroke-width", "1");
    dg.appendChild(dPlaque);

    const dShortName = exit.name.includes(":") ? exit.name.split(":")[0] : exit.name.split(" to ")[0];
    const dName = document.createElementNS("http://www.w3.org/2000/svg", "text");
    dName.setAttribute("x", exit.x);
    dName.setAttribute("y", exit.y - 26);
    dName.setAttribute("text-anchor", "middle");
    dName.setAttribute("fill", "#fff7ed");
    dName.setAttribute("font-family", "'Cinzel', Georgia, serif");
    dName.setAttribute("font-size", "8");
    dName.setAttribute("font-weight", "700");
    dName.textContent = dShortName.toUpperCase();
    dg.appendChild(dName);

    // Target Node Tag
    const targetTag = document.createElementNS("http://www.w3.org/2000/svg", "text");
    targetTag.setAttribute("x", exit.x);
    targetTag.setAttribute("y", exit.y - 4);
    targetTag.setAttribute("text-anchor", "middle");
    targetTag.setAttribute("fill", "#c59b48");
    targetTag.setAttribute("font-family", "'DM Mono', monospace");
    targetTag.setAttribute("font-size", "7.5");
    targetTag.setAttribute("font-weight", "700");
    targetTag.textContent = `→ NODE ${exit.target_node}`;
    dg.appendChild(targetTag);

    // If Blocked: Draw Velvet Drop Curtain with Bullion Fringe & Wax Seal
    if (isBlocked) {
      const curtain = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      curtain.setAttribute("x", exit.x - 48);
      curtain.setAttribute("y", exit.y - 44);
      curtain.setAttribute("width", "96");
      curtain.setAttribute("height", "88");
      curtain.setAttribute("fill", "url(#velvet-fold)");
      curtain.setAttribute("stroke", "#4a0f14");
      curtain.setAttribute("stroke-width", "1.5");
      dg.appendChild(curtain);

      // Gold bullion bottom fringe
      const fringe = document.createElementNS("http://www.w3.org/2000/svg", "line");
      fringe.setAttribute("x1", exit.x - 48);
      fringe.setAttribute("y1", exit.y + 44);
      fringe.setAttribute("x2", exit.x + 48);
      fringe.setAttribute("y2", exit.y + 44);
      fringe.setAttribute("stroke", "#fcd34d");
      fringe.setAttribute("stroke-width", "3");
      dg.appendChild(fringe);

      // Wax Seal Badge
      const sealG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const sealRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      sealRect.setAttribute("x", exit.x - 42);
      sealRect.setAttribute("y", exit.y - 12);
      sealRect.setAttribute("width", "84");
      sealRect.setAttribute("height", "24");
      sealRect.setAttribute("rx", "3");
      sealRect.setAttribute("fill", "#781c24");
      sealRect.setAttribute("stroke", "#fcd34d");
      sealRect.setAttribute("stroke-width", "1.5");
      sealG.appendChild(sealRect);

      const sealText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      sealText.setAttribute("x", exit.x);
      sealText.setAttribute("y", exit.y + 3);
      sealText.setAttribute("text-anchor", "middle");
      sealText.setAttribute("fill", "#fef3c7");
      sealText.setAttribute("font-family", "'DM Mono', monospace");
      sealText.setAttribute("font-size", "8");
      sealText.setAttribute("font-weight", "700");
      sealText.setAttribute("letter-spacing", "0.06em");
      sealText.textContent = "CURTAIN SEALED";
      sealG.appendChild(sealText);

      dg.appendChild(sealG);
    }

    // Cast Votes Indicator Tag
    const voters = characters.filter((c) => c.is_alive && c.voted_exit === exit.target_node);
    if (voters.length > 0) {
      const vPill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      vPill.setAttribute("x", exit.x - 38);
      vPill.setAttribute("y", exit.y + 30);
      vPill.setAttribute("width", "76");
      vPill.setAttribute("height", "18");
      vPill.setAttribute("rx", "9");
      vPill.setAttribute("fill", "#1c150e");
      vPill.setAttribute("stroke", "#c59b48");
      vPill.setAttribute("stroke-width", "1");
      dg.appendChild(vPill);

      const vText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      vText.setAttribute("x", exit.x);
      vText.setAttribute("y", exit.y + 42);
      vText.setAttribute("text-anchor", "middle");
      vText.setAttribute("fill", "#fde68a");
      vText.setAttribute("font-family", "'DM Mono', monospace");
      vText.setAttribute("font-size", "8.5");
      vText.setAttribute("font-weight", "700");
      const initials = voters.map((c) => CHAR_CONFIG[c.id]?.code || c.id[0]).join(", ");
      vText.textContent = `Votes: ${initials}`;
      dg.appendChild(vText);
    }

    // Interactive Click: clicking an exit door pre-selects block_route
    dg.onclick = () => {
      selectVerb("block_route");
      const sel = $("#director-target-select");
      if (sel) sel.value = String(exit.target_node);
    };

    svg.appendChild(dg);
  });

  // 7. RENDER CHARACTERS AS REVERSE: 1999 2D TOKEN MODELS ON STAGE FLOOR
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
      const cfg = getCharConfig(char.id);
      // Position tokens comfortably on stage floor in front of fixture
      const offset = (idx - (count - 1) / 2) * 54;
      const posX = fixture.x + offset;
      const posY = 320; // Standing firmly on hardwood floorboards!

      const tg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      tg.setAttribute("class", "char-standee-group");
      tg.setAttribute("data-char-id", char.id);
      tg.setAttribute("transform", `translate(${posX}, ${posY})`);
      tg.setAttribute("style", `transform: translate(${posX}px, ${posY}px); cursor: pointer;`);

      // 1. Cast Shadow on Floor
      const shadow = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      shadow.setAttribute("cx", "0");
      shadow.setAttribute("cy", "30");
      shadow.setAttribute("rx", "28");
      shadow.setAttribute("ry", "8");
      shadow.setAttribute("fill", "#000");
      shadow.setAttribute("opacity", "0.45");
      shadow.setAttribute("filter", "url(#standee-shadow)");
      tg.appendChild(shadow);

      // 2. Brass Pedestal Stand Base
      const standBase = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      standBase.setAttribute("cx", "0");
      standBase.setAttribute("cy", "27");
      standBase.setAttribute("rx", "24");
      standBase.setAttribute("ry", "6.5");
      standBase.setAttribute("fill", "url(#brass-plaque)");
      standBase.setAttribute("stroke", "#453214");
      standBase.setAttribute("stroke-width", "1.2");
      tg.appendChild(standBase);

      const baseStep = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      baseStep.setAttribute("x", "-16");
      baseStep.setAttribute("y", "23");
      baseStep.setAttribute("width", "32");
      baseStep.setAttribute("height", "4");
      baseStep.setAttribute("fill", "#2b1c0e");
      baseStep.setAttribute("rx", "1");
      tg.appendChild(baseStep);

      // 3. Ornate Bronze Bezel Medallion Frame
      const outerRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      outerRing.setAttribute("cx", "0");
      outerRing.setAttribute("cy", "0");
      outerRing.setAttribute("r", "27");
      outerRing.setAttribute("fill", "#1c140d");
      outerRing.setAttribute("stroke", "#c59b48");
      outerRing.setAttribute("stroke-width", "2.5");
      outerRing.setAttribute("class", "bezel-ring");
      tg.appendChild(outerRing);

      // Inner astrological clockwork ticks
      const tickRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      tickRing.setAttribute("cx", "0");
      tickRing.setAttribute("cy", "0");
      tickRing.setAttribute("r", "24.5");
      tickRing.setAttribute("fill", "none");
      tickRing.setAttribute("stroke", "#fcd34d");
      tickRing.setAttribute("stroke-width", "0.75");
      tickRing.setAttribute("stroke-dasharray", "2.5 2");
      tg.appendChild(tickRing);

      // 4. 2D Painterly Character Image (clipped in circle)
      const imgGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      imgGroup.setAttribute("clip-path", "url(#token-clip-circle)");

      const portrait = document.createElementNS("http://www.w3.org/2000/svg", "image");
      portrait.setAttribute("href", cfg.avatar);
      portrait.setAttribute("x", "-23");
      portrait.setAttribute("y", "-23");
      portrait.setAttribute("width", "46");
      portrait.setAttribute("height", "46");
      portrait.setAttribute("preserveAspectRatio", "xMidYMid slice");
      imgGroup.appendChild(portrait);
      tg.appendChild(imgGroup);

      // 5. Glass Sheen Curved Highlight Reflection Overlay
      const sheen = document.createElementNS("http://www.w3.org/2000/svg", "path");
      sheen.setAttribute("d", "M -16 -16 A 23 23 0 0 1 16 -16 A 23 13 0 0 0 -16 -16");
      sheen.setAttribute("fill", "#ffffff");
      sheen.setAttribute("opacity", "0.26");
      sheen.setAttribute("pointer-events", "none");
      tg.appendChild(sheen);

      // 6. Character Accent Border Ring
      const accentRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      accentRing.setAttribute("cx", "0");
      accentRing.setAttribute("cy", "0");
      accentRing.setAttribute("r", "23");
      accentRing.setAttribute("fill", "none");
      accentRing.setAttribute("stroke", cfg.color);
      accentRing.setAttribute("stroke-width", "1.6");
      tg.appendChild(accentRing);

      // 7. Gilded Nameplate on Pedestal
      const isCurator = char.id.toLowerCase().includes("curator") || (char.name && char.name.toLowerCase().includes("curator"));
      const shortName = isCurator ? "CURATOR" : char.name.split(" ")[0].toUpperCase();

      const namePlate = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      namePlate.setAttribute("x", "-25");
      namePlate.setAttribute("y", "17");
      namePlate.setAttribute("width", "50");
      namePlate.setAttribute("height", "14");
      namePlate.setAttribute("rx", "2");
      namePlate.setAttribute("fill", "#1c140e");
      namePlate.setAttribute("stroke", "#c59b48");
      namePlate.setAttribute("stroke-width", "1");
      tg.appendChild(namePlate);

      const nameText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      nameText.setAttribute("x", "0");
      nameText.setAttribute("y", "27");
      nameText.setAttribute("text-anchor", "middle");
      nameText.setAttribute("fill", "#fff8ed");
      nameText.setAttribute("font-family", "'Cinzel', Georgia, serif");
      nameText.setAttribute("font-size", shortName.length > 7 ? "6.5" : "7.5");
      nameText.setAttribute("font-weight", "700");
      nameText.setAttribute("letter-spacing", "0.04em");
      nameText.textContent = shortName;
      tg.appendChild(nameText);

      // 8. Staggered VN / Comic Action Bubble
      if (char.room_action) {
        const bubbleG = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const charIdx = characters.findIndex((c) => c.id === char.id);
        const isStaggered = charIdx % 2 === 1;
        const bubbleY = isStaggered ? -74 : -52;

        const actShort = char.room_action.length > 20 ? char.room_action.slice(0, 18) + ".." : char.room_action;
        const bWidth = Math.min(130, Math.max(84, actShort.length * 5.6 + 16));
        const bubbleX = Math.max(40 + bWidth / 2 - posX, Math.min(760 - bWidth / 2 - posX, 0));

        const bubbleRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bubbleRect.setAttribute("x", bubbleX - bWidth / 2);
        bubbleRect.setAttribute("y", bubbleY);
        bubbleRect.setAttribute("width", bWidth);
        bubbleRect.setAttribute("height", "20");
        bubbleRect.setAttribute("rx", "4");
        bubbleRect.setAttribute("fill", "#fffdf5");
        bubbleRect.setAttribute("stroke", "#c59b48");
        bubbleRect.setAttribute("stroke-width", "1");
        bubbleG.appendChild(bubbleRect);

        // Pointer triangle pointing to token top
        const pointer = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        pointer.setAttribute("points", `-4,${bubbleY + 20} 4,${bubbleY + 20} 0,-27`);
        pointer.setAttribute("fill", "#fffdf5");
        pointer.setAttribute("stroke", "#c59b48");
        pointer.setAttribute("stroke-width", "1");
        bubbleG.appendChild(pointer);

        const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textEl.setAttribute("x", bubbleX);
        textEl.setAttribute("y", bubbleY + 13);
        textEl.setAttribute("text-anchor", "middle");
        textEl.setAttribute("fill", "#291b10");
        textEl.setAttribute("font-family", "'Libre Baskerville', Georgia, serif");
        textEl.setAttribute("font-size", "8.5");
        textEl.setAttribute("font-style", "italic");
        textEl.textContent = `"${actShort}"`;
        bubbleG.appendChild(textEl);

        tg.appendChild(bubbleG);
      }

      // Interactive Click: clicking character pre-selects plant_rumor
      tg.onclick = () => {
        selectVerb("plant_rumor");
        const sel = $("#director-target-select");
        if (sel) sel.value = char.id;
      };

      // Standee Detail Tooltip
      const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
      tip.textContent = `${char.name} (${char.role})\nAt: ${fixture.name}\nAction: ${char.room_action || "Investigating"}\nVoted Exit: Node ${char.voted_exit || "Undecided"}\nHP: ${char.hp}/${char.max_hp} | Stress: ${char.stress}% | Load: ${char.total_weight_kg}kg`;
      tg.appendChild(tip);

      svg.appendChild(tg);
    });
  });
}
function renderCastCards() {
  const container = $("#cast-cards-grid");
  if (!container || !stageState.data) return;

  container.innerHTML = "";
  Object.values(stageState.data.characters).forEach((c) => {
    const cfg = getCharConfig(c.id);
    const card = document.createElement("div");
    card.className = `cast-card ${cfg.class} ${c.is_alive ? "" : "fallen"}`;
    const hpPct = Math.max(0, Math.min(100, Math.round((c.hp / c.max_hp) * 100)));
    const stressPct = Math.max(0, Math.min(100, c.stress));
    const fatiguePct = Math.max(0, Math.min(100, c.fatigue));
    const gear = c.items && c.items.length > 0 ? c.items.join(", ") : "";
    card.title = `${c.name}, ${c.role}\n"${c.flaw}"\nLoad: ${c.total_weight_kg} kg${gear ? "\nGear: " + gear : ""}\nAction: ${c.room_action || "Observing"}`;
    card.innerHTML = `
      <div class="cast-portrait ${cfg.class}" style="background-image: url('${cfg.avatar}');" title="${c.name}"></div>
      <div class="cast-body">
        <strong class="cast-name">${c.name}</strong>
        <div class="cast-bars">
          <div class="vital-track" title="Health ${c.hp}/${c.max_hp}"><div class="vital-bar hp" style="width: ${hpPct}%"></div></div>
          <div class="vital-track" title="Stress ${c.stress}%"><div class="vital-bar stress" style="width: ${stressPct}%"></div></div>
          <div class="vital-track" title="Fatigue ${c.fatigue}%"><div class="vital-bar fatigue" style="width: ${fatiguePct}%"></div></div>
        </div>
        <span class="cast-action">${c.is_alive ? (c.room_action || "Observing") : "Fallen"}</span>
      </div>
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
    label.textContent = "Exit to block";
    if (exits.length > 0) {
      select.innerHTML = exits.map((e) => `
        <option value="${e.target_node}">${e.name} (To Node ${e.target_node})</option>
      `).join("");
    } else {
      select.innerHTML = `<option value="">No exit doors in this final room</option>`;
    }
  } else if (verb === "shift_spotlight") {
    label.textContent = "Light up";
    const fixtureOptions = fixtures.map((f) => `
      <option value="${f.id}">${f.name} [${(f.type || "SET").toUpperCase()}]</option>
    `).join("");
    const exitOptions = exits.map((e) => `
      <option value="${e.target_node}">Exit: ${e.name}</option>
    `).join("");
    select.innerHTML = fixtureOptions + exitOptions;
  } else if (verb === "plant_rumor") {
    label.textContent = "Whisper to";
    const living = Object.values(stageState.data.characters).filter((c) => c.is_alive);
    select.innerHTML = living.map((c) => `
      <option value="${c.id}">${c.name} (${c.role})</option>
    `).join("");
    rumorWrap.hidden = false;
  } else if (verb === "cue_prop") {
    label.textContent = "Place prop";
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

function getTempoDurationMs(tension) {
  const clamped = Math.max(1.0, Math.min(4.0, tension || 2.0));
  return Math.round(5000 - ((clamped - 1.0) / 3.0) * 3800);
}

function startMetronomeLoop() {
  if (stageState.metronomeTimer) clearInterval(stageState.metronomeTimer);
  stageState.metronomeTotalMs = getTempoDurationMs(stageState.tension);
  stageState.metronomeRemainingMs = stageState.metronomeTotalMs;

  stageState.metronomeTimer = setInterval(async () => {
    const isGameOver = stageState.data && (stageState.data.status === "won" || stageState.data.status === "lost");
    if (isGameOver) {
      clearInterval(stageState.metronomeTimer);
      stageState.metronomeTimer = null;
      return;
    }

    if (!stageState.autoPlay || stageState.isProcessing) {
      return;
    }

    stageState.metronomeRemainingMs -= 100;
    if (stageState.metronomeRemainingMs <= 0) {
      stageState.metronomeTotalMs = getTempoDurationMs(stageState.tension);
      stageState.metronomeRemainingMs = stageState.metronomeTotalMs;
      await executeTurnStep();
    }

    updateMetronomeUI();
  }, 100);
}

function updateMetronomeUI() {
  const fill = $("#metronome-fill");
  const countEl = $("#metronome-countdown");
  const autoBtn = $("#stage-autoplay-btn");
  const autoIcon = $("#autoplay-icon");
  const autoLabel = $("#autoplay-label");

  if (autoBtn && autoIcon && autoLabel) {
    if (stageState.autoPlay) {
      autoBtn.classList.add("active");
      autoIcon.innerHTML = "&#10074;&#10074;";
      autoLabel.textContent = "Live Pace";
    } else {
      autoBtn.classList.remove("active");
      autoIcon.innerHTML = "&#9654;";
      autoLabel.textContent = "Paused";
    }
  }

  if (fill) {
    const pct = Math.max(0, Math.min(100, (stageState.metronomeRemainingMs / stageState.metronomeTotalMs) * 100));
    fill.style.width = `${pct}%`;
  }
  if (countEl) {
    countEl.textContent = `${Math.max(0, (stageState.metronomeRemainingMs / 1000)).toFixed(1)}s`;
  }
}

const autoBtn = $("#stage-autoplay-btn");
if (autoBtn) {
  autoBtn.addEventListener("click", () => {
    stageState.autoPlay = !stageState.autoPlay;
    if (stageState.autoPlay && !stageState.metronomeTimer) {
      startMetronomeLoop();
    }
    updateMetronomeUI();
  });
}

const tensionSlider = $("#tension-dial-range");
if (tensionSlider) {
  tensionSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    stageState.tension = val;
    const readout = $("#tension-readout");
    if (readout) {
      let desc = "Andante";
      if (val <= 1.5) desc = "Adagio";
      else if (val <= 2.5) desc = "Moderato";
      else if (val <= 3.5) desc = "Allegro";
      else desc = "Presto";
      readout.textContent = `${val.toFixed(1)} · ${desc}`;
    }
    stageState.metronomeTotalMs = getTempoDurationMs(val);
    stageState.metronomeRemainingMs = Math.min(stageState.metronomeRemainingMs, stageState.metronomeTotalMs);
    updateMetronomeUI();
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

async function executeTurnStep() {
  if (stageState.isProcessing) return;
  const isGameOver = stageState.data && (stageState.data.status === "won" || stageState.data.status === "lost");
  if (isGameOver) return;

  stageState.isProcessing = true;
  const stageTurnBtn = $("#stage-turn-btn");
  if (stageTurnBtn) {
    stageTurnBtn.disabled = true;
    stageTurnBtn.innerHTML = `<span>The cast is acting...</span>`;
  }

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

    // Render Dialogue Stream with 2D character avatar portraits
    const stream = $("#stage-dialogue-stream");
    if (stream && res.script.dialogue) {
      stream.innerHTML = "";
      res.script.dialogue.forEach((d) => {
        const cfg = getCharConfig(d.speaker);
        const card = document.createElement("div");
        card.className = "dialogue-card";
        card.innerHTML = `
          <div class="dialogue-avatar ${cfg.class}" style="background-image: url('${cfg.avatar}');" title="${d.speaker}"></div>
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
        clearTimeout(verifierAlert._dismissTimer);
        verifierAlert._dismissTimer = setTimeout(() => {
          verifierAlert.hidden = true;
        }, 4500);
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
      showStageEnd(true, "The Midnight Express has departed. The cast crossed the border safely.");
    } else if (res.stage_state.status === "lost") {
      showStageEnd(false, "The Wailing Fog claimed the stage. The troupe has fallen.");
    }

  } catch (err) {
    console.error(err);
    showStageToast("The scene failed: " + err.message);
  } finally {
    stageState.isProcessing = false;
    if (stageTurnBtn) {
      stageTurnBtn.disabled = false;
      stageTurnBtn.innerHTML = `<span>Raise Curtain</span>`;
    }
  }
}

const stageTurnBtn = $("#stage-turn-btn");
if (stageTurnBtn) {
  stageTurnBtn.addEventListener("click", async () => {
    stageState.metronomeTotalMs = getTempoDurationMs(stageState.tension);
    stageState.metronomeRemainingMs = stageState.metronomeTotalMs;
    updateMetronomeUI();
    await executeTurnStep();
  });
}

function showStageToast(message) {
  const box = $("#verb-status-msg");
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
  setTimeout(() => { box.hidden = true; }, 4500);
}

function showStageEnd(won, message) {
  const viewport = document.querySelector(".game-viewport");
  if (!viewport) return;
  let overlay = $("#stage-end");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "stage-end";
    viewport.appendChild(overlay);
  }
  overlay.className = `stage-end ${won ? "won" : "lost"}`;
  overlay.innerHTML = `
    <div class="stage-end-card">
      <h2>${won ? "Curtain Call" : "The Play Ends"}</h2>
      <p>${message}</p>
      <button type="button" class="stage-advance-btn" id="stage-end-restart"><span>Play again</span></button>
    </div>`;
  $("#stage-end-restart").addEventListener("click", () => { overlay.remove(); initStageEngine(true); });
}

const stageResetBtn = $("#stage-reset-btn");
if (stageResetBtn) {
  stageResetBtn.addEventListener("click", () => {
    const endOverlay = $("#stage-end");
    if (endOverlay) endOverlay.remove();
    initStageEngine(true);
  });
}

// Initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStageEngine);
} else {
  initStageEngine();
}

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

const STAGE_CHAMBERS_CONFIG = {
  1: { id: 1, name: "Telegraph Office", grid_pos: "top-left", floor: "Upper Level", desc: "Cluttered communications office with brass telegraph key, filing cabinets, and pneumatic tubes." },
  2: { id: 2, name: "Locked Platform Gate", grid_pos: "top-right", floor: "Upper Level", desc: "Heavy iron portcullis bolted shut against the snow, overlooking Midnight Express tracks." },
  3: { id: 3, name: "Grand Waiting Hall", grid_pos: "bottom-left", floor: "Ground Floor", desc: "Marble hall with vaulted timber arches, a glowing coal stove, and a ticking grandfather clock." },
  4: { id: 4, name: "Baggage & Boiler Room", grid_pos: "bottom-right", floor: "Ground Floor", desc: "Dark service basement smelling of grease and steam pipes with roaring furnace and coal chute." },
};

const DEFAULT_STAGE_DATA = {
  scene_number: 1,
  max_scenes: 6,
  director_authority: 4,
  tension_dial: 2.0,
  spotlight_chamber: 3,
  spotlighted_nodes: [3],
  gate_unbolted: false,
  blocked_edges: [],
  curtained_doorways: [],
  edges: [[1, 2], [1, 3], [2, 4], [3, 4]],
  chambers: STAGE_CHAMBERS_CONFIG,
  characters: {
    "Julian": { id: "Julian", name: "Julian Vance", role: "The Archivist", node: 1, hp: 100, max_hp: 100, stress: 10, fatigue: 5, total_weight_kg: 70, is_alive: true, flaw: "Paralyzed by dark uncertainty." },
    "Vesper": { id: "Vesper", name: "Vesper Cross", role: "The Smuggler", node: 4, hp: 100, max_hp: 100, stress: 20, fatigue: 10, total_weight_kg: 175, is_alive: true, flaw: "Takes reckless shortcuts." },
    "Beatrice": { id: "Beatrice", name: "Beatrice Thorne", role: "The Machinist", node: 2, hp: 80, max_hp: 80, stress: 15, fatigue: 20, total_weight_kg: 55, is_alive: true, flaw: "Physically frail on rough ground." },
    "The Curator": { id: "The Curator", name: "The Curator", role: "The Cast Infiltrator", node: 3, hp: 100, max_hp: 100, stress: 0, fatigue: 0, total_weight_kg: 60, is_alive: true, flaw: "Unpredictable stage direction." },
  },
};

const stageState = {
  data: JSON.parse(JSON.stringify(DEFAULT_STAGE_DATA)),
  selectedVerb: "block_route",
  tension: 2.0,
  isProcessing: false,
  autoPlay: false,
  metronomeTimer: null,
  metronomeRemainingMs: 3500,
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

// Archival Folio Evidence Board Drawer Controls
const toggleLedgerBtn = $("#toggle-ledger-btn");
const closeEvidenceDrawerBtn = $("#close-evidence-drawer");
const evidenceBackdrop = $("#evidence-drawer-backdrop");

if (toggleLedgerBtn) {
  toggleLedgerBtn.addEventListener("click", () => {
    const drawer = $("#evidence-drawer");
    const isOpen = drawer && !drawer.hidden && drawer.classList.contains("open");
    if (isOpen) {
      closeEvidenceBoard();
    } else {
      renderEvidenceBoard();
    }
  });
}

if (closeEvidenceDrawerBtn) {
  closeEvidenceDrawerBtn.addEventListener("click", closeEvidenceBoard);
}

if (evidenceBackdrop) {
  evidenceBackdrop.addEventListener("click", closeEvidenceBoard);
}

async function renderEvidenceBoard() {
  const drawer = $("#evidence-drawer");
  const backdrop = $("#evidence-drawer-backdrop");
  if (!drawer || !backdrop) return;

  drawer.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    drawer.classList.add("open");
    backdrop.classList.add("open");
  });

  try {
    const data = await api("/api/stage/evidence");
    if (!data) return;

    // Update Countdown & Portcullis status
    const bellsEl = $("#climax-bells-val");
    if (bellsEl) bellsEl.textContent = `${data.countdown_ticks || 8} Bells`;

    const gateEl = $("#climax-gate-status");
    if (gateEl) {
      if (data.platform_unlocked) {
        gateEl.textContent = "UNBOLTED";
        gateEl.className = "stat-value unbolted";
      } else {
        gateEl.textContent = "PADLOCKED";
        gateEl.className = "stat-value locked";
      }
    }

    // Render Contradictions
    const contraFeed = $("#contradictions-feed");
    const countTag = $("#contradiction-count-tag");
    const contradictions = data.contradictions || [];
    if (countTag) countTag.textContent = `${contradictions.length} Detected`;

    if (contraFeed) {
      if (contradictions.length === 0) {
        contraFeed.innerHTML = `<div class="empty-evidence-msg">No sworn contradictions detected yet. As characters speak and roam, false alibis will be flagged here in crimson.</div>`;
      } else {
        contraFeed.innerHTML = contradictions.map((c) => `
          <div class="contradiction-card">
            <div class="contradiction-header">
              <strong>⚠ CONTRADICTION: ${c.actor.toUpperCase()}</strong>
              <small class="truth-tick">Tick ${c.tick || "?"}</small>
            </div>
            <div class="contradiction-claim">" ${c.claim} "</div>
            <div class="contradiction-reality">Physical Fact: ${c.reality}</div>
          </div>
        `).join("");
      }
    }

    // Render Cast Dossier & Sworn Alibis
    const dossierGrid = $("#cast-dossier-grid");
    if (dossierGrid && data.characters) {
      dossierGrid.innerHTML = Object.entries(data.characters).map(([cid, char]) => {
        const cfg = getCharConfig(cid);
        const alibi = data.alibis[cid] || char.alibi || "No sworn statement entered yet.";
        const chamberName = STAGE_CHAMBERS_CONFIG[char.node]?.name || `Chamber ${char.node}`;
        const items = (char.inventory || []).join(", ");
        return `
          <div class="dossier-card">
            <img class="dossier-avatar" src="${cfg.avatar}" alt="${char.name}">
            <div class="dossier-details">
              <div class="dossier-name-row">
                <strong>${char.name}</strong>
                <span class="dossier-location">${chamberName}</span>
              </div>
              <span class="dossier-role">${char.role} · Stress: ${char.stress}%</span>
              <div class="dossier-alibi">"${alibi}"</div>
              ${items ? `<small style="color: #9c8358; font-size: 10px;">Possessions: ${items}</small>` : ""}
            </div>
          </div>
        `;
      }).join("");
    }

    // Render Physical Truth Log
    const truthLog = $("#physical-truth-log");
    const physicalFacts = data.physical_truth || data.physical_facts || [];
    if (truthLog) {
      if (physicalFacts.length === 0) {
        truthLog.innerHTML = `<div class="empty-evidence-msg">Station ledger is silent. Physical traces will be logged here.</div>`;
      } else {
        truthLog.innerHTML = physicalFacts.slice().reverse().map((fact) => {
          const chamberName = STAGE_CHAMBERS_CONFIG[fact.room]?.name || `Chamber ${fact.room}`;
          return `
            <div class="truth-entry ${fact.is_crime ? "crime" : ""}">
              <span class="truth-tick">Tick ${fact.tick}</span>
              <span><strong>${fact.actor}</strong> at ${chamberName} (${fact.fixture || "area"}): ${fact.action}</span>
            </div>
          `;
        }).join("");
      }
    }
  } catch (err) {
    console.error("Failed to fetch evidence board:", err);
  }
}

function closeEvidenceBoard() {
  const drawer = $("#evidence-drawer");
  const backdrop = $("#evidence-drawer-backdrop");
  if (drawer) drawer.classList.remove("open");
  if (backdrop) backdrop.classList.remove("open");
  setTimeout(() => {
    if (drawer) drawer.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }, 350);
}

// Accusation Button Handler
const submitAccuseBtn = $("#submit-accusation-btn");
if (submitAccuseBtn) {
  submitAccuseBtn.addEventListener("click", async () => {
    const suspectSelect = $("#accuse-suspect-select");
    const suspectId = suspectSelect ? suspectSelect.value : "Julian";
    const banner = $("#accusation-result-banner");
    try {
      submitAccuseBtn.disabled = true;
      submitAccuseBtn.textContent = "Confronting...";
      const res = await api("/api/stage/accuse", { suspect_id: suspectId });
      if (banner) {
        banner.hidden = false;
        banner.className = "accusation-banner success";
        banner.textContent = res.message;
      }
      if (res.stage_state && res.stage_state.status === "won") {
        closeEvidenceBoard();
        showStageEnd(true, res.message);
      }
    } catch (err) {
      if (banner) {
        banner.hidden = false;
        banner.className = "accusation-banner failure";
        banner.textContent = err.message || "The accusation failed!";
      }
    } finally {
      submitAccuseBtn.disabled = false;
      submitAccuseBtn.textContent = "Drop Spotlight & Accuse";
      renderEvidenceBoard();
    }
  });
}

async function applyDirectorVerb(verb, target) {
  try {
    if (verb === "block_route" && typeof target === "string" && target.includes(",")) {
      target = target.split(",").map(Number);
    }
    const res = await api("/api/stage/director_action", { verb, target });
    stageState.data = res.stage_state;
    renderStageBoard();
    renderCastCards();
    showStageToast(res.message);
  } catch (err) {
    showStageToast(err.message);
  }
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
    updateMetronomeUI();
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
  const spotlightId = stageState.data.spotlight_chamber || 1;
  ribbon.innerHTML = "";

  [1, 2, 3, 4].forEach((cid, idx) => {
    const chamber = STAGE_CHAMBERS_CONFIG[cid] || { name: `Chamber ${cid}` };
    const isActive = cid === currentId;
    const isLit = cid === spotlightId;

    const nodeEl = document.createElement("div");
    let stateClass = "";
    if (isActive) stateClass = "active";
    if (isLit) stateClass += " spotlighted";

    nodeEl.className = `ribbon-node ${stateClass}`.trim();
    nodeEl.title = `${chamber.name} [Click to train Spotlight]`;
    nodeEl.style.cursor = "pointer";

    nodeEl.innerHTML = `
      <span class="ribbon-badge">${cid}</span>
      <span class="ribbon-title">${chamber.name.split(" ")[0]}</span>
      ${isLit ? `<span style="color:#fcd34d;font-size:10px;">✦</span>` : ""}
    `;

    nodeEl.onclick = async () => {
      await applyDirectorVerb("shift_spotlight", cid);
    };

    ribbon.appendChild(nodeEl);

    if (idx < 3) {
      const arrow = document.createElement("span");
      arrow.className = "ribbon-arrow";
      arrow.innerHTML = "&harr;";
      ribbon.appendChild(arrow);
    }
  });
}

function renderRoomInfo() {
  const spotlightId = stageState.data.spotlight_chamber || (stageState.data.spotlighted_nodes && stageState.data.spotlighted_nodes[0]) || 1;
  const spotChamber = STAGE_CHAMBERS_CONFIG[spotlightId] || { name: `Chamber ${spotlightId}` };
  const actTag = $("#room-act-tag");
  const titleName = $("#room-title-name");
  const descText = $("#room-desc-text");
  const progressPct = $("#room-progress-pct");
  const progressFill = $("#room-progress-fill");
  const consensusHint = $("#room-consensus-status");

  if (actTag) actTag.textContent = `SCENE ${stageState.data.scene_number || 1}`;
  if (titleName) titleName.textContent = `Spotlight: Chamber ${spotlightId} · ${spotChamber.name}`;
  if (descText) descText.textContent = spotChamber.desc || "The cast roams the 2x2 Victorian dollhouse stage.";

  const pct = Math.max(5, Math.min(100, Math.round(((stageState.data.scene_number || 1) / (stageState.data.max_scenes || 6)) * 100)));
  if (progressPct) progressPct.textContent = `${pct}%`;
  if (progressFill) progressFill.style.width = `${pct}%`;

  if (consensusHint) {
    if (stageState.data.gate_unbolted) {
      consensusHint.textContent = "Platform Gate UNBOLTED! Board the Midnight Express before fog descends.";
    } else {
      const livingCount = Object.values(stageState.data.characters || {}).filter((c) => c.is_alive).length;
      consensusHint.textContent = `${livingCount} actors roaming 4 chambers. Spotlight trained on Chamber ${spotlightId}.`;
    }
  }
}

function renderRoomStageSVG() {
  const svg = $("#stage-svg");
  if (!svg || !stageState.data) return;

  const data = stageState.data;
  const spotlightChamber = data.spotlight_chamber || (data.spotlighted_nodes && data.spotlighted_nodes[0]) || 1;
  const blocked = data.blocked_edges || [];
  const curtained = data.curtained_doorways || [];
  const characters = Object.values(data.characters || {});
  const gateUnbolted = Boolean(data.gate_unbolted);
  const fixtureProps = data.fixture_props || {};

  function isDoorCurtained(u, v) {
    return blocked.some((e) => (e[0] === u && e[1] === v) || (e[0] === v && e[1] === u)) ||
           curtained.some((e) => (e[0] === u && e[1] === v) || (e[0] === v && e[1] === u));
  }

  // Generate Stage Footlights along stage apron (y = 428)
  const footlights = [60, 130, 200, 270, 340, 410, 480, 550, 620, 690, 760].map((fx) => `
    <circle cx="${fx}" cy="426" r="4" fill="#fcd34d" filter="url(#glow-amber)" />
    <circle cx="${fx}" cy="426" r="2.2" fill="#fffef0" />
    <polygon points="${fx - 20},430 ${fx},380 ${fx + 20},430" fill="#fef3c7" opacity="0.05" />
  `).join("");

  svg.innerHTML = `
    <defs>
      <!-- Atmospheric Gradients & Glows -->
      <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <filter id="standee-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.5 0"/>
      </filter>

      <!-- Limelight Radial Wash for Lit Chamber -->
      <radialGradient id="limelight-chamber-wash" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="#fffdf0" stop-opacity="0.24" />
        <stop offset="45%" stop-color="#fde68a" stop-opacity="0.14" />
        <stop offset="80%" stop-color="#b45309" stop-opacity="0.04" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.0" />
      </radialGradient>

      <!-- Velvet Drapery Gradient -->
      <linearGradient id="velvet-fold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b0d11" />
        <stop offset="25%" stop-color="#6e151c" />
        <stop offset="50%" stop-color="#4a0f14" />
        <stop offset="75%" stop-color="#7a1820" />
        <stop offset="100%" stop-color="#2d080b" />
      </linearGradient>

      <!-- Antique Brass Plaque Texture -->
      <linearGradient id="brass-plaque" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ecd599" />
        <stop offset="50%" stop-color="#c59b48" />
        <stop offset="100%" stop-color="#8a6421" />
      </linearGradient>

      <!-- Wall Gradients per Chamber -->
      <linearGradient id="wall-telegraph" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1c1611" />
        <stop offset="60%" stop-color="#241c16" />
        <stop offset="100%" stop-color="#16110d" />
      </linearGradient>

      <linearGradient id="wall-gate" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f1620" />
        <stop offset="60%" stop-color="#141c26" />
        <stop offset="100%" stop-color="#0b1017" />
      </linearGradient>

      <linearGradient id="wall-hall" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#201712" />
        <stop offset="60%" stop-color="#281e17" />
        <stop offset="100%" stop-color="#17110c" />
      </linearGradient>

      <linearGradient id="wall-boiler" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#17120e" />
        <stop offset="60%" stop-color="#1e1712" />
        <stop offset="100%" stop-color="#110d0a" />
      </linearGradient>

      <!-- 2D Character Token Circular Clip -->
      <clipPath id="token-clip-circle">
        <circle cx="0" cy="0" r="19" />
      </clipPath>
    </defs>

    <!-- STAGE BASE: Outer Dark Backdrop -->
    <rect x="0" y="0" width="840" height="440" fill="#0c0906" />

    <!-- ================================================================= -->
    <!-- 2X2 DOLLHOUSE CHAMBERS                                            -->
    <!-- ================================================================= -->

    <!-- Chamber 1: Telegraph Office (Top-Left) -->
    <g id="chamber-1-group" class="room-chamber ${spotlightChamber === 1 ? 'room-lit' : 'room-unlit'}" data-chamber="1">
      <rect x="24" y="36" width="388" height="180" fill="url(#wall-telegraph)" stroke="${spotlightChamber === 1 ? '#fcd34d' : '#3a2b1c'}" stroke-width="${spotlightChamber === 1 ? '2' : '1'}" rx="3" />
      <!-- Wainscoting and Floorboards -->
      <line x1="24" y1="165" x2="412" y2="165" stroke="#4a3622" stroke-width="1.5" />
      <rect x="24" y="165" width="388" height="51" fill="#241a12" opacity="0.8" />
      <line x1="24" y1="190" x2="412" y2="190" stroke="#1c140d" stroke-width="1" />
      <!-- Chamber Header Banner -->
      <rect x="34" y="44" width="220" height="17" fill="#150f0a" rx="2" stroke="#5a4228" stroke-width="0.8" />
      <text x="42" y="56" fill="${spotlightChamber === 1 ? '#fde68a' : '#9c8358'}" font-family="'Cinzel', Georgia, serif" font-size="8" font-weight="700" letter-spacing="0.05em">
        CHAMBER 1 · TELEGRAPH OFFICE ${spotlightChamber === 1 ? '✦ GAZE' : ''}
      </text>

      <!-- Set Pieces: Telegraph Desk & Key -->
      <rect x="75" y="142" width="56" height="24" rx="2" fill="#382415" stroke="#8a5a2a" stroke-width="1" />
      <rect x="85" y="136" width="16" height="6" fill="#fcd34d" rx="1" />
      <circle cx="93" cy="133" r="3.5" fill="#fcd34d" />
      <!-- Green Banker Lamp -->
      <path d="M 115 138 C 115 132, 126 132, 126 138 Z" fill="#10b981" stroke="#047857" stroke-width="0.8" />
      <line x1="120" y1="138" x2="120" y2="142" stroke="#c59b48" stroke-width="1.5" />

      <!-- Set Pieces: Filing Cabinets -->
      <rect x="325" y="105" width="50" height="60" rx="2" fill="#2c1c11" stroke="#6a4522" stroke-width="1.2" />
      <line x1="325" y1="125" x2="375" y2="125" stroke="#170f09" stroke-width="1" />
      <line x1="325" y1="145" x2="375" y2="145" stroke="#170f09" stroke-width="1" />
      <rect x="344" y="113" width="12" height="4" fill="#fcd34d" rx="1" />
      <rect x="344" y="133" width="12" height="4" fill="#fcd34d" rx="1" />
      <rect x="344" y="153" width="12" height="4" fill="#fcd34d" rx="1" />

      <!-- Pneumatic Tube on Wall -->
      <line x1="220" y1="36" x2="220" y2="110" stroke="#c59b48" stroke-width="2.5" />
      <rect x="214" y="105" width="12" height="18" rx="2" fill="#ecd599" stroke="#5a3d1c" stroke-width="1" />

      <!-- Limelight Wash if Lit -->
      ${spotlightChamber === 1 ? `<circle cx="218" cy="126" r="140" fill="url(#limelight-chamber-wash)" pointer-events="none" />` : `<rect x="24" y="36" width="388" height="180" fill="#040302" opacity="0.65" pointer-events="none" />`}
    </g>

    <!-- Chamber 2: Locked Platform Gate (Top-Right) -->
    <g id="chamber-2-group" class="room-chamber ${spotlightChamber === 2 ? 'room-lit' : 'room-unlit'}" data-chamber="2">
      <rect x="428" y="36" width="388" height="180" fill="url(#wall-gate)" stroke="${spotlightChamber === 2 ? '#fcd34d' : '#3a2b1c'}" stroke-width="${spotlightChamber === 2 ? '2' : '1'}" rx="3" />
      <!-- Mountain Fog Window Arch -->
      <path d="M 590 120 L 590 65 A 35 35 0 0 1 660 65 L 660 120 Z" fill="#09131d" stroke="#253545" stroke-width="1.5" />
      <circle cx="615" cy="80" r="1.5" fill="#e2e8f0" opacity="0.6" />
      <circle cx="640" cy="95" r="1.5" fill="#e2e8f0" opacity="0.6" />
      <!-- Wainscoting and Floorboards -->
      <line x1="428" y1="165" x2="816" y2="165" stroke="#2a3845" stroke-width="1.5" />
      <rect x="428" y="165" width="388" height="51" fill="#141a22" opacity="0.8" />
      <line x1="428" y1="190" x2="816" y2="190" stroke="#0e1319" stroke-width="1" />
      <!-- Chamber Header Banner -->
      <rect x="438" y="44" width="240" height="17" fill="#0d141b" rx="2" stroke="#35495b" stroke-width="0.8" />
      <text x="446" y="56" fill="${spotlightChamber === 2 ? '#fde68a' : '#829bb0'}" font-family="'Cinzel', Georgia, serif" font-size="8" font-weight="700" letter-spacing="0.05em">
        CHAMBER 2 · LOCKED PLATFORM GATE ${spotlightChamber === 2 ? '✦ GAZE' : ''}
      </text>

      <!-- Set Pieces: Track Portcullis & Padlock -->
      <g class="fixture-portcullis" style="cursor: pointer;" title="Platform Portcullis: ${gateUnbolted ? 'Unbolted' : 'Padlocked'}">
        <rect x="495" y="80" width="65" height="85" fill="none" stroke="#374151" stroke-width="2.5" />
        <line x1="510" y1="80" x2="510" y2="165" stroke="#4b5563" stroke-width="2" />
        <line x1="525" y1="80" x2="525" y2="165" stroke="#4b5563" stroke-width="2" />
        <line x1="540" y1="80" x2="540" y2="165" stroke="#4b5563" stroke-width="2" />
        <!-- Padlock Badge -->
        <rect x="515" y="125" width="28" height="20" rx="3" fill="${gateUnbolted ? '#064e3b' : '#7f1d1d'}" stroke="${gateUnbolted ? '#10b981' : '#ef4444'}" stroke-width="1.2" />
        <text x="529" y="138" text-anchor="middle" fill="#fff" font-family="'DM Mono', monospace" font-size="6.5" font-weight="700">
          ${gateUnbolted ? 'OPEN' : 'LOCK'}
        </text>
      </g>

      <!-- Signal Switch Levers -->
      <rect x="735" y="130" width="45" height="35" rx="2" fill="#1e293b" stroke="#475569" stroke-width="1" />
      <line x1="748" y1="130" x2="744" y2="114" stroke="#ef4444" stroke-width="2.5" />
      <circle cx="744" cy="114" r="3" fill="#ef4444" />
      <line x1="765" y1="130" x2="768" y2="114" stroke="#10b981" stroke-width="2.5" />
      <circle cx="768" cy="114" r="3" fill="#10b981" />

      <!-- Observation Lantern Post -->
      <line x1="640" y1="165" x2="640" y2="120" stroke="#c59b48" stroke-width="2" />
      <circle cx="640" cy="118" r="5" fill="#fef08a" filter="url(#glow-amber)" />

      <!-- Limelight Wash if Lit -->
      ${spotlightChamber === 2 ? `<circle cx="622" cy="126" r="140" fill="url(#limelight-chamber-wash)" pointer-events="none" />` : `<rect x="428" y="36" width="388" height="180" fill="#040302" opacity="0.65" pointer-events="none" />`}
    </g>

    <!-- Chamber 3: Grand Waiting Hall (Bottom-Left) -->
    <g id="chamber-3-group" class="room-chamber ${spotlightChamber === 3 ? 'room-lit' : 'room-unlit'}" data-chamber="3">
      <rect x="24" y="226" width="388" height="180" fill="url(#wall-hall)" stroke="${spotlightChamber === 3 ? '#fcd34d' : '#3a2b1c'}" stroke-width="${spotlightChamber === 3 ? '2' : '1'}" rx="3" />
      <!-- Wainscoting and Marble Floor -->
      <line x1="24" y1="355" x2="412" y2="355" stroke="#5a3d24" stroke-width="1.5" />
      <rect x="24" y="355" width="388" height="51" fill="#2b1f15" opacity="0.8" />
      <line x1="24" y1="380" x2="412" y2="380" stroke="#1c140d" stroke-width="1" />
      <!-- Chamber Header Banner -->
      <rect x="34" y="234" width="240" height="17" fill="#160f0a" rx="2" stroke="#634526" stroke-width="0.8" />
      <text x="42" y="246" fill="${spotlightChamber === 3 ? '#fde68a' : '#baa378'}" font-family="'Cinzel', Georgia, serif" font-size="8" font-weight="700" letter-spacing="0.05em">
        CHAMBER 3 · GRAND WAITING HALL ${spotlightChamber === 3 ? '✦ GAZE' : ''}
      </text>

      <!-- Set Pieces: Cast-Iron Coal Stove -->
      <g class="fixture-stove">
        <!-- Chimney Flue -->
        <line x1="105" y1="345" x2="105" y2="226" stroke="#1a120c" stroke-width="4.5" />
        <!-- Stove Belly -->
        <ellipse cx="105" cy="350" rx="18" ry="14" fill="#221811" stroke="#6e4624" stroke-width="1.5" />
        <!-- Glowing Ember Grate -->
        <rect x="98" y="346" width="14" height="8" rx="1.5" fill="#f59e0b" filter="url(#glow-amber)" />
        <line x1="102" y1="346" x2="102" y2="354" stroke="#78350f" stroke-width="1" />
        <line x1="108" y1="346" x2="108" y2="354" stroke="#78350f" stroke-width="1" />
        <!-- Stove Legs -->
        <line x1="93" y1="362" x2="90" y2="370" stroke="#1c130b" stroke-width="2.5" />
        <line x1="117" y1="362" x2="120" y2="370" stroke="#1c130b" stroke-width="2.5" />
      </g>

      <!-- Grandfather Clock -->
      <g class="fixture-clock">
        <rect x="204" y="270" width="22" height="85" fill="#2d1b10" stroke="#8a5b28" stroke-width="1.2" rx="1" />
        <circle cx="215" cy="285" r="7.5" fill="#fffdf0" stroke="#8a5b28" stroke-width="1" />
        <line x1="215" y1="285" x2="215" y2="280" stroke="#170f0a" stroke-width="1" />
        <line x1="215" y1="285" x2="219" y2="285" stroke="#170f0a" stroke-width="1" />
        <!-- Pendulum -->
        <line x1="215" y1="295" x2="215" y2="330" stroke="#c59b48" stroke-width="1.2" />
        <circle cx="215" cy="332" r="3.5" fill="#fcd34d" />
      </g>

      <!-- Velvet Settee Bench -->
      <rect x="320" y="342" width="60" height="18" rx="3" fill="#6b1720" stroke="#991b1b" stroke-width="1" />
      <line x1="326" y1="360" x2="326" y2="368" stroke="#331014" stroke-width="2" />
      <line x1="374" y1="360" x2="374" y2="368" stroke="#331014" stroke-width="2" />

      <!-- Luggage Heap -->
      <rect x="275" y="358" width="24" height="14" rx="2" fill="#58381e" stroke="#8a5a2a" stroke-width="1" />
      <rect x="285" y="350" width="18" height="10" rx="1.5" fill="#422915" stroke="#6e4624" stroke-width="0.8" />

      <!-- Limelight Wash if Lit -->
      ${spotlightChamber === 3 ? `<circle cx="218" cy="316" r="140" fill="url(#limelight-chamber-wash)" pointer-events="none" />` : `<rect x="24" y="226" width="388" height="180" fill="#040302" opacity="0.65" pointer-events="none" />`}
    </g>

    <!-- Chamber 4: Baggage & Boiler Room (Bottom-Right) -->
    <g id="chamber-4-group" class="room-chamber ${spotlightChamber === 4 ? 'room-lit' : 'room-unlit'}" data-chamber="4">
      <rect x="428" y="226" width="388" height="180" fill="url(#wall-boiler)" stroke="${spotlightChamber === 4 ? '#fcd34d' : '#3a2b1c'}" stroke-width="${spotlightChamber === 4 ? '2' : '1'}" rx="3" />
      <!-- Wainscoting and Stone Floor -->
      <line x1="428" y1="355" x2="816" y2="355" stroke="#3a2e22" stroke-width="1.5" />
      <rect x="428" y="355" width="388" height="51" fill="#191410" opacity="0.8" />
      <line x1="428" y1="380" x2="816" y2="380" stroke="#120e0b" stroke-width="1" />
      <!-- Chamber Header Banner -->
      <rect x="438" y="234" width="260" height="17" fill="#130e0a" rx="2" stroke="#50371f" stroke-width="0.8" />
      <text x="446" y="246" fill="${spotlightChamber === 4 ? '#fde68a' : '#8f7a63'}" font-family="'Cinzel', Georgia, serif" font-size="8" font-weight="700" letter-spacing="0.05em">
        CHAMBER 4 · BAGGAGE & BOILER ROOM ${spotlightChamber === 4 ? '✦ GAZE' : ''}
      </text>

      <!-- Overhead Steam Pipe -->
      <line x1="428" y1="255" x2="816" y2="255" stroke="#523c28" stroke-width="3" />
      <circle cx="580" cy="255" r="4" fill="#a16207" />

      <!-- High-Pressure Steam Furnace Boiler -->
      <g class="fixture-boiler">
        <rect x="500" y="295" width="65" height="60" rx="4" fill="#251a13" stroke="#684729" stroke-width="1.5" />
        <!-- Rivets -->
        <circle cx="506" cy="302" r="1.2" fill="#c59b48" />
        <circle cx="559" cy="302" r="1.2" fill="#c59b48" />
        <circle cx="506" cy="348" r="1.2" fill="#c59b48" />
        <circle cx="559" cy="348" r="1.2" fill="#c59b48" />
        <!-- Fire Door Hatch -->
        <rect x="518" y="320" width="30" height="24" rx="2" fill="#dc2626" stroke="#991b1b" stroke-width="1" filter="url(#glow-amber)" />
        <line x1="524" y1="324" x2="542" y2="324" stroke="#450a0a" stroke-width="1.5" />
        <line x1="524" y1="332" x2="542" y2="332" stroke="#450a0a" stroke-width="1.5" />
        <!-- Steam Pressure Dial -->
        <circle cx="533" cy="308" r="6" fill="#fff" stroke="#1f150e" stroke-width="1" />
        <line x1="533" y1="308" x2="536" y2="304" stroke="#ef4444" stroke-width="1.2" />
      </g>

      <!-- Deep Coal Chute -->
      <polygon points="730,310 765,310 755,355 720,355" fill="#120c08" stroke="#47321e" stroke-width="1.2" />
      <!-- Coal Heap -->
      <ellipse cx="738" cy="364" rx="20" ry="7" fill="#080604" stroke="#1f1812" stroke-width="1" />
      <!-- Shovel -->
      <line x1="755" y1="345" x2="762" y2="368" stroke="#71717a" stroke-width="2" />
      <polygon points="760,366 767,364 765,372 758,373" fill="#3f3f46" />

      <!-- Machinist Toolbench -->
      <rect x="630" y="340" width="55" height="20" rx="1.5" fill="#3b2718" stroke="#784e27" stroke-width="1" />
      <line x1="638" y1="360" x2="638" y2="370" stroke="#1f140c" stroke-width="2.5" />
      <line x1="677" y1="360" x2="677" y2="370" stroke="#1f140c" stroke-width="2.5" />
      <!-- Spanner on Bench -->
      <line x1="645" y1="337" x2="660" y2="337" stroke="#cbd5e1" stroke-width="1.8" />

      <!-- Smuggler Freight Crate with Broken Seal -->
      <rect x="698" y="354" width="22" height="18" fill="#4d321c" stroke="#8a5a2a" stroke-width="1" />
      <line x1="698" y1="354" x2="720" y2="372" stroke="#2b1c10" stroke-width="1" />
      <circle cx="709" cy="363" r="3" fill="#b91c1c" stroke="#fca5a5" stroke-width="0.5" />

      <!-- Limelight Wash if Lit -->
      ${spotlightChamber === 4 ? `<circle cx="622" cy="316" r="140" fill="url(#limelight-chamber-wash)" pointer-events="none" />` : `<rect x="428" y="226" width="388" height="180" fill="#040302" opacity="0.65" pointer-events="none" />`}
    </g>

    <!-- ================================================================= -->
    <!-- STRUCTURAL DIVIDERS & PROSCENIUM FRAME                           -->
    <!-- ================================================================= -->

    <!-- Center Vertical Load-Bearing Divider -->
    <rect x="412" y="36" width="16" height="370" fill="#201711" stroke="#3d2b1c" stroke-width="1" />
    <line x1="420" y1="36" x2="420" y2="406" stroke="#c59b48" stroke-width="1" stroke-dasharray="8 6" />

    <!-- Horizontal Floor Divider (Upper / Lower Separator) -->
    <rect x="24" y="216" width="792" height="10" fill="#2b1d12" stroke="#4d3721" stroke-width="1" />
    <line x1="24" y1="221" x2="816" y2="221" stroke="#c59b48" stroke-width="1" />

    <!-- Left Fluted Pilaster Column -->
    <rect x="0" y="0" width="24" height="440" fill="#2b1c12" stroke="#442c1c" stroke-width="1.2" />
    <line x1="12" y1="30" x2="12" y2="420" stroke="#c59b48" stroke-width="1.8" stroke-dasharray="10 8" />
    <rect x="0" y="28" width="24" height="8" fill="url(#brass-plaque)" />
    <rect x="0" y="404" width="24" height="12" fill="url(#brass-plaque)" />

    <!-- Right Fluted Pilaster Column -->
    <rect x="816" y="0" width="24" height="440" fill="#2b1c12" stroke="#442c1c" stroke-width="1.2" />
    <line x1="828" y1="30" x2="828" y2="420" stroke="#c59b48" stroke-width="1.8" stroke-dasharray="10 8" />
    <rect x="816" y="28" width="24" height="8" fill="url(#brass-plaque)" />
    <rect x="816" y="404" width="24" height="12" fill="url(#brass-plaque)" />

    <!-- Proscenium Arch Drapery Valance (Top) -->
    <path d="M 0,0 L 840,0 L 840,32 C 760,38 700,28 630,32 C 560,38 490,28 420,32 C 350,38 280,28 210,32 C 140,38 70,28 0,32 Z" fill="url(#velvet-fold)" />
    <path d="M 0,32 C 70,28 140,38 210,32 C 280,28 350,38 420,32 C 490,28 560,38 630,32 C 700,28 760,38 840,32" stroke="#c59b48" stroke-width="2" fill="none" />
    <circle cx="105" cy="40" r="3" fill="#fcd34d" />
    <circle cx="315" cy="40" r="3" fill="#fcd34d" />
    <circle cx="525" cy="40" r="3" fill="#fcd34d" />
    <circle cx="735" cy="40" r="3" fill="#fcd34d" />

    <!-- Bottom Stage Apron & Brass Footlights Rim -->
    <rect x="0" y="416" width="840" height="24" fill="#140e08" stroke="#3a2510" stroke-width="1" />
    <rect x="0" y="416" width="840" height="4" fill="url(#brass-plaque)" />
    ${footlights}
  `;

  // =========================================================================
  // 4 CONNECTING DOORWAYS & VELVET DROP CURTAINS
  // =========================================================================

  const doorways = [
    {
      id: "door-1-2",
      edge: [1, 2],
      name: "East Corridor (Chamber 1 <-> Chamber 2)",
      x: 405, y: 95, width: 30, height: 62,
      isVertical: false,
    },
    {
      id: "stairs-1-3",
      edge: [1, 3],
      name: "Spiral Staircase (Chamber 1 <-> Chamber 3)",
      x: 180, y: 204, width: 62, height: 26,
      isVertical: true,
    },
    {
      id: "door-3-4",
      edge: [3, 4],
      name: "Double Service Doors (Chamber 3 <-> Chamber 4)",
      x: 405, y: 285, width: 30, height: 62,
      isVertical: false,
    },
    {
      id: "ladder-2-4",
      edge: [2, 4],
      name: "Service Ladder (Chamber 2 <-> Chamber 4)",
      x: 620, y: 204, width: 62, height: 26,
      isVertical: true,
    },
  ];

  doorways.forEach((d) => {
    const isCurtained = isDoorCurtained(d.edge[0], d.edge[1]);
    const dg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dg.setAttribute("class", "doorway-group");
    dg.setAttribute("style", "cursor: pointer;");

    if (isCurtained) {
      // Render Dropped Heavy Velvet Curtain
      const curtain = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      curtain.setAttribute("x", d.x - 4);
      curtain.setAttribute("y", d.y - 4);
      curtain.setAttribute("width", d.width + 8);
      curtain.setAttribute("height", d.height + 8);
      curtain.setAttribute("rx", "2");
      curtain.setAttribute("fill", "url(#velvet-fold)");
      curtain.setAttribute("stroke", "#881e28");
      curtain.setAttribute("stroke-width", "1.5");
      dg.appendChild(curtain);

      // Gold bullion bottom fringe
      const fringe = document.createElementNS("http://www.w3.org/2000/svg", "line");
      fringe.setAttribute("x1", d.x - 4);
      fringe.setAttribute("y1", d.y + d.height + 4);
      fringe.setAttribute("x2", d.x + d.width + 4);
      fringe.setAttribute("y2", d.y + d.height + 4);
      fringe.setAttribute("stroke", "#fcd34d");
      fringe.setAttribute("stroke-width", "2.5");
      dg.appendChild(fringe);

      // Wax Seal Badge
      const sealG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const sealX = d.x + d.width / 2;
      const sealY = d.y + d.height / 2;
      const sealRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      sealRect.setAttribute("x", sealX - 26);
      sealRect.setAttribute("y", sealY - 8);
      sealRect.setAttribute("width", "52");
      sealRect.setAttribute("height", "16");
      sealRect.setAttribute("rx", "3");
      sealRect.setAttribute("fill", "#781c24");
      sealRect.setAttribute("stroke", "#fcd34d");
      sealRect.setAttribute("stroke-width", "1");
      sealG.appendChild(sealRect);

      const sealText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      sealText.setAttribute("x", sealX);
      sealText.setAttribute("y", sealY + 3);
      sealText.setAttribute("text-anchor", "middle");
      sealText.setAttribute("fill", "#fef3c7");
      sealText.setAttribute("font-family", "'DM Mono', monospace");
      sealText.setAttribute("font-size", "7");
      sealText.setAttribute("font-weight", "700");
      sealText.textContent = "SEALED";
      sealG.appendChild(sealText);
      dg.appendChild(sealG);

    } else {
      // Render Open Doorway / Passage
      const openRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      openRect.setAttribute("x", d.x);
      openRect.setAttribute("y", d.y);
      openRect.setAttribute("width", d.width);
      openRect.setAttribute("height", d.height);
      openRect.setAttribute("fill", "#0b0805");
      openRect.setAttribute("stroke", "#c59b48");
      openRect.setAttribute("stroke-width", "1");
      openRect.setAttribute("stroke-dasharray", "3 2");
      dg.appendChild(openRect);

      if (d.isVertical) {
        // Steps indicator
        for (let sx = d.x + 8; sx < d.x + d.width - 6; sx += 12) {
          const stepLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          stepLine.setAttribute("x1", sx);
          stepLine.setAttribute("y1", d.y + 4);
          stepLine.setAttribute("x2", sx);
          stepLine.setAttribute("y2", d.y + d.height - 4);
          stepLine.setAttribute("stroke", "#5a452d");
          stepLine.setAttribute("stroke-width", "1.5");
          dg.appendChild(stepLine);
        }
      }

      const passArrow = document.createElementNS("http://www.w3.org/2000/svg", "text");
      passArrow.setAttribute("x", d.x + d.width / 2);
      passArrow.setAttribute("y", d.y + d.height / 2 + 3);
      passArrow.setAttribute("text-anchor", "middle");
      passArrow.setAttribute("fill", "#94a3b8");
      passArrow.setAttribute("font-size", "10");
      passArrow.setAttribute("font-weight", "700");
      passArrow.textContent = d.isVertical ? "↕" : "↔";
      dg.appendChild(passArrow);
    }

    const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
    tip.textContent = `${d.name}
Status: ${isCurtained ? 'Velvet Curtain Sealed' : 'Open Passageway'}
[Click to toggle Velvet Curtain]`;
    dg.appendChild(tip);

    dg.onclick = async (e) => {
      e.stopPropagation();
      await applyDirectorVerb("block_route", d.edge);
    };

    svg.appendChild(dg);
  });

  // Chamber Background Clicks: Shift Spotlight
  [1, 2, 3, 4].forEach((cid) => {
    const el = $(`#chamber-1-group, #chamber-2-group, #chamber-3-group, #chamber-4-group`.split(", ")[cid - 1]);
    if (el) {
      el.onclick = async (e) => {
        if (e.target.closest(".char-standee-group") || e.target.closest(".doorway-group") || e.target.closest(".fixture-portcullis")) return;
        await applyDirectorVerb("shift_spotlight", cid);
      };
    }
  });

  // =========================================================================
  // 5 REVERSE: 1999 2D TOKEN MODELS IN 2X2 DOLLHOUSE CHAMBERS
  // =========================================================================

  const chamberConfigs = {
    1: { floorY: 178, centerX: 218, name: "Telegraph Office" },
    2: { floorY: 178, centerX: 622, name: "Locked Platform Gate" },
    3: { floorY: 368, centerX: 218, name: "Grand Waiting Hall" },
    4: { floorY: 368, centerX: 622, name: "Baggage & Boiler Room" },
  };

  [1, 2, 3, 4].forEach((cid) => {
    const cConf = chamberConfigs[cid];
    const isLit = (cid === spotlightChamber);
    const charsInChamber = characters.filter((c) => c.is_alive && (c.node === cid || (!c.node && cid === 1)));
    const count = charsInChamber.length;

    charsInChamber.forEach((char, idx) => {
      const cfg = getCharConfig(char.id);
      const offset = (idx - (count - 1) / 2) * 58;
      const posX = cConf.centerX + offset;
      const posY = cConf.floorY;

      const tg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const standeeClass = isLit ? "char-spotlighted" : "char-silhouette";
      tg.setAttribute("class", `char-standee-group ${standeeClass}`);
      tg.setAttribute("data-char-id", char.id);
      tg.setAttribute("transform", `translate(${posX}, ${posY})`);
      tg.setAttribute("style", `transform: translate(${posX}px, ${posY}px); cursor: pointer;`);

      // 1. Shadow on floor
      const shadow = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      shadow.setAttribute("cx", "0");
      shadow.setAttribute("cy", "22");
      shadow.setAttribute("rx", "20");
      shadow.setAttribute("ry", "6");
      shadow.setAttribute("fill", "#000");
      shadow.setAttribute("opacity", "0.45");
      shadow.setAttribute("filter", "url(#standee-shadow)");
      tg.appendChild(shadow);

      // 2. Brass pedestal base
      const standBase = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      standBase.setAttribute("cx", "0");
      standBase.setAttribute("cy", "20");
      standBase.setAttribute("rx", "18");
      standBase.setAttribute("ry", "5");
      standBase.setAttribute("fill", "url(#brass-plaque)");
      standBase.setAttribute("stroke", "#453214");
      standBase.setAttribute("stroke-width", "1");
      tg.appendChild(standBase);

      // 3. Ornate Bronze Bezel Medallion Frame
      const outerRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      outerRing.setAttribute("cx", "0");
      outerRing.setAttribute("cy", "0");
      outerRing.setAttribute("r", "22");
      outerRing.setAttribute("fill", "#1c140d");
      outerRing.setAttribute("stroke", "#c59b48");
      outerRing.setAttribute("stroke-width", "2");
      outerRing.setAttribute("class", "bezel-ring");
      tg.appendChild(outerRing);

      // Inner clockwork ticks
      const tickRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      tickRing.setAttribute("cx", "0");
      tickRing.setAttribute("cy", "0");
      tickRing.setAttribute("r", "20");
      tickRing.setAttribute("fill", "none");
      tickRing.setAttribute("stroke", "#fcd34d");
      tickRing.setAttribute("stroke-width", "0.6");
      tickRing.setAttribute("stroke-dasharray", "2 2");
      tg.appendChild(tickRing);

      // 4. Painterly Character Image (clipped in circle)
      const imgGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      imgGroup.setAttribute("clip-path", "url(#token-clip-circle)");

      const portrait = document.createElementNS("http://www.w3.org/2000/svg", "image");
      portrait.setAttribute("href", cfg.avatar);
      portrait.setAttribute("x", "-19");
      portrait.setAttribute("y", "-19");
      portrait.setAttribute("width", "38");
      portrait.setAttribute("height", "38");
      portrait.setAttribute("preserveAspectRatio", "xMidYMid slice");
      imgGroup.appendChild(portrait);
      tg.appendChild(imgGroup);

      // 5. Glass Sheen Curved Highlight Reflection Overlay
      const sheen = document.createElementNS("http://www.w3.org/2000/svg", "path");
      sheen.setAttribute("d", "M -13 -13 A 19 19 0 0 1 13 -13 A 19 11 0 0 0 -13 -13");
      sheen.setAttribute("fill", "#ffffff");
      sheen.setAttribute("opacity", "0.26");
      sheen.setAttribute("pointer-events", "none");
      tg.appendChild(sheen);

      // 6. Character Accent Border Ring
      const accentRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      accentRing.setAttribute("cx", "0");
      accentRing.setAttribute("cy", "0");
      accentRing.setAttribute("r", "19");
      accentRing.setAttribute("fill", "none");
      accentRing.setAttribute("stroke", cfg.color);
      accentRing.setAttribute("stroke-width", "1.5");
      tg.appendChild(accentRing);

      // 7. Gilded Nameplate on Pedestal
      const isCurator = char.id.toLowerCase().includes("curator") || (char.name && char.name.toLowerCase().includes("curator"));
      const shortName = isCurator ? "CURATOR" : char.name.split(" ")[0].toUpperCase();

      const namePlate = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      namePlate.setAttribute("x", "-21");
      namePlate.setAttribute("y", "14");
      namePlate.setAttribute("width", "42");
      namePlate.setAttribute("height", "11");
      namePlate.setAttribute("rx", "1.5");
      namePlate.setAttribute("fill", "#1c140e");
      namePlate.setAttribute("stroke", "#c59b48");
      namePlate.setAttribute("stroke-width", "0.8");
      tg.appendChild(namePlate);

      const nameText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      nameText.setAttribute("x", "0");
      nameText.setAttribute("y", "22");
      nameText.setAttribute("text-anchor", "middle");
      nameText.setAttribute("fill", "#fff8ed");
      nameText.setAttribute("font-family", "'Cinzel', Georgia, serif");
      nameText.setAttribute("font-size", shortName.length > 7 ? "6" : "6.5");
      nameText.setAttribute("font-weight", "700");
      nameText.setAttribute("letter-spacing", "0.04em");
      nameText.textContent = shortName;
      tg.appendChild(nameText);

      // 8. Staggered VN / Comic Action Bubble
      if (char.room_action) {
        const bubbleG = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const isStaggered = idx % 2 === 1;
        const bubbleY = isStaggered ? -64 : -46;

        const actShort = char.room_action.length > 22 ? char.room_action.slice(0, 20) + ".." : char.room_action;
        const bWidth = Math.min(120, Math.max(76, actShort.length * 5.2 + 14));
        const bubbleX = 0;

        const bubbleRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bubbleRect.setAttribute("x", bubbleX - bWidth / 2);
        bubbleRect.setAttribute("y", bubbleY);
        bubbleRect.setAttribute("width", bWidth);
        bubbleRect.setAttribute("height", "17");
        bubbleRect.setAttribute("rx", "3");
        bubbleRect.setAttribute("fill", "#fffdf5");
        bubbleRect.setAttribute("stroke", "#c59b48");
        bubbleRect.setAttribute("stroke-width", "0.9");
        bubbleG.appendChild(bubbleRect);

        const pointer = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        pointer.setAttribute("points", `-3,${bubbleY + 17} 3,${bubbleY + 17} 0,-22`);
        pointer.setAttribute("fill", "#fffdf5");
        pointer.setAttribute("stroke", "#c59b48");
        pointer.setAttribute("stroke-width", "0.9");
        bubbleG.appendChild(pointer);

        const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textEl.setAttribute("x", bubbleX);
        textEl.setAttribute("y", bubbleY + 11.5);
        textEl.setAttribute("text-anchor", "middle");
        textEl.setAttribute("fill", "#291b10");
        textEl.setAttribute("font-family", "'Libre Baskerville', Georgia, serif");
        textEl.setAttribute("font-size", "7.5");
        textEl.setAttribute("font-style", "italic");
        textEl.textContent = `"${actShort}"`;
        bubbleG.appendChild(textEl);

        tg.appendChild(bubbleG);
      }

      // Interactive Click: Clicking character pre-selects plant_rumor (Whisper)
      tg.onclick = (e) => {
        e.stopPropagation();
        selectVerb("plant_rumor");
        const sel = $("#verb-param-select");
        if (sel) sel.value = char.id;
      };

      // Standee Detail Tooltip
      const tip = document.createElementNS("http://www.w3.org/2000/svg", "title");
      tip.textContent = `${char.name} (${char.role})
Location: Chamber ${char.node || cid} (${cConf.name})
State: ${isLit ? 'Spotlighted (Accountable)' : 'In Shadow (Covert)'}
Action: ${char.room_action || "Observing"}
HP: ${char.hp}/${char.max_hp} | Stress: ${char.stress}% | Load: ${char.total_weight_kg}kg
[Click to Whisper / plant rumor]`;
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

  const blocked = stageState.data.blocked_edges || [];
  const curtained = stageState.data.curtained_doorways || [];
  const spotlightId = stageState.data.spotlight_chamber || 1;

  rumorWrap.hidden = true;
  select.hidden = false;

  function isCurtained(u, v) {
    return blocked.some((e) => (e[0] === u && e[1] === v) || (e[0] === v && e[1] === u)) ||
           curtained.some((e) => (e[0] === u && e[1] === v) || (e[0] === v && e[1] === u));
  }

  if (verb === "block_route") {
    label.textContent = "Velvet curtain door";
    const doorways = [
      { edge: [1, 2], name: "Chamber 1 <-> Chamber 2 (East Corridor)" },
      { edge: [1, 3], name: "Chamber 1 <-> Chamber 3 (Spiral Stairs)" },
      { edge: [3, 4], name: "Chamber 3 <-> Chamber 4 (Service Doors)" },
      { edge: [2, 4], name: "Chamber 2 <-> Chamber 4 (Service Ladder)" },
    ];
    select.innerHTML = doorways.map((d) => {
      const sealed = isCurtained(d.edge[0], d.edge[1]);
      const status = sealed ? "[SEALED - Click to Open]" : "[OPEN - Click to Seal]";
      return `<option value="${d.edge[0]},${d.edge[1]}">${d.name} ${status}</option>`;
    }).join("");
  } else if (verb === "shift_spotlight") {
    label.textContent = "Train spotlight";
    const chambers = [
      { id: 1, name: "Chamber 1: Telegraph Office" },
      { id: 2, name: "Chamber 2: Locked Platform Gate" },
      { id: 3, name: "Chamber 3: Grand Waiting Hall" },
      { id: 4, name: "Chamber 4: Baggage & Boiler Room" },
    ];
    select.innerHTML = chambers.map((c) => {
      const isLit = (c.id === spotlightId);
      const tag = isLit ? "(Spotlighted)" : "(In Shadow)";
      return `<option value="${c.id}" ${isLit ? "selected" : ""}>${c.name} ${tag}</option>`;
    }).join("");
  } else if (verb === "plant_rumor") {
    label.textContent = "Whisper to actor";
    const living = Object.values(stageState.data.characters).filter((c) => c.is_alive);
    select.innerHTML = living.map((c) => `
      <option value="${c.id}">${c.name} (${c.role}) [Chamber ${c.node || 1}]</option>
    `).join("");
    rumorWrap.hidden = false;
  } else if (verb === "cue_prop") {
    label.textContent = "Place prop (Chekhov's Gun)";
    select.innerHTML = `
      <option value="hearth_stove,Chekhov's Revolver">Coal Stove: Chekhov's Revolver</option>
      <option value="padlocked_gate,Cold Iron Crowbar">Platform Gate: Cold Iron Crowbar</option>
      <option value="cabinets,Forged Train Manifest">Cabinets: Forged Train Manifest</option>
      <option value="telegraph_desk,Wire Cutters">Telegraph Key: Wire Cutters</option>
      <option value="steam_furnace,Restorative Tonic">Boiler Furnace: Restorative Tonic</option>
      <option value="toolbench,Heavy Brass Spanner">Toolbench: Heavy Brass Spanner</option>
      <option value="smuggler_crate,Dynamite Stick">Smuggler Crate: Dynamite Stick</option>
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
      target = select.value.split(",").map(Number);
    } else if (verb === "shift_spotlight") {
      target = Number(select.value);
    } else if (verb === "plant_rumor") {
      const char = select.value;
      const text = $("#rumor-text-input").value.trim() || "The path ahead is rigged.";
      target = { character: char, rumor: text, actor: char, text: text };
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
    if (tagEl) tagEl.textContent = `SCENE ${res.stage_state.scene_number}`;

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

    // Handle Verifier Banner (Strictly show domain gameplay verifications, not network logs)
    const verifierAlert = $("#stage-verifier-alert");
    if (verifierAlert) {
      const domainRepairs = (res.repairs || []).filter(
        (r) => !r.rule.includes("Network") && !r.rule.includes("Failover") && !r.rule.includes("Fallback")
      );
      if (domainRepairs.length > 0) {
        const rep = domainRepairs[0];
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

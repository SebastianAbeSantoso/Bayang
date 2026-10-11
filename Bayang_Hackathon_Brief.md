---
title: "Bayang — AMD Developer Hackathon ACT III Project Brief"
subtitle: "Hackathon context, technology landscape, concept directions, architecture, and execution notes"
date: "2026-10-11"
status: "Exploration / pre-build"
---

# Bayang

**Codename:** Bayang  
**Event:** AMD Developer Hackathon: ACT III, hosted on lablab.ai  
**Status:** Registered; concept exploration; no final product direction selected  
**Working principle:** Build something that solves a real problem, demonstrates a working product, and uses AMD infrastructure as a meaningful part of the system rather than as a decorative badge.

> **Naming note:** “Bayang” is a temporary codename, not a finalized public brand. In Indonesian and Malay, *bayang* can evoke a shadow, silhouette, reflection, or mental image. As a project metaphor, it suggests a model or reflection of the real world: a system that observes reality, constructs a representation of it, and then reasons, simulates, or creates from that representation. Keep this interpretation evocative rather than forcing it into an acronym.

## 1. Executive summary

Bayang is currently a **project umbrella and codename**, not a committed product specification. The project direction is being explored for AMD Developer Hackathon: ACT III.

The strongest concept families so far are:

1. **Simulation engine:** construct a structured model of a real system and let users test “what if?” decisions before acting.
2. **Generative experience engine:** turn structured information, identity, constraints, and user intent into a responsive, interactive experience.
3. **Academic digital twin:** create a live, temporal model of a student's academic workload and simulate the consequences of decisions.
4. **Tourism value-dispersion experience:** personalize visits while helping distribute attention and spending toward less-visited places and local businesses.
5. **Adaptive edge-case training:** generate realistic operational scenarios, evaluate a person's response, and adapt the next scenario to their weaknesses.
6. **Frontline operational-state system:** turn fragmented business communications and documents into a reliable shared state, then surface consequences and trigger actions.

The shared architectural idea is:

**Real-world inputs → structured state/model → reasoning or simulation → deterministic execution → measurable outcome.**

The LLM should interpret, plan, explain, and coordinate. It should not be trusted as the sole source of truth for arithmetic, forecasts, state transitions, rules, or actions with real consequences. Use deterministic code, explicit schemas, validation, provenance, and human approval where appropriate.

The project is not yet committed to one of these concepts. The next step is to select a narrow, demonstrable problem and build a complete vertical slice during the event.

---

# 2. Hackathon context

## 2.1 Event overview

- **Official event:** [AMD Developer Hackathon: ACT III](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii)
- **Platform:** [lablab.ai](https://lablab.ai/)
- **Technology index:** [Discover AI Technologies](https://lablab.ai/tech)
- **Online build period:** October 12–18, 2026, according to the main event page.
- **Kickoff / registration close:** October 12, 2026, 15:00 UTC, according to the live event dashboard.
- **Submission close:** October 18, 2026, 15:00 UTC.
- **On-site phase:** October 17–18, 2026, with listed locations in Rome, Milan, and Imperia, Italy. Online participation is available. Travel and accommodation are not covered by the event page.
- **Team size:** 1–6 participants.
- **AMD AI Developer Program:** required for participation approval.
- **Prize pool:** the event page advertises $12,000+ overall; details and partner prizes are subject to the official page and terms.
- **AMD requirement:** every project must run a meaningful part of its workload on AMD infrastructure or AMD hardware.

**Timing caution:** event pages can display slightly different online-build date ranges. Treat the submission deadline and kickoff shown on the live dashboard, and any direct organizer updates, as the operational source of truth. Confirm current details before submission.

## 2.2 What the hackathon is looking for

The event asks participants to build a **working product for a real problem**, using AMD technology as a meaningful part of the solution. A language model alone is not the product. The submission should demonstrate useful behavior, a real user, and a credible outcome.

The official event page lists these challenge families:

### Intelligent Industry

Help manufacturers identify problems earlier and operate better using information from equipment, cameras, sensors, maintenance records, and technical manuals.

Potential problem areas include downtime, quality, safety, and resource efficiency.

### Reinvent Commerce

Help businesses use disconnected retail and commerce information—products, transactions, inventory, reviews, support conversations, and marketing results—to make better commercial decisions.

Examples include demand and inventory planning, product discovery, customer retention, multilingual commerce, promotion planning, sentiment analysis, and in-store computer vision.

For forecasts, the event cautions against using an LLM as the only forecasting method. Predictions should have a clear calculation or model behind them.

### Create a New Kind of Experience

Build a media, marketing, or entertainment experience that would not have been practical before generative AI. The experience should respond to its audience, context, or input rather than merely generate a static image, advertisement, or chatbot reply.

The event asks teams to demonstrate changes across at least two audiences, situations, or inputs, and to explain generation decisions, quality controls, cost, and the reason a customer would pay.

### Evolus Business Agents on AMD — partner track

Build an agent that executes a real business process end to end using Evolus and an open model served on AMD infrastructure.

This track is optional for the overall hackathon, but it has specific requirements for teams seeking the Evolus partner prize. Details are in the Evolus section below.

## 2.3 Submission checklist

The event page asks for items such as:

- Project title
- Short and long descriptions
- Selected challenge / track
- Technology and category tags
- Working prototype / demo application and URL
- Public GitHub repository
- Cover image
- Demo or presentation video
- Pitch slide presentation
- Clear explanation of the problem and intended user

The repository should be runnable and understandable by reviewers. Keep secrets out of source control; use environment variables for API keys and credentials. Confirm the event's current submission checklist and licensing rules before submitting.

## 2.4 Judging dimensions

The event lists four main judging dimensions:

1. **Application of technology:** how effectively the selected models and AMD technology are integrated.
2. **Business value:** practical impact and fit to a real user or business process.
3. **Originality:** uniqueness of the approach and demonstrated behavior.
4. **Presentation:** clarity of the explanation, pitch, and demo.

For Bayang, this implies a practical test: can a reviewer see the problem, provide an input, watch the system do something meaningful, and understand how success is measured?

## 2.5 Official event references

- [ACT III event page](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii)
- [ACT III live dashboard](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii/live)
- [lablab.ai technology index](https://lablab.ai/tech)
- [AMD Developer Cloud: host an LLM with vLLM](https://lablab.ai/ai-tutorials/amd-developer-cloud-host-llm-vllm)
- [Deploy an AMD MI300X-backed AI app to Hugging Face Spaces](https://lablab.ai/ai-tutorials/amd-huggingface-deployment-for-ai-hackathons)

---

# 3. What makes AMD technically relevant?

AMD should not merely appear in the technology tags. It should power a real inference, training, or compute workload that is visible in the architecture and demo.

## 3.1 AMD Developer Cloud

**What it is:** cloud access to AMD GPU compute, allowing developers to run workloads without owning a local AMD GPU.

**Potential uses:**

- Host an open-weight language or vision-language model.
- Serve inference through an API endpoint.
- Benchmark latency, throughput, memory usage, and concurrency.
- Fine-tune or experiment with models when the available compute and time justify it.
- Run the AI-heavy part of a web application while hosting the frontend elsewhere.

**Why it matters for Bayang:** it removes the requirement to own compatible hardware. A local Windows development machine can act as the frontend / orchestration development environment while model inference runs on cloud AMD hardware.

**Practical note:** GPU instances incur costs when running. Check current prices, credits, storage, network access, firewall rules, and shutdown behavior before launching. Do not leave an instance running accidentally during a one-week hackathon.

## 3.2 AMD Instinct GPUs

AMD Instinct is the accelerator family aimed at data-center AI and high-performance computing workloads. The lablab.ai tutorial specifically describes an AMD Instinct MI300X instance with 192 GB of HBM3 memory.

Potential benefits for this project class:

- Run larger open-weight models than might fit on a typical consumer GPU.
- Serve vision-language or language models with substantial memory requirements.
- Explore concurrent requests or multi-model serving.
- Benchmark actual workload performance instead of relying on claims about hardware.

**Do not assume every AMD instance or event credit offers the same hardware, memory, or price.** Verify the instance configuration that is actually available to the account.

## 3.3 ROCm

**ROCm** is AMD's open-source GPU compute software stack. It plays a role similar to NVIDIA's CUDA ecosystem: it provides libraries and runtime components used to run GPU-accelerated AI and compute workloads on supported AMD hardware.

ROCm is software, not a graphics card. Bayang does **not** require the developer to own a Ryzen or Radeon device if the model workload is running on compatible AMD cloud hardware.

**Possible Bayang use:**

- Serve Qwen or another compatible open-weight model using vLLM on an AMD GPU.
- Use the served model in the application through an OpenAI-compatible API.
- Report model identity, endpoint health, request latency, and a reproducible benchmark in the demo.

Official resources:

- [ROCm on lablab.ai](https://lablab.ai/tech/amd/amd-rocm)
- [ROCm documentation](https://rocm.docs.amd.com/)
- [ROCm GitHub](https://github.com/ROCm/ROCm)

## 3.4 vLLM

**What it is:** a model-serving engine designed for efficient LLM inference and high-throughput serving. It can expose an OpenAI-compatible API.

**Role in the architecture:**

`Bayang application → model API client → vLLM endpoint → open-weight model on AMD GPU`

This lets the rest of the application use a standard client interface without coupling the entire codebase to one model provider.

**Important:** OpenAI-compatible means API compatibility, not that every model supports every feature identically. Validate chat templates, structured output behavior, tool-calling support, context limits, and concurrency with the exact model and vLLM build.

## 3.5 AMD Ryzen AI and Radeon

These are other possible AMD technology paths listed by the event:

- **Ryzen AI:** client-side AI acceleration on supported Ryzen AI hardware.
- **Radeon:** AMD graphics hardware that can support certain AI workloads through compatible software stacks.

They may be useful for a local or edge deployment, but they are not required if Bayang's meaningful AI workload runs on AMD Developer Cloud. Do not design around hardware that the team does not have access to.

## 3.6 What counts as meaningful AMD usage?

A credible demonstration should make the AMD dependency explicit:

- The main open-weight model runs on an AMD-hosted endpoint.
- The application sends real workload requests to that endpoint.
- The model output affects a core product function.
- The README documents how the endpoint is configured.
- A benchmark or system metric demonstrates actual operation.
- If feasible, the demo reports latency, throughput, model name, or workload size.

A weak implementation would use a third-party hosted model for all important reasoning and add AMD only as an unused tag. The event requires AMD to power a meaningful part of the working product.

---

# 4. Evolus: what it is and when to use it

Official resources:

- [Evolus website](https://evolus.ai/)
- [Evolus app / workspace](https://app.evolus.ai/)
- [Evolus REST API base](https://api.evolus.ai/api/v1)
- [Evolus MCP server](https://api.evolus.ai/mcp)
- [ACT III event page and Evolus track brief](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii)

## 4.1 Role

Evolus is an agent and workflow platform for automating real business processes. It supplies an execution layer around the team's model: agents, workflows, document extraction, knowledge libraries, AI tools, MCP connections, webhooks, and chat interfaces.

A useful division of responsibility is:

- **AMD-hosted model:** language / multimodal reasoning.
- **Bayang application:** product experience, domain model, validation, custom algorithms, visualization, and distinctive product logic.
- **Evolus, if used:** agent configuration, workflow execution, document and knowledge tools, external-system connections, and selected business-process automation.

Evolus is not the same thing as the underlying LLM. In the ACT III partner track, teams bring their own model and connect it to Evolus.

## 4.2 Evolus building blocks

### Agents and sub-agents

Agents can use tools and memory while operating on the team's configured model. Sub-agents can split responsibilities where useful.

Possible Bayang roles: intake agent, state-modeling agent, scenario planner, evidence checker, and report writer. These are examples, not a recommendation to create five agents by default. A one-week build should use the smallest architecture that works.

### Workflows

Multi-step pipelines can contain agent calls, document reading, extractors, webhooks, branches, loops, and parallel steps. Workflows may start from an API call, an incoming email, or a schedule.

The event page gives this REST API pattern for executing a workflow:

`POST /api/v1/workflows/{id}/execute`

The workflow can accept text and files; the application can then check execution status and use the result.

### Document extractors

Extract structured JSON from PDFs, scans, or images according to a defined schema. This is useful when the product needs reliable fields such as invoice number, due date, assignment deadline, supplier cost, contract clause, or source metadata.

Extraction is not equivalent to verification. Validate extracted values and retain the source document and relevant evidence.

### AI Tools

The event page lists ready-made operations including:

- Document-to-structured-data conversion (JSON, CSV, XML)
- Table extraction
- Translation of PDF and Word files while preserving layout
- Redaction of personal data in PDFs
- Summaries and rewriting
- Meeting minutes from audio or video
- Email drafting and replies
- Plain-language simplification
- Sentiment analysis
- Comparison of two texts

The page describes API patterns including `/api/v1/ai-tools/{tool}/run`, with `run-media` and `run-file` variants for certain inputs and outputs. Confirm the exact request schema in the workspace API reference before implementing.

### Knowledge libraries (RAG)

Upload documents or import web pages so agents can retrieve information and answer with sources.

Potential uses: company policy, product information, operational manuals, course documents, destination information, or simulation assumptions.

RAG retrieves relevant information; it does not automatically guarantee truth. Keep source attribution, document dates, and confidence visible where they matter.

### Webhooks

Send notifications to Bayang or another system when a workflow reaches a relevant state.

### MCP connectors

Connect agents to external systems through Model Context Protocol servers. MCP can expose tools and data sources to an agent, but permissions and action boundaries still need to be designed deliberately.

### Chat widget

Embed an Evolus agent into a website using the platform's widget. This is convenient when a chat interface is the right interaction, but Bayang should not become “just a chatbot” by accident.

### Evolus MCP server and Studio

- MCP endpoint listed by the event page: `https://api.evolus.ai/mcp`
- Evolus Studio is described as a coding agent for terminal and desktop, based on the open-source OpenCode project, with Evolus MCP tools integrated.

These are development and platform-integration options, not mandatory components for every project.

## 4.3 Evolus API notes

The event page describes these access patterns:

- **REST API:** `https://api.evolus.ai/api/v1`
- **REST authentication headers:** `X-ApiKey` and `X-Application-Id`
- **Agent chat, OpenAI-compatible base URL:** `https://api.evolus.ai/v1`
- **Chat model identifier:** `<applicationId>:<agentId>`
- **Agent chat authentication:** Bearer API key
- **MCP endpoint:** `https://api.evolus.ai/mcp`

According to the event page, workflows, extractors, AI Tools, and knowledge libraries use the Evolus REST API. Agent chat is also available through the OpenAI-compatible endpoint.

**Security:** store keys in environment variables or the platform's secret manager. Never commit keys, tokens, or private endpoint credentials into GitHub or a frontend bundle.

## 4.4 Evolus partner-track requirements

To compete for the Evolus Business Agents on AMD partner prize, the event page specifies:

1. Create a free event workspace at [app.evolus.ai](https://app.evolus.ai/) using the event code shared at kickoff.
2. The main agent must use an **open model served on AMD infrastructure through the team's own vLLM endpoint on AMD Developer Cloud**.
3. Use at least **two Evolus building blocks**, such as workflows, document extractors, AI Tools, knowledge libraries, MCP connectors, sub-agents, or chat widget.
4. Drive Evolus from the app through its APIs. Use REST API calls for workflows, extractors, AI Tools, and libraries; agent chat can use the REST API or OpenAI-compatible endpoint.
5. Follow submission rules, including a containerized application, public GitHub repository, runnable README, and no committed API keys.

The event page states that the event workspace is available until October 31, 2026, for up to six team members, with 50,000 platform credits and no credit card, subject to the event's actual access instructions and terms.

The Evolus team says it reviews workspace configuration and usage statistics, including the connected model endpoint, building blocks, and API calls. Therefore, do not treat partner-track compliance as a box to tick in the README; the actual workspace usage must match the requirements.

## 4.5 Should Bayang use Evolus?

**Use it if** the chosen product is fundamentally a business process or agentic workflow and Evolus saves enough time to justify the integration.

**Do not use it just because it is available.** For a simulation engine or generative experience engine, the core value may be the custom state model, simulation algorithm, or interactive renderer. Evolus may be useful for ingestion and orchestration, but forcing the whole product into a workflow platform could weaken the demo.

If Bayang targets the Evolus prize, the requirements above become a hard architecture constraint. If targeting only the main ACT III challenge, Evolus is optional.

---

# 5. Technology landscape from lablab.ai/tech

The [lablab.ai technology index](https://lablab.ai/tech) is a discovery directory for technologies, tutorials, hackathons, frameworks, and starter resources. It is not one unified SDK and not every listed tool is needed for a single project.

The following technologies came up during exploration. Their roles are summarized below; exact API availability, license, pricing, and compatibility should be checked on the linked official pages before use.

## 5.1 Core AI models

### Qwen / Qwen3

**Role:** open-weight model family covering general language tasks and different model sizes / architectures.

Potential use: planning, extraction assistance, summarization, structured-output generation, decision explanation, and agent reasoning.

- Technology index: [lablab.ai/tech](https://lablab.ai/tech)
- Model hub: [Qwen on Hugging Face](https://huggingface.co/Qwen)

Choose a model based on task quality, inference cost, context needs, and compatibility with the available AMD/vLLM environment. “Bigger” is not automatically “better” under a one-week deadline.

### Qwen3-VL

**Role:** vision-language model family for tasks involving images, video, and text.

Potential use:

- Interpret destination photos, signage, product images, or screenshots.
- Extract context from visual input.
- Convert images into structured descriptions that downstream logic can validate.

It should not be expected to infer facts that are not visible or otherwise supplied. Ground claims about real places, people, or objects in source data.

- [Qwen model family](https://huggingface.co/Qwen)

### Qwen3-Coder

**Role:** open-weight coding-oriented model family.

Potential use: code assistance, codebase analysis, or development tooling. It is not a required model for Bayang and is unlikely to be the core model unless the chosen product specifically involves code.

## 5.2 Data collection and grounding

### Bright Data

**Role:** web data infrastructure, including scraping APIs, search-result APIs, managed browser access, proxy networks, and ready-made datasets.

Potential use:

- Collect public information from supported sources.
- Build a source-grounded catalogue of destinations, products, organizations, or public records.
- Refresh data through controlled ingestion pipelines.

Important constraints:

- Check each website's terms, robots rules, licensing, privacy requirements, and the data provider's permitted uses.
- Do not assume all web content can be scraped, stored, redistributed, or used to train a model.
- **Google Maps / Street View content must not be treated as freely scrapeable data.** Use permitted APIs, licensing, public datasets, or other imagery with clear rights.
- For a hackathon, a small curated dataset may be more reliable than a complex scraping pipeline.

- [Bright Data](https://brightdata.com/)
- [Bright Data technology page](https://lablab.ai/tech)

### Bright Data Datasets / Web Scraper API / SERP API / MCP server

These are related offerings rather than interchangeable names:

- **Datasets:** pre-collected structured data for supported sites.
- **Web Scraper API:** extraction from supported websites using managed scrapers.
- **SERP API:** structured search results from supported search engines.
- **MCP server:** makes web search, scraping, extraction, and browser-oriented tools available to compatible AI agents.

Use only the subset that directly supports the chosen demo.

## 5.3 Memory and knowledge graphs

### Cognee

**Role:** open-source AI memory and knowledge-engineering toolkit that builds knowledge graphs from data and combines graph relationships with vector-based retrieval.

Potential use:

- Connect entities and relationships across fragmented data.
- Store source-grounded facts and relationships.
- Give agents persistent, queryable context across workflows.
- Support a student digital twin, business state model, destination knowledge graph, or organizational memory.

Cognee should not automatically become the canonical database. A conventional relational database is often better for strongly typed records, transactions, constraints, and exact queries. A knowledge graph is useful when relationships and semantic retrieval are central.

- [Cognee](https://www.cognee.ai/)
- [Cognee technology page](https://lablab.ai/tech)

## 5.4 Multi-agent systems and agent coordination

### CAMEL / CAMEL-AI

**Role:** framework and research ecosystem for multi-agent cooperation and agent-society simulations.

Potential use:

- Simulate agents with different roles, goals, information, and constraints.
- Explore negotiation, coordination, market dynamics, or scenario generation.
- Run controlled experiments across different policies.

Risks: multi-agent simulations can look convincing while being poorly calibrated. Define agent rules, world state, and evaluation metrics explicitly. Use deterministic logic for economic/accounting constraints where possible.

- [CAMEL-AI](https://www.camel-ai.org/)
- [CAMEL on lablab.ai](https://lablab.ai/tech)

### Generative Agents

**Role:** research direction and implementation pattern for simulated agents whose behavior emerges from memories, plans, and interactions.

Potential use: create plausible characters or stakeholders for training scenarios, simulated environments, or interactive experiences.

This is a design pattern, not a guarantee that a simulation accurately predicts real human behavior. Use it for exploration, rehearsal, and experience generation unless it has been validated for a higher-stakes purpose.

### Band AI / Agentic Mesh / Control Plane

**Role:** infrastructure for agents built with different frameworks to discover one another, exchange context, and coordinate in shared spaces. Its control-plane concept focuses on governance, authority boundaries, isolation, and audit trails.

Potential use:

- Coordinate independently built agents.
- Apply clearer permission and interaction boundaries.
- Preserve traceability in multi-agent workflows.

This is likely unnecessary for a small single-agent MVP unless cross-framework coordination or governance is itself central to the product.

- [Band AI technology page](https://lablab.ai/tech)

## 5.5 Event-driven data and workflow triggers

### TriggerWare

**Role:** real-time analytics and automation platform that can query live data, set alerts, and trigger agent workflows.

Potential use:

- Detect a meaningful change in an operational data stream.
- Trigger an agent or workflow when a rule is met.
- Connect live state changes to notifications or actions without building a full ETL pipeline first.

Potential Bayang fit: frontline operations, inventory / demand events, deadline changes, or systems that need to react to incoming updates.

Check data connectors, supported query patterns, integration limits, and licensing before making it a dependency.

- [TriggerWare technology page](https://lablab.ai/tech)

## 5.6 Web and interactive experience technologies

### WebGPU

**Role:** browser API for GPU-accelerated graphics and compute. It is not itself a generative AI model.

Potential use:

- Render interactive 3D scenes and simulations in a browser.
- Run supported GPU compute workloads client-side.
- Build an experience that users can access without installing a desktop application.

For a 3D experience, WebGPU may be paired with Three.js or another rendering framework. Keep the distinction clear: AMD-hosted model inference can run on the server while WebGPU renders the resulting scene in the browser.

- [WebGPU applications on lablab.ai](https://lablab.ai/apps/tech/webgpu)

### Three.js / frontend rendering

**Role:** JavaScript 3D library for interactive browser graphics.

Potential use: render a destination, simulated business environment, interactive story, or procedural world from a structured scene description.

A useful design is for the AI to output a constrained JSON scene specification, then let deterministic code validate and render it. Avoid asking the LLM to produce arbitrary executable frontend code for every user request.

## 5.7 Video and audio understanding

### Twelve Labs

**Role:** video understanding and search technology.

Potential use: extract events, topics, or semantic information from video clips, such as training footage or recorded experiences.

### AssemblyAI

**Role:** speech and audio processing APIs, including transcription and related speech intelligence capabilities.

Potential use: convert recorded meetings, interviews, instructions, or voice input into text that can be indexed or processed.

### Speechmatics

**Role:** speech recognition / transcription services with multilingual capabilities.

Potential use: speech-to-text in environments where supported language coverage or transcription quality matters.

These tools can form a pipeline:

`Audio/video → transcription or semantic extraction → structured evidence → knowledge/state model → agent or experience`

For a hackathon, choose one provider and one concrete media task instead of integrating every service.

## 5.8 Computer vision and physical-world simulation

### YOLO

**Role:** family of real-time object detection models.

Potential use: identify objects or people in permitted images/video, such as product shelves, workplace equipment, or physical training scenes.

Detection is not full understanding. If the product needs reasoning about the scene, a vision-language model or domain-specific logic may be required after detection.

### Webots

**Role:** robot simulation environment.

Potential use: simulate robotics, sensors, and physical interactions in a controlled environment. Only relevant if Bayang takes a robotics or physical-system direction.

## 5.9 Other tools mentioned in the exploration

These are alternatives, not an instruction to install the entire AI ecosystem in one sitting.

- **Hugging Face Hub:** model and dataset discovery / hosting.
- **Hugging Face Spaces:** deploy interactive demos and lightweight frontends.
- **LangChain / LangGraph:** compose LLM applications and stateful workflows.
- **AutoGen / CrewAI:** multi-agent orchestration frameworks.
- **n8n:** visual automation and integrations.
- **MCP:** protocol for exposing tools and context to compatible AI clients.
- **Composio:** integrations that expose external application actions to agents.
- **OpenAI-compatible API clients:** let the app call compatible model endpoints using familiar request structures.
- **Streamlit / Gradio:** rapid UI frameworks for demos.
- **Vercel:** frontend and application deployment.
- **Qdrant / Pinecone:** vector search databases.
- **Redis:** in-memory data structures and caching.
- **PrivateGPT:** local/private document-question-answering project ecosystem.

Select technologies by architectural need, not by novelty. Every additional integration consumes the scarcest resource in a one-week hackathon: debugging time.

---

# 6. Architecture patterns

The exploration has converged on three reusable architecture families.

## 6.1 Pattern A — Simulation

**Question answered:** “What happens if I change this?”

`Data sources → canonical state model → simulation engine → scenario comparison → explanation / visualization`

Core requirements:

- Explicit entities and state.
- Rules, constraints, and transition logic.
- A way to run scenarios repeatedly.
- Evaluation metrics and uncertainty handling.
- AI for translating user intent into scenario parameters and explaining results.
- Deterministic code for arithmetic, constraints, and core transitions.

Potential applications: SME decision rehearsal, student workload planning, supply-chain resilience, negotiation, city systems, software project risk.

## 6.2 Pattern B — Experience generation

**Question answered:** “What experience should this become?”

`Sources + user intent + identity / constraints → grounded knowledge model → AI experience plan → validation → procedural execution / renderer`

Core requirements:

- Source-grounded facts.
- A structured representation of the world.
- User or audience preferences.
- Explicit rules for what can and cannot be generated.
- A deterministic renderer or execution layer.
- Quality, relevance, consistency, and cost evaluation.

Potential applications: tourism experiences, interactive stories, museum/archive experiences, generative brand worlds, educational worlds, product experiences.

## 6.3 Pattern C — Operational state and action

**Question answered:** “Given what is happening now, what should happen next?”

`Incoming events and documents → extraction → canonical state → rules / alerts → agent reasoning → workflow or human approval → audit trail`

Core requirements:

- Event ingestion and source provenance.
- Canonical records and current state.
- Conflict resolution and timestamps.
- Rules for action permissions.
- Escalation and human review.
- Audit logs.

Potential applications: frontline operations, business workflows, student deadline management, inventory operations, incident management.

## 6.4 Cross-cutting design principle

The AI should not be the database, simulator, and executor all at once.

A stronger division is:

- **Model:** interpret ambiguous input, propose plans, summarize evidence, explain outcomes.
- **Structured storage:** retain entities, relationships, events, source references, and state.
- **Deterministic engine:** enforce constraints, perform calculations, simulate transitions, validate output.
- **Workflow layer:** execute allowed actions and route work.
- **UI:** let users inspect inputs, compare outcomes, and correct errors.
- **Evaluation:** prove that the system works better than a baseline.

---

# 7. Candidate concepts

No concept has been selected. These are the leading directions from ideation.

## 7.1 Candidate A — SME Decision-Rehearsal Simulation Engine

**Core question:** What happens to a small business if several conditions change at once?

Example scenario:

- Supplier cost increases.
- Demand falls.
- The owner changes prices.
- A staff member is unavailable.
- Cash reserves are limited.

The system builds or accepts a structured business model, runs scenarios, highlights failure points, and explains the trade-offs. The goal is not merely to generate advice; it is to let the owner rehearse decisions before committing money.

### Why it is promising

- Clear practical problem and user.
- Strong fit for simulation and measurable results.
- AMD compute can support parallel scenario runs, repeated inference, and open-model serving.
- The demo can show a baseline, a shock, several alternative decisions, and a comparison.

### Technical design

- Structured business state: products, prices, unit costs, inventory, cash, staffing, capacity, demand assumptions.
- Deterministic simulation: revenue, variable cost, gross margin, cash flow, stock-outs, capacity limits.
- Optional stochastic scenario generator for uncertain demand or supplier shocks.
- LLM: translate natural language into a validated scenario configuration and explain results.
- UI: scenario editor, comparison table, charts, risk flags, assumptions and evidence.
- Evaluation: scenario throughput, calculation correctness, sensitivity checks, and whether the system identifies known failure cases.

### Main risks

- Invented or uncalibrated forecasts.
- Too much scope in building a realistic business simulator.
- Fake precision when the inputs are weak.

### Scope-control strategy

Start with one business type and a small, explicit model. Use synthetic or curated example data and label assumptions. Demonstrate a reliable what-if calculation rather than pretending to forecast the entire economy.

**Possible track:** Reinvent Commerce or Intelligent Industry, depending on the user and business model.

## 7.2 Candidate B — Generative Experience Engine

**Core question:** Can structured information and constraints be compiled into a different, responsive experience for each user?

This is a general engine rather than a brand-only generator. Inputs could describe a destination, product, organization, educational topic, fictional universe, or cultural archive.

The engine could combine:

- **Identity / DNA:** facts, goals, style, values, and constraints.
- **Knowledge:** source-grounded entities and relationships.
- **Audience:** interests, preferences, accessibility needs, and context.
- **Planner:** produces a structured experience plan.
- **Validator:** checks facts, permitted assets, rules, and consistency.
- **Executor / renderer:** turns the plan into an interactive experience.

### Why it is promising

- Fits the “Create a New Kind of Experience” track.
- Can be visually distinctive.
- Generalizes beyond a single application.
- Gives AMD a meaningful role in the model-based planning or multimodal reasoning layer.

### Technical design

- Qwen3 or another open model for planning.
- Qwen3-VL if visual understanding is needed.
- Cognee or a simpler relational / vector store for grounded knowledge.
- JSON schema for scene or experience specifications.
- Deterministic code to render a scene, narrative flow, map, or interactive UI.
- Browser frontend using standard web technologies; Three.js / WebGPU only if the experience needs 3D or GPU-accelerated graphics.

### Main risks

- Too abstract to demonstrate a clear customer problem.
- LLM-generated experiences may be inconsistent or factually wrong.
- A general-purpose engine may exceed the one-week scope.

### Scope-control strategy

Pick one high-impact application and one type of experience. Demonstrate at least two visibly different inputs or audiences, with quality checks and a clear explanation of why the experience is useful.

**Possible track:** Create a New Kind of Experience.

## 7.3 Candidate C — Academic Digital Twin

**Core question:** What happens to a student's academic commitments if they choose to spend time on something else?

A student's digital life is fragmented across LMS platforms, calendars, PDFs, slides, email, messaging apps, GitHub, notes, assignments, grades, and personal projects.

A useful version is not another to-do list. It is a structured, temporal model of academic commitments that can answer counterfactual questions such as:

- What if I spend 15 hours on a hackathon this week?
- Which deadlines become high-risk if this task slips two days?
- What is the minimum work needed before the next consultation?
- Which tasks depend on a document, dataset, or teammate response?

### Canonical data model

Potential entities:

- Student
- Course
- Assignment
- Exam
- Project
- Task
- Deadline
- Event
- Document
- Skill
- Submission
- Grade
- Message
- Commit
- StudySession

Potential events:

- AssignmentAssigned
- DeadlineChanged
- TaskStarted
- TaskCompleted
- CommitCreated
- SubmissionUploaded
- ConsultationScheduled
- GradeRecorded
- StudySessionLogged

Useful fields include timestamps, source IDs, provenance, confidence, status history, dependencies, and links to evidence.

### Why it is promising

- The problem is personally understandable and easy to explain.
- The data model can be grounded in familiar database concepts.
- It can combine ingestion, temporal state, dependency graphs, and counterfactual simulation.
- A seeded demo can work without integrating every real student platform.

### Main risks

- Fragmented source integrations.
- Privacy and permissions.
- Crowded student productivity market.
- Unreliable automatic extraction of deadlines or commitments.

### Scope-control strategy

Start with uploaded files and manually confirmed tasks. Model task duration and dependencies explicitly. Demonstrate one or two counterfactual scenarios instead of promising full integrations with every platform.

**Possible track:** choose the closest accepted track after checking event guidance and the final product positioning.

## 7.4 Candidate D — Tourism Value-Dispersion Experience

**Core question:** Can a personalized visitor experience help distribute attention and spending beyond the most famous attractions?

Instead of generating a generic itinerary, the system uses visitor preferences, travel time, accessibility, crowding or capacity data when available, and local points of interest to construct an experience that also surfaces less-visited places and local businesses.

### Why it is promising

- Strong experiential component.
- A clear social and commercial outcome: distribute visitor attention and spending more broadly.
- Can use maps, public information, images, and grounded destination knowledge.
- Provides a visible demo: change the visitor profile or constraints and watch the route / experience adapt.

### Technical design

- Curated destination data or permitted data feeds.
- Geospatial filtering and route constraints.
- Qwen3-VL for permitted image understanding if useful.
- Cognee or a structured database for place relationships and source provenance.
- A deterministic scoring / routing component for time, distance, preferences, and accessibility.
- LLM to create the narrative and explain trade-offs.
- Map or interactive web frontend.

### Main risks

- Data quality and licensing, especially for imagery and map sources.
- A generic itinerary generator is not sufficiently novel.
- Recommendations could claim to support local businesses without measuring whether value is actually dispersed.

### Scope-control strategy

Use one destination and a curated dataset. Define a measurable dispersion metric, such as the share of recommended stops outside the top-ranked attractions or the number of locally owned businesses included, while clearly labeling proxy metrics.

**Possible track:** Create a New Kind of Experience or Reinvent Commerce.

## 7.5 Candidate E — Adaptive Edge-Case Training

**Core question:** Can a training system generate realistic, varied operational situations that target a trainee's weaknesses?

Example: a cafe or retail employee faces a customer complaint, an ambiguous order, an accessibility need, a stock-out, or several problems at once. The trainee responds; the system evaluates the response against explicit criteria, then generates a suitable next scenario.

### Why it is promising

- Easy to demonstrate a user loop.
- Combines simulation, generation, evaluation, and adaptation.
- Has a clear potential buyer in organizations that train frontline staff.
- Could use agents to simulate customers or stakeholders.

### Technical design

- Scenario templates with explicit difficulty, goals, and constraints.
- A state machine for scenario progression.
- Model-generated dialogue and scenario variants.
- Rubric-based evaluation with evidence.
- Difficulty adaptation based on performance.
- Scenario replay and performance dashboard.

### Main risks

- Evaluations can be subjective or inconsistent.
- LLM roleplay may not resemble real customer behavior.
- Training claims need evidence rather than a convincing-looking chat transcript.

### Scope-control strategy

Pick one job role and a small set of scenarios. Use a transparent rubric and compare model scoring with a fixed reference set.

**Possible track:** Create a New Kind of Experience or Intelligent Industry, depending on the setting.

## 7.6 Candidate F — Frontline Operational State

**Core question:** What if important business information did not disappear into email threads, chats, voice notes, and PDFs?

The system ingests operational updates, converts them into structured events, maintains a current state, detects conflicts or downstream impacts, and proposes or triggers actions.

### Why it is promising

- Strong match for real business workflows.
- A natural fit for Evolus workflows, extractors, knowledge libraries, and MCP integrations.
- Can show a clear end-to-end process rather than a generic assistant.

### Technical design

- Ingestion of a small number of document or message types.
- Schema-based extraction.
- Canonical state store with event history.
- Rules for conflicts, deadlines, dependencies, and escalation.
- Agent for interpreting ambiguous cases.
- Evolus workflow for the partner-track implementation.
- Human approval for consequential actions.

### Main risks

- Overlap with common AI workflow products and the Evolus track itself.
- Integration scope can grow quickly.
- Incorrect state changes can be worse than no automation.

### Scope-control strategy

Choose one specific process, one or two input types, and one measurable outcome. Use a review queue and audit trail.

**Possible track:** Reinvent Commerce, Intelligent Industry, or Evolus Business Agents on AMD.

---

# 8. Candidate comparison

This is a qualitative planning table, not a claim that any concept has been validated by customers.

| Concept | Core value | AMD fit | Demo clarity | Main risk |
|---|---|---:|---:|---|
| SME Decision-Rehearsal Simulation | Test business decisions before acting | High | High | Poorly calibrated assumptions |
| Generative Experience Engine | Compile grounded data into adaptive experiences | High | High if scoped tightly | Too abstract / broad |
| Academic Digital Twin | Model academic commitments and simulate choices | Medium–High | High with seeded data | Integration and privacy |
| Tourism Value-Dispersion Experience | Personalized experiences that spread visitor value | Medium–High | High and visual | Data rights and impact measurement |
| Adaptive Edge-Case Training | Personalized scenario practice and evaluation | High | High | Evaluation reliability |
| Frontline Operational State | Turn fragmented inputs into reliable operational state | High | High | Scope and workflow overlap |

## 8.1 Selection criteria

Before choosing, score each concept from 1–5 on:

1. Importance of the problem to a specific user.
2. Ability to demonstrate a complete working loop in one week.
3. Originality beyond a chatbot or wrapper.
4. AMD's meaningful contribution to the product.
5. Access to data or ability to create a credible test dataset.
6. Ability to measure performance or outcome.
7. Ability to explain the value in a short demo.
8. Implementation risk given available time and skills.

The chosen idea should win on demonstrable value and buildability, not on the number of technologies it can name-drop.

---

# 9. Recommended technical stack options

These are candidate stack families, not a finalized dependency list.

## Stack A — Simulation

- **Compute / serving:** AMD Developer Cloud + AMD Instinct + ROCm + vLLM.
- **Model:** a compatible Qwen3 instruct model.
- **State storage:** PostgreSQL or SQLite for structured state; JSON schemas for scenario configuration.
- **Simulation:** deterministic Python or TypeScript engine; optional Monte Carlo / parallel scenario execution if it adds measurable value.
- **Agent framework:** direct model API first; add LangGraph or another framework only if stateful orchestration is genuinely needed.
- **UI:** Streamlit for the fastest analytical demo, or a web frontend if interactive visuals are central.
- **Charts:** a normal plotting / charting library.
- **Evaluation:** fixed scenarios, known expected outputs, latency and throughput measurements.

## Stack B — Generative Experience Engine

- **Compute / serving:** AMD Developer Cloud + ROCm + vLLM.
- **Model:** Qwen3 for planning; Qwen3-VL only if visual input is part of the core.
- **Grounding:** relational database and/or Cognee; a small curated source corpus.
- **Schema:** JSON Schema or Pydantic for generated experience specifications.
- **Execution:** deterministic procedural renderer or application state machine.
- **Frontend:** web app; Three.js / WebGPU if a 3D browser experience is justified.
- **Evaluation:** factuality checks, schema validity, user-input variation, consistency, and generation cost.

## Stack C — Operational state / Evolus track

- **Compute / serving:** AMD Developer Cloud + open model served with vLLM.
- **Orchestration:** Evolus agents and workflows.
- **At least two Evolus building blocks:** for example, document extractor + workflow, or knowledge library + workflow.
- **State:** relational database with event history.
- **Integration:** REST APIs and/or MCP connectors.
- **Safety:** schema validation, idempotent actions, audit log, human approval, environment-based secrets.
- **Evaluation:** extraction accuracy, completion rate, handling of exceptions, latency, and time saved.

## Stack D — Tourism / multimodal experience

- **Compute / serving:** AMD Developer Cloud + ROCm + vLLM.
- **Model:** Qwen3; Qwen3-VL for relevant visual tasks.
- **Data:** curated public/licensed destination information, optional Bright Data ingestion where permitted.
- **Knowledge:** relational / geospatial store; Cognee if relationship-oriented retrieval adds value.
- **Routing:** deterministic geospatial filtering and scoring.
- **UI:** map plus personalized itinerary / narrative.
- **Evaluation:** constraint satisfaction, source coverage, diversity of recommendations, and route feasibility.

## 9.1 Keep the architecture lean

For the first vertical slice, a sensible default is:

1. One model endpoint.
2. One canonical data store.
3. One core engine or workflow.
4. One UI.
5. One evaluation harness.

Only add an additional framework or platform if it solves a specific bottleneck. Integration count is not a judging criterion.

---

# 10. Data model and trust requirements

Regardless of the selected idea, Bayang will need a clear boundary between raw evidence, inferred information, and system actions.

## 10.1 Suggested data record fields

For important facts or extracted records, consider:

- `id`
- `entity_type`
- `source_type`
- `source_id`
- `source_uri` or file reference
- `observed_at`
- `recorded_at`
- `valid_from` / `valid_until`, where relevant
- `extracted_value`
- `normalized_value`
- `confidence`, where meaningful
- `verification_status`
- `schema_version`
- `created_by` / processing step
- `supporting_evidence`

Not every project needs every field. Keep the model small enough to finish.

## 10.2 Separate fact, inference, and proposal

Label outputs as appropriate:

- **Observed:** directly present in a source.
- **Extracted:** read from a source and not yet verified.
- **Inferred:** derived from evidence or rules.
- **Simulated:** generated by a model of possible outcomes.
- **Proposed action:** a recommendation not yet executed.
- **Executed action:** an operation that actually occurred, with a trace.

This prevents a generated statement from quietly becoming a “fact” just because it appeared in a dashboard.

## 10.3 Use deterministic logic where correctness matters

Examples:

- Financial arithmetic and accounting identities.
- Route feasibility and hard time constraints.
- Deadline and dependency calculations.
- Inventory and capacity constraints.
- Scenario state transitions.
- Permission checks and action execution.
- Schema and type validation.

The LLM can help translate human language into structured inputs, but the application should validate those inputs before running them.

---

# 11. Evaluation and demo plan

A strong hackathon demo should prove one complete loop rather than show many disconnected features.

## 11.1 Demo structure

1. **State the problem:** one user, one costly or frustrating task.
2. **Show a baseline:** what the user does today, or a simple non-AI method.
3. **Provide input:** a document, scenario, user profile, or data change.
4. **Show the core transformation:** extraction, state construction, simulation, or experience planning.
5. **Show the result:** comparison, visualized state, generated experience, or executed workflow.
6. **Show validation:** source evidence, constraints, assumptions, or human review.
7. **Show measurement:** latency, throughput, accuracy, completion rate, time saved, scenario coverage, or another appropriate metric.
8. **Show AMD's role:** identify the AMD-hosted model and demonstrate that it powers a meaningful operation.

## 11.2 Potential metrics by concept

| Concept | Example metrics |
|---|---|
| SME simulation | Calculation correctness, scenarios/sec, known failure cases detected, sensitivity behavior |
| Experience engine | Schema-valid plan rate, source-grounded claims, response latency, experience differences across inputs |
| Academic digital twin | Deadline extraction accuracy, dependency detection, scenario recalculation time, user-confirmed task coverage |
| Tourism | Constraint satisfaction, route feasibility, recommendation diversity, share of non-top-ranked local stops |
| Adaptive training | Rubric agreement against reference cases, scenario coverage, improvement across attempts |
| Operational state | Field extraction accuracy, exception detection, workflow completion rate, time-to-resolution |

Do not claim business impact from a proxy metric. If measuring “tourism value dispersion” by recommendation diversity, say that this is a proxy rather than proof that money reached local businesses.

## 11.3 Benchmarking AMD usage

A minimal benchmark can report:

- Model name and version.
- AMD instance / hardware available.
- Serving framework and version.
- Request type and input size.
- Median and p95 latency, if enough requests are available.
- Successful requests / errors.
- Approximate throughput under a defined test.
- Whether the benchmark used real or synthetic inputs.

Keep benchmark conditions reproducible. A few carefully described measurements are better than an impressive number with no methodology.

---

# 12. Practical execution plan

## Before kickoff — October 11

- Do not spend the entire night adding more candidate ideas.
- Review the concept shortlist and select based on a real user problem, demo clarity, and buildability.
- Identify the minimum dataset needed.
- Decide whether Evolus is a core requirement or optional.
- Confirm AMD Developer Program access and available credits, if not already done.

## Kickoff — October 12

1. Confirm final event instructions, challenge tracks, deadlines, and any partner-track changes.
2. Choose one concept and define a one-sentence problem statement.
3. Define the demo's single end-to-end user journey.
4. Select the smallest viable model and stack.
5. Create the public repository and initial README.
6. Bring up the AMD model endpoint early if the selected architecture needs it.
7. Create a vertical-slice milestone for the first day.

## Build days — October 12–16

Recommended sequence:

1. **Day 1: skeleton.** Input → model / engine → result, even if ugly.
2. **Day 2: core correctness.** Structured data, rules, state model, error handling.
3. **Day 3: distinctive capability.** Simulation, adaptive experience, or end-to-end workflow.
4. **Day 4: evaluation.** Fixed test cases, known expected outputs, failure cases, metrics, and visible assumptions.
5. **Day 5: integration freeze.** Stabilize the end-to-end demo; fix the highest-impact failures.

This is a flexible planning template, not a claim about the event's exact schedule. Adjust it to the actual kickoff and submission requirements.

## Finalization — October 17–18

- Freeze new features early enough to test the full path.
- Verify setup from a clean environment.
- Ensure the deployed app and model endpoint are reachable.
- Test the demo using the exact inputs planned for the video.
- Record a fallback demo video in case live services fail.
- Confirm the public GitHub repository has a clear README and no secrets.
- Verify title, descriptions, tags, cover image, video, pitch slides, demo URL, and repository link.
- Submit before the official closing time: October 18, 2026, 15:00 UTC according to the live dashboard.

## Academic workload constraint

Bayang is being started during an existing academic workload. The immediate obligations noted during planning are:

- **Data Visualization:** prepare the visualization, ground truth, and supporting data for a double consultation on October 12.
- **Data Analytics:** finish the remaining PPT/report by October 13.
- **Metpen:** Chapter 1 and UTS video by October 14.
- **Composition:** resume the next stage on October 12.

The hackathon idea can wait until the urgent academic tasks are under control. The goal is to begin with a useful, rested build session rather than to create an elaborate architecture document at the cost of every existing deadline.

---

# 13. Open questions to resolve

These are genuine decisions, not a requirement to answer everything before coding.

## Product

- Who is the first user?
- What costly, risky, or frustrating decision or task do they face?
- What does the user do today without Bayang?
- What is the smallest complete behavior that makes Bayang useful?
- Which concept has the clearest demo and measurable outcome?

## Technical

- Is the core engine a simulator, experience compiler, or operational-state system?
- Does the product genuinely need a vision-language model?
- Is persistent knowledge-graph functionality necessary, or is a relational schema sufficient?
- Does Evolus reduce implementation time enough to justify the integration?
- What must be deterministic?
- What data can be used legally and reliably during the hackathon?

## Validation

- What known test cases can expose incorrect behavior?
- What baseline will the product be compared against?
- Which metrics can be measured in the time available?
- What are the expected failure modes?
- What requires human confirmation?

## Submission

- Which official track best fits the final concept?
- Is the team competing for the Evolus partner prize?
- Does the final implementation satisfy the exact partner requirements if so?
- Does the demo show AMD-powered inference in a meaningful path?
- Can a reviewer run the repository from the README?

---

# 14. Glossary

| Term | Meaning in this project |
|---|---|
| AMD Developer Cloud | Cloud access to compatible AMD GPU infrastructure |
| AMD Instinct | AMD data-center accelerator family |
| ROCm | AMD's open-source GPU compute software stack |
| vLLM | Model-serving engine that can expose an OpenAI-compatible API |
| Open-weight model | A model whose weights are available under specified terms; usage rights still depend on its license |
| VLM | Vision-language model that processes visual inputs and language |
| RAG | Retrieval-augmented generation: retrieving relevant source information to ground a model's response |
| Knowledge graph | Entities and relationships represented as a graph |
| Canonical state model | The application's normalized representation of the current system state |
| Event history | A record of changes over time, rather than only the latest value |
| Digital twin | A structured digital representation of a real system, potentially updated as the system changes |
| Counterfactual simulation | Exploring what might happen under a different action or condition |
| PCG | Procedural content generation: generating content through rules or algorithms |
| MCP | Model Context Protocol, a standard way for compatible AI clients to access tools and context |
| Agent | A model-driven component that reasons toward a goal and may use tools |
| Workflow | A defined sequence of steps, branches, triggers, and actions |
| Provenance | Information about where a fact or output came from |
| Human-in-the-loop | A design where a person reviews or approves relevant decisions or actions |

---

# 15. Source directory

Primary sources used to assemble this brief:

1. **AMD Developer Hackathon: ACT III**  
   https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii  
   Event dates, challenges, AMD requirement, Evolus partner-track requirements, submission checklist, judging criteria, partner descriptions, and prize information.

2. **ACT III live dashboard**  
   https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-iii/live  
   Kickoff and submission milestones. Check this again for event-day updates.

3. **Discover AI Technologies**  
   https://lablab.ai/tech  
   Technology discovery index and summaries for AMD, Qwen, Bright Data, Cognee, CAMEL, Band, TriggerWare, and other listed tools.

4. **ROCm on lablab.ai**  
   https://lablab.ai/tech/amd/amd-rocm  
   Overview of ROCm and supported AI / ML ecosystem components.

5. **AMD Developer Cloud tutorial: host an LLM with vLLM**  
   https://lablab.ai/ai-tutorials/amd-developer-cloud-host-llm-vllm  
   Example path for bringing up an AMD-hosted model endpoint.

6. **Deploy an AMD MI300X-backed app to Hugging Face Spaces**  
   https://lablab.ai/ai-tutorials/amd-huggingface-deployment-for-ai-hackathons  
   Example of separating the model-serving endpoint from a public demo UI.

7. **Cognee**  
   https://www.cognee.ai/  
   Project site for the knowledge-engineering / memory framework.

8. **CAMEL-AI**  
   https://www.camel-ai.org/  
   Project site for multi-agent systems and agent-society research.

9. **ROCm documentation**  
   https://rocm.docs.amd.com/  
   Official technical documentation.

10. **Qwen model family**  
    https://huggingface.co/Qwen  
    Model releases, model cards, and licensing details.

11. **Bright Data**  
    https://brightdata.com/  
    Official product information and data collection documentation.

12. **Evolus**  
    https://evolus.ai/  
    Platform information and developer resources. The ACT III workspace and track instructions remain the primary source for hackathon-specific requirements.

---

# Current status

- [x] Joined AMD Developer Hackathon: ACT III.
- [x] Established Bayang as the temporary codename.
- [x] Explored the major concept families and technical options.
- [ ] Select one product direction.
- [ ] Define the first user and measurable problem.
- [ ] Confirm the chosen challenge track.
- [ ] Decide whether to target the Evolus partner prize.
- [ ] Validate AMD endpoint access and model compatibility.
- [ ] Build the first end-to-end vertical slice.
- [ ] Add test cases and measurable evaluation.
- [ ] Prepare demo, slides, public repository, and submission.

**Working rule:** Bayang does not need to use every technology listed here. It needs to use the fewest technologies that can deliver one original, reliable, demonstrable result.

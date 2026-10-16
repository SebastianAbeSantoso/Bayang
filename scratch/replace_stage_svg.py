# Script to update client/app.js with 2x2 dollhouse stage renderer
import re

with open("client/app.js", "r", encoding="utf-8") as f:
    content = f.read()

new_render_func = '''function renderRoomStageSVG() {
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
    tip.textContent = `${d.name}\\nStatus: ${isCurtained ? 'Velvet Curtain Sealed' : 'Open Passageway'}\\n[Click to toggle Velvet Curtain]`;
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
      tip.textContent = `${char.name} (${char.role})\\nLocation: Chamber ${char.node || cid} (${cConf.name})\\nState: ${isLit ? 'Spotlighted (Accountable)' : 'In Shadow (Covert)'}\\nAction: ${char.room_action || "Observing"}\\nHP: ${char.hp}/${char.max_hp} | Stress: ${char.stress}% | Load: ${char.total_weight_kg}kg\\n[Click to Whisper / plant rumor]`;
      tg.appendChild(tip);

      svg.appendChild(tg);
    });
  });
}
'''

# Replace from function renderRoomStageSVG() up to function renderCastCards()
pattern = r"function renderRoomStageSVG\(\) \{[\s\S]*?\n(?=function renderCastCards\(\))"
assert re.search(pattern, content), "Could not find renderRoomStageSVG in client/app.js"

updated = re.sub(pattern, new_render_func + "\n", content, count=1)

with open("client/app.js", "w", encoding="utf-8") as f:
    f.write(updated)

print("Successfully replaced renderRoomStageSVG in client/app.js")

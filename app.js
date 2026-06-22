// Scora - Frontend Application State and Logic

let matches = [];
let standings = {};
let activeFilter = 'all';
let currentSelectedMatchId = null;
let simulationInterval = null;

// TLA Code to FlagCDN country code lookup
const tlaToCountryCode = {
  "ARG": "ar", "FRA": "fr", "BRA": "br", "CRO": "hr", "JPN": "jp", "ESP": "es", "MAR": "ma", "POR": "pt",
  "ENG": "gb-eng", "GER": "de", "USA": "us", "MEX": "mx", "SEN": "sn", "NED": "nl", "ECU": "ec", "QAT": "qa",
  "POL": "pl", "KSA": "sa", "AUS": "au", "DEN": "dk", "TUN": "tn", "BEL": "be", "CAN": "ca", "WAL": "gb-wls",
  "IRN": "ir", "CRC": "cr", "SUI": "ch", "CMR": "cm", "SRB": "rs", "GHA": "gh", "URU": "uy", "KOR": "kr",
  "RSA": "za", "SWE": "se", "ITA": "it", "COL": "co", "CHI": "cl", "PER": "pe", "NGA": "ng", "EGY": "eg",
  "ALG": "dz", "CIV": "ci", "NZL": "nz", "PAR": "py", "SVK": "sk", "HON": "hn", "GRE": "gr", "SVN": "si",
  "PRK": "kp", "UKR": "ua", "TUR": "tr", "RUS": "ru", "ROU": "ro", "NOR": "no", "MLT": "mt", "LUX": "lu",
  "LTU": "lt", "LVA": "lv", "KOS": "xk", "ISR": "il", "ISL": "is", "HUN": "hu", "GIB": "gi", "GEO": "ge",
  "FIN": "fi", "FRO": "fo", "EST": "ee", "CZE": "cz", "CYP": "cy", "BUL": "bg", "BIH": "ba", "BLR": "by",
  "AUT": "at", "ARM": "am", "AND": "ad", "ALB": "al"
};

// Safe wrapper to return crest URL, falling back to FlagCDN if the API image fails/blocks
function getCrestUrl(team) {
  if (!team) return 'https://flagcdn.com/h80/un.png';
  if (!team.crest || team.crest.includes('football-data.org')) {
    const code = tlaToCountryCode[team.tla];
    if (code) {
      return `https://flagcdn.com/h80/${code}.png`;
    }
  }
  return team.crest || 'https://flagcdn.com/h80/un.png';
}

// Default Static Timelines for Finished / Active Matches
const defaultTimelines = {
  1001: [
    { time: 11, type: "goal", detail: "Goal! Álvaro Morata (Spain)" },
    { time: 48, type: "goal", detail: "Goal! Ritsu Doan (Japan)" },
    { time: 51, type: "goal", detail: "Goal! Ao Tanaka (Japan)" },
    { time: 68, type: "card", detail: "Yellow Card - Shogo Taniguchi (Japan)" }
  ],
  1004: [
    { time: 17, type: "goal", detail: "Goal! Aurélien Tchouaméni (France)" },
    { time: 54, type: "goal", detail: "Goal! Harry Kane (England, Penalty)" },
    { time: 78, type: "goal", detail: "Goal! Olivier Giroud (France)" },
    { time: 84, type: "goal", detail: "Goal! Kylian Mbappé (France)" },
    { time: 89, type: "goal", detail: "Goal! Harry Kane (England)" }
  ],
  1005: [
    { time: 42, type: "card", detail: "Yellow Card - Sofyan Amrabat (Morocco)" },
    { time: 65, type: "substitution", detail: "Sub: Lovro Majer in, Mateo Kovacic out (Croatia)" },
    { time: 88, type: "card", detail: "Yellow Card - Dejan Lovren (Croatia)" }
  ]
};

// Start UI Initialization
document.addEventListener('DOMContentLoaded', () => {
  fetchMatches();
  setupEventListeners();
});

// Setup Click and Toggle Events
function setupEventListeners() {
  // Navigation filters
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      navBtns.forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      activeFilter = target.getAttribute('data-filter');
      renderMatches();
    });
  });

  // Toggle Live Simulator
  const simToggle = document.getElementById('simulator-toggle');
  simToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      startSimulator();
    } else {
      stopSimulator();
    }
  });

  // Modal close events
  document.getElementById('close-modal').addEventListener('click', closeModal);
  document.getElementById('match-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('match-modal')) {
      closeModal();
    }
  });
}

// Fetch matches from local Express proxy
async function fetchMatches() {
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');

  try {
    const response = await fetch('/api/matches');
    if (!response.ok) throw new Error('API request failed');

    const data = await response.json();
    matches = data.matches;

    // Attach timeline fields
    matches.forEach(match => {
      if (!match.timeline) {
        match.timeline = defaultTimelines[match.id] || [];
      }
      // Set initial minutes for live mock games if empty
      if (match.status === 'IN_PLAY' && !match.minute) {
        match.minute = match.minute || 74;
      }
    });

    // Update Status Badge
    if (data.source === 'api') {
      statusDot.className = 'status-indicator online';
      statusLabel.textContent = 'API ONLINE // LIVE';
    } else {
      statusDot.className = 'status-indicator mock';
      statusLabel.textContent = 'MOCK MODE // OFFLINE';
    }

    calculateStandings();
    renderMatches();
    renderStandings();

  } catch (error) {
    console.error('Fetch error:', error);
    statusDot.className = 'status-indicator offline';
    statusLabel.textContent = 'SERVER OFFLINE';
    
    // Show empty state error
    document.getElementById('matches-grid').innerHTML = `
      <div class="empty-state">
        <div class="spinner" style="animation: none; border-top-color: #dc3545;"></div>
        <h3>CONNECTION LOSS</h3>
        <p>Could not connect to the local server proxy. Please run <code>npm run dev</code> inside the project directory.</p>
      </div>
    `;
  }
}

// Dynamically Calculate Standings based on Match Scores
function calculateStandings() {
  standings = {};

  // First pass: discover all groups and teams from the match list
  matches.forEach(match => {
    const groupName = match.group;
    if (!groupName || groupName === 'null') return;

    if (!standings[groupName]) {
      standings[groupName] = [];
    }

    // Add home team if not present
    if (match.homeTeam && match.homeTeam.name) {
      if (!standings[groupName].some(t => t.name === match.homeTeam.name)) {
        standings[groupName].push({
          name: match.homeTeam.name,
          tla: match.homeTeam.tla || match.homeTeam.name.substring(0, 3).toUpperCase(),
          crest: getCrestUrl(match.homeTeam),
          p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0
        });
      }
    }

    // Add away team if not present
    if (match.awayTeam && match.awayTeam.name) {
      if (!standings[groupName].some(t => t.name === match.awayTeam.name)) {
        standings[groupName].push({
          name: match.awayTeam.name,
          tla: match.awayTeam.tla || match.awayTeam.name.substring(0, 3).toUpperCase(),
          crest: getCrestUrl(match.awayTeam),
          p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0
        });
      }
    }
  });

  // Second pass: compile scores and standings
  matches.forEach(match => {
    if (match.status !== 'FINISHED' && match.status !== 'IN_PLAY') return;

    const groupName = match.group;
    if (!groupName || !standings[groupName]) return;

    const homeScore = match.score.fullTime.home;
    const awayScore = match.score.fullTime.away;
    if (homeScore === null || awayScore === null) return;

    const homeTeam = standings[groupName].find(t => t.name === match.homeTeam.name);
    const awayTeam = standings[groupName].find(t => t.name === match.awayTeam.name);

    if (homeTeam && awayTeam) {
      homeTeam.p += 1;
      awayTeam.p += 1;
      homeTeam.gf += homeScore;
      homeTeam.ga += awayScore;
      awayTeam.gf += awayScore;
      awayTeam.ga += homeScore;

      if (homeScore > awayScore) {
        homeTeam.w += 1;
        homeTeam.pts += 3;
        awayTeam.l += 1;
      } else if (awayScore > homeScore) {
        awayTeam.w += 1;
        awayTeam.pts += 3;
        homeTeam.l += 1;
      } else {
        homeTeam.d += 1;
        homeTeam.pts += 1;
        awayTeam.d += 1;
        awayTeam.pts += 1;
      }
    }
  });

  // Sort each group by PTS, then Goal Difference, then Goals Scored
  for (const group in standings) {
    standings[group].sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
  }
}

// Render Matches Grid
function renderMatches() {
  const grid = document.getElementById('matches-grid');
  grid.innerHTML = '';

  const filteredMatches = matches.filter(match => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'live') return match.status === 'IN_PLAY' || match.status === 'PAUSED';
    if (activeFilter === 'upcoming') return match.status === 'TIMED' || match.status === 'SCHEDULED';
    if (activeFilter === 'finished') return match.status === 'FINISHED';
    return true;
  });

  if (filteredMatches.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>NO CORRESPONDING MATCHES FOUND IN THIS ARENA.</p>
      </div>
    `;
    return;
  }

  // Sort: Live first, then upcoming by date, then finished descending
  filteredMatches.sort((a, b) => {
    const statusWeight = { 'IN_PLAY': 0, 'PAUSED': 1, 'TIMED': 2, 'SCHEDULED': 3, 'FINISHED': 4 };
    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[a.status] - statusWeight[b.status];
    }
    return new Date(a.utcDate) - new Date(b.utcDate);
  });

  filteredMatches.forEach(match => {
    const card = document.createElement('div');
    card.className = 'match-card';
    card.setAttribute('data-id', match.id);
    card.addEventListener('click', () => openModal(match.id));

    // Date formatting
    const dateObj = new Date(match.utcDate);
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

    // Status classes
    let statusClass = 'upcoming';
    let statusLabel = 'UPCOMING';
    let liveMinuteMarkup = '';

    if (match.status === 'FINISHED') {
      statusClass = 'finished';
      statusLabel = 'FINISHED';
    } else if (match.status === 'IN_PLAY') {
      statusClass = 'live';
      statusLabel = 'LIVE';
      liveMinuteMarkup = `<span class="live-minute">${match.minute}'</span>`;
    }

    // Score display
    const homeScore = match.score.fullTime.home !== null ? match.score.fullTime.home : '-';
    const awayScore = match.score.fullTime.away !== null ? match.score.fullTime.away : '-';

    card.innerHTML = `
      <div class="match-meta">
        <span class="stage-badge">${match.stage.replace('_', ' ')}</span>
        <span class="match-group">${match.group ? match.group.replace('_', ' ') : ''}</span>
        <span class="match-date-time">${dateStr} @ ${timeStr}</span>
      </div>
      <div class="match-teams-box">
        <div class="team-display home">
          <span class="team-name">${match.homeTeam.name}</span>
          <img class="team-crest" src="${getCrestUrl(match.homeTeam)}" alt="${match.homeTeam.name}">
        </div>
        <div class="score-box">
          <span>${homeScore}</span>
          <span class="score-divider">:</span>
          <span>${awayScore}</span>
        </div>
        <div class="team-display away">
          <img class="team-crest" src="${getCrestUrl(match.awayTeam)}" alt="${match.awayTeam.name}">
          <span class="team-name">${match.awayTeam.name}</span>
        </div>
      </div>
      <div class="match-status-badge">
        <span class="status-badge ${statusClass}">${statusLabel}</span>
        ${liveMinuteMarkup}
      </div>
    `;

    grid.appendChild(card);
  });
}

// Render Standings Table
function renderStandings() {
  const container = document.getElementById('groups-container');
  container.innerHTML = '';

  for (const groupName in standings) {
    const card = document.createElement('div');
    card.className = 'group-card';
    
    let tableRows = '';
    standings[groupName].forEach((team, index) => {
      const isLeader = index < 2 ? 'leader-row' : '';
      tableRows += `
        <tr class="${isLeader}">
          <td>
            <div class="table-team">
              <span style="color: var(--text-muted); font-size: 0.75rem; width: 12px;">${index + 1}</span>
              <img class="table-crest" src="${team.crest}" alt="${team.name}">
              <span>${team.tla || team.name.substring(0,3).toUpperCase()}</span>
            </div>
          </td>
          <td class="table-stats">${team.p}</td>
          <td class="table-stats">${team.gf - team.ga >= 0 ? '+' : ''}${team.gf - team.ga}</td>
          <td class="table-stats table-pts">${team.pts}</td>
        </tr>
      `;
    });

    card.innerHTML = `
      <div class="group-title">${groupName.replace('_', ' ')}</div>
      <table class="group-table">
        <thead>
          <tr>
            <th>TEAM</th>
            <th style="text-align: right;">P</th>
            <th style="text-align: right;">GD</th>
            <th style="text-align: right;">PTS</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    container.appendChild(card);
  }
}

// Open Detail Modal
function openModal(matchId) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  currentSelectedMatchId = matchId;

  document.getElementById('modal-stage').textContent = match.stage.replace('_', ' ');
  document.getElementById('modal-group').textContent = match.group ? match.group.replace('_', ' ') : '';
  
  document.getElementById('modal-home-crest').src = getCrestUrl(match.homeTeam);
  document.getElementById('modal-home-name').textContent = match.homeTeam.name;
  document.getElementById('modal-away-crest').src = getCrestUrl(match.awayTeam);
  document.getElementById('modal-away-name').textContent = match.awayTeam.name;

  document.getElementById('modal-home-score').textContent = match.score.fullTime.home !== null ? match.score.fullTime.home : '0';
  document.getElementById('modal-away-score').textContent = match.score.fullTime.away !== null ? match.score.fullTime.away : '0';
  
  const statusBadge = document.getElementById('modal-status');
  if (match.status === 'FINISHED') {
    statusBadge.textContent = 'FINISHED';
  } else if (match.status === 'IN_PLAY') {
    statusBadge.textContent = `LIVE - ${match.minute}'`;
  } else {
    statusBadge.textContent = 'TIMED';
  }

  renderTimeline(match);

  document.getElementById('match-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('match-modal').classList.remove('open');
  currentSelectedMatchId = null;
}

// Render timeline events in the modal
function renderTimeline(match) {
  const container = document.getElementById('modal-timeline');
  container.innerHTML = '';

  if (!match.timeline || match.timeline.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">The referee's scroll is empty. No major events have transpired yet.</p>`;
    return;
  }

  // Sort timeline events by time ascending
  const sortedEvents = [...match.timeline].sort((a, b) => a.time - b.time);

  sortedEvents.forEach(event => {
    const item = document.createElement('div');
    item.className = `timeline-event ${event.type}`;
    item.innerHTML = `
      <span class="event-time">${event.time}'</span>
      <div class="event-details">
        <span class="event-type ${event.type}">${event.type}</span>
        <span class="event-desc">${event.detail}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// ==========================================
// ANIME LIVE SIMULATOR SYSTEM
// ==========================================

function startSimulator() {
  console.log("Anime Simulator Engaged! Initiating dynamic simulation loop.");
  
  // Make sure we have at least one match currently live
  let liveMatches = matches.filter(m => m.status === 'IN_PLAY');
  if (liveMatches.length === 0) {
    // If no live matches, turn the next upcoming match to LIVE!
    const upcoming = matches.find(m => m.status === 'TIMED' || m.status === 'SCHEDULED');
    if (upcoming) {
      upcoming.status = 'IN_PLAY';
      upcoming.minute = 1;
      upcoming.score.fullTime.home = 0;
      upcoming.score.fullTime.away = 0;
      upcoming.timeline = [
        { time: 1, type: "whistle", detail: "Match kick-off! The battlefield is set." }
      ];
      console.log(`Kicked off new match: ${upcoming.homeTeam.name} vs ${upcoming.awayTeam.name}`);
    }
  }

  // Setup interval to trigger events
  simulationInterval = setInterval(() => {
    simulateStep();
  }, 7000); // Trigger a game event every 7 seconds
}

function stopSimulator() {
  console.log("Anime Simulator Disengaged.");
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

function simulateStep() {
  const liveMatches = matches.filter(m => m.status === 'IN_PLAY');
  if (liveMatches.length === 0) {
    stopSimulator();
    document.getElementById('simulator-toggle').checked = false;
    return;
  }

  // Pick a random live match
  const match = liveMatches[Math.floor(Math.random() * liveMatches.length)];
  
  // Increment minute
  match.minute += Math.floor(Math.random() * 4) + 1;

  // Check if match should end
  if (match.minute >= 90) {
    match.minute = 90;
    match.status = 'FINISHED';
    match.timeline.push({
      time: 90,
      type: "whistle",
      detail: `Full time whistle! ${match.homeTeam.name} ${match.score.fullTime.home} - ${match.score.fullTime.away} ${match.awayTeam.name}`
    });
    console.log(`Match finished: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    
    // Auto trigger another upcoming game if available
    const nextGame = matches.find(m => m.status === 'TIMED' || m.status === 'SCHEDULED');
    if (nextGame) {
      nextGame.status = 'IN_PLAY';
      nextGame.minute = 1;
      nextGame.score.fullTime.home = 0;
      nextGame.score.fullTime.away = 0;
      nextGame.timeline = [{ time: 1, type: "whistle", detail: "Match kick-off! Let the duel begin!" }];
    }
  } else {
    // Generate match event
    const roll = Math.random();
    if (roll < 0.25) {
      // Goal event!
      const scoringTeam = Math.random() < 0.5 ? 'home' : 'away';
      const player = getRandomPlayerName(scoringTeam === 'home' ? match.homeTeam.name : match.awayTeam.name);
      
      if (scoringTeam === 'home') {
        match.score.fullTime.home++;
      } else {
        match.score.fullTime.away++;
      }

      const goalEvent = {
        time: match.minute,
        type: "goal",
        detail: `GOAL! ${player} scores with a spectacular impact shot!`
      };
      match.timeline.push(goalEvent);

      // Trigger Anime Screen Impact
      triggerImpactFlash(
        scoringTeam === 'home' ? match.homeTeam.name : match.awayTeam.name, 
        `${match.score.fullTime.home} - ${match.score.fullTime.away}`
      );

    } else if (roll < 0.45) {
      // Booking event
      const teamSelector = Math.random() < 0.5 ? 'home' : 'away';
      const teamName = teamSelector === 'home' ? match.homeTeam.name : match.awayTeam.name;
      const player = getRandomPlayerName(teamName);
      
      const cardEvent = {
        time: match.minute,
        type: "card",
        detail: `Yellow Card - ${player} (${teamName}) is booked for a reckless tackle!`
      };
      match.timeline.push(cardEvent);
    }
  }

  // Recalculate standings, update UI
  calculateStandings();
  renderMatches();
  renderStandings();

  // If the user has this match open in the modal, update it in real-time
  if (currentSelectedMatchId === match.id) {
    document.getElementById('modal-home-score').textContent = match.score.fullTime.home;
    document.getElementById('modal-away-score').textContent = match.score.fullTime.away;
    document.getElementById('modal-status').textContent = match.status === 'FINISHED' ? 'FINISHED' : `LIVE - ${match.minute}'`;
    renderTimeline(match);
  }
}

// Fullscreen goal blast trigger
function triggerImpactFlash(teamName, score) {
  const overlay = document.getElementById('impact-overlay');
  const details = document.getElementById('impact-details');
  
  details.textContent = `${teamName.toUpperCase()} SCORED! [${score}]`;
  overlay.classList.add('active');

  setTimeout(() => {
    overlay.classList.remove('active');
  }, 2500);
}

// Random Anime-style / Famous Player Name Generator for variety
function getRandomPlayerName(team) {
  const players = {
    "Japan": ["Kamado", "Tsubasa", "Isagi", "Itoshi", "Hyuga", "Bachira", "Nagi", "Kunigami"],
    "Spain": ["Pedri", "Gavi", "Yamal", "Morata", "Williams", "Rodri", "Olmo", "Cucurella"],
    "Argentina": ["Messi", "Martinez", "Di Maria", "De Paul", "Alvarez", "Fernandez", "Mac Allister"],
    "France": ["Mbappé", "Griezmann", "Dembele", "Tchouaméni", "Camavinga", "Giroud", "Hernandez"],
    "Brazil": ["Neymar Jr", "Vinicius Jr", "Rodrygo", "Raphinha", "Paqueta", "Richarlison", "Casemiro"],
    "Portugal": ["Ronaldo", "Bruno Fernandes", "Leão", "Bernardo", "Felix", "Ramos", "Cancelo"],
    "England": ["Kane", "Bellingham", "Saka", "Foden", "Palmer", "Rice", "Stones", "Walker"],
    "Croatia": ["Modric", "Kovacic", "Gvardiol", "Perisic", "Kramaric", "Brozovic", "Pasalic"],
    "Morocco": ["Hakimi", "Ziyech", "En-Nesyri", "Amrabat", "Bounou", "Ounahi", "Boufal"],
    "Germany": ["Musiala", "Wirtz", "Müller", "Havertz", "Gündogan", "Sane", "Kimmich", "Rüdiger"],
    "USA": ["Pulisic", "Weah", "McKennie", "Reyna", "Balogun", "Musah", "Adams", "Dest"],
    "Mexico": ["Ochoa", "Gimenez", "Lozano", "Alvarez", "Chavez", "Martin", "Sanchez"],
    "Senegal": ["Mané", "Sarr", "Jackson", "Gueye", "Mendy", "Koulibaly", "Diallo"],
    "Netherlands": ["Depay", "Gakpo", "Simons", "de Jong", "van Dijk", "Aké", "Dumfries"]
  };

  const list = players[team] || ["Hero", "Striker", "Captain", "Ace", "Midfielder"];
  return list[Math.floor(Math.random() * list.length)];
}

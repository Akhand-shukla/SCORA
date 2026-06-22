const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_TOKEN = '0582853f2ab2452583005d31e9f5a533';

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname));

// Mock data fallback in case the API fails, rate-limits, or does not support the World Cup endpoints on free tier
const mockWorldCupData = {
  competition: {
    id: 2000,
    name: "FIFA World Cup",
    code: "WC",
    emblem: "https://crests.football-data.org/WC.png"
  },
  matches: [
    {
      id: 1001,
      utcDate: new Date(Date.now() - 3600000 * 2).toISOString(),
      status: "FINISHED",
      matchday: 3,
      stage: "GROUP_STAGE",
      group: "GROUP_E",
      homeTeam: {
        name: "Japan",
        tla: "JPN",
        crest: "https://flagcdn.com/h80/jp.png"
      },
      awayTeam: {
        name: "Spain",
        tla: "ESP",
        crest: "https://flagcdn.com/h80/es.png"
      },
      score: {
        winner: "HOME_TEAM",
        duration: "REGULAR",
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 0, away: 1 }
      }
    },
    {
      id: 1002,
      utcDate: new Date(Date.now() + 3600000 * 24).toISOString(),
      status: "TIMED",
      matchday: 4,
      stage: "GROUP_STAGE",
      group: "GROUP_G",
      homeTeam: {
        name: "Brazil",
        tla: "BRA",
        crest: "https://flagcdn.com/h80/br.png"
      },
      awayTeam: {
        name: "Portugal",
        tla: "POR",
        crest: "https://flagcdn.com/h80/pt.png"
      },
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null }
      }
    },
    {
      id: 1003,
      utcDate: new Date(Date.now() + 3600000 * 48).toISOString(),
      status: "TIMED",
      matchday: 4,
      stage: "GROUP_STAGE",
      group: "GROUP_C",
      homeTeam: {
        name: "Argentina",
        tla: "ARG",
        crest: "https://flagcdn.com/h80/ar.png"
      },
      awayTeam: {
        name: "Mexico",
        tla: "MEX",
        crest: "https://flagcdn.com/h80/mx.png"
      },
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null }
      }
    },
    {
      id: 1004,
      utcDate: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
      status: "FINISHED",
      matchday: 2,
      stage: "GROUP_STAGE",
      group: "GROUP_D",
      homeTeam: {
        name: "France",
        tla: "FRA",
        crest: "https://flagcdn.com/h80/fr.png"
      },
      awayTeam: {
        name: "England",
        tla: "ENG",
        crest: "https://flagcdn.com/h80/gb-eng.png"
      },
      score: {
        winner: "HOME_TEAM",
        duration: "REGULAR",
        fullTime: { home: 3, away: 2 },
        halfTime: { home: 1, away: 1 }
      }
    },
    {
      id: 1005,
      utcDate: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
      status: "FINISHED",
      matchday: 1,
      stage: "GROUP_STAGE",
      group: "GROUP_F",
      homeTeam: {
        name: "Croatia",
        tla: "CRO",
        crest: "https://flagcdn.com/h80/hr.png"
      },
      awayTeam: {
        name: "Morocco",
        tla: "MAR",
        crest: "https://flagcdn.com/h80/ma.png"
      },
      score: {
        winner: "DRAW",
        duration: "REGULAR",
        fullTime: { home: 0, away: 0 },
        halfTime: { home: 0, away: 0 }
      }
    },
    {
      id: 1006,
      utcDate: new Date(Date.now() + 3600000 * 4).toISOString(),
      status: "TIMED",
      matchday: 3,
      stage: "GROUP_STAGE",
      group: "GROUP_A",
      homeTeam: {
        name: "Netherlands",
        tla: "NED",
        crest: "https://flagcdn.com/h80/nl.png"
      },
      awayTeam: {
        name: "Senegal",
        tla: "SEN",
        crest: "https://flagcdn.com/h80/sn.png"
      },
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null }
      }
    },
    {
      id: 1007,
      utcDate: new Date(Date.now() + 3600000 * 72).toISOString(),
      status: "TIMED",
      matchday: 5,
      stage: "GROUP_STAGE",
      group: "GROUP_B",
      homeTeam: {
        name: "USA",
        tla: "USA",
        crest: "https://flagcdn.com/h80/us.png"
      },
      awayTeam: {
        name: "Germany",
        tla: "GER",
        crest: "https://flagcdn.com/h80/de.png"
      },
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null }
      }
    }
  ]
};

// API proxy route
app.get('/api/matches', async (req, res) => {
  try {
    const url = 'https://api.football-data.org/v4/competitions/WC/matches';
    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': API_TOKEN
      }
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data.matches ? data.matches.length : 0} matches from API.`);
    res.json({
      source: 'api',
      competition: data.competition,
      matches: data.matches
    });
  } catch (error) {
    console.warn('API fetch failed, serving mock data instead:', error.message);
    res.json({
      source: 'mock',
      competition: mockWorldCupData.competition,
      matches: mockWorldCupData.matches
    });
  }
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Buttons & elements
const simulateBtn = document.getElementById('simulateBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const tipsBtn = document.getElementById('tipsBtn');

const alertEl = document.getElementById('alertValue');
const indicator = document.getElementById('indicator');
const negCount = document.getElementById('negCount');
const neuCount = document.getElementById('neuCount');
const posCount = document.getElementById('posCount');
const feedEl = document.getElementById('feed');

const trendCtx = document.getElementById('trendChart').getContext('2d');
const sentCtx = document.getElementById('sentChart').getContext('2d');

// Charts
const trendChart = new Chart(trendCtx, {
  type: 'line',
  data: { labels: [], datasets: [{ label: 'Alert score', data: [], tension: 0.3, fill: true }] },
  options: { scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
});
const sentChart = new Chart(sentCtx, {
  type: 'doughnut',
  data: { labels: ['Negative', 'Neutral', 'Positive'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#ff6b6b', '#6b7b8f', '#2bd4a7'] }] },
  options: { plugins: { legend: { position: 'bottom', labels: { color: '#e6eef6' } } } }
});

// Map
const map = L.map('map', { zoomControl: false }).setView([20.6, 78.9], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '' }).addTo(map);
let markers = [];
function clearMarkers() { markers.forEach(m => map.removeLayer(m)); markers = []; }

// Random helpers
function randomBetween(min, max) { return Math.random() * (max - min) + min; }

// Geographic bounds for each region [minLat, maxLat, minLon, maxLon]
const regionBounds = {
  "india": { lat: [8, 35], lon: [68, 97] },
  "usa": { lat: [25, 49], lon: [-125, -67] },
  "indonesia": { lat: [-11, 6], lon: [95, 141] },
  "australia": { lat: [-44, -10], lon: [112, 154] },
  "japan": { lat: [24, 46], lon: [123, 146] },
  "brazil": { lat: [-34, 5], lon: [-74, -32] },
  "uk": { lat: [49, 61], lon: [-11, 2] },
  "germany": { lat: [47, 55], lon: [5, 15] },
  "france": { lat: [41, 51], lon: [-5, 10] },
  "italy": { lat: [36, 47], lon: [6, 19] },
  "spain": { lat: [36, 44], lon: [-10, 5] },
  "canada": { lat: [42, 70], lon: [-141, -52] },
  "china": { lat: [18, 54], lon: [73, 135] },
  "southafrica": { lat: [-35, -22], lon: [16, 33] },
  "mexico": { lat: [14, 33], lon: [-118, -86] },
  "russia": { lat: [41, 82], lon: [19, 180] },
  "argentina": { lat: [-55, -21], lon: [-74, -53] },
  "newzealand": { lat: [-47, -34], lon: [166, 179] },
  "singapore": { lat: [1.15, 1.47], lon: [103.6, 104.1] },
  "any": { lat: [-60, 70], lon: [-180, 180] }
};

function randomLatLonIn(region) {
  const bounds = regionBounds[region.toLowerCase()] || regionBounds["any"];
  return [
    randomBetween(bounds.lat[0], bounds.lat[1]),
    randomBetween(bounds.lon[0], bounds.lon[1])
  ];
}

// Generate demo posts
function generateDemoPosts(n = 8, keyword = 'flood', region = 'any') {
  const types = ['Flood', 'Wildfire', 'Landslide', 'Cyclone', 'Earthquake', 'Drought'];
  const posts = [];
  for (let i = 0; i < n; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const latlon = randomLatLonIn(region);
    const severity = +(Math.min(4, Math.random() * 3 + (type === 'Earthquake' ? 1.2 : 0))).toFixed(2);
    const text = `${keyword} ${type} reported — severity:${Math.round(severity * 25)}%`;
    posts.push({ text, lat: latlon[0], lon: latlon[1], timestamp: Date.now() - i * 60000, severity });
  }
  return posts;
}

// Update indicator
function updateIndicator(value) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const dash = 100 - pct;
  indicator.style.strokeDashoffset = dash;
  alertEl.textContent = pct + '%';
}

// Filter posts by region and keyword (client-side filtering for relevance)
function filterPostsByRegionAndKeyword(posts, keyword, region) {
  // Map region codes to searchable terms
  const regionTerms = {
    "india": ["india", "indian", "delhi", "mumbai", "chennai", "bangalore", "kolkata"],
    "usa": ["usa", "united states", "america", "american", "california", "texas", "florida", "new york"],
    "indonesia": ["indonesia", "indonesian", "jakarta", "java", "sumatra", "bali"],
    "australia": ["australia", "australian", "sydney", "melbourne", "queensland", "victoria"],
    "japan": ["japan", "japanese", "tokyo", "osaka", "kyoto", "hokkaido"],
    "brazil": ["brazil", "brazilian", "são paulo", "rio", "amazon", "brasilia"],
    "uk": ["uk", "united kingdom", "britain", "british", "england", "london", "scotland", "wales"],
    "germany": ["germany", "german", "berlin", "munich", "frankfurt", "hamburg"],
    "france": ["france", "french", "paris", "lyon", "marseille"],
    "italy": ["italy", "italian", "rome", "milan", "venice", "naples"],
    "spain": ["spain", "spanish", "madrid", "barcelona", "valencia"],
    "canada": ["canada", "canadian", "toronto", "vancouver", "ontario", "quebec"],
    "china": ["china", "chinese", "beijing", "shanghai", "guangzhou", "shenzhen"],
    "southafrica": ["south africa", "african", "johannesburg", "cape town", "pretoria"],
    "mexico": ["mexico", "mexican", "mexico city", "cancun", "guadalajara"],
    "russia": ["russia", "russian", "moscow", "st. petersburg", "siberia"],
    "argentina": ["argentina", "argentine", "buenos aires"],
    "newzealand": ["new zealand", "kiwi", "auckland", "wellington"],
    "singapore": ["singapore", "singaporean"]
  };

  // If region is 'any', skip region filtering
  if (region.toLowerCase() === 'any') {
    return posts;
  }

  const searchTerms = regionTerms[region.toLowerCase()] || [region.toLowerCase()];
  const keywordLower = keyword.toLowerCase();

  // Filter posts that either contain region terms OR the keyword
  const filtered = posts.filter(p => {
    const textLower = p.text.toLowerCase();
    const hasRegion = searchTerms.some(term => textLower.includes(term));
    const hasKeyword = textLower.includes(keywordLower);
    // Post should have keyword AND (region term OR be from the right geographic coords)
    return hasKeyword || hasRegion;
  });

  // Sort by relevance (posts with both keyword AND region term first)
  filtered.sort((a, b) => {
    const aText = a.text.toLowerCase();
    const bText = b.text.toLowerCase();
    const aHasRegion = searchTerms.some(term => aText.includes(term));
    const bHasRegion = searchTerms.some(term => bText.includes(term));
    const aHasKeyword = aText.includes(keywordLower);
    const bHasKeyword = bText.includes(keywordLower);

    const aScore = (aHasRegion ? 2 : 0) + (aHasKeyword ? 1 : 0);
    const bScore = (bHasRegion ? 2 : 0) + (bHasKeyword ? 1 : 0);

    return bScore - aScore;
  });

  return filtered;
}

// Render posts
function render(posts) {
  let neg = 0, neu = 0, pos = 0, scoreSum = 0;
  feedEl.innerHTML = '';

  posts.forEach(p => {
    const d = document.createElement('div');
    d.className = 'post';
    const left = document.createElement('div');
    left.className = 'left-ind';
    const color = p.severity > 2 ? '#ff6b6b' : (p.severity > 1 ? '#ff9f1c' : '#2bd4a7');
    left.style.background = color;

    // Disaster emoji
    let emoji = '';
    const textLower = p.text.toLowerCase();
    if (textLower.includes('flood')) emoji = '🌊';
    else if (textLower.includes('wildfire')) emoji = '🔥';
    else if (textLower.includes('earthquake')) emoji = '🌍';
    else if (textLower.includes('landslide')) emoji = '⛰️';
    else if (textLower.includes('cyclone')) emoji = '🌀';
    else if (textLower.includes('drought')) emoji = '☀️';

    // Severity symbol
    let sevSymbol = p.severity > 2 ? '🔴' : (p.severity > 1 ? '🟠' : '🟢');

    const body = document.createElement('div');
    body.style.flex = 1;
    body.innerHTML = `<div style="font-weight:700">${emoji} ${p.text} ${sevSymbol}</div>
                      <div style="font-size:12px;color:#9aa6b2">${new Date(p.timestamp).toLocaleString()}</div>`;

    d.appendChild(left);
    d.appendChild(body);
    feedEl.appendChild(d);

    if (p.severity > 1.5) neg++; else if (p.severity > 0.5) neu++; else pos++;
    scoreSum += p.severity * 20;
  });

  negCount.textContent = neg;
  neuCount.textContent = neu;
  posCount.textContent = pos;

  const avgScore = posts.length ? Math.round(scoreSum / posts.length) : 0;
  updateIndicator(avgScore);

  const timeLabel = new Date().toLocaleTimeString();
  trendChart.data.labels.push(timeLabel);
  trendChart.data.datasets[0].data.push(avgScore);
  if (trendChart.data.labels.length > 12) {
    trendChart.data.labels.shift();
    trendChart.data.datasets[0].data.shift();
  }
  trendChart.update();

  sentChart.data.datasets[0].data = [neg, neu, pos];
  sentChart.update();

  // Map markers with emoji + severity
  clearMarkers();
  posts.forEach(p => {
    const color = p.severity > 2 ? '#ff6b6b' : (p.severity > 1 ? '#ff9f1c' : '#2bd4a7');
    let emoji = '';
    const textLower = p.text.toLowerCase();
    if (textLower.includes('flood')) emoji = '🌊';
    else if (textLower.includes('wildfire')) emoji = '🔥';
    else if (textLower.includes('earthquake')) emoji = '🌍';
    else if (textLower.includes('landslide')) emoji = '⛰️';
    else if (textLower.includes('cyclone')) emoji = '🌀';
    else if (textLower.includes('drought')) emoji = '☀️';
    let sevSymbol = p.severity > 2 ? '🔴' : (p.severity > 1 ? '🟠' : '🟢');

    const c = L.circleMarker([p.lat, p.lon], {
      radius: 8,
      fillColor: color,
      color: '#000',
      weight: 0.6,
      fillOpacity: 0.95
    }).addTo(map);

    c.bindPopup(`<b>${emoji} ${p.text} ${sevSymbol}</b><br>${new Date(p.timestamp).toLocaleString()}`);
    markers.push(c);
  });

  if (posts.length > 0 && markers.length) map.setView([posts[0].lat, posts[0].lon], 5);
}

// Auto simulation
let autoTimer = null;
simulateBtn.addEventListener('click', async () => {
  const k = document.getElementById('keyword').value || 'flood';
  const r = document.getElementById('region').value || 'any';

  const useReal = confirm("Fetch live posts from Reddit? (Requires backend API key). OK for real, Cancel for demo.");

  let result;
  if (useReal) {
    try {
      result = await analyzeWithAPI([], k, r, true);
      console.log("Backend Response:", result);
      if (result.error) { alert("Error from server: " + result.error); return; }

      // Apply client-side filtering for better relevance
      const filteredPosts = filterPostsByRegionAndKeyword(result.posts, k, r);
      console.log(`Filtered ${result.posts.length} posts to ${filteredPosts.length} relevant posts`);

      if (filteredPosts.length === 0) {
        alert(`No posts found matching "${k}" in the selected region. Try selecting "Any / Global" or a different keyword.`);
        return;
      }

      render(filteredPosts);
      updateIndicator(result.score);
      negCount.textContent = result.neg;
      neuCount.textContent = result.neu;
      posCount.textContent = result.pos;
      if (autoTimer) clearInterval(autoTimer);
    } catch (err) {
      alert("Failed to fetch or analyze real data. See console for details.");
      console.error("Fetch Error:", err);
    }
  } else {
    const posts = generateDemoPosts(9, k, r);
    render(posts);
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      const posts2 = generateDemoPosts(6, k, r);
      render(posts2);
    }, 3500);
  }
});

// Clear
clearBtn.addEventListener('click', () => {
  if (autoTimer) clearInterval(autoTimer);
  updateIndicator(0);
  negCount.textContent = neuCount.textContent = posCount.textContent = 0;
  feedEl.innerHTML = '';
  clearMarkers();
  trendChart.data.labels = []; trendChart.data.datasets[0].data = []; trendChart.update();
  sentChart.data.datasets[0].data = [0, 0, 0]; sentChart.update();
});

// Export
exportBtn.addEventListener('click', () => {
  const posts = Array.from(feedEl.querySelectorAll('.post')).map(p => ({
    text: p.querySelector('div[style*="font-weight"]').innerText,
    time: p.querySelector('div[style*="font-size"]').innerText
  }));

  const blob = new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'posts.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// Tips
tipsBtn.addEventListener('click', () => {
  alert('Training tips:\n1) Label 2-5k Reddit posts across classes.\n2) Fine-tune DistilBERT for classification.\n3) Predict severity via a regression head.');
});

// Theme toggle
const toggleBtn = document.getElementById('theme-toggle');
toggleBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme === 'dark') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.setAttribute('data-theme', 'dark');
});

document.addEventListener('DOMContentLoaded', () => { updateIndicator(0); });

// Backend API
async function analyzeWithAPI(posts = [], keyword = "flood", region = "any", real = false) {
  const res = await fetch('http://localhost:8000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts, keyword, region, real })
  });
  const data = await res.json();
  return data;
}
/* ═══════════════════════════════════════════════════
   ScanAI — app.js
   All logic: camera, API calls, UI, history, particles
════════════════════════════════════════════════════ */

'use strict';

// ─── Constants ────────────────────────────────────
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-sonnet-4-20250514';
const LS_KEY_API    = 'scanai_api_key';
const LS_KEY_HIST   = 'scanai_history';
const MAX_HISTORY   = 20;

// ─── State ────────────────────────────────────────
let apiKey      = localStorage.getItem(LS_KEY_API) || '';
let scanning    = false;
let streaming   = false;
let facingMode  = 'environment';
let history     = [];
let currentResult = null;

// ─── DOM refs ─────────────────────────────────────
const $ = id => document.getElementById(id);
const video          = $('video');
const canvas         = $('canvas');
const frozenFrame    = $('frozenFrame');
const viewport       = $('viewport');
const scanOverlay    = $('scanOverlay');
const scanLine       = $('scanLine');
const hudLabel       = $('hudLabel');
const hudRes         = $('hudRes');
const hudBottom      = $('hudBottom');
const hudProgressBar = $('hudProgressBar');
const hudStatusText  = $('hudStatusText');

const heroSection    = $('heroSection');
const scannerSection = $('scannerSection');
const historySection = $('historySection');
const historyGrid    = $('historyGrid');

const startBtn       = $('heroStartBtn');
const scanBtn        = $('scanBtn');
const scanBtnText    = $('scanBtnText');
const stopBtn        = $('stopBtn');
const switchCamBtn   = $('switchCamBtn');
const errorBanner    = $('errorBanner');
const errorText      = $('errorText');
const statusPill     = $('statusPill');
const statusText     = $('statusText');

const apiKeyBtn      = $('apiKeyBtn');
const apiOverlay     = $('apiOverlay');
const closeApiModal  = $('closeApiModal');
const apiKeyInput    = $('apiKeyInput');
const saveApiKey     = $('saveApiKey');

const resultBackdrop = $('resultBackdrop');
const resultPanel    = $('resultPanel');
const panelClose     = $('panelClose');
const panelThumb     = $('panelThumb');
const panelName      = $('panelName');
const panelConfBar   = $('panelConfBar');
const panelConfVal   = $('panelConfVal');
const panelTags      = $('panelTags');
const panelDesc      = $('panelDesc');
const infoGrid       = $('infoGrid');
const webResultsList = $('webResultsList');
const ptabInfo       = $('ptabInfo');
const ptabWeb        = $('ptabWeb');
const toast          = $('toast');

// ═══════════════════════════════════════════════════
//  PARTICLE BACKGROUND
// ═══════════════════════════════════════════════════
(function initParticles() {
  const c  = $('particleCanvas');
  const ctx = c.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = c.width  = window.innerWidth;
    H = c.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.r  = Math.random() * 1.5 + 0.3;
      this.a  = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.5 ? '0,255,204' : '0,102,255';
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color},${this.a})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, W, H);
    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,255,204,${0.06 * (1 - dist/120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  animate();
})();

// ═══════════════════════════════════════════════════
//  API KEY
// ═══════════════════════════════════════════════════
apiKeyBtn.addEventListener('click', () => {
  apiKeyInput.value = apiKey;
  apiOverlay.classList.add('open');
});
closeApiModal.addEventListener('click', () => apiOverlay.classList.remove('open'));
apiOverlay.addEventListener('click', e => { if (e.target === apiOverlay) apiOverlay.classList.remove('open'); });

saveApiKey.addEventListener('click', () => {
  const k = apiKeyInput.value.trim();
  if (!k.startsWith('sk-')) {
    showToast('⚠ Key should start with sk-ant-...');
    return;
  }
  apiKey = k;
  localStorage.setItem(LS_KEY_API, k);
  apiOverlay.classList.remove('open');
  showToast('✓ API key saved');
});

// ═══════════════════════════════════════════════════
//  CAMERA
// ═══════════════════════════════════════════════════
startBtn.addEventListener('click', () => launchScanner());
stopBtn.addEventListener('click', stopCamera);
switchCamBtn.addEventListener('click', switchCamera);

async function launchScanner() {
  if (!apiKey) {
    apiOverlay.classList.add('open');
    showToast('Set your API key first');
    return;
  }
  heroSection.style.display = 'none';
  scannerSection.style.display = 'block';
  await startCamera();
}

async function startCamera() {
  clearError();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    video.srcObject = stream;
    await video.play();
    streaming = true;
    setStatus(true);
    hudLabel.textContent = 'READY';
    // Show resolution
    video.addEventListener('loadedmetadata', () => {
      hudRes.textContent = `${video.videoWidth}×${video.videoHeight}`;
    }, { once: true });
  } catch (e) {
    showError('Camera access denied. Please allow camera permissions and reload.');
  }
}

function stopCamera() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
  streaming = false;
  setStatus(false);
  scannerSection.style.display = 'none';
  heroSection.style.display = 'block';
  frozenFrame.style.display = 'none';
  video.style.display = 'block';
}

async function switchCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
  }
  await startCamera();
  showToast(facingMode === 'user' ? '📷 Front camera' : '📷 Rear camera');
}

function setStatus(live) {
  if (live) {
    statusPill.classList.add('live');
    statusText.textContent = 'LIVE';
  } else {
    statusPill.classList.remove('live');
    statusText.textContent = 'OFFLINE';
  }
}

// ═══════════════════════════════════════════════════
//  SCAN
// ═══════════════════════════════════════════════════
scanBtn.addEventListener('click', captureAndAnalyze);

async function captureAndAnalyze() {
  if (scanning || !streaming) return;
  if (!apiKey) {
    apiOverlay.classList.add('open');
    return;
  }

  scanning = true;
  scanBtn.disabled = true;
  scanBtnText.textContent = '...';
  clearError();

  // Capture frame
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 960;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const base64  = dataUrl.split(',')[1];

  // Show freeze frame
  frozenFrame.src = dataUrl;
  frozenFrame.style.display = 'block';
  video.style.display = 'none';

  // Start scan animation
  setScanMode(true);
  animateProgress(0, 85, 3000);

  try {
    hudLabel.textContent = 'ANALYZING';
    hudBottom.style.display = 'block';
    hudStatusText.textContent = 'Sending to AI...';

    const result = await callClaudeAPI(base64);
    result.thumb = dataUrl;
    result.time  = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    result.date  = new Date().toLocaleDateString();

    animateProgress(85, 100, 400);
    await sleep(500);

    // Save to history
    history.unshift(result);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    saveHistory();
    prependHistoryCard(result);
    historySection.style.display = 'block';

    // Show result panel
    openResultPanel(result);
    showToast(`✓ Identified: ${result.name}`);

  } catch (err) {
    showError(err.message || 'Analysis failed. Check your API key.');
  } finally {
    scanning = false;
    scanBtn.disabled = false;
    scanBtnText.textContent = 'SCAN';
    setScanMode(false);
    hudLabel.textContent = 'READY';
    hudBottom.style.display = 'none';
    hudProgressBar.style.width = '0%';
    // Resume live feed
    frozenFrame.style.display = 'none';
    video.style.display = 'block';
  }
}

// ═══════════════════════════════════════════════════
//  CLAUDE API
// ═══════════════════════════════════════════════════
async function callClaudeAPI(base64) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: `You are ScanAI, an advanced visual recognition system.
When given an image:
1. Identify the main object, subject, or scene with high precision
2. Search the web for current, relevant information about it
3. Respond ONLY with a valid JSON object — no markdown, no backticks, no other text.

JSON structure (exactly):
{
  "name": "Object or Subject Name",
  "confidence": 94,
  "category": "Electronics / Animal / Plant / Landmark / Food / Vehicle / Person / Other",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "description": "2-3 sentences describing what this is and what makes it notable.",
  "funFact": "One interesting or surprising fact about this.",
  "webResults": [
    { "source": "Website Name", "title": "Article or Page Title", "snippet": "Relevant summary from the web about this object." },
    { "source": "Website Name", "title": "Article or Page Title", "snippet": "Another relevant finding from web search." }
  ]
}

Rules:
- confidence is an integer 0-100
- tags should be 3-5 short relevant words
- webResults should have 2-3 entries from actual web search
- If unsure, still give your best identification
- Return ONLY the JSON`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
          },
          {
            type: 'text',
            text: 'Please identify what is in this image and search for information about it. Return JSON only.'
          }
        ]
      }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();

  // Collect all text blocks (Claude may use tool calls between them)
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .replace(/```json[\s\S]*?```|```[\s\S]*?```/g, m => m.replace(/```json|```/g,''))
    .trim();

  // Try parse
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse AI response. Try again.');
  }
}

// ═══════════════════════════════════════════════════
//  RESULT PANEL
// ═══════════════════════════════════════════════════
function openResultPanel(result) {
  currentResult = result;

  panelThumb.src       = result.thumb || '';
  panelName.textContent = result.name || 'Unknown';
  panelConfBar.style.width = (result.confidence || 0) + '%';
  panelConfVal.textContent = (result.confidence || 0) + '%';

  // Tags
  panelTags.innerHTML = '';
  (result.tags || []).forEach(t => {
    const s = document.createElement('span');
    s.className = 'p-tag';
    s.textContent = t;
    panelTags.appendChild(s);
  });

  // Description
  panelDesc.textContent = result.description || '';

  // Info grid
  infoGrid.innerHTML = `
    <div class="info-card">
      <div class="info-card-label">CATEGORY</div>
      <div class="info-card-value" style="font-size:13px">${esc(result.category || '—')}</div>
    </div>
    <div class="info-card">
      <div class="info-card-label">CONFIDENCE</div>
      <div class="info-card-value" style="color:var(--accent)">${result.confidence || 0}%</div>
    </div>
    ${result.funFact ? `
    <div class="info-card" style="grid-column:1/-1">
      <div class="info-card-label">FUN FACT ✦</div>
      <div class="info-card-value" style="font-size:13px;font-family:var(--body);font-weight:400;color:var(--text2);line-height:1.6">${esc(result.funFact)}</div>
    </div>` : ''}
  `;

  // Web results
  webResultsList.innerHTML = '';
  if (result.webResults && result.webResults.length) {
    result.webResults.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'web-result-card';
      div.style.animationDelay = (i * 0.08) + 's';
      div.innerHTML = `
        <div class="web-source">${esc(r.source)}</div>
        <div class="web-title">${esc(r.title)}</div>
        <div class="web-snippet">${esc(r.snippet)}</div>
      `;
      webResultsList.appendChild(div);
    });
  } else {
    webResultsList.innerHTML = '<div class="no-web">NO WEB RESULTS</div>';
  }

  // Reset tab
  switchPanelTab('info');

  // Open
  resultBackdrop.classList.add('open');
  resultPanel.classList.add('open');
}

panelClose.addEventListener('click', closeResultPanel);
resultBackdrop.addEventListener('click', closeResultPanel);

function closeResultPanel() {
  resultPanel.classList.remove('open');
  resultBackdrop.classList.remove('open');
}

// Panel tabs
document.querySelectorAll('.p-tab').forEach(btn => {
  btn.addEventListener('click', () => switchPanelTab(btn.dataset.tab));
});

function switchPanelTab(tab) {
  document.querySelectorAll('.p-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.p-tab[data-tab="${tab}"]`).classList.add('active');
  ptabInfo.style.display = tab === 'info' ? 'block' : 'none';
  ptabWeb.style.display  = tab === 'web'  ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════
function prependHistoryCard(item) {
  const card = buildHistoryCard(item);
  historyGrid.prepend(card);
}

function buildHistoryCard(item) {
  const div = document.createElement('div');
  div.className = 'history-card';
  div.innerHTML = `
    ${item.thumb ? `<img class="history-thumb" src="${item.thumb}" alt="${esc(item.name)}" loading="lazy"/>` : ''}
    <div class="history-info">
      <div class="history-name">${esc(item.name)}</div>
      <div class="history-meta">${esc(item.date || '')} ${esc(item.time || '')}</div>
      <span class="history-conf">${item.confidence || 0}%</span>
    </div>
  `;
  div.addEventListener('click', () => openResultPanel(item));
  return div;
}

function saveHistory() {
  try {
    // Save without full thumb data to keep localStorage small
    const slim = history.map(h => ({ ...h, thumb: h.thumb?.slice(0,500) || '' }));
    localStorage.setItem(LS_KEY_HIST, JSON.stringify(slim));
  } catch { /* storage full */ }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY_HIST);
    if (raw) history = JSON.parse(raw);
    if (history.length) {
      historySection.style.display = 'block';
      history.forEach(item => historyGrid.appendChild(buildHistoryCard(item)));
    }
  } catch { history = []; }
}

$('clearHistory').addEventListener('click', () => {
  history = [];
  localStorage.removeItem(LS_KEY_HIST);
  historyGrid.innerHTML = '';
  historySection.style.display = 'none';
  showToast('History cleared');
});

// ═══════════════════════════════════════════════════
//  SCAN ANIMATION
// ═══════════════════════════════════════════════════
function setScanMode(on) {
  if (on) {
    viewport.classList.add('scanning');
  } else {
    viewport.classList.remove('scanning');
  }
}

function animateProgress(from, to, duration) {
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    hudProgressBar.style.width = (from + (to - from) * ease) + '%';
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════
function showError(msg) {
  errorText.textContent = msg;
  errorBanner.style.display = 'flex';
}
function clearError() {
  errorBanner.style.display = 'none';
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
function init() {
  loadHistory();

  // If API key already set, show it visually
  if (apiKey) {
    apiKeyBtn.style.color = 'var(--accent)';
    apiKeyBtn.style.borderColor = 'rgba(0,255,204,0.3)';
  }

  // Keyboard shortcut: Space to scan
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && streaming && !scanning && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      captureAndAnalyze();
    }
    if (e.code === 'Escape') closeResultPanel();
  });
}

init();

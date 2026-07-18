// results.js — extracted from results.html
// All results page logic lives here. results.html loads this via <script src="js/results.js"></script>

/* XSS protection: escape all user-supplied strings before inserting into innerHTML */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
async function getAuthHeaders() {
      var token = SUPABASE_KEY;
      try {
              if (window._svSupabase) {
                        var sessionResp = await window._svSupabase.auth.getSession();
                        if (sessionResp.data && sessionResp.data.session && sessionResp.data.session.access_token) {
                                    token = sessionResp.data.session.access_token;
                        }
              }
      } catch (e) { /* fall back to anon key */ }
      return { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + token };
}
// Support ?query_id= in URL as fallback (useful when navigating back from operator portal)
var urlParams = new URLSearchParams(window.location.search);
var queryId = urlParams.get('query_id') || sessionStorage.getItem('sv_query_id');
var queryData = JSON.parse(sessionStorage.getItem('sv_query') || '{}');
var selectedQuoteId = null;
var selectedQuote = null;
var quotesMap = {};
var totalSeconds = 60 * 60; // 60 minutes
// Always read start time from sessionStorage — survives refresh, tab switch, minimise
// Only initialise start time once — never overwrite it so timer survives refresh
if (!sessionStorage.getItem('sv_query_start')) {
    sessionStorage.setItem('sv_query_start', Date.now().toString());
}
var queryStart = parseInt(sessionStorage.getItem('sv_query_start'));

// ── Populate sidebar from query data ──
function populateSidebar(data) {
    data = data || {};

  function getCode(s) { var m = s.match(/\(([^)]+)\)/); return m ? m[1] : s.substring(0,3).toUpperCase(); }
    function getName(s) { return s.replace(/\s*\([^)]+\)/, '').trim(); }

  var dep = data.departure || '';
    var dest = data.destination || '';

  document.getElementById('dep-code').textContent = dep ? getCode(dep) : 'DEP';
    document.getElementById('dep-name').textContent = dep ? getName(dep) : '—';
    document.getElementById('dest-code').textContent = dest ? getCode(dest) : 'ARR';
    document.getElementById('dest-name').textContent = dest ? getName(dest) : '—';

  var dateStr = data.flight_date || '';
    var timeStr = data.flight_time || '';
    var displayDate = dateStr;
    if (dateStr) {
          try {
                  var d = new Date(dateStr);
                  displayDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          } catch(e) { displayDate = dateStr; }
    }
    var dateTimeDisplay = displayDate ? (timeStr ? displayDate + ', ' + timeStr : displayDate) : '—';
    document.getElementById('meta-date').textContent = dateTimeDisplay;

  var pax = data.passengers || data.rs_pax || '—';
    var tripTypeRaw = data.trip_type || data.rs_type || 'one_way';
    var tripTypeMap = {'one_way':'One Way','round_trip':'Round Trip','roundtrip':'Round Trip','Round Trip':'Round Trip','One Way':'One Way','Multiple Sectors':'Multiple Sectors','multiple_sectors':'Multiple Sectors'};
    var tripType = tripTypeMap[tripTypeRaw] || tripTypeRaw.replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
    document.getElementById('meta-pax').textContent = pax + ' Passenger' + (parseInt(pax) !== 1 ? 's' : '') + ', ' + tripType;

  var reqs = [];
    if (data.medivac === true || data.medivac === 'true' || data.rs_medivac === true || data.rs_medivac === 'true') reqs.push('Medivac');
    if (data.pets === true || data.pets === 'true' || data.rs_pets === true || data.rs_pets === 'true') reqs.push('Pets');
    if (data.infants === true || data.infants === 'true' || data.rs_infants === true || data.rs_infants === 'true') reqs.push('Infants');
    if (data.vip === true || data.vip === 'true' || data.rs_vip === true || data.rs_vip === 'true') reqs.push('VIP Passenger');
    var reqEl = document.getElementById('meta-reqs');
    if (reqEl) {
          if (reqs.length) {
                  reqEl.style.display = 'flex';
                  reqEl.innerHTML = reqs.map(function(r) {
                            return '<span style="font-family:var(--font-mono);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#342800;background:var(--cyan);border-radius:20px;padding:3px 10px;">' + r + '</span>';
                  }).join('');
          } else {
                  reqEl.style.display = 'none';
          }
    }
}

// Fetch query from Supabase and populate sidebar
async function loadQueryAndSidebar() {
    var sessionData = queryData || {};
    var hasFullData = escapeHtml(sessionData.flight_date) || sessionData.passengers || escapeHtml(sessionData.rs_route);

  if (!hasFullData && queryId) {
        try {
                var res = await fetch(SUPABASE_URL + '/rest/v1/queries?id=eq.' + queryId + '&limit=1', {
                          headers: await getAuthHeaders()
                });
                var rows = await res.json();
                if (Array.isArray(rows) && rows.length > 0) {
                          sessionData = rows[0];
                }
        } catch(e) {
                console.warn('loadQueryAndSidebar: fetch failed', e);
        }
  }
    populateSidebar(sessionData);
}

// ── Timer ──
function startTimer() {
    updateTimer();
    setInterval(updateTimer, 500);
}

function updateTimer() {
    var nowElapsed = Math.floor((Date.now() - queryStart) / 1000);
    var remaining = Math.max(0, totalSeconds - nowElapsed);
    var mins = Math.floor(remaining / 60);
    var secs = remaining % 60;
    var el = document.getElementById('live-timer');
    if (remaining > 0) {
          el.textContent = mins + ' min ' + String(secs).padStart(2, '0') + ' sec remaining';
    } else {
          el.textContent = 'Quotation window closed';
          if (!window._svExpiredShown) {
            window._svExpiredShown = true;
            var _exp = document.getElementById('results-expired-msg');
            if (_exp) _exp.style.display = 'block';
          }
    }
    var pct = Math.min((nowElapsed / totalSeconds) * 100, 100);
    document.getElementById('progress-fill').style.width = pct + '%';
}

// ── Aviation Facts ──
var AVIATION_FACTS = [
    { stat: '~900', text: 'charter flights operate in India every month' },
    { stat: '3x', text: 'faster boarding than commercial airlines' },
    { stat: '5,000+', text: 'private airports & airstrips across India' },
    { stat: '60 min', text: 'average time saved per trip vs commercial flight' },
    { stat: '99%', text: 'on-time performance for private charters' },
    { stat: '₹0', text: 'hidden fees — price you see is the price you pay' },
    { stat: '<2hrs', text: 'notice needed to book most charter flights' },
    { stat: '150+', text: 'aircraft types available for charter in India' }
];
var factsInterval = null;
var factsIndex = 0;

function initFacts() {
    var card = document.getElementById('fact-card');
    var dotsEl = document.getElementById('fact-dots');
    if (!card || !dotsEl) return;
    // Always rebuild DOM (container was just reset), but keep current index if already cycling
    var itemsHTML = AVIATION_FACTS.map(function(f, i) {
        return '<div class="fact-item' + (i===factsIndex?' visible':'') + '" id="fact-item-'+i+'">' +
               '<div class="fact-stat">'+f.stat+'</div>' +
               '<div class="fact-text">'+f.text+'</div>' +
               '</div>';
    }).join('');
    card.innerHTML = itemsHTML;
    var dotsHTML = AVIATION_FACTS.map(function(_, i) {
        return '<div class="fact-dot'+(i===factsIndex?' active':'')+'" id="fact-dot-'+i+'"></div>';
    }).join('');
    dotsEl.innerHTML = dotsHTML;
    // Only start interval if not already running
    if (!factsInterval) {
        factsIndex = 0;
        // Show first item
        var firstItem = document.getElementById('fact-item-0');
        var firstDot = document.getElementById('fact-dot-0');
        if (firstItem) firstItem.classList.add('visible');
        if (firstDot) firstDot.classList.add('active');
        factsInterval = setInterval(function() {
            var prev = factsIndex;
            factsIndex = (factsIndex + 1) % AVIATION_FACTS.length;
            var prevItem = document.getElementById('fact-item-'+prev);
            var nextItem = document.getElementById('fact-item-'+factsIndex);
            var prevDot = document.getElementById('fact-dot-'+prev);
            var nextDot = document.getElementById('fact-dot-'+factsIndex);
            if (prevItem) prevItem.classList.remove('visible');
            if (nextItem) nextItem.classList.add('visible');
            if (prevDot) prevDot.classList.remove('active');
            if (nextDot) nextDot.classList.add('active');
        }, 4000);
    }
}

function stopFacts() {
    if (factsInterval) { clearInterval(factsInterval); factsInterval = null; }
}

// ── Load quotes from Supabase ──
async function loadQuotes() {
    if (!queryId) {
          document.getElementById('quotes-container').innerHTML = '<div class="loading-state"><div style="color:#e06060;font-size:13px;">No booking found. Please <a href="index.html" style="color:#17b0d6;">submit a new booking</a>.</div></div>';
          var _snt=document.getElementById('stat-notified-txt');if(_snt)_snt.textContent='0';
          return;
    }
    // Prevent concurrent overlapping fetches
    if (window._loadInFlight) return;
    window._loadInFlight = true;
    try {
          var res = await fetch(SUPABASE_URL + '/rest/v1/quotes?select=*&query_id=eq.' + queryId + '&status=eq.shared&order=price.asc', {
                  headers: await getAuthHeaders()
          });
          var quotes = await res.json();
          if (!Array.isArray(quotes)) return;

          document.getElementById('stat-received-txt').textContent = quotes.length;

          var viewRes = await fetch(SUPABASE_URL + '/rest/v1/query_views?query_id=eq.' + queryId + '&select=id', {
              headers: await getAuthHeaders()
          });
          var views = await viewRes.json();
          var notifiedCount = Array.isArray(views) ? views.length : 0;
          document.getElementById('stat-notified-txt').textContent = notifiedCount;

          // Only re-render if data has actually changed (prevents DOM flicker on every poll)
          var fingerprint = quotes.map(function(q){ return q.id + ':' + q.price + ':' + q.status; }).join('|');
          if (fingerprint === window._lastQuoteFingerprint) return;
          window._lastQuoteFingerprint = fingerprint;

          allQuotes = quotes;
          applyFilters();
    } catch(e) {
          console.error('loadQuotes error:', e);
    } finally {
          window._loadInFlight = false;
    }
}

// ── Aircraft images ──
var aircraftImages = [
    'bombardier.png',
    'gulfstream.png'
  ];

function renderQuotes(quotes) {
    var container = document.getElementById('quotes-container');
    if (!quotes.length) {
          container.innerHTML = '<div class="loading-state"><div class="sky-anim"><div class="sky-track"><svg class="cloud cloud-1" width="48" height="22" viewBox="0 0 48 22" fill="none"><path d="M6 16c-2.8 0-5-2.2-5-5 0-2.5 1.8-4.5 4.2-4.9C5.8 3.3 8.2 1.5 11 1.5c1.5 0 2.9.5 3.9 1.4C16 1.7 17.7 1 19.5 1 23.1 1 26 3.9 26 7.5c0 .3 0 .6-.1.9H27c2.2 0 4 1.8 4 4s-1.8 4-4 4H6z" stroke="#17b0d6" stroke-width="1.2" fill="none"/></svg><svg class="cloud cloud-2" width="60" height="28" viewBox="0 0 60 28" fill="none"><path d="M8 20c-3.3 0-6-2.7-6-6 0-3 2.1-5.5 5-5.9C7.7 4.4 11 2 15 2c2.2 0 4.2.8 5.7 2.1C22.5 2.8 25 2 27.5 2 33.3 2 38 6.7 38 12.5c0 .3 0 .7-.1 1H40c2.8 0 5 2.2 5 5s-2.2 5-5 5H8z" stroke="#17b0d6" stroke-width="1.3" fill="none"/></svg><svg class="cloud cloud-3" width="36" height="18" viewBox="0 0 36 18" fill="none"><path d="M5 13c-2.2 0-4-1.8-4-4 0-2 1.5-3.7 3.5-3.9C5 2.5 7.5 1 10.5 1c1.5 0 2.8.5 3.8 1.3C15.3 1.5 16.8 1 18.5 1 22 1 25 4 25 7.5c0 .2 0 .5-.1.7H26c1.9 0 3.5 1.6 3.5 3.5S27.9 15 26 15H5z" stroke="#17b0d6" stroke-width="1.2" fill="none" opacity=".7"/></svg><svg class="plane-wrap" width="64" height="32" viewBox="0 0 64 32" fill="none"><path d="M4 17 Q16 15 36 16 L56 15 Q60 15 61 16.5 Q60 18 56 18 L36 17 Q16 18 4 17Z" stroke="#c9a84c" stroke-width="1.2" fill="none"/><path d="M28 16.5 L18 8 L14 8.5 L24 16.5Z" stroke="#c9a84c" stroke-width="1.2" fill="none"/><path d="M10 17 L5 11 L3 11.5 L8 17Z" stroke="#c9a84c" stroke-width="1.2" fill="none"/><path d="M8 17 L8 12 L11 12" stroke="#c9a84c" stroke-width="1.2" fill="none"/><ellipse cx="21" cy="19" rx="4" ry="2" stroke="#c9a84c" stroke-width="1.2" fill="none"/><circle cx="40" cy="15.5" r="1" fill="#c9a84c"/><circle cx="45" cy="15.5" r="1" fill="#c9a84c"/><circle cx="50" cy="15.5" r="1" fill="#c9a84c"/></svg><svg class="plane-wrap-2" width="64" height="32" viewBox="0 0 64 32" fill="none"><path d="M4 17 Q16 15 36 16 L56 15 Q60 15 61 16.5 Q60 18 56 18 L36 17 Q16 18 4 17Z" stroke="#c9a84c" stroke-width="1.2" fill="none"/><path d="M28 16.5 L18 8 L14 8.5 L24 16.5Z" stroke="#c9a84c" stroke-width="1.2" fill="none"/><path d="M10 17 L5 11 L3 11.5 L8 17Z" stroke="#c9a84c" stroke-width="1.2" fill="none"/><path d="M8 17 L8 12 L11 12" stroke="#c9a84c" stroke-width="1.2" fill="none"/><ellipse cx="21" cy="19" rx="4" ry="2" stroke="#c9a84c" stroke-width="1.2" fill="none"/><circle cx="40" cy="15.5" r="1" fill="#c9a84c"/><circle cx="45" cy="15.5" r="1" fill="#c9a84c"/><circle cx="50" cy="15.5" r="1" fill="#c9a84c"/></svg></div></div><div>Waiting for quotes from operators...</div><div style="font-size:12px;margin-top:8px;opacity:.6;">Operators have 60 minutes to respond</div><div class="facts-section" id="facts-section"><div class="facts-label">Did you know?</div><div class="fact-card" id="fact-card"></div><div class="fact-dots" id="fact-dots"></div></div></div>';
          initFacts();
          return;
    }

  stopFacts();
  var html = '';
    quotes.forEach(function(q, i) {
          quotesMap[q.id] = q;
          var isSelected = selectedQuoteId === q.id;

                       var badge = i === 0
            ? '<div class="badge badge-green"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3.8 10.5L2.85 8.9L1.05 8.5L1.225 6.65L0 5.25L1.225 3.85L1.05 2L2.85 1.6L3.8 0L5.5.725 7.2 0 8.15 1.6 9.95 2 9.775 3.85 11 5.25 9.775 6.65 9.95 8.5 8.15 8.9 7.2 10.5 5.5 9.775Z" fill="white"/></svg><span class="badge-text">Best Price</span></div>'
                               : '<div class="badge badge-cyan"><svg width="8" height="10" viewBox="0 0 8 10" fill="none"><path d="M3.275 8.1L5.863 5H3.863L4.225 2.163L1.913 5.5H3.65L3.275 8.1ZM2 10L2.5 6.5H0L4.5 0H5.5L5 4H8L3 10Z" fill="#342800"/></svg><span class="badge-text-dark">Fastest Response</span></div>';

                       var imgHtml = (i < aircraftImages.length)
            ? '<img src="' + aircraftImages[i] + '" alt="aircraft" onerror="this.style.display=\'none\';this.parentNode.querySelector(\'.img-bg-fallback\').style.display=\'flex\'">'
                                 + '<div class="img-bg-fallback" style="display:none;position:absolute;inset:0;"><span style="opacity:.08;font-size:80px;color:#fff;">✈</span></div>'
                               : '<div class="img-bg-fallback"><span style="opacity:.08;font-size:80px;color:#fff;">✈</span></div>';

                       var price = q.price ? '₹' + Number(q.price).toLocaleString('en-IN') : '—';
          var seats = q.seats_available ? q.seats_available + ' Seats' : '—';
          var safetyClass = i === 0 ? 'safety-green' : 'safety-gold';
          var safetyText = i === 0 ? 'Safety Rated Platinum' : 'Safety Rated Gold';

                       html += '<div class="quote-card' + (isSelected ? ' selected' : '') + '" id="qcard-' + q.id + '" onclick="selectQuote(\'' + q.id + '\')">';
          html += '<div class="img-wrap">' + imgHtml + '<div class="img-gradient"></div>' + badge + '</div>';
          html += '<div class="card-body">';
          html += '<div class="card-top">';
          html += '<div><div class="aircraft-name">' + esc(escapeHtml(q.aircraft_type) || 'Aircraft') + '</div><div class="operator-name">' + esc(escapeHtml(q.operator_name) || 'Operator') + '</div></div>';
          html += '<div class="price-col"><div class="price-label">All-inclusive price</div><div class="price-value">' + price + '</div></div>';
          html += '</div>';
          html += '<div class="amenities">';
          html += amenity('<path d="M4.583 3.333C4.125 3.333 3.733 3.17 3.406 2.844C3.08 2.517 2.917 2.125 2.917 1.667C2.917 1.208 3.08.816 3.406.49C3.733.163 4.125 0 4.583 0C5.042 0 5.434.163 5.76.49 6.087.816 6.25 1.208 6.25 1.667 6.25 2.125 6.087 2.517 5.76 2.844 5.434 3.17 5.042 3.333 4.583 3.333ZM9.167 15H3.792C3.333 15 2.913 14.837 2.531 14.51 2.149 14.184 1.91 13.792 1.813 13.333L0 4.167H1.708L3.542 13.333H9.167V15ZM13.75 16.667L11.333 12.5H5.542C5.139 12.5 4.788 12.378 4.49 12.135 4.191 11.892 4 11.569 3.917 11.167L3 6.708C2.847 6.042 3.003 5.451 3.469 4.938 3.934 4.424 4.5 4.167 5.167 4.167 5.653 4.167 6.094 4.313 6.49 4.604 6.885 4.896 7.139 5.292 7.25 5.792L8.167 10H10.875C11.167 10 11.438 10.076 11.688 10.229 11.938 10.382 12.139 10.583 12.292 10.833L15.208 15.833Z" fill="#17B0D6"', '16', '17', seats);
          html += amenity('<path d="M10 14.167C9.417 14.167 8.924 13.965 8.521 13.563 8.118 13.16 7.917 12.667 7.917 12.083 7.917 11.5 8.118 11.007 8.521 10.604 8.924 10.201 9.417 10 10 10 10.583 10 11.076 10.201 11.479 10.604 11.882 11.007 12.083 11.5 12.083 12.083 12.083 12.667 11.882 13.16 11.479 13.563 11.076 13.965 10.583 14.167 10 14.167ZM1.75 5.917L0 4.167C1.278 2.861 2.771 1.84 4.479 1.104 6.188.368 8.028 0 10 0 11.972 0 13.813.368 15.521 1.104 17.229 1.84 18.722 2.861 20 4.167L18.25 5.917C17.181 4.847 15.941 4.01 14.531 3.406 13.122 2.802 11.611 2.5 10 2.5 8.389 2.5 6.878 2.802 5.469 3.406 4.059 4.01 2.819 4.847 1.75 5.917Z" fill="#17B0D6"', '20', '15', 'WiFi');
          html += amenity('<path d="M2.5 16.667V9.042C1.792 8.847 1.198 8.458.719 7.875.24 7.292 0 6.611 0 5.833V0H1.667V5.833H2.5V0H4.167V5.833H5V0H6.667V5.833C6.667 6.611 6.427 7.292 5.948 7.875 5.469 8.458 4.875 8.847 4.167 9.042V16.667ZM10.833 16.667V10H8.333V4.167C8.333 3.014 8.74 2.031 9.552 1.219 10.365.406 11.347 0 12.5 0V16.667Z" fill="#17B0D6"', '13', '17', 'Catering');
          html += amenity('<path d="M0 11.667V6.667C0 6.292.076 5.951.229 5.646.382 5.34.583 5.069.833 4.833V2.5C.833 1.806 1.076 1.215 1.563.729 2.049.243 2.639 0 3.333 0H6.667C6.986 0 7.285.059 7.563.177 7.84.295 8.097.458 8.333.667 8.569.458 8.826.295 9.104.177 9.382.059 9.681 0 10 0H13.333C14.028 0 14.618.243 15.104.729 15.59 1.215 15.833 1.806 15.833 2.5V4.833C16.083 5.069 16.285 5.34 16.438 5.646 16.59 5.951 16.667 6.292 16.667 6.667V11.667H15V10H1.667V11.667Z" fill="#17B0D6"', '17', '12', escapeHtml(q.notes) ? esc(escapeHtml(q.notes).split(' ')[0]) : 'Premium');
          html += '</div>';
          html += '<div class="card-footer">';
          html += '<div class="safety-row"><svg width="12" height="15" viewBox="0 0 12 15" fill="none"><path d="M5.213 10.163L9.45 5.925 8.381 4.856 5.213 8.025 3.638 6.45 2.569 7.519ZM6 15C4.263 14.563 2.828 13.566 1.697 12.009.566 10.453 0 8.725 0 6.825V2.25L6 0 12 2.25V6.825C12 8.725 11.434 10.453 10.303 12.009 9.172 13.566 7.738 14.563 6 15Z" fill="#10B981"/></svg><span class="safety-text ' + safetyClass + '">' + safetyText + '</span></div>';
          html += '<button class="btn-select" onclick="event.stopPropagation();selectQuote(\'' + q.id + '\')">SELECT →</button>';
          html += '</div></div></div>';
    });

  container.innerHTML = html;
}

function amenity(pathD, w, h, label) {
    return '<div class="amenity"><svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" fill="none"><path ' + pathD + '/></svg><span class="amenity-text">' + label + '</span></div>';
}

function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function selectQuote(id) {
    selectedQuoteId = id;
    selectedQuote = quotesMap[id];
    document.querySelectorAll('.quote-card').forEach(function(el){ el.classList.remove('selected'); });
    var card = document.getElementById('qcard-' + id);
    if (card) card.classList.add('selected');
    if (selectedQuote) {
          var price = selectedQuote.price ? '₹' + Number(selectedQuote.price).toLocaleString('en-IN') : '—';
          document.getElementById('confirm-title').textContent = esc(selectedQuote.aircraft_type || 'Aircraft') + ' selected';
          document.getElementById('confirm-sub').textContent = price + ' — ' + esc(selectedQuote.operator_name || 'Operator');
          document.getElementById('confirm-bar').classList.add('show');
    }
}

// ── Filters ──
var filterPriceSort = 'asc';
var filterMinSeats = 0;
var allQuotes = [];

function toggleFilters() {
    var panel = document.getElementById('filter-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function setPriceSort(dir) {
    filterPriceSort = dir;
    document.getElementById('pill-price-asc').classList.toggle('active', dir === 'asc');
    document.getElementById('pill-price-desc').classList.toggle('active', dir === 'desc');
    applyFilters();
}

function setMinSeats(val) {
    filterMinSeats = val;
    applyFilters();
}

function resetFilters() {
    filterPriceSort = 'asc';
    filterMinSeats = 0;
    document.querySelectorAll('.filter-select').forEach(function(s){ s.selectedIndex = 0; });
    document.getElementById('pill-price-asc').classList.add('active');
    document.getElementById('pill-price-desc').classList.remove('active');
    applyFilters();
    document.getElementById('filter-panel').style.display = 'none';
}

function applyFilters() {
    var filtered = allQuotes.slice();
    if (filterMinSeats > 0) {
          filtered = filtered.filter(function(q){ return (q.seats_available || 0) >= filterMinSeats; });
    }
    if (filterPriceSort === 'asc') {
          filtered.sort(function(a,b){ return (a.price||0) - (b.price||0); });
    } else {
          filtered.sort(function(a,b){ return (b.price||0) - (a.price||0); });
    }
    renderQuotes(filtered);
}

function goToPayment() {
    if (!selectedQuote) return;
    sessionStorage.setItem('sv_selected_quote', JSON.stringify(selectedQuote));
    window.location.href = 'payment.html';
}

// Close filter dropdown on outside click
document.addEventListener('click', function(e) {
    var panel = document.getElementById('filter-panel');
    if (!panel) return;
    var wrap = panel.closest('[style*="position:relative"]') || panel.parentElement;
    if (panel.style.display !== 'none' && !wrap.contains(e.target)) {
          panel.style.display = 'none';
    }
});

// ── Boot ──

startTimer();
var debugEl = document.getElementById('debug-query-id');
if (debugEl && queryId) debugEl.textContent = 'ID: ' + queryId.substring(0,8) + '…';
function bootData(){ loadQueryAndSidebar(); loadQuotes(); } if (typeof window.getSession === 'function') { window.getSession(function(){ bootData(); }); } else { bootData(); }
setInterval(loadQuotes, 30000);

// Realtime
if (queryId) {
    try {
          var ws = new WebSocket(SUPABASE_URL.replace('https://','wss://') + '/realtime/v1/websocket?apikey=' + SUPABASE_KEY + '&vsn=1.0.0');
          ws.onopen = function(){ ws.send(JSON.stringify({topic:'realtime:public:quotes:query_id=eq.'+queryId,event:'phx_join',payload:{},ref:'1'})); };
          ws.onmessage = function(e){ try{ var m=JSON.parse(e.data); if(m.event==='INSERT'||m.event==='UPDATE') { window._lastQuoteFingerprint=null; loadQuotes(); } }catch(x){} };
    } catch(e){}
}

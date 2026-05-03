/* ── SkyVayu — Results Page ── */

var timerInterval  = null;
var pollingInterval = null;
var queryStartTime = null;
var TIMER_DURATION = 60 * 60;
var injectedIds    = {};

document.addEventListener('DOMContentLoaded', function() {
  var raw = sessionStorage.getItem('sv_query');
  if (!raw) {
    showToast('No active search found. Please search again.', 'error');
    setTimeout(function() { window.location.href = 'booking.html'; }, 2500);
    return;
  }

  try {
    var q = JSON.parse(raw);
    var rsRoute = document.getElementById('rs-route');
    var rsDate  = document.getElementById('rs-date');
    var rsPax   = document.getElementById('rs-pax');
    var rsType  = document.getElementById('rs-type');
    if (rsRoute) rsRoute.textContent = q.rs_route || '\u2014';
    if (rsDate)  rsDate.textContent  = q.rs_date  || '\u2014';
    if (rsPax)   rsPax.textContent   = q.rs_pax   || '\u2014';
    if (rsType)  rsType.textContent  = q.rs_type  || '\u2014';

    if (q.trip_type === 'multi' && Array.isArray(q.sectors) && q.sectors.length) {
      var dHtml = '<div id="multi-detail" style="margin-bottom:16px;"><div class="section-label">Sector breakdown</div>';
      q.sectors.forEach(function(r, i) {
        var fromSafe = String(r.from || '\u2014').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var toSafe   = String(r.to   || '\u2014').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var dateSafe = String(r.date || '\u2014').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var timeSafe = String(r.time || '\u2014').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        dHtml += '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-card);border:0.5px solid var(--border);border-radius:var(--radius);margin-bottom:6px;font-size:13px;">'
          + '<span style="color:var(--text-tertiary);font-size:11px;font-weight:500;min-width:56px;letter-spacing:.05em;">SECTOR ' + (i + 1) + '</span>'
          + '<span style="color:var(--gold);font-weight:500;flex:1;">' + fromSafe + ' \u2192 ' + toSafe + '</span>'
          + '<span style="color:var(--text-secondary);">' + dateSafe + (r.time !== '\u2014' ? ', ' + timeSafe : '') + '</span>'
          + '</div>';
      });
      dHtml += '</div>';
      var summary = document.querySelector('.trip-summary');
      if (summary) summary.insertAdjacentHTML('afterend', dHtml);
    }
  } catch (e) {
    console.error('Could not load query data', e);
  }

  startTimer();

  var queryId = sessionStorage.getItem('sv_query_id');
  if (queryId) {
    currentQueryId = queryId;
    subscribeToQuotes(queryId);
    startQuotePolling(queryId);
  } else {
    showToast('No active query found. Please search again.', 'error');
  }
});

function startQuotePolling(queryId) {
  /* Clear any stale polling interval */
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }

  async function pollOnce() {
    try {
      var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
      var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, 10000);
      var res = await fetch(
        SUPABASE_URL + '/rest/v1/quotes?query_id=eq.' + queryId + '&status=eq.shared&order=created_at.asc',
        {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
          signal: controller.signal
        }
      );
      clearTimeout(timer);
      if (!res.ok) return;
      var quotes = await res.json();
      if (!Array.isArray(quotes)) return;
      quotes.forEach(function(q) {
        injectQuote({
          id:            q.id,
          operator_name: q.operator_name,
          aircraft_type: q.aircraft_type,
          seats:         q.seats_available,
          price:         q.price,
          notes:         q.notes
        });
      });
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('Quote polling error:', e);
    }
  }

  pollOnce();
  pollingInterval = setInterval(pollOnce, 4000);
}

function startTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  queryStartTime = Date.now();
  injectedIds    = {};

  var listReceived  = document.getElementById('list-received');
  var expiredBanner = document.getElementById('expired-banner');
  var timerBlock    = document.getElementById('timer-block');
  var timerDisplay  = document.getElementById('timer-display');
  var timerBar      = document.getElementById('timer-bar');

  if (listReceived)  listReceived.innerHTML = '';
  if (expiredBanner) expiredBanner.style.display = 'none';
  if (timerBlock)    timerBlock.style.display     = 'block';
  if (timerDisplay) {
    timerDisplay.classList.remove('timer-urgent');
    timerDisplay.style.color  = 'var(--gold)';
    timerDisplay.textContent  = '60:00';
  }
  if (timerBar) {
    timerBar.style.width      = '100%';
    timerBar.style.background = '#185FA5';
  }

  updateResultsDisplay();

  timerInterval = setInterval(function() {
    var elapsed   = Math.floor((Date.now() - queryStartTime) / 1000);
    var remaining = TIMER_DURATION - elapsed;

    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
      if (timerDisplay) { timerDisplay.textContent = '00:00'; timerDisplay.classList.add('timer-urgent'); }
      if (timerBar) { timerBar.style.width = '0%'; timerBar.style.background = '#E24B4A'; }
      if (expiredBanner) expiredBanner.style.display = 'block';
      if (timerBlock)    timerBlock.style.display     = 'none';
      return;
    }

    var mins = Math.floor(remaining / 60);
    var secs = remaining % 60;
    if (timerDisplay) {
      timerDisplay.textContent =
        (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    var pct = (remaining / TIMER_DURATION) * 100;
    if (timerBar) timerBar.style.width = pct + '%';

    if (remaining <= 300) {
      if (timerBar)    timerBar.style.background = '#E24B4A';
      if (timerDisplay) timerDisplay.classList.add('timer-urgent');
    } else if (remaining <= 1200) {
      if (timerBar)    timerBar.style.background  = '#EF9F27';
      if (timerDisplay) {
        timerDisplay.style.color = '#EF9F27';
        timerDisplay.classList.remove('timer-urgent');
      }
    } else {
      if (timerBar)    timerBar.style.background  = '#185FA5';
      if (timerDisplay) {
        timerDisplay.style.color = 'var(--gold)';
        timerDisplay.classList.remove('timer-urgent');
      }
    }
  }, 1000);
}

function updateResultsDisplay() {
  var listEl    = document.getElementById('list-received');
  var received  = listEl ? listEl.querySelectorAll('.quote-card').length : 0;
  var emptyEl   = document.getElementById('state-empty');
  var sectionEl = document.getElementById('section-received');
  var labelEl   = document.getElementById('label-received');
  var opCountEl = document.getElementById('timer-op-count');
  if (emptyEl)   emptyEl.style.display      = received === 0 ? 'block' : 'none';
  if (sectionEl) sectionEl.style.display    = received > 0 ? 'block' : 'none';
  if (labelEl)   labelEl.textContent        = 'Quotes received \u2014 ' + received;
  if (opCountEl) opCountEl.textContent      = received > 0 ? received : '\u2014';
}

function fmtPrice(p) {
  return '\u20b9' + Number(p).toLocaleString('en-IN');
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function injectQuote(q) {
  if (!q || !q.id) return;
  if (injectedIds[q.id]) return;
  injectedIds[q.id] = true;

  var existing = document.getElementById('qcard-' + q.id);
  if (existing) existing.remove();

  var price       = Number(q.price) || 0;
  var priceStr    = price ? fmtPrice(price) : '\u2014';
  var charterAmt  = price ? Math.round(price * 0.9) : 0;
  var platformAmt = price ? Math.round(price * 0.1) : 0;
  var charterFee  = price ? fmtPrice(charterAmt)  : '\u2014';
  var platformFee = price ? fmtPrice(platformAmt) : '\u2014';

  /* Escape all operator-supplied strings before injecting into HTML */
  var opName    = escapeHtml(q.operator_name);
  var acType    = escapeHtml(q.aircraft_type);
  var notesHtml = q.notes
    ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">' + escapeHtml(q.notes) + '</p>'
    : '';

  /* Pass numeric values through data attributes instead of inline strings to avoid injection */
  var card = document.createElement('div');
  card.className = 'quote-card';
  card.id = 'qcard-' + q.id;
  card.dataset.opName    = q.operator_name || '';
  card.dataset.aircraft  = q.aircraft_type || '';
  card.dataset.total     = priceStr;
  card.dataset.charter   = charterFee;
  card.dataset.platform  = platformFee;

  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">'
    + '<div><p class="op-name">' + opName + '</p>'
    + '<p class="op-meta">' + acType + (q.seats ? ' \u00b7 ' + escapeHtml(String(q.seats)) + ' seats' : '') + '</p></div>'
    + '<span class="badge badge-success">Quote received</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-end;">'
    + '<div><span style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.08em;">Total</span>'
    + '<div style="font-family:var(--font-display);font-size:26px;font-weight:400;color:var(--gold);">' + priceStr + '</div>'
    + notesHtml
    + '</div>'
    + '<button class="btn-select" onclick="selectOpFromCard(this)">Select \u2192</button>'
    + '</div>';

  var listEl = document.getElementById('list-received');
  if (listEl) listEl.appendChild(card);
  updateResultsDisplay();
}

function selectOpFromCard(btn) {
  var card = btn.closest('.quote-card');
  if (!card) return;
  selectOp(
    card.dataset.opName   || '',
    card.dataset.aircraft || '',
    card.dataset.total    || '\u2014',
    card.dataset.charter  || '\u2014',
    card.dataset.platform || '\u2014'
  );
}

function selectOp(name, aircraft, total, charter, platform) {
  var raw = sessionStorage.getItem('sv_query');
  var queryData = {};
  if (raw) {
    try { queryData = JSON.parse(raw); } catch (e) { queryData = {}; }
  }
  sessionStorage.setItem('sv_selected_op', JSON.stringify({
    name:     name,
    aircraft: aircraft,
    total:    total,
    charter:  charter,
    platform: platform,
    route:    queryData.rs_route || '\u2014',
    date:     queryData.rs_date  || '\u2014',
    pax:      queryData.rs_pax   || '\u2014'
  }));
  window.location.href = 'payment.html';
}

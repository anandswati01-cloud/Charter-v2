/* ── SkyVayu — Results Page ── */
var timerInterval  = null;
var queryStartTime = null;
var TIMER_DURATION = 60 * 60;
var injectedIds    = {};

document.addEventListener('DOMContentLoaded', function() {
  var raw = sessionStorage.getItem('sv_query');
  if (!raw) return;
  try {
    var q = JSON.parse(raw);
    document.getElementById('rs-route').textContent = q.rs_route || '—';
    document.getElementById('rs-date').textContent  = q.rs_date  || '—';
    document.getElementById('rs-pax').textContent   = q.rs_pax   || '—';
    document.getElementById('rs-type').textContent  = q.rs_type  || '—';
    if (q.trip_type === 'multi' && q.sectors) {
      var dHtml = '<div id="multi-detail" style="margin-bottom:16px;"><div class="section-label">Sector breakdown</div>';
      q.sectors.forEach(function(r, i) {
        dHtml += '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-card);border:0.5px solid var(--border);border-radius:var(--radius);margin-bottom:6px;font-size:13px;">'
          + '<span style="color:var(--text-tertiary);font-size:11px;font-weight:500;min-width:56px;letter-spacing:.05em;">SECTOR ' + (i+1) + '</span>'
          + '<span style="color:var(--gold);font-weight:500;flex:1;">' + r.from + ' → ' + r.to + '</span>'
          + '<span style="color:var(--text-secondary);">' + r.date + (r.time !== '—' ? ', ' + r.time : '') + '</span>'
          + '</div>';
      });
      dHtml += '</div>';
      document.querySelector('.trip-summary').insertAdjacentHTML('afterend', dHtml);
    }
  } catch (e) { console.error('Could not load query data', e); }
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
  async function pollOnce() {
    try {
      var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
      var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
      var res = await fetch(
        SUPABASE_URL + '/rest/v1/quotes?query_id=eq.' + queryId + '&status=eq.shared&order=created_at.asc',
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
      );
      if (!res.ok) return;
      var quotes = await res.json();
      if (!Array.isArray(quotes)) return;
      quotes.forEach(function(q) {
        injectQuote({
          id: q.id,
          operator_name: q.operator_name,
          aircraft_type: q.aircraft_type,
          seats: q.seats_available,
          price: q.price,
          notes: q.notes
        });
      });
    } catch (e) { /* silent */ }
  }
  pollOnce();
  setInterval(pollOnce, 4000);
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  queryStartTime = Date.now();
  injectedIds    = {};
  document.getElementById('list-received').innerHTML   = '';
  document.getElementById('expired-banner').style.display = 'none';
  document.getElementById('timer-block').style.display    = 'block';
  document.getElementById('timer-display').classList.remove('timer-urgent');
  document.getElementById('timer-display').style.color    = 'var(--gold)';
  document.getElementById('timer-display').textContent    = '60:00';
  document.getElementById('timer-bar').style.width        = '100%';
  document.getElementById('timer-bar').style.background   = '#185FA5';
  updateResultsDisplay();
  timerInterval = setInterval(function() {
    var elapsed   = Math.floor((Date.now() - queryStartTime) / 1000);
    var remaining = TIMER_DURATION - elapsed;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      document.getElementById('timer-display').textContent = '00:00';
      document.getElementById('timer-display').classList.add('timer-urgent');
      document.getElementById('timer-bar').style.width      = '0%';
      document.getElementById('timer-bar').style.background = '#E24B4A';
      document.getElementById('expired-banner').style.display = 'block';
      document.getElementById('timer-block').style.display    = 'none';
      return;
    }
    var mins = Math.floor(remaining / 60);
    var secs = remaining % 60;
    document.getElementById('timer-display').textContent =
      (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
    var pct = (remaining / TIMER_DURATION) * 100;
    document.getElementById('timer-bar').style.width = pct + '%';
    if (remaining <= 300) {
      document.getElementById('timer-bar').style.background = '#E24B4A';
      document.getElementById('timer-display').classList.add('timer-urgent');
    } else if (remaining <= 1200) {
      document.getElementById('timer-bar').style.background = '#EF9F27';
      document.getElementById('timer-display').style.color  = '#EF9F27';
      document.getElementById('timer-display').classList.remove('timer-urgent');
    } else {
      document.getElementById('timer-bar').style.background = '#185FA5';
      document.getElementById('timer-display').style.color  = 'var(--gold)';
      document.getElementById('timer-display').classList.remove('timer-urgent');
    }
  }, 1000);
}

function updateResultsDisplay() {
  var received = document.querySelectorAll('#list-received .quote-card').length;
  document.getElementById('state-empty').style.display         = received === 0 ? 'block' : 'none';
  document.getElementById('section-received').style.display    = received > 0 ? 'block' : 'none';
  document.getElementById('label-received').textContent        = 'Quotes received — ' + received;
  document.getElementById('timer-op-count').textContent        = received > 0 ? received : '—';
}

function fmtPrice(p) { return '₹' + Number(p).toLocaleString('en-IN'); }

function injectQuote(q) {
  if (injectedIds[q.id]) return;
  injectedIds[q.id] = true;
  var existing = document.getElementById('qcard-' + q.id);
  if (existing) existing.remove();
  var priceStr    = q.price ? fmtPrice(q.price) : '—';
  var charterFee  = q.price ? fmtPrice(Math.round(q.price * 0.9)) : '—';
  var platformFee = q.price ? fmtPrice(Math.round(q.price * 0.1)) : '—';
  var html2 = '<div class="quote-card" id="qcard-' + q.id + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">'
    + '<div><p class="op-name">' + q.operator_name + '</p>'
    + '<p class="op-meta">' + (q.aircraft_type || '') + (q.seats ? ' · ' + q.seats + ' seats' : '') + '</p></div>'
    + '<span class="badge badge-success">Quote received</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-end;">'
    + '<div><span style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.08em;">Total</span>'
    + '<div style="font-family:var(--font-display);font-size:26px;font-weight:400;color:var(--gold);">' + priceStr + '</div>'
    + (q.notes ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">' + q.notes + '</p>' : '')
    + '</div>'
    + '<button class="btn-select" onclick="selectOp(\'' + q.operator_name + '\',\'' + (q.aircraft_type || '') + '\',\'' + priceStr + '\',\'' + charterFee + '\',\'' + platformFee + '\')">Select →</button>'
    + '</div></div>';
  document.getElementById('list-received').insertAdjacentHTML('beforeend', html2);
  updateResultsDisplay();
}

function selectOp(name, aircraft, total, charter, platform) {
  var q = sessionStorage.getItem('sv_query');
  var queryData = q ? JSON.parse(q) : {};
  sessionStorage.setItem('sv_selected_op', JSON.stringify({
    name: name, aircraft: aircraft, total: total,
    charter: charter, platform: platform,
    route: queryData.rs_route || '—',
    date:  queryData.rs_date  || '—',
    pax:   queryData.rs_pax   || '—'
  }));
  window.location.href = 'payment.html';
}
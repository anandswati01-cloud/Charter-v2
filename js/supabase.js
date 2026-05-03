/* ── SkyVayu — Supabase Integration ── */

var currentQueryId  = null;
var realtimeChannel = null;

/* ── Toast notification ── */
function showToast(message, type) {
  var existing = document.getElementById('sv-toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.id = 'sv-toast';
  var bg = type === 'error' ? '#E24B4A' : type === 'success' ? '#2E7D52' : '#185FA5';
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:' + bg, 'color:#fff', 'padding:12px 20px', 'border-radius:8px',
    'font-size:14px', 'font-family:var(--font-body, sans-serif)', 'z-index:9999',
    'box-shadow:0 4px 20px rgba(0,0,0,0.4)', 'max-width:90vw', 'text-align:center',
    'transition:opacity 0.3s'
  ].join(';');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
  }, 4000);
}

/* ── Shared sanitise helper ── */
function sanitiseField(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/<[^>]*>/g, '').trim().substring(0, 500);
}

/* ── Fetch with timeout helper ── */
function fetchWithTimeout(url, options, timeoutMs) {
  timeoutMs = timeoutMs || 15000;
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  var fetchOptions = Object.assign({}, options, { signal: controller.signal });
  return fetch(url, fetchOptions).finally(function() { clearTimeout(timer); });
}

/* ── Save query to Supabase ── */
async function saveQueryToSupabase(queryData) {
  var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
  var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
  var safe = {
    trip_type:    sanitiseField(queryData.trip_type),
    departure:    sanitiseField(queryData.departure)    || null,
    destination:  sanitiseField(queryData.destination)  || null,
    flight_date:  queryData.flight_date                 || null,
    flight_time:  queryData.flight_time                 || null,
    return_date:  queryData.return_date                 || null,
    return_time:  queryData.return_time                 || null,
    passengers:   parseInt(queryData.passengers)        || 1,
    client_phone: sanitiseField(queryData.client_phone),
    sectors:      queryData.sectors                     || null,
    medivac:      queryData.medivac                     || false,
    pets:         queryData.pets                        || false,
    infants:      queryData.infants                     || false,
    status:       'open'
  };
  try {
    var response = await fetchWithTimeout(
      SUPABASE_URL + '/rest/v1/queries',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':         SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer':         'return=representation'
        },
        body: JSON.stringify(safe)
      }
    );
    var text = await response.text();
    if (!response.ok) {
      var errMsg = 'Could not save your request. Please try again.';
      try { var errData = JSON.parse(text); if (errData.message) errMsg = errData.message; } catch (e) {}
      console.error('Supabase error', response.status, text);
      showToast(errMsg, 'error');
      return null;
    }
    var data = JSON.parse(text);
    return (Array.isArray(data) && data[0]) ? data[0] : null;
  } catch (e) {
    if (e.name === 'AbortError') {
      showToast('Request timed out. Please check your connection and try again.', 'error');
    } else {
      console.error('Supabase fetch error:', e);
      showToast('Network error — please check your connection and try again.', 'error');
    }
    return null;
  }
}

/* ── Save booking to Supabase ── */
async function saveBookingToSupabase(bookingData) {
  var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
  var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
  var safe = {
    query_id:      bookingData.query_id      || null,
    quote_id:      bookingData.quote_id      || null,
    ref:           sanitiseField(bookingData.ref),
    client_name:   sanitiseField(bookingData.client_name),
    client_email:  sanitiseField(bookingData.client_email),
    client_phone:  sanitiseField(bookingData.client_phone),
    operator_name: sanitiseField(bookingData.operator_name),
    aircraft:      sanitiseField(bookingData.aircraft)      || null,
    route:         sanitiseField(bookingData.route)         || null,
    flight_date:   sanitiseField(bookingData.flight_date)   || null,
    passengers:    parseInt(bookingData.passengers)         || null,
    total_amount:  parseFloat(bookingData.total_amount)     || null,
    platform_fee:  parseFloat(bookingData.platform_fee)     || null,
    status:        'confirmed'
  };
  try {
    var response = await fetchWithTimeout(
      SUPABASE_URL + '/rest/v1/bookings',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':         SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer':         'return=representation'
        },
        body: JSON.stringify(safe)
      }
    );
    var text = await response.text();
    if (!response.ok) {
      var errMsg = 'Could not confirm your booking. Please contact support.';
      try { var errData = JSON.parse(text); if (errData.message) errMsg = errData.message; } catch (e) {}
      console.error('Booking save error', response.status, text);
      showToast(errMsg, 'error');
      return null;
    }
    var data = JSON.parse(text);
    return (Array.isArray(data) && data[0]) ? data[0] : null;
  } catch (e) {
    if (e.name === 'AbortError') {
      showToast('Request timed out. Booking could not be saved. Please contact support.', 'error');
    } else {
      console.error('Booking fetch error:', e);
      showToast('Network error — booking could not be saved. Please contact support.', 'error');
    }
    return null;
  }
}

/* ── Realtime WebSocket subscription ── */
function subscribeToQuotes(queryId) {
  if (realtimeChannel) {
    try { realtimeChannel.close(); } catch (e) {}
    realtimeChannel = null;
  }
  var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
  var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
  var wsUrl = SUPABASE_URL.replace('https://', 'wss://') +
    '/realtime/v1/websocket?apikey=' + SUPABASE_KEY + '&vsn=1.0.0';
  try {
    var ws = new WebSocket(wsUrl);
    realtimeChannel = ws;

    ws.onopen = function() {
      var joinMsg = {
        topic:   'realtime:public:quotes:query_id=eq.' + queryId,
        event:   'phx_join',
        payload: {},
        ref:     '1'
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = function(event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.event === 'INSERT' && msg.payload && msg.payload.record) {
          var q = msg.payload.record;
          injectQuote({
            id:            q.id,
            operator_name: q.operator_name,
            aircraft_type: q.aircraft_type,
            seats:         q.seats_available,
            price:         q.price,
            notes:         q.notes
          });
        }
      } catch (e) {
        console.warn('Realtime message parse error:', e);
      }
    };

    ws.onerror = function() {
      console.warn('Realtime WebSocket error for query', queryId);
    };

    ws.onclose = function(event) {
      console.warn('Realtime WS closed for query', queryId, 'code:', event.code);
      realtimeChannel = null;
    };
  } catch (e) {
    console.error('Could not connect to Supabase Realtime:', e);
    showToast('Live updates unavailable. Quotes will still appear via polling.', 'info');
  }
}

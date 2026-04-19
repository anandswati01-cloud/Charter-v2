/* ── SkyVayu — Supabase Integration ── */

var currentQueryId  = null;
var realtimeChannel = null;

function showToast(message, type) {
  var existing = document.getElementById('sv-toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.id = 'sv-toast';
  var bg = type === 'error' ? '#E24B4A' : type === 'success' ? '#2E7D52' : '#185FA5';
  toast.style.cssText = ['position:fixed','bottom:24px','left:50%','transform:translateX(-50%)','background:' + bg,'color:#fff','padding:12px 20px','border-radius:8px','font-size:14px','font-family:var(--font-body, sans-serif)','z-index:9999','box-shadow:0 4px 20px rgba(0,0,0,0.4)','max-width:90vw','text-align:center','transition:opacity 0.3s'].join(';');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 300);
  }, 4000);
}

async function saveQueryToSupabase(queryData) {
  var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
  var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
  function sanitise(val) {
    if (typeof val !== 'string') return val;
    return val.replace(/<[^>]*>/g, '').trim().substring(0, 500);
  }
  var safe = {
    trip_type:    sanitise(queryData.trip_type),
    departure:    sanitise(queryData.departure)    || null,
    destination:  sanitise(queryData.destination)  || null,
    flight_date:  queryData.flight_date            || null,
    flight_time:  queryData.flight_time            || null,
    return_date:  queryData.return_date            || null,
    return_time:  queryData.return_time            || null,
    passengers:   parseInt(queryData.passengers)   || 1,
    client_phone: sanitise(queryData.client_phone),
    sectors:      queryData.sectors                || null,
    medivac:      queryData.medivac                || false,
    pets:         queryData.pets                   || false,
    infants:      queryData.infants                || false,
    status:       'open'
  };
  try {
    var response = await fetch(SUPABASE_URL + '/rest/v1/queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'return=representation'
      },
      body: JSON.stringify(safe)
    });
    var text = await response.text();
    if (!response.ok) {
      var errMsg = 'Could not save your request. Please try again.';
      try { var errData = JSON.parse(text); if (errData.message) errMsg = errData.message; } catch (e) {}
      console.error('Supabase error', response.status, text);
      showToast('⚠ ' + errMsg, 'error');
      return null;
    }
    var data = JSON.parse(text);
    return (Array.isArray(data) && data[0]) ? data[0] : null;
  } catch (e) {
    console.error('Supabase fetch error:', e);
    showToast('⚠ Network error — please check your connection and try again.', 'error');
    return null;
  }
}

async function saveBookingToSupabase(bookingData) {
  var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
  var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
  function sanitise(val) {
    if (typeof val !== 'string') return val;
    return val.replace(/<[^>]*>/g, '').trim().substring(0, 500);
  }
  var safe = {
    query_id:     bookingData.query_id     || null,
    quote_id:     bookingData.quote_id     || null,
    ref:          sanitise(bookingData.ref),
    client_name:  sanitise(bookingData.client_name),
    client_email: sanitise(bookingData.client_email),
    client_phone: sanitise(bookingData.client_phone),
    operator_name:sanitise(bookingData.operator_name),
    aircraft:     sanitise(bookingData.aircraft)     || null,
    route:        sanitise(bookingData.route)         || null,
    flight_date:  sanitise(bookingData.flight_date)   || null,
    passengers:   parseInt(bookingData.passengers)    || null,
    total_amount: parseFloat(bookingData.total_amount)|| null,
    platform_fee: parseFloat(bookingData.platform_fee)|| null,
    status:       'confirmed'
  };
  try {
    var response = await fetch(SUPABASE_URL + '/rest/v1/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'return=representation'
      },
      body: JSON.stringify(safe)
    });
    var text = await response.text();
    if (!response.ok) {
      var errMsg = 'Could not confirm your booking. Please contact support.';
      try { var errData = JSON.parse(text); if (errData.message) errMsg = errData.message; } catch (e) {}
      console.error('Booking save error', response.status, text);
      showToast('⚠ ' + errMsg, 'error');
      return null;
    }
    var data = JSON.parse(text);
    return (Array.isArray(data) && data[0]) ? data[0] : null;
  } catch (e) {
    console.error('Booking fetch error:', e);
    showToast('⚠ Network error — booking could not be saved. Please contact support.', 'error');
    return null;
  }
}

function subscribeToQuotes(queryId) {
  if (realtimeChannel) {
    realtimeChannel.close();
    realtimeChannel = null;
  }
  var SUPABASE_URL = SKYVAYU_CONFIG.supabaseUrl;
  var SUPABASE_KEY = SKYVAYU_CONFIG.supabaseKey;
  var wsUrl = SUPABASE_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPABASE_KEY + '&vsn=1.0.0';
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
            type:          'received',
            operator_name: q.operator_name,
            aircraft_type: q.aircraft_type,
            seats:         q.seats_available,
            price:         q.price,
            notes:         q.notes
          });
          updateResultsDisplay();
        }
      } catch (e) {}
    };
    ws.onerror = function() {
      showToast('Live updates disconnected. Refresh if quotes are not appearing.', 'info');
    };
    ws.onclose = function() {
      console.warn('Realtime WS closed for query', queryId);
    };
  } catch (e) {
    console.error('Could not connect to Supabase Realtime:', e);
    showToast('Could not connect for live quotes. Please refresh the page.', 'error');
  }
}
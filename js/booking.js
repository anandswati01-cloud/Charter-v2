/* ── SkyVayu — Booking Page ── */

var currentTripType = 'oneway';
var sectorCount     = 0;

function fmtDate(d) {
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var p = d.split('-');
  return parseInt(p[2]) + ' ' + m[parseInt(p[1]) - 1] + ' ' + p[0];
}

function fmtTime(t) {
  var p  = t.split(':');
  var h  = parseInt(p[0]);
  var ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + p[1] + ' ' + ap;
}

function showErr(inputId, errId) {
  var el  = document.getElementById(inputId);
  var msg = document.getElementById(errId);
  if (el)  el.classList.add('error');
  if (msg) msg.classList.add('visible');
  if (el)  el.focus();
}

function clearErr(input) {
  input.classList.remove('error');
  var msg = document.getElementById('err-' + input.id);
  if (msg) msg.classList.remove('visible');
}

function clearAllErrors() {
  document.querySelectorAll('input.error').forEach(function(el) { el.classList.remove('error'); });
  document.querySelectorAll('.error-msg.visible').forEach(function(el) { el.classList.remove('visible'); });
}

function setSearchLoading(loading) {
  var btn = document.getElementById('btn-search');
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Searching…';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Search flights';
  }
}

function tog(el) {
  var siblings = el.parentElement.querySelectorAll('.toggle-btn');
  siblings.forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
}

function setTripType(type) {
  currentTripType = type;
  ['oneway','return','multi'].forEach(function(t) {
    document.getElementById('tt-' + t).classList.toggle('active', t === type);
  });
  document.getElementById('oneway-wrap').style.display = (type !== 'multi') ? 'block' : 'none';
  document.getElementById('multi-sector-wrap').classList.toggle('visible', type === 'multi');
  var returnRow = document.getElementById('return-row');
  if (type === 'return') {
    returnRow.classList.add('visible');
  } else {
    returnRow.classList.remove('visible');
  }
  if (type === 'multi' && sectorCount === 0) {
    addSector(); addSector();
  }
}

function addSector() {
  sectorCount++;
  var n   = sectorCount;
  var div = document.createElement('div');
  div.className = 'sector-card';
  div.id = 'sector-' + n;
  div.innerHTML =
    '<div class="sector-number">Sector ' + n
    + (n > 2 ? '<button class="sector-remove" onclick="removeSector(' + n + ')">×</button>' : '')
    + '</div>'
    + '<div class="grid-2">'
    + '<div class="field-group"><label class="field-label">From</label>'
    + '<div class="ac-wrap"><input type="text" id="sec-dep-' + n + '" placeholder="Departure" autocomplete="off"'
    + ' oninput="acInput(this,\'ac-sdep-' + n + '\')" onkeydown="acKey(event,\'ac-sdep-' + n + '\')"'
    + ' onfocus="acInput(this,\'ac-sdep-' + n + '\')" onblur="acBlur(\'ac-sdep-' + n + '\')" />'
    + '<div class="ac-dropdown" id="ac-sdep-' + n + '"></div></div></div>'
    + '<div class="field-group"><label class="field-label">To</label>'
    + '<div class="ac-wrap"><input type="text" id="sec-dest-' + n + '" placeholder="Destination" autocomplete="off"'
    + ' oninput="acInput(this,\'ac-sdest-' + n + '\')" onkeydown="acKey(event,\'ac-sdest-' + n + '\')"'
    + ' onfocus="acInput(this,\'ac-sdest-' + n + '\')" onblur="acBlur(\'ac-sdest-' + n + '\')" />'
    + '<div class="ac-dropdown" id="ac-sdest-' + n + '"></div></div></div>'
    + '</div>'
    + '<div class="grid-2">'
    + '<div class="field-group"><label class="field-label">Date</label>'
    + '<input type="date" id="sec-date-' + n + '" /></div>'
    + '<div class="field-group"><label class="field-label">Time (optional)</label>'
    + '<input type="time" id="sec-time-' + n + '" /></div>'
    + '</div>';
  document.getElementById('sectors-list').appendChild(div);
}

function removeSector(n) {
  var el = document.getElementById('sector-' + n);
  if (el) el.remove();
  reNumberSectors();
}

function reNumberSectors() {
  var cards = document.querySelectorAll('#sectors-list .sector-card');
  cards.forEach(function(card, i) {
    var numEl = card.querySelector('.sector-number');
    if (numEl) {
      var removeBtn = i >= 2
        ? '<button class="sector-remove" onclick="removeSector(' + card.id.replace('sector-','') + ')">×</button>'
        : '';
      numEl.innerHTML = 'Sector ' + (i + 1) + removeBtn;
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(window.location.search);
  var from   = params.get('from');
  var to     = params.get('to');
  if (from) document.getElementById('departure').value   = from;
  if (to)   document.getElementById('destination').value = to;
});

async function goToResults() {
  clearAllErrors();
  if (!otpVerified) {
    document.getElementById('otp-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('otp-section').style.borderColor = '#E24B4A';
    setTimeout(function() { document.getElementById('otp-section').style.borderColor = ''; }, 2000);
    if (!document.getElementById('otp-phone').value.trim()) {
      document.getElementById('otp-phone').focus();
    }
    showToast('⚠ Please verify your mobile number before searching.', 'error');
    return;
  }
  if (currentTripType === 'multi') {
    var cards  = document.querySelectorAll('#sectors-list .sector-card');
    var routes = [];
    var valid2 = true;
    cards.forEach(function(card) {
      var n      = card.id.replace('sector-', '');
      var depEl  = document.getElementById('sec-dep-'  + n);
      var destEl = document.getElementById('sec-dest-' + n);
      var dateEl = document.getElementById('sec-date-' + n);
      var timeEl = document.getElementById('sec-time-' + n);
      if (depEl  && !depEl.value.trim())  { depEl.classList.add('error');  if (valid2) { depEl.focus();  valid2 = false; } }
      if (destEl && !destEl.value.trim()) { destEl.classList.add('error'); if (valid2) { destEl.focus(); valid2 = false; } }
      if (dateEl && !dateEl.value)        { dateEl.classList.add('error'); if (valid2) { dateEl.focus(); valid2 = false; } }
      routes.push({
        from: depEl  ? (depEl.value  || '—') : '—',
        to:   destEl ? (destEl.value || '—') : '—',
        date: dateEl && dateEl.value ? fmtDate(dateEl.value) : '—',
        time: timeEl && timeEl.value ? fmtTime(timeEl.value) : '—'
      });
    });
    var pxm = document.getElementById('passengers-multi').value;
    if (!pxm || pxm < 1) { document.getElementById('passengers-multi').classList.add('error'); valid2 = false; }
    if (!valid2) {
      showToast('⚠ Please fill in all required fields for every sector.', 'error');
      return;
    }
    var medivac = document.querySelector('[data-req="medivac"] .toggle-btn.active');
    var pets    = document.querySelector('[data-req="pets"] .toggle-btn.active');
    var infants = document.querySelector('[data-req="infants"] .toggle-btn.active');
    var queryPayload = {
      trip_type:    'multi',
      sectors:      routes,
      passengers:   parseInt(pxm),
      client_phone: otpPhone,
      medivac:      medivac && medivac.textContent === 'Yes',
      pets:         pets    && pets.textContent    === 'Yes',
      infants:      infants && infants.textContent === 'Yes',
      status:       'open'
    };
    setSearchLoading(true);
    var saved = await saveQueryToSupabase(queryPayload);
    setSearchLoading(false);
    if (!saved) return;
    sessionStorage.setItem('sv_query_id', saved.id);
    sessionStorage.setItem('sv_query', JSON.stringify(Object.assign({}, queryPayload, {
      rs_type:  'Multiple sectors',
      rs_route: routes.length + ' sectors',
      rs_date:  routes[0] ? routes[0].date : '—',
      rs_pax:   pxm + ' passenger' + (pxm == 1 ? '' : 's')
    })));
    window.location.href = 'results.html';
    return;
  }
  var dep  = document.getElementById('departure').value.trim();
  var dest = document.getElementById('destination').value.trim();
  var d    = document.getElementById('flight-date').value;
  var t    = document.getElementById('flight-time').value;
  var px   = document.getElementById('passengers').value;
  var valid = true;
  if (!dep)          { showErr('departure',   'err-departure');   valid = false; }
  if (!dest)         { showErr('destination', 'err-destination'); valid = false; }
  if (!d)            { showErr('flight-date', 'err-flight-date'); valid = false; }
  if (!px || px < 1) { showErr('passengers',  'err-passengers');  valid = false; }
  if (currentTripType === 'return') {
    var rd = document.getElementById('return-date').value;
    if (!rd) { showErr('return-date', 'err-return-date'); valid = false; }
  }
  if (!valid) return;
  var rd2 = currentTripType === 'return' ? document.getElementById('return-date').value : null;
  var rt  = currentTripType === 'return' ? document.getElementById('return-time').value  : null;
  var typeLabels = { oneway: 'One way', return: 'Round trip' };
  var routeText  = currentTripType === 'return' ? dep + ' ⇄ ' + dest : dep + ' → ' + dest;
  var dateText   = fmtDate(d) + (t ? ', ' + fmtTime(t) : '')
                 + (rd2 ? ' · Return ' + fmtDate(rd2) + (rt ? ', ' + fmtTime(rt) : '') : '');
  var queryPayload = {
    trip_type:    currentTripType,
    departure:    dep,
    destination:  dest,
    flight_date:  d,
    flight_time:  t,
    return_date:  rd2,
    return_time:  rt,
    passengers:   parseInt(px),
    client_phone: otpPhone,
    status:       'open'
  };
  setSearchLoading(true);
  var saved = await saveQueryToSupabase(queryPayload);
  setSearchLoading(false);
  if (!saved) return;
  sessionStorage.setItem('sv_query_id', saved.id);
  sessionStorage.setItem('sv_query', JSON.stringify(Object.assign({}, queryPayload, {
    rs_type:  typeLabels[currentTripType] || 'One way',
    rs_route: routeText,
    rs_date:  dateText,
    rs_pax:   px + ' passenger' + (px == 1 ? '' : 's')
  })));
  window.location.href = 'results.html';
}
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
  if (!input) return;
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
    btn.textContent = 'Searching\u2026';
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
    var btn = document.getElementById('tt-' + t);
    if (btn) btn.classList.toggle('active', t === type);
  });
  var onewayWrap = document.getElementById('oneway-wrap');
  var multiWrap  = document.getElementById('multi-sector-wrap');
  var returnRow  = document.getElementById('return-row');
  if (onewayWrap) onewayWrap.style.display = (type !== 'multi') ? 'block' : 'none';
  if (multiWrap)  multiWrap.classList.toggle('visible', type === 'multi');
  if (returnRow)  returnRow.classList.toggle('visible', type === 'return');
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
    + (n > 2 ? '<button class="sector-remove" type="button" onclick="removeSector(' + n + ')">\u00d7</button>' : '')
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
    + '<input type="date" id="sec-date-' + n + '" min="' + todayISO() + '" /></div>'
    + '<div class="field-group"><label class="field-label">Time <span style="font-weight:400;color:var(--text-tertiary);">(optional)</span></label>'
    + '<input type="time" id="sec-time-' + n + '" /></div>'
    + '</div>';
  var list = document.getElementById('sectors-list');
  if (list) list.appendChild(div);
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
      var originalId = card.id.replace('sector-', '');
      var removeBtn = i >= 2
        ? '<button class="sector-remove" type="button" onclick="removeSector(' + originalId + ')">\u00d7</button>'
        : '';
      numEl.innerHTML = 'Sector ' + (i + 1) + removeBtn;
    }
  });
}

/* Returns today's date in YYYY-MM-DD for min= attributes */
function todayISO() {
  var d = new Date();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

/* Read active toggle value for special requirements */
function getToggleValue(dataReq) {
  var activeBtn = document.querySelector('[data-req="' + dataReq + '"] .toggle-btn.active');
  return !!(activeBtn && activeBtn.textContent.trim() === 'Yes');
}

document.addEventListener('DOMContentLoaded', function() {
  /* Pre-fill from URL query params (homepage route cards) */
  var params = new URLSearchParams(window.location.search);
  var from   = params.get('from');
  var to     = params.get('to');
  if (from) {
    var depEl = document.getElementById('departure');
    if (depEl) depEl.value = from;
  }
  if (to) {
    var destEl = document.getElementById('destination');
    if (destEl) destEl.value = to;
  }

  /* Set min date on date inputs to today */
  var today = todayISO();
  var dateInputs = ['flight-date', 'return-date'];
  dateInputs.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.min = today;
  });
});

async function goToResults() {
  clearAllErrors();

  if (!otpVerified) {
    var otpSection = document.getElementById('otp-section');
    if (otpSection) {
      otpSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      otpSection.style.borderColor = '#E24B4A';
      setTimeout(function() { otpSection.style.borderColor = ''; }, 2000);
    }
    var phoneEl = document.getElementById('otp-phone');
    if (phoneEl && !phoneEl.value.trim()) phoneEl.focus();
    showToast('Please verify your mobile number before searching.', 'error');
    return;
  }

  /* ── Multi-sector flow ── */
  if (currentTripType === 'multi') {
    var cards   = document.querySelectorAll('#sectors-list .sector-card');
    var routes  = [];
    var valid2  = true;
    var firstInvalid = null;

    cards.forEach(function(card) {
      var n      = card.id.replace('sector-', '');
      var depEl  = document.getElementById('sec-dep-'  + n);
      var destEl = document.getElementById('sec-dest-' + n);
      var dateEl = document.getElementById('sec-date-' + n);
      var timeEl = document.getElementById('sec-time-' + n);
      if (depEl  && !depEl.value.trim())  { depEl.classList.add('error');  if (!firstInvalid) firstInvalid = depEl; }
      if (destEl && !destEl.value.trim()) { destEl.classList.add('error'); if (!firstInvalid) firstInvalid = destEl; }
      if (dateEl && !dateEl.value)        { dateEl.classList.add('error'); if (!firstInvalid) firstInvalid = dateEl; }
      if ((depEl && !depEl.value.trim()) || (destEl && !destEl.value.trim()) || (dateEl && !dateEl.value)) {
        valid2 = false;
      }
      routes.push({
        from: depEl  ? (depEl.value.trim()  || '\u2014') : '\u2014',
        to:   destEl ? (destEl.value.trim() || '\u2014') : '\u2014',
        date: dateEl && dateEl.value ? fmtDate(dateEl.value) : '\u2014',
        time: timeEl && timeEl.value ? fmtTime(timeEl.value) : '\u2014'
      });
    });

    var pxmEl = document.getElementById('passengers-multi');
    var pxm   = pxmEl ? parseInt(pxmEl.value) : 0;
    if (!pxm || pxm < 1) {
      if (pxmEl) pxmEl.classList.add('error');
      if (!firstInvalid) firstInvalid = pxmEl;
      valid2 = false;
    }

    if (!valid2) {
      if (firstInvalid) firstInvalid.focus();
      showToast('Please fill in all required fields for every sector.', 'error');
      return;
    }

    var queryPayload = {
      trip_type:    'multi',
      sectors:      routes,
      passengers:   pxm,
      client_phone: otpPhone,
      medivac:      getToggleValue('medivac'),
      pets:         getToggleValue('pets'),
      infants:      getToggleValue('infants'),
      status:       'open'
    };

    setSearchLoading(true);
    var saved = await saveQueryToSupabase(queryPayload);
    setSearchLoading(false);
    if (!saved) return;

    sessionStorage.setItem('sv_query_id', saved.id);
    sessionStorage.setItem('sv_query', JSON.stringify(Object.assign({}, queryPayload, {
      rs_type:  'Multiple sectors',
      rs_route: routes.length + ' sector' + (routes.length === 1 ? '' : 's'),
      rs_date:  routes[0] ? routes[0].date : '\u2014',
      rs_pax:   pxm + ' passenger' + (pxm === 1 ? '' : 's')
    })));
    window.location.href = 'results.html';
    return;
  }

  /* ── One-way / return flow ── */
  var dep  = document.getElementById('departure')  ? document.getElementById('departure').value.trim()  : '';
  var dest = document.getElementById('destination') ? document.getElementById('destination').value.trim() : '';
  var d    = document.getElementById('flight-date') ? document.getElementById('flight-date').value       : '';
  var t    = document.getElementById('flight-time') ? document.getElementById('flight-time').value       : '';
  var pxEl = document.getElementById('passengers');
  var px   = pxEl ? parseInt(pxEl.value) : 0;

  var valid = true;
  if (!dep)        { showErr('departure',   'err-departure');   valid = false; }
  if (!dest)       { showErr('destination', 'err-destination'); valid = false; }
  if (!d)          { showErr('flight-date', 'err-flight-date'); valid = false; }
  if (!px || px < 1) { showErr('passengers', 'err-passengers'); valid = false; }

  var rd = null, rt = null;
  if (currentTripType === 'return') {
    var rdEl = document.getElementById('return-date');
    var rtEl = document.getElementById('return-time');
    rd = rdEl ? rdEl.value : '';
    rt = rtEl ? rtEl.value : '';
    if (!rd) { showErr('return-date', 'err-return-date'); valid = false; }
  }

  if (!valid) return;

  var typeLabels = { oneway: 'One way', return: 'Round trip' };
  var routeText  = currentTripType === 'return' ? dep + ' \u21c4 ' + dest : dep + ' \u2192 ' + dest;
  var dateText   = fmtDate(d) + (t ? ', ' + fmtTime(t) : '')
                 + (rd ? ' \u00b7 Return ' + fmtDate(rd) + (rt ? ', ' + fmtTime(rt) : '') : '');

  var queryPayload = {
    trip_type:    currentTripType,
    departure:    dep,
    destination:  dest,
    flight_date:  d,
    flight_time:  t || null,
    return_date:  rd || null,
    return_time:  rt || null,
    passengers:   px,
    client_phone: otpPhone,
    medivac:      getToggleValue('medivac'),
    pets:         getToggleValue('pets'),
    infants:      getToggleValue('infants'),
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
    rs_pax:   px + ' passenger' + (px === 1 ? '' : 's')
  })));
  window.location.href = 'results.html';
}

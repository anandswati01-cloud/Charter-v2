/* ── SkyVayu — Payment & Confirmation Page ── */

document.addEventListener('DOMContentLoaded', function() {
  var raw = sessionStorage.getItem('sv_selected_op');
  if (!raw) {
    /* No selection in session — redirect back to results */
    showToast('No quote selected. Please choose a quote first.', 'error');
    setTimeout(function() { window.location.href = 'results.html'; }, 2500);
    return;
  }
  try {
    var op = JSON.parse(raw);
    var subtitle = document.getElementById('pay-subtitle');
    if (subtitle) subtitle.textContent = 'Complete your booking with ' + (op.name || 'operator');
    setText('pay-op',       op.name);
    setText('pay-aircraft', op.aircraft);
    setText('pay-route',    op.route);
    setText('pay-date',     op.date);
    setText('pay-pax',      op.pax);
    setText('pay-charter',  op.charter);
    setText('pay-platform', op.platform);
    setText('pay-total',    op.total);
    var btn = document.getElementById('pay-btn');
    if (btn) btn.textContent = 'Pay ' + (op.total || '') + ' & confirm booking';
  } catch (e) {
    console.error('Could not load operator data', e);
    showToast('Could not load booking details. Please go back and try again.', 'error');
  }
});

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value || '\u2014';
}

function switchTab(tab) {
  ['card','upi','nb'].forEach(function(t) {
    var tabEl   = document.getElementById('tab-'   + t);
    var panelEl = document.getElementById('panel-' + t);
    if (tabEl)   tabEl.classList.remove('active');
    if (panelEl) panelEl.classList.remove('active');
  });
  var activeTab   = document.getElementById('tab-'   + tab);
  var activePanel = document.getElementById('panel-' + tab);
  if (activeTab)   activeTab.classList.add('active');
  if (activePanel) activePanel.classList.add('active');
}

function selUpi(el) {
  document.querySelectorAll('.upi-app').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
}

function selBank(el) {
  document.querySelectorAll('.bank-option').forEach(function(b) {
    b.classList.remove('active');
    var radio = b.querySelector('input[type="radio"]');
    if (radio) radio.checked = false;
  });
  el.classList.add('active');
  var radio = el.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;
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

function setConfirmLoading(loading) {
  var btn = document.getElementById('pay-btn');
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Confirming booking\u2026';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Confirm booking';
  }
}

function generateRef(operatorName) {
  var ini = operatorName
    ? operatorName.split(' ').map(function(w) { return w[0] || ''; }).join('').substring(0, 3).toUpperCase()
    : 'SKY';
  if (!ini) ini = 'SKY';
  return ini + '-' + Math.floor(1000 + Math.random() * 9000);
}

function parseAmount(str) {
  if (!str) return null;
  var n = parseFloat(String(str).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : n;
}

/* Guards against double-submit */
var _confirmInProgress = false;

async function confirmBooking() {
  if (_confirmInProgress) return;
  clearAllErrors();

  var clientName  = document.getElementById('client-name')  ? document.getElementById('client-name').value.trim()  : '';
  var clientEmail = document.getElementById('client-email') ? document.getElementById('client-email').value.trim() : '';
  var clientPhone = document.getElementById('client-phone') ? document.getElementById('client-phone').value.trim() : '';

  var valid = true;
  if (!clientName) {
    showErr('client-name', 'err-client-name');
    valid = false;
  }
  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    showErr('client-email', 'err-client-email');
    valid = false;
  }
  if (!clientPhone || !/^[\d\s+\-()]{7,20}$/.test(clientPhone)) {
    showErr('client-phone', 'err-client-phone');
    valid = false;
  }
  if (!valid) return;

  var raw = sessionStorage.getItem('sv_selected_op');
  var op  = {};
  if (raw) {
    try { op = JSON.parse(raw); } catch (e) { op = {}; }
  }

  /* Retrieve passenger count from original query */
  var queryRaw    = sessionStorage.getItem('sv_query');
  var queryData   = {};
  if (queryRaw) {
    try { queryData = JSON.parse(queryRaw); } catch (e) { queryData = {}; }
  }
  var passengers = parseInt(queryData.passengers) || null;

  var ref = generateRef(op.name);
  var bookingPayload = {
    query_id:      sessionStorage.getItem('sv_query_id') || null,
    quote_id:      null,
    ref:           ref,
    client_name:   clientName,
    client_email:  clientEmail,
    client_phone:  clientPhone,
    operator_name: op.name      || '',
    aircraft:      op.aircraft  || null,
    route:         op.route     || null,
    flight_date:   op.date      || null,
    passengers:    passengers,
    total_amount:  parseAmount(op.total),
    platform_fee:  parseAmount(op.platform),
    status:        'confirmed'
  };

  _confirmInProgress = true;
  setConfirmLoading(true);
  var saved = await saveBookingToSupabase(bookingPayload);
  setConfirmLoading(false);
  _confirmInProgress = false;

  if (!saved) return;

  sessionStorage.setItem('sv_confirmation', JSON.stringify({
    ref:          ref,
    route:        op.route    || '\u2014',
    date:         op.date     || '\u2014',
    op_name:      op.name     || '\u2014',
    aircraft:     op.aircraft || '\u2014',
    pax:          op.pax      || '\u2014',
    total:        op.total    || '\u2014',
    client_name:  clientName,
    client_email: clientEmail,
    client_phone: clientPhone
  }));
  window.location.href = 'confirmed.html';
}

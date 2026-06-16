/* ── SkyVayu — Payment Page ── */

var _editMode = true;

document.addEventListener('DOMContentLoaded', function() {
  // Try sv_selected_quote (set by results.html) first, fall back to sv_selected_op
  var raw = sessionStorage.getItem('sv_selected_quote') || sessionStorage.getItem('sv_selected_op');
  var queryRaw = sessionStorage.getItem('sv_query');
  var queryData = {};
  if (queryRaw) { try { queryData = JSON.parse(queryRaw); } catch(e){} }

  if (!raw) {
    showToast('No quote selected. Please choose a quote first.', 'error');
    setTimeout(function() { window.location.href = 'results.html'; }, 2500);
    return;
  }

  try {
    var q = JSON.parse(raw);

    // Populate subtitle
    setText('pay-subtitle', 'Complete your booking with ' + (q.operator_name || q.name || 'operator'));

    // Build route from query data (departure/destination) or fallback to quote route string
    var dep = queryData.departure || '';
    var dest = queryData.destination || '';
    var route = q.route || queryData.rs_route || (dep && dest ? dep + ' \u2192 ' + dest : '—');
    var routeParts = route.split(/\u2192|\u21c4|→|⇄/).map(function(s){ return s.trim(); });
    function getCode(s) { var m = (s||'').match(/\(([^)]+)\)/); return m ? m[1] : (s||'').substring(0,3).toUpperCase() || '—'; }
    setText('pay-route-short', getCode(routeParts[0]) + ' \u2192 ' + getCode(routeParts[1] || ''));
    setText('pay-route', route);

    // Aircraft
    setText('pay-aircraft', q.aircraft_type || q.aircraft || '—');
    setText('pay-aircraft-full', q.aircraft_type || q.aircraft || '—');

    // Date — read from sv_query flight_date + flight_time
    var flightDate = queryData.flight_date || queryData.rs_date || q.date || '';
    var flightTime = queryData.flight_time || '';
    var dateStr = '—';
    if (flightDate) {
      try {
        var d = new Date(flightDate);
        dateStr = d.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
        if (flightTime) dateStr += ', ' + flightTime;
      } catch(e) { dateStr = flightDate + (flightTime ? ', ' + flightTime : ''); }
    }
    setText('pay-date', dateStr);
    setText('pay-datetime', dateStr);

    // Operator
    setText('pay-op', q.operator_name || q.name || '—');

    // Passengers
    var pax = queryData.passengers || queryData.rs_pax || q.pax || '—';
    setText('pay-pax', pax + ' Passenger' + (parseInt(pax) !== 1 ? 's' : ''));

    // Price — no platform fee at this time
    var price = q.price || q.total_amount || null;
    var platformFee = 0;
    var charterFee = price;

    setText('pay-charter', price ? '₹' + Number(price).toLocaleString('en-IN') : '—');
    setText('pay-platform', '₹0');
    setText('pay-total', price ? '₹' + Number(price).toLocaleString('en-IN') : '—');
    setText('pay-total', price ? '₹' + Number(price).toLocaleString('en-IN') : '—');

    var btn = document.getElementById('pay-btn');
    if (btn && price) btn.textContent = 'Confirm & Pay ₹' + Number(price).toLocaleString('en-IN');

    // Pre-fill phone from OTP verification if available
    var phone = sessionStorage.getItem('sv_verified_phone') || '';
    if (phone) {
      var phoneInput = document.getElementById('client-phone');
      if (phoneInput) phoneInput.value = phone;
    }

    // Start in edit mode so user fills in details
    setEditMode(true);

  } catch(e) {
    console.error('Could not load quote data', e);
    showToast('Could not load booking details. Please go back and try again.', 'error');
  }
});

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value || '—';
}

function setEditMode(edit) {
  _editMode = edit;
  var card = document.getElementById('traveller-card');
  var btn = document.getElementById('edit-btn');
  if (!card) return;
  if (edit) {
    card.className = 'traveller-card edit-mode';
    if (btn) btn.textContent = 'Save';
  } else {
    // Save values to display
    var name = document.getElementById('client-name');
    var email = document.getElementById('client-email');
    var phone = document.getElementById('client-phone');
    if (name) setText('val-name', name.value || '—');
    if (email) {
      setText('val-email', email.value || '—');
      var badge = document.getElementById('verified-badge');
      if (badge && email.value) badge.style.display = 'inline-flex';
    }
    if (phone) setText('val-phone', phone.value || '—');
    card.className = 'traveller-card view-mode';
    if (btn) btn.textContent = 'Edit';
  }
}

function toggleEdit() {
  setEditMode(!_editMode);
}

function switchTab(tab) {
  ['card','upi','nb'].forEach(function(t) {
    var tabEl = document.getElementById('tab-' + t);
    var panelEl = document.getElementById('panel-' + t);
    if (tabEl) tabEl.classList.remove('active');
    if (panelEl) panelEl.classList.remove('active');
  });
  var at = document.getElementById('tab-' + tab);
  var ap = document.getElementById('panel-' + tab);
  if (at) at.classList.add('active');
  if (ap) ap.classList.add('active');
}

function selUpi(el) {
  document.querySelectorAll('.upi-app').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
}

function selBank(el) {
  document.querySelectorAll('.bank-option').forEach(function(b){
    b.classList.remove('active');
    var r = b.querySelector('input[type="radio"]');
    if (r) r.checked = false;
  });
  el.classList.add('active');
  var r = el.querySelector('input[type="radio"]');
  if (r) r.checked = true;
}

function showErr(inputId, errId) {
  var el = document.getElementById(inputId);
  var msg = document.getElementById(errId);
  if (el) { el.classList.add('error'); el.focus(); }
  if (msg) msg.classList.add('visible');
}

function clearErr(input) {
  if (!input) return;
  input.classList.remove('error');
  var msg = document.getElementById('err-' + input.id);
  if (msg) msg.classList.remove('visible');
}

function clearAllErrors() {
  document.querySelectorAll('input.error').forEach(function(el){ el.classList.remove('error'); });
  document.querySelectorAll('.error-msg.visible').forEach(function(el){ el.classList.remove('visible'); });
}

function setConfirmLoading(loading) {
  var btn = document.getElementById('pay-btn');
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Confirming booking…';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Confirm & Pay';
  }
}

function generateRef(operatorName) {
  var ini = operatorName
    ? operatorName.split(' ').map(function(w){ return w[0]||''; }).join('').substring(0,3).toUpperCase()
    : 'SKY';
  return (ini || 'SKY') + '-' + Math.floor(1000 + Math.random() * 9000);
}

function parseAmount(str) {
  if (!str) return null;
  var n = parseFloat(String(str).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : n;
}

// ── Step 1 → Step 2 ──
function goToPayment2() {
  // If still in edit mode, save first
  if (_editMode) setEditMode(false);

  var clientName  = (document.getElementById('client-name')  || {}).value || '';
  var clientEmail = (document.getElementById('client-email') || {}).value || '';
  var clientPhone = (document.getElementById('client-phone') || {}).value || '';

  clientName = clientName.trim();
  clientEmail = clientEmail.trim();
  clientPhone = clientPhone.trim();

  clearAllErrors();
  var valid = true;
  if (!clientName) { showErr('client-name','err-client-name'); valid = false; }
  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) { showErr('client-email','err-client-email'); valid = false; }
  if (!clientPhone || !/^[\d\s+\-()+]{7,20}$/.test(clientPhone)) { showErr('client-phone','err-client-phone'); valid = false; }
  if (!valid) { setEditMode(true); return; }

  /* — Phone OTP gate — */
  if (!window.payPhoneOtpVerified) {
    var otpErrEl = document.getElementById('err-client-phone');
    if (otpErrEl) {
      otpErrEl.textContent = 'Please verify your phone number with OTP before proceeding.';
      otpErrEl.style.display = 'block';
    }
    setEditMode(true);
    return;
  }

  // Save traveller details to sessionStorage for payment2
  sessionStorage.setItem('sv_traveller', JSON.stringify({
    name:  clientName,
    email: clientEmail,
    phone: clientPhone
  }));
  window.location.href = 'payment2.html';
}

// Booking is now handled entirely by payment2.html via goToPayment2()

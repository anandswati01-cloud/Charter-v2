/* -- SkyVayu - OTP & Country Dropdown -- */

var otpVerified   = false;
var otpPhone      = '';
var otpResendTimer = null;

var COUNTRIES = [
  {iso:'in',code:'IN',dial:'+91',name:'India'},
  {iso:'us',code:'US',dial:'+1',name:'United States'},
  {iso:'ca',code:'CA',dial:'+1',name:'Canada'},
  {iso:'gb',code:'GB',dial:'+44',name:'United Kingdom'},
  {iso:'ae',code:'AE',dial:'+971',name:'UAE'},
  {iso:'qa',code:'QA',dial:'+974',name:'Qatar'},
  {iso:'sa',code:'SA',dial:'+966',name:'Saudi Arabia'},
  {iso:'om',code:'OM',dial:'+968',name:'Oman'},
  {iso:'bh',code:'BH',dial:'+973',name:'Bahrain'},
  {iso:'kw',code:'KW',dial:'+965',name:'Kuwait'},
  {iso:'sg',code:'SG',dial:'+65',name:'Singapore'},
  {iso:'my',code:'MY',dial:'+60',name:'Malaysia'},
  {iso:'au',code:'AU',dial:'+61',name:'Australia'},
  {iso:'nz',code:'NZ',dial:'+64',name:'New Zealand'},
  {iso:'jp',code:'JP',dial:'+81',name:'Japan'},
  {iso:'hk',code:'HK',dial:'+852',name:'Hong Kong'},
  {iso:'de',code:'DE',dial:'+49',name:'Germany'},
  {iso:'fr',code:'FR',dial:'+33',name:'France'},
  {iso:'it',code:'IT',dial:'+39',name:'Italy'},
  {iso:'es',code:'ES',dial:'+34',name:'Spain'},
  {iso:'nl',code:'NL',dial:'+31',name:'Netherlands'},
  {iso:'ch',code:'CH',dial:'+41',name:'Switzerland'},
  {iso:'se',code:'SE',dial:'+46',name:'Sweden'},
  {iso:'no',code:'NO',dial:'+47',name:'Norway'},
  {iso:'dk',code:'DK',dial:'+45',name:'Denmark'},
  {iso:'za',code:'ZA',dial:'+27',name:'South Africa'},
  {iso:'ng',code:'NG',dial:'+234',name:'Nigeria'},
  {iso:'ke',code:'KE',dial:'+254',name:'Kenya'},
  {iso:'br',code:'BR',dial:'+55',name:'Brazil'},
  {iso:'mx',code:'MX',dial:'+52',name:'Mexico'},
  {iso:'ar',code:'AR',dial:'+54',name:'Argentina'}
  ];
var selectedCountry = COUNTRIES[0];

function flagUrl(iso) { return 'https://flagcdn.com/w20/' + iso + '.png'; }

function renderCountryItems(list) {
    var container = document.getElementById('country-dd-items');
    if (!container) return;
    container.innerHTML = list.map(function(c) {
          var sel = (c.dial === selectedCountry.dial && c.code === selectedCountry.code) ? ' selected' : '';
          return '<div class="country-dd-item' + sel + '" onmousedown="selectCountry(\'' + c.code + '\')">'
            + '<img class="dd-flag" src="' + flagUrl(c.iso) + '" alt="' + c.code + '"/>'
            + '<span class="dd-name">' + c.name + '</span>'
            + '<span class="dd-dial">' + c.dial + '</span>'
            + '</div>';
    }).join('');
}

function toggleCountryDD() {
    var list = document.getElementById('country-dd-list');
    if (!list) return;
    if (list.classList.contains('open')) {
          list.classList.remove('open');
    } else {
          renderCountryItems(COUNTRIES);
          list.classList.add('open');
          var s = document.querySelector('.country-dd-search');
          if (s) s.value = '';
    }
}

function selectCountry(code) {
    var c = COUNTRIES.find(function(x) { return x.code === code; });
    if (!c) return;
    selectedCountry = c;
    var flagEl   = document.getElementById('country-flag');
    var codeEl   = document.getElementById('country-code');
    var hiddenEl = document.getElementById('country-hidden');
    var listEl   = document.getElementById('country-dd-list');
    var searchEl = document.querySelector('.country-dd-search');
    if (flagEl)   { flagEl.src = flagUrl(c.iso); flagEl.alt = c.code; }
    if (codeEl)   codeEl.textContent = c.dial;
    if (hiddenEl) hiddenEl.value = c.dial;
    if (listEl)   listEl.classList.remove('open');
    if (searchEl) searchEl.value = '';
}

function filterCountries(q) {
    var filtered = q ? COUNTRIES.filter(function(c) {
          return c.name.toLowerCase().indexOf(q.toLowerCase()) > -1
              || c.dial.indexOf(q) > -1
              || c.code.toLowerCase().indexOf(q.toLowerCase()) > -1;
    }) : COUNTRIES;
    renderCountryItems(filtered);
}

document.addEventListener('click', function(e) {
    var dd = document.getElementById('country-dd');
    var list = document.getElementById('country-dd-list');
    if (dd && list && !dd.contains(e.target)) list.classList.remove('open');
});

/* Real OTP via Supabase Auth */

async function sendOTP() {
    var phoneEl = document.getElementById('otp-phone');
    var codeEl  = document.getElementById('country-code');
    if (!phoneEl || !codeEl) return;
    var phone = phoneEl.value.trim();
    var code  = codeEl.value;
    if (!phone || !/^\d{6,15}$/.test(phone)) {
          var e = document.getElementById('err-otp-phone');
          if (e) e.classList.add('visible');
          return;
    }
    otpPhone = code + phone;
    var btn = document.getElementById('btn-send-otp');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    try {
          var r = await fetch(SKYVAYU_CONFIG.supabaseUrl + '/auth/v1/otp', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': SKYVAYU_CONFIG.supabaseKey },
                  body: JSON.stringify({ phone: otpPhone })
          });
          if (!r.ok) {
                  var d = await r.json().catch(function() { return {}; });
                  var msg = (d && d.msg) ? d.msg : 'Could not send OTP. Please check the number.';
                  if (typeof showToast === 'function') showToast(msg, 'error'); else alert(msg);
                  if (btn) { btn.disabled = false; btn.textContent = 'Send OTP'; }
                  return;
          }
          if (btn) { btn.disabled = true; btn.textContent = 'Sent'; }
          var ew = document.getElementById('otp-entry-wrap');
          if (ew) ew.style.display = 'block';
          var d1 = document.getElementById('otp-d1');
          if (d1) d1.focus();
          if (otpResendTimer) clearInterval(otpResendTimer);
          var secs = 30;
          var re = document.querySelector('.otp-resend');
          if (re) {
                  re.innerHTML = 'Resend in ' + secs + 's - <a onclick="changePhone()">Change number</a>';
                  otpResendTimer = setInterval(function() {
                            secs--;
                            if (secs <= 0) {
                                        clearInterval(otpResendTimer);
                                        otpResendTimer = null;
                                        re.innerHTML = "Didn't receive it? <a onclick=\"resendOTP()\">Resend OTP</a> - <a onclick=\"changePhone()\">Change number</a>";
                            } else {
                                        re.innerHTML = 'Resend in ' + secs + 's - <a onclick="changePhone()">Change number</a>';
                            }
                  }, 1000);
          }
    } catch (err) {
          console.error('OTP send error:', err);
          if (typeof showToast === 'function') showToast('Network error - could not send OTP.', 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Send OTP'; }
    }
}

async function verifyOTP() {
    var ids = ['otp-d1','otp-d2','otp-d3','otp-d4','otp-d5','otp-d6'];
    if (!ids.every(function(id) { return !!document.getElementById(id); })) return;
    var entered = ids.map(function(id) { return document.getElementById(id).value; }).join('');
    if (entered.length < 6) return;
    try {
          var r = await fetch(SKYVAYU_CONFIG.supabaseUrl + '/auth/v1/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': SKYVAYU_CONFIG.supabaseKey },
                  body: JSON.stringify({ phone: otpPhone, token: entered, type: 'sms' })
          });
          if (r.ok) {
                  otpVerified = true;
                  sessionStorage.setItem('sv_verified_phone', otpPhone);
                  var pw = document.getElementById('otp-phone-wrap');
                  var ew = document.getElementById('otp-entry-wrap');
                  var vt = document.getElementById('otp-verified-text');
                  var ve = document.getElementById('otp-verified');
                  if (pw) pw.style.display = 'none';
                  if (ew) ew.style.display = 'none';
                  if (vt) vt.textContent = otpPhone + ' verified';
                  if (ve) ve.classList.add('show');
                  if (otpResendTimer) { clearInterval(otpResendTimer); otpResendTimer = null; }
          } else {
                  var errEl = document.getElementById('err-otp-code');
                  if (errEl) errEl.classList.add('visible');
                  ids.forEach(function(id) {
                            var el = document.getElementById(id);
                            if (el) { el.value = ''; el.classList.add('error'); }
                  });
                  var d1 = document.getElementById('otp-d1');
                  if (d1) d1.focus();
                  setTimeout(function() {
                            document.querySelectorAll('.otp-digit').forEach(function(el) { el.classList.remove('error'); });
                  }, 800);
          }
    } catch (err) {
          console.error('OTP verify error:', err);
          if (typeof showToast === 'function') showToast('Network error - could not verify OTP.', 'error');
    }
}

function resendOTP() {
    ['otp-d1','otp-d2','otp-d3','otp-d4','otp-d5','otp-d6'].forEach(function(id) {
          var el = document.getElementById(id); if (el) el.value = '';
    });
    var errEl = document.getElementById('err-otp-code');
    if (errEl) errEl.classList.remove('visible');
    var btn = document.getElementById('btn-send-otp');
    if (btn) { btn.disabled = false; btn.textContent = 'Send OTP'; }
    sendOTP();
}

function changePhone() {
    if (otpResendTimer) { clearInterval(otpResendTimer); otpResendTimer = null; }
    otpVerified = false;
    otpPhone = '';
    var phone     = document.getElementById('otp-phone');
    var phoneWrap = document.getElementById('otp-phone-wrap');
    var entryWrap = document.getElementById('otp-entry-wrap');
    var errEl     = document.getElementById('err-otp-code');
    var verifiedEl = document.getElementById('otp-verified');
    var btn       = document.getElementById('btn-send-otp');
    if (phone)      phone.value = '';
    if (phoneWrap)  phoneWrap.style.display = '';
    if (entryWrap)  entryWrap.style.display = 'none';
    if (errEl)      errEl.classList.remove('visible');
    if (verifiedEl) verifiedEl.classList.remove('show');
    if (btn)        { btn.disabled = false; btn.textContent = 'Send OTP'; }
}

/* ── SkyVayu — OTP & Country Dropdown ── */

var otpVerified    = false;
var otpPhone       = '';
var otpGenerated   = '';
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
  {iso:'kr',code:'KR',dial:'+82',name:'South Korea'},
  {iso:'cn',code:'CN',dial:'+86',name:'China'},
  {iso:'hk',code:'HK',dial:'+852',name:'Hong Kong'},
  {iso:'tw',code:'TW',dial:'+886',name:'Taiwan'},
  {iso:'th',code:'TH',dial:'+66',name:'Thailand'},
  {iso:'vn',code:'VN',dial:'+84',name:'Vietnam'},
  {iso:'id',code:'ID',dial:'+62',name:'Indonesia'},
  {iso:'ph',code:'PH',dial:'+63',name:'Philippines'},
  {iso:'bd',code:'BD',dial:'+880',name:'Bangladesh'},
  {iso:'np',code:'NP',dial:'+977',name:'Nepal'},
  {iso:'lk',code:'LK',dial:'+94',name:'Sri Lanka'},
  {iso:'pk',code:'PK',dial:'+92',name:'Pakistan'},
  {iso:'fr',code:'FR',dial:'+33',name:'France'},
  {iso:'de',code:'DE',dial:'+49',name:'Germany'},
  {iso:'it',code:'IT',dial:'+39',name:'Italy'},
  {iso:'es',code:'ES',dial:'+34',name:'Spain'},
  {iso:'nl',code:'NL',dial:'+31',name:'Netherlands'},
  {iso:'ch',code:'CH',dial:'+41',name:'Switzerland'},
  {iso:'se',code:'SE',dial:'+46',name:'Sweden'},
  {iso:'ru',code:'RU',dial:'+7',name:'Russia'},
  {iso:'za',code:'ZA',dial:'+27',name:'South Africa'},
  {iso:'eg',code:'EG',dial:'+20',name:'Egypt'},
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
    setTimeout(function() {
      var search = document.getElementById('country-dd-search');
      if (search) search.focus();
    }, 50);
  }
}

function filterCountries(q) {
  var filtered = COUNTRIES.filter(function(c) {
    return c.name.toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
           c.code.toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
           c.dial.indexOf(q) !== -1;
  });
  renderCountryItems(filtered);
}

function selectCountry(code) {
  var c = COUNTRIES.find(function(x) { return x.code === code; });
  if (!c) return;
  selectedCountry = c;
  var flagEl = document.getElementById('country-dd-flag');
  var codeEl = document.getElementById('country-dd-code');
  var hiddenEl = document.getElementById('country-code');
  var listEl = document.getElementById('country-dd-list');
  var searchEl = document.getElementById('country-dd-search');
  if (flagEl) { flagEl.src = flagUrl(c.iso); flagEl.alt = c.code; }
  if (codeEl) codeEl.textContent = c.dial;
  if (hiddenEl) hiddenEl.value = c.dial;
  if (listEl) listEl.classList.remove('open');
  if (searchEl) searchEl.value = '';
}

document.addEventListener('click', function(e) {
  var dd = document.getElementById('country-dd');
  var list = document.getElementById('country-dd-list');
  if (dd && list && !dd.contains(e.target)) {
    list.classList.remove('open');
  }
});

function sendOTP() {
  var phoneEl = document.getElementById('otp-phone');
  var codeEl  = document.getElementById('country-code');
  if (!phoneEl || !codeEl) return;
  var phone = phoneEl.value.trim();
  var code  = codeEl.value;
  if (!phone || !/^\d{6,15}$/.test(phone)) {
    showErr('otp-phone', 'err-otp-phone');
    return;
  }
  otpPhone     = code + phone;
  otpGenerated = Math.floor(100000 + Math.random() * 900000).toString();

  /* Demo bar — shows generated OTP for testing */
  var demoBar = document.getElementById('otp-demo-bar');
  if (!demoBar) {
    demoBar = document.createElement('div');
    demoBar.id = 'otp-demo-bar';
    demoBar.style.cssText = 'margin-top:10px;padding:10px 14px;background:rgba(232,216,160,0.1);border:0.5px solid rgba(232,216,160,0.3);border-radius:8px;font-size:13px;color:#E8D8A0;';
    demoBar.innerHTML = '<strong>DEMO OTP:</strong> <span id="otp-demo-code"></span>';
    var entryWrap = document.getElementById('otp-entry-wrap');
    if (entryWrap) entryWrap.insertAdjacentElement('beforebegin', demoBar);
  }
  var demoCode = document.getElementById('otp-demo-code');
  if (demoCode) demoCode.textContent = otpGenerated;

  var sendBtn = document.getElementById('btn-send-otp');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sent!'; }

  var entryWrap = document.getElementById('otp-entry-wrap');
  if (entryWrap) entryWrap.style.display = 'block';

  var d1 = document.getElementById('otp-d1');
  if (d1) d1.focus();

  /* Start 30s resend countdown */
  if (otpResendTimer) clearInterval(otpResendTimer);
  var secs = 30;
  var resendEl = document.querySelector('.otp-resend');
  if (resendEl) {
    resendEl.innerHTML = 'Resend in ' + secs + 's · <a onclick="changePhone()">Change number</a>';
    otpResendTimer = setInterval(function() {
      secs--;
      if (secs <= 0) {
        clearInterval(otpResendTimer);
        otpResendTimer = null;
        resendEl.innerHTML = 'Didn\'t receive it? <a onclick="resendOTP()">Resend OTP</a> · <a onclick="changePhone()">Change number</a>';
      } else {
        resendEl.innerHTML = 'Resend in ' + secs + 's · <a onclick="changePhone()">Change number</a>';
      }
    }, 1000);
  }
}

function verifyOTP() {
  var ids = ['otp-d1','otp-d2','otp-d3','otp-d4','otp-d5','otp-d6'];
  var allPresent = ids.every(function(id) { return !!document.getElementById(id); });
  if (!allPresent) return;
  var entered = ids.map(function(id) { return document.getElementById(id).value; }).join('');
  if (entered.length < 6) return;
  if (!otpGenerated) return;

  if (entered === otpGenerated) {
    otpVerified = true;
    var phoneWrap = document.getElementById('otp-phone-wrap');
    var entryWrap = document.getElementById('otp-entry-wrap');
    var verifiedText = document.getElementById('otp-verified-text');
    var verifiedEl = document.getElementById('otp-verified');
    if (phoneWrap) phoneWrap.style.display = 'none';
    if (entryWrap) entryWrap.style.display = 'none';
    if (verifiedText) verifiedText.textContent = otpPhone + ' verified';
    if (verifiedEl) verifiedEl.classList.add('show');
    if (otpResendTimer) { clearInterval(otpResendTimer); otpResendTimer = null; }
    var demoBar = document.getElementById('otp-demo-bar');
    if (demoBar) demoBar.remove();
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
}

function resendOTP() {
  ['otp-d1','otp-d2','otp-d3','otp-d4','otp-d5','otp-d6'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var errEl = document.getElementById('err-otp-code');
  if (errEl) errEl.classList.remove('visible');
  var sendBtn = document.getElementById('btn-send-otp');
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send OTP'; }
  sendOTP();
}

function changePhone() {
  if (otpResendTimer) { clearInterval(otpResendTimer); otpResendTimer = null; }
  otpVerified  = false;
  otpGenerated = '';
  var phoneEl   = document.getElementById('otp-phone');
  var phoneWrap = document.getElementById('otp-phone-wrap');
  var entryWrap = document.getElementById('otp-entry-wrap');
  var errEl     = document.getElementById('err-otp-code');
  var verifiedEl = document.getElementById('otp-verified');
  var sendBtn   = document.getElementById('btn-send-otp');
  var demoBar   = document.getElementById('otp-demo-bar');
  if (phoneEl)   phoneEl.value   = '';
  if (entryWrap) entryWrap.style.display = 'none';
  if (phoneWrap) phoneWrap.style.display = 'block';
  if (sendBtn)   { sendBtn.disabled = false; sendBtn.textContent = 'Send OTP'; }
  if (errEl)     errEl.classList.remove('visible');
  if (verifiedEl) verifiedEl.classList.remove('show');
  if (demoBar)   demoBar.remove();
}

function otpNext(el, nextId) {
  el.value = el.value.replace(/[^0-9]/g, '').charAt(0);
  if (el.value && nextId) {
    var next = document.getElementById(nextId);
    if (next) next.focus();
  }
  var allFilled = ['otp-d1','otp-d2','otp-d3','otp-d4','otp-d5','otp-d6']
    .every(function(id) {
      var el = document.getElementById(id);
      return el && el.value.length === 1;
    });
  if (allFilled) verifyOTP();
}

function otpBack(e, el, prevId) {
  if (e.key === 'Backspace' && !el.value && prevId) {
    var prev = document.getElementById(prevId);
    if (prev) prev.focus();
  }
}

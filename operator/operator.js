var SUPABASE_URL=SKYVAYU_CONFIG.supabaseUrl;var SUPABASE_KEY=SKYVAYU_CONFIG.supabaseKey;

/* ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ XSS protection: escape all user-supplied strings before inserting into innerHTML ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ */
function escapeHtml(str){
  if(str==null)return'';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

var currentUser=null,currentOperator=null,currentQueryId=null,currentClaimId=null;
var _opAuthToken=SUPABASE_KEY;

var aircraftList=[],allOperatorUsers=[],allActiveQueries=[],allMyOperatorQuotes=[],allActiveClaims=[];

var lastCharges={},refreshInterval=null,claimRefreshInterval=null,expandedEmployeeId=null;

function isOwner(){return currentUser&&currentUser.role==='owner';}

function nowIso(){return new Date().toISOString();}

function sbFetch(path,opts){
  opts=opts||{};
  var headers={'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+_opAuthToken};
  if(opts.prefer)headers['Prefer']=opts.prefer;
  return fetch(SUPABASE_URL+'/rest/v1/'+path,{method:opts.method||'GET',headers:headers,body:opts.body?JSON.stringify(opts.body):undefined})
    .then(function(r){
      if(r.status===204||r.headers.get('content-length')==='0')return{ok:r.ok,status:r.status,data:[]};
      return r.json().then(function(d){return{ok:r.ok,status:r.status,data:d};}).catch(function(){return{ok:r.ok,status:r.status,data:[]};});
    })
    .catch(function(e){
      console.error('sbFetch network error:', path, e);
      return{ok:false,status:0,data:[],error:e};
    });
}

/* ============ LOGIN ============ */

async function doLogin(){
  var username=document.getElementById('login-username').value.trim();
  var password=document.getElementById('login-password').value;
  var errEl=document.getElementById('login-error');errEl.classList.remove('show');
  if(!username||!password){errEl.textContent='Please enter username or email and password';errEl.classList.add('show');return;}
  var btn=document.getElementById('login-btn');btn.disabled=true;btn.textContent='Signing in...';
  try{
    /* Ã¢ÂÂÃ¢ÂÂ Secure server-side login via verify_operator_login RPC Ã¢ÂÂÃ¢ÂÂ
     * Password is verified server-side using bcrypt; hash is NEVER sent to the client.
     * The old client-side comparison (password_hash === password) has been removed. */
    var rpcRes=await sbFetch('rpc/verify_operator_login',{method:'POST',body:{p_username:username.toLowerCase(),p_password:password}});
    if(!rpcRes.ok||!rpcRes.data||!rpcRes.data.length){
      errEl.textContent='Invalid username or password';errEl.classList.add('show');return;
    }
    var user=rpcRes.data[0];
    if(!user.is_active){
      errEl.textContent='This account has been deactivated. Please contact your administrator.';
      errEl.classList.add('show');return;
    }
    if(user.role==='employee'&&user.is_approved===false){
      errEl.textContent='Your account is pending approval from SkyVayu. Please wait.';
      errEl.classList.add('show');return;
    }
    var opRes=await sbFetch('operators?id=eq.'+user.operator_id);
    if(!opRes.ok||!opRes.data||!opRes.data.length){
      errEl.textContent='Could not load operator account. Please contact support.';
      errEl.classList.add('show');return;
    }
    var op=opRes.data[0];
    if(op.approval_status==='pending'){
      document.getElementById('page-login').style.display='none';
      document.getElementById('page-pending').style.display='flex';
      return;
    }
    if(op.approval_status==='rejected'){
      errEl.textContent='Your registration was not approved. Please contact SkyVayu.';
      errEl.classList.add('show');return;
    }
    currentUser=user;currentOperator=op;localStorage.setItem('opSession',JSON.stringify({user:user,operator:op}));
    if(window._svSupabase){window._svSupabase.auth.signInWithPassword({email:user.username+'@operator.skyvayu.internal',password:'TemporaryPass#'+user.username+'2024!'}).then(function(authRes){if(!authRes.error&&authRes.data&&authRes.data.session){_opAuthToken=authRes.data.session.access_token;}});}
    /* Fire-and-forget last_login update ÃÂ¢ don't block on it */
    sbFetch('operator_users?id=eq.'+currentUser.id,{method:'PATCH',body:{last_login:nowIso()}}).catch(function(){});
    document.getElementById('page-login').style.display='none';
    document.getElementById('page-dashboard').style.display='';document.getElementById('page-dashboard').classList.add('active');
    var _on=document.getElementById('op-name');if(_on)_on.textContent=currentUser.full_name||currentUser.username;
    var _or=document.getElementById('op-role');if(_or)_or.textContent=currentOperator.company_name;
    var rt=document.getElementById('op-role-tag');
    if(rt){rt.textContent=isOwner()?'Admin':'Employee';rt.className='role-tag '+(isOwner()?'':'employee');}
    applyRoleRestrictions();
    showSection('queries');
    await loadAllData();
    refreshInterval=setInterval(loadAllData,5000);
    claimRefreshInterval=setInterval(updateClaimTimers,1000);
  }catch(e){
    
    errEl.textContent='An error occurred. Please try again.';
    errEl.classList.add('show');
  }finally{
    btn.disabled=false;btn.textContent='Sign in';
  }
}

function doLogout(){
  if(refreshInterval){clearInterval(refreshInterval);refreshInterval=null;}
  if(claimRefreshInterval){clearInterval(claimRefreshInterval);claimRefreshInterval=null;}
  if(currentClaimId)releaseClaim(currentClaimId);
  currentUser=null;currentOperator=null;currentClaimId=null;localStorage.removeItem('opSession');  _opAuthToken=SUPABASE_KEY;
  if(window._svSupabase){window._svSupabase.auth.signOut();}

  document.getElementById('page-dashboard').style.display='none';
  document.getElementById('page-dashboard').classList.remove('active');
  document.getElementById('page-login').style.display='flex';
  document.getElementById('login-username').value='';
  document.getElementById('login-password').value='';
}

function applyRoleRestrictions(){
  var adminSection=document.getElementById('nav-admin-section');
  if(adminSection)adminSection.style.display=isOwner()?'block':'none';
  var addAcBtn=document.getElementById('btn-add-aircraft');
  if(addAcBtn)addAcBtn.style.display=isOwner()?'flex':'none';
  var sharedLabel=document.getElementById('stat-shared-label');
  var confLabel=document.getElementById('stat-confirmed-label');
  if(sharedLabel&&confLabel){
    if(!isOwner()){sharedLabel.textContent='My quotes shared';confLabel.textContent='My confirmed bookings';}
    else{sharedLabel.textContent='Quotes shared';confLabel.textContent='Confirmed bookings';}
  }
}

/* ============ NAV ============ */

function showSection(section){
  ['queries','fleet','roster','employees','revenue','profile'].forEach(function(s){
    var el=document.getElementById('section-'+s);if(el)el.style.display='none';
    var nav=document.querySelector('.nav-item[data-section="'+s+'"]');if(nav)nav.classList.remove('active');
  });
  var sEl=document.getElementById('section-'+section);if(sEl)sEl.style.display='block';
  var navEl=document.querySelector('.nav-item[data-section="'+section+'"]');if(navEl)navEl.classList.add('active');
  if(section==='fleet')loadFleet();
  if(section==='roster')loadRoster();
  if(section==='employees')loadEmployees();
  if(section==='revenue')loadRevenue();
  if(section==='queries')loadAllData();

  if (section === 'profile') { loadProfileCategory(); loadProfileSection(); }
}

function showSubtab(tab){
  ['active','shared','confirmed','expired'].forEach(function(t){
    var el=document.getElementById('list-'+t);if(el)el.style.display='none';
    var nav=document.querySelector('.subtab[data-subtab="'+t+'"]');if(nav)nav.classList.remove('active');
  });
  var el=document.getElementById('list-'+tab);if(el)el.style.display='block';
  var nav=document.querySelector('.subtab[data-subtab="'+tab+'"]');if(nav)nav.classList.add('active');
}

/* ============ HELPERS ============ */

function fmtDate(d){if(!d)return'ÃÂ¢ÃÂÃÂ';var p=d.split('-');if(p.length!==3)return d;return p[2]+'-'+p[1]+'-'+p[0];}
function fmtDateShort(d){if(!d)return'';var parts=d.split('-');if(parts.length!==3)return d;return parts[2]+'-'+parts[1];}
function fmtPrice(n){return'Rs.'+Number(n||0).toLocaleString('en-IN');}
function fmtPriceShort(n){var v=Number(n||0);if(v>=10000000)return'Rs.'+(v/10000000).toFixed(1)+'Cr';if(v>=100000)return'Rs.'+(v/100000).toFixed(1)+'L';if(v>=1000)return'Rs.'+(v/1000).toFixed(0)+'K';return'Rs.'+v;}
function timeRemaining(expiresAt){var diff=new Date(expiresAt)-new Date();if(diff<=0)return'Expired';var mins=Math.floor(diff/60000);var secs=Math.floor((diff%60000)/1000);return mins+'m '+secs+'s';}
function claimRemaining(expiresAt){var diff=new Date(expiresAt)-new Date();if(diff<=0)return null;var mins=Math.floor(diff/60000);return mins+' min left';}
function showToast(msg,type){var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type||'');t.classList.add('show');setTimeout(function(){t.classList.remove('show');},3500);}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function lookupUser(id){for(var i=0;i<allOperatorUsers.length;i++)if(allOperatorUsers[i].id===id)return allOperatorUsers[i];return null;}
function getClaimFor(queryId){for(var i=0;i<allActiveClaims.length;i++)if(allActiveClaims[i].query_id===queryId)return allActiveClaims[i];return null;}

/* ============ DATA LOADING ============ */

// ===== PASSWORD VISIBILITY TOGGLE =====
function togglePasswordVisibility() {
  var input = document.getElementById('login-password');
  var showIcon = document.getElementById('eye-icon-show');
  var hideIcon = document.getElementById('eye-icon-hide');
  if (input.type === 'password') {
    input.type = 'text';
    showIcon.style.display = 'none';
    hideIcon.style.display = 'block';
  } else {
    input.type = 'password';
    showIcon.style.display = 'block';
    hideIcon.style.display = 'none';
  }
}

// ===== FORGOT PASSWORD =====
function showForgotPassword() {
  document.getElementById('forgot-password-modal').style.display = 'flex';
  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-error').style.display = 'none';
  document.getElementById('forgot-success').style.display = 'none';
  document.getElementById('forgot-submit-btn').disabled = false;
  document.getElementById('forgot-submit-btn').textContent = 'Send Reset Link';
  setTimeout(function(){ document.getElementById('forgot-email').focus(); }, 100);
}

function closeForgotPassword() {
  document.getElementById('forgot-password-modal').style.display = 'none';
}

async function doForgotPassword() {
  var email = (document.getElementById('forgot-email').value || '').trim().toLowerCase();
  var errEl = document.getElementById('forgot-error');
  var okEl = document.getElementById('forgot-success');
  var btn = document.getElementById('forgot-submit-btn');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  if (!email) {
    errEl.textContent = 'Please enter your email address.';
    errEl.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    var opUrl = SKYVAYU_CONFIG.supabaseUrl + '/rest/v1/operators?select=id,company_name,email&email=eq.' + encodeURIComponent(email) + '&limit=1';
    var opRes = await fetch(opUrl, {
      headers: {
        'apikey': SKYVAYU_CONFIG.supabaseKey,
        'Authorization': 'Bearer ' + SKYVAYU_CONFIG.supabaseKey
      }
    });
    var ops = await opRes.json();
    if (ops && ops.length > 0) {
      var token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      var expiry = new Date(Date.now() + 3600000).toISOString();
      await fetch(SKYVAYU_CONFIG.supabaseUrl + '/rest/v1/operators?id=eq.' + ops[0].id, {
        method: 'PATCH',
        headers: {
          'apikey': SKYVAYU_CONFIG.supabaseKey,
          'Authorization': 'Bearer ' + SKYVAYU_CONFIG.supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ reset_token: token, reset_token_expiry: expiry })
      });
      await sendEmail('password_reset', { operator_id: ops[0].id, email: ops[0].email, company_name: ops[0].company_name, reset_token: token });
    }
    okEl.style.display = 'block';
    btn.textContent = 'Sent!';
  } catch(e) {
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
}


async function loadAllData(){
  if(!currentOperator)return;
  var opId=currentOperator.id;
  var results=await Promise.all([
    sbFetch('queries?status=eq.open&aircraft_category=in.('+( currentOperator.aircraft_category||'fixed_wing')+')&created_at=gt.'+encodeURIComponent(new Date(Date.now()-60*60*1000).toISOString())+'&order=created_at.desc'),
    sbFetch('quotes?operator_id=eq.'+opId+'&select=*,queries(*)&order=created_at.desc'),
    sbFetch('query_claims?operator_id=eq.'+opId+'&expires_at=gt.'+encodeURIComponent(nowIso())),
    sbFetch('operator_users?operator_id=eq.'+opId+'&order=created_at.asc')
  ]);
  allActiveQueries=results[0].ok?results[0].data:[];
  allMyOperatorQuotes=results[1].ok?results[1].data:[];
  allActiveClaims=results[2].ok?results[2].data:[];
  allOperatorUsers=results[3].ok?results[3].data:[];
  var quotedQueryIds=allMyOperatorQuotes.map(function(q){return q.query_id;});
  var unquoted=allActiveQueries.filter(function(q){return!quotedQueryIds.includes(q.id);});
  var sharedAll=allMyOperatorQuotes.filter(function(q){return q.status==='shared';});
  var confirmedAll=allMyOperatorQuotes.filter(function(q){return q.status==='accepted'||q.status==='confirmed'||q.status==='booked';});
  var shared=isOwner()?sharedAll:sharedAll.filter(function(q){return q.submitted_by===currentUser.id;});
  var confirmed=isOwner()?confirmedAll:confirmedAll.filter(function(q){return q.submitted_by===currentUser.id;});
  var _sa=document.getElementById('stat-active');if(_sa)_sa.textContent=unquoted.length;
  var _sq=document.getElementById('stat-quotes');if(_sq)_sq.textContent=shared.length;
  var _sb=document.getElementById('stat-bookings');if(_sb)_sb.textContent=confirmed.length;
  var _ca=document.getElementById('count-active');if(_ca)_ca.textContent=unquoted.length;
  var _cs=document.getElementById('count-shared');if(_cs)_cs.textContent=shared.length;
  var _cc=document.getElementById('count-confirmed');if(_cc)_cc.textContent=confirmed.length;
  var _qb=document.getElementById('queries-badge');if(_qb)_qb.textContent=allActiveClaims.length;
  var cat=currentOperator.aircraft_category||'fixed_wing';
  sbFetch('queries?status=eq.open&aircraft_category=in.('+cat+')&created_at=lt.'+encodeURIComponent(new Date(Date.now()-60*60*1000).toISOString())+'&order=created_at.desc&limit=100')
    .then(function(res){
      var expiredQueries=res.ok?res.data:[];
      var bookedIds=allMyOperatorQuotes.filter(function(q){return q.status==='accepted'||q.status==='confirmed'||q.status==='booked';}).map(function(q){return q.query_id;});
      // Expired = timer ran out AND not booked (includes both unquoted and quote-shared-but-unaccepted)
      expiredQueries=expiredQueries.filter(function(q){return!bookedIds.includes(q.id);});
      // Also add our shared quotes whose query timer has expired but weren't accepted
      var expiredShared=allMyOperatorQuotes.filter(function(q){
        return q.status==='shared' && q.queries && q.queries.created_at && new Date(q.queries.created_at)<new Date(Date.now()-60*60*1000);
      });
      // Merge: deduplicate by query_id
      var expiredQueryIds=expiredQueries.map(function(q){return q.id;});
      expiredShared.forEach(function(q){
        if(!expiredQueryIds.includes(q.query_id) && q.queries){
          expiredQueries.push(q.queries);
          expiredQueryIds.push(q.query_id);
        }
      });
      // Remove from shared tab too — move expired shared quotes out of shared list
      var nowExpiredQueryIds=expiredQueries.map(function(q){return q.id;});
      var activeShared=shared.filter(function(q){return!nowExpiredQueryIds.includes(q.query_id);});
      var _cs=document.getElementById('count-shared');if(_cs)_cs.textContent=activeShared.length;
      var _qb2=document.getElementById('queries-badge');if(_qb2)_qb2.textContent=unquoted.length+activeShared.length;
      renderSharedList(activeShared);
      var ce=document.getElementById('count-expired');if(ce)ce.textContent=expiredQueries.length;
      renderExpiredList(expiredQueries);
    });
  renderActiveList(unquoted);
  markQueriesViewed(unquoted.map(function(q){return q.id;}));
  // Initial render of shared — may be updated again above once expired are known
  renderSharedList(shared);
  renderConfirmedList(confirmed);
}

/* ============ RENDER LISTS ============ */

function getTimerBar(createdAt) {
  if (!createdAt) return '';
  var totalMs = 60 * 60 * 1000;
  var now = new Date();
  var created = new Date(createdAt);
  var windowEnd = new Date(created.getTime() + totalMs);
  var elapsed = now - created;
  var pct = Math.min(Math.max((elapsed / totalMs) * 100, 0), 100);
  var remaining = windowEnd - now;
  var isUrgent = remaining > 0 && remaining < 10 * 60 * 1000;
  var isExpired = remaining <= 0;
  var barColor = isExpired ? 'var(--red)' : isUrgent ? 'var(--amber)' : 'var(--gold)';
  var mins = remaining > 0 ? Math.floor(remaining / 60000) : 0;
  var secs = remaining > 0 ? Math.floor((remaining % 60000) / 1000) : 0;
  var label = isExpired ? 'Window closed' : mins + 'm ' + String(secs).padStart(2,'0') + 's remaining';
  return '<div class="query-timer-wrap" data-created="' + createdAt + '">'
    + '<div class="query-timer-row">'
    + '<span class="query-timer-label" style="color:' + barColor + ';">' + label + '</span>'
    + '<span class="query-timer-pct" style="color:' + barColor + ';">' + (isExpired ? '100' : Math.round(pct)) + '%</span>'
    + '</div>'
    + '<div class="query-timer-bar"><div class="query-timer-fill" style="width:' + pct + '%;background:' + barColor + ';"></div></div>'
    + '</div>';
}

function renderActiveList(queries){
  var el=document.getElementById('list-active');
  if(!queries.length){el.innerHTML='<div class="empty-state"><div class="empty-title">No active queries</div><div class="empty-sub">New client queries will appear here</div></div>';return;}
  el.innerHTML=queries.map(function(q){
    var r=q.trip_type==='multi'?'Multiple sectors':escapeHtml(q.departure||'-')+'  →  '+escapeHtml(q.destination||'-');
    var isUrgent=(function(){if(!q.flight_date)return false;var flightDt=new Date(q.flight_date+(q.flight_time?'T'+q.flight_time:'T00:00'));return(flightDt-new Date())<=4*60*60*1000&&(flightDt-new Date())>0;})();
    var claim=getClaimFor(q.id);
    var lockedBySomeoneElse=claim&&claim.claimed_by!==currentUser.id;
    var lockedByMe=claim&&claim.claimed_by===currentUser.id;
    var lockInfo='';
    if(lockedBySomeoneElse){
      var rem=claimRemaining(claim.expires_at);
      lockInfo='<div class="query-lock-info" data-query="'+escapeHtml(q.id)+'" data-expires="'+escapeHtml(claim.expires_at)+'">Locked by '+escapeHtml(claim.claimed_by_name||'teammate')+' ÃÂ· '+(rem||'expiring')+'</div>';
    }else if(lockedByMe){
      lockInfo='<div class="query-lock-info" style="color:var(--green-light);" data-query="'+escapeHtml(q.id)+'" data-expires="'+escapeHtml(claim.expires_at)+'">You have this locked ÃÂ· '+(claimRemaining(claim.expires_at)||'expiring')+'</div>';
    }
    var btnTxt=lockedBySomeoneElse?'Locked':'Submit quote';
    var btnDisabled=lockedBySomeoneElse?'disabled':'';
    return '<div class="query-card '+(isUrgent?'query-card-urgent ':'')+(lockedBySomeoneElse?'locked':'')+'">'
      +(isUrgent?'<div class="urgent-tape">URGENT &mdash; Flight within 4 hours</div>':'')
      +'<div class="query-top"><div><div class="query-route">'+r+'</div><div class="query-meta">'+fmtDate(q.flight_date)+(q.flight_time?' at '+escapeHtml(q.flight_time):'')+'</div></div>'
      +(lockedBySomeoneElse?'<span class="badge badge-locked">Locked</span>':isUrgent?'<span class="badge badge-urgent">Urgent</span>':'<span class="badge badge-active">Active</span>')+'</div>'
      +'<div class="query-details"><div class="query-detail"><span>Pax</span>'+escapeHtml(String(q.passengers||'-'))+'</div>'
      +(q.medivac?'<div class="query-detail"><span>Medivac</span>Yes</div>':'')
      +(q.pets?'<div class="query-detail"><span>Pets</span>Yes</div>':'')
      +(q.vip?'<div class="query-detail"><span>VIP</span>Yes</div>':'')
      +(q.infants?'<div class="query-detail"><span>Infants</span>Yes</div>':'')+'</div>'
      +(q.created_at ? getTimerBar(q.created_at) : '')
      +lockInfo
      +'<div class="query-actions"><button class="btn-sm btn-blue" '+btnDisabled+' onclick="openQuoteModal(\''+escapeHtml(q.id)+'\')">'+btnTxt+'</button>'+(claim&&claim.claimed_by===currentUser.id?'<button class="btn-sm btn-red" onclick="declineQuery(\''+escapeHtml(q.id)+'\',\''+escapeHtml(claim.id)+'\')" style="margin-left:6px">Decline</button>':'')+'</div></div>';
  }).join('');
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ View Shared Quote ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
var _viewQuoteData = null;

function viewSharedQuote(quoteId) {
  var q = (window._sharedQuotes || []).find(function(x){ return x.id === quoteId; });
  if(!q) { showToast('Quote not found', 'error'); return; }
  _viewQuoteData = q;
  var query = q.queries || {};
  var route = query.trip_type === 'multi' ? 'Multiple sectors'
    : escapeHtml(query.departure || '-') + '  →  ' + escapeHtml(query.destination || '-');
  var date = fmtDate(query.flight_date) + (query.flight_time ? ' at ' + escapeHtml(query.flight_time) : '');
  var base = Number(q.base_charge || 0);
  var handling = Number(q.handling_fee || 0);
  var crew = Number(q.crew_accommodation || 0);
  var catering = Number(q.catering || 0);
  var subtotal = base + handling + crew + catering;
  var gst = Math.round(subtotal * 0.18);
  var total = subtotal + gst;
  var aircraft = escapeHtml(q.aircraft_type || '') + (q.aircraft_registration ? ' (' + escapeHtml(q.aircraft_registration) + ')' : '');
  document.getElementById('vq-route').textContent = route;
  document.getElementById('vq-date').textContent = date;
  document.getElementById('vq-aircraft').textContent = aircraft;
  document.getElementById('vq-pax').textContent = String(query.passengers || '-');
  document.getElementById('vq-base').textContent = fmtPrice(base);
  document.getElementById('vq-handling').textContent = fmtPrice(handling);
  document.getElementById('vq-crew').textContent = fmtPrice(crew);
  document.getElementById('vq-catering').textContent = fmtPrice(catering);
  document.getElementById('vq-subtotal').textContent = fmtPrice(subtotal);
  document.getElementById('vq-gst').textContent = fmtPrice(gst);
  document.getElementById('vq-total').textContent = fmtPrice(total);
  var notesEl = document.getElementById('vq-notes-row');
  if(q.notes) {
    notesEl.style.display = '';
    document.getElementById('vq-notes').textContent = q.notes;
  } else { notesEl.style.display = 'none'; }
  var byEl = document.getElementById('vq-by-row');
  if(isOwner()) {
    var u = lookupUser(q.submitted_by);
    if(u) { byEl.style.display = ''; document.getElementById('vq-by').textContent = escapeHtml(u.full_name || u.username); }
    else { byEl.style.display = 'none'; }
  } else { byEl.style.display = 'none'; }
  // Show bid status
  fetchBids(query.id || q.query_id).then(function(bids){
    var statusEl = document.getElementById('vq-bid-status');
    var reviseBtn = document.getElementById('btn-revise-quote');
    if (!statusEl || !bids.length) return;
    var lowest = bids[0].price;
    var isWinning = q.price <= lowest;
    var windowOpen = query.created_at && new Date(query.created_at) > new Date(Date.now()-60*60*1000);
    statusEl.textContent = isWinning
      ? 'You have the lowest bid at ' + fmtPrice(q.price) + ' (' + bids.length + ' bid' + (bids.length>1?'s':'')+' total)'
      : 'You are outbid. Current lowest: ' + fmtPrice(lowest);
    statusEl.style.background = isWinning ? 'rgba(59,109,17,0.15)' : 'rgba(226,75,74,0.1)';
    statusEl.style.color = isWinning ? 'var(--green-light)' : 'var(--red)';
    statusEl.style.display = 'block';
    if (reviseBtn && windowOpen) reviseBtn.style.display = '';
  });
  document.getElementById('view-quote-modal').classList.add('open');
}

function closeViewQuoteModal() {
  document.getElementById('view-quote-modal').classList.remove('open');
  _viewQuoteData = null;
}

function renderSharedList(quotes){
  var el=document.getElementById('list-shared');
  if(!quotes.length){var msg=isOwner()?'No quotes shared yet':'You haven\'t shared any quotes yet';el.innerHTML='<div class="empty-state"><div class="empty-title">'+msg+'</div></div>';return;}
  el.innerHTML=quotes.map(function(q){
    var query=q.queries||{};
    var route=query.trip_type==='multi'?'Multiple sectors':escapeHtml(query.departure||'-')+'  →  '+escapeHtml(query.destination||'-');
    var empBadge='';
    if(isOwner()){var u=lookupUser(q.submitted_by);empBadge=u?'<span class="badge badge-by">by '+escapeHtml(u.full_name||u.username)+'</span>':'';}    return '<div class="query-card" style="cursor:pointer;" onclick="viewSharedQuote(\''+q.id+'\')">'+'<div class="query-top"><div><div class="query-route">'+route+empBadge+'</div><div class="query-meta">'+fmtDate(query.flight_date)+(query.flight_time?' at '+escapeHtml(query.flight_time):'')+' ÃÂ· '+escapeHtml(q.aircraft_type||'')+(q.aircraft_registration?' ('+escapeHtml(q.aircraft_registration)+')':'')+'</div></div><span class="badge badge-shared">Shared</span></div><div class="query-details"><div class="query-detail"><span>Pax</span>'+escapeHtml(String(query.passengers||'-'))+'</div><div class="query-detail"><span>Quote</span>'+fmtPrice(q.price)+'</div></div>'+(q.notes?'<div class="query-detail" style="margin-top:8px;"><span>Note</span>'+escapeHtml(q.notes)+'</div>':'')+'</div>';
  }).join('');
  window._sharedQuotes = quotes;
}

function renderConfirmedList(quotes){
  var el=document.getElementById('list-confirmed');
  if(!quotes.length){var msg=isOwner()?'No confirmed bookings yet':'No confirmed bookings for you yet';el.innerHTML='<div class="empty-state"><div class="empty-title">'+msg+'</div></div>';return;}
  el.innerHTML=quotes.map(function(q){
    var query=q.queries||{};
    var route=query.trip_type==='multi'?'Multiple sectors':escapeHtml(query.departure||'-')+'  →  '+escapeHtml(query.destination||'-');
    var empBadge='';
    if(isOwner()){var u=lookupUser(q.submitted_by);empBadge=u?'<span class="badge badge-by">by '+escapeHtml(u.full_name||u.username)+'</span>':'';}    return '<div class="query-card"><div class="query-top"><div><div class="query-route">'+route+empBadge+'</div><div class="query-meta">'+fmtDate(query.flight_date)+(query.flight_time?' at '+escapeHtml(query.flight_time):'')+' ÃÂ· '+escapeHtml(q.aircraft_type||'')+(q.aircraft_registration?' ('+escapeHtml(q.aircraft_registration)+')':'')+'</div></div><span class="badge badge-accepted">Confirmed</span></div><div class="query-details"><div class="query-detail"><span>Pax</span>'+escapeHtml(String(query.passengers||'-'))+'</div><div class="query-detail"><span>Revenue</span>'+fmtPrice(q.price)+'</div></div></div>';
  }).join('');
}

function renderExpiredList(queries){
  var el=document.getElementById('list-expired');
  if(!el)return;
  if(!queries.length){el.innerHTML='<div class="empty-state"><div class="empty-title">No expired queries</div><div class="empty-sub">Queries where the 60-minute window closed with no booking</div></div>';return;}
  el.innerHTML=queries.map(function(q){
    var r=q.trip_type==='multi'?'Multiple sectors':escapeHtml(q.departure||'-')+' to '+escapeHtml(q.destination||'-');
    return '<div class="query-card" style="opacity:0.65;">'
      +'<div class="query-top"><div><div class="query-route">'+r+'</div><div class="query-meta">'+fmtDate(q.flight_date)+(q.flight_time?' at '+escapeHtml(q.flight_time):'')+'</div></div>'
      +'<span class="badge badge-expired">Expired</span></div>'
      +'<div class="query-details"><div class="query-detail"><span>Pax</span>'+escapeHtml(String(q.passengers||'-'))+'</div>'
      +(q.medivac?'<div class="query-detail"><span>Medivac</span>Yes</div>':'')
      +(q.pets?'<div class="query-detail"><span>Pets</span>Yes</div>':'')
      +(q.vip?'<div class="query-detail"><span>VIP</span>Yes</div>':'')
      +(q.infants?'<div class="query-detail"><span>Infants</span>Yes</div>':'')+'</div>'
      +(q.created_at ? getTimerBar(q.created_at) : '')
      +'</div>';
  }).join('');
}

function updateClaimTimers(){
  document.querySelectorAll('.query-timer-wrap').forEach(function(wrap){
    var createdAt=wrap.getAttribute('data-created');if(!createdAt)return;
    var totalMs=60*60*1000;
    var now=new Date();var created=new Date(createdAt);
    var windowEnd=new Date(created.getTime()+totalMs);
    var elapsed=now-created;
    var pct=Math.min(Math.max((elapsed/totalMs)*100,0),100);
    var remaining=windowEnd-now;
    var isUrgent=remaining>0&&remaining<10*60*1000;
    var isExpired=remaining<=0;
    var barColor=isExpired?'var(--red)':isUrgent?'var(--amber)':'var(--gold)';
    var mins=remaining>0?Math.floor(remaining/60000):0;
    var secs=remaining>0?Math.floor((remaining%60000)/1000):0;
    var label=isExpired?'Window closed':mins+'m '+String(secs).padStart(2,'0')+'s remaining';
    var bar=wrap.querySelector('.query-timer-fill');if(bar){bar.style.width=pct+'%';bar.style.background=barColor;}
    var labelEl=wrap.querySelector('.query-timer-label');if(labelEl){labelEl.textContent=label;labelEl.style.color=barColor;}
    var pctEl=wrap.querySelector('.query-timer-pct');if(pctEl){pctEl.textContent=(isExpired?'100':Math.round(pct))+'%';pctEl.style.color=barColor;}
  });
  document.querySelectorAll('.query-lock-info').forEach(function(el){
    var exp=el.getAttribute('data-expires');if(!exp)return;
    var rem=claimRemaining(exp);
    if(!rem){el.remove();return;}
    var prefix=el.textContent.split(' ÃÂ· ')[0];
    el.textContent=prefix+' ÃÂ· '+rem;
  });
}

/* ============ CLAIM / LOCK ============ */

async function tryClaim(queryId){
  var existing=await sbFetch('query_claims?query_id=eq.'+queryId+'&operator_id=eq.'+currentOperator.id+'&expires_at=gt.'+encodeURIComponent(nowIso()));
  if(existing.ok&&existing.data.length){
    var c=existing.data[0];
    if(c.claimed_by===currentUser.id){
      var refresh=await sbFetch('query_claims?id=eq.'+c.id,{method:'PATCH',prefer:'return=representation',body:{expires_at:new Date(Date.now()+20*60*1000).toISOString()}});
      return{ok:true,claim:refresh.data&&refresh.data[0]||c};
    }
    return{ok:false,by:c.claimed_by_name||'another employee',expires:c.expires_at};
  }
  await sbFetch('query_claims?operator_id=eq.'+currentOperator.id+'&query_id=eq.'+queryId+'&expires_at=lt.'+encodeURIComponent(nowIso()),{method:'DELETE'});
  var ins=await sbFetch('query_claims',{method:'POST',prefer:'return=representation',body:{
    query_id:queryId,operator_id:currentOperator.id,claimed_by:currentUser.id,
    claimed_by_name:currentUser.full_name||currentUser.username,
    expires_at:new Date(Date.now()+20*60*1000).toISOString()
  }});
  if(!ins.ok){
    if(ins.status===409){
      var re=await sbFetch('query_claims?query_id=eq.'+queryId+'&operator_id=eq.'+currentOperator.id);
      var ec=re.data&&re.data[0];
      if(ec&&ec.claimed_by===currentUser.id)return{ok:true,claim:ec};
      if(ec)return{ok:false,by:ec.claimed_by_name||'teammate',expires:ec.expires_at};
    }
    return{ok:false,by:'someone',expires:null};
  }
  return{ok:true,claim:ins.data[0]};
}

async function releaseClaim(claimId){
  if(!claimId)return;
  await sbFetch('query_claims?id=eq.'+claimId,{method:'DELETE'});
}

async function declineQuery(queryId, claimId) {
  var reason = prompt('Reason for declining this query (optional):') || '';
  // Update query status to declined with reason
  await sbFetch('queries?id=eq.' + queryId, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { status: 'declined', decline_reason: reason }
  });
  // Release the claim
  if (claimId) await sbFetch('query_claims?id=eq.' + claimId, { method: 'DELETE' });
  showToast('Query declined.', 'info');
  await loadAllData();
}

/* ============ AIRCRAFT AVAILABILITY ============ */

function getBusyAircraftMap(){
  var map={};
  allMyOperatorQuotes.forEach(function(q){
    if(q.status!=='accepted'&&q.status!=='confirmed'&&q.status!=='booked')return;
    if(!q.aircraft_id)return;
    var query=q.queries||{};
    var dates=[];
    if(query.flight_date)dates.push(query.flight_date);
    if(query.return_date)dates.push(query.return_date);
    dates.forEach(function(d){
      if(!map[q.aircraft_id])map[q.aircraft_id]={};
      var u=lookupUser(q.submitted_by);
      map[q.aircraft_id][d]={by:u?(u.full_name||u.username):'operator',route:(query.departure||'-')+' → '+(query.destination||'-')};
    });
  });
  return map;
}

/* ============ QUOTE MODAL ============ */

// ============ REVERSE AUCTION BIDDING ============

async function fetchBids(queryId) {
  var res = await sbFetch('quotes?query_id=eq.' + queryId + '&status=eq.shared&select=price,aircraft_type,aircraft_registration,operator_id&order=price.asc');
  return res.ok ? res.data : [];
}

function renderBidTable(bids, myOperatorId) {
  var container = document.getElementById('live-bids-table');
  var beatMsg = document.getElementById('bid-beat-msg');
  if (!container) return;
  if (!bids.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0;">No bids yet — be the first to quote.</div>';
    if (beatMsg) beatMsg.style.display = 'none';
    return;
  }
  var myBid = bids.find(function(b){ return b.operator_id === myOperatorId; });
  var lowest = bids[0].price;
  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
  html += '<tr style="color:var(--text-tertiary);font-family:var(--font-mono);font-size:10px;letter-spacing:.5px;text-transform:uppercase;"><th style="text-align:left;padding:4px 0;">Rank</th><th style="text-align:left;padding:4px 8px;">Aircraft</th><th style="text-align:right;padding:4px 0;">Quote</th></tr>';
  bids.forEach(function(b, i) {
    var isMe = b.operator_id === myOperatorId;
    var isLowest = i === 0;
    var color = isLowest ? 'var(--green-light)' : isMe ? 'var(--gold)' : 'var(--text-secondary)';
    var rank = '#' + (i + 1);
    if (isLowest) rank = '#1 Lowest';
    html += '<tr style="border-top:0.5px solid var(--border);">';
    html += '<td style="padding:6px 0;color:' + color + ';font-family:var(--font-mono);font-size:11px;">' + rank + (isMe ? ' (you)' : '') + '</td>';
    html += '<td style="padding:6px 8px;color:' + color + ';">' + escapeHtml(b.aircraft_type || '') + (b.aircraft_registration ? ' <span style="color:var(--text-tertiary);">(' + escapeHtml(b.aircraft_registration) + ')</span>' : '') + '</td>';
    html += '<td style="padding:6px 0;text-align:right;color:' + color + ';font-weight:' + (isLowest ? '600' : '400') + ';">' + fmtPrice(b.price) + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  container.innerHTML = html;
  if (beatMsg) {
    if (myBid && myBid.price > lowest) {
      beatMsg.textContent = 'You are outbid. Beat the lowest of ' + fmtPrice(lowest) + ' to win.';
      beatMsg.style.display = 'block';
      beatMsg.style.color = 'var(--red)';
    } else if (!myBid && bids.length > 0) {
      beatMsg.textContent = 'Beat the lowest bid of ' + fmtPrice(lowest) + ' to lead.';
      beatMsg.style.display = 'block';
      beatMsg.style.color = 'var(--amber)';
    } else if (myBid && myBid.price === lowest) {
      beatMsg.textContent = 'You have the lowest bid — you are winning.';
      beatMsg.style.display = 'block';
      beatMsg.style.color = 'var(--green-light)';
    } else {
      beatMsg.style.display = 'none';
    }
  }
}

async function reviseQuote(target) {
  var q = target || _viewQuoteData || window._reviseTarget;
  if (!q) return;
  window._reviseTarget = null;
  closeViewQuoteModal();
  await openQuoteModal(q.query_id, q.id);
}

var _revisingQuoteId = null;
async function openQuoteModal(queryId, existingQuoteId){
  if(isAopExpired()){
    showToast('Your AOP has expired. Renew it before submitting quotes.','error');
    return;
  }
  var claimRes=await tryClaim(queryId);
  if(!claimRes.ok){
    showToast('This query is locked by '+claimRes.by+'. Please wait.','error');
    loadAllData();
    return;
  }
  currentQueryId=queryId;
  _revisingQuoteId = existingQuoteId || null;
  currentClaimId=claimRes.claim&&claimRes.claim.id?claimRes.claim.id:null;
  sendEmail('new_query_assigned',{query_id:queryId,operator_id:currentOperator.id});
  var res=await sbFetch('queries?id=eq.'+queryId);
  var query=res.data&&res.data[0];
  if(!query){
    if(currentClaimId)releaseClaim(currentClaimId);
    currentClaimId=null;currentQueryId=null;
    showToast('Query not found. Please refresh.','error');
    return;
  }
  var route=query.trip_type==='multi'?'Multiple sectors':escapeHtml(query.departure||'ÃÂ¢ÃÂÃÂ')+'  →  '+escapeHtml(query.destination||'ÃÂ¢ÃÂÃÂ');
  document.getElementById('quote-query-info').innerHTML='<strong style="color:var(--text);">'+route+'</strong><br>'+fmtDate(query.flight_date)+(query.flight_time?' at '+escapeHtml(query.flight_time):'')+' &nbsp;|&nbsp; '+escapeHtml(String(query.passengers))+' pax';
  var busyMap=getBusyAircraftMap();
  var expiredAcIds=getExpiredAircraftIds();
  var flightDate=query.flight_date;
  var returnDate=query.return_date;
  var sel=document.getElementById('quote-aircraft');
  var anyConflict=false;
  var approvedAircraft=aircraftList.filter(function(a){return a.doc_status==='approved';});
  sel.innerHTML='<option value="">Choose aircraft...</option>'+approvedAircraft.map(function(a){
    var conflict=null;
    if(busyMap[a.id]){
      if(flightDate&&busyMap[a.id][flightDate])conflict=flightDate;
      else if(returnDate&&busyMap[a.id][returnDate])conflict=returnDate;
    }
    var docExpired=expiredAcIds.indexOf(a.id)!==-1;
    if(conflict){anyConflict=true;return'<option value="'+a.id+'" data-type="'+a.aircraft_type+'" data-reg="'+a.registration+'" disabled>'+a.aircraft_type+'  |  '+a.registration+'  ÃÂ¢ÃÂÃÂ  Booked on '+fmtDate(conflict)+'</option>';}
    if(docExpired){anyConflict=true;return'<option value="'+a.id+'" data-type="'+a.aircraft_type+'" data-reg="'+a.registration+'" disabled>'+a.aircraft_type+'  |  '+a.registration+'  ÃÂ¢ÃÂÃÂ  Documents expired</option>';}
    return'<option value="'+a.id+'" data-type="'+a.aircraft_type+'" data-reg="'+a.registration+'">'+a.aircraft_type+'  |  '+a.registration+'</option>';
  }).join('');
  document.getElementById('quote-aircraft-help').textContent=anyConflict?'Some aircraft unavailable ÃÂ¢ÃÂÃÂ booked or documents expired.':'';
  ['q-base','q-handling','q-crew','q-catering','q-notes'].forEach(function(id){document.getElementById(id).value='';});
  calcQuote();
  // Load live bids for reverse auction display
  var titleEl = document.getElementById('quote-modal-title');
  if (titleEl) titleEl.textContent = 'Submit Quote';
  fetchBids(queryId).then(function(bids) { renderBidTable(bids, currentOperator.id); });
  document.getElementById('quote-modal').classList.add('open');
}

function closeQuoteModal(){
  if(currentClaimId)releaseClaim(currentClaimId);
  currentClaimId=null;currentQueryId=null;
  document.getElementById('quote-modal').classList.remove('open');
  loadAllData();
}

function onAircraftChange(){
  var id=document.getElementById('quote-aircraft').value;if(!id||!lastCharges[id])return;
  var l=lastCharges[id];
  document.getElementById('q-base').value=l.base||'';
  document.getElementById('q-handling').value=l.handling||'';
  document.getElementById('q-crew').value=l.crew||'';
  document.getElementById('q-catering').value=l.catering||'';
  calcQuote();
}

function calcQuote(){
  var b=parseFloat(document.getElementById('q-base').value)||0;
  var h=parseFloat(document.getElementById('q-handling').value)||0;
  var c=parseFloat(document.getElementById('q-crew').value)||0;
  var ca=parseFloat(document.getElementById('q-catering').value)||0;
  var s=b+h+c+ca;var g=Math.round(s*0.18);var t=s+g;
  document.getElementById('q-subtotal').textContent=fmtPrice(s);
  document.getElementById('q-gst').textContent=fmtPrice(g);
  document.getElementById('q-total').textContent=fmtPrice(t);
}

async function submitQuote(){
  var aircraftId=document.getElementById('quote-aircraft').value;
  var b=parseFloat(document.getElementById('q-base').value)||0;
  var h=parseFloat(document.getElementById('q-handling').value)||0;
  var c=parseFloat(document.getElementById('q-crew').value)||0;
  var ca=parseFloat(document.getElementById('q-catering').value)||0;
  var notes=document.getElementById('q-notes').value.trim();
  if(!aircraftId){showToast('Please select an aircraft','error');return;}
  if(!b){showToast('Please enter at least a base charge','error');return;}
  var btn=document.getElementById('btn-submit-quote');btn.disabled=true;btn.textContent='Sharing...';
  var s=b+h+c+ca;var g=Math.round(s*0.18);var t=s+g;
  var sel=document.getElementById('quote-aircraft');var opt=sel.options[sel.selectedIndex];
  var at=opt.dataset.type;var ar=opt.dataset.reg;
  var qRes;
  if (_revisingQuoteId) {
    qRes=await sbFetch('quotes?id=eq.'+_revisingQuoteId,{method:'PATCH',prefer:'return=representation',body:{
      aircraft_id:aircraftId,aircraft_type:at,aircraft_registration:ar,
      price:t,notes:notes
    }});
  } else {
    qRes=await sbFetch('quotes',{method:'POST',prefer:'return=representation',body:{
      query_id:currentQueryId,operator_id:currentOperator.id,operator_name:currentOperator.company_name,
      aircraft_id:aircraftId,aircraft_type:at,aircraft_registration:ar,
      price:t,notes:notes,status:'shared',submitted_by:currentUser.id
    }});
  }
  if(!qRes.ok){
    if(qRes.status===409){showToast('Your team already submitted a quote for this query.','error');}
    else{showToast('Failed to submit quote. Please try again.','error');}
    btn.disabled=false;btn.textContent='Share quote with client';
    if(currentClaimId)releaseClaim(currentClaimId);
    currentClaimId=null;
    closeModal('quote-modal');
    loadAllData();
    return;
  }
  if(!qRes.data||!qRes.data[0]){
    showToast('Quote saved but could not retrieve ID. Please refresh.','error');
    btn.disabled=false;btn.textContent='Share quote with client';
    closeModal('quote-modal');
    loadAllData();
    return;
  }
  var qId=qRes.data[0].id;
  await sbFetch('quote_items',{method:'POST',body:{quote_id:qId,base_charge:b,handling_fee:h,crew_accommodation:c,catering:ca,gst_amount:g,total:t}});
  lastCharges[aircraftId]={base:b,handling:h,crew:c,catering:ca};
  if(currentClaimId)releaseClaim(currentClaimId);
  currentClaimId=null;
  document.getElementById('quote-modal').classList.remove('open');
  btn.disabled=false;btn.textContent='Share quote with client';
  sendEmail('quote_submitted',{quote_id:qId});
  showToast('Quote shared with client','success');
  await loadAllData();
  showSubtab('shared');
}

/* ============ DOCUMENT NOTIFICATIONS + BLOCKING ============ */

var acDocFiles = {};

function daysUntil(dateStr){
  if(!dateStr) return null;
  var diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000*60*60*24));
}

function checkDocumentStatus(){
  if(!currentOperator) return;
  var notifications = [];
  var aopExpired = false;
  var aopDays = daysUntil(currentOperator.aop_expiry_date);
  if(aopDays !== null){
    if(aopDays <= 0){
      aopExpired = true;
    } else if(aopDays <= 30){
      notifications.push({
        type:'warn',
        msg:'Your Air Operator\'s Permit expires in '+aopDays+' day'+(aopDays===1?'':'s')+'.',
        btn:'Upload updated document',
        onclick:'openAopRenewModal()'
      });
      sendEmail('doc_expiry_reminder',{operator_id:currentOperator.id,doc_name:'AOP Permit',expiry_date:String(currentOperator.aop_expiry_date)});
    }
  }
  aircraftList.forEach(function(ac){
    var docDefs = [
      {name:'C of R',    expKey:'cor_expiry',       urlKey:'cor_url',       nameKey:'cor_name',       docKey:'cor'},
      {name:'C of A',    expKey:'coa_expiry',       urlKey:'coa_url',       nameKey:'coa_name',       docKey:'coa'},
      {name:'ARC',       expKey:'arc_expiry',       urlKey:'arc_url',       nameKey:'arc_name',       docKey:'arc'},
      {name:'Insurance', expKey:'insurance_expiry', urlKey:'insurance_url', nameKey:'insurance_name', docKey:'ins'}
    ];
    docDefs.forEach(function(d){
      var days = daysUntil(ac[d.expKey]);
      if(days === null) return;
      if(days <= 0){
        notifications.push({
          type:'error',
          msg:ac.registration+' ÃÂ¢ÃÂÃÂ '+d.name+' has expired. This aircraft is unavailable until renewed.',
          btn:'Upload updated document',
          onclick:'openDocRenewModal(\''+ac.id+'\',\''+d.docKey+'\',\''+d.name+'\',\''+d.expKey+'\',\''+d.urlKey+'\',\''+d.nameKey+'\')'
        });
      } else if(days <= 30){
        notifications.push({
          type:'warn',
          msg:ac.registration+' ÃÂ¢ÃÂÃÂ '+d.name+' expires in '+days+' day'+(days===1?'':'s')+'.',
          btn:'Upload updated document',
          onclick:'openDocRenewModal(\''+ac.id+'\',\''+d.docKey+'\',\''+d.name+'\',\''+d.expKey+'\',\''+d.urlKey+'\',\''+d.nameKey+'\')'
        });
        sendEmail('doc_expiry_reminder',{operator_id:currentOperator.id,doc_name:d.name,expiry_date:String(ac[d.expKey])});
      }
    });
  });
  var bar = document.getElementById('doc-notification-bar');
  if(notifications.length){
    bar.style.display = 'block';
    bar.innerHTML = notifications.map(function(n){
      var bg = n.type==='error' ? '#fef2f2' : '#fffbeb';
      var col = n.type==='error' ? 'var(--red)' : 'var(--amber)';
      var bdr = n.type==='error' ? 'rgba(192,57,43,0.25)' : 'rgba(196,134,10,0.3)';
      var btnBg = n.type==='error' ? 'rgba(192,57,43,0.1)' : 'rgba(196,134,10,0.12)';
      return '<div style="background:'+bg+';border-bottom:0.5px solid '+bdr+';padding:10px 28px;font-size:12px;color:'+col+';display:flex;align-items:center;gap:12px;">'
        +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        +'<span style="flex:1;">'+n.msg+'</span>'
        +(n.btn?'<button onclick="'+n.onclick+'" style="height:26px;padding:0 12px;background:'+btnBg+';border:0.5px solid '+bdr+';border-radius:6px;font-size:11px;font-weight:500;color:'+col+';cursor:pointer;white-space:nowrap;font-family:var(--font);">'+n.btn+'</button>':'')
        +'</div>';
    }).join('');
  } else {
    bar.style.display = 'none';
    bar.innerHTML = '';
  }
  var expiredBanner = document.getElementById('aop-expired-banner');
  if(aopExpired){
    expiredBanner.style.display = 'flex';
    document.getElementById('aop-expired-msg').textContent = 'Your Air Operator\'s Permit has expired. You cannot submit quotes until you upload a renewed AOP.';
    document.getElementById('aop-renew-btn').style.display = 'inline-flex';
  } else {
    expiredBanner.style.display = 'none';
    document.getElementById('aop-renew-btn').style.display = 'none';
  }
  return {aopExpired: aopExpired};
}

function getExpiredAircraftIds(){
  var expired = [];
  aircraftList.forEach(function(ac){
    var docs = ['cor_expiry','coa_expiry','arc_expiry','insurance_expiry'];
    for(var i=0;i<docs.length;i++){
      if(ac[docs[i]] && daysUntil(ac[docs[i]]) <= 0){
        expired.push(ac.id);
        break;
      }
    }
  });
  return expired;
}

function isAopExpired(){
  if(!currentOperator || !currentOperator.aop_expiry_date) return false;
  return daysUntil(currentOperator.aop_expiry_date) <= 0;
}

/* ============ FLEET ============ */

async function loadFleet(){
  var res = await sbFetch('aircraft?operator_id=eq.'+currentOperator.id+'&order=created_at.asc');
  aircraftList = res.ok ? res.data : [];
  var grid = document.getElementById('aircraft-grid');
  var active = aircraftList.filter(function(a){return a.is_active && a.doc_status==='approved';});
  var pending = aircraftList.filter(function(a){return a.doc_status==='pending';});
  var rejected = aircraftList.filter(function(a){return a.doc_status==='rejected';});
  var html = '';
  if(active.length){
    html += active.map(function(a){
      var docDefs = [
        {name:'C of R',    expKey:'cor_expiry',       docKey:'cor', urlKey:'cor_url',       nameKey:'cor_name'},
        {name:'C of A',    expKey:'coa_expiry',       docKey:'coa', urlKey:'coa_url',       nameKey:'coa_name'},
        {name:'ARC',       expKey:'arc_expiry',       docKey:'arc', urlKey:'arc_url',       nameKey:'arc_name'},
        {name:'Insurance', expKey:'insurance_expiry', docKey:'ins', urlKey:'insurance_url', nameKey:'insurance_name'}
      ];
      var removeBtn = isOwner() ? '<button class="aircraft-remove" onclick="removeAircraft(\''+a.id+'\')">&times;</button>' : '';
      var docStatusHtml = '';
      docDefs.forEach(function(d){
        var days = daysUntil(a[d.expKey]);
        if(days === null) return;
        var col = days <= 0 ? 'var(--red)' : 'var(--amber)';
        var label = days <= 0 ? 'ÃÂ¢ÃÂÃÂ  Expired' : ('ÃÂ¢ÃÂÃÂ  '+days+'d left');
        docStatusHtml += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px;">'
          +'<span style="font-size:10px;color:'+col+';">'+d.name+' ÃÂ¢ÃÂÃÂ '+label+'</span>'
          +'<button onclick="openDocRenewModal(\''+a.id+'\',\''+d.docKey+'\',\''+d.name+'\',\''+d.expKey+'\',\''+d.urlKey+'\',\''+d.nameKey+'\') " '
          +'style="height:22px;padding:0 8px;background:transparent;border:0.5px solid '+col+';border-radius:4px;font-size:10px;color:'+col+';cursor:pointer;font-family:var(--font);white-space:nowrap;">'
          +'Upload updated document</button></div>';
      });
      return '<div class="aircraft-card">'+removeBtn
        +'<div class="aircraft-type">'+escapeHtml(a.aircraft_type)+'</div>'
        +'<div class="aircraft-reg">'+escapeHtml(a.registration)+'</div>'
        +(a.seats?'<div class="aircraft-seats">'+escapeHtml(String(a.seats))+' seats</div>':'')
        +docStatusHtml+'</div>';
    }).join('');
  }
  if(pending.length){
    html += pending.map(function(a){
      return '<div class="aircraft-card" style="opacity:.65;border-style:dashed;"><div style="position:absolute;top:8px;right:8px;font-size:9px;background:rgba(196,134,10,0.15);color:var(--gold);padding:2px 6px;border-radius:3px;text-transform:uppercase;letter-spacing:.05em;">Under review</div><div class="aircraft-type">'+escapeHtml(a.aircraft_type)+'</div><div class="aircraft-reg">'+escapeHtml(a.registration)+'</div>'+(a.seats?'<div class="aircraft-seats">'+escapeHtml(String(a.seats))+' seats</div>':'')+'<div style="font-size:11px;color:var(--text-tertiary);margin-top:6px;">Documents submitted ÃÂ¢ÃÂÃÂ awaiting SkyVayu approval</div></div>';
    }).join('');
  }
  if(rejected.length){
    html += rejected.map(function(a){
      return '<div class="aircraft-card" style="border-color:rgba(192,57,43,0.3);"><div class="aircraft-type">'+escapeHtml(a.aircraft_type)+'</div><div class="aircraft-reg">'+escapeHtml(a.registration)+'</div><div style="font-size:11px;color:var(--red);margin-top:6px;">Documents rejected'+(a.doc_rejection_reason?' ÃÂ¢ÃÂÃÂ '+escapeHtml(a.doc_rejection_reason):'')+'</div><button class="btn-sm btn-outline-sm" style="margin-top:8px;font-size:11px;height:28px;" onclick="resubmitAircraft(\''+escapeHtml(a.id)+'\')">Re-upload documents</button></div>';
    }).join('');
  }
  if(!html){
    grid.innerHTML = '<div style="grid-column:span 2;"><div class="empty-state"><div class="empty-title">No aircraft added</div><div class="empty-sub">'+(isOwner()?'Add your fleet to start submitting quotes':'Ask your admin to add aircraft')+'</div></div></div>';
  } else {
    grid.innerHTML = html;
  }
  checkDocumentStatus();
}

function onAcDocSelected(input, key){
  var file = input.files[0];
  if(!file) return;
  if(file.size > 10*1024*1024){alert('Max 10MB');input.value='';return;}
  acDocFiles[key] = file;
  var nameEl = document.getElementById(key+'-filename');
  if(nameEl){ nameEl.textContent = 'ÃÂ¢ÃÂÃÂ '+file.name; nameEl.style.color='var(--gold)'; }
  var areaEl = document.getElementById(key+'-upload-area');
  if(areaEl) areaEl.style.borderColor = 'var(--gold)';
}

function openAircraftModal(){
  acDocFiles = {};
  ['cor','coa','arc','ins'].forEach(function(k){
    var fn = document.getElementById(k+'-filename');
    if(fn){fn.textContent='Upload PDF/JPG/PNG';fn.style.color='';}
    var area = document.getElementById(k+'-upload-area');
    if(area) area.style.borderColor='';
    var fi = document.getElementById(k+'-file');
    if(fi) fi.value='';
    var exp = document.getElementById(k+'-expiry');
    if(exp) exp.value='';
  });
  ['ac-type','ac-reg','ac-seats'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  var errEl = document.getElementById('ac-save-error');
  if(errEl){errEl.style.display='none';errEl.textContent='';}
  document.getElementById('aircraft-modal').classList.add('open');
}

async function uploadAcDoc(operatorId, acId, key, file){
  var ext = file.name.split('.').pop();
  var path = 'aircraft/'+operatorId+'/'+acId+'/'+key+'-'+Date.now()+'.'+ext;
  var res = await fetch(SUPABASE_URL+'/storage/v1/object/operator-documents/'+path,{
    method:'POST',
    headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+_opAuthToken,'Content-Type':file.type,'x-upsert':'true'},
    body: file
  });
  if(!res.ok) return null;
  return {url: SUPABASE_URL+'/storage/v1/object/operator-documents/'+path, name: file.name};
}

async function saveAircraft(){
  var type = document.getElementById('ac-type').value.trim();
  var reg  = document.getElementById('ac-reg').value.trim();
  var seats= parseInt(document.getElementById('ac-seats').value)||null;
  const amenities = {wifi:document.getElementById('am-wifi')?.checked||false,oven:document.getElementById('am-oven')?.checked||false,microwave:document.getElementById('am-microwave')?.checked||false,coffee:document.getElementById('am-coffee')?.checked||false,flatbed:document.getElementById('am-flatbed')?.checked||false,lavatory:document.getElementById('am-lavatory')?.checked||false,satphone:document.getElementById('am-satphone')?.checked||false,entertainment:document.getElementById('am-entertainment')?.checked||false,nonsmoking:document.getElementById('am-nonsmoking')?.checked||false};
  var errEl = document.getElementById('ac-save-error');
  errEl.style.display='none';
  if(!type||!reg){errEl.textContent='Please enter aircraft type and registration.';errEl.style.display='block';return;}
  var docKeys = ['cor','coa','arc','ins'];
  var missing = docKeys.filter(function(k){return !acDocFiles[k];});
  if(missing.length){
    var names = {'cor':'Certificate of Registration','coa':'Certificate of Airworthiness','arc':'Airworthiness Review Certificate','ins':'Insurance Certificate'};
    errEl.textContent='Please upload: '+missing.map(function(k){return names[k];}).join(', ');
    errEl.style.display='block';return;
  }
  var missingExpiry = docKeys.filter(function(k){
    return !document.getElementById(k+'-expiry').value;
  });
  if(missingExpiry.length){errEl.textContent='Please enter expiry dates for all documents.';errEl.style.display='block';return;}
  var btn = document.getElementById('btn-save-aircraft');
  btn.disabled=true;btn.textContent='Uploading...';
  var acRes = await sbFetch('aircraft',{method:'POST',prefer:'return=representation',body:{
    operator_id:currentOperator.id, aircraft_type:type, registration:reg, seats:seats,amenities:amenities,
    is_active:false, doc_status:'pending'
  }});
  if(!acRes.ok||!acRes.data||!acRes.data.length||!acRes.data[0]){
    errEl.textContent='Failed to save aircraft. Try again.';errEl.style.display='block';
    btn.disabled=false;btn.textContent='Submit for review';return;
  }
  var acId = acRes.data[0].id;
  if(!acId){errEl.textContent='Failed to get aircraft ID. Try again.';errEl.style.display='block';btn.disabled=false;btn.textContent='Submit for review';return;}
  var uploads = {};
  for(var i=0;i<docKeys.length;i++){
    var k = docKeys[i];
    btn.textContent='Uploading '+k.toUpperCase()+'...';
    var result = await uploadAcDoc(currentOperator.id, acId, k, acDocFiles[k]);
    if(!result){
      errEl.textContent='Upload failed for '+k+'. Try again.';errEl.style.display='block';
      btn.disabled=false;btn.textContent='Submit for review';return;
    }
    uploads[k] = result;
  }
  await sbFetch('aircraft?id=eq.'+acId,{method:'PATCH',body:{
    cor_url:   uploads.cor.url, cor_name:  uploads.cor.name,  cor_expiry:  document.getElementById('cor-expiry').value,
    coa_url:   uploads.coa.url, coa_name:  uploads.coa.name,  coa_expiry:  document.getElementById('coa-expiry').value,
    arc_url:   uploads.arc.url, arc_name:  uploads.arc.name,  arc_expiry:  document.getElementById('arc-expiry').value,
    insurance_url:  uploads.ins.url, insurance_name: uploads.ins.name, insurance_expiry: document.getElementById('ins-expiry').value
  }});
  btn.disabled=false;btn.textContent='Submit for review';
  closeModal('aircraft-modal');
  acDocFiles={};
  showToast('Aircraft submitted for review','success');
  loadFleet();
}

async function removeAircraft(id){
  if(!confirm('Remove this aircraft?')) return;
  await sbFetch('aircraft?id=eq.'+id,{method:'PATCH',body:{is_active:false}});
  loadFleet();showToast('Aircraft removed','success');
}

function resubmitAircraft(id){
  var ac = aircraftList.find(function(a){return a.id===id;});
  if(!ac) return;
  var docDefs = [
    {name:'C of R',    expKey:'cor_expiry',       docKey:'cor', urlKey:'cor_url',       nameKey:'cor_name'},
    {name:'C of A',    expKey:'coa_expiry',       docKey:'coa', urlKey:'coa_url',       nameKey:'coa_name'},
    {name:'ARC',       expKey:'arc_expiry',       docKey:'arc', urlKey:'arc_url',       nameKey:'arc_name'},
    {name:'Insurance', expKey:'insurance_expiry', docKey:'ins', urlKey:'insurance_url', nameKey:'insurance_name'}
  ];
  var first = docDefs[0];
  openDocRenewModal(id, first.docKey, first.name, first.expKey, first.urlKey, first.nameKey);
}

/* ============ AOP RENEW MODAL ============ */

var selectedAopRenewFile = null;

function openAopRenewModal(){
  selectedAopRenewFile = null;
  document.getElementById('aop-renew-file-input').value = '';
  document.getElementById('aop-renew-filename').textContent = 'Upload PDF/JPG/PNG';
  document.getElementById('aop-renew-filename').style.color = '';
  document.getElementById('aop-renew-expiry').value = '';
  document.getElementById('aop-renew-error').style.display = 'none';
  document.getElementById('aop-renew-modal').classList.add('open');
}

function onAopRenewFileSelected(input){
  var file = input.files[0];
  if(!file) return;
  if(file.size > 10*1024*1024){alert('Max 10MB');input.value='';return;}
  selectedAopRenewFile = file;
  document.getElementById('aop-renew-filename').textContent = 'ÃÂ¢ÃÂÃÂ '+file.name;
  document.getElementById('aop-renew-filename').style.color = 'var(--gold)';
  document.getElementById('aop-renew-upload-area').style.borderColor = 'var(--gold)';
}

async function submitAopRenewal(){
  var expiry = document.getElementById('aop-renew-expiry').value;
  var errEl = document.getElementById('aop-renew-error');
  errEl.style.display = 'none';
  if(!selectedAopRenewFile){errEl.textContent='Please upload the renewed AOP document.';errEl.style.display='block';return;}
  if(!expiry){errEl.textContent='Please enter the new expiry date.';errEl.style.display='block';return;}
  if(currentOperator.aop_expiry_date && expiry <= currentOperator.aop_expiry_date){
    errEl.textContent='New expiry date must be later than the current expiry ('+fmtDate(currentOperator.aop_expiry_date)+')';
    errEl.style.display='block';return;
  }
  var btn = document.getElementById('btn-submit-aop-renew');
  btn.disabled=true;btn.textContent='Uploading...';
  var uploadResult = await uploadAopDocument(currentOperator.id, selectedAopRenewFile);
  if(!uploadResult){
    errEl.textContent='Upload failed. Please try again.';errEl.style.display='block';
    btn.disabled=false;btn.textContent='Submit for approval';return;
  }
  var docUrl = SUPABASE_URL+'/storage/v1/object/operator-documents/'+uploadResult.path;
  var res = await sbFetch('operators?id=eq.'+currentOperator.id,{method:'PATCH',body:{
    aop_document_url: docUrl,
    aop_document_name: uploadResult.name,
    aop_expiry_date: expiry,
    approval_status: 'pending'
  }});
  if(!res.ok){
    errEl.textContent='Failed to save. Please try again.';errEl.style.display='block';
    btn.disabled=false;btn.textContent='Submit for approval';return;
  }
  currentOperator.aop_expiry_date = expiry;
  currentOperator.aop_document_url = docUrl;
  currentOperator.approval_status = 'pending';
  btn.disabled=false;btn.textContent='Submit for approval';
  closeModal('aop-renew-modal');
  selectedAopRenewFile = null;
  showToast('AOP submitted for SkyVayu approval','success');
  checkDocumentStatus();
}

/* ============ AIRCRAFT DOC RENEW MODAL ============ */

var docRenewState = {};
var selectedDocRenewFile = null;

function openDocRenewModal(acId, docKey, docName, expKey, urlKey, nameKey){
  selectedDocRenewFile = null;
  docRenewState = {acId:acId, docKey:docKey, docName:docName, expKey:expKey, urlKey:urlKey, nameKey:nameKey};
  var ac = aircraftList.find(function(a){return a.id===acId;});
  document.getElementById('doc-renew-title').textContent = 'Upload updated '+docName;
  document.getElementById('doc-renew-aircraft-info').textContent = ac ? ac.aircraft_type+' ÃÂ· '+ac.registration : '';
  document.getElementById('doc-renew-current-expiry').textContent = ac && ac[expKey] ? fmtDate(ac[expKey]) : 'ÃÂ¢ÃÂÃÂ';
  document.getElementById('doc-renew-file-input').value = '';
  document.getElementById('doc-renew-filename').textContent = 'Upload PDF/JPG/PNG';
  document.getElementById('doc-renew-filename').style.color = '';
  document.getElementById('doc-renew-upload-area').style.borderColor = '';
  document.getElementById('doc-renew-expiry').value = '';
  document.getElementById('doc-renew-error').style.display = 'none';
  document.getElementById('doc-renew-modal').classList.add('open');
}

function onDocRenewFileSelected(input){
  var file = input.files[0];
  if(!file) return;
  if(file.size > 10*1024*1024){alert('Max 10MB');input.value='';return;}
  selectedDocRenewFile = file;
  document.getElementById('doc-renew-filename').textContent = 'ÃÂ¢ÃÂÃÂ '+file.name;
  document.getElementById('doc-renew-filename').style.color = 'var(--gold)';
  document.getElementById('doc-renew-upload-area').style.borderColor = 'var(--gold)';
}

async function submitDocRenewal(){
  var expiry = document.getElementById('doc-renew-expiry').value;
  var errEl = document.getElementById('doc-renew-error');
  errEl.style.display = 'none';
  if(!selectedDocRenewFile){errEl.textContent='Please upload the updated document.';errEl.style.display='block';return;}
  if(!expiry){errEl.textContent='Please enter the new expiry date.';errEl.style.display='block';return;}
  var ac = aircraftList.find(function(a){return a.id===docRenewState.acId;});
  var oldExpiry = ac && ac[docRenewState.expKey];
  if(oldExpiry && expiry <= oldExpiry){
    errEl.textContent='New expiry must be later than current expiry ('+fmtDate(oldExpiry)+')';
    errEl.style.display='block';return;
  }
  var btn = document.getElementById('btn-submit-doc-renew');
  btn.disabled=true;btn.textContent='Uploading...';
  var result = await uploadAcDoc(currentOperator.id, docRenewState.acId, docRenewState.docKey, selectedDocRenewFile);
  if(!result){
    errEl.textContent='Upload failed. Please try again.';errEl.style.display='block';
    btn.disabled=false;btn.textContent='Submit for approval';return;
  }
  var patch = {doc_status:'pending', is_active:false};
  patch[docRenewState.urlKey] = result.url;
  patch[docRenewState.nameKey] = result.name;
  patch[docRenewState.expKey] = expiry;
  var res = await sbFetch('aircraft?id=eq.'+docRenewState.acId,{method:'PATCH',body:patch});
  if(!res.ok){
    errEl.textContent='Failed to save. Please try again.';errEl.style.display='block';
    btn.disabled=false;btn.textContent='Submit for approval';return;
  }
  btn.disabled=false;btn.textContent='Submit for approval';
  closeModal('doc-renew-modal');
  selectedDocRenewFile = null;
  showToast(docRenewState.docName+' submitted for SkyVayu approval','success');
  await loadFleet();
}

/* ============ ROSTER (calendar grid) ============ */

async function loadRoster(){
  if(!aircraftList.length)await loadFleet();
  var container=document.getElementById('roster-content');
  if(!aircraftList.length){container.innerHTML='<div class="empty-state"><div class="empty-title">No aircraft</div><div class="empty-sub">Add aircraft to your fleet to view the roster</div></div>';return;}
  var days=30;
  var today=new Date();today.setHours(0,0,0,0);
  var dates=[];for(var i=0;i<days;i++){var d=new Date(today);d.setDate(d.getDate()+i);dates.push(d);}
  var busyMap=getBusyAircraftMap();
  function toIso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function dayName(d){return['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()];}
  var cols='160px '+dates.map(function(){return'76px';}).join(' ');
  var html='<div class="roster-grid" style="grid-template-columns:'+cols+';">';
  html+='<div class="roster-hdr-left">Aircraft</div>';
  dates.forEach(function(d,idx){
    var isToday=idx===0;
    html+='<div class="roster-hdr-date '+(isToday?'today':'')+'">'+dayName(d)+'<span class="d-num">'+d.getDate()+'</span></div>';
  });
  aircraftList.forEach(function(ac){
    html+='<div class="roster-cell-ac"><div class="ac-type">'+escapeHtml(ac.aircraft_type)+'</div><div class="ac-reg">'+escapeHtml(ac.registration)+'</div></div>';
  ['am-wifi','am-oven','am-microwave','am-coffee','am-flatbed','am-lavatory','am-satphone','am-entertainment','am-nonsmoking'].forEach(function(id){var el=document.getElementById(id);if(el)el.checked=false;});
    dates.forEach(function(d,idx){
      var iso=toIso(d);
      var cls='roster-cell'+(idx===0?' today':'');
      var booking=busyMap[ac.id]&&busyMap[ac.id][iso];
      var cellContent='';
      if(booking){
        var isMine=false;
        if(!isOwner()){
          var mine=allMyOperatorQuotes.find(function(q){return q.aircraft_id===ac.id&&q.queries&&(q.queries.flight_date===iso||q.queries.return_date===iso)&&q.submitted_by===currentUser.id;});
          isMine=!!mine;
        }
        var bClass=isOwner()?'booking':(isMine?'booking mine':'booking other-emp');
        var bLabel=isOwner()?booking.by:(isMine?'You':'ÃÂ¢ÃÂÃÂ');
        var routeTxt=isOwner()||isMine?booking.route:'ÃÂ¢ÃÂÃÂ¢';
        cellContent='<div class="'+bClass+'" title="'+booking.route+' ÃÂ· by '+booking.by+'"><span class="b-route">'+routeTxt+'</span><span class="b-emp">'+bLabel+'</span></div>';
      }
      html+='<div class="'+cls+'">'+cellContent+'</div>';
    });
  });
  html+='</div>';
  container.innerHTML=html;
}

/* ============ EMPLOYEES (admin only) ============ */

async function loadEmployees(){
  if(!isOwner())return;
  var el=document.getElementById('employees-list');
  var emps=allOperatorUsers.filter(function(u){return u.role==='employee';});
  if(!emps.length){el.innerHTML='<div class="empty-state"><div class="empty-title">No employees added</div><div class="empty-sub">Create accounts for your sales team</div></div>';return;}
  var stats={};
  emps.forEach(function(e){stats[e.id]={shared:0,confirmed:0,revenue:0,activity:[]};});
  allMyOperatorQuotes.forEach(function(q){
    if(!q.submitted_by||!stats[q.submitted_by])return;
    stats[q.submitted_by].activity.push(q);
    if(q.status==='shared')stats[q.submitted_by].shared++;
    if(q.status==='accepted'||q.status==='confirmed'||q.status==='booked'){
      stats[q.submitted_by].confirmed++;
      stats[q.submitted_by].revenue+=Number(q.price||0);
    }
  });
  var rows=emps.map(function(e){
    var s=stats[e.id];
    var ini=(e.full_name||e.username).split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase();
    var online=e.last_login&&(new Date()-new Date(e.last_login))<1800000;
    var lastSeen=e.last_login?new Date(e.last_login).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'ÃÂ¢ÃÂÃÂ';
    var isExpanded=expandedEmployeeId===e.id;
    var pendingBadge=e.is_approved===false?'<span style="font-size:9px;background:rgba(196,134,10,0.15);color:var(--gold);padding:1px 6px;border-radius:3px;margin-left:6px;text-transform:uppercase;">Pending approval</span>':'';
    var html='<tr onclick="toggleEmployee(\''+escapeHtml(e.id)+'\')"><td><span class="emp-avatar">'+escapeHtml(ini)+'</span><b>'+escapeHtml(e.full_name||e.username)+'</b>'+pendingBadge+'<br><span style="font-size:11px;color:var(--text-tertiary);">@'+escapeHtml(e.username)+(e.employee_id?' ÃÂ· ID: '+escapeHtml(e.employee_id):'')+'</span></td>'
      +'<td>'+s.shared+'</td><td>'+s.confirmed+'</td>'
      +'<td style="color:'+(online?'var(--green-light)':'var(--text-tertiary)')+';">'+(online?'Online':lastSeen)+'</td>'
      +'<td>'+fmtPriceShort(s.revenue)+'</td></tr>';
    if(isExpanded){
      var activityHtml=s.activity.slice(0,15).map(function(q){
        var qq=q.queries||{};
        var route=escapeHtml(qq.departure||'-')+' → '+escapeHtml(qq.destination||'-');
        var when=new Date(q.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
        var statusLabel=q.status==='shared'?'shared quote':(q.status==='accepted'||q.status==='confirmed'||q.status==='booked'?'won booking':escapeHtml(q.status));
        return'<div class="emp-log-row"><span class="emp-log-time">'+when+'</span><span class="emp-log-action"><b>'+statusLabel+'</b> ÃÂ· '+route+' ÃÂ· '+fmtPrice(q.price)+' ÃÂ· '+escapeHtml(q.aircraft_type||'')+'</span></div>';
      }).join('');
      if(!s.activity.length)activityHtml='<div style="color:var(--text-tertiary);font-size:12px;padding:8px 0;">No activity yet.</div>';
      var deactivateBtn=e.is_active?'<button class="btn-sm btn-danger-sm" onclick="event.stopPropagation();toggleEmployeeActive(\''+escapeHtml(e.id)+'\',false)">Deactivate account</button>':'<button class="btn-sm btn-outline-sm" onclick="event.stopPropagation();toggleEmployeeActive(\''+escapeHtml(e.id)+'\',true)">Reactivate</button>';
      html+='<tr><td colspan="5" style="padding:0;"><div class="emp-detail"><h4>Recent activity</h4>'+activityHtml+'<div style="margin-top:14px;">'+deactivateBtn+'</div></div></td></tr>';
    }
    return html;
  }).join('');
  el.innerHTML='<table class="emp-table"><thead><tr><th>Name</th><th>Shared</th><th>Confirmed</th><th>Last seen</th><th>Revenue</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function toggleEmployee(id){expandedEmployeeId=expandedEmployeeId===id?null:id;loadEmployees();}

async function toggleEmployeeActive(id,active){
  await sbFetch('operator_users?id=eq.'+id,{method:'PATCH',body:{is_active:active}});
  showToast(active?'Employee reactivated':'Employee deactivated','success');
  await loadAllData();loadEmployees();
}

function openEmployeeModal(){document.getElementById('employee-modal').classList.add('open');}

async function saveEmployee(){
  var name=document.getElementById('emp-name').value.trim();
  var empId=document.getElementById('emp-id').value.trim();
  var username=document.getElementById('emp-username').value.trim();
  var password=document.getElementById('emp-password').value;
  if(!name||!empId||!username||!password){showToast('Please fill in all fields','error');return;}
  var res=await sbFetch('operator_users',{method:'POST',prefer:'return=representation',body:{
    operator_id:currentOperator.id,full_name:name,username:username,
    password_hash:password,role:'employee',employee_id:empId,
    is_approved:false,is_active:true
  }});
  if(res.ok){
    closeModal('employee-modal');
    ['emp-name','emp-id','emp-username','emp-password'].forEach(function(id){document.getElementById(id).value='';});
    await loadAllData();loadEmployees();
    showToast('Employee submitted for SkyVayu approval','success');
  } else showToast('Username already taken or error occurred','error');
}

/* ============ REVENUE (admin only) ============ */

function loadRevenue(){
  if(!isOwner())return;
  var container=document.getElementById('revenue-content');
  var confirmed=allMyOperatorQuotes.filter(function(q){return q.status==='accepted'||q.status==='confirmed'||q.status==='booked';});
  if(!confirmed.length){container.innerHTML='<div class="empty-state"><div class="empty-title">No revenue yet</div><div class="empty-sub">Confirmed bookings will appear here</div></div>';return;}
  var total=confirmed.reduce(function(a,q){return a+Number(q.price||0);},0);
  var now=new Date();
  var thisMonth=now.getMonth(),thisYear=now.getFullYear();
  var lastDate=new Date(thisYear,thisMonth-1,1);
  var lastMonth=lastDate.getMonth(),lastYear=lastDate.getFullYear();
  var thisMonthRev=0,lastMonthRev=0;
  confirmed.forEach(function(q){
    var d=q.queries&&q.queries.flight_date?new Date(q.queries.flight_date):new Date(q.created_at);
    if(d.getMonth()===thisMonth&&d.getFullYear()===thisYear)thisMonthRev+=Number(q.price||0);
    else if(d.getMonth()===lastMonth&&d.getFullYear()===lastYear)lastMonthRev+=Number(q.price||0);
  });
  var delta='';
  if(lastMonthRev>0){
    var pct=((thisMonthRev-lastMonthRev)/lastMonthRev*100);
    var cls=pct>=0?'up':'down';
    delta='<div class="rev-delta '+cls+'">'+(pct>=0?'ÃÂ¢ÃÂÃÂ² ':'ÃÂ¢ÃÂÃÂ¼ ')+Math.abs(pct).toFixed(1)+'% vs last month</div>';
  }
  var byEmp={};
  confirmed.forEach(function(q){
    var id=q.submitted_by||'unknown';
    if(!byEmp[id])byEmp[id]={name:'',count:0,rev:0};
    var u=lookupUser(id);
    byEmp[id].name=u?(u.full_name||u.username):'ÃÂ¢ÃÂÃÂ';
    byEmp[id].count++;
    byEmp[id].rev+=Number(q.price||0);
  });
  var empRows=Object.keys(byEmp).map(function(k){return byEmp[k];}).sort(function(a,b){return b.rev-a.rev;}).map(function(r){
    var avg=r.count>0?Math.round(r.rev/r.count):0;
    return'<tr><td><b>'+escapeHtml(r.name)+'</b></td><td>'+r.count+'</td><td>'+fmtPrice(avg)+'</td><td><b>'+fmtPrice(r.rev)+'</b></td></tr>';
  }).join('');
  var byAc={};
  confirmed.forEach(function(q){
    var id=q.aircraft_id||'unknown';
    if(!byAc[id])byAc[id]={name:q.aircraft_type||'ÃÂ¢ÃÂÃÂ',reg:q.aircraft_registration||'',count:0,rev:0};
    byAc[id].count++;
    byAc[id].rev+=Number(q.price||0);
  });
  var acRows=Object.keys(byAc).map(function(k){return byAc[k];}).sort(function(a,b){return b.rev-a.rev;}).map(function(r){
    var avg=r.count>0?Math.round(r.rev/r.count):0;
    return'<tr><td><b>'+escapeHtml(r.name)+'</b> <span style="color:var(--text-tertiary);font-size:11px;font-family:monospace;">'+escapeHtml(r.reg)+'</span></td><td>'+r.count+'</td><td>'+fmtPrice(avg)+'</td><td><b>'+fmtPrice(r.rev)+'</b></td></tr>';
  }).join('');
  container.innerHTML=
    '<div class="rev-hero"><div class="rev-hero-label">Total revenue (confirmed)</div><div class="rev-hero-num">'+fmtPrice(total)+'</div><div class="rev-hero-meta">'+confirmed.length+' confirmed bookings</div></div>'
    +'<div class="rev-grid"><div class="rev-month-card"><div class="rev-month-label">This month</div><div class="rev-month-num">'+fmtPrice(thisMonthRev)+'</div>'+delta+'</div>'
    +'<div class="rev-month-card"><div class="rev-month-label">Last month</div><div class="rev-month-num">'+fmtPrice(lastMonthRev)+'</div></div></div>'
    +'<div class="card"><div class="card-header"><span class="card-title">Revenue by employee</span></div><div class="card-body"><table class="emp-table"><thead><tr><th>Employee</th><th>Bookings</th><th>Avg ticket</th><th>Revenue</th></tr></thead><tbody>'+empRows+'</tbody></table></div></div>'
    +'<div class="card"><div class="card-header"><span class="card-title">Revenue by aircraft</span></div><div class="card-body"><table class="emp-table"><thead><tr><th>Aircraft</th><th>Flights</th><th>Avg ticket</th><th>Revenue</th></tr></thead><tbody>'+acRows+'</tbody></table></div></div>';
}

/* ============ REGISTRATION ============ */

var selectedAopFile = null;

function onAopFileSelected(input){
  var file = input.files[0];
  if(!file) return;
  if(file.size > 10*1024*1024){
    alert('File is too large. Maximum size is 10MB.');
    input.value = ''; return;
  }
  selectedAopFile = file;
  document.getElementById('aop-file-name').textContent = 'ÃÂ¢ÃÂÃÂ ' + file.name;
  document.getElementById('aop-file-name').style.display = 'block';
  document.getElementById('aop-upload-label').style.display = 'none';
  document.getElementById('aop-upload-area').style.borderColor = 'var(--gold)';
}

async function uploadAopDocument(operatorId, file){
  var ext = file.name.split('.').pop();
  var path = 'aop/' + operatorId + '/aop-' + Date.now() + '.' + ext;
  var res = await fetch(SUPABASE_URL + '/storage/v1/object/operator-documents/' + path, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + _opAuthToken,
      'Content-Type': file.type,
      'x-upsert': 'true'
    },
    body: file
  });
  if(!res.ok) return null;
  return { path: path, name: file.name };
}

async function submitRegistration(){
  var company  = document.getElementById('reg-company').value.trim();
  var name     = document.getElementById('reg-name').value.trim();
  var email    = document.getElementById('reg-email').value.trim();
  var phone    = document.getElementById('reg-phone').value.trim();
  var username = document.getElementById('reg-username').value.trim();
  var password = document.getElementById('reg-password').value;
  var acCat = [document.getElementById('reg-cat-fixed')&&document.getElementById('reg-cat-fixed').checked?'fixed_wing':'',document.getElementById('reg-cat-heli')&&document.getElementById('reg-cat-heli').checked?'helicopter':''].filter(Boolean).join(',')||'fixed_wing';
  var errEl    = document.getElementById('reg-error');
  errEl.classList.remove('show');
  if(!company||!name||!email||!phone||!username||!password){
    errEl.textContent='Please fill in all fields';errEl.classList.add('show');return;
  }
  if(!selectedAopFile){
    errEl.textContent='Please upload your Air Operator\'s Permit';errEl.classList.add('show');return;
  }
  var btn = document.getElementById('reg-submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  var check = await sbFetch('operator_users?username=eq.'+encodeURIComponent(username));
  if(check.ok&&check.data&&check.data.length){
    errEl.textContent='Username already taken';errEl.classList.add('show');
    btn.disabled=false;btn.textContent='Submit application';return;
  }
  var opRes = await sbFetch('operators',{method:'POST',prefer:'return=representation',body:{
    company_name:company,owner_name:name,owner_phone:phone,owner_email:email,aircraft_category:acCat,approval_status:'pending'
  }});
  if(!opRes.ok||!opRes.data||!opRes.data.length||!opRes.data[0]){
    errEl.textContent='Registration failed. Please try again.';errEl.classList.add('show');
    btn.disabled=false;btn.textContent='Submit application';return;
  }
  var opId = opRes.data[0].id;
  if(!opId){errEl.textContent='Registration failed ÃÂ¢ÃÂÃÂ could not create account. Please try again.';errEl.classList.add('show');btn.disabled=false;btn.textContent='Submit application';return;}
  btn.textContent = 'Uploading document...';
  var uploadResult = await uploadAopDocument(opId, selectedAopFile);
  if(!uploadResult){
    errEl.textContent='Document upload failed. Please try again.';errEl.classList.add('show');
    btn.disabled=false;btn.textContent='Submit application';return;
  }
  var docUrl = SUPABASE_URL + '/storage/v1/object/operator-documents/' + uploadResult.path;
  await sbFetch('operators?id=eq.'+opId,{method:'PATCH',body:{
    aop_document_url:docUrl, aop_document_name:uploadResult.name
  }});
  var userRes = await sbFetch('operator_users',{method:'POST',body:{
    operator_id:opId,full_name:name,username:username,
    password_hash:password,role:'owner',phone:phone,is_active:true
  }});
  if(!userRes.ok){
    errEl.textContent='Failed to create account.';errEl.classList.add('show');
    btn.disabled=false;btn.textContent='Submit application';return;
  }
  selectedAopFile = null;
  ['reg-company','reg-name','reg-email','reg-phone','reg-username','reg-password'].forEach(function(id){
    document.getElementById(id).value='';
  });
  document.getElementById('aop-file-input').value='';
  document.getElementById('aop-file-name').style.display='none';
  document.getElementById('aop-upload-label').style.display='block';
  document.getElementById('aop-upload-area').style.borderColor='';
  btn.disabled=false;btn.textContent='Submit application';
  if(window._svSupabase){window._svSupabase.auth.signUp({
    email:username+'@operator.skyvayu.internal',
    password:password,
    options:{data:{username:username,role:'operator'}}
  }).then(function(authRes){
    if(!authRes.error&&authRes.data&&authRes.data.user){
      sbFetch('operator_users?username=eq.'+encodeURIComponent(username),{method:'PATCH',body:{auth_user_id:authRes.data.user.id}});
    }
  });}
  sendEmail('registration_received',{operator_id:opId});
  closeModal('register-modal');
  document.getElementById('page-login').style.display='none';
  document.getElementById('page-pending').style.display='flex';
}

/* ============ INIT ============ */

document.querySelectorAll('.modal-overlay').forEach(function(el){el.addEventListener('click',function(e){if(e.target===el){if(el.id==='quote-modal')closeQuoteModal();else el.classList.remove('open');}});});

window.addEventListener('beforeunload',function(){
  if(currentClaimId){
    /* sendBeacon only supports POST, not DELETE.
       Use a PATCH to set expires_at to now so the claim expires immediately. */
    var payload=JSON.stringify({expires_at:new Date().toISOString()});
    navigator.sendBeacon(
      SUPABASE_URL+'/rest/v1/query_claims?id=eq.'+currentClaimId,
      new Blob([payload],{type:'application/json'})
    );
  }
});

(function(){
  var saved=localStorage.getItem('opSession');
  if(saved){
    try{
      var s=JSON.parse(saved);
      if(s&&s.user&&s.operator){
        currentUser=s.user;currentOperator=s.operator;
        document.getElementById('page-login').style.display='none';
        document.getElementById('page-dashboard').style.display='';document.getElementById('page-dashboard').classList.add('active');
        var _on=document.getElementById('op-name');if(_on)_on.textContent=currentUser.full_name||currentUser.username;
        var _or=document.getElementById('op-role');if(_or)_or.textContent=currentOperator.company_name;
        var rt=document.getElementById('op-role-tag');
        if(rt){rt.textContent=isOwner()?'Admin':'Employee';rt.className='role-tag '+(isOwner()?'':'employee');}
        applyRoleRestrictions();
        showSection('queries');
        loadAllData();
        refreshInterval=setInterval(loadAllData,5000);
        claimRefreshInterval=setInterval(updateClaimTimers,1000);
        return;
      }
    }catch(e){localStorage.removeItem('opSession');}
  }
  document.getElementById('page-login').style.display='flex';
})();


function saveCategorySettings(){
  var fixedEl = document.getElementById('cat-fixed-wing');
  var heliEl = document.getElementById('cat-helicopter');
  if(!fixedEl && !heliEl){ showToast('Category checkboxes not found.','error'); return; }
  var fixedChecked = fixedEl && fixedEl.checked;
  var heliChecked = heliEl && heliEl.checked;
  if(!fixedChecked && !heliChecked){ showToast('Please select at least one category.','error'); return; }
  var cats = [fixedChecked?'fixed_wing':null, heliChecked?'helicopter':null].filter(Boolean).join(',');
  if(!currentOperator){ showToast('Not logged in.','error'); return; }
  sbFetch('operator_users?id=eq.'+currentOperator.id, {method:'PATCH', body:{aircraft_category:cats}})
    .then(function(res){
      if(res.ok){
        currentOperator.aircraft_category = cats;
        showToast('Category saved!','success');
        loadAllData();
      } else {
        showToast('Save failed. Try again.','error');
      }
    });
}

function loadProfileCategory() {
  if (!currentOperator) return;
  var cats = currentOperator.aircraft_category || [];
  var fixedEl = document.getElementById('cat-fixed-wing');
  var heliEl = document.getElementById('cat-helicopter');
  if (fixedEl) fixedEl.checked = cats.indexOf('fixed') !== -1;
  if (heliEl) heliEl.checked = cats.indexOf('heli') !== -1;
}

function saveProfileCategory() {
  var cats = [];
  if (document.getElementById('cat-fixed-wing') && document.getElementById('cat-fixed-wing').checked) cats.push('fixed');
  if (document.getElementById('cat-helicopter') && document.getElementById('cat-helicopter').checked) cats.push('heli');
  var btn = document.getElementById('profile-cat-save-btn');
  var msg = document.getElementById('profile-cat-msg');
  if (btn) btn.disabled = true;
  sbFetch('operator_users?id=eq.' + currentOperator.id, 'PATCH', {aircraft_category: cats})
    .then(function() {
      currentOperator.aircraft_category = cats;
      if (msg) { msg.style.display = 'block'; msg.style.color = '#4caf50'; msg.textContent = 'Saved successfully!'; }
      if (btn) btn.disabled = false;
      setTimeout(function(){ if(msg) msg.style.display = 'none'; }, 3000);
    })
    .catch(function(err) {
      if (msg) { msg.style.display = 'block'; msg.style.color = '#f44336'; msg.textContent = 'Error saving. Please try again.'; }
      if (btn) btn.disabled = false;
    });
}

function populateCategoryCheckboxes(){
  if(!currentOperator) return;
  var cats = (currentOperator.aircraft_category || 'fixed_wing').split(',').map(function(s){ return s.trim(); });
  var fixedEl = document.getElementById('cat-fixed-wing');
  var heliEl = document.getElementById('cat-helicopter');
  if(fixedEl) fixedEl.checked = cats.indexOf('fixed_wing') !== -1;
  if(heliEl) heliEl.checked = cats.indexOf('helicopter') !== -1;
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ Track which operators have seen each query ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
async function markQueriesViewed(queryIds) {
  if (!queryIds || !queryIds.length || !currentOperator) return;
  // Use authenticated user JWT for RLS to pass
  var sessionStr = localStorage.getItem('sb-bkumggqijgxyfotpbcni-auth-token');
  var jwt = sessionStr ? JSON.parse(sessionStr).access_token : SUPABASE_KEY;
  var rows = queryIds.map(function(qid) {
    return { query_id: qid, operator_id: currentOperator.id };
  });
  try {
    // Insert each row individually to gracefully handle duplicates (409)
    await Promise.all(rows.map(function(row) {
      return fetch(SUPABASE_URL + '/rest/v1/query_views', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(row)
      }).catch(function(){});
    }));
  } catch(e) {
    console.warn('markQueriesViewed failed', e);
  }
}

/* Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
   PROFILE SECTION
Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */

async function loadProfileSection() {
  if (!currentUser || !currentOperator) return;

  // Ã¢ÂÂÃ¢ÂÂ Hero Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  var initials = (currentUser.full_name || currentUser.username || '?')
    .split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();
  var avatarEl = document.getElementById('profile-logo-initials');
  if (avatarEl) avatarEl.textContent = initials;

  var nameEl = document.getElementById('profile-hero-name');
  if (nameEl) nameEl.textContent = escapeHtml(currentUser.full_name || currentUser.username || 'â');

  var roleEl = document.getElementById('profile-hero-role');
  if (roleEl) {
    roleEl.textContent = currentUser.role === 'owner' ? 'Admin' : 'Employee';
    roleEl.className = 'role-badge ' + (currentUser.role === 'owner' ? 'role-admin' : 'role-employee');
  }

  var companyEl = document.getElementById('profile-hero-company');
  if (companyEl) companyEl.textContent = escapeHtml(currentOperator.company_name || 'â');

  var sinceEl = document.getElementById('profile-stat-member');
  if (sinceEl && currentUser.created_at) sinceEl.textContent = fmtDate(currentUser.created_at);

  var loginEl = document.getElementById('profile-stat-login');
  if (loginEl && currentUser.last_login) loginEl.textContent = fmtDate(currentUser.last_login);

  var catEl = document.getElementById('profile-stat-cat');
  if (catEl) {
    var cats = [];
    if (currentUser.aircraft_category) {
      if (currentUser.aircraft_category.indexOf('fixed') > -1) cats.push('Fixed Wing');
      if (currentUser.aircraft_category.indexOf('heli') > -1) cats.push('Helicopter');
    }
    catEl.textContent = cats.length ? cats.join(', ') : 'â';
  }

  // Ã¢ÂÂÃ¢ÂÂ Personal fields Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  // Populate personal view spans and inputs
  var setVal = function(id, val) { var el=document.getElementById(id); if(el)el.value=val||''; };
  var setTxt = function(id, val) { var el=document.getElementById(id); if(el)el.textContent=val||'\u2014'; };
  setTxt('view-full-name', currentUser.full_name);
  setTxt('view-username', currentUser.username);
  setTxt('view-email', currentUser.email);
  setTxt('view-phone', currentUser.phone);
  setTxt('view-employee-id', currentUser.employee_id);
  setVal('input-full-name', currentUser.full_name);
  setVal('input-username', currentUser.username);
  setVal('input-email', currentUser.email);
  setVal('input-phone', currentUser.phone);
  setVal('input-employee-id', currentUser.employee_id);

  // Company card (owner only)
  var companyCard = document.getElementById('profile-company-card');
  var overviewCard = document.getElementById('profile-overview-card');
  var opsCard = document.getElementById('profile-ops-card');
  var certsCard = document.getElementById('profile-certs-card');
  if (currentUser.role === 'owner') {
    if (companyCard) {
      companyCard.style.display = '';
      // Populate view spans
      setTxt('view-company-name', currentOperator.company_name);
      setTxt('view-company-email', currentOperator.email);
      setTxt('view-company-phone', currentOperator.phone);
      setTxt('view-owner-name', currentOperator.owner_name);
      setTxt('view-owner-email', currentOperator.owner_email);
      setTxt('view-owner-phone', currentOperator.owner_phone);
      // Populate inputs
      setVal('input-company-name', currentOperator.company_name);
      setVal('input-company-email', currentOperator.email);
      setVal('input-company-phone', currentOperator.phone);
      setVal('input-owner-name', currentOperator.owner_name);
      setVal('input-owner-email', currentOperator.owner_email);
      setVal('input-owner-phone', currentOperator.owner_phone);
    }
    if (overviewCard) overviewCard.style.display = '';
    if (opsCard) opsCard.style.display = '';
    if (certsCard) {
      certsCard.style.display = '';
      // AOP document link
      var aopBtn = document.getElementById('view-aop-btn');
      var aopNone = document.getElementById('view-aop-none');
      if (currentOperator.aop_document_url) {
        if (aopBtn) { aopBtn.style.display = 'inline-block'; }
        if (aopNone) aopNone.style.display = 'none';
      } else {
        if (aopBtn) aopBtn.style.display = 'none';
        if (aopNone) aopNone.style.display = '';
      }
    }
  } else {
    if (companyCard) companyCard.style.display = 'none';
    if (overviewCard) overviewCard.style.display = 'none';
    if (opsCard) opsCard.style.display = 'none';
    if (certsCard) certsCard.style.display = 'none';
  }

  // Ã¢ÂÂÃ¢ÂÂ Aircraft category checkboxes Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  var catFixed = document.getElementById('cat-fixed-wing');
  var catHeli = document.getElementById('cat-helicopter');
  if (catFixed && currentUser.aircraft_category) {
    catFixed.checked = currentUser.aircraft_category.indexOf('fixed') > -1;
  }
  if (catHeli && currentUser.aircraft_category) {
    catHeli.checked = currentUser.aircraft_category.indexOf('heli') > -1;
  }
}

// Ã¢ÂÂÃ¢ÂÂ Edit mode toggle Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function profileEditMode(section) {
  // This definition is overridden below by the extended version; kept for reference only.
  var actionsDiv = document.getElementById('profile-' + section + '-actions');
  var editBtn = document.getElementById('profile-' + section + '-edit-btn');
  if (actionsDiv) actionsDiv.style.display = 'flex';
  if (editBtn) editBtn.style.display = 'none';
}

function profileCancelEdit(section) {
  loadProfileSection();
  var actionsDiv = document.getElementById('profile-' + section + '-actions');
  var editBtn = document.getElementById('profile-' + section + '-edit-btn');
  if (actionsDiv) actionsDiv.style.display = 'none';
  if (editBtn) editBtn.style.display = '';
  var msg = document.getElementById('profile-' + section + '-msg');
  if (msg) { msg.textContent = ''; msg.className = 'profile-msg'; }
}

// Ã¢ÂÂÃ¢ÂÂ Save personal details Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function profileSavePersonal() {
  var fullName = document.getElementById('input-full-name').value.trim();
  var email = document.getElementById('input-email').value.trim();
  var phone = document.getElementById('input-phone').value.trim();
  var msg = document.getElementById('profile-personal-msg');
  var btn = document.querySelector('#profile-personal-actions .btn-primary');

  if (!fullName) { profileMsg('personal', 'Full name is required.', 'error'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  var res = await sbFetch('operator_users?id=eq.' + currentUser.id, {
    method: 'PATCH',
    body: { full_name: fullName, email: email || null, phone: phone || null }
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }

  if (res.ok) {
    currentUser.full_name = fullName;
    currentUser.email = email;
    currentUser.phone = phone;
    // Update session
    localStorage.setItem('opSession', JSON.stringify({ user: currentUser, operator: currentOperator }));
    // Update sidebar name
    var sidebarName = document.getElementById('op-name');
    if (sidebarName) sidebarName.textContent = fullName;
    profileMsg('personal', 'Personal details saved successfully.', 'success');
    profileCancelEdit('personal');
    loadProfileSection();
  } else {
    profileMsg('personal', 'Failed to save changes. Please try again.', 'error');
  }
}

// Ã¢ÂÂÃ¢ÂÂ Save company details Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function profileSaveCompany() {
  var companyName = document.getElementById('input-company-name').value.trim();
  var companyEmail = document.getElementById('input-company-email').value.trim();
  var companyPhone = document.getElementById('input-company-phone').value.trim();
  var ownerName = document.getElementById('input-owner-name').value.trim();
  var ownerEmail = document.getElementById('input-owner-email').value.trim();
  var ownerPhone = document.getElementById('input-owner-phone').value.trim();
  var dgca = document.getElementById('input-dgca-licence').value.trim();
  var aopExpiry = document.getElementById('input-aop-expiry').value;
  var btn = document.querySelector('#profile-company-actions .btn-primary');

  if (!companyName) { profileMsg('company', 'Company name is required.', 'error'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  var patchData = {
    company_name: companyName,
    email: companyEmail || null,
    phone: companyPhone || null,
    owner_name: ownerName || null,
    owner_email: ownerEmail || null,
    owner_phone: ownerPhone || null,
    dgca_licence_no: dgca || null,
    aop_expiry_date: aopExpiry || null
  };

  var res = await sbFetch('operators?id=eq.' + currentOperator.id, {
    method: 'PATCH',
    body: patchData
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }

  if (res.ok) {
    Object.assign(currentOperator, patchData);
    localStorage.setItem('opSession', JSON.stringify({ user: currentUser, operator: currentOperator }));
    // Update sidebar company
    var sidebarComp = document.getElementById('op-role');
    if (sidebarComp) sidebarComp.textContent = companyName;
    profileMsg('company', 'Company details saved successfully.', 'success');
    profileCancelEdit('company');
    loadProfileSection();
  } else {
    profileMsg('company', 'Failed to save changes. Please try again.', 'error');
  }
}

// Ã¢ÂÂÃ¢ÂÂ Change password Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function profileChangePassword() {
  var current = document.getElementById('input-current-pw').value;
  var newPw = document.getElementById('input-new-pw').value;
  var confirm = document.getElementById('input-confirm-pw').value;
  var btn = document.querySelector('#section-profile .card:last-child .btn-primary');

  if (!current || !newPw || !confirm) {
    profileMsg('pw', 'All password fields are required.', 'error'); return;
  }
  if (newPw.length < 8) {
    profileMsg('pw', 'New password must be at least 8 characters.', 'error'); return;
  }
  if (newPw !== confirm) {
    profileMsg('pw', 'New passwords do not match.', 'error'); return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

  var res = await sbFetch('rpc/update_operator_password', {
    method: 'POST',
    body: { p_user_id: currentUser.id, p_current_password: current, p_new_password: newPw }
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }

  if (res.ok && res.data) {
    var result = Array.isArray(res.data) ? res.data[0] : res.data;
    if (result && result.success) {
            if(window._svSupabase){await window._svSupabase.auth.updateUser({password:newPw});}
profileMsg('pw', 'Password updated successfully.', 'success');
      document.getElementById('input-current-pw').value = '';
      document.getElementById('input-new-pw').value = '';
      document.getElementById('input-confirm-pw').value = '';
      var _ps=document.getElementById('profile-pw-strength');if(_ps)_ps.className='profile-pw-strength';
    } else {
      profileMsg('pw', (result && result.message) || 'Current password is incorrect.', 'error');
    }
  } else {
    profileMsg('pw', 'Failed to update password. Please try again.', 'error');
  }
}

// Ã¢ÂÂÃ¢ÂÂ Save aircraft category Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function saveProfileCategory() {
  var fixed = document.getElementById('cat-fixed-wing') ? document.getElementById('cat-fixed-wing').checked : false;
  var heli = document.getElementById('cat-helicopter') ? document.getElementById('cat-helicopter').checked : false;
  var btn = document.getElementById('profile-cat-save-btn');
  var parts = [];
  if (fixed) parts.push('fixed');
  if (heli) parts.push('heli');
  var cat = parts.join(',');

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  var res = await sbFetch('operator_users?id=eq.' + currentUser.id, {
    method: 'PATCH',
    body: { aircraft_category: cat || null }
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Save Category'; }

  if (res.ok) {
    currentUser.aircraft_category = cat;
    localStorage.setItem('opSession', JSON.stringify({ user: currentUser, operator: currentOperator }));
    profileMsg('category', 'Aircraft category saved.', 'success');
    loadProfileSection();
  } else {
    profileMsg('category', 'Failed to save. Please try again.', 'error');
  }
}

// Ã¢ÂÂÃ¢ÂÂ Password strength indicator Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
(function() {
  document.addEventListener('input', function(e) {
    if (e.target && (e.target.id === 'profile-pw-new' || e.target.id === 'input-new-pw')) {
      var val = e.target.value;
      var strengthEl = document.getElementById('profile-pw-strength');
      if (!strengthEl) return;
      if (!val) { strengthEl.className = 'profile-pw-strength'; return; }
      var score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      strengthEl.className = 'profile-pw-strength ' + (score <= 1 ? 'weak' : score <= 2 ? 'medium' : 'strong');
    }
  });
})();

// Ã¢ÂÂÃ¢ÂÂ Helper: show message Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function profileMsg(section, text, type) {
  var el = document.getElementById('profile-' + section + '-msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'profile-msg ' + (type || '');
  setTimeout(function() {
    if (el.textContent === text) { el.textContent = ''; el.className = 'profile-msg'; }
  }, 5000);
}

// ============================================================
// AVINODE-STYLE PROFILE EXTENSIONS
// ============================================================

// ---- Company Overview ----
function profileSaveOverview() {
  if (!currentOperator) { profileMsg('overview','Not logged in.','error'); return; }
  var data = {
    company_description: document.getElementById('input-company-desc').value.trim(),
    year_established: document.getElementById('input-year-established').value.trim(),
    website: document.getElementById('input-website').value.trim(),
    home_base: document.getElementById('input-home-base').value.trim(),
    other_bases: document.getElementById('input-other-bases').value.trim(),
    sales_email: document.getElementById('input-sales-email').value.trim(),
    sales_phone: document.getElementById('input-sales-phone').value.trim(),
    ops_phone: document.getElementById('input-ops-phone').value.trim()
  };
  sbFetch('operators?id=eq.' + currentOperator.id, { method: 'PATCH', body: data })
    .then(function(res){
      if (res.ok) {
        Object.assign(currentOperator, data);
        localStorage.setItem('opSession', JSON.stringify({ user: currentUser, operator: currentOperator }));
        profileMsg('overview', 'Company overview saved.', 'success');
        renderOverviewView(data);
        profileCancelEdit('overview');
      } else {
        profileMsg('overview', 'Save failed.', 'error');
      }
    }).catch(function(){ profileMsg('overview','Network error.','error'); });
}

function renderOverviewView(d) {
  setText('view-company-desc', d.company_description || '—');
  setText('view-year-established', d.year_established || '—');
  var websiteEl = document.getElementById('view-website');
  if (websiteEl) websiteEl.innerHTML = d.website ? '<a href="' + escapeHtml(d.website) + '" target="_blank" rel="noopener">' + escapeHtml(d.website) + '</a>' : '—';
  setText('view-home-base', d.home_base || '—');
  setText('view-other-bases', d.other_bases || '—');
  setText('view-sales-email', d.sales_email || '—');
  setText('view-sales-phone', d.sales_phone || '—');
  setText('view-ops-phone', d.ops_phone || '—');
  if (d.home_base) setText('profile-hero-base', d.home_base);
  if (d.company_description) setText('profile-hero-tagline', d.company_description.substring(0,80) + (d.company_description.length > 80 ? '...' : ''));
}

// ---- Operational Details ----
function profileSaveOps() {
  if (!currentOperator) { profileMsg('ops','Not logged in.','error'); return; }
  var regions = Array.from(document.querySelectorAll('[name="region"]:checked')).map(function(c){ return c.value; }).join(', ');
  var data = {
    regions_served: regions,
    max_range_nm: document.getElementById('input-max-range').value.trim(),
    ops_hours: document.getElementById('input-ops-hours').value.trim(),
    min_notice_period: document.getElementById('input-min-notice').value
  };
  sbFetch('operators?id=eq.' + currentOperator.id, { method: 'PATCH', body: data })
    .then(function(res){
      if (res.ok) {
        Object.assign(currentOperator, data);
        localStorage.setItem('opSession', JSON.stringify({ user: currentUser, operator: currentOperator }));
        profileMsg('ops','Operational details saved.','success');
        setText('view-regions', data.regions_served || '—');
        setText('view-max-range', data.max_range_nm ? data.max_range_nm + ' nm' : '—');
        setText('view-ops-hours', data.ops_hours || '—');
        setText('view-min-notice', data.min_notice_period || '—');
        profileCancelEdit('ops');
      } else {
        profileMsg('ops','Save failed.','error');
      }
    }).catch(function(){ profileMsg('ops','Network error.','error'); });
}

// ---- Safety & Certifications ----
function profileSaveCerts() {
  if (!currentOperator) { profileMsg('certs','Not logged in.','error'); return; }
  var data = {
    dgca_licence_no: document.getElementById('input-dgca-licence').value.trim(),
    aop_expiry_date: document.getElementById('input-aop-expiry').value || null,
    argus_rating: document.getElementById('input-argus').value,
    wyvern_rating: document.getElementById('input-wyvern').value,
    isbao_stage: document.getElementById('input-isbao').value
  };
  sbFetch('operators?id=eq.' + currentOperator.id, { method: 'PATCH', body: data })
    .then(function(res){
      if (res.ok) {
        Object.assign(currentOperator, data);
        localStorage.setItem('opSession', JSON.stringify({ user: currentUser, operator: currentOperator }));
        profileMsg('certs','Certifications saved.','success');
        setText('view-dgca-licence', data.dgca_licence_no || '—');
        setText('view-aop-expiry', data.aop_expiry_date ? fmtDate(data.aop_expiry_date) : '—');
        setText('view-argus', data.argus_rating || '—');
        setText('view-wyvern', data.wyvern_rating || '—');
        setText('view-isbao', data.isbao_stage || '—');
        renderCertBadges({argus_rating:data.argus_rating,wyvern_rating:data.wyvern_rating,isbao_stage:data.isbao_stage});
        profileCancelEdit('certs');
      } else {
        profileMsg('certs','Save failed.','error');
      }
    }).catch(function(){ profileMsg('certs','Network error.','error'); });
}

function renderCertBadges(d) {
  var container = document.getElementById('view-cert-badges');
  if (!container) return;
  var badges = [];
  if (d.argus_rating) badges.push('<span class="cert-badge cert-argus">' + escapeHtml(d.argus_rating) + '</span>');
  if (d.wyvern_rating) badges.push('<span class="cert-badge cert-wyvern">' + escapeHtml(d.wyvern_rating) + '</span>');
  if (d.isbao_stage) badges.push('<span class="cert-badge cert-isbao">' + escapeHtml(d.isbao_stage) + '</span>');
  container.innerHTML = badges.join('');
}

// ---- Company Basic Info ----
function profileSaveCompany() {
  if (!currentOperator) { profileMsg('company','Not logged in.','error'); return; }
  var data = {
    company_name: document.getElementById('input-company-name').value.trim(),
    email: document.getElementById('input-company-email').value.trim() || null,
    phone: document.getElementById('input-company-phone').value.trim() || null,
    owner_name: document.getElementById('input-owner-name').value.trim() || null,
    owner_email: document.getElementById('input-owner-email').value.trim() || null,
    owner_phone: document.getElementById('input-owner-phone').value.trim() || null
  };
  if (!data.company_name) { profileMsg('company','Company name is required.','error'); return; }
  sbFetch('operators?id=eq.' + currentOperator.id, { method: 'PATCH', body: data })
    .then(function(res){
      if (res.ok) {
        Object.assign(currentOperator, data);
        localStorage.setItem('opSession', JSON.stringify({ user: currentUser, operator: currentOperator }));
        profileMsg('company','Company info saved.','success');
        setText('view-company-name', data.company_name || '—');
        setText('view-company-email', data.email || '—');
        setText('view-company-phone', data.phone || '—');
        setText('view-owner-name', data.owner_name || '—');
        setText('view-owner-email', data.owner_email || '—');
        setText('view-owner-phone', data.owner_phone || '—');
        if (data.company_name) { setText('profile-hero-company', data.company_name); var _or=document.getElementById('op-role');if(_or)_or.textContent=data.company_name; }
        profileCancelEdit('company');
      } else {
        profileMsg('company','Save failed.','error');
      }
    }).catch(function(){ profileMsg('company','Network error.','error'); });
}

// ---- Logo & Cover Photo ----
function triggerLogoUpload() {
  var inp = document.getElementById('logo-upload-input');
  if (inp) inp.click();
}

function triggerCoverUpload() {
  var inp = document.getElementById('cover-upload-input');
  if (inp) inp.click();
}

function uploadCompanyLogo(input) {
  var file = input.files[0];
  if (!file) return;
  var companyId = currentUser && currentUser.company_id;
  if (!companyId) return;
  var formData = new FormData();
  formData.append('file', file);
  var path = 'company-logos/' + companyId + '/' + Date.now() + '_logo.' + file.name.split('.').pop();
  fetch(SUPABASE_URL + '/storage/v1/object/operator-assets/' + path, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + _opAuthToken },
    body: formData
  }).then(function(r){ return r.json(); }).then(function(res){
    if (res && res.Key) {
      var logoUrl = SUPABASE_URL + '/storage/v1/object/public/operator-assets/' + path;
      var img = document.getElementById('profile-logo-img');
      var initials = document.getElementById('profile-logo-initials');
      if (img) { img.src = logoUrl; img.style.display = 'block'; }
      if (initials) initials.style.display = 'none';
      // Save URL to company record
      fetch(SUPABASE_URL + '/rest/v1/companies?id=eq.' + companyId, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + _opAuthToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: logoUrl })
      });
    }
  }).catch(function(e){ console.error('Logo upload error:', e); });
}

function uploadCoverPhoto(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var bg = document.getElementById('profile-cover-bg');
    if (bg) bg.style.backgroundImage = 'url(' + e.target.result + ')';
  };
  reader.readAsDataURL(file);
  // Also upload to storage
  var companyId = currentUser && currentUser.company_id;
  if (!companyId) return;
  var formData = new FormData();
  formData.append('file', file);
  var path = 'company-covers/' + companyId + '/' + Date.now() + '_cover.' + file.name.split('.').pop();
  fetch(SUPABASE_URL + '/storage/v1/object/operator-assets/' + path, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + _opAuthToken },
    body: formData
  }).then(function(r){ return r.json(); }).then(function(res){
    if (res && res.Key) {
      var coverUrl = SUPABASE_URL + '/storage/v1/object/public/operator-assets/' + path;
      fetch(SUPABASE_URL + '/rest/v1/companies?id=eq.' + companyId, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + _opAuthToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_url: coverUrl })
      });
    }
  });
}

// ---- Helper: set text content safely ----
function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ---- Load extended company profile on profile section open ----
function loadExtendedProfile(operatorId) {
  if (!operatorId || !currentOperator) return;
  // Use currentOperator data (already loaded at login from operators table)
  var d = currentOperator;
  (function(){
    if (!d) return;
    // Overview
    renderOverviewView(d);
    document.getElementById('input-company-desc') && (document.getElementById('input-company-desc').value = d.company_description || '');
    document.getElementById('input-year-established') && (document.getElementById('input-year-established').value = d.year_established || '');
    document.getElementById('input-website') && (document.getElementById('input-website').value = d.website || '');
    document.getElementById('input-home-base') && (document.getElementById('input-home-base').value = d.home_base || '');
    document.getElementById('input-other-bases') && (document.getElementById('input-other-bases').value = d.other_bases || '');
    document.getElementById('input-sales-email') && (document.getElementById('input-sales-email').value = d.sales_email || '');
    document.getElementById('input-sales-phone') && (document.getElementById('input-sales-phone').value = d.sales_phone || '');
    document.getElementById('input-ops-phone') && (document.getElementById('input-ops-phone').value = d.ops_phone || '');
    // Operations
    setText('view-regions', d.regions_served || '—');
    setText('view-max-range', d.max_range_nm ? d.max_range_nm + ' nm' : '—');
    setText('view-ops-hours', d.ops_hours || '—');
    setText('view-min-notice', d.min_notice_period || '—');
    document.getElementById('input-max-range') && (document.getElementById('input-max-range').value = d.max_range_nm || '');
    document.getElementById('input-ops-hours') && (document.getElementById('input-ops-hours').value = d.ops_hours || '');
    document.getElementById('input-min-notice') && (document.getElementById('input-min-notice').value = d.min_notice_period || '');
    if (d.regions_served) {
      var regions = d.regions_served.split(',').map(function(r){ return r.trim(); });
      document.querySelectorAll('[name="region"]').forEach(function(cb){ cb.checked = regions.includes(cb.value); });
    }
    // Certifications
    setText('view-dgca-licence', d.dgca_licence || '—');
    setText('view-aop-expiry', d.aop_expiry ? fmtDate(d.aop_expiry) : '—');
    setText('view-argus', d.argus_rating || '—');
    setText('view-wyvern', d.wyvern_rating || '—');
    setText('view-isbao', d.isbao_stage || '—');
    renderCertBadges(d);
    document.getElementById('input-dgca-licence') && (document.getElementById('input-dgca-licence').value = d.dgca_licence || '');
    document.getElementById('input-aop-expiry') && (document.getElementById('input-aop-expiry').value = d.aop_expiry || '');
    document.getElementById('input-argus') && (document.getElementById('input-argus').value = d.argus_rating || '');
    document.getElementById('input-wyvern') && (document.getElementById('input-wyvern').value = d.wyvern_rating || '');
    document.getElementById('input-isbao') && (document.getElementById('input-isbao').value = d.isbao_stage || '');
    // AOP doc (operators table uses aop_document_url)
    var _aopUrl = d.aop_document_url || d.aop_url;
    var aopBtn = document.getElementById('view-aop-btn');
    var aopNone = document.getElementById('view-aop-none');
    if (_aopUrl) {
      if (aopBtn) { aopBtn.style.display = 'inline-block'; }
      if (aopNone) aopNone.style.display = 'none';
    } else {
      if (aopBtn) aopBtn.style.display = 'none';
      if (aopNone) aopNone.style.display = '';
    }
    // Certs view
    setText('view-dgca-licence', d.dgca_licence_no || d.dgca_licence || '—');
    setText('view-aop-expiry', (d.aop_expiry_date || d.aop_expiry) ? fmtDate(d.aop_expiry_date || d.aop_expiry) : '—');
    // Company basic info (operators table uses email/phone, not company_email/company_phone)
    setText('view-company-name', d.company_name || '—');
    setText('view-company-email', d.email || d.company_email || '—');
    setText('view-company-phone', d.phone || d.company_phone || '—');
    setText('view-owner-name', d.owner_name || '—');
    setText('view-owner-email', d.owner_email || '—');
    setText('view-owner-phone', d.owner_phone || '—');
    document.getElementById('input-company-name') && (document.getElementById('input-company-name').value = d.company_name || '');
    document.getElementById('input-company-email') && (document.getElementById('input-company-email').value = d.email || d.company_email || '');
    document.getElementById('input-company-phone') && (document.getElementById('input-company-phone').value = d.phone || d.company_phone || '');
    document.getElementById('input-owner-name') && (document.getElementById('input-owner-name').value = d.owner_name || '');
    document.getElementById('input-owner-email') && (document.getElementById('input-owner-email').value = d.owner_email || '');
    document.getElementById('input-owner-phone') && (document.getElementById('input-owner-phone').value = d.owner_phone || '');
    // Fleet stats
    var fleetCount = document.querySelectorAll('#fleet-content .aircraft-card').length;
    setText('profile-stat-fleet', fleetCount > 0 ? String(fleetCount) : (d.fleet_count ? String(d.fleet_count) : '—'));
    // Logo
    if (d.logo_url) {
      var img = document.getElementById('profile-logo-img');
      var init = document.getElementById('profile-logo-initials');
      if (img) { img.src = d.logo_url; img.style.display = 'block'; }
      if (init) init.style.display = 'none';
    }
    // Cover
    if (d.cover_url) {
      var bg = document.getElementById('profile-cover-bg');
      if (bg) bg.style.backgroundImage = 'url(' + d.cover_url + ')';
    }
  })();
}

// ---- Profile edit mode toggler (extended) ----
var _origProfileEditMode = typeof profileEditMode === 'function' ? profileEditMode : null;
function profileEditMode(section) {
  var validSections = ['overview', 'ops', 'certs', 'company', 'personal'];
  if (validSections.includes(section)) {
    var view = document.getElementById('profile-' + section + '-view');
    var form = document.getElementById('profile-' + section + '-form');
    var editBtn = document.getElementById('profile-' + section + '-edit-btn');
    if (view) view.style.display = 'none';
    if (form) form.style.display = 'block';
    if (editBtn) editBtn.style.display = 'none';
  } else if (_origProfileEditMode) {
    _origProfileEditMode(section);
  }
}

function profileCancelEdit(section) {
  var view = document.getElementById('profile-' + section + '-view');
  var form = document.getElementById('profile-' + section + '-form');
  var editBtn = document.getElementById('profile-' + section + '-edit-btn');
  if (view) view.style.display = 'block';
  if (form) form.style.display = 'none';
  if (editBtn) editBtn.style.display = 'flex';
}

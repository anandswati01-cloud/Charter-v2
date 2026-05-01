var SUPABASE_URL=SKYVAYU_CONFIG.supabaseUrl;var SUPABASE_KEY=SKYVAYU_CONFIG.supabaseKey;
var currentUser=null,currentOperator=null,currentQueryId=null,currentClaimId=null;
var aircraftList=[],allOperatorUsers=[],allActiveQueries=[],allMyOperatorQuotes=[],allActiveClaims=[];
var lastCharges={},refreshInterval=null,claimRefreshInterval=null,expandedEmployeeId=null;

function isOwner(){return currentUser&&currentUser.role==='owner';}
function nowIso(){return new Date().toISOString();}

function sbFetch(path,opts){
  opts=opts||{};
  var headers={'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY};
  if(opts.prefer)headers['Prefer']=opts.prefer;
  return fetch(SUPABASE_URL+'/rest/v1/'+path,{method:opts.method||'GET',headers:headers,body:opts.body?JSON.stringify(opts.body):undefined})
    .then(function(r){
      if(r.status===204||r.headers.get('content-length')==='0')return{ok:r.ok,status:r.status,data:[]};
      return r.json().then(function(d){return{ok:r.ok,status:r.status,data:d};}).catch(function(){return{ok:r.ok,status:r.status,data:[]};});
    });
}

/* ============ LOGIN ============ */
async function doLogin(){
  var username=document.getElementById('login-username').value.trim();
  var password=document.getElementById('login-password').value;
  var errEl=document.getElementById('login-error');errEl.classList.remove('show');
  if(!username||!password){errEl.textContent='Please enter username and password';errEl.classList.add('show');return;}
  var btn=document.getElementById('login-btn');btn.disabled=true;btn.textContent='Signing in...';
  try{
    var userRes=await sbFetch('operator_users?username=eq.'+encodeURIComponent(username));
    if(!userRes.ok||!userRes.data||!userRes.data.length)throw new Error('bad');
    var user=userRes.data[0];
    if(!user.is_active)throw new Error('inactive');
    if((user.password_hash||'').trim()!==(password||'').trim())throw new Error('bad');
    // Block employees who haven't been approved by SkyVayu yet
    if(user.role==='employee'&&user.is_approved===false){
      errEl.textContent='Your account is pending approval from SkyVayu. Please wait.';
      errEl.classList.add('show');btn.disabled=false;btn.textContent='Sign in';return;
    }
    var opRes=await sbFetch('operators?id=eq.'+user.operator_id);
    if(!opRes.ok||!opRes.data||!opRes.data.length)throw new Error('no op');
    var op=opRes.data[0];
    if(op.approval_status==='pending'){document.getElementById('page-login').style.display='none';document.getElementById('page-pending').style.display='flex';btn.disabled=false;btn.textContent='Sign in';return;}
    if(op.approval_status==='rejected'){errEl.textContent='Your registration was not approved.';errEl.classList.add('show');btn.disabled=false;btn.textContent='Sign in';return;}
    currentUser=user;currentOperator=op;
    sbFetch('operator_users?id=eq.'+currentUser.id,{method:'PATCH',body:{last_login:nowIso()}});
    document.getElementById('page-login').style.display='none';
    document.getElementById('page-dashboard').classList.add('active');
    document.getElementById('sidebar-name').textContent=currentUser.full_name||currentUser.username;
    document.getElementById('sidebar-role').textContent=currentOperator.company_name;
    var rt=document.getElementById('sidebar-role-tag');
    rt.textContent=isOwner()?'Admin':'Employee';
    rt.className='role-tag '+(isOwner()?'':'employee');
    applyRoleRestrictions();
    await loadAllData();
    refreshInterval=setInterval(loadAllData,5000);
    claimRefreshInterval=setInterval(updateClaimTimers,1000);
  }catch(e){errEl.textContent='Invalid username or password';errEl.classList.add('show');}
  btn.disabled=false;btn.textContent='Sign in';
}

function doLogout(){
  if(refreshInterval){clearInterval(refreshInterval);refreshInterval=null;}
  if(claimRefreshInterval){clearInterval(claimRefreshInterval);claimRefreshInterval=null;}
  if(currentClaimId)releaseClaim(currentClaimId);
  currentUser=null;currentOperator=null;currentClaimId=null;
  document.getElementById('page-dashboard').classList.remove('active');
  document.getElementById('page-login').style.display='flex';
  document.getElementById('login-username').value='';
  document.getElementById('login-password').value='';
}

function applyRoleRestrictions(){
  var adminSection=document.getElementById('nav-admin-section');
  adminSection.style.display=isOwner()?'block':'none';
  var addAcBtn=document.getElementById('btn-add-aircraft');
  if(addAcBtn)addAcBtn.style.display=isOwner()?'flex':'none';
  var sharedLabel=document.getElementById('stat-shared-label');
  var confLabel=document.getElementById('stat-confirmed-label');
  if(!isOwner()){sharedLabel.textContent='My quotes shared';confLabel.textContent='My confirmed bookings';}
  else{sharedLabel.textContent='Quotes shared';confLabel.textContent='Confirmed bookings';}
}

/* ============ NAV ============ */
function showSection(section){
  ['queries','fleet','roster','employees','revenue'].forEach(function(s){
    var el=document.getElementById('section-'+s);if(el)el.style.display='none';
    var nav=document.getElementById('nav-'+s);if(nav)nav.classList.remove('active');
  });
  document.getElementById('section-'+section).style.display='block';
  document.getElementById('nav-'+section).classList.add('active');
  if(section==='fleet')loadFleet();
  if(section==='roster')loadRoster();
  if(section==='employees')loadEmployees();
  if(section==='revenue')loadRevenue();
  if(section==='queries')loadAllData();
}

function showSubtab(tab){
  ['active','shared','confirmed'].forEach(function(t){
    document.getElementById('list-'+t).style.display='none';
    document.querySelector('.subtab[data-subtab="'+t+'"]').classList.remove('active');
  });
  document.getElementById('list-'+tab).style.display='block';
  document.querySelector('.subtab[data-subtab="'+tab+'"]').classList.add('active');
}

/* ============ HELPERS ============ */
function fmtDate(d){if(!d)return'—';var p=d.split('-');if(p.length!==3)return d;return p[2]+'-'+p[1]+'-'+p[0];}
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
async function loadAllData(){
  if(!currentOperator)return;
  var opId=currentOperator.id;
  var results=await Promise.all([
    sbFetch('queries?status=eq.open&order=created_at.desc'),
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

  document.getElementById('stat-active').textContent=unquoted.length;
  document.getElementById('stat-shared').textContent=shared.length;
  document.getElementById('stat-confirmed').textContent=confirmed.length;
  document.getElementById('count-active').textContent=unquoted.length;
  document.getElementById('count-shared').textContent=shared.length;
  document.getElementById('count-confirmed').textContent=confirmed.length;
  document.getElementById('nav-badge-queries').textContent=unquoted.length+shared.length;

  renderActiveList(unquoted);
  renderSharedList(shared);
  renderConfirmedList(confirmed);
}

/* ============ RENDER LISTS ============ */
function renderActiveList(queries){
  var el=document.getElementById('list-active');
  if(!queries.length){el.innerHTML='<div class="empty-state"><div class="empty-title">No active queries</div><div class="empty-sub">New client queries will appear here</div></div>';return;}
  el.innerHTML=queries.map(function(q){
    var r=q.trip_type==='multi'?'Multiple sectors':(q.departure||'-')+' → '+(q.destination||'-');
    var timer=q.expires_at?timeRemaining(q.expires_at):'';
    var claim=getClaimFor(q.id);
    var lockedBySomeoneElse=claim&&claim.claimed_by!==currentUser.id;
    var lockedByMe=claim&&claim.claimed_by===currentUser.id;
    var lockInfo='';
    if(lockedBySomeoneElse){
      var rem=claimRemaining(claim.expires_at);
      lockInfo='<div class="query-lock-info" data-query="'+q.id+'" data-expires="'+claim.expires_at+'">Locked by '+(claim.claimed_by_name||'teammate')+' · '+(rem||'expiring')+'</div>';
    }else if(lockedByMe){
      lockInfo='<div class="query-lock-info" style="color:var(--green-light);" data-query="'+q.id+'" data-expires="'+claim.expires_at+'">You have this locked · '+(claimRemaining(claim.expires_at)||'expiring')+'</div>';
    }
    var btnTxt=lockedBySomeoneElse?'Locked':'Submit quote';
    var btnDisabled=lockedBySomeoneElse?'disabled':'';
    return '<div class="query-card '+(lockedBySomeoneElse?'locked':'')+'">'
      +'<div class="query-top"><div><div class="query-route">'+r+'</div><div class="query-meta">'+fmtDate(q.flight_date)+(q.flight_time?' at '+q.flight_time:'')+'</div></div>'
      +(lockedBySomeoneElse?'<span class="badge badge-locked">Locked</span>':'<span class="badge badge-active">Active</span>')+'</div>'
      +'<div class="query-details"><div class="query-detail"><span>Pax</span>'+(q.passengers||'-')+'</div>'
      +(q.medivac?'<div class="query-detail"><span>Medivac</span>Yes</div>':'')
      +(q.pets?'<div class="query-detail"><span>Pets</span>Yes</div>':'')+'</div>'
      +(timer?'<div class="query-timer">Window: '+timer+' remaining</div>':'')
      +lockInfo
      +'<div class="query-actions"><button class="btn-sm btn-blue" '+btnDisabled+' onclick="openQuoteModal(\''+q.id+'\')">'+btnTxt+'</button></div></div>';
  }).join('');
}

function renderSharedList(quotes){
  var el=document.getElementById('list-shared');
  if(!quotes.length){var msg=isOwner()?'No quotes shared yet':'You haven\'t shared any quotes yet';el.innerHTML='<div class="empty-state"><div class="empty-title">'+msg+'</div></div>';return;}
  el.innerHTML=quotes.map(function(q){
    var query=q.queries||{};
    var route=query.trip_type==='multi'?'Multiple sectors':(query.departure||'-')+' → '+(query.destination||'-');
    var empBadge='';
    if(isOwner()){var u=lookupUser(q.submitted_by);empBadge=u?'<span class="badge badge-by">by '+(u.full_name||u.username)+'</span>':'';}
    return '<div class="query-card"><div class="query-top"><div><div class="query-route">'+route+empBadge+'</div><div class="query-meta">'+fmtDate(query.flight_date)+(query.flight_time?' at '+query.flight_time:'')+' · '+(q.aircraft_type||'')+(q.aircraft_registration?' ('+q.aircraft_registration+')':'')+'</div></div><span class="badge badge-shared">Shared</span></div><div class="query-details"><div class="query-detail"><span>Pax</span>'+(query.passengers||'-')+'</div><div class="query-detail"><span>Quote</span>'+fmtPrice(q.price)+'</div></div>'+(q.notes?'<div class="query-detail" style="margin-top:8px;"><span>Note</span>'+q.notes+'</div>':'')+'</div>';
  }).join('');
}

function renderConfirmedList(quotes){
  var el=document.getElementById('list-confirmed');
  if(!quotes.length){var msg=isOwner()?'No confirmed bookings yet':'No confirmed bookings for you yet';el.innerHTML='<div class="empty-state"><div class="empty-title">'+msg+'</div></div>';return;}
  el.innerHTML=quotes.map(function(q){
    var query=q.queries||{};
    var route=query.trip_type==='multi'?'Multiple sectors':(query.departure||'-')+' → '+(query.destination||'-');
    var empBadge='';
    if(isOwner()){var u=lookupUser(q.submitted_by);empBadge=u?'<span class="badge badge-by">by '+(u.full_name||u.username)+'</span>':'';}
    return '<div class="query-card"><div class="query-top"><div><div class="query-route">'+route+empBadge+'</div><div class="query-meta">'+fmtDate(query.flight_date)+(query.flight_time?' at '+query.flight_time:'')+' · '+(q.aircraft_type||'')+(q.aircraft_registration?' ('+q.aircraft_registration+')':'')+'</div></div><span class="badge badge-accepted">Confirmed</span></div><div class="query-details"><div class="query-detail"><span>Pax</span>'+(query.passengers||'-')+'</div><div class="query-detail"><span>Revenue</span>'+fmtPrice(q.price)+'</div></div></div>';
  }).join('');
}

function updateClaimTimers(){
  document.querySelectorAll('.query-lock-info').forEach(function(el){
    var exp=el.getAttribute('data-expires');if(!exp)return;
    var rem=claimRemaining(exp);
    if(!rem){el.remove();return;}
    var prefix=el.textContent.split(' · ')[0];
    el.textContent=prefix+' · '+rem;
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

/* ============ AIRCRAFT AVAILABILITY ============ */
function getBusyAircraftMap(){
  // map: aircraftId -> { date: { by:name, route:'A→B' } }
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
      map[q.aircraft_id][d]={by:u?(u.full_name||u.username):'operator',route:(query.departure||'-')+'→'+(query.destination||'-')};
    });
  });
  return map;
}

/* ============ QUOTE MODAL ============ */
async function openQuoteModal(queryId){
  // Block if AOP expired
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
  currentClaimId=claimRes.claim.id;
  var res=await sbFetch('queries?id=eq.'+queryId);
  var query=res.data&&res.data[0];if(!query){releaseClaim(currentClaimId);currentClaimId=null;return;}
  var route=query.trip_type==='multi'?'Multiple sectors':(query.departure||'—')+' → '+(query.destination||'—');
  document.getElementById('quote-query-info').innerHTML='<strong style="color:var(--text);">'+route+'</strong><br>'+fmtDate(query.flight_date)+(query.flight_time?' at '+query.flight_time:'')+' &nbsp;|&nbsp; '+query.passengers+' pax';

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
    if(conflict){anyConflict=true;return'<option value="'+a.id+'" data-type="'+a.aircraft_type+'" data-reg="'+a.registration+'" disabled>'+a.aircraft_type+'  |  '+a.registration+'  —  Booked on '+fmtDate(conflict)+'</option>';}
    if(docExpired){anyConflict=true;return'<option value="'+a.id+'" data-type="'+a.aircraft_type+'" data-reg="'+a.registration+'" disabled>'+a.aircraft_type+'  |  '+a.registration+'  —  Documents expired</option>';}
    return'<option value="'+a.id+'" data-type="'+a.aircraft_type+'" data-reg="'+a.registration+'">'+a.aircraft_type+'  |  '+a.registration+'</option>';
  }).join('');
  document.getElementById('quote-aircraft-help').textContent=anyConflict?'Some aircraft unavailable — booked or documents expired.':'';
  ['q-base','q-handling','q-crew','q-catering','q-notes'].forEach(function(id){document.getElementById(id).value='';});
  calcQuote();
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
  var qRes=await sbFetch('quotes',{method:'POST',prefer:'return=representation',body:{
    query_id:currentQueryId,operator_id:currentOperator.id,operator_name:currentOperator.company_name,
    aircraft_id:aircraftId,aircraft_type:at,aircraft_registration:ar,
    price:t,notes:notes,status:'shared',submitted_by:currentUser.id
  }});
  if(!qRes.ok){
    if(qRes.status===409){showToast('Your team already submitted a quote for this query.','error');}
    else{showToast('Failed to submit quote','error');}
    btn.disabled=false;btn.textContent='Share quote with client';
    if(currentClaimId)releaseClaim(currentClaimId);
    currentClaimId=null;
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
  showToast('Quote shared with client','success');
  await loadAllData();
  showSubtab('shared');
}

/* ============ DOCUMENT NOTIFICATIONS + BLOCKING ============ */
var acDocFiles = {}; // {cor: File, coa: File, arc: File, ins: File}

function daysUntil(dateStr){
  if(!dateStr) return null;
  var diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000*60*60*24));
}

function checkDocumentStatus(){
  if(!currentOperator) return;
  var notifications = [];
  var aopExpired = false;

  // Check AOP expiry
  var aopDays = daysUntil(currentOperator.aop_expiry_date);
  if(aopDays !== null){
    if(aopDays <= 0){
      aopExpired = true;
      notifications.push({type:'error', msg:'Your Air Operator\'s Permit has expired. You cannot accept new charters until you renew and upload your AOP.'});
    } else if(aopDays <= 30){
      notifications.push({type:'warn', msg:'Your Air Operator\'s Permit expires in '+aopDays+' day'+(aopDays===1?'':'s')+'. Please renew it before it lapses.'});
    }
  }

  // Check aircraft doc expiry
  var expiredAcDocs = [];
  var warningAcDocs = [];
  aircraftList.forEach(function(ac){
    var docs = [
      {name:'C of R', key:'cor_expiry', ac: ac},
      {name:'C of A', key:'coa_expiry', ac: ac},
      {name:'ARC',    key:'arc_expiry', ac: ac},
      {name:'Insurance', key:'insurance_expiry', ac: ac}
    ];
    docs.forEach(function(d){
      var days = daysUntil(ac[d.key]);
      if(days === null) return;
      if(days <= 0){
        expiredAcDocs.push(ac.registration+' '+d.name);
      } else if(days <= 30){
        warningAcDocs.push(ac.registration+' '+d.name+' ('+days+'d)');
      }
    });
  });

  if(expiredAcDocs.length){
    notifications.push({type:'error', msg:'Expired aircraft documents: '+expiredAcDocs.join(', ')+'. Affected aircraft cannot be used until renewed.'});
  }
  if(warningAcDocs.length){
    notifications.push({type:'warn', msg:'Expiring soon: '+warningAcDocs.join(', ')+'. Please renew before expiry.'});
  }

  // Render notification bar
  var bar = document.getElementById('doc-notification-bar');
  if(notifications.length){
    bar.style.display = 'block';
    bar.innerHTML = notifications.map(function(n){
      var bg = n.type==='error' ? '#fef2f2' : '#fffbeb';
      var col = n.type==='error' ? 'var(--red)' : 'var(--amber)';
      var bdr = n.type==='error' ? 'rgba(192,57,43,0.25)' : 'rgba(196,134,10,0.3)';
      return '<div style="background:'+bg+';border-bottom:0.5px solid '+bdr+';padding:10px 28px;font-size:12px;color:'+col+';display:flex;align-items:center;gap:10px;">'
        +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        +n.msg+'</div>';
    }).join('');
  } else {
    bar.style.display = 'none';
    bar.innerHTML = '';
  }

  // Block query submission if AOP expired
  var expiredBanner = document.getElementById('aop-expired-banner');
  if(aopExpired){
    expiredBanner.style.display = 'flex';
    document.getElementById('aop-expired-msg').textContent = 'Your Air Operator\'s Permit has expired. You cannot submit quotes until you upload a renewed AOP.';
  } else {
    expiredBanner.style.display = 'none';
  }
  return {aopExpired: aopExpired, expiredAcDocs: expiredAcDocs};
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
      var expiredDocs = [];
      [['C of R','cor_expiry'],['C of A','coa_expiry'],['ARC','arc_expiry'],['Insurance','insurance_expiry']].forEach(function(d){
        if(a[d[1]] && daysUntil(a[d[1]]) <= 0) expiredDocs.push(d[0]);
      });
      var warnDocs = [];
      [['C of R','cor_expiry'],['C of A','coa_expiry'],['ARC','arc_expiry'],['Insurance','insurance_expiry']].forEach(function(d){
        var days = daysUntil(a[d[1]]);
        if(days !== null && days > 0 && days <= 30) warnDocs.push(d[0]+' ('+days+'d)');
      });
      var removeBtn = isOwner() ? '<button class="aircraft-remove" onclick="removeAircraft(\''+a.id+'\')">&times;</button>' : '';
      var statusHtml = '';
      if(expiredDocs.length) statusHtml = '<div style="font-size:10px;color:var(--red);margin-top:6px;">⚠ Expired: '+expiredDocs.join(', ')+'</div>';
      else if(warnDocs.length) statusHtml = '<div style="font-size:10px;color:var(--amber);margin-top:6px;">⚠ Expiring: '+warnDocs.join(', ')+'</div>';
      return '<div class="aircraft-card">'+removeBtn+'<div class="aircraft-type">'+a.aircraft_type+'</div><div class="aircraft-reg">'+a.registration+'</div>'+(a.seats?'<div class="aircraft-seats">'+a.seats+' seats</div>':'')+statusHtml+'</div>';
    }).join('');
  }

  if(pending.length){
    html += pending.map(function(a){
      return '<div class="aircraft-card" style="opacity:.65;border-style:dashed;"><div style="position:absolute;top:8px;right:8px;font-size:9px;background:rgba(196,134,10,0.15);color:var(--gold);padding:2px 6px;border-radius:3px;text-transform:uppercase;letter-spacing:.05em;">Under review</div><div class="aircraft-type">'+a.aircraft_type+'</div><div class="aircraft-reg">'+a.registration+'</div>'+(a.seats?'<div class="aircraft-seats">'+a.seats+' seats</div>':'')+'<div style="font-size:11px;color:var(--text-tertiary);margin-top:6px;">Documents submitted — awaiting SkyVayu approval</div></div>';
    }).join('');
  }

  if(rejected.length){
    html += rejected.map(function(a){
      return '<div class="aircraft-card" style="border-color:rgba(192,57,43,0.3);"><div class="aircraft-type">'+a.aircraft_type+'</div><div class="aircraft-reg">'+a.registration+'</div><div style="font-size:11px;color:var(--red);margin-top:6px;">Documents rejected'+(a.doc_rejection_reason?' — '+a.doc_rejection_reason:'')+'</div><button class="btn-sm btn-outline-sm" style="margin-top:8px;font-size:11px;height:28px;" onclick="resubmitAircraft(\''+a.id+'\')">Re-upload documents</button></div>';
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
  if(nameEl){ nameEl.textContent = '✓ '+file.name; nameEl.style.color='var(--gold)'; }
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
    headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':file.type,'x-upsert':'true'},
    body: file
  });
  if(!res.ok) return null;
  return {url: SUPABASE_URL+'/storage/v1/object/operator-documents/'+path, name: file.name};
}

async function saveAircraft(){
  var type = document.getElementById('ac-type').value.trim();
  var reg  = document.getElementById('ac-reg').value.trim();
  var seats= parseInt(document.getElementById('ac-seats').value)||null;
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
    var key = k==='ins'?'ins':'arc'===k?'arc':k;
    return !document.getElementById(k+'-expiry').value;
  });
  if(missingExpiry.length){errEl.textContent='Please enter expiry dates for all documents.';errEl.style.display='block';return;}

  var btn = document.getElementById('btn-save-aircraft');
  btn.disabled=true;btn.textContent='Uploading...';

  // Create aircraft record first (inactive, pending)
  var acRes = await sbFetch('aircraft',{method:'POST',prefer:'return=representation',body:{
    operator_id:currentOperator.id, aircraft_type:type, registration:reg, seats:seats,
    is_active:false, doc_status:'pending'
  }});
  if(!acRes.ok||!acRes.data||!acRes.data.length){
    errEl.textContent='Failed to save aircraft. Try again.';errEl.style.display='block';
    btn.disabled=false;btn.textContent='Submit for review';return;
  }
  var acId = acRes.data[0].id;

  // Upload all 4 docs
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

  // Save URLs + expiry dates
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
  // For now open the add modal — in future could pre-fill
  openAircraftModal();
  showToast('Please re-upload your documents and submit again','success');
}

/* ============ ROSTER (calendar grid) ============ */
async function loadRoster(){
  if(!aircraftList.length)await loadFleet();
  var container=document.getElementById('roster-grid');
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
    html+='<div class="roster-cell-ac"><div class="ac-type">'+ac.aircraft_type+'</div><div class="ac-reg">'+ac.registration+'</div></div>';
    dates.forEach(function(d,idx){
      var iso=toIso(d);
      var cls='roster-cell'+(idx===0?' today':'');
      var booking=busyMap[ac.id]&&busyMap[ac.id][iso];
      var cellContent='';
      if(booking){
        // determine if this is current user's booking (for employee view)
        var isMine=false;
        if(!isOwner()){
          // find the quote to check ownership
          var mine=allMyOperatorQuotes.find(function(q){return q.aircraft_id===ac.id&&q.queries&&(q.queries.flight_date===iso||q.queries.return_date===iso)&&q.submitted_by===currentUser.id;});
          isMine=!!mine;
        }
        var bClass=isOwner()?'booking':(isMine?'booking mine':'booking other-emp');
        var bLabel=isOwner()?booking.by:(isMine?'You':'—');
        var routeTxt=isOwner()||isMine?booking.route:'•';
        cellContent='<div class="'+bClass+'" title="'+booking.route+' · by '+booking.by+'"><span class="b-route">'+routeTxt+'</span><span class="b-emp">'+bLabel+'</span></div>';
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

  // Aggregate stats per employee
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
    var lastSeen=e.last_login?new Date(e.last_login).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';
    var isExpanded=expandedEmployeeId===e.id;
    var pendingBadge=e.is_approved===false?'<span style="font-size:9px;background:rgba(196,134,10,0.15);color:var(--gold);padding:1px 6px;border-radius:3px;margin-left:6px;text-transform:uppercase;">Pending approval</span>':'';
    var html='<tr onclick="toggleEmployee(\''+e.id+'\')"><td><span class="emp-avatar">'+ini+'</span><b>'+(e.full_name||e.username)+'</b>'+pendingBadge+'<br><span style="font-size:11px;color:var(--text-tertiary);">@'+e.username+(e.employee_id?' · ID: '+e.employee_id:'')+'</span></td>'
      +'<td>'+s.shared+'</td><td>'+s.confirmed+'</td>'
      +'<td style="color:'+(online?'var(--green-light)':'var(--text-tertiary)')+';">'+(online?'Online':lastSeen)+'</td>'
      +'<td>'+fmtPriceShort(s.revenue)+'</td></tr>';
    if(isExpanded){
      var activityHtml=s.activity.slice(0,15).map(function(q){
        var qq=q.queries||{};
        var route=(qq.departure||'-')+'→'+(qq.destination||'-');
        var when=new Date(q.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
        var statusLabel=q.status==='shared'?'shared quote':(q.status==='accepted'||q.status==='confirmed'||q.status==='booked'?'won booking':q.status);
        return'<div class="emp-log-row"><span class="emp-log-time">'+when+'</span><span class="emp-log-action"><b>'+statusLabel+'</b> · '+route+' · '+fmtPrice(q.price)+' · '+(q.aircraft_type||'')+'</span></div>';
      }).join('');
      if(!s.activity.length)activityHtml='<div style="color:var(--text-tertiary);font-size:12px;padding:8px 0;">No activity yet.</div>';
      var deactivateBtn=e.is_active?'<button class="btn-sm btn-danger-sm" onclick="event.stopPropagation();toggleEmployeeActive(\''+e.id+'\',false)">Deactivate account</button>':'<button class="btn-sm btn-outline-sm" onclick="event.stopPropagation();toggleEmployeeActive(\''+e.id+'\',true)">Reactivate</button>';
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
    delta='<div class="rev-delta '+cls+'">'+(pct>=0?'▲ ':'▼ ')+Math.abs(pct).toFixed(1)+'% vs last month</div>';
  }

  // By employee
  var byEmp={};
  confirmed.forEach(function(q){
    var id=q.submitted_by||'unknown';
    if(!byEmp[id])byEmp[id]={name:'',count:0,rev:0};
    var u=lookupUser(id);
    byEmp[id].name=u?(u.full_name||u.username):'—';
    byEmp[id].count++;
    byEmp[id].rev+=Number(q.price||0);
  });
  var empRows=Object.keys(byEmp).map(function(k){return byEmp[k];}).sort(function(a,b){return b.rev-a.rev;}).map(function(r){
    return'<tr><td><b>'+r.name+'</b></td><td>'+r.count+'</td><td>'+fmtPrice(Math.round(r.rev/r.count))+'</td><td><b>'+fmtPrice(r.rev)+'</b></td></tr>';
  }).join('');

  // By aircraft
  var byAc={};
  confirmed.forEach(function(q){
    var id=q.aircraft_id||'unknown';
    if(!byAc[id])byAc[id]={name:q.aircraft_type||'—',reg:q.aircraft_registration||'',count:0,rev:0};
    byAc[id].count++;
    byAc[id].rev+=Number(q.price||0);
  });
  var acRows=Object.keys(byAc).map(function(k){return byAc[k];}).sort(function(a,b){return b.rev-a.rev;}).map(function(r){
    return'<tr><td><b>'+r.name+'</b> <span style="color:var(--text-tertiary);font-size:11px;font-family:monospace;">'+r.reg+'</span></td><td>'+r.count+'</td><td>'+fmtPrice(Math.round(r.rev/r.count))+'</td><td><b>'+fmtPrice(r.rev)+'</b></td></tr>';
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
  if(file.size > 10 * 1024 * 1024){
    alert('File is too large. Maximum size is 10MB.');
    input.value = ''; return;
  }
  selectedAopFile = file;
  document.getElementById('aop-file-name').textContent = '✓ ' + file.name;
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
      'Authorization': 'Bearer ' + SUPABASE_KEY,
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
    company_name:company,owner_name:name,owner_phone:phone,owner_email:email,approval_status:'pending'
  }});
  if(!opRes.ok||!opRes.data||!opRes.data.length){
    errEl.textContent='Registration failed. Please try again.';errEl.classList.add('show');
    btn.disabled=false;btn.textContent='Submit application';return;
  }
  var opId = opRes.data[0].id;

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
  closeModal('register-modal');
  document.getElementById('page-login').style.display='none';
  document.getElementById('page-pending').style.display='flex';
}

/* ============ INIT ============ */
document.querySelectorAll('.modal-overlay').forEach(function(el){el.addEventListener('click',function(e){if(e.target===el){if(el.id==='quote-modal')closeQuoteModal();else el.classList.remove('open');}});});
window.addEventListener('beforeunload',function(){if(currentClaimId){navigator.sendBeacon(SUPABASE_URL+'/rest/v1/query_claims?id=eq.'+currentClaimId,new Blob([JSON.stringify({})],{type:'application/json'}));}});
document.getElementById('page-login').style.display='flex';

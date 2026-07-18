/* — SkyVayu — Google Auth Module — */
/* Uses Supabase JS SDK v2 (loaded via CDN in HTML)        */
/* Exposes: signInWithGoogle(), signOut(), getSession()    */

(function () {
  'use strict';

  /* —— Supabase client (singleton) ————————————————————— */
  var _sb = null;

  function getClient() {
    if (_sb) return _sb;
    /* Re-use any client already created by another script */
    if (window._svSupabase) { _sb = window._svSupabase; return _sb; }
    var url = SKYVAYU_CONFIG.supabaseUrl;
    var key = SKYVAYU_CONFIG.supabaseKey;
    _sb = window.supabase.createClient(url, key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage
      }
    });
    window._svSupabase = _sb;
    return _sb;
  }

  /* —— Update nav UI ————————————————————————————————————— */
  function updateAuthUI(session) {
    var user = session ? session.user : null;
    var loginBtn = document.getElementById('sv-login-btn');
    var userChip = document.getElementById('sv-user-chip');
    var userName = document.getElementById('sv-user-name');
    if (user) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userChip) userChip.style.display = 'flex';
      if (userName) {
        var display = user.user_metadata && user.user_metadata.full_name
          ? user.user_metadata.full_name.split(' ')[0]
          : user.email.split('@')[0];
        userName.textContent = display;
      }
    } else {
      if (loginBtn) loginBtn.style.display = '';
      if (userChip) userChip.style.display = 'none';
    }
  }

  /* —— Kick off Google OAuth ————————————————————————————— */
  window.signInWithGoogle = function () {
    var sb = getClient();
    sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    }).then(function (res) {
      if (res.error) {
        console.error('Google sign-in error:', res.error.message);
        if (typeof showToast === 'function') {
          showToast('Sign-in failed: ' + res.error.message, 'error');
        }
      }
    });
  };

  /* —— Sign out ————————————————————————————————————————— */
  window.signOut = function () {
    var sb = getClient();
    sb.auth.signOut().then(function () {
      updateAuthUI(null);
      // Clear active quote request data on sign-out
      ['sv_query_id','sv_query','sv_query_ts','sv_banner_dismissed'].forEach(function(k){ sessionStorage.removeItem(k); });
      var banner = document.getElementById('resume-banner');
      if (banner) { banner.style.display = 'none'; document.body.style.paddingTop = ''; }
      if (typeof showToast === 'function') {
        showToast('Signed out successfully.', 'success');
      }
    });
  };

  /* —— Get current session ——————————————————————————————— */
  window.getSession = function (cb) {
    var sb = getClient();
    sb.auth.getSession().then(function (res) {
      cb(res.data.session);
    });
  };

  /* —— Persist query data across OAuth redirect ————————— */
  window.stashPendingQuery = function (queryData) {
    try {
      sessionStorage.setItem('sv_pending_query', JSON.stringify(queryData));
    } catch (e) {}
  };

  window.popPendingQuery = function () {
    try {
      var raw = sessionStorage.getItem('sv_pending_query');
      if (raw) {
        sessionStorage.removeItem('sv_pending_query');
        return JSON.parse(raw);
      }
    } catch (e) {}
    return null;
  };

  /* —— Initialise ————————————————————————————————————————— */
  function init() {
    var sb = getClient();

    sb.auth.onAuthStateChange(function (event, session) {
      updateAuthUI(session);
      if (event === 'SIGNED_IN') {
        /* Clean up the code/hash from the URL without reloading */
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        /* — Upsert client profile on sign-in — */
        getClient().from('profiles').upsert({
          id: session.user.id,
          full_name: session.user.user_metadata.full_name || '',
          email: session.user.email || ''
        }, { onConflict: 'id' }).then(function(res) {
          if (res.error) console.error('profile upsert failed:', res.error.message);
        });
        var pending = window.popPendingQuery();
if (pending && typeof saveQueryToSupabase === 'function') {
                pending.user_id = session.user.id;
                var userEmail = session.user.email || '';
                var accessFn = typeof checkAndRecordUserAccess === 'function' ? checkAndRecordUserAccess : (typeof window.checkAndRecordUserAccess === 'function' ? window.checkAndRecordUserAccess : null);
                if (accessFn) {
                                  accessFn(session.user.id, userEmail).then(function(access) {
                                                      if (!access.allowed && access.redirect === 'register') {
                                                                            sessionStorage.removeItem('sv_query');
                                                                            var regUrl = 'register.html?reason=membership_required&email=' + encodeURIComponent(userEmail);
                                                                            window.location.href = regUrl;
                                                      } else {
                                                                            saveQueryToSupabase(pending).then(function () {
                                                                                                    window.location.href = 'results.html';
                                                                            }).catch(function (err) {
                                                                                                    console.error('saveQuery failed after OAuth:', err);
                                                                                                    window.location.href = 'results.html';
                                                                            });
                                                      }
                                  }).catch(function(err) {
                                                      console.error('access check failed:', err);
                                                      saveQueryToSupabase(pending).then(function () { window.location.href = 'results.html'; }).catch(function() { window.location.href = 'results.html'; });
                                  });
                } else {
                                  saveQueryToSupabase(pending).then(function () {
                                                      window.location.href = 'results.html';
                                  }).catch(function (err) {
                                                      console.error('saveQuery failed after OAuth:', err);
                                                      window.location.href = 'results.html';
                                  });
                }
}
      }
      if (event === 'SIGNED_OUT') {
        ['sv_query_id','sv_query','sv_query_ts','sv_banner_dismissed'].forEach(function(k){ sessionStorage.removeItem(k); });
        var banner = document.getElementById('resume-banner');
        if (banner) { banner.style.display = 'none'; document.body.style.paddingTop = ''; }
      }
    });

    /* Sync UI for users who already have a session in storage */
    sb.auth.getSession().then(function (res) {
      if (res.data && res.data.session) {
        updateAuthUI(res.data.session);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());

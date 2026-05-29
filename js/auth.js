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
        flowType: 'implicit',
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
        redirectTo: 'https://www.skyvayu.com'
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
    /* Debug — log exactly what's in the URL when page loads */
    console.log('auth.js init — URL:', window.location.href);
    console.log('auth.js init — hash:', window.location.hash);
    console.log('auth.js init — search:', window.location.search);

    var sb = getClient();

    /* onAuthStateChange handles SIGNED_IN after the PKCE exchange completes */
    sb.auth.onAuthStateChange(function (event, session) {
      console.log('Auth event:', event, session ? session.user.email : 'no session');
      updateAuthUI(session);
      if (event === 'SIGNED_IN') {
        /* Clean up the code/hash from the URL without reloading */
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        var pending = window.popPendingQuery();
        if (pending && typeof saveQueryToSupabase === 'function') {
          saveQueryToSupabase(pending).then(function () {
            window.location.href = 'results.html';
          }).catch(function (err) {
            console.error('saveQuery failed after OAuth:', err);
            window.location.href = 'results.html';
          });
        }
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

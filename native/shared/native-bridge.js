/* =========================================================================
   NODALIS - NATIVE BRIDGE
   =========================================================================
   Injected into index.html at build time, before any of the app's code.
   In a normal browser it does nothing at all (first check below), so the
   website on GitHub Pages behaves exactly as before.

   Inside the Windows app (Electron) or the Android / iOS app (Capacitor)
   it fixes the handful of things a browser does that an app shell does not:

     1. Tells Nodalis it is already installed -> no "Install app" prompts.
     2. Windows: hides dictation (Electron's speech engine needs a Google
        key and always fails - better hidden than broken).
     3. Mobile: external links open in the phone's browser, not inside
        the app.
     4. Mobile: exports / backups / QR images are saved to
        Documents/Nodalis on the phone, with a Share button.
     5. Mobile: the app's Share button uses the phone's share sheet.
     6. Mobile: reminders become real phone notifications.
   ========================================================================= */
(function () {
  'use strict';

  var ua = navigator.userAgent || '';
  var isElectron = /Electron\//.test(ua);
  var C = window.Capacitor;
  var isCap = !!(C && (typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.isNative));
  if (!isElectron && !isCap) return;            // plain browser: change nothing

  var platform = isElectron ? 'windows' : (C.getPlatform ? C.getPlatform() : 'mobile');
  window.NODALIS_NATIVE = { platform: platform, electron: isElectron, capacitor: isCap };
  document.documentElement.setAttribute('data-native', platform);

  /* ---------------------------------------------- 1. already installed */
  try {
    Object.defineProperty(window, '__ndInstalled', {
      configurable: true,
      get: function () { return true; },
      set: function () {}
    });
  } catch (e) {}

  if (window.matchMedia) {
    var realMatch = window.matchMedia.bind(window);
    window.matchMedia = function (q) {
      var r = realMatch(q);
      if (/display-mode\s*:\s*standalone/i.test(String(q))) {
        return {
          matches: true, media: r.media, onchange: null,
          addListener: function () {}, removeListener: function () {},
          addEventListener: function () {}, removeEventListener: function () {},
          dispatchEvent: function () { return false; }
        };
      }
      return r;
    };
  }

  /* ------------------------------------------- 2. Windows: speech fix */
  if (isElectron) {
    try { window.SpeechRecognition = undefined; } catch (e) {}
    try { window.webkitSpeechRecognition = undefined; } catch (e) {}
    return;                                     // everything below is mobile-only
  }

  var P = C.Plugins || {};

  /* --------------------------------------------------- small toast */
  function toast(msg, actionLabel, action) {
    function show() {
      var t = document.createElement('div');
      t.setAttribute('role', 'status');
      t.style.cssText = 'position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));' +
        'transform:translateX(-50%);z-index:2147483647;max-width:92vw;display:flex;gap:12px;align-items:center;' +
        'background:#1f1d2b;color:#fff;font:500 14px/1.35 system-ui,sans-serif;padding:12px 14px;' +
        'border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.28)';
      var s = document.createElement('span');
      s.textContent = msg;
      t.appendChild(s);
      if (actionLabel && action) {
        var b = document.createElement('button');
        b.textContent = actionLabel;
        b.style.cssText = 'background:#6c5ce7;color:#fff;border:0;border-radius:8px;padding:7px 12px;font:600 13px system-ui,sans-serif';
        b.onclick = function () { action(); t.remove(); };
        t.appendChild(b);
      }
      document.body.appendChild(t);
      setTimeout(function () { if (t.parentNode) t.remove(); }, 6000);
    }
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }

  /* ------------------------------------ 3. external links -> browser */
  var realOpen = window.open;
  window.open = function (url) {
    try {
      var u = new URL(url, location.href);
      if (/^https?:$/.test(u.protocol) && u.origin !== location.origin) {
        if (P.Browser) P.Browser.open({ url: u.href });
        else location.href = u.href;          // Capacitor hands this to the system
        return { closed: false, close: function () {}, focus: function () {} };
      }
    } catch (e) {}
    return realOpen.apply(window, arguments);
  };

  /* --------------------------------- 4. downloads -> saved on phone */
  var blobs = new Map();
  var realCreate = URL.createObjectURL;
  var realRevoke = URL.revokeObjectURL;
  URL.createObjectURL = function (obj) {
    var u = realCreate.call(URL, obj);
    if (obj instanceof Blob) blobs.set(u, obj);
    return u;
  };
  URL.revokeObjectURL = function (u) {
    // The app revokes right after click(); keep the data long enough to save it.
    setTimeout(function () { blobs.delete(u); try { realRevoke.call(URL, u); } catch (e) {} }, 120000);
  };

  function getBlob(href) {
    if (blobs.has(href)) return Promise.resolve(blobs.get(href));
    return fetch(href).then(function (r) { return r.blob(); });
  }
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); res(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function cleanName(n) {
    n = String(n || '').replace(/[\\/:*?"<>|]+/g, '_').trim();
    return n || ('nodalis-export-' + Date.now());
  }
  function shareFile(uri, name) {
    if (!P.Share) return Promise.resolve();
    return P.Share.share({ title: name, files: [uri], dialogTitle: 'Send ' + name });
  }

  function nativeSave(href, rawName) {
    if (!P.Filesystem) return false;
    var name = cleanName(rawName);
    getBlob(href).then(toBase64).then(function (b64) {
      // First choice: a real file the user can find later (Documents/Nodalis).
      return P.Filesystem.writeFile({
        path: 'Nodalis/' + name, data: b64, directory: 'DOCUMENTS', recursive: true
      }).then(function (res) {
        toast('Saved to Documents/Nodalis/' + name, 'Share', function () {
          shareFile(res.uri, name).catch(function () {});
        });
      }, function () {
        // Older phones without storage permission: go straight to the share sheet.
        return P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' })
          .then(function (res) { return shareFile(res.uri, name); });
      });
    }).catch(function (err) {
      var m = String((err && err.message) || err || '');
      if (/cancel/i.test(m)) return;
      console.warn('[Nodalis native] save failed', err);
      toast('Could not save the file: ' + m);
    });
    return true;
  }

  function handleAnchor(a) {
    if (!a || !a.hasAttribute || !a.hasAttribute('download')) return false;
    var href = a.href || '';
    if (!/^(blob:|data:)/i.test(href)) return false;
    return nativeSave(href, a.getAttribute('download') || a.download);
  }

  var realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (handleAnchor(this)) return;
    return realClick.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a && handleAnchor(a)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  /* ---------------------------------- 5. share -> phone share sheet */
  if (!navigator.share && P.Share) {
    try {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: function (d) {
          d = d || {};
          return P.Share.share({ title: d.title, text: d.text, url: d.url })
            .then(function () {}, function () {
              throw new DOMException('Share canceled', 'AbortError');
            });
        }
      });
    } catch (e) {}
  }

  /* ------------------------- 6. reminders -> real phone notifications */
  if (!('Notification' in window) && P.LocalNotifications) {
    var LN = P.LocalNotifications;
    var perm = 'default';
    var map = function (r) {
      var d = r && r.display;
      return d === 'granted' ? 'granted' : (d === 'denied' ? 'denied' : 'default');
    };
    LN.checkPermissions().then(function (r) { perm = map(r); }).catch(function () {});

    var NativeNotification = function (title, opts) {
      opts = opts || {};
      var id = Math.floor(Math.random() * 2000000000);
      var self = this;
      this.title = String(title || 'Nodalis');
      this.body = String(opts.body || '');
      this.tag = opts.tag || '';
      this.onclick = null; this.onclose = null; this.onshow = null; this.onerror = null;
      this.close = function () { LN.cancel({ notifications: [{ id: id }] }).catch(function () {}); };
      this.addEventListener = function (type, fn) { self['on' + type] = fn; };
      this.removeEventListener = function () {};
      LN.schedule({ notifications: [{ id: id, title: this.title, body: this.body }] })
        .then(function () { if (self.onshow) self.onshow(); })
        .catch(function (e) { if (self.onerror) self.onerror(e); });
    };
    Object.defineProperty(NativeNotification, 'permission', { get: function () { return perm; } });
    NativeNotification.requestPermission = function (cb) {
      return LN.requestPermissions().then(function (r) {
        perm = map(r) === 'granted' ? 'granted' : 'denied';
        if (typeof cb === 'function') cb(perm);
        return perm;
      });
    };
    window.Notification = NativeNotification;
  }
})();

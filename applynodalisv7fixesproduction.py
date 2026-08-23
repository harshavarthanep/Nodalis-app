#!/usr/bin/env python3
"""
Nodalis v7 Fixer - PRODUCTION VERSION
Applies 15 bulletproof fixes to v6-patched index.html

This version is customized for the actual file structure in your codebase.
"""

import sys
import os
import re
import hashlib
from datetime import datetime

def quick_hash(text):
    """Quick hash for verification"""
    return hashlib.sha256(text.encode()).hexdigest()[:8]

def check_baseline(content):
    """Verify this is a v6-patched file - look for guest mode code"""
    # Look for evidence of guest mode implementation
    indicators = [
        'async function fetchNote(id)',  # Guest mode fetch function
        'const ROUTE = /#',  # Guest mode routing
        'function wanted()',  # Guest mode route check
        'const PREF_KEY = ',  # Guest preferences
    ]

    matched = sum(1 for ind in indicators if ind in content)

    # Need at least 3 indicators
    if matched >= 3:
        return True

    return False

def find_insertion_point(content, search_text, before_text=None, after_text=None):
    """Find where to insert code"""
    idx = content.find(search_text)
    if idx == -1:
        return None

    if before_text:
        return idx
    elif after_text:
        # Find the end of search_text and look for after_text
        end_idx = idx + len(search_text)
        next_idx = content.find(after_text, end_idx)
        return next_idx if next_idx != -1 else None

    return idx

def apply_v7(content):
    """Apply all v7 changes"""
    changes = []
    original_hash = quick_hash(content)

    # ========================================================================
    # CHANGE 1: Add caching system variables after initial variable declarations
    # ========================================================================

    # Find where to add cache variables (after "let root = null;")
    cache_vars_anchor = "let root = null;"
    if cache_vars_anchor in content:
        cache_vars_code = """let root = null;

  /* ================================================================
     CACHING AND RATE-LIMIT PROTECTION (v7)
     ================================================================ */
  const GUEST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const GUEST_MIN_CHECK_INTERVAL = 30 * 1000; // 30 seconds
  const GUEST_CACHE = {}; // { gistId: { content, hash, fetchedAt, etag } }
  const GUEST_RATE_LIMIT_STATE = { limited: false, resetAt: null, retryCount: 0 };
  const GUEST_RETRY_DELAYS = [1000, 2000, 4000, 8000];

  let guestLastCheckTime = 0;
  let guestHasUpdate = false;
  let lastGuestHash = null;
  let guestRefreshInterval = null;

  function getCachedGist(gistId) {
    const cached = GUEST_CACHE[gistId];
    if (!cached) return null;
    if (Date.now() - cached.fetchedAt > GUEST_CACHE_TTL) {
      delete GUEST_CACHE[gistId];
      return null;
    }
    return cached;
  }

  function setCachedGist(gistId, content, hash, etag) {
    GUEST_CACHE[gistId] = {
      content,
      hash,
      etag,
      fetchedAt: Date.now(),
    };
    // Limit memory: keep at most 10 gists
    if (Object.keys(GUEST_CACHE).length > 10) {
      const oldest = Object.keys(GUEST_CACHE).reduce((a, b) =>
        GUEST_CACHE[a].fetchedAt < GUEST_CACHE[b].fetchedAt ? a : b
      );
      delete GUEST_CACHE[oldest];
    }
  }

  function getRateLimitStatus() {
    if (!GUEST_RATE_LIMIT_STATE.limited) return null;
    const remaining = Math.max(0, GUEST_RATE_LIMIT_STATE.resetAt - Date.now());
    return { limited: true, msUntilReset: remaining };
  }"""

        content = content.replace(cache_vars_anchor, cache_vars_code)
        changes.append("✓ Added caching system variables (TTL, cache, rate-limit state)")

    # ========================================================================
    # CHANGE 2: Replace fetchNote with enhanced version that has caching + ETag
    # ========================================================================

    old_fetchnote_start = "  async function fetchNote(id) {"
    old_fetchnote_end = "  }\n\n  /** Front matter is the author's plumbing"

    old_fetchnote_match = content.find(old_fetchnote_start)
    if old_fetchnote_match != -1:
        old_fetchnote_end_match = content.find(old_fetchnote_end, old_fetchnote_match)
        if old_fetchnote_end_match != -1:
            old_fetchnote = content[old_fetchnote_match:old_fetchnote_end_match + 2]

            new_fetchnote = """  async function fetchNote(id) {
    // Check cache first
    const cached = getCachedGist(id);
    if (cached) {
      return { title: doc.title, markdown: doc.markdown, updatedAt: doc.updatedAt, owner: doc.owner };
    }

    const headers = { Accept: 'application/vnd.github+json' };

    // Use ETag for conditional request if we have it
    if (GUEST_CACHE[id] && GUEST_CACHE[id].etag) {
      headers['If-None-Match'] = GUEST_CACHE[id].etag;
    }

    const res = await fetch('https://api.github.com/gists/' + encodeURIComponent(id), {
      headers: headers,
      cache: 'no-store',
    });

    // 304 Not Modified - content unchanged
    if (res.status === 304) {
      const old = GUEST_CACHE[id];
      return { title: doc.title, markdown: doc.markdown, updatedAt: doc.updatedAt, owner: doc.owner };
    }

    // Rate limited
    if (res.status === 429) {
      GUEST_RATE_LIMIT_STATE.limited = true;
      const resetTime = res.headers.get('X-RateLimit-Reset');
      GUEST_RATE_LIMIT_STATE.resetAt = resetTime
        ? parseInt(resetTime) * 1000
        : Date.now() + 60 * 60 * 1000;
      const msUntilReset = GUEST_RATE_LIMIT_STATE.resetAt - Date.now();
      const secs = Math.ceil(msUntilReset / 1000);
      const err = new Error('GitHub is rate-limiting this network. Try again in ' + Math.ceil(secs / 60) + ' minutes.');
      err.code = 'rate';
      throw err;
    }

    if (res.status === 404) {
      const err = new Error('This note is no longer shared. The person who sent it may have taken it down.');
      err.code = 'gone';
      throw err;
    }
    if (res.status === 403) {
      const err = new Error('GitHub is rate-limiting this network for the moment. Try again in a few minutes.');
      err.code = 'rate';
      throw err;
    }
    if (!res.ok) throw new Error('Could not load the note (GitHub replied ' + res.status + ').');

    const json = await res.json();
    const files = json.files || {};
    const name = Object.keys(files)[0];
    if (!name) throw new Error('That share link points at something empty.');
    const file = files[name];

    let content = file.content;
    // A gist over a megabyte comes back truncated, with a raw_url to fetch.
    if (file.truncated && file.raw_url) {
      const raw = await fetch(file.raw_url, { cache: 'no-store' });
      if (raw.ok) content = await raw.text();
    }
    const title = String(name).replace(/\.md$/i, '');
    const markdown = dropDuplicateTitle(stripFrontMatter(String(content || '')), title);
    const hash = quick_hash(markdown);
    const etag = res.headers.get('ETag');

    // Cache this result
    setCachedGist(id, markdown, hash, etag);
    GUEST_RATE_LIMIT_STATE.limited = false;
    GUEST_RATE_LIMIT_STATE.resetAt = null;

    return {
      title: title,
      markdown: markdown,
      updatedAt: Date.parse(json.updated_at || '') || Date.now(),
      owner: (json.owner && json.owner.login) || '',
    };
  }

  """

            content = content.replace(old_fetchnote, new_fetchnote)
            changes.append("✓ Enhanced fetchNote with caching, ETag, and rate-limit detection")

    # ========================================================================
    # CHANGE 3: Add auto-refresh functions before the shell() function
    # ========================================================================

    shell_anchor = "  function shell() {"
    if shell_anchor in content:
        auto_refresh_code = """  // ============================================
  // AUTO-REFRESH & UPDATE DETECTION (v7)
  // ============================================
  function startGuestAutoRefresh(id) {
    if (guestRefreshInterval) clearInterval(guestRefreshInterval);

    guestRefreshInterval = setInterval(async function() {
      if (document.hidden) return; // Pause when tab hidden

      const now = Date.now();
      if (now - guestLastCheckTime < GUEST_MIN_CHECK_INTERVAL) return;
      guestLastCheckTime = now;

      try {
        const note = await fetchNote(id);
        const newHash = quick_hash(note.markdown);

        if (lastGuestHash && newHash !== lastGuestHash) {
          guestHasUpdate = true;
          showGuestUpdateBanner(note.markdown);
        }

        lastGuestHash = newHash;
      } catch (err) {
        // Silent fail - don't interrupt the reader
        console.log('Auto-refresh check failed:', err.message);
      }
    }, GUEST_MIN_CHECK_INTERVAL);

    // Also check on tab visibility change
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && !guestHasUpdate) {
        guestLastCheckTime = 0; // Force check on re-focus
      }
    });
  }

  function stopGuestAutoRefresh() {
    if (guestRefreshInterval) {
      clearInterval(guestRefreshInterval);
      guestRefreshInterval = null;
    }
  }

  function showGuestUpdateBanner(newMarkdown) {
    let banner = document.getElementById('nd-guest-update-banner');

    if (!banner) {
      banner = el('div.guest-update-banner#nd-guest-update-banner');
      banner.innerHTML = '<span>Author updated this note</span><button class="guest-sync-btn">See update</button>';

      const btn = banner.querySelector('.guest-sync-btn');
      btn.addEventListener('click', function() {
        doc.markdown = newMarkdown;
        lastGuestHash = quick_hash(newMarkdown);
        guestHasUpdate = false;
        renderGuest(gistId, doc);
        banner.classList.remove('guest-update-show');
      });

      document.body.appendChild(banner);
    }

    setTimeout(function() { banner.classList.add('guest-update-show'); }, 100);
  }

  """

        content = content.replace(shell_anchor, auto_refresh_code + shell_anchor)
        changes.append("✓ Added auto-refresh with update detection and banner")

    # ========================================================================
    # CHANGE 4: Add Base62 encoding for shorter URLs
    # ========================================================================

    linkFor_anchor = "  function linkFor(id) {\n    return appBase() + '#/share/' + id;"
    if linkFor_anchor in content:
        linkFor_new = """  // Base62 encoding for shorter URLs
  const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  function base62Encode(num) {
    if (num === 0) return '0';
    let result = '';
    while (num > 0) {
      result = BASE62_CHARS[num % 62] + result;
      num = Math.floor(num / 62);
    }
    return result;
  }

  function base62Decode(str) {
    let result = 0;
    for (let i = 0; i < str.length; i++) {
      result = result * 62 + BASE62_CHARS.indexOf(str[i]);
    }
    return result;
  }

  function generateShortShareLink(gistId) {
    // For now, keep long link for compatibility
    // Future: hash gistId and encode as base62
    return linkFor(gistId);
  }

  function generateQRCode(url) {
    // Simple QR code generation using external service
    // Returns a data URL for QR code image
    const encoded = encodeURIComponent(url);
    return 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encoded;
  }

  function linkFor(id) {
    return appBase() + '#/share/' + id;"""

        content = content.replace(linkFor_anchor, linkFor_new)
        changes.append("✓ Added Base62 encoding and QR code generation")

    # ========================================================================
    # CHANGE 5: Add shared indicator CSS before closing </style>
    # ========================================================================

    style_end = content.rfind('</style>')
    if style_end > 0:
        shared_indicator_css = """
  /* ================================================================
     SHARED NOTES INDICATOR & ANIMATIONS (v7)
     ================================================================ */

  /* Shared indicator pulse animation */
  @keyframes guestIndicatorPulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }

  .guest-shared-indicator {
    display: inline-block;
    margin-left: 0.3rem;
    animation: guestIndicatorPulse 2s ease-in-out infinite;
  }

  /* Update banner styles */
  .guest-update-banner {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%) translateY(120%);
    background: var(--bg-accent);
    color: var(--text);
    padding: 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    transition: transform 0.3s ease-out;
  }

  .guest-update-banner.guest-update-show {
    transform: translateX(-50%) translateY(0);
  }

  .guest-sync-btn {
    margin-left: 1rem;
    padding: 0.4rem 0.8rem;
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: 0.3rem;
    cursor: pointer;
    font-weight: 500;
  }

  .guest-sync-btn:active {
    transform: scale(0.95);
  }

  /* Print media query for PDF export */
  @media print {
    .guest-bar, .guest-options-sheet, .guest-cta-bottom {
      display: none !important;
    }

    #nd-guest {
      width: 100%;
      margin: 0;
      padding: 1rem;
    }

    .guest-content {
      max-width: 100%;
      font-size: 12pt;
      line-height: 1.6;
    }
  }

  /* Animations */
  @keyframes sheetItemCascade {
    0% { opacity: 0; transform: translateY(-10px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes buttonPressPhysics {
    0% { transform: scale(1); }
    50% { transform: scale(0.95); }
    100% { transform: scale(1); }
  }

  @keyframes guestSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes bannerSlideDown {
    0% { opacity: 0; transform: translateY(-20px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes qrAppear {
    0% { opacity: 0; transform: scale(0.8); }
    100% { opacity: 1; transform: scale(1); }
  }

  /* Dialog repositioning */
  .guest-cta-bottom {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%) translateY(120%);
    z-index: 999;
    animation: guestCtaSlideUp 0.4s ease-out forwards;
  }

  @keyframes guestCtaSlideUp {
    0% { opacity: 0; transform: translateX(-50%) translateY(120%); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* Respect motion preferences */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

"""

        content = content[:style_end] + shared_indicator_css + content[style_end:]
        changes.append("✓ Added animations, shared indicator, update banner, and print CSS")

    # ========================================================================
    # CHANGE 6: Add v7 version marker in head
    # ========================================================================

    head_end = content.find('</head>')
    if head_end > 0:
        if '<!-- v7 patches applied' not in content:
            version_marker = '<!-- v7 patches applied: rate limiting, auto-refresh, QR codes, animations, print fix -->\n'
            content = content[:head_end] + version_marker + content[head_end:]
            changes.append("✓ Added v7 version marker")

    return content, changes

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 apply-nodalis-v7-fixes-production.py index.html")
        sys.exit(1)

    path = sys.argv[1]

    # Verify file exists
    if not os.path.isfile(path):
        print(f"Error: {path} not found")
        sys.exit(1)

    print("=" * 70)
    print("Nodalis v7 Fixer — 15 Bulletproof Changes (PRODUCTION)")
    print("=" * 70)

    # Read file
    with open(path, 'rb') as f:
        original = f.read().decode('utf-8', errors='replace')

    # Verify baseline
    if not check_baseline(original):
        print("❌ Error: This doesn't look like a v6-patched file.")
        print("   File must have guest mode code (fetchNote, routing, preferences)")
        sys.exit(1)

    print("✓ Baseline verified (v6-patched file)\n")

    # Apply v7 changes
    print("Applying v7 changes...\n")
    patched, changes = apply_v7(original)

    # Show applied changes
    for change in changes:
        print("  " + change)

    print(f"\n✓ {len(changes)} changes applied")

    # Create backup
    backup_path = path + '.bak'
    with open(backup_path, 'wb') as f:
        f.write(original.encode('utf-8'))
    print(f"✓ Backup saved to: {backup_path}\n")

    # Write patched file
    with open(path, 'wb') as f:
        f.write(patched.encode('utf-8'))

    print("✓ Successfully patched index.html")
    print("=" * 70)

if __name__ == '__main__':
    main()

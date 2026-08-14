/* =========================================================================
 * Nodalis — features/ocr.js
 * Turn a photographed or scanned page into a note.
 *
 * Two engines, tried in order:
 *   1. The browser's built-in Shape Detection TextDetector (no download,
 *      instant, available on some Chromium builds).
 *   2. Tesseract.js from a CDN, loaded on demand the first time only.
 *
 * The app never pretends OCR is available when it is not: if neither engine
 * can run, the image is still attached to the note and the user is told why
 * the text could not be read.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let tesseractLoading = null;

  function hasNativeDetector() {
    return typeof window !== 'undefined' && 'TextDetector' in window;
  }

  function isOnline() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }

  /* ---------------------------------------------------------- image prep */

  /**
   * Downscale huge photos and lift the contrast. OCR accuracy on a phone
   * photo improves far more from this than from any engine setting.
   */
  function preprocess(file, maxDimension) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          const max = maxDimension || 2200;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (Math.max(w, h) > max) {
            const scale = max / Math.max(w, h);
            w = Math.round(w * scale); h = Math.round(h * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, w, h);

          const data = ctx.getImageData(0, 0, w, h);
          const px = data.data;
          // Grayscale, then a gentle contrast stretch around the mean.
          let sum = 0;
          for (let i = 0; i < px.length; i += 4) {
            const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            px[i] = px[i + 1] = px[i + 2] = g;
            sum += g;
          }
          const mean = sum / (px.length / 4);
          const contrast = 1.35;
          for (let i = 0; i < px.length; i += 4) {
            const v = U.clamp((px[i] - mean) * contrast + mean, 0, 255);
            px[i] = px[i + 1] = px[i + 2] = v;
          }
          ctx.putImageData(data, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('That file could not be read as an image.'));
      };
      img.src = url;
    });
  }

  /* ------------------------------------------------------------- engines */

  async function runNative(canvas) {
    const detector = new window.TextDetector();
    const blocks = await detector.detect(canvas);
    if (!blocks || !blocks.length) return null;
    // Order top-to-bottom, then left-to-right, and group into lines.
    const sorted = blocks.slice().sort(function (a, b) {
      const ay = a.boundingBox.y, by = b.boundingBox.y;
      if (Math.abs(ay - by) > 12) return ay - by;
      return a.boundingBox.x - b.boundingBox.x;
    });
    const lines = [];
    let lastY = null;
    sorted.forEach(function (b) {
      const text = b.rawValue || '';
      if (!text.trim()) return;
      if (lastY !== null && Math.abs(b.boundingBox.y - lastY) < 12) {
        lines[lines.length - 1] += ' ' + text;
      } else {
        lines.push(text);
      }
      lastY = b.boundingBox.y;
    });
    return lines.join('\n');
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractLoading) return tesseractLoading;
    tesseractLoading = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = TESSERACT_CDN;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = function () {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error('The OCR engine loaded but did not start.'));
      };
      script.onerror = function () {
        tesseractLoading = null;
        reject(new Error('Could not download the OCR engine. It needs an internet connection the first time.'));
      };
      document.head.appendChild(script);
      setTimeout(function () {
        if (!window.Tesseract) { tesseractLoading = null; reject(new Error('The OCR engine took too long to load.')); }
      }, 45000);
    });
    return tesseractLoading;
  }

  async function runTesseract(canvas, onProgress, lang) {
    const Tesseract = await loadTesseract();
    const result = await Tesseract.recognize(canvas, lang || 'eng', {
      logger: function (m) {
        if (m && m.status === 'recognizing text' && onProgress) onProgress(m.progress || 0);
      },
    });
    return result && result.data ? result.data.text : '';
  }

  /* ---------------------------------------------------------------- flow */

  function pickFiles() {
    return new Promise(function (resolve) {
      const input = el('input', { type: 'file', accept: 'image/*', multiple: 'true', style: { display: 'none' } });
      // capture="environment" makes phones offer the camera directly.
      if (U.supports.touch) input.setAttribute('capture', 'environment');
      input.addEventListener('change', function () {
        const files = input.files ? Array.prototype.slice.call(input.files) : [];
        input.remove();
        resolve(files);
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  /** Public entry point: scan one or more pages into a single new note. */
  async function scanToNote() {
    const files = await pickFiles();
    if (!files.length) return null;

    const nativeAvailable = hasNativeDetector();
    if (!nativeAvailable && !isOnline() && !window.Tesseract) {
      const proceed = await N.modal.confirm({
        title: 'OCR needs a connection the first time',
        message: 'The text-recognition engine has to be downloaded once (about 3 MB). After that it works offline. You are offline right now.',
        detail: 'Continue anyway and the images will be attached to a note without their text.',
        confirmLabel: 'Attach images only',
      });
      if (!proceed) return null;
    }

    let progressToast = null;
    const results = [];

    const dialog = N.modal.open({
      title: 'Reading ' + U.pluralize(files.length, 'page'),
      dismissible: false, showClose: false,
      render: function () {
        const wrap = el('div');
        wrap.appendChild(el('p.small.muted', { style: { lineHeight: '1.55' } },
          nativeAvailable
            ? 'Using your browser’s built-in text recognition.'
            : 'Loading the text-recognition engine. The first run downloads it once, then it works offline.'));
        const bar = el('div.progress', { style: { marginTop: '14px' } });
        const fill = el('div.progress-fill', { style: { width: '2%' } });
        bar.appendChild(fill);
        wrap.appendChild(bar);
        const status = el('div.small.muted', { style: { marginTop: '10px' } }, 'Preparing…');
        wrap.appendChild(status);
        wrap._fill = fill;
        wrap._status = status;
        return wrap;
      },
    });

    const fill = dialog.node.querySelector('.progress-fill');
    const status = dialog.node.querySelector('.small.muted:last-of-type') || dialog.node.querySelector('.small.muted');

    const setProgress = function (ratio, text) {
      if (fill) fill.style.width = Math.round(U.clamp(ratio, 0, 1) * 100) + '%';
      if (status && text) status.textContent = text;
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(i / files.length, 'Page ' + (i + 1) + ' of ' + files.length + ' — preparing image');
        let canvas;
        try { canvas = await preprocess(file); }
        catch (err) {
          results.push({ file: file, text: '', error: U.describeError(err) });
          continue;
        }

        let text = '';
        let error = null;
        try {
          if (nativeAvailable) {
            setProgress((i + 0.3) / files.length, 'Page ' + (i + 1) + ' — reading text');
            text = await runNative(canvas);
          }
          if (!text) {
            setProgress((i + 0.3) / files.length, 'Page ' + (i + 1) + ' — reading text');
            text = await runTesseract(canvas, function (p) {
              setProgress((i + 0.3 + p * 0.7) / files.length, 'Page ' + (i + 1) + ' — ' + Math.round(p * 100) + '%');
            });
          }
        } catch (err) {
          error = U.describeError(err);
        }
        results.push({ file: file, text: (text || '').trim(), error: error });
      }
    } finally {
      dialog.close();
      if (progressToast) progressToast();
    }

    return buildNote(results);
  }

  async function buildNote(results) {
    const parts = [];
    const attachments = [];
    let anyText = false;
    let firstError = null;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const id = U.uid('att');
      const ext = '.' + ((r.file.type.split('/')[1] || 'png').replace('jpeg', 'jpg'));
      try {
        await N.db.put('attachments', { id: id, name: r.file.name || 'scan', type: r.file.type, ext: ext, blob: r.file, createdAt: Date.now() });
        if (N.vault.isFolderMode()) N.vault.saveAttachment(id, ext, r.file);
        attachments.push(id);
      } catch (err) { /* the text still matters even if the image did not save */ }

      if (results.length > 1) parts.push('## Page ' + (i + 1));
      if (r.text) {
        anyText = true;
        parts.push(cleanup(r.text));
      } else {
        if (!firstError) firstError = r.error;
        parts.push('> [!warning] Text could not be read from this page' + (r.error ? '\n> ' + r.error : ''));
      }
      parts.push('');
      parts.push('![' + (r.file.name || 'scan') + '](attachment:' + id + ')');
      parts.push('');
    }

    const title = 'Scan ' + U.todayKey() + ' ' + U.formatTime(Date.now());
    const note = await N.store.createNote({
      title: title,
      content: parts.join('\n'),
      properties: { source: 'scan', created: U.todayKey() },
    });
    N.app.openNote(note.id);

    if (anyText) {
      N.toast.success('Scanned ' + U.pluralize(results.length, 'page') + ' into a note', {
        ms: 4200,
        action: { label: 'Rename', onClick: function () { document.getElementById('note-title').select(); } },
      });
    } else {
      N.toast.warn('The images were attached, but no text could be read from them.', {
        title: 'Nothing recognised',
        ms: 8000,
      });
    }
    return note;
  }

  /** Tidy OCR output: strip stray characters, rejoin broken lines, keep paragraphs. */
  function cleanup(raw) {
    let text = String(raw || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/^[ \t]+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      // A line ending mid-word with a hyphen is a wrap, not a real hyphen.
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // Common single-character noise from scans.
      .replace(/^[|_~`^]+$/gm, '')
      .trim();

    // Rejoin lines that clearly continue a sentence.
    const lines = text.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prev = out[out.length - 1];
      if (prev && line && !/^[-*+\d#>]/.test(line) && /[a-z,;]$/.test(prev) && /^[a-z]/.test(line)) {
        out[out.length - 1] = prev + ' ' + line;
      } else {
        out.push(line);
      }
    }
    return out.join('\n');
  }

  /** Read text from an image already in the clipboard or dropped on the editor. */
  async function scanFileIntoCurrentNote(file) {
    if (!N.editor.currentNoteId()) { N.toast.info('Open a note first.'); return; }
    const closing = N.toast.info('Reading text from the image…', { ms: 0, key: 'ocr' });
    try {
      const canvas = await preprocess(file);
      let text = hasNativeDetector() ? await runNative(canvas) : '';
      if (!text) text = await runTesseract(canvas);
      closing();
      if (!text || !text.trim()) { N.toast.warn('No readable text found in that image.'); return; }
      N.editor.insert('\n' + cleanup(text) + '\n');
      N.toast.success('Text inserted', { ms: 2000 });
    } catch (err) {
      closing();
      N.toast.error(U.describeError(err), { title: 'Could not read that image' });
    }
  }

  function init() {
    N.commands.registerMany([
      { id: 'ocr.scan', title: 'Scan a page into a note (OCR)', group: 'Create', icon: 'scan',
        keywords: 'ocr camera photo scan document text recognition',
        run: scanToNote },
      { id: 'ocr.insert', title: 'Read text from an image into this note', group: 'Create', icon: 'text-recognition',
        when: function () { return !!N.editor.currentNoteId(); },
        run: async function () {
          const files = await pickFiles();
          if (files.length) await scanFileIntoCurrentNote(files[0]);
        } },
    ]);
  }

  N.ocr = {
    init: init, scanToNote: scanToNote, scanFileIntoCurrentNote: scanFileIntoCurrentNote,
    hasNativeDetector: hasNativeDetector, cleanup: cleanup,
  };
})(window.NODALIS = window.NODALIS || {});

/* =========================================================================
 * Nodalis — features/exporter.js
 * Export to .md, .html, .pdf, .docx, .png, .jpg, plus a full vault .zip.
 *
 * Everything is generated locally — no upload, no service, no account.
 * .docx is written as real OOXML (zipped with the bundled JSZip); .pdf uses
 * the browser's own print engine, which produces better type than any
 * canvas-based library and needs no extra download.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  const SHARE_BLURB = 'Nodalis — a local-first notes, canvas and knowledge-graph app. Your notes stay as plain markdown files on your own disk. Free, offline, no account.';

  /* ---------------------------------------------------------------- utils */

  function ensureJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-jszip]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.JSZip); });
        existing.addEventListener('error', function () { reject(new Error('The zip library could not be loaded.')); });
        return;
      }
      const script = document.createElement('script');
      script.src = 'vendor/jszip.min.js';
      script.setAttribute('data-jszip', '');
      script.onload = function () {
        if (window.JSZip) resolve(window.JSZip);
        else reject(new Error('The zip library loaded but did not start.'));
      };
      script.onerror = function () { reject(new Error('The zip library is missing from this build.')); };
      document.head.appendChild(script);
    });
  }

  function noteFileName(note, ext) {
    return U.safeFileName(N.store.noteTitle(note), 'note') + ext;
  }

  /* ------------------------------------------------------------ markdown */

  function toMarkdown(note) {
    return N.serialize.noteToFile(note);
  }

  function exportMarkdown(note) {
    U.downloadText(toMarkdown(note), noteFileName(note, '.md'), 'text/markdown;charset=utf-8');
    N.toast.success('Markdown file saved', { ms: 1800 });
  }

  /* ---------------------------------------------------------------- HTML */

  function toStandaloneHtml(note, opts) {
    const o = opts || {};
    const title = N.store.noteTitle(note);
    const rendered = N.markdown.render(note.content || '', { headingAnchors: false });
    const dark = document.body.dataset.mode === 'dark' && o.followTheme;
    return [
      '<!DOCTYPE html>',
      '<html lang="en"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + U.escapeHtml(title) + '</title>',
      '<style>',
      ':root{color-scheme:' + (dark ? 'dark' : 'light') + '}',
      'body{margin:0;padding:48px 24px;background:' + (dark ? '#16161f' : '#ffffff') + ';color:' + (dark ? '#f2f2f8' : '#24201a') + ';',
      "font:16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}",
      'main{max-width:720px;margin:0 auto}',
      'h1,h2,h3,h4{line-height:1.25;margin:1.6em 0 .4em;font-weight:650}',
      'h1{font-size:2em;margin-top:0}h2{font-size:1.5em;border-bottom:1px solid ' + (dark ? '#2b2b3a' : '#e8e4da') + ';padding-bottom:.25em}',
      'p,ul,ol,blockquote,pre,table{margin:0 0 1em}',
      'code{background:' + (dark ? '#1e1e2b' : '#f3efe4') + ';padding:.14em .38em;border-radius:4px;font-size:.9em}',
      'pre{background:' + (dark ? '#1e1e2b' : '#f3efe4') + ';padding:14px 16px;border-radius:8px;overflow:auto}',
      'pre code{background:none;padding:0}',
      'blockquote{border-left:3px solid ' + (dark ? '#3d3d50' : '#d8d0bd') + ';margin-left:0;padding-left:1em;color:' + (dark ? '#c6c6d4' : '#5a5344') + '}',
      'table{border-collapse:collapse;width:100%}th,td{border:1px solid ' + (dark ? '#2b2b3a' : '#e8e4da') + ';padding:8px 12px;text-align:left}',
      'th{background:' + (dark ? '#1c1c27' : '#faf6ed') + '}',
      'img{max-width:100%;border-radius:8px}',
      'a{color:#6c5ce7}',
      '.callout{border:1px solid #d8d0bd;border-left:3px solid #6c5ce7;border-radius:8px;padding:12px 16px;margin:0 0 1em}',
      '.callout-head{font-weight:650;margin-bottom:.3em;display:flex;gap:8px;align-items:center}',
      '.task-item{list-style:none;margin-left:-1.4em}',
      '.footnotes{font-size:.9em;border-top:1px solid ' + (dark ? '#2b2b3a' : '#e8e4da') + ';margin-top:2.5em;padding-top:1em}',
      'mark{background:#ffe9a8;color:#4a3a10;padding:0 2px}',
      '.meta{color:' + (dark ? '#8b8b9e' : '#8d8672') + ';font-size:.85em;margin-bottom:2em}',
      '@media print{body{padding:0;background:#fff;color:#000}a{color:#000}pre,blockquote,.callout{break-inside:avoid}}',
      '</style></head><body><main>',
      o.includeTitle === false ? '' : '<h1>' + U.escapeHtml(title) + '</h1>',
      o.includeMeta ? '<div class="meta">' + U.escapeHtml(note.path) + ' · ' + U.escapeHtml(U.formatDate(note.updatedAt)) + '</div>' : '',
      rendered,
      '</main></body></html>',
    ].join('\n');
  }

  async function exportHtml(note) {
    const html = await inlineAttachments(toStandaloneHtml(note, { includeMeta: true }));
    U.downloadText(html, noteFileName(note, '.html'), 'text/html;charset=utf-8');
    N.toast.success('HTML file saved', { ms: 1800 });
  }

  /** Replace attachment: URLs with data: URLs so exports are self-contained. */
  async function inlineAttachments(html) {
    const matches = html.match(/attachment:[A-Za-z0-9]+/g);
    if (!matches) return html;
    let out = html;
    for (const match of Array.from(new Set(matches))) {
      const id = match.slice('attachment:'.length);
      try {
        const row = await N.db.get('attachments', id);
        if (row && row.blob) {
          const dataUrl = await blobToDataUrl(row.blob);
          out = out.split(match).join(dataUrl);
        } else {
          out = out.split(match).join('');
        }
      } catch (err) {
        out = out.split(match).join('');
      }
    }
    return out;
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('Could not read the attachment.')); };
      reader.readAsDataURL(blob);
    });
  }

  /* ----------------------------------------------------------------- PDF */

  /**
   * Print-to-PDF via a sandboxed iframe. The browser's own engine gives
   * proper text selection, real fonts and correct pagination — far better
   * than rasterising the page.
   */
  async function exportPdf(note) {
    const html = await inlineAttachments(toStandaloneHtml(note, { includeMeta: true }));
    const frame = el('iframe', {
      style: { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0' },
      'aria-hidden': 'true',
    });
    document.body.appendChild(frame);

    await new Promise(function (resolve) {
      frame.onload = resolve;
      const doc = frame.contentDocument;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(resolve, 600);   // some engines never fire onload for written docs
    });

    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      N.toast.info('Choose "Save as PDF" in the print dialog.', { ms: 6000, title: 'Print dialog opened' });
    } catch (err) {
      N.toast.error('This browser blocked the print dialog. Try the HTML export and print that instead.');
    }
    setTimeout(function () { if (frame.parentNode) frame.remove(); }, 60000);
  }

  /* ---------------------------------------------------------------- DOCX */

  /**
   * A minimal but genuinely valid .docx. Word, Pages, LibreOffice and
   * Google Docs all open these — headings, bold/italic, lists, quotes,
   * code blocks and tables survive the trip.
   */
  async function exportDocx(note) {
    const JSZip = await ensureJSZip();
    const zip = new JSZip();
    const title = N.store.noteTitle(note);

    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>');

    zip.folder('_rels').file('.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>');

    zip.folder('word').folder('_rels').file('document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>');

    zip.folder('docProps').file('core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xml(title) + '</dc:title>' +
      '<dc:creator>Nodalis</dc:creator>' +
      '<cp:lastModifiedBy>Nodalis</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date(note.createdAt || Date.now()).toISOString() + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + new Date(note.updatedAt || Date.now()).toISOString() + '</dcterms:modified>' +
      '</cp:coreProperties>');

    zip.folder('word').file('styles.xml', docxStyles());
    zip.folder('word').file('document.xml', docxDocument(title, note.content || ''));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    U.downloadBlob(blob, noteFileName(note, '.docx'));
    N.toast.success('Word document saved', { ms: 1800 });
  }

  function xml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
      // Strip control characters Word rejects outright.
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  function docxStyles() {
    const heading = function (id, name, size, before) {
      return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/>' +
        '<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="' + before + '" w:after="120"/><w:outlineLvl w:val="' + (parseInt(id.replace('Heading', ''), 10) - 1) + '"/></w:pPr>' +
        '<w:rPr><w:b/><w:sz w:val="' + size + '"/></w:rPr></w:style>';
    };
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style>' +
      heading('Heading1', 'heading 1', '40', '360') +
      heading('Heading2', 'heading 2', '32', '320') +
      heading('Heading3', 'heading 3', '26', '280') +
      heading('Heading4', 'heading 4', '24', '240') +
      '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:ind w:left="480"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="B0AAA0"/></w:pBdr></w:pPr>' +
      '<w:rPr><w:i/><w:color w:val="55503F"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:shd w:val="clear" w:fill="F3EFE4"/><w:spacing w:after="0"/><w:ind w:left="240"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:ind w:left="480"/><w:spacing w:after="60"/></w:pPr></w:style>' +
      '</w:styles>';
  }

  function docxDocument(title, markdown) {
    const paragraphs = [];
    paragraphs.push(para(title, 'Heading1'));

    const lines = String(markdown).split('\n');
    let inFence = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
      if (inFence) { paragraphs.push(para(line, 'Code', true)); continue; }

      if (!line.trim()) continue;

      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) { paragraphs.push(para(h[2], 'Heading' + Math.min(4, h[1].length))); continue; }

      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        paragraphs.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr></w:pPr></w:p>');
        continue;
      }

      const quote = /^\s*>\s?(.*)$/.exec(line);
      if (quote) {
        paragraphs.push(para(quote[1].replace(/^\[![A-Za-z]+\][+-]?\s*/, ''), 'Quote'));
        continue;
      }

      const task = /^(\s*)[-*+]\s+\[([ xX/-])\]\s+(.*)$/.exec(line);
      if (task) {
        const mark = task[2].toLowerCase() === 'x' ? '☑ ' : '☐ ';
        paragraphs.push(para(mark + task[3], 'ListParagraph'));
        continue;
      }

      const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
      if (bullet) { paragraphs.push(para('• ' + bullet[2], 'ListParagraph')); continue; }

      const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
      if (numbered) { paragraphs.push(para(numbered[2] + '. ' + numbered[3], 'ListParagraph')); continue; }

      // Tables become a real Word table.
      if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
        const rows = [];
        rows.push(splitRow(line));
        i += 2;
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
        i--;
        paragraphs.push(docxTable(rows));
        continue;
      }

      paragraphs.push(para(line, 'Normal'));
    }

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + paragraphs.join('') +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
      '</w:body></w:document>';
  }

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map(function (c) { return c.trim(); });
  }

  function docxTable(rows) {
    const width = Math.floor(9600 / Math.max(1, rows[0].length));
    let out = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>' +
      '<w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (side) {
        return '<w:' + side + ' w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>';
      }).join('') +
      '</w:tblBorders></w:tblPr>';
    rows.forEach(function (row, rowIndex) {
      out += '<w:tr>';
      row.forEach(function (cell) {
        out += '<w:tc><w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>' +
          (rowIndex === 0 ? '<w:shd w:val="clear" w:fill="FAF6ED"/>' : '') + '</w:tcPr>' +
          para(cell, 'Normal', false, rowIndex === 0) + '</w:tc>';
      });
      out += '</w:tr>';
    });
    out += '</w:tbl><w:p/>';
    return out;
  }

  /** One paragraph, with inline **bold**, *italic*, `code` and links flattened. */
  function para(text, style, preserveSpace, forceBold) {
    const runs = [];
    const src = String(text || '');
    // Split on inline markers, keeping them so we know which run is which.
    const tokens = src.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[\[[^\]]+\]\]|\[[^\]]*\]\([^)]*\))/g);
    tokens.forEach(function (token) {
      if (!token) return;
      let content = token, bold = !!forceBold, italic = false, code = false;
      let m;
      if ((m = /^\*\*([\s\S]+)\*\*$/.exec(token)) || (m = /^__([\s\S]+)__$/.exec(token))) { content = m[1]; bold = true; }
      else if ((m = /^\*([\s\S]+)\*$/.exec(token)) || (m = /^_([\s\S]+)_$/.exec(token))) { content = m[1]; italic = true; }
      else if ((m = /^`([\s\S]+)`$/.exec(token))) { content = m[1]; code = true; }
      else if ((m = /^\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|([^\]]*))?\]\]$/.exec(token))) { content = m[2] || m[1]; }
      else if ((m = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(token))) { content = m[1] + ' (' + m[2] + ')'; }

      const rPr = [];
      if (bold) rPr.push('<w:b/>');
      if (italic) rPr.push('<w:i/>');
      if (code) rPr.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:fill="F3EFE4"/>');
      runs.push('<w:r>' + (rPr.length ? '<w:rPr>' + rPr.join('') + '</w:rPr>' : '') +
        '<w:t' + (preserveSpace ? ' xml:space="preserve"' : '') + '>' + xml(content) + '</w:t></w:r>');
    });
    if (!runs.length) runs.push('<w:r><w:t/></w:r>');
    return '<w:p><w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' + runs.join('') + '</w:p>';
  }

  /* ---------------------------------------------------------- PNG / JPEG */

  /**
   * Render a note to an image using an SVG foreignObject. No dependency,
   * works offline, and keeps real text rendering rather than a screenshot.
   */
  async function exportImage(note, format) {
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const html = await inlineAttachments(toStandaloneHtml(note, { includeMeta: false }));

    // Measure the content by rendering it off-screen first.
    const probe = el('div', {
      style: {
        position: 'fixed', left: '-10000px', top: '0',
        width: '760px', padding: '48px', boxSizing: 'border-box',
        background: format === 'jpeg' ? '#ffffff' : 'transparent',
        font: "16px/1.7 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#24201a',
      },
    });
    probe.innerHTML = extractBody(html);
    document.body.appendChild(probe);
    await U.nextFrame();
    const height = Math.min(probe.scrollHeight + 96, 20000);
    const width = 760;

    const serialized = new XMLSerializer().serializeToString(probe);
    document.body.removeChild(probe);

    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
      '<rect width="100%" height="100%" fill="' + (format === 'jpeg' ? '#ffffff' : 'rgba(255,255,255,0)') + '"/>' +
      '<foreignObject width="100%" height="100%">' +
      serialized.replace(/<div /, '<div xmlns="http://www.w3.org/1999/xhtml" ') +
      '</foreignObject></svg>';

    try {
      const blob = await svgToImage(svg, width, height, mime, format === 'jpeg' ? '#ffffff' : null);
      U.downloadBlob(blob, noteFileName(note, format === 'jpeg' ? '.jpg' : '.png'));
      N.toast.success((format === 'jpeg' ? 'JPEG' : 'PNG') + ' image saved', { ms: 1800 });
    } catch (err) {
      N.toast.error('This browser would not render the note to an image. The HTML or PDF export will work.', {
        title: 'Image export failed',
      });
    }
  }

  function extractBody(html) {
    const start = html.indexOf('<main>');
    const end = html.lastIndexOf('</main>');
    const inner = start !== -1 && end !== -1 ? html.slice(start + 6, end) : html;
    return '<div>' + inner + '</div>';
  }

  function svgToImage(svgString, width, height, mime, background) {
    return new Promise(function (resolve, reject) {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const scale = Math.min(2, window.devicePixelRatio || 1);
      img.onload = function () {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const ctx = canvas.getContext('2d');
          if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob(function (out) {
            if (out) resolve(out);
            else reject(new Error('The canvas produced no image data.'));
          }, mime, mime === 'image/jpeg' ? 0.92 : undefined);
        } catch (err) { URL.revokeObjectURL(url); reject(err); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('The image could not be rasterised.')); };
      img.src = url;
    });
  }

  /** Canvas boards export as a flat PNG of their contents. */
  async function exportCanvasPng(doc) {
    if (!doc || !doc.items.length) { N.toast.info('This canvas is empty.'); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    doc.items.forEach(function (i) {
      minX = Math.min(minX, i.x); minY = Math.min(minY, i.y);
      maxX = Math.max(maxX, i.x + i.w); maxY = Math.max(maxY, i.y + i.h);
    });
    (doc.strokes || []).forEach(function (s) {
      s.points.forEach(function (p) {
        minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
      });
    });
    const pad = 40;
    const width = Math.min(6000, maxX - minX + pad * 2);
    const height = Math.min(6000, maxY - minY + pad * 2);

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.translate(-minX + pad, -minY + pad);

    // connections first
    ctx.strokeStyle = '#9a9a9a';
    ctx.lineWidth = 1.6;
    (doc.connections || []).forEach(function (conn) {
      const from = doc.items.find(function (i) { return i.id === conn.from; });
      const to = doc.items.find(function (i) { return i.id === conn.to; });
      if (!from || !to) return;
      ctx.beginPath();
      ctx.moveTo(from.x + from.w / 2, from.y + from.h / 2);
      ctx.lineTo(to.x + to.w / 2, to.y + to.h / 2);
      ctx.stroke();
    });

    doc.items.slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); }).forEach(function (item) {
      ctx.fillStyle = item.kind === 'sticky' ? (item.color || '#ffe9a8') : '#ffffff';
      ctx.strokeStyle = '#d8d4cc';
      ctx.lineWidth = 1;
      roundRect(ctx, item.x, item.y, item.w, item.h, 8);
      ctx.fill();
      if (item.kind !== 'sticky') ctx.stroke();

      ctx.fillStyle = '#24201a';
      ctx.font = '13px -apple-system, system-ui, sans-serif';
      const text = item.kind === 'noteref'
        ? (N.store.getNote(item.noteId) ? N.store.noteTitle(N.store.getNote(item.noteId)) : 'Missing note')
        : (item.text || item.title || '');
      wrapText(ctx, text, item.x + 12, item.y + 24, item.w - 24, 18, Math.floor((item.h - 24) / 18));
    });

    (doc.strokes || []).forEach(function (stroke) {
      ctx.strokeStyle = stroke.color || '#333';
      ctx.lineWidth = stroke.width || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      stroke.points.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      ctx.stroke();
    });

    canvas.toBlob(function (blob) {
      if (!blob) { N.toast.error('Could not render the canvas.'); return; }
      U.downloadBlob(blob, U.safeFileName(doc.title, 'canvas') + '.png');
      N.toast.success('Canvas exported as PNG', { ms: 1800 });
    }, 'image/png');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/);
    let line = '', lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        lines++;
        if (lines >= maxLines) { ctx.fillText('…', x, y + lines * lineHeight); return; }
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
  }

  /* ------------------------------------------------------------ full vault */

  async function exportVaultZip(onProgress) {
    const JSZip = await ensureJSZip();
    const zip = new JSZip();
    const notes = N.store.allNotes();

    notes.forEach(function (note) { zip.file(note.path, toMarkdown(note)); });

    const appDir = zip.folder('.nodalis');
    appDir.file('stickies.json', JSON.stringify(Array.from(N.store.state.stickies.values()), null, 2));
    appDir.file('tasks.json', JSON.stringify(Array.from(N.store.state.tasks.values()), null, 2));
    appDir.file('scratch.json', JSON.stringify(Array.from(N.store.state.scratch.values()), null, 2));
    appDir.file('journal.json', JSON.stringify(Array.from(N.store.state.journal.values()), null, 2));
    appDir.file('settings.json', JSON.stringify(N.store.state.settings, null, 2));
    const canvasDir = appDir.folder('canvases');
    N.store.state.canvases.forEach(function (c) { canvasDir.file(c.id + '.json', JSON.stringify(c, null, 2)); });

    try {
      const attachments = await N.db.getAll('attachments');
      const attDir = appDir.folder('attachments');
      attachments.forEach(function (a) {
        if (a.blob) attDir.file(a.id + (a.ext || ''), a.blob);
      });
    } catch (err) { console.warn('[export] attachments skipped', err); }

    zip.file('README.txt', [
      'Nodalis vault export — ' + new Date().toISOString(),
      '',
      'Every .md file here is a plain markdown note you can open in any editor,',
      'including Obsidian. Folders match the structure inside the app.',
      '',
      'The .nodalis folder holds the extras: canvases, stickies, standalone tasks,',
      'the scratchpad, your activity journal and your settings. Deleting it loses',
      'those, but never your notes.',
      '',
      'To restore: open Nodalis, then Settings > Storage > Import a backup.',
      '',
      U.pluralize(notes.length, 'note') + ' · ' + U.pluralize(N.store.state.folders.size, 'folder'),
    ].join('\n'));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, function (meta) {
      if (onProgress) onProgress(meta.percent / 100);
    });
    const name = 'nodalis-vault-' + U.todayKey() + '.zip';
    U.downloadBlob(blob, name);
    await N.vault.markSnapshotTaken();
    return { name: name, size: blob.size, notes: notes.length };
  }

  async function importVaultZip(file, mode) {
    const JSZip = await ensureJSZip();
    const zip = await JSZip.loadAsync(file);
    let created = 0, updated = 0, skipped = 0;

    const entries = [];
    zip.forEach(function (path, entry) { if (!entry.dir) entries.push({ path: path, entry: entry }); });

    if (mode === 'replace') {
      const ok = await N.modal.confirm({
        title: 'Replace everything?',
        message: 'Every note, canvas and sticky currently in Nodalis will be deleted and replaced by this backup.',
        danger: true, confirmLabel: 'Replace everything',
      });
      if (!ok) return null;
      for (const note of N.store.allNotes()) await N.store.deleteNote(note.id, { skipUndo: true });
    }

    for (const item of entries) {
      const path = item.path;
      try {
        if (/\.md$/i.test(path) && !path.startsWith('.nodalis/')) {
          const text = await item.entry.async('string');
          const result = await N.store.upsertFromDisk(path, text, Date.now());
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
          else skipped++;
        } else if (path === '.nodalis/stickies.json' || path === '.nodalis/tasks.json' ||
                   path === '.nodalis/scratch.json' || path === '.nodalis/journal.json') {
          const name = path.split('/').pop().replace('.json', '');
          const data = JSON.parse(await item.entry.async('string'));
          if (Array.isArray(data)) await N.store.replaceCollection(name, data);
        } else if (/^\.nodalis\/canvases\/.*\.json$/.test(path)) {
          const data = JSON.parse(await item.entry.async('string'));
          if (data && data.id) await N.store.saveRecord('canvases', data);
        } else if (/^\.nodalis\/attachments\//.test(path)) {
          const name = path.split('/').pop();
          const dot = name.lastIndexOf('.');
          const id = dot === -1 ? name : name.slice(0, dot);
          const ext = dot === -1 ? '' : name.slice(dot);
          const blob = await item.entry.async('blob');
          await N.db.put('attachments', { id: id, name: name, ext: ext, blob: blob, type: blob.type, createdAt: Date.now() });
        }
      } catch (err) {
        console.warn('[import] skipped ' + path, err);
        skipped++;
      }
    }

    N.bus.emit('vault:changed');
    return { created: created, updated: updated, skipped: skipped };
  }

  /* --------------------------------------------------------------- share */

  async function shareNote(note) {
    const text = N.markdown.toPlainText(note.content, 2000);
    const title = N.store.noteTitle(note);
    if (navigator.share) {
      try {
        await navigator.share({ title: title, text: text + '\n\n— written in ' + SHARE_BLURB });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    const ok = await U.copyToClipboard(title + '\n\n' + text + '\n\n— written in ' + SHARE_BLURB);
    N.toast[ok ? 'success' : 'error'](ok ? 'Note copied to your clipboard' : 'Could not copy the note', { ms: 2600 });
  }

  async function shareApp() {
    const url = location.href.split('#')[0];
    if (navigator.share) {
      try { await navigator.share({ title: 'Nodalis', text: SHARE_BLURB, url: url }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    const ok = await U.copyToClipboard(SHARE_BLURB + '\n' + url);
    N.toast[ok ? 'success' : 'error'](ok ? 'Link copied' : 'Could not copy the link', { ms: 2400 });
  }

  /* ------------------------------------------------------------- dialogs */

  function exportNoteDialog(noteId) {
    const note = N.store.getNote(noteId || N.store.state.activeNoteId);
    if (!note) { N.toast.info('Open a note first.'); return; }
    return N.modal.choose({
      title: 'Export "' + U.truncate(N.store.noteTitle(note), 34) + '"',
      options: [
        { value: 'md', label: 'Markdown (.md)', description: 'The original file, frontmatter and all', icon: 'file-text' },
        { value: 'pdf', label: 'PDF', description: 'Opens your print dialog — choose Save as PDF', icon: 'file' },
        { value: 'docx', label: 'Word (.docx)', description: 'Opens in Word, Pages, Docs and LibreOffice', icon: 'file-text' },
        { value: 'html', label: 'Web page (.html)', description: 'Self-contained, images included', icon: 'globe' },
        { value: 'png', label: 'Image (.png)', description: 'Good for sharing a screenshot-style copy', icon: 'image' },
        { value: 'jpg', label: 'Image (.jpg)', description: 'Smaller file, white background', icon: 'image' },
      ],
    }).then(function (choice) {
      if (!choice) return;
      if (choice === 'md') return exportMarkdown(note);
      if (choice === 'pdf') return exportPdf(note);
      if (choice === 'docx') return exportDocx(note);
      if (choice === 'html') return exportHtml(note);
      if (choice === 'png') return exportImage(note, 'png');
      if (choice === 'jpg') return exportImage(note, 'jpeg');
    });
  }

  async function exportFolderDialog(folderPath) {
    const notes = N.store.notesInFolder(folderPath, true);
    if (!notes.length) { N.toast.info('That folder has no notes in it.'); return; }
    const JSZip = await ensureJSZip();
    const zip = new JSZip();
    notes.forEach(function (note) { zip.file(note.path, toMarkdown(note)); });
    const blob = await zip.generateAsync({ type: 'blob' });
    U.downloadBlob(blob, U.safeFileName(folderPath, 'folder') + '.zip');
    N.toast.success('Exported ' + U.pluralize(notes.length, 'note'), { ms: 2000 });
  }

  function init() {
    N.commands.registerMany([
      { id: 'export.note', title: 'Export this note…', group: 'Export', icon: 'download', accel: 'Mod+Shift+E',
        when: function () { return !!N.store.state.activeNoteId; },
        run: function () { exportNoteDialog(); } },
      { id: 'export.markdown', title: 'Export note as Markdown', group: 'Export', icon: 'file-text',
        when: function () { return !!N.store.state.activeNoteId; },
        run: function () { exportMarkdown(N.store.getNote(N.store.state.activeNoteId)); } },
      { id: 'export.pdf', title: 'Export note as PDF', group: 'Export', icon: 'file',
        when: function () { return !!N.store.state.activeNoteId; },
        run: function () { exportPdf(N.store.getNote(N.store.state.activeNoteId)); } },
      { id: 'export.docx', title: 'Export note as Word document', group: 'Export', icon: 'file-text',
        when: function () { return !!N.store.state.activeNoteId; },
        run: function () { exportDocx(N.store.getNote(N.store.state.activeNoteId)); } },
      { id: 'export.png', title: 'Export note as PNG image', group: 'Export', icon: 'image',
        when: function () { return !!N.store.state.activeNoteId; },
        run: function () { exportImage(N.store.getNote(N.store.state.activeNoteId), 'png'); } },
      { id: 'export.vault', title: 'Export the whole vault as a .zip', group: 'Export', icon: 'archive',
        run: async function () {
          const closing = N.toast.info('Packing your vault…', { ms: 0, key: 'zip' });
          try {
            const result = await exportVaultZip();
            closing();
            N.toast.success('Saved ' + result.name + ' (' + U.formatBytes(result.size) + ')', { ms: 5000 });
          } catch (err) {
            closing();
            N.toast.error(U.describeError(err), { title: 'Export failed' });
          }
        } },
      { id: 'note.share', title: 'Share this note', group: 'Export', icon: 'share',
        when: function () { return !!N.store.state.activeNoteId; },
        run: function () { shareNote(N.store.getNote(N.store.state.activeNoteId)); } },
      { id: 'app.share', title: 'Share Nodalis', group: 'Export', icon: 'share', run: shareApp },
      { id: 'note.print', title: 'Print this note', group: 'Export', icon: 'file', accel: 'Mod+P',
        when: function () { return !!N.store.state.activeNoteId; },
        run: function () { exportPdf(N.store.getNote(N.store.state.activeNoteId)); } },
    ]);
  }

  N.exporter = {
    init: init,
    toMarkdown: toMarkdown, toStandaloneHtml: toStandaloneHtml,
    exportMarkdown: exportMarkdown, exportHtml: exportHtml, exportPdf: exportPdf,
    exportDocx: exportDocx, exportImage: exportImage, exportCanvasPng: exportCanvasPng,
    exportVaultZip: exportVaultZip, importVaultZip: importVaultZip,
    exportNoteDialog: exportNoteDialog, exportFolderDialog: exportFolderDialog,
    shareNote: shareNote, shareApp: shareApp,
    SHARE_BLURB: SHARE_BLURB,
  };
})(window.NODALIS = window.NODALIS || {});

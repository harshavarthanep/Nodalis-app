/* =========================================================================
 * Nodalis — ui/icons.js
 * A single stroked SVG icon set. There are no emoji anywhere in this app:
 * every glyph is a 24x24 outline drawn on the same grid with the same
 * 1.6px stroke, so icons sit together as one family and inherit text colour.
 *
 * Usage:  icons.svg('search')            -> SVG markup string
 *         icons.node('search', {size:20}) -> live SVGElement
 * ========================================================================= */
(function (N) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  /* Paths only — the wrapper supplies viewBox, stroke and sizing.
     `f:` prefix marks a path that should be filled rather than stroked. */
  const P = {
    /* ---- navigation & chrome ---- */
    menu: 'M3.5 7h17M3.5 12h17M3.5 17h17',
    sidebar: 'M3.5 5.5h17v13h-17zM9.5 5.5v13',
    'sidebar-right': 'M3.5 5.5h17v13h-17zM14.5 5.5v13',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M4.5 12.5l5 5 10-11',
    'check-small': 'M6 12l4 4 8-9',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    'chevron-right': 'M9.5 5.5l6.5 6.5-6.5 6.5',
    'chevron-left': 'M14.5 5.5L8 12l6.5 6.5',
    'chevron-down': 'M5.5 9.5L12 16l6.5-6.5',
    'chevron-up': 'M5.5 14.5L12 8l6.5 6.5',
    'arrow-right': 'M4 12h15M13 6l6 6-6 6',
    'arrow-left': 'M20 12H5M11 6l-6 6 6 6',
    'arrow-up': 'M12 20V5M6 11l6-6 6 6',
    'arrow-down': 'M12 4v15M6 13l6 6 6-6',
    'corner-down-left': 'M20 5v6a3 3 0 01-3 3H5M9 10l-4 4 4 4',
    more: 'M5.2 12h.01M12 12h.01M18.8 12h.01',
    'more-vertical': 'M12 5.2v.01M12 12v.01M12 18.8v.01',
    external: 'M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10',
    expand: 'M9 4H4v5M15 20h5v-5M4 4l6 6M20 20l-6-6',
    collapse: 'M4 9h5V4M20 15h-5v5M4 4l5 5M20 20l-5-5',

    /* ---- files & structure ---- */
    note: 'M6 3.5h7.5L18.5 8.5V20a.5.5 0 01-.5.5H6a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5zM13.5 3.5v5h5M8.5 13h7M8.5 16.5h4.5',
    notes: 'M8 3.5h6l4 4V17a.5.5 0 01-.5.5H8a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5zM14 3.5v4h4M5 7v13a.5.5 0 00.5.5H15',
    folder: 'M3.5 6.5a1 1 0 011-1h4.2l1.8 2.2h9a1 1 0 011 1v9.8a1 1 0 01-1 1h-15a1 1 0 01-1-1z',
    'folder-open': 'M3.5 6.5a1 1 0 011-1h4.2l1.8 2.2h9a1 1 0 011 1v1.3M3.5 9.7h17.8l-2.1 8.6a1 1 0 01-1 .7H4.5a1 1 0 01-1-1z',
    'folder-plus': 'M3.5 6.5a1 1 0 011-1h4.2l1.8 2.2h9a1 1 0 011 1v9.8a1 1 0 01-1 1h-15a1 1 0 01-1-1zM12 11.5v5M9.5 14h5',
    file: 'M6.5 3.5h7L18 8v12.5H6.5zM13.5 3.5V8H18',
    'file-text': 'M6.5 3.5h7L18 8v12.5H6.5zM13.5 3.5V8H18M9 12h6M9 15.5h6M9 8.5h2',
    'file-plus': 'M6.5 3.5h7L18 8v12.5H6.5zM13.5 3.5V8H18M12 11v6M9 14h6',
    'file-down': 'M6.5 3.5h7L18 8v12.5H6.5zM13.5 3.5V8H18M12 11v5.5M9.5 14l2.5 2.5L14.5 14',
    archive: 'M3.5 6.5h17v3h-17zM5 9.5v10h14v-10M9.5 13h5',
    inbox: 'M3.5 13.5h5l1.2 2.4h4.6l1.2-2.4h5M3.5 13.5L6 5.2a1 1 0 011-.7h10a1 1 0 011 .7l2.5 8.3v5a1 1 0 01-1 1h-15a1 1 0 01-1-1z',

    /* ---- editor & formatting ---- */
    edit: 'M4 20l.9-4 11-11a2 2 0 112.8 2.8l-11 11z M14 6.5l3.5 3.5',
    'edit-note': 'M12 4.5H5.5a1 1 0 00-1 1v13a1 1 0 001 1h13a1 1 0 001-1V12M17.6 3.9a1.9 1.9 0 012.7 2.7L12.6 14.3l-3.5.8.8-3.5z',
    bold: 'M7 4.5h6a3.5 3.5 0 010 7H7zM7 11.5h6.8a4 4 0 010 8H7z',
    italic: 'M15.5 4.5h-6M13.5 19.5h-6M14 4.5l-4 15',
    strikethrough: 'M4.5 12h15M16.5 7.2A4.6 4.6 0 0012 5c-2.6 0-4.4 1.4-4.4 3.4 0 1.5.9 2.5 2.6 3.1M7.5 16.6A4.8 4.8 0 0012 19c2.8 0 4.6-1.4 4.6-3.5 0-1.1-.4-1.9-1.2-2.5',
    underline: 'M6.5 4v6.5a5.5 5.5 0 0011 0V4M5 20h14',
    heading: 'M6 5v14M18 5v14M6 12h12',
    'heading-1': 'M4 5v14M12 5v14M4 12h8M16.5 9.5l2.5-1.5V19',
    'heading-2': 'M4 5v14M12 5v14M4 12h8M16 10a2.5 2.5 0 114.3 1.8L16 19h5',
    'heading-3': 'M4 5v14M12 5v14M4 12h8M16 8.5h4.5L18 12a2.7 2.7 0 11-1.8 4.7',
    quote: 'M9.5 6.5c-2.5 0-4 1.8-4 4.2 0 2 1.3 3.3 3 3.3 1.6 0 2.7-1 2.7-2.5 0-1.4-1-2.4-2.3-2.4-.3 0-.6 0-.8.1.3-1.1 1.2-1.9 2.4-2.1zM18.5 6.5c-2.5 0-4 1.8-4 4.2 0 2 1.3 3.3 3 3.3 1.6 0 2.7-1 2.7-2.5 0-1.4-1-2.4-2.3-2.4-.3 0-.6 0-.8.1.3-1.1 1.2-1.9 2.4-2.1z',
    code: 'M9 6.5L3.5 12 9 17.5M15 6.5L20.5 12 15 17.5',
    'code-block': 'M3.5 5.5h17v13h-17zM8.5 10L6 12.5 8.5 15M15.5 10l2.5 2.5-2.5 2.5',
    list: 'M9 6.5h11M9 12h11M9 17.5h11M4.6 6.5h.01M4.6 12h.01M4.6 17.5h.01',
    'list-ordered': 'M10 6.5h10M10 12h10M10 17.5h10M4 5.2l1.4-.7v3.4M3.8 11.2a1.3 1.3 0 112.2 1L3.8 15h2.6M3.9 15.6h2.2l-1.3 1.6a1.3 1.3 0 11-.9 2.2',
    'list-check': 'M10 6.5h10M10 12h10M10 17.5h10M3.6 6.3l1 1 1.9-2M3.6 11.8l1 1 1.9-2M3.6 17.3l1 1 1.9-2',
    'list-tree': 'M9.5 6h11M13 12h7.5M13 18h7.5M4.5 4v12.5a1.5 1.5 0 001.5 1.5h3M4.5 10.5a1.5 1.5 0 001.5 1.5h3',
    table: 'M3.5 5.5h17v13h-17zM3.5 10h17M3.5 14.5h17M9.5 5.5v13M15 5.5v13',
    link: 'M10.2 13.8a3.6 3.6 0 005.4.4l2.6-2.6a3.6 3.6 0 00-5.1-5.1l-1.5 1.5M13.8 10.2a3.6 3.6 0 00-5.4-.4l-2.6 2.6a3.6 3.6 0 005.1 5.1l1.5-1.5',
    'link-off': 'M9.5 14.5l-1 1a3.6 3.6 0 01-5.1-5.1l2.6-2.6M14.5 9.5l1-1a3.6 3.6 0 015.1 5.1l-2.6 2.6M4 4l16 16',
    unlink: 'M9.5 14.5l-1 1a3.6 3.6 0 01-5.1-5.1l2.6-2.6M14.5 9.5l1-1a3.6 3.6 0 015.1 5.1l-2.6 2.6M4 4l16 16',
    image: 'M3.5 5.5h17v13h-17zM3.5 15.5l4.5-4 3.5 3 4-4.5 5 5.5M9 9.8h.01',
    attachment: 'M20 11.5l-8.4 8.4a4.5 4.5 0 01-6.4-6.4l8.4-8.4a3 3 0 014.3 4.3l-8.4 8.4a1.5 1.5 0 01-2.1-2.1l7.8-7.8',
    divider: 'M3.5 12h17M6.5 7h11M6.5 17h11',
    math: 'M5 5.5h9l-4.5 6.5 4.5 6.5H5M16 9l4 6M20 9l-4 6',
    highlight: 'M14.5 4.5l5 5-7.5 7.5H7v-5zM4 20.5h16',
    superscript: 'M4 6l8 12M12 6l-8 12M17 8.2c0-1 .8-1.7 1.8-1.7s1.7.7 1.7 1.6c0 1.4-2 1.9-3.5 3.9h3.7',
    tag: 'M11.5 3.5H20v8.5l-8.6 8.6a1.4 1.4 0 01-2 0l-6.5-6.5a1.4 1.4 0 010-2zM16.2 7.8h.01',
    tags: 'M9.5 3.5H17v7.5l-7.6 7.6a1.3 1.3 0 01-1.8 0l-5.7-5.7a1.3 1.3 0 010-1.8zM13.8 7.3h.01M13 3.5h4.5a2 2 0 012 2V10',

    /* ---- views ---- */
    graph: 'M6 6.5a2.2 2.2 0 100 .01M18 7.5a2.2 2.2 0 100 .01M7 18a2.2 2.2 0 100 .01M17.5 17a2.2 2.2 0 100 .01M8.1 7l7.8-.4M7.4 8.6l7.2 7.1M15.7 8.9l-6.4 7.3',
    canvas: 'M3.5 4.5h17v15h-17zM3.5 14l4.5-4 3 2.6 4-4.6 5.5 5M8 8.4h.01',
    database: 'M3.5 5.5h17v13h-17zM3.5 10h17M3.5 14.5h17M9 5.5v13',
    kanban: 'M3.5 4.5h17v15h-17zM9 4.5v15M15 4.5v15M5.5 8h1.5M11 8h2M16.5 8h2M5.5 11.5h1.5M11 11.5h2',
    calendar: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4M8 14h1M12 14h1M16 14h1',
    gallery: 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z',
    timeline: 'M4 5.5h11M4 12h16M4 18.5h8M17.5 4.2v2.6M19.5 16.9v3.2',
    matrix: 'M3.5 3.5h17v17h-17zM12 3.5v17M3.5 12h17',
    grid: 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z',
    columns: 'M3.5 4.5h17v15h-17zM12 4.5v15',
    layout: 'M3.5 4.5h17v15h-17zM3.5 9h17M9.5 9v10.5',
    sticky: 'M4.5 4.5h15v9.5L14 19.5H4.5zM19.5 14H14v5.5',
    pen: 'M3.5 20.5l1-4.6L15.7 4.7a2.4 2.4 0 013.4 3.4L7.9 19.3zM13.8 6.6l3.4 3.4',
    eraser: 'M8.5 20.5h11M4.4 16.6l6.4-6.4 5.6 5.6-4.9 4.9H7.2zM10.8 10.2l4.5-4.5a1.6 1.6 0 012.3 0l3.3 3.3a1.6 1.6 0 010 2.3l-4.5 4.5',
    shapes: 'M9.5 4.5l5 8h-10zM16.5 13a4 4 0 100 8 4 4 0 000-8zM3.5 14h7v7h-7z',
    connector: 'M5.5 6.5a2 2 0 100 .01M18.5 17.5a2 2 0 100 .01M7.4 7.2c6 .8 8.6 3.7 9.6 8.6',

    /* ---- actions ---- */
    search: 'M11 4.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.3-4.3',
    'search-plus': 'M11 4.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.3-4.3M11 8.2v5.6M8.2 11h5.6',
    filter: 'M3.5 5.5h17l-6.5 7.6V19l-4 1.5v-7.4z',
    sort: 'M7 4.5v15M7 4.5L4 8M7 4.5L10 8M17 19.5v-15M17 19.5L14 16M17 19.5l3-3.5',
    trash: 'M4.5 6.5h15M9.5 6.5V4.8a1 1 0 011-1h3a1 1 0 011 1v1.7M6.5 6.5l.9 12.6a1 1 0 001 .9h7.2a1 1 0 001-.9l.9-12.6M10 10v6M14 10v6',
    copy: 'M8.5 8.5h11v11h-11zM15.5 8.5V5.5a1 1 0 00-1-1h-9a1 1 0 00-1 1v9a1 1 0 001 1h3',
    duplicate: 'M8.5 8.5h11v11h-11zM15.5 8.5V5.5a1 1 0 00-1-1h-9a1 1 0 00-1 1v9a1 1 0 001 1h3M14 11.5v5M11.5 14h5',
    cut: 'M6 4l12 15M18 4L6 19M6.5 17.5a2.4 2.4 0 100 .01M17.5 17.5a2.4 2.4 0 100 .01',
    paste: 'M9 4.5h6M8 6.5H6a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-12a1 1 0 00-1-1h-2M8.5 3.5h7v3.5h-7z',
    save: 'M5.5 4.5h11L19.5 7.5v12h-15zM8 4.5v5h7v-5M8 19.5v-6h8v6',
    download: 'M12 3.5v11.5M7.5 11L12 15.5 16.5 11M4.5 19.5h15',
    upload: 'M12 16V4.5M7.5 9L12 4.5 16.5 9M4.5 19.5h15',
    share: 'M17.5 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6.5 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM17.5 15.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM8.8 10.9l6-3.2M8.8 13.2l6 3.1',
    'share-ios': 'M12 3.5v11M8.5 7L12 3.5 15.5 7M6 11H5a.5.5 0 00-.5.5v8A.5.5 0 005 20h14a.5.5 0 00.5-.5v-8a.5.5 0 00-.5-.5h-1',
    pin: 'M9 3.5h6l-.8 5.2 3.3 3.3H6.5l3.3-3.3zM12 12v8.5',
    'pin-off': 'M9 3.5h6l-.8 5.2 1.6 1.6M8 8.9L6.5 12h8.2M12 14.5v6M4 4l16 16',
    star: 'M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.2 6.1L12 17.4l-5.5 2.9 1.2-6.1L3.2 9.9l6.1-.8z',
    bookmark: 'M6.5 3.5h11v17l-5.5-4-5.5 4z',
    settings: 'M12 9.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6zM19.4 14.4a1.5 1.5 0 00.3 1.7l.1.1a1.9 1.9 0 11-2.7 2.7l-.1-.1a1.5 1.5 0 00-1.7-.3 1.5 1.5 0 00-.9 1.4v.2a1.9 1.9 0 01-3.8 0v-.1a1.5 1.5 0 00-1-1.4 1.5 1.5 0 00-1.7.3l-.1.1a1.9 1.9 0 11-2.7-2.7l.1-.1a1.5 1.5 0 00.3-1.7 1.5 1.5 0 00-1.4-.9h-.2a1.9 1.9 0 010-3.8h.1a1.5 1.5 0 001.4-1 1.5 1.5 0 00-.3-1.7l-.1-.1a1.9 1.9 0 112.7-2.7l.1.1a1.5 1.5 0 001.7.3h.1a1.5 1.5 0 00.9-1.4v-.2a1.9 1.9 0 013.8 0v.1a1.5 1.5 0 00.9 1.4 1.5 1.5 0 001.7-.3l.1-.1a1.9 1.9 0 112.7 2.7l-.1.1a1.5 1.5 0 00-.3 1.7v.1a1.5 1.5 0 001.4.9h.2a1.9 1.9 0 010 3.8h-.1a1.5 1.5 0 00-1.4.9z',
    sliders: 'M4 8h9M17 8h3M4 16h3M11 16h9M15 5.2v5.6M9 13.2v5.6',
    refresh: 'M20 5.5v5h-5M4 18.5v-5h5M19.2 13a7.5 7.5 0 01-12.4 3.4L4 13.5M4.8 11a7.5 7.5 0 0112.4-3.4L20 10.5',
    undo: 'M4 9.5h9.5a5 5 0 010 10H8M4 9.5l4-4M4 9.5l4 4',
    redo: 'M20 9.5h-9.5a5 5 0 000 10H16M20 9.5l-4-4M20 9.5l-4 4',
    play: 'M7 4.8l12 7.2-12 7.2z',
    pause: 'M8.5 5v14M15.5 5v14',
    eye: 'M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zM12 9.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6z',
    'eye-off': 'M9.9 5.2A9.6 9.6 0 0112 5c6 0 9.5 7 9.5 7a17 17 0 01-2.7 3.6M6.4 6.9A17 17 0 002.5 12S6 19 12 19a9.4 9.4 0 004.3-1M4 4l16 16M10.2 10.4a2.4 2.4 0 003.3 3.4',
    lock: 'M6.5 10.5h11v9h-11zM8.5 10.5V7.8a3.5 3.5 0 017 0v2.7M12 14v2.5',
    unlock: 'M6.5 10.5h11v9h-11zM8.5 10.5V7.8a3.5 3.5 0 016.6-1.6M12 14v2.5',
    key: 'M15.5 3.5a5 5 0 100 10 5 5 0 000-10zM12 12L4 20M6.5 17.5l2 2M9 15l2 2',
    keyboard: 'M3.5 6.5h17v11h-17zM6.5 9.5h.01M9.5 9.5h.01M12.5 9.5h.01M15.5 9.5h.01M18 9.5h.01M6.5 12.5h.01M9.5 12.5h.01M12.5 12.5h.01M15.5 12.5h.01M18 12.5h.01M8 15.3h8',
    command: 'M8.5 4.5a2 2 0 110 4h11a2 2 0 100-4 2 2 0 00-2 2v11a2 2 0 104 0 2 2 0 00-2-2h-11a2 2 0 100 4 2 2 0 002-2v-11a2 2 0 00-2-2z',
    scissors: 'M6 4l12 15M18 4L6 19M6.5 17.5a2.4 2.4 0 100 .01M17.5 17.5a2.4 2.4 0 100 .01',
    move: 'M12 3.5v17M3.5 12h17M9 6.5L12 3.5l3 3M9 17.5l3 3 3-3M6.5 9L3.5 12l3 3M17.5 9l3 3-3 3',
    drag: 'M9 6.2h.01M15 6.2h.01M9 12h.01M15 12h.01M9 17.8h.01M15 17.8h.01',
    maximize: 'M4 9V4.5h5M20 15v4.5h-5M15 4.5h5V9M9 19.5H4v-4.5',
    scan: 'M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3M3.5 12h17',
    camera: 'M3.5 7.5h3.8l1.5-2.3h6.4l1.5 2.3h3.8v11h-17zM12 9.8a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z',
    'text-recognition': 'M4 8V5.5a1 1 0 011-1h3M20 8V5.5a1 1 0 00-1-1h-3M4 16v2.5a1 1 0 001 1h3M20 16v2.5a1 1 0 01-1 1h-3M8 9h8M8 12.5h8M8 16h5',

    /* ---- status & feedback ---- */
    info: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 11v5.5M12 7.8h.01',
    help: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM9.6 9.3a2.5 2.5 0 014.8.9c0 1.7-2.4 2-2.4 3.8M12 17h.01',
    warning: 'M12 3.8L21 19.5H3zM12 9.5v4.2M12 16.6h.01',
    error: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6',
    success: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM8 12.2l2.8 2.8L16.2 9.5',
    bell: 'M12 3.5a5.5 5.5 0 00-5.5 5.5c0 5-2 6.5-2 6.5h15s-2-1.5-2-6.5A5.5 5.5 0 0012 3.5zM10.3 19a2 2 0 003.4 0',
    'bell-off': 'M9 4.4A5.5 5.5 0 0117.5 9c0 2 .3 3.5.8 4.6M6.6 6.7A5.5 5.5 0 006.5 9c0 5-2 6.5-2 6.5h12M10.3 19a2 2 0 003.4 0M4 4l16 16',
    clock: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7v5.3l3.3 2',
    history: 'M3.6 10.5A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-6-2.5M3.5 4.5v6h6M12 7.5v5l3.2 1.9',
    flame: 'M12 3.5s.8 2.6-1 4.6c-1.5 1.7-3.8 3-3.8 6A4.9 4.9 0 0012 19a4.9 4.9 0 004.8-4.9c0-3.6-3.3-5.2-3.3-8.1 0 0-1 1.6-2.3 2.1',
    trophy: 'M7.5 4.5h9v4.2a4.5 4.5 0 11-9 0zM7.5 6H5a2 2 0 002 2.8M16.5 6H19a2 2 0 01-2 2.8M10 13.2v3M14 13.2v3M8 19.5h8M9.5 16.2h5v3.3h-5z',
    target: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.3a.7.7 0 100 1.4.7.7 0 000-1.4z',
    zap: 'M13.5 3.5L5 13.5h6l-.5 7 8.5-10h-6z',
    sparkle: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7zM5.5 3l.5 1.4 1.4.5-1.4.5L5.5 7 5 5.4 3.6 4.9 5 4.4z',
    heart: 'M12 20l-1.3-1.2C6.1 14.7 3.5 12.3 3.5 9.3A4.4 4.4 0 018 4.8a4.8 4.8 0 014 2 4.8 4.8 0 014-2 4.4 4.4 0 014.5 4.5c0 3-2.6 5.4-7.2 9.5z',
    activity: 'M3.5 12.5h4L10 5.5l4 13 2.5-6h4',

    /* ---- theme & appearance ---- */
    sun: 'M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4',
    moon: 'M20 13.6A8.2 8.2 0 019.8 3.7 8.6 8.6 0 1020 13.6z',
    contrast: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 3.5v17',
    droplet: 'M12 3.5l5 5.9a6.6 6.6 0 11-10 0z',
    palette: 'M12 3.5a8.5 8.5 0 000 17c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2a1.7 1.7 0 011.2-2.9h2A4.1 4.1 0 0020.5 11c0-4.2-3.8-7.5-8.5-7.5zM7.5 11.5h.01M10 7.8h.01M14.5 7.8h.01',
    type: 'M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6',
    'font-size': 'M3 17.5V6h8v11.5M3 12h8M14 17.5V9.5h6v8M14 13.5h6',
    layers: 'M12 3.5l8.5 4.5-8.5 4.5L3.5 8zM3.5 12.5l8.5 4.5 8.5-4.5M3.5 16.5l8.5 4.5 8.5-4.5',
    device: 'M4.5 4.5h15v11h-15zM9 19.5h6M12 15.5v4',
    mobile: 'M7.5 3.5h9v17h-9zM10.5 17.8h3',
    monitor: 'M3.5 4.5h17v11h-17zM8 19.5h8M12 15.5v4',

    /* ---- misc ---- */
    globe: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM3.5 12h17M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5z',
    user: 'M12 4a3.8 3.8 0 100 7.6A3.8 3.8 0 0012 4zM4.5 20.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6',
    home: 'M3.5 10.5L12 3.5l8.5 7M6 9.2v10.3h12V9.2M10 19.5v-5.5h4v5.5',
    compass: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM15.5 8.5l-2 5-5 2 2-5z',
    map: 'M3.5 6l5.5-2.5 6 2.5 5.5-2.5v14.5L15 20l-6-2.5L3.5 20zM9 3.5v14M15 6v14',
    box: 'M12 3.5l8.5 4v9l-8.5 4-8.5-4v-9zM3.5 7.5l8.5 4 8.5-4M12 11.5v9',
    puzzle: 'M9 4.5h2.2a1.3 1.3 0 112.6 0H16a1 1 0 011 1v2.2a1.3 1.3 0 100 2.6V13a1 1 0 01-1 1h-2.2a1.3 1.3 0 10-2.6 0H9a1 1 0 01-1-1v-2.5a1.4 1.4 0 110-2.8V5.5a1 1 0 011-1z',
    repeat: 'M4 8.5h13.5a2.5 2.5 0 012.5 2.5v1M4 8.5l3.5-3.5M4 8.5L7.5 12M20 15.5H6.5A2.5 2.5 0 014 13v-1M20 15.5L16.5 19M20 15.5L16.5 12',
    shuffle: 'M4 6.5h3.5c3 0 3.5 11 6.5 11H20M4 17.5h3.5c1.6 0 2.5-3 3.2-5.7M20 6.5h-6M17 3.5l3 3-3 3M17 14.5l3 3-3 3',
    brain: 'M9.5 4.2A2.7 2.7 0 006.8 7a2.6 2.6 0 00-1.8 4.4A2.7 2.7 0 006 16a2.6 2.6 0 003.5 2.7V4.2zM14.5 4.2A2.7 2.7 0 0117.2 7a2.6 2.6 0 011.8 4.4A2.7 2.7 0 0118 16a2.6 2.6 0 01-3.5 2.7V4.2z',
    coffee: 'M4.5 7.5h12v6a4.5 4.5 0 01-9 0zM16.5 9h1.8a2.2 2.2 0 010 4.4h-1.8M3.5 20.5h14M7 3v2M10.5 3v2M14 3v2',
    seedling: 'M12 20.5v-7M12 13.5C12 10 9.5 7.5 5.5 7c-.4 4.2 2.2 6.8 6.5 6.5zM12 13.5c0-3.5 2.5-6 6.5-6.5.4 4.2-2.2 6.8-6.5 6.5z',
    anchor: 'M12 4a2.2 2.2 0 100 4.4A2.2 2.2 0 0012 4zM12 8.4v12M4 13.5a8 8 0 0016 0M4 13.5h3M20 13.5h-3',
  };

  /** Icons whose paths should be filled rather than stroked. */
  const FILLED = new Set(['play']);

  const DEFAULTS = { size: 20, stroke: 1.6, viewBox: '0 0 24 24' };

  function pathFor(name) {
    if (P[name]) return P[name];
    console.warn('[icons] unknown icon "' + name + '" — falling back to a dot');
    return 'M12 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z';
  }

  /** Returns an SVG markup string, safe to inject with innerHTML. */
  function svg(name, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const filled = FILLED.has(name) || o.filled;
    const attrs = [
      'viewBox="' + o.viewBox + '"',
      'width="' + o.size + '"',
      'height="' + o.size + '"',
      'fill="' + (filled ? 'currentColor' : 'none') + '"',
      'stroke="' + (filled ? 'none' : 'currentColor') + '"',
      'stroke-width="' + o.stroke + '"',
      'stroke-linecap="round"',
      'stroke-linejoin="round"',
      'class="icon icon-' + name + (o.className ? ' ' + o.className : '') + '"',
      'aria-hidden="true"',
      'focusable="false"',
    ];
    return '<svg ' + attrs.join(' ') + '><path d="' + pathFor(name) + '"/></svg>';
  }

  /** Returns a live SVGElement — preferred inside DOM-building code. */
  function node(name, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const filled = FILLED.has(name) || o.filled;
    const el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', o.viewBox);
    el.setAttribute('width', o.size);
    el.setAttribute('height', o.size);
    el.setAttribute('fill', filled ? 'currentColor' : 'none');
    el.setAttribute('stroke', filled ? 'none' : 'currentColor');
    el.setAttribute('stroke-width', o.stroke);
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    el.setAttribute('class', 'icon icon-' + name + (o.className ? ' ' + o.className : ''));
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', pathFor(name));
    el.appendChild(path);
    return el;
  }

  /** Replace <i data-icon="name"> placeholders anywhere in a subtree. */
  function hydrate(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll('[data-icon]:not([data-icon-done])');
    for (let i = 0; i < nodes.length; i++) {
      const host = nodes[i];
      const name = host.getAttribute('data-icon');
      const size = parseInt(host.getAttribute('data-icon-size') || '', 10) || DEFAULTS.size;
      host.innerHTML = '';
      host.appendChild(node(name, { size: size }));
      host.setAttribute('data-icon-done', '');
    }
  }

  function has(name) { return Object.prototype.hasOwnProperty.call(P, name); }
  function names() { return Object.keys(P).sort(); }

  N.icons = { svg: svg, node: node, hydrate: hydrate, has: has, names: names, paths: P };
})(window.NODALIS = window.NODALIS || {});

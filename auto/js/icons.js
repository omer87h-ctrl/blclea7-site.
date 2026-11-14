/* Original BL CLEA Tools interface drawings. No external icon library. */
const drawings = Object.freeze({
  auto: '<path d="M4 15V9l2-4h12l2 4v6M4 10h16M7 10l1 3h8l1-3M6 16v3m12-3v3M2 15h20v2H2z"/><path d="M7 6h10M6 14h1m10 0h1"/>',
  electric: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/><path d="M3 4h3M18 20h3"/>',
  build: '<path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6M8 10h2m4 0h2M3 9l9-8 9 8"/>',
  climate: '<path d="M12 2v20M3.4 7l17.2 10M3.4 17 20.6 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M4 14l4 1-1 4M20 10l-4-1 1-4"/>',
  workshop: '<path d="m3 21 8-8M14 10l7-7M16 3l5 5M2 6l4-4 6 6-4 4zM6 10l8 8M14 18l4 4 4-4-4-4z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  save: '<path d="M4 3h13l4 4v14H3V3h1zm3 0v6h10V3M7 21v-8h10v8"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  shield: '<path d="m12 2 8 3v6c0 5-3 8-8 11-5-3-8-6-8-11V5zM8 12l3 3 5-6"/>',
  bluetooth: '<path d="M12 2v20l7-6L6 5m6-3 7 6L6 19"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  file: '<path d="M5 2h9l5 5v15H5zM14 2v6h5M8 12h8m-8 4h6"/>',
  trash: '<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  settings: '<path d="m9 3 1-1h4l1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  external: '<path d="M14 3h7v7m0-7L11 13M10 4H4v16h16v-6"/>',
  copy: '<path d="M8 8h13v13H8zM16 8V3H3v13h5"/>',
  print: '<path d="M7 8V2h10v6M7 17H3V8h18v9h-4M7 14h10v8H7zM17 11h1"/>',
  refresh: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
  warning: '<path d="M12 3 1 21h22zM12 9v5m0 3v.5"/>',
  home: '<path d="m2 11 10-9 10 9M5 9v12h5v-7h4v7h5V9"/>',
  tool: '<path d="M21 3a6 6 0 0 1-8 8L5 21l-3-3 10-8a6 6 0 0 1 8-8l-4 4 2 2z"/>',
  layers: '<path d="m12 2 10 6-10 6L2 8zm-10 10 10 6 10-6M2 16l10 6 10-6"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1m3 0h1m3 0h.1M8 15h1m3 0h1m3 0h.1M8 19h1m3 0h4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
  undo: '<path d="M3 10h11a7 7 0 0 1 0 14M3 10l6-6m-6 6 6 6"/>',
});

/** Fixed, trusted SVG drawings. Unknown names use the original general-tool mark. */
export function icon(name, size = 24) {
  const n = Number.isFinite(size) ? Math.max(12, Math.min(128, Math.round(size))) : 24;
  const drawing = Object.hasOwn(drawings, name) ? drawings[name] : drawings.tool;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawing}</svg>`;
}

export const ICON_NAMES = Object.freeze(Object.keys(drawings));

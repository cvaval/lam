"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// _audit_render.tsx
var import_react3 = __toESM(require("react"));
var import_server = require("react-dom/server");
var import_fs = require("fs");

// src/components/OfficialText.tsx
var import_link = __toESM(require("next/link"));

// src/lib/doc/officiel.ts
var BULLET_RE = /^([•·▪‣◦●ß*]|[-–—])\s+(.+)$/;
var NUMBER_RE = /^(\(?\d{1,3}\)|\d{1,3}°\)|\d{1,3}(?:\.\d{1,3})+\.?|\d{1,3}\s?[-–]|\d{1,3}[.)°]|[ivx]{2,4}[.)]|[a-z][.)])\s+(.+)$/i;
function isPageNumber(line) {
  return /^\d{1,3}$/.test(line);
}
function isContinuation(line) {
  return /^[a-zà-öø-ÿ("']/.test(line);
}
function isHeading(line) {
  return line.length <= 64 && !/[.,;:!?]$/.test(line);
}
function parseOfficialText(raw) {
  const blocks = [];
  let para = null;
  function flushPara() {
    if (!para) return;
    blocks.push({ kind: "p", text: para.text, heading: para.single && isHeading(para.text) });
    para = null;
  }
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) {
      flushPara();
      continue;
    }
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      flushPara();
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul") last.items.push(bullet[2]);
      else blocks.push({ kind: "ul", items: [bullet[2]] });
      continue;
    }
    const numbered = line.match(NUMBER_RE);
    if (numbered) {
      flushPara();
      const item = { marker: numbered[1].replace(/\s+/g, ""), text: numbered[2] };
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ol") last.items.push(item);
      else blocks.push({ kind: "ol", items: [item] });
      continue;
    }
    if (isContinuation(line)) {
      if (para && !isPageNumber(para.text)) {
        para = { text: `${para.text} ${line}`, single: false };
        continue;
      }
      const last = blocks[blocks.length - 1];
      if (!para && last?.kind === "ul") {
        last.items[last.items.length - 1] += ` ${line}`;
        continue;
      }
      if (!para && last?.kind === "ol") {
        last.items[last.items.length - 1].text += ` ${line}`;
        continue;
      }
    }
    flushPara();
    para = { text: line, single: true };
  }
  flushPara();
  return blocks;
}

// src/lib/doc/anchors.ts
function anchorFromDesignation(desig) {
  let s = String(desig).toLowerCase().trim();
  s = s.replace(/^premier\b/, "1");
  s = s.replace(/(\d)\s*(?:er|ère)(?=[\s.\-]|$)/g, "$1");
  s = s.replace(/(\d)\s*(bis|ter|quater)/g, "$1-$2");
  s = s.replace(/[.\s]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `art-${s}`;
}
function articleAnchorFromNum(num) {
  const s = String(num).trim();
  if (!s) return "art-";
  return anchorFromDesignation(s);
}
function articleAnchorFromHeading(textLine) {
  const m = textLine.match(
    /^(?:art(?:icle)?\.?|section)\s+(premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)/i
  );
  if (m) return anchorFromDesignation(m[1]);
  const p = textLine.match(/^articles\s+(\d{1,4}(?:[.\-]\d+)*)\.-/i);
  if (p) return anchorFromDesignation(p[1]);
  return void 0;
}

// src/lib/doc/artrefs.ts
var ART_NUM_TAIL = String.raw`(?:-\d{1,2}(?!\d)|\.\d{1,2}(?!\d)(?!\)))*(?:\s*(?:bis|ter))?`;
var ART_REF_RE = new RegExp(
  String.raw`\b(?:articles?|art\.)\s+\d{1,4}(?!\d)${ART_NUM_TAIL}(?:\s*(?:,|;|et|à)\s*\d{1,4}(?!\d)${ART_NUM_TAIL})*`,
  "gi"
);
var ART_OR_SEC_REF_RE = new RegExp(
  String.raw`\b(?:articles?|art\.|sections?)\s+\d{1,4}(?!\d)${ART_NUM_TAIL}(?:\s*(?:,|;|et|à)\s*\d{1,4}(?!\d)${ART_NUM_TAIL})*`,
  "gi"
);
var ART_NUM_RE = new RegExp(String.raw`(\d{1,4}(?!\d)${ART_NUM_TAIL})`, "i");
var ART_EXT_AFTER = /^\s*(?:[:—–-]\s*)?(?:\(?\s*(?:du|de\s+la|de\s+l['’]|des)\s+(?:d[ée]cret|loi|ordonnance|arr[êe]t[ée]|constitution|code\s+\S)|\(?\s*lois?\s+de\s+finances|\(?\s*loi\s+sur)/i;
var ART_EXT_BEFORE = /(?:d[ée]cret|loi|ordonnance|arr[êe]t[ée]|constitution)\b[^.;:]{0,80}?(?:en|à|dans)\s+(?:ses|son|sa|leurs)\s*$/i;

// src/lib/doc/crossref.ts
var ARTICLE_REF = /\barticle\s+(\d{1,3})(?:\s*,?\s*(?:alin[ée]as?|al\.?)\s*\d+)?\s+de\s+(?:la\s+|l['’]\s*)?(pr[ée]sente\s+)?(lettre[-\s])?circulaire(?:\s+(?:n[°ºo]?\s*\.?\s*)?(\d{1,3}(?:-\d{1,2})?))?/gi;
var BARE_REF = /\b(lettre[-\s])?circulaire\s+(?:n[°ºo]?\s*\.?\s*)?(\d{1,3}(?:-\d{1,2})?)\b/gi;
function refKey(numStr) {
  const [b, r] = numStr.split("-");
  return { base: Number(b), rev: r && /^[1-9]$/.test(r) ? Number(r) : null };
}
function scanRefs(text) {
  const hits = [];
  const consumed = [];
  for (const m of text.matchAll(ARTICLE_REF)) {
    const present = Boolean(m[2]);
    const numStr = m[4];
    if (!present && !numStr) continue;
    const serie = m[3] ? "LETTRE" : "CIRCULAIRE";
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const { base, rev } = present || !numStr ? { base: 0, rev: null } : refKey(numStr);
    hits.push({ start, end, ref: { serie, base, rev, article: Number(m[1]), present } });
    consumed.push([start, end]);
  }
  for (const m of text.matchAll(BARE_REF)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (consumed.some(([s, e]) => start < e && end > s)) continue;
    const serie = m[1] ? "LETTRE" : "CIRCULAIRE";
    const { base, rev } = refKey(m[2]);
    hits.push({ start, end, ref: { serie, base, rev, article: null, present: false } });
  }
  return hits.sort((a, b) => a.start - b.start);
}
function segmentText(text, hrefFor) {
  const hits = scanRefs(text);
  if (!hits.length) return [{ text }];
  const segs = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start < pos) continue;
    if (h.start > pos) segs.push({ text: text.slice(pos, h.start) });
    const href = hrefFor(h.ref);
    segs.push(href ? { text: text.slice(h.start, h.end), href } : { text: text.slice(h.start, h.end) });
    pos = h.end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}

// src/lib/doc/richblocks.ts
var HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
var CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
var MAX_ROWS = 80;
var MAX_COLS = 24;
var MAX_CELL = 600;
var MAX_TEXT = 4e3;
function safeColor(v) {
  return typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : void 0;
}
function clampInt(v, min, max) {
  const n = typeof v === "number" ? Math.floor(v) : NaN;
  if (!Number.isFinite(n) || n <= 1) return void 0;
  return Math.min(Math.max(n, min), max);
}
function cleanStr(v, max) {
  return typeof v === "string" ? v.replace(CONTROL_CHARS, "").slice(0, max) : "";
}
function sanitizeCell(raw) {
  const c = raw ?? {};
  const align = c.align === "center" || c.align === "right" ? c.align : c.align === "left" ? "left" : void 0;
  return {
    text: cleanStr(c.text, MAX_CELL),
    header: c.header === true || void 0,
    colSpan: clampInt(c.colSpan, 2, MAX_COLS),
    rowSpan: clampInt(c.rowSpan, 2, MAX_ROWS),
    bg: safeColor(c.bg),
    color: safeColor(c.color),
    align,
    bold: c.bold === true || void 0
  };
}
function sanitizeBlock(raw) {
  const b = raw ?? {};
  if (b.type === "note") {
    const text = cleanStr(b.text, MAX_TEXT);
    if (!text) return null;
    return {
      type: "note",
      text,
      afterText: cleanStr(b.afterText, 160) || void 0,
      untilText: cleanStr(b.untilText, 160) || void 0,
      bg: safeColor(b.bg),
      color: safeColor(b.color)
    };
  }
  if (b.type === "table") {
    const rowsRaw = Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS) : [];
    const rows = rowsRaw.map((r) => Array.isArray(r) ? r : r?.cells).map((r) => Array.isArray(r) ? r.slice(0, MAX_COLS).map(sanitizeCell) : []).filter((r) => r.length > 0);
    if (!rows.length) return null;
    return {
      type: "table",
      caption: cleanStr(b.caption, 300) || void 0,
      afterText: cleanStr(b.afterText, 160) || void 0,
      untilText: cleanStr(b.untilText, 160) || void 0,
      rows
    };
  }
  return null;
}
function parseRichBlocks(json) {
  if (!json) return [];
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const arr = Array.isArray(data) ? data : Array.isArray(data?.blocks) ? data.blocks : [];
  return arr.map(sanitizeBlock).filter((b) => b !== null);
}
function tableShortCaption(t) {
  return (t.caption || t.rows[0]?.find((c) => c.header)?.text || t.rows[0]?.[0]?.text || "").replace(/\s+/g, " ").trim().slice(0, 70);
}
function looseIndexOf(hay, needle, from = 0) {
  const i2 = hay.indexOf(needle, from);
  if (i2 >= 0) return { start: i2, end: i2 + needle.length };
  const collapse = (s) => s.replace(/\s+/g, " ").trim();
  const target = collapse(needle);
  if (target.length < 6) return null;
  const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"), "i");
  const m = re.exec(hay.slice(from));
  return m ? { start: from + m.index, end: from + m.index + m[0].length } : null;
}
function buildBodySegments(body, rich2) {
  if (!rich2.length) return [{ kind: "text", text: body }];
  const cuts = [];
  const tail = [];
  let cursor = 0;
  for (const b of rich2) {
    const hasAfter = Boolean(b.afterText && b.afterText.length >= 6);
    const hasUntil = Boolean(b.untilText && b.untilText.length >= 6);
    const hadAnchor = hasAfter || hasUntil;
    const after = hasAfter ? looseIndexOf(body, b.afterText, cursor) ?? looseIndexOf(body, b.afterText) : null;
    if (hasUntil) {
      const until = looseIndexOf(body, b.untilText, after ? after.end : cursor) ?? looseIndexOf(body, b.untilText);
      if (after && until && until.start > after.end) {
        cuts.push({ start: after.end, end: until.start, block: b });
        cursor = until.start;
        continue;
      }
    } else if (after) {
      cuts.push({ start: after.end, end: after.end, block: b });
      cursor = after.end;
      continue;
    }
    tail.push({ block: b, orphan: hadAnchor });
  }
  cuts.sort((a, b) => a.start - b.start);
  const clean2 = [];
  let lastEnd = -1;
  for (const c of cuts) {
    if (c.start >= lastEnd) {
      clean2.push(c);
      lastEnd = c.end;
    } else {
      tail.push({ block: c.block, orphan: true });
    }
  }
  const segs = [];
  let pos = 0;
  for (const c of clean2) {
    if (c.start > pos) segs.push({ kind: "text", text: body.slice(pos, c.start) });
    segs.push({ kind: "rich", block: c.block });
    pos = c.end;
  }
  if (pos < body.length) segs.push({ kind: "text", text: body.slice(pos) });
  for (const t of tail) segs.push({ kind: "rich", block: t.block, orphan: t.orphan });
  return segs;
}

// src/components/TableActions.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var LBL = {
  copy: { fr: "Copier", en: "Copy", ht: "Kopye" },
  copied: { fr: "Copi\xE9", en: "Copied", ht: "Kopye" },
  title: { fr: "Copier le tableau (collable dans Excel)", en: "Copy table (paste into Excel)", ht: "Kopye tablo a (kole nan Excel)" }
};
function toTsv(rows) {
  const grid = [];
  const carry = [];
  for (const row of rows) {
    const out = [];
    let col = 0;
    let ci = 0;
    while (ci < row.length || col < carry.length) {
      if ((carry[col] ?? 0) > 0) {
        out[col] = "";
        carry[col] -= 1;
        col += 1;
        continue;
      }
      if (ci >= row.length) {
        col += 1;
        continue;
      }
      const c = row[ci++];
      const text = (c.text ?? "").replace(/[\t\n\r]+/g, " ").trim();
      const cs = c.colSpan && c.colSpan > 1 ? c.colSpan : 1;
      const rs = c.rowSpan && c.rowSpan > 1 ? c.rowSpan : 1;
      for (let k = 0; k < cs; k++) {
        out[col] = k === 0 ? text : "";
        if (rs > 1) carry[col] = rs - 1;
        col += 1;
      }
    }
    grid.push(out);
  }
  const width = Math.max(0, ...grid.map((r) => r.length));
  return grid.map((r) => Array.from({ length: width }, (_, i2) => r[i2] ?? "").join("	")).join("\n");
}
function TableActions({ rows, locale }) {
  const [done, setDone] = (0, import_react.useState)(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(toTsv(rows));
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      onClick: copy,
      title: LBL.title[locale] ?? LBL.title.fr,
      "aria-label": LBL.title[locale] ?? LBL.title.fr,
      className: "inline-flex shrink-0 items-center gap-1 rounded-md border border-lank/15 bg-white px-2 py-1 text-xs font-medium text-lank/70 transition hover:bg-lank-50 hover:text-lank",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: "0 0 24 24", className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", strokeWidth: "2", children: done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 13l4 4L19 7", strokeLinecap: "round", strokeLinejoin: "round" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5 15V5a2 2 0 0 1 2-2h10", strokeLinecap: "round" })
        ] }) }),
        done ? LBL.copied[locale] ?? LBL.copied.fr : LBL.copy[locale] ?? LBL.copy.fr
      ]
    }
  );
}

// src/components/TableFilter.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var LBL2 = {
  placeholder: { fr: "Filtrer ce tableau\u2026", en: "Filter this table\u2026", ht: "Filtre tablo sa a\u2026" },
  rows: { fr: "lignes", en: "rows", ht: "liy" }
};
var fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function TableFilter({ total, locale }) {
  const inputRef = (0, import_react2.useRef)(null);
  const [shown, setShown] = (0, import_react2.useState)(total);
  function apply(value) {
    const q = fold(value.trim());
    const fig = inputRef.current?.closest("figure");
    const rows = fig ? Array.from(fig.querySelectorAll("tbody tr")) : [];
    let vis = 0;
    for (const tr of rows) {
      const match = !q || fold(tr.textContent ?? "").includes(q);
      tr.style.display = match ? "" : "none";
      if (!q) tr.classList.toggle("zebra", rows.indexOf(tr) % 2 === 1);
      else if (match) {
        tr.classList.toggle("zebra", vis % 2 === 1);
        vis += 1;
      }
    }
    setShown(q ? vis : total);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "inline-flex items-center gap-1.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "input",
      {
        ref: inputRef,
        type: "text",
        onChange: (e) => apply(e.target.value),
        placeholder: LBL2.placeholder[locale] ?? LBL2.placeholder.fr,
        "aria-label": LBL2.placeholder[locale] ?? LBL2.placeholder.fr,
        className: "w-36 rounded-md border border-lank/15 bg-white px-2 py-1 text-xs text-lank outline-none focus:border-sitwon sm:w-44"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { "aria-live": "polite", "aria-atomic": "true", className: "whitespace-nowrap text-[11px] text-lank/45", children: [
      shown,
      "/",
      total,
      " ",
      LBL2.rows[locale] ?? LBL2.rows.fr
    ] })
  ] });
}

// src/lib/search/highlight.ts
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var ACCENT_VARIANTS = {
  a: "a\xE0\xE2\xE4\xE1\xE3",
  c: "c\xE7",
  e: "e\xE9\xE8\xEA\xEB",
  i: "i\xEE\xEF\xED",
  o: "o\xF4\xF6\xF3\xF5",
  u: "u\xF9\xFB\xFC\xFA",
  y: "y\xFF",
  n: "n\xF1"
};
function foldPattern(term) {
  let out = "";
  for (const ch of term) {
    const variants = ACCENT_VARIANTS[ch];
    out += variants ? `[${variants}]` : escapeRegExp(ch);
  }
  return out;
}
var WORD = "A-Za-z\xC0-\xFF0-9";
function buildHighlightPattern(terms) {
  const usable = terms.filter((t) => t && t.length >= 2).sort((a, b) => b.length - a.length);
  if (!usable.length) return null;
  return usable.map((t) => {
    const p = foldPattern(t);
    return t.length <= 3 ? `(?<![${WORD}])(?:${p})(?![${WORD}])` : p;
  }).join("|");
}
function highlightRegex(terms) {
  const pattern = buildHighlightPattern(terms);
  if (!pattern) return null;
  try {
    return new RegExp(`(${pattern})`, "gi");
  } catch {
    return null;
  }
}

// src/components/OfficialText.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var TABLE_LABEL = { fr: "Tableau", en: "Table", ht: "Tablo" };
var ORPHAN_LABEL = { fr: "emplacement approximatif", en: "approximate position", ht: "kote apwoksimatif" };
var SCROLL_HINT = { fr: "Faites glisser pour voir tout le tableau", en: "Swipe to see the full table", ht: "Glise pou w\xE8 tout tablo a" };
var CIV_MAX_ART = 2047;
var CIV_RE = /C\.\s?civ\.[\s,]*((?:\d{1,6}(?:\s*(?:[-–]|à)\s*\d{1,6})?(?:\s+(?:et\s+)?s\b\.?)?)(?:\s*(?:,|;|et)\s*\d{1,6}(?:\s*(?:[-–]|à)\s*\d{1,6})?(?:\s+(?:et\s+)?s\b\.?)?)*)/gi;
var LOI_RE = /\bloi\s+N[oº°]\.?\s*:?\s*(\d{1,2})\b/gi;
function isNumericCell(s) {
  const t = s.trim();
  if (!t || t.length > 24 || !/\d/.test(t)) return false;
  return /^[(-]?\d[\d\s.,%)/-]*(\s?(HTG|USD|G|\$|%))?$/.test(t);
}
function OfficialText({
  text,
  hrefFor,
  rich: rich2 = [],
  locale = "fr",
  terms,
  amendedAnchors,
  noAnchors = false,
  civRefs = false,
  artRefs,
  sectionRefs = false,
  loiAnchors
}) {
  const segments = buildBodySegments(text, rich2);
  const usedAnchors = /* @__PURE__ */ new Set();
  const hlRe = terms && terms.length ? highlightRegex(terms) : null;
  function hl(value) {
    if (!hlRe) return value;
    const parts = value.split(hlRe);
    if (parts.length <= 1) return value;
    return parts.map((p, i2) => i2 % 2 === 1 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("mark", { className: "hl", children: p }, i2) : p);
  }
  function markerAnchor(marker) {
    if (noAnchors) return void 0;
    if (!/^\(?\d{1,3}[.)\-–°]?\)?$/.test(marker)) return void 0;
    const id = `art-${marker.replace(/\D/g, "")}`;
    if (usedAnchors.has(id)) return void 0;
    usedAnchors.add(id);
    return id;
  }
  function headingAnchor(textLine) {
    if (noAnchors) return void 0;
    const id = articleAnchorFromHeading(textLine);
    if (!id || usedAnchors.has(id)) return void 0;
    usedAnchors.add(id);
    return id;
  }
  function amendMark(id) {
    if (!id || !amendedAnchors?.has(id)) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: `#hist-${id}`, className: "ml-1.5 align-super text-[10px] font-semibold text-sitwon-600 no-underline hover:underline", title: "Article amend\xE9 \u2014 voir l'historique", children: "\u270E modifi\xE9" });
  }
  function loiLinks(value) {
    if (!loiAnchors) return hl(value);
    const out = [];
    let pos = 0;
    let k = 0;
    LOI_RE.lastIndex = 0;
    let m;
    while (m = LOI_RE.exec(value)) {
      const anchor = loiAnchors[m[1]];
      if (!anchor) continue;
      out.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: hl(value.slice(pos, m.index)) }, `p${k++}`));
      out.push(
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: `#${anchor}`, className: "font-medium text-soley-700 hover:underline", children: m[0] }, `l${k++}`)
      );
      pos = m.index + m[0].length;
    }
    if (!out.length) return hl(value);
    out.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: hl(value.slice(pos)) }, `p${k++}`));
    return out;
  }
  function civ(value) {
    const out = [];
    let pos = 0;
    let k = 0;
    CIV_RE.lastIndex = 0;
    let m;
    while (m = CIV_RE.exec(value)) {
      const numsStart = m.index + m[0].length - m[1].length;
      out.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: loiLinks(value.slice(pos, numsStart)) }, `t${k++}`));
      const parts = m[1].split(/(\d+)/);
      out.push(
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: parts.map((p, j) => {
          if (!/^\d+$/.test(p)) return p;
          const n = Number(p);
          const prevNum = parts[j - 2];
          const afterDash = j >= 2 && /^\s*[-–]\s*$/.test(parts[j - 1] ?? "");
          const ordinal = afterDash && typeof prevNum === "string" && p.length < prevNum.length;
          if (n < 1 || n > CIV_MAX_ART || ordinal) return p;
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: `#art-${n}`, className: "font-medium text-soley-700 hover:underline", children: p }, j);
        }) }, `c${k++}`)
      );
      pos = m.index + m[0].length;
    }
    if (!out.length) return loiLinks(value);
    out.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: loiLinks(value.slice(pos)) }, `t${k++}`));
    return out;
  }
  function artLinks(value) {
    if (!artRefs) return hl(value);
    const out = [];
    let pos = 0;
    let k = 0;
    const re = sectionRefs ? ART_OR_SEC_REF_RE : ART_REF_RE;
    re.lastIndex = 0;
    let m;
    while (m = re.exec(value)) {
      if (ART_EXT_AFTER.test(value.slice(m.index + m[0].length))) continue;
      if (ART_EXT_BEFORE.test(value.slice(Math.max(0, m.index - 100), m.index))) continue;
      out.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: hl(value.slice(pos, m.index)) }, `t${k++}`));
      const parts = m[0].split(ART_NUM_RE);
      out.push(
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: parts.map((p, j) => {
          if (!/^\d/.test(p)) return p;
          const anchor = articleAnchorFromNum(p.trim());
          if (!artRefs.has(anchor)) return p;
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: `#${anchor}`, className: "font-medium text-soley-700 hover:underline", children: p }, j);
        }) }, `a${k++}`)
      );
      pos = m.index + m[0].length;
    }
    if (!out.length) return hl(value);
    out.push(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: hl(value.slice(pos)) }, `t${k++}`));
    return out;
  }
  function render(textValue) {
    if (!hrefFor) return civRefs ? civ(textValue) : artRefs ? artLinks(textValue) : hl(textValue);
    const segs = segmentText(textValue, hrefFor);
    if (segs.length === 1 && !segs[0].href) return hl(textValue);
    return segs.map(
      (s, i2) => s.href ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_link.default,
        {
          href: s.href,
          className: "font-medium text-lank underline decoration-lank/30 underline-offset-2 hover:decoration-lank",
          children: hl(s.text)
        },
        i2
      ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: hl(s.text) }, i2)
    );
  }
  function renderTextSegment(textValue, segKey) {
    return parseOfficialText(textValue).map((b, i2) => {
      const key = `${segKey}-${i2}`;
      if (b.kind === "ul") {
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "space-y-1.5 pl-2", children: b.items.map((item, k) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: "flex gap-2.5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { "aria-hidden": true, className: "select-none text-lank/45", children: "\u2022" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: render(item) })
        ] }, k)) }, key);
      }
      if (b.kind === "ol") {
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ol", { className: "space-y-1.5 pl-2", children: b.items.map((item, k) => {
          const id = markerAnchor(item.marker);
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { id, className: "flex scroll-mt-24 gap-2.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "min-w-[2.5ch] shrink-0 font-semibold text-lank", children: item.marker }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: render(item.text) })
          ] }, k);
        }) }, key);
      }
      if (b.heading) {
        const id = headingAnchor(b.text);
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { id, className: "scroll-mt-24 pt-1.5 font-semibold text-lank", children: [
          render(b.text),
          amendMark(id)
        ] }, key);
      }
      const pid = headingAnchor(b.text);
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { id: pid, className: pid ? "scroll-mt-24" : void 0, children: [
        render(b.text),
        amendMark(pid)
      ] }, key);
    });
  }
  function renderCell(cell, c, isHeader, scope, sticky = false) {
    const Tag = isHeader ? "th" : "td";
    const shade = isHeader ? "bg-soley-50" : cell.bg ? "bg-soley-100/50" : "";
    const auto = !isHeader && !cell.align && isNumericCell(cell.text);
    const align = cell.align ?? (auto ? "right" : void 0);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      Tag,
      {
        scope,
        colSpan: cell.colSpan,
        rowSpan: cell.rowSpan,
        style: align ? { textAlign: align } : void 0,
        className: `border border-lank/20 px-2.5 py-1.5 align-top text-lank/90 ${shade} ${auto ? "tabular-nums" : ""} ${sticky ? "sticky top-0 z-10" : ""} ${isHeader || cell.bold ? "font-semibold text-lank" : ""}`,
        children: render(cell.text)
      },
      c
    );
  }
  function renderTable(t, key, num, orphan = false) {
    const firstAllHeader = t.rows[0]?.length > 0 && t.rows[0].every((c) => c.header);
    const headerRow = firstAllHeader ? t.rows[0] : null;
    const bodyRows = firstAllHeader ? t.rows.slice(1) : t.rows;
    const cap = tableShortCaption(t);
    const caption = `${TABLE_LABEL[locale] ?? TABLE_LABEL.fr} ${num}${cap ? " \u2014 " + cap : ""}`;
    const longTable = bodyRows.length > 12;
    const wide = Math.max(1, ...t.rows.map((r) => r.reduce((n, c) => n + (c.colSpan ?? 1), 0))) >= 4;
    const hasRowSpan = bodyRows.some((row) => row.some((c) => (c.rowSpan ?? 1) > 1));
    const showFilter = bodyRows.length >= 8 && !hasRowSpan;
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("figure", { id: `tableau-${num}`, className: "my-4 scroll-mt-24", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mb-1.5 flex flex-wrap items-center justify-between gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("figcaption", { className: "text-sm font-semibold text-lank", children: [
          caption,
          orphan && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "ml-2 text-xs font-normal text-lank/45", children: [
            "(",
            ORPHAN_LABEL[locale] ?? ORPHAN_LABEL.fr,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center gap-2", children: [
          showFilter && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TableFilter, { total: bodyRows.length, locale }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TableActions, { rows: t.rows, locale })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "div",
        {
          role: "region",
          "aria-label": caption,
          tabIndex: 0,
          className: longTable ? "max-h-[78vh] overflow-auto rounded-md border border-lank/10" : "overflow-x-auto",
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("table", { className: "w-full border-collapse text-[13px] text-lank/90", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("caption", { className: "sr-only", children: caption }),
            headerRow && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("tr", { children: headerRow.map((cell, c) => renderCell(cell, c, true, "col", true)) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("tbody", { children: bodyRows.map((row, r) => (
              // Zébrage piloté par classe (et non :nth-child) pour rester correct après
              // filtrage : TableFilter recalcule .zebra sur les lignes visibles.
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("tr", { className: r % 2 === 1 ? "zebra" : void 0, children: row.map((cell, c) => renderCell(cell, c, !!cell.header, cell.header && c === 0 ? "row" : void 0)) }, r)
            )) })
          ] })
        }
      ),
      wide && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "mt-1 text-xs text-lank/40 sm:hidden", children: [
        "\u2194 ",
        SCROLL_HINT[locale] ?? SCROLL_HINT.fr
      ] })
    ] }, key);
  }
  function renderNote(n, key) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "p",
      {
        className: "my-3 rounded-lg border border-soley/40 bg-soley-50 px-4 py-2.5 text-sm leading-relaxed text-lank/90",
        children: render(n.text)
      },
      key
    );
  }
  let tableNo = 0;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "official-text space-y-3 text-[15px] text-lank/90", children: segments.map((seg, i2) => {
    if (seg.kind === "text") return renderTextSegment(seg.text, i2);
    if (seg.block.type === "table") {
      tableNo += 1;
      return renderTable(seg.block, `rich-${i2}`, tableNo, seg.orphan);
    }
    return renderNote(seg.block, `rich-${i2}`);
  }) });
}

// _audit_render.tsx
var rich = parseRichBlocks((0, import_fs.readFileSync)("scripts/data/circ-brh-105-2/_rich.json", "utf8"));
var clean = (0, import_fs.readFileSync)("scripts/data/circ-brh-105-2/_clean.txt", "utf8");
var html = (0, import_server.renderToStaticMarkup)(import_react3.default.createElement(OfficialText, { text: clean, rich, locale: "fr" }));
var i = html.indexOf("Segment : ENTREPRISE");
console.log("--- extrait autour du bandeau ---");
console.log(html.slice(i - 400, i + 300).replace(/></g, ">\n<"));
console.log("--- colSpan pr\xE9sents dans tout le rendu :", (html.match(/colspan=/gi) || []).length);

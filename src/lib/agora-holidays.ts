// Legal-holiday date helpers, ported 1:1 from the legacy SPA
// (equinox-app.html, "Fêtes Légales" section). Shared by the trust bar,
// the fêtes view and the calculator's holiday pickers.

import CT_HOLIDAYS from "@/data/agora/CT_HOLIDAYS.json";
import CT_HOLIDAYS_DECREE from "@/data/agora/CT_HOLIDAYS_DECREE.json";
type Lang = "fr" | "en" | "es";

export interface Holiday {
  d: string;
  fr: string;
  en: string;
  es: string;
  type?: string;
  religious?: boolean;
}

export const HOLIDAYS_MAIN = CT_HOLIDAYS as Holiday[];
export const HOLIDAYS_DECREE = CT_HOLIDAYS_DECREE as Holiday[];

// Easter calculation (Anonymous Gregorian algorithm)
function computeEaster(year: number): Date {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getMovableDate(key: string, year: number): Date {
  const easter = computeEaster(year);
  const d = new Date(easter);
  switch (key) {
    case "MOVABLE_LUNDI_GRAS":
      d.setDate(d.getDate() - 48);
      break;
    case "MOVABLE_MARDI_GRAS":
      d.setDate(d.getDate() - 47);
      break;
    case "MOVABLE_GOOD_FRIDAY":
      d.setDate(d.getDate() - 2);
      break;
    case "MOVABLE_CORPUS":
      d.setDate(d.getDate() + 60);
      break;
    case "MOVABLE_ASH_WED":
      d.setDate(d.getDate() - 46);
      break;
    case "MOVABLE_MAUNDY_THU":
      d.setDate(d.getDate() - 3);
      break;
  }
  return d;
}

export function getHolidayDate(h: Holiday, year: number): Date {
  if (h.d.startsWith("MOVABLE")) return getMovableDate(h.d, year);
  const [m, d] = h.d.split("-").map(Number);
  return new Date(year, m - 1, d);
}

export function fmtDateHoliday(dt: Date, lng: Lang): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const loc = lng === "es" ? "es-ES" : lng === "en" ? "en-US" : "fr-FR";
  return dt.toLocaleDateString(loc, opts);
}

export interface HolidayInRange {
  holiday: Holiday;
  date: Date;
  name: string;
  dateStr: string;
}

export function getHolidaysInRange(startStr: string, endStr: string, lang: Lang): HolidayInRange[] {
  if (!startStr || !endStr) return [];
  const sd = new Date(startStr + "T00:00:00");
  const ed = new Date(endStr + "T00:00:00");
  if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || sd > ed) return [];
  const startY = sd.getFullYear(),
    endY = ed.getFullYear();
  const allH = HOLIDAYS_MAIN.map((h) => ({ h, src: "main" })).concat(
    HOLIDAYS_DECREE.map((h) => ({ h, src: "decree" }))
  );
  const results: HolidayInRange[] = [];
  for (let y = startY; y <= endY; y++) {
    for (let i = 0; i < allH.length; i++) {
      const dt = getHolidayDate(allH[i].h, y);
      if (dt >= sd && dt <= ed) {
        const name = allH[i].h[lang] || allH[i].h.fr;
        results.push({ holiday: allH[i].h, date: dt, name, dateStr: dt.toISOString().slice(0, 10) });
      }
    }
  }
  results.sort((a, b) => a.date.getTime() - b.date.getTime());
  return results;
}

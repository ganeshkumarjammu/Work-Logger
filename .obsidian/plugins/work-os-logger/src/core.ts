// Pure logic for the Work OS Logger. No Obsidian imports, so it can be tested on its own.

export interface TaskStat {
  mins: number;
  project: string;
}

export interface DayStat {
  total: number;
  sessions: number;
  meetingMins: number;
  byProject: Record<string, number>;
  byTask: Record<string, TaskStat>;
  done: string[];
}

export type Days = Record<string, DayStat>;

export const NO_PROJECT = "No project";
export const MEETINGS = "Meetings";
const plain = (p: string): boolean => p === NO_PROJECT || p === MEETINGS;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEVEL_MINS = 600; // 10 focused hours per level

export function emptyDay(): DayStat {
  return { total: 0, sessions: 0, meetingMins: 0, byProject: {}, byTask: {}, done: [] };
}

export function fmtDur(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r === 0 ? `${h}h` : `${h}h ${String(r).padStart(2, "0")}m`;
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: string, n: number): string {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday */
export function dow(date: string): number {
  return toUTC(date).getUTCDay();
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const d = dow(date);
  return addDays(date, d === 0 ? -6 : 1 - d);
}

function isWeekend(date: string): boolean {
  const d = dow(date);
  return d === 0 || d === 6;
}

/**
 * Consecutive days with logged time, ending today. A day with nothing logged
 * yet today does not break the streak; weekends are skipped when asked.
 */
export function streak(days: Days, today: string, skipWeekends: boolean): number {
  let count = 0;
  let d = today;
  for (let i = 0; i < 3700; i++) {
    const logged = (days[d]?.total ?? 0) > 0;
    if (logged) count++;
    else if (d === today) {
      /* today can still be saved */
    } else if (skipWeekends && isWeekend(d)) {
      /* rest day */
    } else break;
    d = addDays(d, -1);
  }
  return count;
}

export function sumRange(days: Days, start: string, nDays: number): number {
  let t = 0;
  for (let i = 0; i < nDays; i++) t += days[addDays(start, i)]?.total ?? 0;
  return t;
}

export function totalAll(days: Days): number {
  return Object.values(days).reduce((a, d) => a + (d.total ?? 0), 0);
}

export function level(totalMins: number): { level: number; into: number; need: number } {
  return {
    level: Math.floor(totalMins / LEVEL_MINS) + 1,
    into: totalMins % LEVEL_MINS,
    need: LEVEL_MINS,
  };
}

export function bar(value: number, max: number, width: number, full = "▰", empty = "▱"): string {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const n = Math.round(ratio * width);
  return full.repeat(n) + empty.repeat(width - n);
}

const HEADING = /^#{1,6}\s/;

/** Adds `line` at the end of the section under `heading`; creates the section if missing. */
export function insertUnderHeading(content: string, heading: string, line: string): string {
  const h = heading.trim();
  const lines = content.split("\n");
  const i = lines.findIndex((l) => l.trim() === h);
  if (i === -1) {
    const base = content.replace(/\s+$/, "");
    return (base ? base + "\n\n" : "") + h + "\n" + line + "\n";
  }
  let end = lines.length;
  for (let j = i + 1; j < lines.length; j++) {
    if (HEADING.test(lines[j])) {
      end = j;
      break;
    }
  }
  let k = end - 1;
  while (k > i && lines[k].trim() === "") k--;
  if (k > i && /^-\s*$/.test(lines[k].trim())) {
    lines.splice(k, 1); // drop an empty "- " placeholder bullet
    k--;
    while (k > i && lines[k].trim() === "") k--;
  }
  lines.splice(k + 1, 0, line);
  const next = lines[k + 2];
  if (next !== undefined && HEADING.test(next)) lines.splice(k + 2, 0, "");
  return lines.join("\n");
}

/** Replaces the text between %% key:start %% and %% key:end %% (Obsidian comments, hidden when reading); appends the block if missing. */
export function replaceAutoBlock(content: string, key: string, body: string): string {
  const s = `%% ${key}:start %%`;
  const e = `%% ${key}:end %%`;
  const a = content.indexOf(s);
  const b = content.indexOf(e);
  const block = `${s}\n${body.trim()}\n${e}`;
  if (a !== -1 && b !== -1 && b > a) return content.slice(0, a) + block + content.slice(b + e.length);
  return content.replace(/\s+$/, "") + "\n\n" + block + "\n";
}

export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
}

export interface WeekSummary {
  total: number;
  sessions: number;
  meetingMins: number;
  byProject: Record<string, number>;
  byTask: Record<string, TaskStat>;
  done: string[];
  perDay: { date: string; total: number }[];
}

export function mergeWeek(days: Days, ws: string): WeekSummary {
  const out: WeekSummary = {
    total: 0, sessions: 0, meetingMins: 0, byProject: {}, byTask: {}, done: [], perDay: [],
  };
  for (let i = 0; i < 7; i++) {
    const date = addDays(ws, i);
    const d = days[date];
    out.perDay.push({ date, total: d?.total ?? 0 });
    if (!d) continue;
    out.total += d.total;
    out.sessions += d.sessions;
    out.meetingMins += d.meetingMins ?? 0;
    for (const [p, m] of Object.entries(d.byProject)) out.byProject[p] = (out.byProject[p] ?? 0) + m;
    for (const [t, s] of Object.entries(d.byTask)) {
      const cur = out.byTask[t] ?? { mins: 0, project: s.project };
      cur.mins += s.mins;
      out.byTask[t] = cur;
    }
    for (const t of d.done ?? []) if (!out.done.includes(t)) out.done.push(t);
  }
  return out;
}

function sortedEntries<T>(rec: Record<string, T>, val: (v: T) => number): [string, T][] {
  return Object.entries(rec).sort((a, b) => val(b[1]) - val(a[1]));
}

function trend(now: number, before: number): string {
  if (now > before) return "▲";
  if (now < before) return "▼";
  return "=";
}

export function buildWeekBlock(days: Days, ws: string): string {
  const w = mergeWeek(days, ws);
  const out: string[] = [];
  out.push(`**Total logged:** ${fmtDur(w.total)} in ${w.sessions} sessions · meetings ${fmtDur(w.meetingMins)} · tasks finished ${w.done.length}`, "");
  out.push("| Day | Time |", "|---|---|");
  for (const d of w.perDay) out.push(`| ${DAY_NAMES[dow(d.date)]} ${d.date} | ${d.total ? fmtDur(d.total) : "–"} |`);
  out.push("", "| Project | Time |", "|---|---|");
  for (const [p, m] of sortedEntries(w.byProject, (v) => v)) out.push(`| ${plain(p) ? p : `[[${p}]]`} | ${fmtDur(m)} |`);
  out.push("", "| Worked on | Project | Time | Finished |", "|---|---|---|---|");
  for (const [t, s] of sortedEntries(w.byTask, (v) => v.mins)) {
    out.push(`| [[${t}]] | ${s.project} | ${fmtDur(s.mins)} | ${w.done.includes(t) ? "✅" : ""} |`);
  }
  return out.join("\n");
}

export function buildStatus(days: Days, today: string): string {
  const t = days[today] ?? emptyDay();
  const out: string[] = [`**Worked on (${fmtDur(t.total)}):**`];
  const tasks = sortedEntries(t.byTask, (v) => v.mins);
  if (tasks.length === 0) out.push("- nothing logged yet");
  for (const [name, s] of tasks) {
    const proj = s.project && !plain(s.project) && s.project !== name ? ` (${s.project})` : "";
    out.push(`- ${name}${proj} — ${fmtDur(s.mins)}${t.done.includes(name) ? " ✅ done" : ""}`);
  }
  return out.join("\n");
}

const p2 = (n: number): string => String(n).padStart(2, "0");

/** Local calendar date of a Date as YYYY-MM-DD. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Local clock time of a Date as HH:MM. */
export function hhmm(d: Date): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** ISO week label such as 2026-W47 for a YYYY-MM-DD date. */
export function isoWeekLabel(date: string): string {
  const thu = toUTC(addDays(date, 4 - (dow(date) || 7)));
  const jan1 = Date.UTC(thu.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1) / 86400000 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${p2(week)}`;
}

export interface InboxItem {
  text: string;
  raw: string;
}

/** List lines under "## Items" (or in the whole note if that heading is missing). */
export function inboxItems(content: string): InboxItem[] {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## Items");
  let end = lines.length;
  if (start !== -1) {
    for (let j = start + 1; j < lines.length; j++) {
      if (HEADING.test(lines[j])) {
        end = j;
        break;
      }
    }
  }
  const items: InboxItem[] = [];
  for (let i = start + 1; i < end; i++) {
    const m = /^\s*[-*]\s+(?:\[[ xX]\]\s+)?(\S.*)$/.exec(lines[i]);
    if (m) items.push({ text: m[1].trim(), raw: lines[i] });
  }
  return items;
}

/** Removes the first (or last) line that is exactly `line`. */
export function removeExactLine(content: string, line: string, fromEnd = false): string {
  const lines = content.split("\n");
  const i = fromEnd ? lines.lastIndexOf(line) : lines.indexOf(line);
  if (i === -1) return content;
  lines.splice(i, 1);
  return lines.join("\n");
}

/** "Call vendor (11-17 14:05)" -> "Call vendor" */
export function stripStamp(text: string): string {
  return text.replace(/\s*\(\d\d-\d\d \d\d:\d\d\)\s*$/, "").trim();
}

/** Reads the "## Time Log" lines of a daily note. The notes are the single source of truth, so any sync method works. */
export function parseDaily(content: string, projects: Set<string>): DayStat {
  const day = emptyDay();
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## Time Log");
  if (start === -1) return day;
  for (let i = start + 1; i < lines.length; i++) {
    if (HEADING.test(lines[i])) break;
    const m = /^\s*- \d\d:\d\d-\d\d:\d\d \[mins:: (\d+)\]\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const mins = parseInt(m[1], 10);
    const rest = m[2];
    const meeting = rest.startsWith(MEETING_MARK);
    const head = rest.split(" — ")[0];
    const links = Array.from(head.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)).map((x) => x[1]);
    const title = links[0] ?? "General work";
    const pKey = links[1] ?? (meeting ? MEETINGS : projects.has(title) ? title : NO_PROJECT);
    day.total += mins;
    day.sessions += 1;
    if (meeting) day.meetingMins += mins;
    day.byProject[pKey] = (day.byProject[pKey] ?? 0) + mins;
    const t = (day.byTask[title] ??= { mins: 0, project: pKey });
    t.mins += mins;
  }
  return day;
}

export const MEETING_MARK = "📅";

function gapOk(a: string, b: string, skipWeekends: boolean): boolean {
  for (let d = addDays(a, 1); d < b; d = addDays(d, 1)) if (!(skipWeekends && isWeekend(d))) return false;
  return true;
}

/** Longest run of logged days ever. */
export function bestStreak(days: Days, skipWeekends: boolean): number {
  const dates = Object.keys(days).filter((d) => days[d].total > 0).sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of dates) {
    run = prev && gapOk(prev, d, skipWeekends) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface Score {
  today: number;
  sessions: number;
  yesterday: number;
  goal: number;
  streak: number;
  best: number;
  week: number;
  lastWeek: number;
  weekDone: number;
  level: number;
  levelInto: number;
  levelNeed: number;
  inbox: number;
  last7: { label: string; mins: number; isToday: boolean }[];
  projects: [string, number][];
  doneToday: string[];
}

export function scoreData(days: Days, today: string, goalMins: number, skipWeekends: boolean, inbox: number): Score {
  const t = days[today] ?? emptyDay();
  const ws = weekStart(today);
  const week = mergeWeek(days, ws);
  const lv = level(totalAll(days));
  const st = streak(days, today, skipWeekends);
  return {
    today: t.total,
    sessions: t.sessions,
    yesterday: days[addDays(today, -1)]?.total ?? 0,
    goal: goalMins,
    streak: st,
    best: Math.max(st, bestStreak(days, skipWeekends)),
    week: week.total,
    lastWeek: sumRange(days, addDays(ws, -7), 7),
    weekDone: week.done.length,
    level: lv.level,
    levelInto: lv.into,
    levelNeed: lv.need,
    inbox,
    last7: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      return { label: DAY_NAMES[dow(d)], mins: days[d]?.total ?? 0, isToday: d === today };
    }),
    projects: sortedEntries(week.byProject, (v) => v),
    doneToday: t.done,
  };
}

export interface Timer {
  path: string;
  title: string;
  start: number;
  kind: "work" | "meeting";
}

/** The running timer lives in a note so it follows you between devices. */
export function buildNow(t: Timer | null): string {
  const foot = "\n\n> Written by Work OS so the running timer follows you between laptop and phone. Do not edit by hand.\n";
  if (!t) return `---\ntype: timer\n---\n# Now\n\nNothing is being timed.${foot}`;
  return [
    "---", "type: timer",
    `timer_path: ${JSON.stringify(t.path)}`, `timer_title: ${JSON.stringify(t.title)}`,
    `timer_start: ${t.start}`, `timer_kind: ${t.kind}`,
    "---", "# Now", "", `▶ Working on [[${t.title}]] since ${hhmm(new Date(t.start))} (${ymd(new Date(t.start))}).`,
  ].join("\n") + foot;
}

export function parseNow(content: string): Timer | null {
  const fm = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!fm) return null;
  const get = (k: string): string | null => {
    const m = new RegExp(`^${k}: (.*)$`, "m").exec(fm[1]);
    return m ? m[1].trim() : null;
  };
  const start = Number(get("timer_start"));
  const rawPath = get("timer_path");
  if (!rawPath || !start) return null;
  try {
    const path = String(JSON.parse(rawPath));
    const rawTitle = get("timer_title");
    const title = rawTitle ? String(JSON.parse(rawTitle)) : path;
    return { path, title, start, kind: get("timer_kind") === "meeting" ? "meeting" : "work" };
  } catch {
    return null;
  }
}

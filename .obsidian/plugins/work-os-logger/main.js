"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WorkOSLogger
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/core.ts
var NO_PROJECT = "No project";
var MEETINGS = "Meetings";
var plain = (p) => p === NO_PROJECT || p === MEETINGS;
var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var LEVEL_MINS = 600;
function emptyDay() {
  return { total: 0, sessions: 0, meetingMins: 0, byProject: {}, byTask: {}, done: [] };
}
function fmtDur(mins) {
  const m = Math.max(0, Math.round(mins));
  const h2 = Math.floor(m / 60);
  const r = m % 60;
  if (h2 === 0) return `${r}m`;
  return r === 0 ? `${h2}h` : `${h2}h ${String(r).padStart(2, "0")}m`;
}
function toUTC(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(date, n) {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function dow(date) {
  return toUTC(date).getUTCDay();
}
function weekStart(date) {
  const d = dow(date);
  return addDays(date, d === 0 ? -6 : 1 - d);
}
function isWeekend(date) {
  const d = dow(date);
  return d === 0 || d === 6;
}
function streak(days, today, skipWeekends) {
  var _a, _b;
  let count = 0;
  let d = today;
  for (let i = 0; i < 3700; i++) {
    const logged = ((_b = (_a = days[d]) == null ? void 0 : _a.total) != null ? _b : 0) > 0;
    if (logged) count++;
    else if (d === today) {
    } else if (skipWeekends && isWeekend(d)) {
    } else break;
    d = addDays(d, -1);
  }
  return count;
}
function sumRange(days, start, nDays) {
  var _a, _b;
  let t = 0;
  for (let i = 0; i < nDays; i++) t += (_b = (_a = days[addDays(start, i)]) == null ? void 0 : _a.total) != null ? _b : 0;
  return t;
}
function totalAll(days) {
  return Object.values(days).reduce((a, d) => {
    var _a;
    return a + ((_a = d.total) != null ? _a : 0);
  }, 0);
}
function level(totalMins) {
  return {
    level: Math.floor(totalMins / LEVEL_MINS) + 1,
    into: totalMins % LEVEL_MINS,
    need: LEVEL_MINS
  };
}
var HEADING = /^#{1,6}\s/;
function insertUnderHeading(content, heading, line) {
  const h2 = heading.trim();
  const lines = content.split("\n");
  const i = lines.findIndex((l) => l.trim() === h2);
  if (i === -1) {
    const base = content.replace(/\s+$/, "");
    return (base ? base + "\n\n" : "") + h2 + "\n" + line + "\n";
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
    lines.splice(k, 1);
    k--;
    while (k > i && lines[k].trim() === "") k--;
  }
  lines.splice(k + 1, 0, line);
  const next = lines[k + 2];
  if (next !== void 0 && HEADING.test(next)) lines.splice(k + 2, 0, "");
  return lines.join("\n");
}
function replaceAutoBlock(content, key, body) {
  const s = `%% ${key}:start %%`;
  const e = `%% ${key}:end %%`;
  const a = content.indexOf(s);
  const b = content.indexOf(e);
  const block = `${s}
${body.trim()}
${e}`;
  if (a !== -1 && b !== -1 && b > a) return content.slice(0, a) + block + content.slice(b + e.length);
  return content.replace(/\s+$/, "") + "\n\n" + block + "\n";
}
function safeName(s) {
  return s.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
}
function mergeWeek(days, ws) {
  var _a, _b, _c, _d, _e;
  const out = {
    total: 0,
    sessions: 0,
    meetingMins: 0,
    byProject: {},
    byTask: {},
    done: [],
    perDay: []
  };
  for (let i = 0; i < 7; i++) {
    const date = addDays(ws, i);
    const d = days[date];
    out.perDay.push({ date, total: (_a = d == null ? void 0 : d.total) != null ? _a : 0 });
    if (!d) continue;
    out.total += d.total;
    out.sessions += d.sessions;
    out.meetingMins += (_b = d.meetingMins) != null ? _b : 0;
    for (const [p, m] of Object.entries(d.byProject)) out.byProject[p] = ((_c = out.byProject[p]) != null ? _c : 0) + m;
    for (const [t, s] of Object.entries(d.byTask)) {
      const cur = (_d = out.byTask[t]) != null ? _d : { mins: 0, project: s.project };
      cur.mins += s.mins;
      out.byTask[t] = cur;
    }
    for (const t of (_e = d.done) != null ? _e : []) if (!out.done.includes(t)) out.done.push(t);
  }
  return out;
}
function sortedEntries(rec, val) {
  return Object.entries(rec).sort((a, b) => val(b[1]) - val(a[1]));
}
function buildWeekBlock(days, ws) {
  const w = mergeWeek(days, ws);
  const out = [];
  out.push(`**Total logged:** ${fmtDur(w.total)} in ${w.sessions} sessions \xB7 meetings ${fmtDur(w.meetingMins)} \xB7 tasks finished ${w.done.length}`, "");
  out.push("| Day | Time |", "|---|---|");
  for (const d of w.perDay) out.push(`| ${DAY_NAMES[dow(d.date)]} ${d.date} | ${d.total ? fmtDur(d.total) : "\u2013"} |`);
  out.push("", "| Project | Time |", "|---|---|");
  for (const [p, m] of sortedEntries(w.byProject, (v) => v)) out.push(`| ${plain(p) ? p : `[[${p}]]`} | ${fmtDur(m)} |`);
  out.push("", "| Worked on | Project | Time | Finished |", "|---|---|---|---|");
  for (const [t, s] of sortedEntries(w.byTask, (v) => v.mins)) {
    out.push(`| [[${t}]] | ${s.project} | ${fmtDur(s.mins)} | ${w.done.includes(t) ? "\u2705" : ""} |`);
  }
  return out.join("\n");
}
function buildStatus(days, today) {
  var _a;
  const t = (_a = days[today]) != null ? _a : emptyDay();
  const out = [`**Worked on (${fmtDur(t.total)}):**`];
  const tasks = sortedEntries(t.byTask, (v) => v.mins);
  if (tasks.length === 0) out.push("- nothing logged yet");
  for (const [name, s] of tasks) {
    const proj = s.project && !plain(s.project) && s.project !== name ? ` (${s.project})` : "";
    out.push(`- ${name}${proj} \u2014 ${fmtDur(s.mins)}${t.done.includes(name) ? " \u2705 done" : ""}`);
  }
  return out.join("\n");
}
var p2 = (n) => String(n).padStart(2, "0");
function ymd(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
function hhmm(d) {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function isoWeekLabel(date) {
  const thu = toUTC(addDays(date, 4 - (dow(date) || 7)));
  const jan1 = Date.UTC(thu.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1) / 864e5 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${p2(week)}`;
}
function inboxItems(content) {
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
  const items = [];
  for (let i = start + 1; i < end; i++) {
    const m = /^\s*[-*]\s+(?:\[[ xX]\]\s+)?(\S.*)$/.exec(lines[i]);
    if (m) items.push({ text: m[1].trim(), raw: lines[i] });
  }
  return items;
}
function removeExactLine(content, line, fromEnd = false) {
  const lines = content.split("\n");
  const i = fromEnd ? lines.lastIndexOf(line) : lines.indexOf(line);
  if (i === -1) return content;
  lines.splice(i, 1);
  return lines.join("\n");
}
function stripStamp(text) {
  return text.replace(/\s*\(\d\d-\d\d \d\d:\d\d\)\s*$/, "").trim();
}
function parseDaily(content, projects) {
  var _a, _b, _c, _d, _e;
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
    const head = rest.split(" \u2014 ")[0];
    const links = Array.from(head.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)).map((x) => x[1]);
    const title = (_a = links[0]) != null ? _a : "General work";
    const pKey = (_b = links[1]) != null ? _b : meeting ? MEETINGS : projects.has(title) ? title : NO_PROJECT;
    day.total += mins;
    day.sessions += 1;
    if (meeting) day.meetingMins += mins;
    day.byProject[pKey] = ((_c = day.byProject[pKey]) != null ? _c : 0) + mins;
    const t = (_e = (_d = day.byTask)[title]) != null ? _e : _d[title] = { mins: 0, project: pKey };
    t.mins += mins;
  }
  return day;
}
var MEETING_MARK = "\u{1F4C5}";
function gapOk(a, b, skipWeekends) {
  for (let d = addDays(a, 1); d < b; d = addDays(d, 1)) if (!(skipWeekends && isWeekend(d))) return false;
  return true;
}
function bestStreak(days, skipWeekends) {
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
function scoreData(days, today, goalMins, skipWeekends, inbox) {
  var _a, _b, _c;
  const t = (_a = days[today]) != null ? _a : emptyDay();
  const ws = weekStart(today);
  const week = mergeWeek(days, ws);
  const lv = level(totalAll(days));
  const st = streak(days, today, skipWeekends);
  return {
    today: t.total,
    sessions: t.sessions,
    yesterday: (_c = (_b = days[addDays(today, -1)]) == null ? void 0 : _b.total) != null ? _c : 0,
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
      var _a2, _b2;
      const d = addDays(today, i - 6);
      return { label: DAY_NAMES[dow(d)], mins: (_b2 = (_a2 = days[d]) == null ? void 0 : _a2.total) != null ? _b2 : 0, isToday: d === today };
    }),
    projects: sortedEntries(week.byProject, (v) => v),
    doneToday: t.done
  };
}
function buildNow(t) {
  const foot = "\n\n> Written by Work OS so the running timer follows you between laptop and phone. Do not edit by hand.\n";
  if (!t) return `---
type: timer
---
# Now

Nothing is being timed.${foot}`;
  return [
    "---",
    "type: timer",
    `timer_path: ${JSON.stringify(t.path)}`,
    `timer_title: ${JSON.stringify(t.title)}`,
    `timer_start: ${t.start}`,
    `timer_kind: ${t.kind}`,
    "---",
    "# Now",
    "",
    `\u25B6 Working on [[${t.title}]] since ${hhmm(new Date(t.start))} (${ymd(new Date(t.start))}).`
  ].join("\n") + foot;
}
function parseNow(content) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!fm) return null;
  const get = (k) => {
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
  } catch (e) {
    return null;
  }
}

// src/ui.ts
function h(parent, tag, cls, text) {
  const el = parent.ownerDocument.createElement(tag);
  if (cls) el.className = cls;
  if (text !== void 0) el.textContent = text;
  parent.appendChild(el);
  return el;
}
function meter(parent, value, max, label) {
  const track = h(parent, "div", "wos-meter");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", label);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(max));
  track.setAttribute("aria-valuenow", String(Math.min(value, max)));
  const fillEl = h(track, "div", "wos-meter-fill");
  fillEl.style.width = `${max <= 0 ? 0 : Math.min(100, Math.round(value / max * 100))}%`;
}
function trend(now, before) {
  return now > before ? "\u25B2" : now < before ? "\u25BC" : "=";
}
function renderScore(root, s) {
  root.textContent = "";
  root.classList.add("wos-board");
  const tiles = h(root, "div", "wos-tiles");
  const tile = (label, value, sub) => {
    const t = h(tiles, "div", "wos-tile");
    h(t, "div", "wos-tile-label", label);
    h(t, "div", "wos-tile-value", value);
    h(t, "div", "wos-tile-sub", sub);
    return t;
  };
  const today = tile("Today", fmtDur(s.today), `${s.sessions} session${s.sessions === 1 ? "" : "s"} \xB7 yesterday ${fmtDur(s.yesterday)} ${trend(s.today, s.yesterday)}`);
  meter(today, s.today, s.goal, "Daily goal");
  h(today, "div", "wos-tile-sub", s.today >= s.goal ? `Goal of ${fmtDur(s.goal)} reached \u{1F3AF}` : `${fmtDur(s.goal - s.today)} to the ${fmtDur(s.goal)} goal`);
  tile("Streak", `\u{1F525} ${s.streak}`, `day${s.streak === 1 ? "" : "s"} in a row \xB7 best ${s.best}`);
  tile("This week", fmtDur(s.week), `last week ${fmtDur(s.lastWeek)} ${trend(s.week, s.lastWeek)} \xB7 ${s.weekDone} task${s.weekDone === 1 ? "" : "s"} finished`);
  const lv = tile(`Level ${s.level}`, fmtDur(s.levelInto), `${fmtDur(s.levelNeed - s.levelInto)} to Level ${s.level + 1}`);
  meter(lv, s.levelInto, s.levelNeed, "Level progress");
  const inbox = tile("Inbox", s.inbox > 0 ? `\u{1F4E5} ${s.inbox}` : "\u{1F4ED} 0", s.inbox > 0 ? "waiting \xB7 Menu \u2192 P to clear" : "empty");
  if (s.inbox > 0) inbox.classList.add("wos-attention");
  const lower = h(root, "div", "wos-lower");
  const week = h(lower, "div", "wos-panel");
  h(week, "div", "wos-panel-title", "Last 7 days");
  const chart = h(week, "div", "wos-chart");
  const max = Math.max(s.goal, ...s.last7.map((d) => d.mins));
  for (const d of s.last7) {
    const col = h(chart, "div", "wos-col" + (d.isToday ? " is-today" : ""));
    h(col, "div", "wos-col-value", d.mins ? fmtDur(d.mins) : "");
    const barWrap = h(col, "div", "wos-col-track");
    const b = h(barWrap, "div", "wos-col-bar");
    b.style.height = `${max <= 0 ? 0 : Math.round(d.mins / max * 100)}%`;
    h(col, "div", "wos-col-label", d.label);
  }
  const proj = h(lower, "div", "wos-panel");
  h(proj, "div", "wos-panel-title", "This week by project");
  if (s.projects.length === 0) {
    h(proj, "div", "wos-empty", "Nothing logged yet this week. Open the menu and start a task.");
  } else {
    const top = s.projects[0][1];
    for (const [name, mins] of s.projects) {
      const row = h(proj, "div", "wos-row");
      h(row, "div", "wos-row-name", name);
      const track = h(row, "div", "wos-row-track");
      h(track, "div", "wos-row-bar").style.width = `${Math.round(mins / top * 100)}%`;
      h(row, "div", "wos-row-value", fmtDur(mins));
    }
  }
  if (s.doneToday.length) {
    h(proj, "div", "wos-panel-title wos-gap", "Finished today");
    for (const d of s.doneToday) h(proj, "div", "wos-done", `\u2705 ${d}`);
  }
}
function renderMenu(root, status, items, onPick) {
  root.textContent = "";
  root.classList.add("wos-menu");
  h(root, "div", "wos-menu-status", status);
  const groups = [];
  for (const it of items) if (!groups.includes(it.group)) groups.push(it.group);
  for (const g of groups) {
    h(root, "div", "wos-menu-group", g);
    const grid = h(root, "div", "wos-menu-grid");
    for (const it of items.filter((x) => x.group === g)) {
      const b = h(grid, "button", "wos-menu-item");
      b.type = "button";
      h(b, "kbd", "wos-key", it.key.toUpperCase());
      const text = h(b, "span", "wos-menu-text");
      h(text, "span", "wos-menu-label", it.label);
      if (it.hint) h(text, "span", "wos-menu-hint", it.hint);
      b.addEventListener("click", () => onPick(it));
    }
  }
  h(root, "div", "wos-menu-foot", "Press the letter, or tap. Esc closes.");
}

// src/main.ts
var F = {
  home: "00 Home/Home.md",
  inboxFolder: "00 Inbox",
  inbox: "00 Inbox/Inbox.md",
  archive: "99 Archive",
  now: "00 Home/Now.md",
  daily: "01 Daily",
  tasksFile: "02 Tasks/Tasks.md",
  looseTasks: "02 Tasks/Task Notes",
  projects: "03 Projects",
  projectsIndex: "03 Projects/Projects Index.md",
  weekly: "04 Reviews/Weekly",
  meetings: "07 People/Meetings",
  templates: "90 Templates"
};
var TIME_LOG = "## Time Log";
var INBOX_ITEMS = "## Items";
var OTHER = "Other (type a name)";
var NONE = "No project";
var TO_INBOX = "Inbox (decide later)";
var SAMPLE_MARK = "(sample)";
var DEFAULTS = {
  dailyGoalMins: 240,
  capMins: 180,
  skipWeekends: true,
  meetingSeries: ["Weekly Team Meeting", "1-1"]
};
var FALLBACK = {
  Inbox: `# Inbox

${INBOX_ITEMS}
`,
  Daily: `---
type: daily
date: {{date}}
---
# {{date}}

${TIME_LOG}

## Status update
%% status:start %%
%% status:end %%
`,
  "Task Note": `---
type: task
status: todo
project: "{{project}}"
created: {{date}}
actual_mins: 0
---
# {{title}}

**Asked:** {{asked}}

${TIME_LOG}
`,
  Meeting: `---
type: meeting
date: {{date}}
series: "{{series}}"
---
# {{title}}

Previous: {{previous}}

## Open actions from last time
{{carryover}}

## Notes
- 

## Actions
- [ ] 

${TIME_LOG}
`,
  Project: `---
type: project
status: active
start: {{date}}
---
# {{title}}

## Tasks

${TIME_LOG}
`,
  "Project Info & Messages": `# {{project}} - Info & Messages

## Log
`,
  "Project Learning Notes": `# {{project}} - Learning Notes
`,
  "Project Explain It": `# {{project}} - Explain It
`,
  "Weekly Review": `# Week of {{date}}

%% week:start %%
%% week:end %%
`
};
function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => k in vars ? vars[k] : m);
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function oneLine(s) {
  return s.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join(" / ");
}
var PromptModal = class extends import_obsidian.Modal {
  constructor(app, heading, onSubmit) {
    super(app);
    this.heading = heading;
    this.onSubmit = onSubmit;
    this.done = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.heading });
    const input = contentEl.createEl("input", { type: "text" });
    input.style.width = "100%";
    const submit = () => {
      const v = input.value.trim();
      if (!v || this.done) return;
      this.done = true;
      this.close();
      this.onSubmit(v);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
    const btn = contentEl.createEl("button", { text: "OK", cls: "mod-cta" });
    btn.style.marginTop = "12px";
    btn.addEventListener("click", submit);
    window.setTimeout(() => input.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PickModal = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, items, label, placeholder, onPick) {
    super(app);
    this.items = items;
    this.label = label;
    this.onPick = onPick;
    this.setPlaceholder(placeholder);
  }
  getItems() {
    return this.items;
  }
  getItemText(item) {
    return this.label(item);
  }
  onChooseItem(item) {
    this.onPick(item);
  }
};
var ForgotModal = class extends import_obsidian.Modal {
  constructor(app, title, mins, onPick) {
    super(app);
    this.title = title;
    this.mins = mins;
    this.onPick = onPick;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Timer ran ${fmtDur(this.mins)}` });
    contentEl.createEl("p", { text: `On "${this.title}". Was it left running? Pick what to log.` });
    const options = [
      [`Log all ${fmtDur(this.mins)}`, this.mins],
      ["Log 2h", 120],
      ["Log 1h", 60],
      ["Log 30m", 30],
      ["Log nothing", null]
    ];
    for (const [label, value] of options) {
      const b = contentEl.createEl("button", { text: label });
      b.style.margin = "4px";
      b.addEventListener("click", () => {
        this.close();
        this.onPick(value);
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var MenuModal = class extends import_obsidian.Modal {
  constructor(app, status, items) {
    super(app);
    this.status = status;
    this.items = items;
  }
  onOpen() {
    this.titleEl.setText("Work OS");
    const pick = (item) => {
      this.close();
      item.run();
    };
    renderMenu(this.contentEl, this.status, this.items, pick);
    for (const item of this.items) {
      this.scope.register([], item.key, () => {
        pick(item);
        return false;
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var WorkOSLogger = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.store = { settings: { ...DEFAULTS }, lastLog: null };
    this.running = null;
    this.inboxCount = 0;
    this.todayTotal = 0;
    this.statusEl = null;
    this.dayCache = /* @__PURE__ */ new Map();
    this.boards = /* @__PURE__ */ new Set();
    this.refreshTimer = null;
  }
  async onload() {
    var _a, _b;
    const saved = await this.loadData();
    if (saved) this.store = { settings: { ...DEFAULTS, ...(_a = saved.settings) != null ? _a : {} }, lastLog: (_b = saved.lastLog) != null ? _b : null };
    this.addRibbonIcon("layout-grid", "Work OS menu", () => void this.openMenu());
    this.addRibbonIcon("timer", "Start / stop timer on this note", () => void this.toggle());
    this.addRibbonIcon("inbox", "Capture to Inbox", () => this.captureInbox());
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addEventListener("click", () => void this.openMenu());
    this.registerInterval(window.setInterval(() => this.renderStatus(), 15e3));
    this.addCommand({
      id: "open-menu",
      name: "Open menu",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
      callback: () => void this.openMenu()
    });
    for (const item of this.menuItems()) {
      this.addCommand({ id: item.id, name: item.label, callback: () => item.run() });
    }
    this.registerMarkdownCodeBlockProcessor("work-os", (_src, el) => {
      this.boards.add(el);
      void this.paint(el);
    });
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.dayCache.delete(oldPath);
        const r = this.running;
        if (r && r.path === oldPath && file instanceof import_obsidian.TFile) void this.setRunning({ ...r, path: file.path, title: file.basename });
        if (oldPath.startsWith(F.inboxFolder + "/") || file.path.startsWith(F.inboxFolder + "/")) void this.refreshInbox().then(() => this.scheduleRefresh());
      })
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (this.fm(file).type === "task") this.scheduleRefresh();
      })
    );
    this.registerEvent(this.app.vault.on("delete", (file) => this.onChanged(file.path)));
    this.registerEvent(this.app.vault.on("create", (file) => this.onChanged(file.path)));
    this.registerEvent(this.app.vault.on("modify", (file) => this.onChanged(file.path)));
    this.addSettingTab(new LoggerSettings(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      void (async () => {
        await this.loadRunning();
        await this.refreshInbox();
        await this.refreshAll();
        const r = this.running;
        if (r) new import_obsidian.Notice(`\u25B6 Timer still running on "${r.title}" since ${hhmm(new Date(r.start))}`);
      })();
      window.setTimeout(() => this.checkHotkeys(true), 4e3);
    });
  }
  /** Something changed on disk, possibly because sync brought it from the other device. */
  onChanged(path) {
    if (path === F.now) void this.loadRunning().then(() => this.renderStatus());
    else if (path.startsWith(F.inboxFolder + "/")) void this.refreshInbox().then(() => this.scheduleRefresh());
    else if (path.startsWith(F.daily + "/")) {
      this.dayCache.delete(path);
      this.scheduleRefresh();
    }
  }
  scheduleRefresh() {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshAll();
    }, 600);
  }
  // ---------- menu ----------
  menuItems() {
    const r = this.running;
    const item = (key, id, group, label, run, hint) => ({ key, id, group, label, hint, run: () => void run() });
    return [
      item("s", "toggle-timer", "Timer", r ? "Stop the timer" : "Start timer on this note", () => this.toggle(), r ? `logs ${r.title}` : void 0),
      item("t", "new-task", "Timer", "New task", () => this.newTask(), "type a name, timer starts"),
      item("r", "resume-task", "Timer", "Resume a task", () => this.resumeTask(), "pick from open tasks"),
      item("d", "finish-task", "Timer", "Finish this task", () => this.finishTask()),
      item("m", "start-meeting", "Timer", "Start a meeting", () => this.startMeeting()),
      item("l", "log-forgotten", "Timer", "Log time I forgot", () => this.logForgotten(), "pick how long"),
      item("z", "undo-last-log", "Timer", "Undo the last time log", () => this.undoLast()),
      item("i", "capture-inbox", "Capture", "Capture to Inbox", () => this.captureInbox(), "one line, timer keeps running"),
      item("p", "process-inbox", "Capture", `Clear the Inbox${this.inboxCount ? ` (${this.inboxCount})` : ""}`, () => this.processInbox()),
      item("v", "capture-clipboard", "Capture", "Save copied text", () => this.captureClipboard(), "to a project or the Inbox"),
      item("u", "copy-status", "Report", "Copy today's status", () => this.copyStatus()),
      item("w", "weekly-report", "Report", "Build this week's report", () => this.weeklyReport()),
      item("o", "open-today", "Go to", "Today's note", () => this.openToday()),
      item("h", "open-home", "Go to", "Home (scoreboard)", () => this.openPath(F.home)),
      item("n", "new-project", "Go to", "New project", () => this.newProject()),
      item("k", "check-hotkeys", "Go to", "Check hotkey conflicts", () => this.checkHotkeys(false)),
      item("x", "remove-samples", "Go to", "Remove the sample data", () => this.askRemoveSamples(), "when you have finished trying")
    ];
  }
  async openMenu() {
    const r = this.running;
    const inbox = this.inboxCount ? ` \xB7 \u{1F4E5} ${this.inboxCount} in Inbox` : "";
    const status = r ? `\u25B6 ${r.title} \xB7 ${fmtDur(Math.max(0, Math.round((Date.now() - r.start) / 6e4)))}${inbox}` : `Nothing is being timed \xB7 today ${fmtDur(this.todayTotal)}${inbox}`;
    new MenuModal(this.app, status, this.menuItems()).open();
  }
  /** Reports any other command that uses the same key as the menu. Uses Obsidian internals, so it fails softly. */
  checkHotkeys(quietIfOk) {
    try {
      const app = this.app;
      const mine = `${this.manifest.id}:open-menu`;
      const get = (id) => {
        var _a, _b;
        return (_b = (_a = app.hotkeyManager.getHotkeys(id)) != null ? _a : app.hotkeyManager.getDefaultHotkeys(id)) != null ? _b : [];
      };
      const norm = (hk) => hk.modifiers.map((m) => m === "Mod" ? import_obsidian.Platform.isMacOS ? "Meta" : "Ctrl" : m).sort().join("+") + "+" + String(hk.key).toLowerCase();
      const myKeys = get(mine).map(norm);
      if (myKeys.length === 0) {
        new import_obsidian.Notice('The Work OS menu has no hotkey. Set one in Settings \u2192 Hotkeys \u2192 search "Work OS".', 12e3);
        return;
      }
      const clashes = [];
      for (const [id, cmd] of Object.entries(app.commands.commands)) {
        if (id !== mine && get(id).some((hk) => myKeys.includes(norm(hk)))) clashes.push(cmd.name);
      }
      if (clashes.length) {
        new import_obsidian.Notice(`\u26A0 The Work OS menu key is also used by: ${clashes.join(", ")}.
Change one of them in Settings \u2192 Hotkeys.`, 2e4);
      } else if (!quietIfOk) {
        new import_obsidian.Notice("\u2714 No conflict: the Work OS menu key is used by nothing else in this vault.", 8e3);
      }
    } catch (e) {
      if (!quietIfOk) new import_obsidian.Notice('Could not check automatically. Open Settings \u2192 Hotkeys, search "Work OS": Obsidian marks a clashing key in red.', 12e3);
    }
  }
  // ---------- helpers ----------
  async save() {
    await this.saveData(this.store);
  }
  today() {
    return ymd(/* @__PURE__ */ new Date());
  }
  file(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof import_obsidian.TFile ? f : null;
  }
  async ensureFolder(path) {
    let cur = "";
    for (const part of path.split("/").filter(Boolean)) {
      cur = cur ? `${cur}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(cur)) {
        try {
          await this.app.vault.createFolder(cur);
        } catch (e) {
        }
      }
    }
  }
  async createNote(path, content) {
    const existing = this.file(path);
    if (existing) return existing;
    await this.ensureFolder(path.split("/").slice(0, -1).join("/"));
    return this.app.vault.create(path, content);
  }
  /** Every write goes through here so cached numbers never go stale. */
  async edit(file, fn) {
    await this.app.vault.process(file, fn);
    this.dayCache.delete(file.path);
  }
  async tpl(name) {
    var _a;
    const f = this.file(`${F.templates}/${name}.md`);
    return f ? this.app.vault.read(f) : (_a = FALLBACK[name]) != null ? _a : "";
  }
  async openFile(file) {
    await this.app.workspace.getLeaf(false).openFile(file);
  }
  async openPath(path) {
    const f = this.file(path);
    if (f) await this.openFile(f);
    else new import_obsidian.Notice(`Could not find ${path}`);
  }
  async openToday() {
    await this.openFile(await this.ensureDaily(this.today()));
  }
  isDaily(path) {
    return path.startsWith(F.daily + "/");
  }
  fm(file) {
    var _a, _b;
    return (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) != null ? _b : {};
  }
  projectOf(file) {
    const prefix = F.projects + "/";
    if (file.path.startsWith(prefix)) {
      const parts = file.path.slice(prefix.length).split("/");
      if (parts.length >= 2) return parts[0];
    }
    const raw = this.fm(file).project;
    const p = typeof raw === "string" ? raw.replace(/[[\]]/g, "").trim() : "";
    return p && p !== NONE ? p : null;
  }
  projects() {
    const folder = this.app.vault.getAbstractFileByPath(F.projects);
    if (!(folder instanceof import_obsidian.TFolder)) return [];
    return folder.children.filter((c) => c instanceof import_obsidian.TFolder).map((c) => c.name).sort();
  }
  pickProject(placeholder, extra, cb) {
    new PickModal(this.app, [...extra, ...this.projects()], (x) => x, placeholder, cb).open();
  }
  dailyPath(date) {
    return `${F.daily}/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.md`;
  }
  async ensureDaily(date) {
    var _a;
    const path = this.dailyPath(date);
    return (_a = this.file(path)) != null ? _a : this.createNote(path, fill(await this.tpl("Daily"), { date, title: date }));
  }
  // ---------- numbers: always rebuilt from the notes ----------
  async loadDays() {
    var _a;
    const projects = new Set(this.projects());
    const files = this.app.vault.getMarkdownFiles();
    const days = {};
    for (const f of files) {
      if (!this.isDaily(f.path) || !/^\d{4}-\d\d-\d\d$/.test(f.basename)) continue;
      if (this.fm(f).sample === true) continue;
      let d = this.dayCache.get(f.path);
      if (!d) {
        d = parseDaily(await this.app.vault.cachedRead(f), projects);
        this.dayCache.set(f.path, d);
      }
      days[f.basename] = { ...d, done: [] };
    }
    for (const f of files) {
      if (f.path.startsWith(F.templates + "/")) continue;
      const fm = this.fm(f);
      if (fm.type !== "task" || fm.status !== "done" || !fm.done || fm.sample === true) continue;
      const date = String(fm.done).slice(0, 10);
      ((_a = days[date]) != null ? _a : days[date] = emptyDay()).done.push(f.basename);
    }
    return days;
  }
  async score(days) {
    const s = this.store.settings;
    return scoreData(days != null ? days : await this.loadDays(), this.today(), s.dailyGoalMins, s.skipWeekends, this.inboxCount);
  }
  async paint(el, days) {
    try {
      renderScore(el, await this.score(days));
    } catch (e) {
      console.error("Work OS Logger: scoreboard", e);
      el.textContent = "Work OS scoreboard could not be drawn. See the developer console.";
    }
  }
  /** Recomputes today's total, the status bar and every scoreboard that is on screen. */
  async refreshAll() {
    var _a, _b;
    const days = await this.loadDays();
    this.todayTotal = (_b = (_a = days[this.today()]) == null ? void 0 : _a.total) != null ? _b : 0;
    this.renderStatus();
    for (const el of Array.from(this.boards)) {
      if (!el.isConnected) this.boards.delete(el);
      else await this.paint(el, days);
    }
    return days;
  }
  renderStatus() {
    if (!this.statusEl) return;
    const r = this.running;
    const inbox = this.inboxCount > 0 ? ` \xB7 \u{1F4E5} ${this.inboxCount}` : "";
    if (r) {
      const mins = Math.max(0, Math.round((Date.now() - r.start) / 6e4));
      this.statusEl.setText(`\u25B6 ${r.title} \xB7 ${fmtDur(mins)}${inbox}`);
    } else {
      this.statusEl.setText(`\u23F1 Today ${fmtDur(this.todayTotal)}${inbox}`);
    }
  }
  // ---------- the running timer lives in a note, so it follows you between devices ----------
  async loadRunning() {
    const f = this.file(F.now);
    this.running = f ? parseNow(await this.app.vault.read(f)) : null;
  }
  async setRunning(t) {
    this.running = t;
    const text = buildNow(t);
    const f = this.file(F.now);
    if (f) await this.app.vault.process(f, () => text);
    else await this.createNote(F.now, text);
    this.renderStatus();
  }
  // ---------- inbox ----------
  async inboxFile() {
    var _a;
    return (_a = this.file(F.inbox)) != null ? _a : this.createNote(F.inbox, await this.tpl("Inbox"));
  }
  /** Notes dropped into the Inbox folder (anything except the Inbox list itself). */
  looseNotes() {
    const folder = this.app.vault.getAbstractFileByPath(F.inboxFolder);
    if (!(folder instanceof import_obsidian.TFolder)) return [];
    return folder.children.filter((c) => c instanceof import_obsidian.TFile && c.extension === "md" && c.path !== F.inbox);
  }
  async refreshInbox() {
    const f = this.file(F.inbox);
    this.inboxCount = (f ? inboxItems(await this.app.vault.read(f)).length : 0) + this.looseNotes().length;
    this.renderStatus();
  }
  captureInbox() {
    new PromptModal(this.app, "Capture to Inbox (your timer keeps running)", (v) => void this.addToInbox(v)).open();
  }
  async addToInbox(text) {
    const clean = oneLine(text);
    if (!clean) return;
    const now = /* @__PURE__ */ new Date();
    const line = `- ${clean} (${ymd(now).slice(5)} ${hhmm(now)})`;
    await this.edit(await this.inboxFile(), (c) => insertUnderHeading(c, INBOX_ITEMS, line));
    await this.refreshInbox();
    await this.refreshAll();
    new import_obsidian.Notice(`\u{1F4E5} Saved to Inbox (${this.inboxCount} waiting). Back to work.`);
  }
  async processInbox() {
    const f = await this.inboxFile();
    const entries = [
      ...inboxItems(await this.app.vault.read(f)).map((it) => ({ label: it.text, raw: it.raw, text: it.text })),
      ...this.looseNotes().map((n) => ({ label: `\u{1F4C4} Note: ${n.basename}`, note: n }))
    ];
    if (entries.length === 0) {
      new import_obsidian.Notice("\u{1F4ED} Inbox is empty.");
      return;
    }
    const lineActions = ["Do it now (task + timer)", "Task for later", "Small to-do (Tasks list)", "Save to a project's Info & Messages", "Delete (not needed)"];
    const noteActions = ["Open it", "Move into a project folder", "Move to Archive", "Delete (not needed)"];
    new PickModal(this.app, entries, (e) => e.label, `${entries.length} in Inbox: pick one to decide`, (entry) => {
      var _a;
      const note = entry.note;
      if (note) {
        new PickModal(this.app, noteActions, (x) => x, note.basename, (action) => void this.resolveInboxNote(note, noteActions.indexOf(action))).open();
      } else {
        new PickModal(this.app, lineActions, (x) => x, stripStamp((_a = entry.text) != null ? _a : ""), (action) => {
          var _a2, _b;
          void this.resolveInbox((_a2 = entry.raw) != null ? _a2 : "", (_b = entry.text) != null ? _b : "", lineActions.indexOf(action));
        }).open();
      }
    }).open();
  }
  /** A whole note sitting in the Inbox folder. action: 0 open, 1 move to project, 2 archive, 3 delete */
  async resolveInboxNote(note, action, project) {
    if (action === 0) {
      await this.openFile(note);
      return;
    }
    if (action === 1 && project === void 0) {
      this.pickProject("Move into which project?", [], (p) => void this.resolveInboxNote(note, action, p));
      return;
    }
    if (action === 3) {
      await this.app.vault.trash(note, false);
    } else {
      const folder = action === 1 ? `${F.projects}/${project}` : F.archive;
      await this.ensureFolder(folder);
      const target = this.file(`${folder}/${note.name}`) ? `${folder}/${note.basename} (from Inbox).md` : `${folder}/${note.name}`;
      await this.app.fileManager.renameFile(note, target);
    }
    await this.refreshInbox();
    await this.refreshAll();
    if (this.inboxCount === 0) new import_obsidian.Notice("\u{1F4ED} Inbox zero! Nothing left waiting.", 6e3);
    else await this.processInbox();
  }
  /** action: 0 do now, 1 task later, 2 small to-do, 3 project info, 4 delete */
  async resolveInbox(raw, text, action, project) {
    const clean = stripStamp(text);
    const name = safeName(clean).slice(0, 80).trim();
    const needsProject = action === 0 || action === 1 || action === 3;
    if (needsProject && project === void 0) {
      this.pickProject("Which project?", action === 3 ? [] : [NONE], (p) => void this.resolveInbox(raw, text, action, p === NONE ? null : p));
      return;
    }
    if (action === 0 || action === 1) {
      await this.createTask(name, project != null ? project : null, { start: action === 0, open: action === 0, asked: clean });
    } else if (action === 2) {
      const list = this.file(F.tasksFile);
      if (list) await this.edit(list, (c) => insertUnderHeading(c, "## Next (this week)", `- [ ] ${clean}`));
    } else if (action === 3 && project) {
      await this.appendInfo(project, clean, true);
    }
    await this.edit(await this.inboxFile(), (c) => removeExactLine(c, raw));
    await this.refreshInbox();
    await this.refreshAll();
    if (this.inboxCount === 0) new import_obsidian.Notice("\u{1F4ED} Inbox zero! Nothing left waiting.", 6e3);
    else if (action !== 0) await this.processInbox();
  }
  // ---------- sample data ----------
  askRemoveSamples() {
    const yes = "Yes, remove all sample notes";
    new PickModal(this.app, [yes, "Cancel"], (x) => x, "Remove the sample project, tasks, days and meeting?", (pick) => {
      if (pick === yes) void this.removeSamples();
    }).open();
  }
  /** Samples are notes with the property `sample: true`, plus list lines marked "(sample)". They go to the vault's trash. */
  async removeSamples() {
    const timed = this.running ? this.file(this.running.path) : null;
    if (timed && this.fm(timed).sample === true) await this.setRunning(null);
    const samples = this.app.vault.getMarkdownFiles().filter((f) => !f.path.startsWith(F.templates + "/") && this.fm(f).sample === true);
    const folders = /* @__PURE__ */ new Set();
    for (const f of samples) {
      const m = new RegExp(`^${escapeRe(F.projects)}/([^/]+)/\\1\\.md$`).exec(f.path);
      if (m) folders.add(`${F.projects}/${m[1]}`);
    }
    for (const f of samples) {
      if (this.file(f.path)) await this.app.vault.trash(f, false);
      this.dayCache.delete(f.path);
    }
    for (const path of folders) {
      const folder = this.app.vault.getAbstractFileByPath(path);
      if (folder) await this.app.vault.trash(folder, false);
    }
    const names = new Set(samples.map((f) => f.basename));
    const isSampleLine = (l) => l.includes(SAMPLE_MARK) || Array.from(l.matchAll(/\[\[([^\]|]+)/g)).some((x) => names.has(x[1]));
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (f.path.startsWith(F.templates + "/")) continue;
      const text = await this.app.vault.read(f);
      if (!text.includes(SAMPLE_MARK) && !Array.from(names).some((n) => text.includes(`[[${n}`))) continue;
      await this.edit(f, (c) => c.split("\n").filter((l) => !(/^\s*[-*|]/.test(l) && isSampleLine(l))).join("\n"));
      if (this.isDaily(f.path)) await this.stampDaily(f);
    }
    await this.refreshInbox();
    await this.refreshAll();
    new import_obsidian.Notice(`Removed ${samples.length} sample notes. They are in this vault's trash if you want them back.`, 8e3);
    return samples.length;
  }
  // ---------- timer ----------
  async toggle() {
    await this.loadRunning();
    if (this.running) return this.requestStop(false);
    const f = this.app.workspace.getActiveFile();
    if (!f) {
      new import_obsidian.Notice("Open the note you are working on, then start the timer.");
      return;
    }
    await this.startTimer(f);
  }
  async startTimer(file, kind = "work") {
    const r = this.running;
    if (r) {
      if (r.path === file.path) {
        new import_obsidian.Notice(`\u25B6 Already timing "${r.title}"`);
        return;
      }
      await this.stopTimer({ quiet: true });
    }
    await this.setRunning({ path: file.path, title: file.basename, start: Date.now(), kind });
    const fm = this.fm(file);
    if (fm.type === "task" && fm.status === "todo") {
      await this.app.fileManager.processFrontMatter(file, (m) => {
        m.status = "doing";
      });
    }
    new import_obsidian.Notice(`\u25B6 Started: ${file.basename}`);
  }
  async requestStop(withNote) {
    const r = this.running;
    if (!r) {
      new import_obsidian.Notice("No timer is running.");
      return;
    }
    const mins = Math.round((Date.now() - r.start) / 6e4);
    const finish = (override) => {
      if (withNote) new PromptModal(this.app, "What did you do? (a few words)", (note) => void this.stopTimer({ note, mins: override })).open();
      else void this.stopTimer({ mins: override });
    };
    if (mins > this.store.settings.capMins) {
      new ForgotModal(this.app, r.title, mins, (picked) => {
        if (picked === null) void this.discard();
        else finish(picked);
      }).open();
      return;
    }
    finish();
  }
  async discard() {
    await this.setRunning(null);
    new import_obsidian.Notice("Timer cleared. Nothing logged.");
  }
  async stopTimer(opts = {}) {
    var _a, _b;
    const r = this.running;
    if (!r) return;
    const mins = (_a = opts.mins) != null ? _a : Math.round((Date.now() - r.start) / 6e4);
    await this.setRunning(null);
    if (mins < 1) {
      if (!opts.quiet) new import_obsidian.Notice("Under 1 minute. Nothing logged.");
      return;
    }
    await this.logSession(r, mins, (_b = opts.note) != null ? _b : "", !!opts.quiet);
  }
  /** For when the timer was never started: pick how long, it is logged on the open note ending now. */
  logForgotten() {
    const active = this.app.workspace.getActiveFile();
    const choices = [15, 30, 45, 60, 90, 120, 180];
    const where = active ? active.basename : "today's note (general work)";
    new PickModal(this.app, choices, (m) => fmtDur(m), `How long did you work on: ${where}?`, (mins) => {
      void (async () => {
        const file = active != null ? active : await this.ensureDaily(this.today());
        const kind = this.fm(file).type === "meeting" ? "meeting" : "work";
        await this.logSession({ path: file.path, title: file.basename, start: Date.now() - mins * 6e4, kind }, mins, "", false);
      })();
    }).open();
  }
  /** Keeps the day's totals as properties on the daily note, so Obsidian's own table views can show them. */
  async stampDaily(daily) {
    const st = parseDaily(await this.app.vault.read(daily), new Set(this.projects()));
    await this.app.fileManager.processFrontMatter(daily, (m) => {
      m.mins_logged = st.total;
      m.sessions = st.sessions;
    });
    this.dayCache.delete(daily.path);
  }
  async logSession(r, mins, rawNote, quiet) {
    var _a, _b, _c, _d;
    const start = new Date(r.start);
    const end = new Date(r.start + mins * 6e4);
    const date = ymd(start);
    const range = `${hhmm(start)}-${hhmm(end)}`;
    const note = rawNote.replace(/\s+/g, " ").trim();
    const file = this.file(r.path);
    const timedDaily = this.isDaily(r.path);
    const project = file && !timedDaily ? this.projectOf(file) : null;
    const title = timedDaily ? "General work" : file ? file.basename : r.title;
    const taskLine = `- ${date} ${range} [mins:: ${mins}]${note ? " " + note : ""}`;
    const mark = r.kind === "meeting" ? `${MEETING_MARK} ` : "";
    const links = timedDaily ? "General work" : `${mark}[[${title}]]${project && project !== title ? ` \xB7 [[${project}]]` : ""}`;
    const dailyLine = `- ${range} [mins:: ${mins}] ${links}${note ? " \u2014 " + note : ""}`;
    const taskPath = file && !timedDaily ? file.path : null;
    const s = this.store;
    const before = await this.loadDays();
    try {
      if (file && taskPath) {
        await this.edit(file, (c) => insertUnderHeading(c, TIME_LOG, taskLine));
        await this.app.fileManager.processFrontMatter(file, (m) => {
          m.actual_mins = (Number(m.actual_mins) || 0) + mins;
          m.last_worked = date;
        });
      }
      const daily = await this.ensureDaily(date);
      await this.edit(daily, (c) => insertUnderHeading(c, TIME_LOG, dailyLine));
      await this.stampDaily(daily);
    } catch (e) {
      console.error("Work OS Logger: writing log", e);
      new import_obsidian.Notice("Logger: could not write the time into a note. Nothing was counted. Try again.", 1e4);
      return;
    }
    s.lastLog = { date, mins, title, taskPath, taskLine, dailyPath: this.dailyPath(date), dailyLine };
    await this.save();
    const days = await this.refreshAll();
    if (quiet) return;
    const goal = s.settings.dailyGoalMins;
    const dayBefore = (_b = (_a = before[date]) == null ? void 0 : _a.total) != null ? _b : 0;
    const dayNow = (_d = (_c = days[date]) == null ? void 0 : _c.total) != null ? _d : 0;
    const st = streak(days, this.today(), s.settings.skipWeekends);
    const lines = [`\u2714 ${fmtDur(mins)} logged \xB7 ${title}`, `Today ${fmtDur(dayNow)} of ${fmtDur(goal)} \xB7 \u{1F525} ${st}-day streak`];
    if (dayBefore < goal && dayNow >= goal) lines.push("\u{1F3AF} Daily goal reached!");
    const lvBefore = level(totalAll(before)).level;
    const lvNow = level(totalAll(days)).level;
    if (lvNow > lvBefore) lines.push(`\u2B06 Level ${lvNow}!`);
    new import_obsidian.Notice(lines.join("\n"), 7e3);
  }
  async undoLast() {
    const l = this.store.lastLog;
    if (!l) {
      new import_obsidian.Notice("Nothing to undo on this device.");
      return;
    }
    const task = l.taskPath ? this.file(l.taskPath) : null;
    if (task) {
      await this.edit(task, (c) => removeExactLine(c, l.taskLine, true));
      await this.app.fileManager.processFrontMatter(task, (m) => {
        m.actual_mins = Math.max(0, (Number(m.actual_mins) || 0) - l.mins);
      });
    }
    const daily = this.file(l.dailyPath);
    if (daily) {
      await this.edit(daily, (c) => removeExactLine(c, l.dailyLine, true));
      await this.stampDaily(daily);
    }
    this.store.lastLog = null;
    await this.save();
    await this.refreshAll();
    new import_obsidian.Notice(`\u21A9 Removed: ${fmtDur(l.mins)} on ${l.title}`);
  }
  // ---------- tasks ----------
  newTask() {
    new PromptModal(this.app, "New task (start with a verb)", (raw) => {
      const name = safeName(raw);
      if (!name) return;
      const active = this.app.workspace.getActiveFile();
      const here = active ? this.projectOf(active) : null;
      if (here && this.projects().includes(here)) {
        void this.createTask(name, here);
        return;
      }
      this.pickProject("Which project?", [NONE], (p) => void this.createTask(name, p === NONE ? null : p));
    }).open();
  }
  async createTask(rawName, project, opts = {}) {
    const { start = true, open = true, asked = "" } = opts;
    const date = this.today();
    const folder = project ? `${F.projects}/${project}/Tasks` : F.looseTasks;
    let name = rawName;
    if (!this.file(`${folder}/${name}.md`) && this.app.vault.getMarkdownFiles().some((f) => f.basename === name)) {
      name = `${name} (${project != null ? project : "general"})`;
    }
    const path = `${folder}/${name}.md`;
    const isNew = !this.file(path);
    const file = await this.createNote(path, fill(await this.tpl("Task Note"), { title: name, date, project: project != null ? project : NONE, asked }));
    if (isNew) {
      const box = `- [ ] [[${name}]]`;
      const home = project ? this.file(`${F.projects}/${project}/${project}.md`) : null;
      const list = home != null ? home : this.file(F.tasksFile);
      if (list) await this.edit(list, (c) => insertUnderHeading(c, home ? "## Tasks" : "## Next (this week)", box));
    }
    if (open) await this.openFile(file);
    if (start) await this.startTimer(file);
    else new import_obsidian.Notice(`Task saved for later: ${name}`);
    return file;
  }
  openTasks() {
    const key = (f) => {
      var _a, _b;
      return String((_b = (_a = this.fm(f).last_worked) != null ? _a : this.fm(f).created) != null ? _b : "");
    };
    return this.app.vault.getMarkdownFiles().filter((f) => !f.path.startsWith(F.templates + "/") && this.fm(f).type === "task" && this.fm(f).status !== "done").sort((a, b) => key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0);
  }
  resumeTask() {
    const tasks = this.openTasks();
    if (tasks.length === 0) {
      new import_obsidian.Notice("No open tasks. Open the menu and press T to make one.");
      return;
    }
    const label = (f) => {
      var _a;
      const spent = Number(this.fm(f).actual_mins) || 0;
      return `${f.basename} \xB7 ${(_a = this.projectOf(f)) != null ? _a : NONE}${spent ? ` \xB7 ${fmtDur(spent)} so far` : ""}`;
    };
    new PickModal(this.app, tasks, label, "Resume which task?", (f) => {
      void (async () => {
        await this.openFile(f);
        await this.startTimer(f);
      })();
    }).open();
  }
  async finishTask() {
    var _a, _b;
    const file = this.app.workspace.getActiveFile();
    if (!file || this.fm(file).type !== "task") {
      new import_obsidian.Notice("Open the task note you finished first (menu \u2192 R lists your open tasks).");
      return;
    }
    if (((_a = this.running) == null ? void 0 : _a.path) === file.path) await this.stopTimer({ quiet: true });
    const date = this.today();
    await this.app.fileManager.processFrontMatter(file, (m) => {
      m.status = "done";
      m.done = date;
    });
    const name = file.basename;
    const project = this.projectOf(file);
    const re = new RegExp(`^(\\s*)- \\[ \\] \\[\\[${escapeRe(name)}\\]\\].*$`, "m");
    for (const p of [project ? `${F.projects}/${project}/${project}.md` : "", F.tasksFile]) {
      const list = p ? this.file(p) : null;
      if (list) await this.edit(list, (c) => c.replace(re, `$1- [x] [[${name}]] \u2705 ${date}`));
    }
    const days = await this.refreshAll();
    const ws = weekStart(date);
    let weekDone = 0;
    for (const [d, v] of Object.entries(days)) if (d >= ws) weekDone += v.done.length;
    if (!((_b = days[date]) == null ? void 0 : _b.done.includes(name))) weekDone += 1;
    new import_obsidian.Notice(`\u2705 Finished: ${name}
${weekDone} task${weekDone === 1 ? "" : "s"} finished this week.
Last step: fill "Explain it" (5 short lines).`, 8e3);
  }
  // ---------- meetings ----------
  startMeeting() {
    const series = [...this.store.settings.meetingSeries, OTHER];
    new PickModal(this.app, series, (x) => x, "Which meeting?", (pick) => {
      if (pick === OTHER) new PromptModal(this.app, "Meeting name", (v) => void this.createMeeting(safeName(v))).open();
      else void this.createMeeting(pick);
    }).open();
  }
  async createMeeting(series) {
    if (!series) return;
    const date = this.today();
    const title = `${date} ${series}`;
    const path = `${F.meetings}/${title}.md`;
    let previous = "none (first one)";
    let carryover = "- none";
    const folder = this.app.vault.getAbstractFileByPath(F.meetings);
    if (folder instanceof import_obsidian.TFolder && !this.file(path)) {
      const prev = folder.children.filter((c) => c instanceof import_obsidian.TFile && c.basename.endsWith(` ${series}`) && c.basename < title).sort((a, b) => a.basename < b.basename ? 1 : -1)[0];
      if (prev) {
        previous = `[[${prev.basename}]]`;
        const open = (await this.app.vault.read(prev)).split("\n").filter((l) => /^\s*- \[ \] \S/.test(l));
        if (open.length) carryover = open.map((l) => l.trim()).join("\n");
      }
    }
    const file = await this.createNote(path, fill(await this.tpl("Meeting"), { title, date, series, previous, carryover }));
    await this.openFile(file);
    await this.startTimer(file, "meeting");
  }
  // ---------- projects ----------
  newProject() {
    new PromptModal(this.app, "New project name", (raw) => void this.createProject(safeName(raw))).open();
  }
  async createProject(name) {
    if (!name) return;
    const base = `${F.projects}/${name}`;
    const vars = { title: name, project: name, date: this.today() };
    await this.ensureFolder(`${base}/Tasks`);
    const home = await this.createNote(`${base}/${name}.md`, fill(await this.tpl("Project"), vars));
    for (const part of ["Info & Messages", "Learning Notes", "Explain It"]) {
      await this.createNote(`${base}/${name} - ${part}.md`, fill(await this.tpl(`Project ${part}`), vars));
    }
    const index = this.file(F.projectsIndex);
    if (index) {
      const link = `- [[${name}]]`;
      await this.edit(index, (c) => c.includes(link) ? c : insertUnderHeading(c, "## Active", link));
    }
    await this.openFile(home);
    new import_obsidian.Notice(`Project "${name}" created with Info, Learning Notes, Explain It and Tasks.`);
  }
  async captureClipboard() {
    let text = "";
    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch (e) {
    }
    if (!text) {
      new import_obsidian.Notice("Nothing copied (or Obsidian cannot read the clipboard). Copy the message first.");
      return;
    }
    const active = this.app.workspace.getActiveFile();
    const here = active ? this.projectOf(active) : null;
    if (here && this.projects().includes(here)) {
      await this.appendInfo(here, text);
      return;
    }
    this.pickProject("Save the copied text where?", [TO_INBOX], (p) => {
      if (p === TO_INBOX) void this.addToInbox(text);
      else void this.appendInfo(p, text);
    });
  }
  async appendInfo(project, text, quiet = false) {
    const path = `${F.projects}/${project}/${project} - Info & Messages.md`;
    const file = await this.createNote(path, fill(await this.tpl("Project Info & Messages"), { project, title: project, date: this.today() }));
    const quoted = text.split("\n").map((l) => `> ${l}`).join("\n");
    const now = /* @__PURE__ */ new Date();
    const entry = `### ${ymd(now)} ${hhmm(now)}
${quoted}
`;
    await this.edit(file, (c) => {
      const marker = "## Log";
      const i = c.indexOf(marker);
      if (i === -1) return c.replace(/\s+$/, "") + `

${marker}

${entry}`;
      const lineEnd = c.indexOf("\n", i);
      const at = lineEnd === -1 ? c.length : lineEnd + 1;
      return c.slice(0, at) + "\n" + entry + c.slice(at);
    });
    if (!quiet) new import_obsidian.Notice(`Saved to ${project} - Info & Messages`);
  }
  // ---------- reports ----------
  async copyStatus() {
    const date = this.today();
    const auto = buildStatus(await this.loadDays(), date);
    const daily = await this.ensureDaily(date);
    await this.edit(daily, (c) => replaceAutoBlock(c, "status", auto));
    const content = await this.app.vault.read(daily);
    const extra = content.split("\n").filter((l) => /^\*\*(Blocked|Next)/.test(l.trim()));
    const text = [`Status ${date}`, auto.replace(/\*\*/g, ""), ...extra.map((l) => l.replace(/\*\*/g, ""))].join("\n");
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (e) {
    }
    new import_obsidian.Notice(copied ? "Status copied. Paste it into your chat." : "Status written into today's note (could not reach the clipboard).");
  }
  async weeklyReport() {
    const ws = weekStart(this.today());
    const label = isoWeekLabel(ws);
    const path = `${F.weekly}/${label}.md`;
    const file = await this.createNote(path, fill(await this.tpl("Weekly Review"), { date: ws, title: label }));
    const block = buildWeekBlock(await this.loadDays(), ws);
    await this.edit(file, (c) => replaceAutoBlock(c, "week", block));
    await this.openFile(file);
    new import_obsidian.Notice("Weekly report updated with this week's numbers.");
  }
};
var LoggerSettings = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const s = this.plugin.store.settings;
    containerEl.empty();
    const num = (name, desc, get, set) => new import_obsidian.Setting(containerEl).setName(name).setDesc(desc).addText(
      (t) => t.setValue(String(get())).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n > 0) {
          set(n);
          await this.plugin.save();
          await this.plugin.refreshAll();
        }
      })
    );
    num("Daily goal (minutes)", "Logged minutes that fill the daily bar.", () => s.dailyGoalMins, (n) => s.dailyGoalMins = n);
    num("Forgotten-timer check (minutes)", "If one session is longer than this, you are asked what to log.", () => s.capMins, (n) => s.capMins = n);
    new import_obsidian.Setting(containerEl).setName("Weekends do not break the streak").addToggle(
      (t) => t.setValue(s.skipWeekends).onChange(async (v) => {
        s.skipWeekends = v;
        await this.plugin.save();
        await this.plugin.refreshAll();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Recurring meetings").setDesc("One name per line. These appear when you start a meeting.").addTextArea(
      (t) => t.setValue(s.meetingSeries.join("\n")).onChange(async (v) => {
        s.meetingSeries = v.split("\n").map((x) => safeName(x)).filter(Boolean);
        await this.plugin.save();
      })
    );
  }
};

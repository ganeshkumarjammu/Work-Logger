// Plain-DOM rendering for the scoreboard and the menu. No Obsidian imports, so it can be previewed in any browser.
import { Score, fmtDur } from "./core";

function h<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = parent.ownerDocument.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  parent.appendChild(el);
  return el;
}

function meter(parent: HTMLElement, value: number, max: number, label: string): void {
  const track = h(parent, "div", "wos-meter");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", label);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(max));
  track.setAttribute("aria-valuenow", String(Math.min(value, max)));
  const fillEl = h(track, "div", "wos-meter-fill");
  fillEl.style.width = `${max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))}%`;
}

function trend(now: number, before: number): string {
  return now > before ? "▲" : now < before ? "▼" : "=";
}

export function renderScore(root: HTMLElement, s: Score): void {
  root.textContent = "";
  root.classList.add("wos-board");

  const tiles = h(root, "div", "wos-tiles");
  const tile = (label: string, value: string, sub: string): HTMLElement => {
    const t = h(tiles, "div", "wos-tile");
    h(t, "div", "wos-tile-label", label);
    h(t, "div", "wos-tile-value", value);
    h(t, "div", "wos-tile-sub", sub);
    return t;
  };

  const today = tile("Today", fmtDur(s.today), `${s.sessions} session${s.sessions === 1 ? "" : "s"} · yesterday ${fmtDur(s.yesterday)} ${trend(s.today, s.yesterday)}`);
  meter(today, s.today, s.goal, "Daily goal");
  h(today, "div", "wos-tile-sub", s.today >= s.goal ? `Goal of ${fmtDur(s.goal)} reached 🎯` : `${fmtDur(s.goal - s.today)} to the ${fmtDur(s.goal)} goal`);

  tile("Streak", `🔥 ${s.streak}`, `day${s.streak === 1 ? "" : "s"} in a row · best ${s.best}`);
  tile("This week", fmtDur(s.week), `last week ${fmtDur(s.lastWeek)} ${trend(s.week, s.lastWeek)} · ${s.weekDone} task${s.weekDone === 1 ? "" : "s"} finished`);

  const lv = tile(`Level ${s.level}`, fmtDur(s.levelInto), `${fmtDur(s.levelNeed - s.levelInto)} to Level ${s.level + 1}`);
  meter(lv, s.levelInto, s.levelNeed, "Level progress");

  const inbox = tile("Inbox", s.inbox > 0 ? `📥 ${s.inbox}` : "📭 0", s.inbox > 0 ? "waiting · Menu → P to clear" : "empty");
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
    b.style.height = `${max <= 0 ? 0 : Math.round((d.mins / max) * 100)}%`;
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
      h(track, "div", "wos-row-bar").style.width = `${Math.round((mins / top) * 100)}%`;
      h(row, "div", "wos-row-value", fmtDur(mins));
    }
  }
  if (s.kinds.length) {
    h(proj, "div", "wos-panel-title wos-gap", "This week by activity");
    const topK = s.kinds[0][1];
    for (const [name, mins] of s.kinds) {
      const row = h(proj, "div", "wos-row");
      h(row, "div", "wos-row-name", name);
      const track = h(row, "div", "wos-row-track");
      h(track, "div", "wos-row-bar").style.width = `${Math.round((mins / topK) * 100)}%`;
      h(row, "div", "wos-row-value", fmtDur(mins));
    }
  }
  if (s.doneToday.length) {
    h(proj, "div", "wos-panel-title wos-gap", "Finished today");
    for (const d of s.doneToday) h(proj, "div", "wos-done", `✅ ${d}`);
  }
}

export interface MenuItem {
  key: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

export function renderMenu(root: HTMLElement, status: string, items: MenuItem[], onPick: (item: MenuItem) => void, version = ""): void {
  root.textContent = "";
  root.classList.add("wos-menu");
  h(root, "div", "wos-menu-status", status);
  const groups: string[] = [];
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
  h(root, "div", "wos-menu-foot", `Press the letter, or tap. Esc closes.${version ? ` · add-on version ${version}` : ""}`);
}

export interface TaskRow {
  key: string;
  title: string;
  sub: string;
  due: string | null;
  done: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

export interface TaskGroup {
  name: string;
  rows: TaskRow[];
}

export function renderTaskList(root: HTMLElement, today: string, sections: { title: string; empty: string; groups: TaskGroup[] }[], footer: HTMLElement | null): void {
  root.textContent = "";
  root.classList.add("wos-tasks");
  for (const sec of sections) {
    const count = sec.groups.reduce((n, g) => n + g.rows.length, 0);
    h(root, "div", "wos-tasks-title", `${sec.title} · ${count}`);
    if (count === 0) {
      h(root, "div", "wos-empty", sec.empty);
      continue;
    }
    for (const g of sec.groups) {
      if (g.rows.length === 0) continue;
      const box = h(root, "div", "wos-panel wos-task-group");
      h(box, "div", "wos-panel-title", g.name);
      for (const r of g.rows) {
        const row = h(box, "div", "wos-task-row" + (r.done ? " is-done" : ""));
        const cb = h(row, "input", "task-list-item-checkbox wos-task-check");
        cb.type = "checkbox";
        cb.checked = r.done;
        cb.setAttribute("aria-label", `Mark "${r.title}" ${r.done ? "not done" : "done"}`);
        cb.addEventListener("click", (e) => {
          e.preventDefault();
          r.onToggle();
        });
        const text = h(row, "button", "wos-task-text");
        text.type = "button";
        h(text, "span", "wos-task-name", r.title);
        if (r.sub) h(text, "span", "wos-task-sub", r.sub);
        text.addEventListener("click", () => r.onOpen());
        if (r.due) h(row, "span", "wos-task-due" + (r.due < today ? " is-late" : r.due === today ? " is-today" : ""), r.due === today ? "today" : r.due);
      }
    }
  }
  if (footer) root.appendChild(footer);
}

export interface KindChoice {
  emoji: string;
  label: string;
}

/** "What are you doing?" — one tap on a kind; a description is optional. */
export function renderActivity(root: HTMLElement, kinds: KindChoice[], placeholder: string, onPick: (index: number, text: string) => void): HTMLInputElement {
  root.textContent = "";
  root.classList.add("wos-activity");
  const input = h(root, "input", "wos-activity-input");
  input.type = "text";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", "What exactly (optional)");
  h(root, "div", "wos-menu-group", "Tap what kind of work it is (Enter = the first one)");
  const grid = h(root, "div", "wos-menu-grid");
  kinds.forEach((k, i) => {
    const b = h(grid, "button", "wos-menu-item");
    b.type = "button";
    h(b, "span", "wos-kind-emoji", k.emoji);
    h(b, "span", "wos-menu-label", k.label);
    b.addEventListener("click", () => onPick(i, input.value.trim()));
  });
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onPick(0, input.value.trim());
    }
  });
  return input;
}

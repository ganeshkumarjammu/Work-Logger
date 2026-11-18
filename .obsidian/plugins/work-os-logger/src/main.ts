import {
  App, FuzzySuggestModal, Modal, Notice, Platform, Plugin, PluginSettingTab, Setting, TFile, TFolder,
} from "obsidian";
import {
  Days, MEETING_MARK, Timer, buildNow, buildStatus, buildWeekBlock, emptyDay, fmtDur, hhmm, inboxItems,
  insertUnderHeading, isoWeekLabel, level, parseDaily, parseNow, removeExactLine, replaceAutoBlock, safeName,
  scoreData, streak, stripStamp, totalAll, weekStart, ymd,
} from "./core";
import { MenuItem, renderMenu, renderScore } from "./ui";

const F = {
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
  templates: "90 Templates",
};
const TIME_LOG = "## Time Log";
const INBOX_ITEMS = "## Items";
const OTHER = "Other (type a name)";
const NONE = "No project";
const TO_INBOX = "Inbox (decide later)";
const SAMPLE_MARK = "(sample)";

interface Settings {
  dailyGoalMins: number;
  capMins: number;
  skipWeekends: boolean;
  meetingSeries: string[];
}

interface LastLog {
  date: string;
  mins: number;
  title: string;
  taskPath: string | null;
  taskLine: string;
  dailyPath: string;
  dailyLine: string;
}

/** Only device-level things are kept here. Everything that matters lives in notes, so it syncs with the vault. */
interface Store {
  settings: Settings;
  lastLog: LastLog | null;
}

interface TaskOpts {
  start?: boolean;
  open?: boolean;
  asked?: string;
}

const DEFAULTS: Settings = {
  dailyGoalMins: 240,
  capMins: 180,
  skipWeekends: true,
  meetingSeries: ["Weekly Team Meeting", "1-1"],
};

const FALLBACK: Record<string, string> = {
  Inbox: `# Inbox\n\n${INBOX_ITEMS}\n`,
  Daily: `---\ntype: daily\ndate: {{date}}\n---\n# {{date}}\n\n${TIME_LOG}\n\n## Status update\n%% status:start %%\n%% status:end %%\n`,
  "Task Note": `---\ntype: task\nstatus: todo\nproject: "{{project}}"\ncreated: {{date}}\nactual_mins: 0\n---\n# {{title}}\n\n**Asked:** {{asked}}\n\n${TIME_LOG}\n`,
  Meeting: `---\ntype: meeting\ndate: {{date}}\nseries: "{{series}}"\n---\n# {{title}}\n\nPrevious: {{previous}}\n\n## Open actions from last time\n{{carryover}}\n\n## Notes\n- \n\n## Actions\n- [ ] \n\n${TIME_LOG}\n`,
  Project: `---\ntype: project\nstatus: active\nstart: {{date}}\n---\n# {{title}}\n\n## Tasks\n\n${TIME_LOG}\n`,
  "Project Info & Messages": `# {{project}} - Info & Messages\n\n## Log\n`,
  "Project Learning Notes": `# {{project}} - Learning Notes\n`,
  "Project Explain It": `# {{project}} - Explain It\n`,
  "Weekly Review": `# Week of {{date}}\n\n%% week:start %%\n%% week:end %%\n`,
};

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function oneLine(s: string): string {
  return s.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join(" / ");
}

class PromptModal extends Modal {
  private done = false;
  constructor(app: App, private heading: string, private onSubmit: (value: string) => void) {
    super(app);
  }
  onOpen(): void {
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
    input.addEventListener("keydown", (e: KeyboardEvent) => {
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
  onClose(): void {
    this.contentEl.empty();
  }
}

class PickModal<T> extends FuzzySuggestModal<T> {
  constructor(app: App, private items: T[], private label: (item: T) => string, placeholder: string, private onPick: (item: T) => void) {
    super(app);
    this.setPlaceholder(placeholder);
  }
  getItems(): T[] {
    return this.items;
  }
  getItemText(item: T): string {
    return this.label(item);
  }
  onChooseItem(item: T): void {
    this.onPick(item);
  }
}

class ForgotModal extends Modal {
  constructor(app: App, private title: string, private mins: number, private onPick: (mins: number | null) => void) {
    super(app);
  }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Timer ran ${fmtDur(this.mins)}` });
    contentEl.createEl("p", { text: `On "${this.title}". Was it left running? Pick what to log.` });
    const options: [string, number | null][] = [
      [`Log all ${fmtDur(this.mins)}`, this.mins],
      ["Log 2h", 120], ["Log 1h", 60], ["Log 30m", 30],
      ["Log nothing", null],
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
  onClose(): void {
    this.contentEl.empty();
  }
}

/** One menu for everything: a single hotkey (or one tap on the phone), then a letter. */
class MenuModal extends Modal {
  constructor(app: App, private status: string, private items: MenuItem[]) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText("Work OS");
    const pick = (item: MenuItem) => {
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
  onClose(): void {
    this.contentEl.empty();
  }
}

export default class WorkOSLogger extends Plugin {
  store: Store = { settings: { ...DEFAULTS }, lastLog: null };
  running: Timer | null = null;
  inboxCount = 0;
  todayTotal = 0;
  private statusEl: HTMLElement | null = null;
  private dayCache = new Map<string, ReturnType<typeof emptyDay>>();
  private boards = new Set<HTMLElement>();
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    const saved = (await this.loadData()) as Partial<Store> | null;
    if (saved) this.store = { settings: { ...DEFAULTS, ...(saved.settings ?? {}) }, lastLog: saved.lastLog ?? null };

    this.addRibbonIcon("layout-grid", "Work OS menu", () => void this.openMenu());
    this.addRibbonIcon("timer", "Start / stop timer on this note", () => void this.toggle());
    this.addRibbonIcon("inbox", "Capture to Inbox", () => this.captureInbox());
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addEventListener("click", () => void this.openMenu());
    this.registerInterval(window.setInterval(() => this.renderStatus(), 15000));

    // The only preset hotkey. Everything else is a letter inside the menu, which cannot clash with other commands.
    this.addCommand({
      id: "open-menu",
      name: "Open menu",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
      callback: () => void this.openMenu(),
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
        if (r && r.path === oldPath && file instanceof TFile) void this.setRunning({ ...r, path: file.path, title: file.basename });
        if (oldPath.startsWith(F.inboxFolder + "/") || file.path.startsWith(F.inboxFolder + "/")) void this.refreshInbox().then(() => this.scheduleRefresh());
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (this.fm(file).type === "task") this.scheduleRefresh(); // a task was finished or reopened, here or on the other device
      }),
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
        if (r) new Notice(`▶ Timer still running on "${r.title}" since ${hhmm(new Date(r.start))}`);
      })();
      window.setTimeout(() => this.checkHotkeys(true), 4000);
    });
  }

  /** Something changed on disk, possibly because sync brought it from the other device. */
  private onChanged(path: string): void {
    if (path === F.now) void this.loadRunning().then(() => this.renderStatus());
    else if (path.startsWith(F.inboxFolder + "/")) void this.refreshInbox().then(() => this.scheduleRefresh());
    else if (path.startsWith(F.daily + "/")) {
      this.dayCache.delete(path);
      this.scheduleRefresh();
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshAll();
    }, 600);
  }

  // ---------- menu ----------

  menuItems(): (MenuItem & { id: string })[] {
    const r = this.running;
    const item = (key: string, id: string, group: string, label: string, run: () => unknown, hint?: string) =>
      ({ key, id, group, label, hint, run: () => void run() });
    return [
      item("s", "toggle-timer", "Timer", r ? "Stop the timer" : "Start timer on this note", () => this.toggle(), r ? `logs ${r.title}` : undefined),
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
      item("x", "remove-samples", "Go to", "Remove the sample data", () => this.askRemoveSamples(), "when you have finished trying"),
    ];
  }

  async openMenu(): Promise<void> {
    const r = this.running;
    const inbox = this.inboxCount ? ` · 📥 ${this.inboxCount} in Inbox` : "";
    const status = r
      ? `▶ ${r.title} · ${fmtDur(Math.max(0, Math.round((Date.now() - r.start) / 60000)))}${inbox}`
      : `Nothing is being timed · today ${fmtDur(this.todayTotal)}${inbox}`;
    new MenuModal(this.app, status, this.menuItems()).open();
  }

  /** Reports any other command that uses the same key as the menu. Uses Obsidian internals, so it fails softly. */
  checkHotkeys(quietIfOk: boolean): void {
    try {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const app = this.app as any;
      const mine = `${this.manifest.id}:open-menu`;
      const get = (id: string): { modifiers: string[]; key: string }[] =>
        app.hotkeyManager.getHotkeys(id) ?? app.hotkeyManager.getDefaultHotkeys(id) ?? [];
      const norm = (hk: { modifiers: string[]; key: string }) =>
        hk.modifiers.map((m) => (m === "Mod" ? (Platform.isMacOS ? "Meta" : "Ctrl") : m)).sort().join("+") + "+" + String(hk.key).toLowerCase();
      const myKeys = get(mine).map(norm);
      if (myKeys.length === 0) {
        new Notice('The Work OS menu has no hotkey. Set one in Settings → Hotkeys → search "Work OS".', 12000);
        return;
      }
      const clashes: string[] = [];
      for (const [id, cmd] of Object.entries(app.commands.commands as Record<string, { name: string }>)) {
        if (id !== mine && get(id).some((hk) => myKeys.includes(norm(hk)))) clashes.push(cmd.name);
      }
      if (clashes.length) {
        new Notice(`⚠ The Work OS menu key is also used by: ${clashes.join(", ")}.\nChange one of them in Settings → Hotkeys.`, 20000);
      } else if (!quietIfOk) {
        new Notice("✔ No conflict: the Work OS menu key is used by nothing else in this vault.", 8000);
      }
    } catch {
      if (!quietIfOk) new Notice('Could not check automatically. Open Settings → Hotkeys, search "Work OS": Obsidian marks a clashing key in red.', 12000);
    }
  }

  // ---------- helpers ----------

  async save(): Promise<void> {
    await this.saveData(this.store);
  }

  today(): string {
    return ymd(new Date());
  }

  private file(path: string): TFile | null {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }

  private async ensureFolder(path: string): Promise<void> {
    let cur = "";
    for (const part of path.split("/").filter(Boolean)) {
      cur = cur ? `${cur}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(cur)) {
        try {
          await this.app.vault.createFolder(cur);
        } catch {
          /* already there */
        }
      }
    }
  }

  private async createNote(path: string, content: string): Promise<TFile> {
    const existing = this.file(path);
    if (existing) return existing;
    await this.ensureFolder(path.split("/").slice(0, -1).join("/"));
    return this.app.vault.create(path, content);
  }

  /** Every write goes through here so cached numbers never go stale. */
  private async edit(file: TFile, fn: (content: string) => string): Promise<void> {
    await this.app.vault.process(file, fn);
    this.dayCache.delete(file.path);
  }

  private async tpl(name: string): Promise<string> {
    const f = this.file(`${F.templates}/${name}.md`);
    return f ? this.app.vault.read(f) : FALLBACK[name] ?? "";
  }

  private async openFile(file: TFile): Promise<void> {
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private async openPath(path: string): Promise<void> {
    const f = this.file(path);
    if (f) await this.openFile(f);
    else new Notice(`Could not find ${path}`);
  }

  async openToday(): Promise<void> {
    await this.openFile(await this.ensureDaily(this.today()));
  }

  private isDaily(path: string): boolean {
    return path.startsWith(F.daily + "/");
  }

  private fm(file: TFile): Record<string, unknown> {
    return (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
  }

  private projectOf(file: TFile): string | null {
    const prefix = F.projects + "/";
    if (file.path.startsWith(prefix)) {
      const parts = file.path.slice(prefix.length).split("/");
      if (parts.length >= 2) return parts[0];
    }
    const raw = this.fm(file).project;
    const p = typeof raw === "string" ? raw.replace(/[[\]]/g, "").trim() : "";
    return p && p !== NONE ? p : null;
  }

  private projects(): string[] {
    const folder = this.app.vault.getAbstractFileByPath(F.projects);
    if (!(folder instanceof TFolder)) return [];
    return folder.children.filter((c) => c instanceof TFolder).map((c) => c.name).sort();
  }

  private pickProject(placeholder: string, extra: string[], cb: (choice: string) => void): void {
    new PickModal<string>(this.app, [...extra, ...this.projects()], (x) => x, placeholder, cb).open();
  }

  private dailyPath(date: string): string {
    return `${F.daily}/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.md`;
  }

  private async ensureDaily(date: string): Promise<TFile> {
    const path = this.dailyPath(date);
    return this.file(path) ?? this.createNote(path, fill(await this.tpl("Daily"), { date, title: date }));
  }

  // ---------- numbers: always rebuilt from the notes ----------

  async loadDays(): Promise<Days> {
    const projects = new Set(this.projects());
    const files = this.app.vault.getMarkdownFiles();
    const days: Days = {};
    for (const f of files) {
      if (!this.isDaily(f.path) || !/^\d{4}-\d\d-\d\d$/.test(f.basename)) continue;
      if (this.fm(f).sample === true) continue; // sample days never count
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
      (days[date] ??= emptyDay()).done.push(f.basename);
    }
    return days;
  }

  private async score(days?: Days) {
    const s = this.store.settings;
    return scoreData(days ?? (await this.loadDays()), this.today(), s.dailyGoalMins, s.skipWeekends, this.inboxCount);
  }

  private async paint(el: HTMLElement, days?: Days): Promise<void> {
    try {
      renderScore(el, await this.score(days));
    } catch (e) {
      console.error("Work OS Logger: scoreboard", e);
      el.textContent = "Work OS scoreboard could not be drawn. See the developer console.";
    }
  }

  /** Recomputes today's total, the status bar and every scoreboard that is on screen. */
  async refreshAll(): Promise<Days> {
    const days = await this.loadDays();
    this.todayTotal = days[this.today()]?.total ?? 0;
    this.renderStatus();
    for (const el of Array.from(this.boards)) {
      if (!el.isConnected) this.boards.delete(el);
      else await this.paint(el, days);
    }
    return days;
  }

  renderStatus(): void {
    if (!this.statusEl) return;
    const r = this.running;
    const inbox = this.inboxCount > 0 ? ` · 📥 ${this.inboxCount}` : "";
    if (r) {
      const mins = Math.max(0, Math.round((Date.now() - r.start) / 60000));
      this.statusEl.setText(`▶ ${r.title} · ${fmtDur(mins)}${inbox}`);
    } else {
      this.statusEl.setText(`⏱ Today ${fmtDur(this.todayTotal)}${inbox}`);
    }
  }

  // ---------- the running timer lives in a note, so it follows you between devices ----------

  async loadRunning(): Promise<void> {
    const f = this.file(F.now);
    this.running = f ? parseNow(await this.app.vault.read(f)) : null;
  }

  async setRunning(t: Timer | null): Promise<void> {
    this.running = t;
    const text = buildNow(t);
    const f = this.file(F.now);
    if (f) await this.app.vault.process(f, () => text);
    else await this.createNote(F.now, text);
    this.renderStatus();
  }

  // ---------- inbox ----------

  private async inboxFile(): Promise<TFile> {
    return this.file(F.inbox) ?? this.createNote(F.inbox, await this.tpl("Inbox"));
  }

  /** Notes dropped into the Inbox folder (anything except the Inbox list itself). */
  private looseNotes(): TFile[] {
    const folder = this.app.vault.getAbstractFileByPath(F.inboxFolder);
    if (!(folder instanceof TFolder)) return [];
    return folder.children.filter((c): c is TFile => c instanceof TFile && c.extension === "md" && c.path !== F.inbox);
  }

  async refreshInbox(): Promise<void> {
    const f = this.file(F.inbox);
    this.inboxCount = (f ? inboxItems(await this.app.vault.read(f)).length : 0) + this.looseNotes().length;
    this.renderStatus();
  }

  captureInbox(): void {
    new PromptModal(this.app, "Capture to Inbox (your timer keeps running)", (v) => void this.addToInbox(v)).open();
  }

  async addToInbox(text: string): Promise<void> {
    const clean = oneLine(text);
    if (!clean) return;
    const now = new Date();
    const line = `- ${clean} (${ymd(now).slice(5)} ${hhmm(now)})`;
    await this.edit(await this.inboxFile(), (c) => insertUnderHeading(c, INBOX_ITEMS, line));
    await this.refreshInbox();
    await this.refreshAll();
    new Notice(`📥 Saved to Inbox (${this.inboxCount} waiting). Back to work.`);
  }

  async processInbox(): Promise<void> {
    const f = await this.inboxFile();
    type Entry = { label: string; raw?: string; text?: string; note?: TFile };
    const entries: Entry[] = [
      ...inboxItems(await this.app.vault.read(f)).map((it) => ({ label: it.text, raw: it.raw, text: it.text })),
      ...this.looseNotes().map((n) => ({ label: `📄 Note: ${n.basename}`, note: n })),
    ];
    if (entries.length === 0) {
      new Notice("📭 Inbox is empty.");
      return;
    }
    const lineActions = ["Do it now (task + timer)", "Task for later", "Small to-do (Tasks list)", "Save to a project's Info & Messages", "Delete (not needed)"];
    const noteActions = ["Open it", "Move into a project folder", "Move to Archive", "Delete (not needed)"];
    new PickModal<Entry>(this.app, entries, (e) => e.label, `${entries.length} in Inbox: pick one to decide`, (entry) => {
      const note = entry.note;
      if (note) {
        new PickModal<string>(this.app, noteActions, (x) => x, note.basename, (action) => void this.resolveInboxNote(note, noteActions.indexOf(action))).open();
      } else {
        new PickModal<string>(this.app, lineActions, (x) => x, stripStamp(entry.text ?? ""), (action) => {
          void this.resolveInbox(entry.raw ?? "", entry.text ?? "", lineActions.indexOf(action));
        }).open();
      }
    }).open();
  }

  /** A whole note sitting in the Inbox folder. action: 0 open, 1 move to project, 2 archive, 3 delete */
  async resolveInboxNote(note: TFile, action: number, project?: string): Promise<void> {
    if (action === 0) {
      await this.openFile(note);
      return;
    }
    if (action === 1 && project === undefined) {
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
    if (this.inboxCount === 0) new Notice("📭 Inbox zero! Nothing left waiting.", 6000);
    else await this.processInbox();
  }

  /** action: 0 do now, 1 task later, 2 small to-do, 3 project info, 4 delete */
  async resolveInbox(raw: string, text: string, action: number, project?: string | null): Promise<void> {
    const clean = stripStamp(text);
    const name = safeName(clean).slice(0, 80).trim();
    const needsProject = action === 0 || action === 1 || action === 3;
    if (needsProject && project === undefined) {
      this.pickProject("Which project?", action === 3 ? [] : [NONE], (p) => void this.resolveInbox(raw, text, action, p === NONE ? null : p));
      return;
    }
    if (action === 0 || action === 1) {
      await this.createTask(name, project ?? null, { start: action === 0, open: action === 0, asked: clean });
    } else if (action === 2) {
      const list = this.file(F.tasksFile);
      if (list) await this.edit(list, (c) => insertUnderHeading(c, "## Next (this week)", `- [ ] ${clean}`));
    } else if (action === 3 && project) {
      await this.appendInfo(project, clean, true);
    }
    await this.edit(await this.inboxFile(), (c) => removeExactLine(c, raw));
    await this.refreshInbox();
    await this.refreshAll();
    if (this.inboxCount === 0) new Notice("📭 Inbox zero! Nothing left waiting.", 6000);
    else if (action !== 0) await this.processInbox();
  }

  // ---------- sample data ----------

  askRemoveSamples(): void {
    const yes = "Yes, remove all sample notes";
    new PickModal<string>(this.app, [yes, "Cancel"], (x) => x, "Remove the sample project, tasks, days and meeting?", (pick) => {
      if (pick === yes) void this.removeSamples();
    }).open();
  }

  /** Samples are notes with the property `sample: true`, plus list lines marked "(sample)". They go to the vault's trash. */
  async removeSamples(): Promise<number> {
    const timed = this.running ? this.file(this.running.path) : null;
    if (timed && this.fm(timed).sample === true) await this.setRunning(null);
    const samples = this.app.vault.getMarkdownFiles().filter((f) => !f.path.startsWith(F.templates + "/") && this.fm(f).sample === true);
    const folders = new Set<string>();
    for (const f of samples) {
      const m = new RegExp(`^${escapeRe(F.projects)}/([^/]+)/\\1\\.md$`).exec(f.path);
      if (m) folders.add(`${F.projects}/${m[1]}`); // a sample project: remove its whole folder
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
    const isSampleLine = (l: string) =>
      l.includes(SAMPLE_MARK) || Array.from(l.matchAll(/\[\[([^\]|]+)/g)).some((x) => names.has(x[1]));
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (f.path.startsWith(F.templates + "/")) continue;
      const text = await this.app.vault.read(f);
      if (!text.includes(SAMPLE_MARK) && !Array.from(names).some((n) => text.includes(`[[${n}`))) continue;
      await this.edit(f, (c) => c.split("\n").filter((l) => !(/^\s*[-*|]/.test(l) && isSampleLine(l))).join("\n"));
      if (this.isDaily(f.path)) await this.stampDaily(f);
    }
    await this.refreshInbox();
    await this.refreshAll();
    new Notice(`Removed ${samples.length} sample notes. They are in this vault's trash if you want them back.`, 8000);
    return samples.length;
  }

  // ---------- timer ----------

  async toggle(): Promise<void> {
    await this.loadRunning(); // the other device may have started or stopped it
    if (this.running) return this.requestStop(false);
    const f = this.app.workspace.getActiveFile();
    if (!f) {
      new Notice("Open the note you are working on, then start the timer.");
      return;
    }
    await this.startTimer(f);
  }

  async startTimer(file: TFile, kind: "work" | "meeting" = "work"): Promise<void> {
    const r = this.running;
    if (r) {
      if (r.path === file.path) {
        new Notice(`▶ Already timing "${r.title}"`);
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
    new Notice(`▶ Started: ${file.basename}`);
  }

  async requestStop(withNote: boolean): Promise<void> {
    const r = this.running;
    if (!r) {
      new Notice("No timer is running.");
      return;
    }
    const mins = Math.round((Date.now() - r.start) / 60000);
    const finish = (override?: number) => {
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

  async discard(): Promise<void> {
    await this.setRunning(null);
    new Notice("Timer cleared. Nothing logged.");
  }

  async stopTimer(opts: { note?: string; mins?: number; quiet?: boolean } = {}): Promise<void> {
    const r = this.running;
    if (!r) return;
    const mins = opts.mins ?? Math.round((Date.now() - r.start) / 60000);
    await this.setRunning(null);
    if (mins < 1) {
      if (!opts.quiet) new Notice("Under 1 minute. Nothing logged.");
      return;
    }
    await this.logSession(r, mins, opts.note ?? "", !!opts.quiet);
  }

  /** For when the timer was never started: pick how long, it is logged on the open note ending now. */
  logForgotten(): void {
    const active = this.app.workspace.getActiveFile();
    const choices = [15, 30, 45, 60, 90, 120, 180];
    const where = active ? active.basename : "today's note (general work)";
    new PickModal<number>(this.app, choices, (m) => fmtDur(m), `How long did you work on: ${where}?`, (mins) => {
      void (async () => {
        const file = active ?? (await this.ensureDaily(this.today()));
        const kind = this.fm(file).type === "meeting" ? "meeting" : "work";
        await this.logSession({ path: file.path, title: file.basename, start: Date.now() - mins * 60000, kind }, mins, "", false);
      })();
    }).open();
  }

  /** Keeps the day's totals as properties on the daily note, so Obsidian's own table views can show them. */
  private async stampDaily(daily: TFile): Promise<void> {
    const st = parseDaily(await this.app.vault.read(daily), new Set(this.projects()));
    await this.app.fileManager.processFrontMatter(daily, (m) => {
      m.mins_logged = st.total;
      m.sessions = st.sessions;
    });
    this.dayCache.delete(daily.path);
  }

  private async logSession(r: Timer, mins: number, rawNote: string, quiet: boolean): Promise<void> {
    const start = new Date(r.start);
    const end = new Date(r.start + mins * 60000);
    const date = ymd(start);
    const range = `${hhmm(start)}-${hhmm(end)}`;
    const note = rawNote.replace(/\s+/g, " ").trim();

    const file = this.file(r.path);
    const timedDaily = this.isDaily(r.path);
    const project = file && !timedDaily ? this.projectOf(file) : null;
    const title = timedDaily ? "General work" : file ? file.basename : r.title;
    const taskLine = `- ${date} ${range} [mins:: ${mins}]${note ? " " + note : ""}`;
    const mark = r.kind === "meeting" ? `${MEETING_MARK} ` : "";
    const links = timedDaily ? "General work" : `${mark}[[${title}]]${project && project !== title ? ` · [[${project}]]` : ""}`;
    const dailyLine = `- ${range} [mins:: ${mins}] ${links}${note ? " — " + note : ""}`;
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
      new Notice("Logger: could not write the time into a note. Nothing was counted. Try again.", 10000);
      return;
    }
    s.lastLog = { date, mins, title, taskPath, taskLine, dailyPath: this.dailyPath(date), dailyLine };
    await this.save();
    const days = await this.refreshAll();
    if (quiet) return;

    const goal = s.settings.dailyGoalMins;
    const dayBefore = before[date]?.total ?? 0;
    const dayNow = days[date]?.total ?? 0;
    const st = streak(days, this.today(), s.settings.skipWeekends);
    const lines = [`✔ ${fmtDur(mins)} logged · ${title}`, `Today ${fmtDur(dayNow)} of ${fmtDur(goal)} · 🔥 ${st}-day streak`];
    if (dayBefore < goal && dayNow >= goal) lines.push("🎯 Daily goal reached!");
    const lvBefore = level(totalAll(before)).level;
    const lvNow = level(totalAll(days)).level;
    if (lvNow > lvBefore) lines.push(`⬆ Level ${lvNow}!`);
    new Notice(lines.join("\n"), 7000);
  }

  async undoLast(): Promise<void> {
    const l = this.store.lastLog;
    if (!l) {
      new Notice("Nothing to undo on this device.");
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
    new Notice(`↩ Removed: ${fmtDur(l.mins)} on ${l.title}`);
  }

  // ---------- tasks ----------

  newTask(): void {
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

  async createTask(rawName: string, project: string | null, opts: TaskOpts = {}): Promise<TFile> {
    const { start = true, open = true, asked = "" } = opts;
    const date = this.today();
    const folder = project ? `${F.projects}/${project}/Tasks` : F.looseTasks;
    let name = rawName;
    // Two notes with the same name would make [[links]] ambiguous: add the project to the name.
    if (!this.file(`${folder}/${name}.md`) && this.app.vault.getMarkdownFiles().some((f) => f.basename === name)) {
      name = `${name} (${project ?? "general"})`;
    }
    const path = `${folder}/${name}.md`;
    const isNew = !this.file(path);
    const file = await this.createNote(path, fill(await this.tpl("Task Note"), { title: name, date, project: project ?? NONE, asked }));
    if (isNew) {
      const box = `- [ ] [[${name}]]`;
      const home = project ? this.file(`${F.projects}/${project}/${project}.md`) : null;
      const list = home ?? this.file(F.tasksFile);
      if (list) await this.edit(list, (c) => insertUnderHeading(c, home ? "## Tasks" : "## Next (this week)", box));
    }
    if (open) await this.openFile(file);
    if (start) await this.startTimer(file);
    else new Notice(`Task saved for later: ${name}`);
    return file;
  }

  openTasks(): TFile[] {
    const key = (f: TFile) => String(this.fm(f).last_worked ?? this.fm(f).created ?? "");
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => !f.path.startsWith(F.templates + "/") && this.fm(f).type === "task" && this.fm(f).status !== "done")
      .sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0));
  }

  resumeTask(): void {
    const tasks = this.openTasks();
    if (tasks.length === 0) {
      new Notice("No open tasks. Open the menu and press T to make one.");
      return;
    }
    const label = (f: TFile) => {
      const spent = Number(this.fm(f).actual_mins) || 0;
      return `${f.basename} · ${this.projectOf(f) ?? NONE}${spent ? ` · ${fmtDur(spent)} so far` : ""}`;
    };
    new PickModal<TFile>(this.app, tasks, label, "Resume which task?", (f) => {
      void (async () => {
        await this.openFile(f);
        await this.startTimer(f);
      })();
    }).open();
  }

  async finishTask(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || this.fm(file).type !== "task") {
      new Notice("Open the task note you finished first (menu → R lists your open tasks).");
      return;
    }
    if (this.running?.path === file.path) await this.stopTimer({ quiet: true });
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
      if (list) await this.edit(list, (c) => c.replace(re, `$1- [x] [[${name}]] ✅ ${date}`));
    }
    const days = await this.refreshAll();
    const ws = weekStart(date);
    let weekDone = 0;
    for (const [d, v] of Object.entries(days)) if (d >= ws) weekDone += v.done.length;
    if (!days[date]?.done.includes(name)) weekDone += 1; // the property index can lag a moment behind the edit
    new Notice(`✅ Finished: ${name}\n${weekDone} task${weekDone === 1 ? "" : "s"} finished this week.\nLast step: fill "Explain it" (5 short lines).`, 8000);
  }

  // ---------- meetings ----------

  startMeeting(): void {
    const series = [...this.store.settings.meetingSeries, OTHER];
    new PickModal<string>(this.app, series, (x) => x, "Which meeting?", (pick) => {
      if (pick === OTHER) new PromptModal(this.app, "Meeting name", (v) => void this.createMeeting(safeName(v))).open();
      else void this.createMeeting(pick);
    }).open();
  }

  async createMeeting(series: string): Promise<void> {
    if (!series) return;
    const date = this.today();
    const title = `${date} ${series}`;
    const path = `${F.meetings}/${title}.md`;
    let previous = "none (first one)";
    let carryover = "- none";
    const folder = this.app.vault.getAbstractFileByPath(F.meetings);
    if (folder instanceof TFolder && !this.file(path)) {
      const prev = folder.children
        .filter((c): c is TFile => c instanceof TFile && c.basename.endsWith(` ${series}`) && c.basename < title)
        .sort((a, b) => (a.basename < b.basename ? 1 : -1))[0];
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

  newProject(): void {
    new PromptModal(this.app, "New project name", (raw) => void this.createProject(safeName(raw))).open();
  }

  async createProject(name: string): Promise<void> {
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
      await this.edit(index, (c) => (c.includes(link) ? c : insertUnderHeading(c, "## Active", link)));
    }
    await this.openFile(home);
    new Notice(`Project "${name}" created with Info, Learning Notes, Explain It and Tasks.`);
  }

  async captureClipboard(): Promise<void> {
    let text = "";
    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch {
      /* no clipboard access */
    }
    if (!text) {
      new Notice("Nothing copied (or Obsidian cannot read the clipboard). Copy the message first.");
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

  async appendInfo(project: string, text: string, quiet = false): Promise<void> {
    const path = `${F.projects}/${project}/${project} - Info & Messages.md`;
    const file = await this.createNote(path, fill(await this.tpl("Project Info & Messages"), { project, title: project, date: this.today() }));
    const quoted = text.split("\n").map((l) => `> ${l}`).join("\n");
    const now = new Date();
    const entry = `### ${ymd(now)} ${hhmm(now)}\n${quoted}\n`;
    await this.edit(file, (c) => {
      const marker = "## Log";
      const i = c.indexOf(marker);
      if (i === -1) return c.replace(/\s+$/, "") + `\n\n${marker}\n\n${entry}`;
      const lineEnd = c.indexOf("\n", i);
      const at = lineEnd === -1 ? c.length : lineEnd + 1;
      return c.slice(0, at) + "\n" + entry + c.slice(at); // newest on top
    });
    if (!quiet) new Notice(`Saved to ${project} - Info & Messages`);
  }

  // ---------- reports ----------

  async copyStatus(): Promise<void> {
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
    } catch {
      /* no clipboard access */
    }
    new Notice(copied ? "Status copied. Paste it into your chat." : "Status written into today's note (could not reach the clipboard).");
  }

  async weeklyReport(): Promise<void> {
    const ws = weekStart(this.today());
    const label = isoWeekLabel(ws);
    const path = `${F.weekly}/${label}.md`;
    const file = await this.createNote(path, fill(await this.tpl("Weekly Review"), { date: ws, title: label }));
    const block = buildWeekBlock(await this.loadDays(), ws);
    await this.edit(file, (c) => replaceAutoBlock(c, "week", block));
    await this.openFile(file);
    new Notice("Weekly report updated with this week's numbers.");
  }
}

class LoggerSettings extends PluginSettingTab {
  constructor(app: App, private plugin: WorkOSLogger) {
    super(app, plugin);
  }
  display(): void {
    const { containerEl } = this;
    const s = this.plugin.store.settings;
    containerEl.empty();
    const num = (name: string, desc: string, get: () => number, set: (n: number) => void) =>
      new Setting(containerEl).setName(name).setDesc(desc).addText((t) =>
        t.setValue(String(get())).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > 0) {
            set(n);
            await this.plugin.save();
            await this.plugin.refreshAll();
          }
        }),
      );
    num("Daily goal (minutes)", "Logged minutes that fill the daily bar.", () => s.dailyGoalMins, (n) => (s.dailyGoalMins = n));
    num("Forgotten-timer check (minutes)", "If one session is longer than this, you are asked what to log.", () => s.capMins, (n) => (s.capMins = n));
    new Setting(containerEl).setName("Weekends do not break the streak").addToggle((t) =>
      t.setValue(s.skipWeekends).onChange(async (v) => {
        s.skipWeekends = v;
        await this.plugin.save();
        await this.plugin.refreshAll();
      }),
    );
    new Setting(containerEl).setName("Recurring meetings").setDesc("One name per line. These appear when you start a meeting.").addTextArea((t) =>
      t.setValue(s.meetingSeries.join("\n")).onChange(async (v) => {
        s.meetingSeries = v.split("\n").map((x) => safeName(x)).filter(Boolean);
        await this.plugin.save();
      }),
    );
  }
}

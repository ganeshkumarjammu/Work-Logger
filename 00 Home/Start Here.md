# Start Here

## 1. Turn on the add-on (one time)
The vault contains a small add-on called **Work OS Logger**. It is already inside this folder; nothing is downloaded.

1. Open this folder in Obsidian ("Open folder as vault"). Use a current version of Obsidian: the table views need 1.9 or newer (Settings → General shows the version).
2. If Obsidian asks whether you trust the author of this vault, choose **Trust author and enable plugins**.
3. If it did not ask: Settings (gear icon) → **Community plugins** → **Turn on community plugins** → switch on **Work OS Logger**.
4. You should now see a grid icon in the left bar and "⏱ Today 0m" at the bottom right, and [[Home]] shows the scoreboard.

To use it on your phone as well, follow [[Sync Setup]].

**New here? Do [[Try It First]]**: a 10-minute walk-through using the sample project that comes with the vault.

## 2. One menu, one hotkey
- **Laptop:** press **Ctrl+Shift+M**. A menu opens. Press one letter.
- **Phone:** tap the grid icon. Tap the action.

In this vault "Menu → S" means: open the menu, press S.

Ctrl+Shift+M is the only hotkey the add-on sets. A few seconds after Obsidian starts, the add-on checks whether any other command uses the same key and warns you if one does (Menu → K runs the check again). To change the key: Settings → Hotkeys → search "Work OS".

### Your day

**Morning (2 minutes)**
- Menu → O opens today's note. Write the One Thing and your Top 3.

**Working**
- Something lands on you (a request, a thought) → **Menu → I**, one line, Enter. Do not stop your task.
- New piece of work → **Menu → T**, type its name, Enter. The timer is already running.
- Going back to an earlier task → **Menu → R**, pick it.
- Stopping, or switching → **Menu → S** (or just start the next thing: the old one stops and is logged by itself).
- Forgot to start the timer → **Menu → L**, pick how long.
- Someone sends you something about the project → copy it → **Menu → V**.
- Meeting → **Menu → M**, pick the meeting.
- Task done → **Menu → D**.

You never type a time or a duration. Each stop writes one line in the task's own **Time Log** and one line in today's daily note, and adds the minutes to the task's `actual_mins`.

**End of day (3 minutes)**
- **Menu → P** → clear the Inbox: each item becomes a task, a to-do, project info, or is deleted.
- **Menu → U** → paste the status into your chat. Add "Blocked" and "Next" if needed.
- Tick the Shutdown list in the daily note.

**End of week**
- **Menu → W** → the weekly report fills in its own numbers. Write Done / In progress / Blocked / Next week and take it to the meeting.

## 3. What a project contains
**Menu → N** creates a folder with:

| Part | What goes in it |
|---|---|
| Home note | Why, done means, milestones, task list, decisions |
| Info & Messages | What other people told or sent you (Menu → V) |
| Learning Notes | What you worked out yourself |
| Explain It | How you will explain the project at the end |
| Tasks folder | One note per task, with the 7-step procedure and its time log |

See [[Situations]] for what to press in any real situation, [[Task Procedure]] for the 7 steps, and [[Habit Engine]] for why the system is built this way.

## 4. Good to know
- **Views:** the Task Board, Projects, Days, Meetings, People and Knowledge tables are Obsidian's built-in "Bases". They read the properties at the top of each note and update by themselves. Click a column header to sort.
- **Forgot to stop the timer?** If a session runs past 3 hours, you are asked how much to log.
- **Logged by mistake?** Menu → Z.
- **Settings** → Work OS Logger: daily goal (default 4 hours of logged work), meeting names, weekend rule.
- **Editing a Time Log line by hand is fine.** The numbers are always recalculated from the lines in your daily notes.
- Make tasks, meetings and projects from the menu. The plain "Insert template" command does not fill in project names.
- This vault holds company information. See the caution in [[Sync Setup]].

## 5. Folder map
| Folder | Question it answers |
|---|---|
| 00 Home | Where do I start? How am I doing? |
| 00 Inbox | What landed on me that I have not decided about yet? |
| 01 Daily | What did I do today, and for how long? |
| 02 Tasks | What small things do I owe? |
| 03 Projects | Where does each project stand? |
| 04 Reviews | Am I progressing? Can I prove it? |
| 05 Knowledge | How do I do this faster next time? |
| 06 Company | How does this company work? |
| 07 People | Who does what? What did we agree? |
| 08 Growth | Am I getting better? |
| 09 Founder Lab | What am I learning about building a business? |

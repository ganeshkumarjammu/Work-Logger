# Sync Setup

Getting this vault onto your phone. "Sync" means the same files are kept identical on the laptop and the phone, automatically.

## Why this vault is safe to sync
- **Every number comes from the notes.** The scoreboard, weekly report and status are rebuilt from the Time Log lines in your daily notes. Nothing is stored only on one device.
- **The running timer is a note** ([[Now]]). Start on the laptop, stop on the phone.
- **No generated files** that two devices could fight over.

So any method that copies the files works. Pick one.

## Pick one method (never two on the same vault)

| Method | Cost | Phone | Effort | Notes |
|---|---|---|---|---|
| **Obsidian Sync** | Paid (see obsidian.md/sync for the current price) | Android and iPhone | Lowest: built into Obsidian, nothing to install on the laptop | Also carries the Work OS add-on and settings to the phone |
| **Syncthing** | Free | Android only (app: Syncthing-Fork) | Medium: a small program on the laptop and an app on the phone | Works best when both devices are on at the same time. The company laptop may block it |
| **Git** | Free | Possible but awkward | High | Not automatic: you push and pull by hand. Not recommended here |

Obsidian's own help warns against iCloud Drive on Windows (files can be duplicated or damaged), so a Windows laptop with an iPhone realistically means Obsidian Sync.

## Steps: Obsidian Sync
**On the laptop**
1. Settings → Core plugins → turn on **Sync**.
2. Settings → Sync → log in (create an Obsidian account if you have none) and buy or start Sync.
3. **Create a new remote vault**, choose a password, connect this vault to it.
4. Still in Settings → Sync, under the list of what to sync, turn on **Installed community plugins**, **Active community plugin list**, **Hotkeys** and **Core plugin settings**. This is what sends the Work OS add-on to the phone.
5. Wait until the sync icon (bottom right) shows it is finished.

**On the phone**
1. Install Obsidian. Create a new empty vault called `Work OS`.
2. Settings → Core plugins → turn on **Sync** → log in → connect to the remote vault you made → turn on the same options as in step 4.
3. Wait for the first sync to finish. Close and reopen Obsidian.
4. Settings → Community plugins → **Turn on community plugins** → switch on **Work OS Logger**.
5. Open [[Home]]. The scoreboard should show the same numbers as the laptop.

## Steps: Syncthing (Android, free)
1. Laptop: get Syncthing (it can run without installing). Phone: install **Syncthing-Fork**.
2. In each, add the other as a device (scan the QR code).
3. Laptop: share the whole `Work OS` folder, **including the hidden `.obsidian` folder**, as "Send & Receive". Accept it on the phone into a folder you can find.
4. Phone: Obsidian → "Open folder as vault" → choose that folder → turn on community plugins → switch on Work OS Logger.

## Using it on the phone
- There are no hotkeys on a phone. Tap the **Work OS icon** (grid) to open the menu. It is in the ribbon menu; to keep it one tap away, add "Work OS Logger: Open menu" to the toolbar above the keyboard (Settings → Toolbar).
- Let sync finish before you switch devices. If you stop the timer on the phone while the laptop has not yet synced, wait a few seconds and look again.
- "Undo the last time log" only works on the device that made the log.
- Settings of the add-on (daily goal, meeting names) follow you only if plugin settings are synced (step 4).

## One caution
Syncing puts company information on your personal phone and, with a cloud service, on that service. Check that your company allows this. If it does not, keep sensitive details (logs, code, customer names) in the company tools and keep only your own notes here.

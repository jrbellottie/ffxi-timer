# FFXI Timer

A desktop app for **Final Fantasy XI** that tracks **Vana'diel time** and **moon phases**, and lets players create timers for real life, Vana'diel time, moon phases, notorious monsters (NMs), and crafting‑guild / Tenshodo openings — all with Windows notifications.

Because Vana'diel time is **global** (the same instant for every player on Earth), the app ships **pre‑calibrated and works out of the box in any time zone**. There is **no required setup** — just install and go. A manual override is available if needed (see [Manual Calibration](#manual-calibration-optional)).

---

## Quick start

1. Install using the setup file from the latest [release](https://github.com/jrbellottie/ffxi-timer/releases).
2. Launch **FFXI Timer**.
3. Confirm the **Vana'diel Clock** on the first tab matches the in‑game `/clock`. It should already be correct — no calibration needed.
4. **Turn on Windows notifications** for the app (see below) so timers can alert you.

---

## Notifications (read this first)

The app fires **Windows system notifications** when a timer is due. If Windows is suppressing notifications, your timers will run but you won't see or hear the alert.

**Make sure notifications will work:**

- Open **Windows Settings → System → Notifications** and make sure notifications are **On**, and enabled for **FFXI Timer** once it has fired at least once.
- Turn **Do Not Disturb / Focus Assist** **OFF** (it hides toasts).
- Turn **Game Mode OFF** if you're not seeing alerts — Game Mode can suppress notifications while a game is focused.

**How alerts behave:**

- Repeating timers (Vana'diel, real life, moon, presets) show a toast and **repeat about every 20 seconds until you click the notification** to dismiss it. Clicking the toast stops the repeats and disables that timer.
- NM interval pops are **one‑shot** notifications (they don't repeat).

**Background note:** Windows may throttle background apps to save power. If the app is minimized/backgrounded and Windows delays a timer, the app **catches up immediately** when it regains focus and fires anything that was due. This is expected OS behavior, not a bug in the timing logic.

---

## The tabs

The app is organized into tabs across the top:

| Tab | What it's for |
|-----|---------------|
| **Clock & Timers** | Live Vana'diel clock + moon phase, and the list of all timers created |
| **Vana / Real / Moon** | Create Vana'diel weekday timers, real‑life timers, and moon‑phase timers |
| **NM Timers** | Create notorious monster timers (timed window or lottery) |
| **Presets** | One‑click timers for crafting‑guild openings, Next Dig, and Tenshodo |
| **Counters** | Manual tally counters (success/failure and synthesis HQ tracking) |
| **Calibration** | Optional manual override for day/time and moon (not needed by default) |

> **Tip:** When you add a timer from any tab, the **Clock & Timers** tab briefly **flashes** so you can tell the timer was created and where to find it.

Every tab except **Clock & Timers** has a **← Back to Clock & Timers** button.

---

## Clock & Timers tab

This is the home screen. At the top it shows:

- **Vana'diel Clock** — current Vana'diel weekday and time (color‑coded by day).
- **Moon** — current moon phase, direction (waxing ▲ / waning ▼), and percentage, plus a countdown to the next moon step.

Below that is the **Timers** list. Each timer shows its next fire time in both Earth (local) and Vana'diel time, plus a live countdown. From here you can **Enable/Disable** or **Delete** any timer. NM timers also expose their extra controls here (see [NM Timers](#nm-timers-tab)).

---

## Vana / Real / Moon tab

### Vana'diel Timers
Fire at a specific **Vana'diel weekday + time** (e.g. Firesday 06:00). Uses the app's day calibration, so they stay accurate over long sessions. Good for scheduled in‑game events and anything tied to the Vana'diel week.

### Real Life Timers
Fire at a **local (real‑world) date and time**. After firing, they automatically roll forward to the next day so a daily reminder keeps working.

**Accepted date formats** (shown as helper text under the field):
- **ISO 24‑hour:** `YYYY-MM-DDTHH:MM:SS` — e.g. `2026-07-14T14:06:40`
- **US 12‑hour:** `MM/DD/YYYY HH:MM:SS AM/PM` — e.g. `07/14/2026 02:06:40 PM`

The field validates as you type: a red border and message appear if the value doesn't match one of the formats above, and the **Add** button stays disabled until it's valid.

### Moon Timers
Fire at a specific moon phase, set by **Waxing / Waning + target %**. The input maps to a fixed moon step, so these are accurate and drift‑free. Ideal for fishing, chocobo digging, and moon‑dependent events.

---

## NM Timers tab

Two modes for tracking notorious monsters:

### Timed spawn (window + interval)
For NMs with a spawn window. Players provide:
- **Warn lead** — how far ahead to warn (e.g. `10s`). The alert will also fire at the end of the timer.
- **ToD (local)** — time of death. Leave blank to use *now*, or enter a specific time (see accepted formats below).
- **Window start / end** — when the spawn window opens and closes (e.g. `2h` to `2.5h`).
- **Interval** — how often to re‑alert inside the window (e.g. `5m`).

Example: start `2h`, end `2.5h`, interval `5m` → warns at 1:59:50, then pops at 2:00:00, 2:05:00, … 2:30:00 from the time of the ToD that was set.

Example2: Fafnir would be start `21h`, end `24h`, interval `30m` with ToD *now* as soon as
the name disappears.

### Lottery (PH respawn loop)
For lottery‑spawn NMs. You provide a **PH respawn** duration (e.g. `5m`). Each time you kill the placeholder, click **PH killed** to reset the respawn countdown. Use **Clear PH** to stop the loop.

**Duration formats** (for Warn lead, Window start/end, Interval, PH respawn):
- Single unit: `10s`, `5m`, `2h`, `2.5h`
- Combined: `1h45m55s`, `1m30s`
- Colon: `1:45:55`, `1:30`

**ToD date formats:**
- ISO 24‑hour: `YYYY-MM-DDTHH:MM:SS`
- US 12‑hour: `MM/DD/YYYY HH:MM:SS AM/PM`

All fields validate live — invalid entries are highlighted and block the **Start** button until fixed.

**Managing NM timers** (from the Clock & Timers list):
- **Set ToD now** — update the time of death to the current moment.
- **PH killed** — reset the placeholder respawn (lottery mode). Set 'PH killed' as soon as the name and body disappears to time it perfectly.
- **Clear PH** — stop the placeholder loop.

---

## Presets tab

One‑click timers for common recurring openings. They're added as normal Vana'diel timers, so they appear in the timer list and respect calibration.

- **Offset** — set how many **Vana'diel hours before the opening** you want to be alerted (default `2`). Applies to all presets on this tab.
- **Next Dig** — targets 00:00 (chocobo digging reset).
- **Crafting Guilds** — every guild (Woodworking, Clothcraft, Smithing, Goldsmithing, Bonecraft, Alchemy, Cooking, Fishing, Leathercraft). Each shows its open/close hours and weekly holiday, and automatically **skips its holiday**.
- **Tenshodo** — handles the multiple Tenshodo locations and their different holidays, merging timers when their fire times line up.

Each preset card previews exactly when it will next fire before you add it.

---

## Counters tab

Simple manual tally tools for tracking sessions:

- **Increment** — how much each click adds (default 1).
- **Success / Failure** — running totals with a success‑rate percentage.
- **Synthesis** — track **HQ1 / HQ2 / HQ3 / NQ / Break** results with per‑tier and HQ‑total percentages.

**Left‑click a button to add, right‑click to subtract.** Use **Reset counters** to clear the tallies.

---

## Manual Calibration (optional)

> **You do not need this.** The app ships pre‑calibrated for both Vana'diel time and moon phase, and it is timezone‑independent — it will be correct on any machine, in any time zone, with no setup.

The **Calibration** tab is a manual **override** for the rare cases where you want to force the app to a specific reference (for example, if you believe the defaults are off, or you cleared your data and want to fine‑tune). Day and Moon are calibrated separately; saving either one overrides that part of the default.

### Day & Time override
Aligns the app to the in‑game `/clock`.

1. In FFXI, type `/clock`.
2. Pick a Vana'diel time a few seconds in the future to sync against.
3. On the **Calibration** tab → **Day calibration**, select the **Weekday** and enter the **Hour** and **Minute**.
4. Click **Save day calibration**.

Being off by ±1 minute is fine for functionality. This controls Vana'diel timers, guild/preset timers, and weekday/holiday logic.

### Moon Phase override
The in‑game moon **percentage is approximate** (it can drift 1–2%). The app uses the true moon‑phase tick instead.

1. Look up the next **"New Moon Start"** time (e.g. from [pyogenes](https://www.pyogenes.com/ffxi/timer/v2.html)).
2. On the **Calibration** tab → **Moon calibration**, enter the **New Moon Start** time.
   - Supported: `MM/DD/YYYY HH:MM:SS AM/PM` or `YYYY-MM-DDTHH:MM(:SS)`
3. Click **Save moon calibration**.

Use **Reset to defaults** under Moon calibration to restore the shipped moon anchor.

> Note: The in‑game moon % may still differ slightly from the app — that's expected, because the app uses the true phase rather than the game's rounded estimate.

---

## Data & privacy

- All settings and timers are stored **locally** on your machine (inside the app's data folder). Nothing is uploaded anywhere.
- To start completely fresh, close the app and delete its data folder at
  `%APPDATA%\ffxi-clock`, then relaunch.

---

## Troubleshooting

**I don't get notifications.**
- Enable notifications for the app in **Windows Settings → System → Notifications**.
- Turn **Do Not Disturb / Focus Assist** and **Game Mode** **OFF**.

**Notifications only appear when I focus the app.**
- Windows throttles background apps. The app catches up and fires due timers when it regains focus. This is expected.

**Moon % doesn't match in‑game exactly.**
- Expected — the in‑game display is a rounded estimate; the app uses the true moon phase.

**The clock/timers look wrong.**
- The defaults should be correct everywhere. If you've previously saved a manual calibration, open the **Calibration** tab and use **Reset to defaults** (moon) and/or re‑enter the day calibration from `/clock` — or clear the app data folder (see above) to return to the shipped defaults.

---

## Building from source

Requirements: Node.js.

```powershell
npm install          # install dependencies
npm run dev          # run in development (Vite + Electron)
npm run build        # type-check + build renderer/main
npm run dist:win     # build the Windows installer into release/
```

The Windows setup installer is produced at `release\FFXI Timer Setup <version>.exe`.

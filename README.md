# FFXI Timer App – Setup & Calibration Guide

This app tracks **Vana’diel time**, **moon phases**, and allows you to create **Vana**, **real-life**, **moon**, and **guild** timers that remain accurate over long play sessions.

Because Final Fantasy XI does **not** expose an absolute timestamp, the app must be **calibrated once**. After calibration, the app does not drift and rarely needs adjustment.

---

## Overview

There are **two independent calibration steps**:

1. **Vana’diel Day & Time** – syncs to the in-game `/clock`
2. **Moon Phase** – syncs to the *true* moon phase tick (not the in-game estimate)

Both are required for full accuracy.

---

## Day & Time Calibration (Vana’diel Clock)

This aligns the app with the current in-game time and weekday.

### Steps

1. Log into FFXI
2. In chat, type: /clock
3. Choose a Vana'diel time in the near future to sync the app with the Vana'diel time
4. Note the following:
- **Weekday** (e.g. Firesday)
- **Hour**
- **Minute**

5. In the app:
- Open **Calibration**
- Under **Day calibration**
  - Select the matching **Weekday**
  - Enter the **Hour** and **Minute**
- Click **Save day calibration**


### Notes

- You do **not** need to click save on an exact second
- Being off by ±1 minute in game is fine for functionality, adjust the sync according to your preference
- This calibration controls:
- Vana’diel timers
- Guild timers
- Weekday / holiday logic

Once saved (and moon phase), this section can be hidden permanently.

---

## Moon Phase Calibration (IMPORTANT)

The in-game moon percentage is **approximate** and can drift by **1–2%**.  
For accurate fishing, crafting, and moon timers, the app uses the **true moon phase tick**.

### Why This Is Required

- In-game moon % is an estimate
- HQ rates and events depend on the real moon phase
- This calibration prevents long-term drift

---

### Steps

1. Open the following site: https://www.pyogenes.com/ffxi/timer/v2.html

2. Find the **next “New Moon Start”** time  
(use the *upcoming* new moon, not a past one)

3. In the app:
- Open **Calibration**
- Under **Moon calibration**
- Enter the **New Moon Start** time

Supported formats:
- `MM/DD/YYYY HH:MM:SS AM/PM`
- `YYYY-MM-DDTHH:MM(:SS)`

4. Click **Save moon calibration**

### Notes

- This represents the **true moon phase reset**
- The in-game moon % may still differ slightly — this is expected
- After this, moon timers will never drift

---

## Calibration Summary

| System | Required | Frequency |
|------|--------|-----------|
| Vana’diel Time | Yes | Once |
| Moon Phase | Yes | Once |
| Recalibration | Rare | Only if data is cleared |

---

## Timers

### Vana’diel Timers
- Trigger at a specific **weekday + time**
- Uses your day calibration
- Ideal for:
- Guild openings
- NM windows
- Scheduled events

---

### Real Life Timers
- Trigger at a **local system time**
- Automatically roll forward after firing
- Useful for:
- AFK reminders
- IRL schedules

---

### Moon Timers
- Set using **Waxing / Waning + %**
- Maps to a fixed moon step
- Accurate and drift-free
- Ideal for:
- Fishing
- Chocobo Digging
- Moon-based events

---

### Guild Timers
- Preset timers for known guild schedules
- Fire **1 hour before the guild opens**
- Automatically skip holidays
- Added as standard Vana’diel timers, so they:
- Respect calibration
- Appear in the timer list
- Can be enabled/disabled or deleted

Examples:
- Cooking Guild (skips Darksday)
- Tenshodo (handles multiple locations and holidays)

---

## Troubleshooting

**I don’t get notifications**
- The app uses **Windows system notifications**
- Make sure:
  - **Do Not Disturb / Focus Assist** is **OFF**
  - **Game Mode** is **OFF** (Game Mode can suppress notifications)
  - Notifications are enabled for the app in **Windows Settings → System → Notifications**

**Notifications only appear when I click or focus the app**
- This can happen on Windows when the app is fully backgrounded
- Windows may throttle background timers to save power
- When the app regains focus, it immediately catches up and fires any due timers
- This is expected OS behavior and does **not** mean the timer logic is incorrect

**Moon % doesn’t match in-game exactly**
- Expected behavior
- In-game display can be off by 1–2%
- App uses the true moon phase

**Timers fire at the wrong time**
- Recheck day calibration
- Verify weekday, hour, and minute from `/clock`

**Everything seems wrong**
- Clear calibration
- Re-run both calibration steps carefully

---

## Final Notes

- Calibration persists across restarts
- Timers are deterministic once calibrated
- The app does not drift over time

Future expansions (already supported by the architecture):
- Additional guild presets
- Import/export calibration
- Visual moon cycle tools

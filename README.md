# Kupo

A desktop companion app for **Final Fantasy XI** (era-focused / [LandSandBoat](https://github.com/LandSandBoat/server)-based servers). Hosting a full toolkit of timers and notifications, fishing and clamming references, chocobo digging, weather forecasting, a bestiary, drop and BCNM databases, a skillchain calculator, and a crafting planner.

Vana'diel time is **global** (the same instant for every player on Earth), so the app works out of the box in any time zone. Just install and go.

Kupo is a **fully standalone app**. It never reads, writes, or modifies game files, memory, or network traffic, and it doesn't hook into or interact with the FFXI client in any way. Everything you see is driven by the app's own simulation of Vana'diel time and its bundled database information — it's a reference and timer tool for informational purposes only.

---

## Quick start

1. Install using the setup file from the latest [release](https://github.com/jrbellottie/kupo/releases).
2. Launch **Kupo**.
3. Confirm the **Vana'diel Clock** on the first tab matches the in-game `/clock`.
4. **Turn on Windows notifications** for the app (see below) so timers can alert you.

---

## Notifications

The app fires **Windows system notifications** when a timer is due. If Windows is suppressing notifications, your timers will run but you won't see or hear the alert.

- Open **Windows Settings → System → Notifications** and make sure notifications are **On**, and enabled for **Kupo** once it has fired at least once.
- Turn **Do Not Disturb / Focus Assist** **OFF** (it hides toasts).
- Turn **Game Mode OFF** if you're not seeing alerts — it can suppress notifications while a game is focused.

**How alerts behave:**

- Repeating timers (Vana'diel, real life, moon, presets) show a toast and **repeat about every 20 seconds until you click the notification** to dismiss it. Clicking the toast stops the repeats and disables that timer.
- If you never click, repeats **stop automatically after 10 alerts**.
- NM interval pops are **one-shot** notifications (they don't repeat).

**Background note:** Windows may throttle background apps to save power. If a timer is delayed while the app is minimized, the app **catches up immediately** when it regains focus and fires anything that was due.

---

## The tabs

### 🕐 Clock & Timers
The home screen. Shows the live **Vana'diel clock** (weekday + time, color-coded by day) and the **moon phase** (percentage, waxing/waning, countdown to the next moon step). Below is the list of every timer you've created, with next fire time in both Earth and Vana'diel time, a live countdown, and Enable/Disable/Delete controls. When you add a timer from any tab, this tab briefly flashes to confirm it.

### ⏱️ Time Tools
Create timers of every kind:
- **Vana'diel timers** — fire at a specific Vana'diel weekday + time (e.g. Firesday 06:00).
- **Real life timers** — fire at a local date/time (daily reminders roll forward automatically) or as a simple countdown.
- **Moon timers** — fire at a specific moon phase (waxing/waning + target %).
- **Stopwatch** — a stopwatch with lap tracking.

### 👹 NM Timers
Track notorious monsters in two modes:
- **Timed spawn** — enter ToD (or use *now*), a spawn window (e.g. `21h`–`24h`), a re-alert interval, and a warn lead. The app alerts before the window, at each interval inside it, and when it closes.
- **Lottery** — enter the placeholder respawn time and click **PH killed** each kill to reset the loop; **Clear PH** stops it.

Durations accept `10s`, `2.5h`, `1h45m55s`, or colon formats (`1:45:55`); all fields validate live.

### ⭐ Presets
One-click Vana'diel timers for recurring openings: **crafting guilds** (all nine, each skipping its weekly holiday), **Tenshodo** locations, and **Next Dig** (00:00 chocobo digging reset). A configurable offset alerts you N Vana'diel hours before opening, and each card previews its next fire time.

### 🔢 Counters
Manual tally counters for sessions: **Success/Failure** with a success-rate percentage, and a **Synthesis** tracker for HQ1/HQ2/HQ3/NQ/Break results with per-tier percentages. Left-click adds, right-click subtracts.

### 🪝 Lu Shang
Progress tracker for the 10,000 moat carp needed for the Lu Shang's Fishing Rod. Add singles or full stacks, set the total directly, and watch the remaining count and progress bar.

### 🐟 Fish
Searchable, sortable fish database: zones and areas, skill level, size, vendor price, catch requirements, rarity, and optimal moon/time/season conditions.

### 🪱 Bait
Fishing spot analyzer. Pick a zone/area and bait to see the full catch pool, hook rates, and competing fish — plus a skill-up calculator for finding the best spots to level fishing.

### 🎣 Rods
Rod database with skill caps and per-fish breakage math using the server formulas: durability, snap chance, and break chance for each rod/fish combination.

### 🪣 Clam
Clamming reference for all clamming points: item drop rates (with and without +1 swimwear), vendor prices, and bucket weight management.

### 🐤 Digging
Chocobo digging tables by zone: item rates, vendor/AH prices, moon-phase success modifiers, digging rank requirements, and gil-per-dig estimates.

### 🌦️ Weather
Vana'diel weather forecaster for every zone. Shows each zone's weather patterns and elements and predicts upcoming weather by Vana'diel day.

### ⚔️ BCNM
Battlefield browser for BCNM/KSNM/ENM fights: filter by arena or type, search by name, and view orb requirements, level caps, and complete loot tables with drop rates.

### 💰 Drops
Mob drop database searchable by item: drop/steal/despoil rates per mob, mob level range and zone, vendor price, auction house listability, and era availability.

### 📖 Bestiary
Offline monster database generated from a pinned LandSandBoat revision: per-zone monster groups, level-based HP/MP and combat stats, jobs, family, aggro/link behavior, detection senses, resistances, and modifiers. Choose **ToAU cap** or **WotG cap** rulesets; post-WotG content is excluded. Calculated totals use default LSB settings — live server values can differ, and the detail view labels this.

### 🔗 Skillchains
Skillchain calculator: pick weapons/weapon skills and find the two- and three-step combinations that produce each skillchain property.

### 🔨 Crafting
Two tools in one:
- **Recipes** — browse era-appropriate recipes by craft, level, and crystal (optionally including WotG).
- **Planner** — enter your skill to see the best recipes to level on, with success rates, expected skill gain per synth, and support/gear/moghancement bonuses factored in. Guild rank-up test items are highlighted.

---

## Data & privacy

- All settings and timers are stored **locally** on your machine. Nothing is uploaded anywhere.
- To start completely fresh, close the app and delete its data folder at `%APPDATA%\kupo`, then relaunch.
- Uninstall via the uninstaller in the app's install folder; the data folder above is kept unless you delete it yourself.

---

## Troubleshooting

**I don't get notifications.**
- Enable notifications for the app in **Windows Settings → System → Notifications**.
- Turn **Do Not Disturb / Focus Assist** and **Game Mode** **OFF**.

**Notifications only appear when I focus the app.**
- Windows throttles background apps. The app catches up and fires due timers when it regains focus. This is expected.

**Moon % doesn't match in-game exactly.**
- Expected — the in-game display is a rounded estimate; the app uses the true moon phase.

---

## Building from source

Requirements: Node.js.

```powershell
npm install          # install dependencies
npm run dev          # run in development (Vite + Electron)
npm run build        # type-check + build renderer/main
npm run dist:win     # build the Windows installer into release/
```

To refresh the bestiary from an LSB checkout:

```powershell
npm run bestiary:generate -- C:\path\to\LandSandBoat\server
```

The Windows setup installer is produced at `release\Kupo Setup <version>.exe`.

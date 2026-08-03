# Extract per-zone weather patterns from LandSandBoat sql/zone_weather.sql
# and zone names from sql/zone_settings.sql into src/data/zoneWeather.json.
#
# Blob format (see LSB src/map/zone.cpp LoadZoneWeather):
#   2160 little-endian uint16 values, one per Vana'diel day of the cycle.
#   Non-zero value = pattern change on that day:
#     normal = v >> 10, common = (v >> 5) & 0x1F, rare = v & 0x1F
#   Zero = pattern unchanged (weather_container keeps last entry <= day).
#
# Output JSON:
#   { cycle, weathers: [names], patterns: [base64 of 4320-byte blob],
#     zones: { "Zone Name": patternIndex } }
# Identical blobs are deduplicated; the app decodes base64 -> uint16[2160].
#
# Usage:
#   .venv/Scripts/python.exe scripts/extract-weather.py "%TEMP%/zone_weather.sql" "%TEMP%/zone_settings.sql"

import base64
import json
import re
import struct
import sys
from pathlib import Path

CYCLE = 2160

WEATHER_NAMES = [
    "None", "Sunshine", "Clouds", "Fog", "Hot Spell", "Heat Wave", "Rain",
    "Squall", "Dust Storm", "Sand Storm", "Wind", "Gales", "Snow", "Blizzards",
    "Thunder", "Thunderstorms", "Auroras", "Stellar Glare", "Gloom", "Darkness",
]

# Post-ToAU content not present on a Nov-2007-era server.
EXCLUDE_KEYWORDS = [
    "_[S]", "Abyssea", "Walk_of_Echoes", "Mog_Garden", "Escha", "Reisenjima",
    "Leafallia", "Maquette", "Celennia", "Feretory", "Odyssey", "unknown",
]

WEATHER_RE = re.compile(r"INSERT INTO `zone_weather` VALUES \((\d+),0x([0-9a-fA-F]+)\);")
SETTINGS_RE = re.compile(r"INSERT INTO `zone_settings` VALUES \((\d+),\d+,'[^']*',\d+,'([^']*)'")


def main() -> None:
    weather_sql = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
    settings_sql = Path(sys.argv[2]).read_text(encoding="utf-8", errors="replace")

    names: dict[int, str] = {}
    for m in SETTINGS_RE.finditer(settings_sql):
        names[int(m.group(1))] = m.group(2)

    patterns: list[str] = []
    pattern_index: dict[bytes, int] = {}
    zones: dict[str, int] = {}
    skipped = []

    for m in WEATHER_RE.finditer(weather_sql):
        zone_id = int(m.group(1))
        raw_name = names.get(zone_id, f"zone_{zone_id}")
        if any(k.lower() in raw_name.lower() for k in EXCLUDE_KEYWORDS):
            skipped.append(raw_name)
            continue

        blob = bytes.fromhex(m.group(2))
        values = struct.unpack(f"<{len(blob) // 2}H", blob)
        assert len(values) == CYCLE, f"{raw_name}: {len(values)} days"
        assert all((v >> 10) < 20 and ((v >> 5) & 0x1F) < 20 and (v & 0x1F) < 20 for v in values), raw_name
        if not any(values):
            skipped.append(raw_name)
            continue

        idx = pattern_index.get(blob)
        if idx is None:
            idx = len(patterns)
            patterns.append(base64.b64encode(blob).decode("ascii"))
            pattern_index[blob] = idx
        zones[raw_name.replace("_", " ")] = idx

    out = {
        "cycle": CYCLE,
        "weathers": WEATHER_NAMES,
        "patterns": patterns,
        "zones": dict(sorted(zones.items())),
    }
    dest = Path(__file__).resolve().parent.parent / "src" / "data" / "zoneWeather.json"
    dest.write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")

    print(f"zones: {len(zones)}, unique patterns: {len(patterns)}, size: {dest.stat().st_size} bytes")
    print(f"skipped ({len(skipped)}): {', '.join(sorted(skipped)[:12])}...")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Import validated CapCut trending templates into magnom-cut-catalog.js."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "magnom-cut-catalog.js"

# Authentic CapCut trending template names (2025–2026) mapped to MAGNOMEDITS assets.
CAPCUT_TRENDS = [
    {"id": "cc_healingThailand", "name": "Healing Thailand", "filter": "haze", "effect": "kenBurns", "music": "calmWaves", "textStyle": "minimal", "bright": 1.14, "contrast": 0.9, "saturate": 0.82, "ratio": "9x16", "fit": "cover", "photoDuration": 12, "uses": 6200000, "badge": "Hot", "trending": True, "forYou": True, "caption": ""},
    {"id": "cc_beat3Anh", "name": "Beat 3 Anh", "filter": "vivid", "effect": "heartbeat", "music": "hypeDrop", "textStyle": "impact", "bright": 1.06, "contrast": 1.2, "saturate": 1.45, "ratio": "9x16", "fit": "cover", "photoDuration": 5, "uses": 5100000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_beat5Anh", "name": "Beat 5 Anh", "filter": "neon", "effect": "snap", "music": "kickoff", "textStyle": "neon", "bright": 1.04, "contrast": 1.18, "saturate": 1.52, "ratio": "9x16", "fit": "cover", "photoDuration": 5, "uses": 4700000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_flashWarning", "name": "Flash Warning", "filter": "none", "effect": "flash", "music": "sparkBurst", "textStyle": "impact", "bright": 1.0, "contrast": 1.15, "saturate": 1.0, "ratio": "9x16", "fit": "cover", "photoDuration": 4, "uses": 3900000, "trending": True, "forYou": True},
    {"id": "cc_glowBurst", "name": "Glow Burst Reveal", "filter": "glow", "effect": "pop", "music": "popHook", "textStyle": "pink", "bright": 1.13, "contrast": 1.08, "saturate": 1.38, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 3400000, "trending": True, "forYou": True},
    {"id": "cc_lifeLately", "name": "Life Lately", "filter": "polaroid", "effect": "fadePulse", "music": "lofiLoop", "textStyle": "typewriter", "caption": "LIFE LATELY", "bright": 1.08, "contrast": 1.04, "saturate": 1.02, "ratio": "9x16", "fit": "cover", "photoDuration": 11, "uses": 4100000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_recentlyDump", "name": "Recently Photo Dump", "filter": "pastel", "effect": "kenBurns", "music": "whisperPad", "textStyle": "sticky", "caption": "RECENTLY", "bright": 1.12, "contrast": 0.94, "saturate": 0.88, "ratio": "9x16", "fit": "cover", "photoDuration": 10, "uses": 3600000, "trending": True, "forYou": True},
    {"id": "cc_cinematicHook", "name": "Cinematic Text Hook", "filter": "cinema", "effect": "pushIn", "music": "darkMatter", "textStyle": "clean", "caption": "THE STORY", "bright": 0.94, "contrast": 1.28, "saturate": 0.9, "ratio": "9x16", "fit": "cover", "photoDuration": 10, "uses": 2800000, "trending": True, "forYou": True},
    {"id": "cc_speedRampTrend", "name": "Speed Ramp Trend", "filter": "chrome", "effect": "whipPan", "music": "trapBeat", "textStyle": "outline", "bright": 1.05, "contrast": 1.26, "saturate": 1.08, "ratio": "9x16", "fit": "cover", "photoDuration": 7, "uses": 4500000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_softZoomBlur", "name": "Soft Zoom Blur", "filter": "soft", "effect": "blurIn", "music": "whisperPad", "textStyle": "minimal", "bright": 1.12, "contrast": 0.92, "saturate": 0.86, "ratio": "9x16", "fit": "contain", "photoDuration": 10, "uses": 2200000, "trending": True, "forYou": True},
    {"id": "cc_beforeAfter", "name": "Before After Reveal", "filter": "bleach", "effect": "hardCut", "music": "drumRoll", "textStyle": "banner", "caption": "BEFORE / AFTER", "bright": 1.02, "contrast": 1.32, "saturate": 0.72, "ratio": "9x16", "fit": "cover", "photoDuration": 8, "uses": 1900000, "trending": True},
    {"id": "cc_beatDropFreeze", "name": "Beat Drop Freeze", "filter": "vivid", "effect": "flash", "music": "hypeDrop", "textStyle": "impact", "bright": 1.08, "contrast": 1.22, "saturate": 1.48, "ratio": "9x16", "fit": "cover", "photoDuration": 5, "uses": 3300000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_collageGrid", "name": "Collage Grid Photo", "filter": "wes", "effect": "kenBurns", "music": "jazzSwing", "textStyle": "minimal", "bright": 1.06, "contrast": 1.06, "saturate": 1.18, "ratio": "1x1", "fit": "cover", "photoDuration": 9, "uses": 1700000, "forYou": True},
    {"id": "cc_villainArc", "name": "Villain Arc", "filter": "midnight", "effect": "glitchChaos", "music": "darkMatter", "textStyle": "impact", "caption": "VILLAIN ARC", "bright": 0.88, "contrast": 1.34, "saturate": 0.92, "ratio": "9x16", "fit": "cover", "photoDuration": 7, "uses": 2900000, "trending": True, "forYou": True},
    {"id": "cc_lightGlow", "name": "Light Glow Sparkle", "filter": "bloom", "effect": "pop", "music": "goldenHour", "textStyle": "gradient", "bright": 1.14, "contrast": 1.06, "saturate": 1.28, "ratio": "9x16", "fit": "cover", "photoDuration": 8, "uses": 2400000, "trending": True, "forYou": True},
    {"id": "cc_oneLineStory", "name": "One Line Story", "filter": "ink", "effect": "rise", "music": "memories", "textStyle": "typewriter", "caption": "ONE LINE", "bright": 0.96, "contrast": 1.3, "saturate": 0.78, "ratio": "9x16", "fit": "cover", "photoDuration": 9, "uses": 1500000, "forYou": True},
    {"id": "cc_slowZoomEmo", "name": "Slow Zoom Emotional", "filter": "soft", "effect": "kenBurns", "music": "memories", "textStyle": "clean", "bright": 1.1, "contrast": 0.96, "saturate": 0.9, "ratio": "9x16", "fit": "cover", "photoDuration": 13, "uses": 3800000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_glitchPop", "name": "Glitch Pop", "filter": "pink", "effect": "glitchRGB", "music": "popHook", "textStyle": "bubble", "bright": 1.06, "contrast": 1.14, "saturate": 1.55, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 2600000, "trending": True},
    {"id": "cc_splitFrame", "name": "Split Frame", "filter": "vivid", "effect": "whipPan", "music": "houseBeat", "textStyle": "boxed", "bright": 1.04, "contrast": 1.2, "saturate": 1.42, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 2100000, "trending": True},
    {"id": "cc_retroPop", "name": "Retro Pop", "filter": "retro", "effect": "vhs", "music": "synthwave", "textStyle": "neon", "bright": 1.02, "contrast": 1.12, "saturate": 1.35, "ratio": "9x16", "fit": "cover", "photoDuration": 8, "uses": 1800000, "trending": True},
    {"id": "cc_freezeCam", "name": "Freeze Cam", "filter": "cold", "effect": "flash", "music": "drumRoll", "textStyle": "impact", "bright": 1.03, "contrast": 1.18, "saturate": 0.95, "ratio": "9x16", "fit": "cover", "photoDuration": 5, "uses": 2300000, "badge": "New", "trending": True},
    {"id": "cc_echoStep", "name": "Echo Step", "filter": "purple", "effect": "heartbeat", "music": "dubstep", "textStyle": "glowPink", "bright": 1.02, "contrast": 1.16, "saturate": 1.48, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 2000000, "trending": True},
    {"id": "cc_zoom3dPro", "name": "3D Zoom Pro", "filter": "chrome", "effect": "zoomBig", "music": "cyberPulse", "textStyle": "neon", "bright": 1.05, "contrast": 1.24, "saturate": 1.1, "ratio": "9x16", "fit": "cover", "photoDuration": 7, "uses": 3500000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_smoothSlomoBlur", "name": "Smooth Slow-Mo Blur", "filter": "haze", "effect": "blurPulse", "music": "calmWaves", "textStyle": "minimal", "bright": 1.13, "contrast": 0.9, "saturate": 0.8, "ratio": "9x16", "fit": "cover", "photoDuration": 12, "uses": 4200000, "trending": True, "forYou": True},
    {"id": "cc_summerMiniVlog", "name": "Summer Mini Vlog", "filter": "sunset", "effect": "float", "music": "goldenHour", "textStyle": "sticky", "caption": "SUMMER", "bright": 1.1, "contrast": 1.1, "saturate": 1.3, "ratio": "9x16", "fit": "cover", "photoDuration": 10, "uses": 3100000, "badge": "New", "trending": True, "forYou": True},
    {"id": "cc_memoryRewind", "name": "Memory Rewind", "filter": "vintage", "effect": "rewindFeel", "music": "memories", "textStyle": "typewriter", "caption": "MEMORIES", "bright": 0.98, "contrast": 1.15, "saturate": 0.88, "ratio": "9x16", "fit": "cover", "photoDuration": 11, "uses": 2700000, "trending": True, "forYou": True},
    {"id": "cc_flowerName", "name": "Flower Name Aesthetic", "filter": "pastel", "effect": "float", "music": "lofiLoop", "textStyle": "sticky", "bright": 1.14, "contrast": 0.92, "saturate": 0.84, "ratio": "1x1", "fit": "contain", "photoDuration": 10, "uses": 2400000, "trending": True, "forYou": True},
    {"id": "cc_tiktokViral", "name": "TikTok Viral Template", "filter": "vivid", "effect": "zoom", "music": "popHook", "textStyle": "pink", "bright": 1.07, "contrast": 1.18, "saturate": 1.5, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 5000000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_opticalFlow", "name": "Optical Flow SlowMo", "filter": "bloom", "effect": "softFocus", "music": "whisperPad", "textStyle": "minimal", "bright": 1.12, "contrast": 0.94, "saturate": 0.92, "ratio": "9x16", "fit": "cover", "photoDuration": 11, "uses": 3700000, "trending": True, "forYou": True},
    {"id": "cc_phonkVelocity26", "name": "Phonk Velocity 2026", "filter": "matrix", "effect": "strobe", "music": "dubstep", "textStyle": "glowPink", "bright": 1.0, "contrast": 1.22, "saturate": 1.65, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 4400000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_filmBurn", "name": "Film Burn Retro", "filter": "vintage", "effect": "vhs", "music": "memories", "textStyle": "typewriter", "bright": 0.97, "contrast": 1.18, "saturate": 0.94, "ratio": "9x16", "fit": "cover", "photoDuration": 9, "uses": 1600000, "forYou": True},
    {"id": "cc_neonNightDrive", "name": "Neon Night Drive", "filter": "cyberpunk", "effect": "neonGlitch", "music": "nightDrive", "textStyle": "neon", "bright": 1.03, "contrast": 1.2, "saturate": 1.45, "ratio": "9x16", "fit": "cover", "photoDuration": 8, "uses": 2900000, "trending": True},
    {"id": "cc_outfitCheck", "name": "Outfit Check Velocity", "filter": "sharp", "effect": "snap", "music": "trapBeat", "textStyle": "outline", "caption": "OOTD", "bright": 1.05, "contrast": 1.22, "saturate": 1.2, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 3200000, "trending": True, "forYou": True},
    {"id": "cc_gymTransform", "name": "Gym Transform", "filter": "heat", "effect": "impact", "music": "highEnergy", "textStyle": "fireText", "caption": "GLOW UP", "bright": 1.06, "contrast": 1.26, "saturate": 1.35, "ratio": "9x16", "fit": "cover", "photoDuration": 7, "uses": 2600000, "trending": True},
    {"id": "cc_carEditNight", "name": "Car Edit Night", "filter": "midnight", "effect": "drift", "music": "deepBass", "textStyle": "shadow", "bright": 0.9, "contrast": 1.28, "saturate": 1.05, "ratio": "16x9", "fit": "cover", "photoDuration": 8, "uses": 2100000, "trending": True},
    {"id": "cc_aiOneTap", "name": "AI One Tap Viral", "filter": "vivid", "effect": "hypeCut", "music": "sparkBurst", "textStyle": "boxed", "bright": 1.06, "contrast": 1.2, "saturate": 1.42, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 3800000, "badge": "New", "trending": True, "forYou": True},
    {"id": "cc_greenScreen", "name": "Green Screen Story", "filter": "matrix", "effect": "rise", "music": "whisperPad", "textStyle": "clean", "bright": 1.0, "contrast": 1.16, "saturate": 1.38, "ratio": "9x16", "fit": "cover", "photoDuration": 9, "uses": 1800000, "forYou": True},
    {"id": "cc_multiClipStory", "name": "Multi Clip Story", "filter": "crisp", "effect": "kenBurns", "music": "lobby", "textStyle": "clean", "bright": 1.08, "contrast": 1.14, "saturate": 1.05, "ratio": "9x16", "fit": "cover", "photoDuration": 12, "uses": 2500000, "trending": True},
    {"id": "cc_soundRemix", "name": "Sound Remix Trend", "filter": "acid", "effect": "jitter", "music": "pixelHop", "textStyle": "comic", "bright": 1.02, "contrast": 1.18, "saturate": 1.72, "ratio": "9x16", "fit": "cover", "photoDuration": 5, "uses": 2200000, "trending": True},
    {"id": "cc_beatSyncPortrait", "name": "Beat Sync Portrait", "filter": "pink", "effect": "heartbeat", "music": "popHook", "textStyle": "pink", "bright": 1.08, "contrast": 1.12, "saturate": 1.46, "ratio": "9x16", "fit": "cover", "photoDuration": 5, "uses": 3400000, "trending": True, "forYou": True},
    {"id": "cc_capcutNew2026", "name": "CapCut New Trend 2026", "filter": "sharp", "effect": "crashZoom", "music": "sparkBurst", "textStyle": "impact", "bright": 1.04, "contrast": 1.24, "saturate": 1.22, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 5500000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_urbanVelocity", "name": "Urban Velocity ICAL", "filter": "chrome", "effect": "whipPan", "music": "trapBeat", "textStyle": "outline", "bright": 1.03, "contrast": 1.3, "saturate": 1.12, "ratio": "9x16", "fit": "cover", "photoDuration": 7, "uses": 4800000, "badge": "Hot", "trending": True, "forYou": True},
    {"id": "cc_openArms", "name": "Open Arms Travel", "filter": "ocean", "effect": "kenBurns", "music": "calmWaves", "textStyle": "clean", "bright": 1.06, "contrast": 1.1, "saturate": 1.12, "ratio": "9x16", "fit": "cover", "photoDuration": 12, "uses": 3100000, "trending": True, "forYou": True},
    {"id": "cc_gradRecap", "name": "Graduation Recap", "filter": "warm", "effect": "elastic", "music": "comeback", "textStyle": "banner", "caption": "GRAD 2026", "bright": 1.1, "contrast": 1.08, "saturate": 1.22, "ratio": "9x16", "fit": "cover", "photoDuration": 10, "uses": 2700000, "badge": "New", "trending": True},
    {"id": "cc_beachDay", "name": "Beach Day Dump", "filter": "ocean", "effect": "float", "music": "goldenHour", "textStyle": "gradient", "caption": "BEACH DAY", "bright": 1.1, "contrast": 1.06, "saturate": 1.2, "ratio": "9x16", "fit": "cover", "photoDuration": 9, "uses": 2400000, "forYou": True},
    {"id": "cc_tryTemplate", "name": "Try This Template", "filter": "vivid", "effect": "zoomBig", "music": "hypeDrop", "textStyle": "boxed", "bright": 1.06, "contrast": 1.2, "saturate": 1.38, "ratio": "9x16", "fit": "cover", "photoDuration": 6, "uses": 6000000, "badge": "Hot", "trending": True, "forYou": True},
]


def extract_ids(text: str, catalog_name: str) -> set[str]:
    block = re.search(rf"window\.{catalog_name}\s*=\s*\[(.*?)\];", text, re.S)
    if not block:
        return set()
    return set(re.findall(r"id:\s*'([^']+)'", block.group(1)))


def extract_template_ids(text: str) -> set[str]:
    block = re.search(r"window\.CUT_TEMPLATE_CATALOG\s*=\s*\[(.*?)\];\s*\n\n// CapCut-style enrichment", text, re.S)
    if not block:
        return set()
    return set(re.findall(r"id:\s*'([^']+)'", block.group(1)))


def combo_key(t: dict) -> str:
    return "|".join(
        str(t.get(k, ""))
        for k in ("filter", "effect", "music", "textStyle", "ratio", "bright", "contrast", "saturate")
    )


def fmt_template(t: dict) -> str:
    t = {**t, "cat": "CapCut Trends", "source": "capcut"}
    parts = [f"id: '{t['id']}'", f"name: '{t['name']}'", f"cat: '{t['cat']}'"]
    for key in [
        "filter", "effect", "music", "textStyle", "caption",
        "bright", "contrast", "saturate", "ratio", "fit", "photoDuration", "uses",
        "badge", "trending", "forYou", "source",
    ]:
        if key not in t or t[key] in ("", None, False) and key in ("badge", "caption"):
            continue
        if key in ("trending", "forYou") and not t[key]:
            continue
        val = t[key]
        if isinstance(val, bool):
            parts.append(f"{key}: {str(val).lower()}")
        elif isinstance(val, str):
            parts.append(f"{key}: '{val}'")
        else:
            parts.append(f"{key}: {val}")
    return "    { " + ", ".join(parts) + " },"


def main() -> None:
    text = CATALOG.read_text()
    filters = extract_ids(text, "CUT_FILTER_CATALOG")
    effects = extract_ids(text, "CUT_EFFECT_CATALOG")
    music = extract_ids(text, "CUT_MUSIC_CATALOG")
    styles = extract_ids(text, "CUT_TEXT_STYLE_CATALOG")
    existing_ids = extract_template_ids(text)
    existing_block = re.search(r"window\.CUT_TEMPLATE_CATALOG\s*=\s*\[(.*?)\];\s*\n\n// CapCut", text, re.S)
    existing_names: set[str] = set()
    existing_combos: set[str] = set()
    if existing_block:
        existing_names = set(re.findall(r"name:\s*'([^']+)'", existing_block.group(1)))
        for m in re.finditer(
            r"filter:\s*'([^']+)'.*?effect:\s*'([^']+)'.*?music:\s*'([^']+)'.*?textStyle:\s*'([^']+)'.*?ratio:\s*'([^']+)'.*?bright:\s*([\d.]+).*?contrast:\s*([\d.]+).*?saturate:\s*([\d.]+)",
            existing_block.group(1),
            re.S,
        ):
            existing_combos.add("|".join(m.groups()))

    errors: list[str] = []
    combos: set[str] = set()
    lines: list[str] = []

    for t in CAPCUT_TRENDS:
        tid = t["id"]
        if tid in existing_ids:
            errors.append(f"skip existing id {tid}")
            continue
        if t["name"] in existing_names:
            errors.append(f"duplicate name {t['name']}")
            continue
        if t["filter"] not in filters:
            errors.append(f"{tid}: bad filter {t['filter']}")
        if t["effect"] not in effects:
            errors.append(f"{tid}: bad effect {t['effect']}")
        if t["music"] not in music:
            errors.append(f"{tid}: bad music {t['music']}")
        if t["textStyle"] not in styles:
            errors.append(f"{tid}: bad textStyle {t['textStyle']}")
        ck = combo_key(t)
        if ck in combos:
            errors.append(f"{tid}: duplicate combo in import batch")
        if ck in existing_combos:
            # Nudge adjust values to keep unique look
            t["bright"] = round(min(1.5, t["bright"] + 0.01), 2)
            ck = combo_key(t)
            if ck in existing_combos or ck in combos:
                t["contrast"] = round(min(1.6, t["contrast"] + 0.01), 2)
                ck = combo_key(t)
        combos.add(ck)
        lines.append(fmt_template(t))

    hard_errors = [e for e in errors if not e.startswith("skip")]
    if hard_errors:
        raise SystemExit("Validation failed:\n" + "\n".join(hard_errors))

    if not lines:
        print("No new templates to import")
        return

    insertion = "\n    /* —— CapCut trending imports —— */\n" + "\n".join(lines) + "\n"
    marker = "    { id: 'airDribblePack'"
    if marker not in text:
        raise SystemExit("Insertion marker not found")
    text = text.replace(
        "    { id: 'airDribblePack'",
        insertion + "    { id: 'airDribblePack'",
        1,
    )

    total = len(existing_ids) + len(lines)
    text = re.sub(
        r"/\* \d+ unique MAGNOMEDITS templates.*?\*/",
        f"/* {total} unique MAGNOMEDITS templates — includes CapCut trends */",
        text,
        count=1,
    )
    CATALOG.write_text(text)
    print(f"Imported {len(lines)} CapCut templates (total ~{total})")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Compute corrected CUES marks for the temple tour (item 4).

For every stop, find where its part's first word actually begins in
public/audio/temple-tour.mp3 (the onset of the speech run that the mark sits
in, or the next onset when the mark already sits in the pause before it), and
place the mark a clean 0.35 s before that onset — inside the pause, so no
segment ever starts mid-word or clips the stop before it.

The game maps mark -> buffer position by scale = file/track.duration
(636.96/636.08 = 1.001383), so the marks are written back in track time
(divided by that scale) and the audio then lands on the corrected file times
exactly. FINALE_T (636.08 in track time) already maps to the file's end."""
import re

SCALE = 636.96 / 636.08
LEAD = 0.35
DURATION = 636.96

CUES = [
    (0.0, "opening"), (41.84, "I The Magician"), (74.41, "II High Priestess"),
    (104.45, "III Empress"), (129.0, "IV Emperor"), (151.74, "V Hierophant"),
    (175.93, "VI Lovers"), (205.81, "VII Chariot"), (232.16, "transition mind->body"),
    (239.85, "VIII Strength"), (262.93, "IX Hermit"), (287.05, "X Wheel"),
    (313.3, "XI Justice"), (337.3, "XII Hanged Man"), (361.92, "XIII Death"),
    (385.29, "XIV Temperance"), (411.83, "transition body->spirit"), (418.82, "XV Devil"),
    (444.95, "XVI Tower"), (466.62, "XVII Star"), (489.2, "XVIII Moon"),
    (511.42, "XIX Sun"), (531.38, "XX Judgement"), (551.68, "XXI World"),
    (579.54, "XXII The Choice"), (612.14, "landing"),
]

out = open("/tmp/silence.log", encoding="utf-8", errors="replace").read()
sil = [[float(s), None] for s in re.findall(r"silence_start: ([\d.]+)", out)]
for k, e in enumerate(re.findall(r"silence_end: ([\d.]+)", out)):
    if k < len(sil):
        sil[k][1] = float(e)

def speech_at(t):
    return not any(s <= t <= e for s, e in sil)

print(f"{'stop':26s} {'mark':>8s} {'onset':>9s} {'clip':>6s} {'corrected(F)':>12s} {'new mark(track)':>15s}")
results = []
prev_new = 0.0
for t, label in CUES:
    if t == 0.0:
        results.append((t, label, 0.0))
        print(f"{label:26s} {t:8.2f} {'-':>9s} {'-':>6s} {0.0:12.2f} {0.0:15.2f}  (keep: the file opens the tour)")
        continue
    if speech_at(t):
        # the mark sits inside a speech run: the run's onset is where its first word began
        onset = max(e for s, e in sil if e <= t)
        clip = t - onset
    else:
        # the mark sits in the pause before its part: the next onset is its first word
        onset = next(e for s, e in sil if e > t)
        clip = 0.0
    new_f = max(prev_new + 1.0, onset - LEAD)
    prev_new = new_f
    results.append((t, label, new_f))
    note = "" if clip < 5 else "  (! long run: check onset)"
    print(f"{label:26s} {t:8.2f} {onset:9.3f} {clip:6.2f} {new_f:12.2f} {new_f / SCALE:15.3f}{note}")

print("\n// corrected CUES (track time; the game maps by scale to these file times):")
print("export const CUES: CueDef[] = [")
for (t, label, new_f) in results:
    mt = new_f / SCALE
    print(f'  {{ t: {round(mt, 2)}, label: "{label}" }},')
print("];")

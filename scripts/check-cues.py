#!/usr/bin/env python3
"""Verify the temple tour's CUES marks against the actual recording
(public/audio/temple-tour.mp3, 636.96 s).

A mark is CLEAN when it falls inside a speech pause (the segment starts/ends
on a boundary, nothing cut). A segment END that lands in open speech is
flagged SUSPECT (it would clip the last word); a START mid-speech is flagged
too (it would begin mid-word). The final landing through FINALE_T is checked
against the file's true duration."""
import re, subprocess, sys

MP3 = "public/audio/temple-tour.mp3"
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
FINALE_T = 636.08

out = open("/tmp/silence.log", encoding="utf-8", errors="replace").read()
sil = [[float(s), None] for s in re.findall(r"silence_start: ([\d.]+)", out)]
# silencedetect alternates strictly: the k-th end closes the k-th start
for k, e in enumerate(re.findall(r"silence_end: ([\d.]+)", out)):
    if k < len(sil):
        sil[k][1] = float(e)
duration = 636.96
if sil and sil[-1][1] is None:
    sil[-1][1] = duration

def state(t):
    """'silence' if t is inside a detected pause, else 'speech'."""
    for s, e in sil:
        if s <= t <= e:
            return "silence"
    return "speech"

def nearest_gap(t):
    """The pause containing t, else the closest pause edge and its distance."""
    best = (1e9, None)
    for s, e in sil:
        if s <= t <= e:
            return (0.0, (s, e))
        d = min(abs(t - s), abs(t - e))
        if d < best[0]:
            best = (d, (s, e))
    return best

print(f"{'cue':28s} {'t':>8s}  {'at':8s}  {'nearest pause (dist)':>30s}  verdict")
print("-" * 100)
suspects = 0
for i, (t, label) in enumerate(CUES):
    st = state(t)
    d, gap = nearest_gap(t)
    if st == "silence":
        verdict = f"CLEAN (in pause {gap[0]:.2f}..{gap[1]:.2f})"
    else:
        verdict = f"SUSPECT mid-speech; nearest pause {gap[0]:.2f}..{gap[1]:.2f} at +{d:.2f}s" if gap else "SUSPECT no pause nearby"
        suspects += 1
    print(f"{label:28s} {t:8.2f}  {st:8s}  {f'{gap[0]:.2f}..{gap[1]:.2f} (+{d:.2f}s)' if gap else '-':>30s}  {verdict}")

# every segment end = the next cue; check the tail of each segment for speech running past it
print("\n-- segment ends: does speech run past `to`? (fade hides <=0.3 s) --")
for i in range(len(CUES) - 1):
    to = CUES[i + 1][0]
    st = state(to)
    if st == "speech":
        # how long until the next pause begins?
        nxt = next((s for s, e in sil if s > to), duration)
        run = nxt - to
        flag = "ok (fade masks it)" if run <= 0.3 else f"CLIPPED: speech runs {run:.2f}s past `to`"
        print(f"  end of [{CUES[i][1]:24s}] to={to:7.2f}  speech continues {flag}")
        suspects += flag.startswith("CLIPPED")
# the finale
print(f"\nfinale FINALE_T={FINALE_T} (file {duration}s): tail after finale = {duration - FINALE_T:.2f}s, state at FINALE_T: {state(FINALE_T)}")
print(f"\n{suspects} suspect mark(s)")
sys.exit(0)

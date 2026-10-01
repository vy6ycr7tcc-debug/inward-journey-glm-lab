# The Duat: audio inventory and what is missing

*Prepared for Samuel, item 8 ("Audio inventory first"). Nothing here is invented, nothing is
synthesized: this is what the Duat plays today, what exists on disk, and precisely what is
missing. The header rule in `src/world/duat.ts` stands: only the names of places are spoken.*

## 1. What the Duat plays today

**The Duat plays nothing of its own.** `src/world/duat.ts` contains no audio calls at all —
no ambience, no score, no narration, no voice for the hours, the gates, the weighing, or the
dawn. What a visitor actually hears while in the Duat comes from shared systems:

| Sound | Source | Notes |
|---|---|---|
| Temple room tone (a hall's hum, two resonances) | `audio.setTemple(true, false)` on entering the pyramid (`setPyr`) | The chant is explicitly suppressed — "the pyramid keeps its silence". Not Duat-specific; it is the pyramid-interior bed. |
| Crossing bell, 293.66 Hz | `enterDuatCrossing` / `exitDuatWalkBack` / `exitDuatDawn` (`audio.bell`) | A short bell on the fade, shared with the pyramid's own crossings. |
| Pit resonance | `audio.resonance(pitK)` in `pyramidFrame` | Tied to the pyramid's resonating chamber floor, before the hidden door — not the Duat itself. |
| Place names as text | the `#whisper` element (visual, silent) | "The Duat", "A door into the Duat.", and each hour's name as you come near its gate. Text only; never spoken. |

## 2. What exists on disk (`public/audio/`)

No Duat recordings exist anywhere in the repository. The full inventory of `public/audio/`:

- `J01…J11_*.mp3` — the journey's opening lessons (the shore, the crossing, the tarot arcana)
- `TREE_catalyst_of_the_body.mp3`, `temple-tour.mp3`, `water-bed.mp3`
- `adept/` (7), `answers/I…XX/` (the answers' clips), `archetype_qa/` (Q&A pairs)
- `densities/` (7 + the beginning), `lessons/` (5 paced lessons), `opening/` (8)
- `orbs/` (4), `passages/` (P01…P12), `past/` (4 monuments), `rites/` (numeral-part pairs), `standalone/` (3)
- `female/` — **empty**

`docs/` holds the temple-tour narration tooling (`scripts/check-cues.py`, `scripts/fix-cues.py`
— cue verification against the temple recording) and no Duat audio documents of any kind.

## 3. What is missing, precisely

Every place the Duat would carry a voice or a sound is silent. Specifically, with where each
would attach when a recording exists:

| Missing | Where it would live |
|---|---|
| The Duat's own ambience (the night river, the gorge wind) | an ambience bus entered with the Duat crossing, as the temple's room tone is entered with the temple |
| A voice for the hidden door | the crossing, on `enterDuatCrossing` |
| A telling for each of the six hours (the waters of Nun; the land of Sokar; Ra and Osiris; Apophis; the Hall of the Two Truths; the Field of Reeds) | one clip per hour, played while the visitor stands at its gate — the hour's clock (already beat-timed) would pace the tour's hold |
| The weighing's own moment | the Hall of the Two Truths' telling (hour 5) |
| The dawn | the stair's head, on `exitDuatDawn` |
| The tour's narration | the Duat tour (`src/world/duatTour.ts`) holds each stop in silence today; its stops are cue-ready — a track with its own cue times can be laid under them exactly as the temple tour's was, with the same `check-cues.py` discipline |

Nothing was invented to fill these silences, and nothing was synthesized: the tellings hold
in silence, and only the names of places appear as text, per the header's rule.

## 4. Room for the follow-up pass

The owner is rechecking the Duat and may send notes. Built so those notes land cheaply:

- Each hour's telling is data (`HOURS` in `duat.ts`): a forms-and-keys cycle or an animated
  moment (`moment` + `period`), swappable without touching the gates, the ground, or the tour.
- The animated moments are pure functions of their own clock (`apophisInto`, `weighingInto`,
  `boatShape`/`boatUAt`), so a later pass can re-time beats against a narration's cue times
  without re-engineering anything.
- The tour's stops come from `duatTourStops()` (name, place, hold); narration, when it exists,
  attaches to those stops the way the temple tour's narration attaches to its cues.

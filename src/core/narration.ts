/* Narration: the package's recorded tracks (content/narration.json), played on the voice
   bus with subtitles. Starting a track fades out any track already playing; leaving
   fades gently, never cuts. The bed ducks while a voice speaks. */
import catalogue from "../../content/narration.json";
import { loadBytes } from "./assets";
import type { AudioEngine } from "./audio";

export interface Cue {
  t: number;
  text: string;
}
/** A scene cue: a named moment in a track's timeline (the temple tour's 26 stations). */
export interface SceneCue {
  t: number;
  label: string;
}
export interface Track {
  id: string;
  title: string;
  voice: "female" | "male";
  file: string;
  duration: number;
  trigger: string;
  cues: Cue[];
  scenes?: SceneCue[];
}

export const TRACKS: Record<string, Track> = Object.fromEntries(
  (catalogue.tracks as Track[]).map((t) => [t.id, t]),
);

/** The monuments' rooms name their recordings by path ("audio/densities/density_1.mp3"), not
    by catalogue id: such a track plays as it is, with no cues (there are no subtitles anyway). */
function trackFor(id: string): Track | undefined {
  if (TRACKS[id] || !/^audio\/.+\.mp3$/.test(id)) return TRACKS[id];
  return (TRACKS[id] = { id, title: "", voice: "female", file: id, duration: 0, trigger: "", cues: [] });
}

/**
 * Samuel prefers the female voice. Tracks recorded in the male voice play from their re-voiced
 * copy in audio/female/ (made with narration/revoice-female.sh); until that copy exists, they
 * are shown as subtitles only.
 */
export const FEMALE_ONLY = true;
function fileFor(t: Track): string {
  return FEMALE_ONLY && t.voice === "male" ? t.file.replace("audio/", "audio/female/") : t.file;
}

export class Narration {
  subtitlesOn = false;
  current: string | null = null;
  onEnd: ((id: string) => void) | null = null;
  /** The session is paused (item 13): the voice holds its place, the clock stands still, and
      everything that reads this clock — a lesson's animation, a tour's advance — freezes with
      it. True even when no track is speaking (a tour of the silent night may pause). */
  paused = false;
  private pauseAt = 0;
  private pauseEnd: number = Infinity;
  private raw = new Map<string, Promise<ArrayBuffer | null>>();
  private decoded = new Map<string, Promise<AudioBuffer | null>>();
  /** Tracks whose fetch/decode was asked for and has not arrived yet. */
  private pending = new Set<string>();
  private playing: { id: string; src: AudioBufferSourceNode; gain: GainNode; start: number; scale: number; from: number; end: number } | null = null;
  private cueIndex = -1;
  /** Bumped by every play and stop: a track still loading when another is asked for never starts. */
  private token = 0;

  constructor(
    private audio: AudioEngine,
    private sub: HTMLElement,
  ) {}

  /** Start downloading tracks ahead of need (they are small). The compressed bytes are kept
      only for the few most recent tracks (owner item 10 P5): a long session once kept every
      track ever played — 100–300 MB of MP3 that would never be read again. */
  private rawCap = 8;
  preload(ids: string[]): void {
    for (const id of ids) {
      const t = trackFor(id);
      if (this.raw.has(id) || !t) continue;
      const p = loadBytes(fileFor(t));
      this.raw.delete(id);
      this.raw.set(id, p);
      while (this.raw.size > this.rawCap) this.raw.delete(this.raw.keys().next().value!);
    }
  }

  private buffer(id: string): Promise<AudioBuffer | null> {
    const ctx = this.audio.ctx;
    if (!ctx) return Promise.resolve(null);
    let p = this.decoded.get(id);
    // decoded audio is large (about 10 MB a minute): keep only the few most recent, or Safari
    // may run out of memory and reload the page
    if (p) {
      this.decoded.delete(id);
      this.decoded.set(id, p);
    }
    while (this.decoded.size > 4) this.decoded.delete(this.decoded.keys().next().value!);
    if (!p) {
      this.pending.add(id);
      this.preload([id]);
      p = this.raw.get(id)!.then(async (data) => {
        if (!data) return null;
        try {
          return await ctx.decodeAudioData(data.slice(0));
        } catch {
          return null;
        }
      });
      p.then(
        () => this.pending.delete(id),
        () => this.pending.delete(id),
      );
      this.decoded.set(id, p);
    }
    return p;
  }

  /** Whether a play() asked for `id` and its audio is still arriving (fetch or decode).
      Callers that must not move on before a voice speaks wait on this. */
  busy(id: string): boolean {
    return this.pending.has(id);
  }

  /** Whether a track's audio exists — answered without decoding it: an inline-asset check,
      else a HEAD request. (The old probe fetched and fully decoded a candidate track just to
      learn it was there — seconds of work and tens of MB to pick the next song.) A file that
      exists but decodes to nothing still reads as available here; that was true before, too,
      and the player falls back to subtitles when a buffer comes back empty. */
  async available(id: string): Promise<boolean> {
    const t = trackFor(id);
    if (!t) return false;
    if (this.decoded.get(id)) return true;
    const file = fileFor(t);
    if ((window as { __IJ_ASSETS?: Record<string, string> }).__IJ_ASSETS?.[file]) return true;
    try {
      return (await fetch(`./${file}`, { method: "HEAD" })).ok;
    } catch {
      return false;
    }
  }

  /** Debug still-frame hook (?shot): when set, time() reads this instead of the audio clock. */
  debugTime: number | null = null;

  /** Seconds into the current track, on the audio clock (0 when nothing plays). While paused
      it stands exactly where the pause took it, so nothing that reads the clock drifts. */
  time(): number {
    if (this.paused) return this.pauseAt;
    if (this.debugTime !== null) return this.debugTime;
    const p = this.playing;
    const ctx = this.audio.ctx;
    if (!p || !ctx) return 0;
    return p.from + Math.max(0, (ctx.currentTime - p.start) / p.scale);
  }

  /** Pause: the voice steps aside quickly, its place and its part are kept, and the clock
      freezes. Resume replays the same part from the very second it held. */
  pause(): void {
    if (this.paused) return;
    this.pauseAt = this.time(); // the place is taken before the clock stands still
    this.paused = true;
    const p = this.playing;
    if (p) this.pauseEnd = p.end;
    const ctx = this.audio.ctx;
    if (p && ctx) {
      const t = ctx.currentTime;
      p.gain.gain.cancelScheduledValues(t);
      p.gain.gain.setValueAtTime(p.gain.gain.value, t);
      p.gain.gain.linearRampToValueAtTime(0, t + 0.12);
      p.src.stop(t + 0.17);
    }
    this.playing = null;
    window.clearTimeout(this.fakeTimer);
  }

  /** Resume: pick up exactly where the pause took the voice. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const id = this.current, from = this.pauseAt, end = this.pauseEnd;
    if (id) void this.play(id, from, end);
  }

  /** Go back a little and keep playing (or keep holding, if paused) — never before the part
      the session asked for. */
  back(seconds: number): void {
    if (!this.current) return;
    if (this.paused) {
      this.pauseAt = Math.max(this.partFrom, this.pauseAt - seconds);
      return;
    }
    const at = Math.max(this.partFrom, this.time() - seconds);
    void this.play(this.current, at, this.playing?.end ?? Infinity);
  }

  private partFrom = 0;
  /** How far the voice speaking has come through what it was asked to say (a part of a track
      counts from its own start), in seconds; null while none speaks. */
  progress(): { t: number; total: number } | null {
    const p = this.playing;
    if (!p) return null;
    const total = Math.max(0.1, p.end - this.partFrom);
    return { t: Math.min(total, Math.max(0, this.time() - this.partFrom)), total };
  }

  /** Play a track, or only its part from `from` to `to` seconds (track time), fading at the end. */
  async play(id: string, from = 0, to = Infinity): Promise<void> {
    const track = trackFor(id);
    if (!track) return;
    this.paused = false; // a fresh play supersedes any pause
    // Debug still-frame hook: no audio at all — the scene still sees the track as current.
    if (this.debugTime !== null) {
      this.current = id;
      return;
    }
    // one voice at a time: the one speaking steps aside quickly, and the new one waits for it
    const handoff = this.playing ? 0.5 : 0;
    this.stop(0.5);
    const token = this.token;
    this.current = id;
    const buf = await this.buffer(id);
    const ctx = this.audio.ctx;
    if (token !== this.token || this.current !== id || !ctx) return;
    if (!buf) {
      // No audio: the words still arrive, as subtitles paced like speech.
      this.fakePlay(track, from);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // A re-voiced recording has its own pace: stretch the cue times to fit it.
    const scale = buf.duration / (track.duration || buf.duration);
    const gain = ctx.createGain();
    const at = ctx.currentTime + handoff;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + 0.4);
    src.connect(gain).connect(this.audio.voice);
    const off = Math.max(0, Math.min(buf.duration - 0.05, from * scale));
    const dur = Number.isFinite(to) ? Math.max(0.5, (to - from) * scale) : undefined;
    if (dur !== undefined) {
      gain.gain.setValueAtTime(1, at + Math.max(0.4, dur - 0.5));
      gain.gain.linearRampToValueAtTime(0, at + dur);
      src.start(at, off, dur);
    } else src.start(at, off);
    this.playing = { id, src, gain, start: at, scale, from: off / scale, end: Number.isFinite(to) ? to : buf.duration / scale };
    this.partFrom = from;
    this.cueIndex = -1;
    this.audio.duck(true);
    src.onended = () => {
      if (this.playing?.src !== src) return;
      this.playing = null;
      this.finish(id);
    };
  }

  /** Fade the current track out (e.g. the wanderer walked away). */
  stop(fadeSecs = 2): void {
    const p = this.playing;
    const ctx = this.audio.ctx;
    this.playing = null;
    this.paused = false;
    this.token++;
    if (p && ctx) {
      const t = ctx.currentTime;
      p.gain.gain.cancelScheduledValues(t);
      p.gain.gain.setValueAtTime(p.gain.gain.value, t);
      p.gain.gain.linearRampToValueAtTime(0, t + fadeSecs);
      p.src.stop(t + fadeSecs + 0.05);
    }
    if (this.current) {
      this.current = null;
      if (this.debugTime === null) this.audio.duck(false);
      this.hideSub();
    }
    window.clearTimeout(this.fakeTimer);
  }

  private finish(id: string): void {
    if (this.current !== id) return;
    this.current = null;
    this.audio.duck(false);
    window.setTimeout(() => this.current === null && this.hideSub(), 1500);
    this.onEnd?.(id);
  }

  private fakeTimer = 0;
  private fakePlay(track: Track, fromT = 0): void {
    let i = track.cues.findIndex((c) => c.t >= fromT);
    if (fromT > 0 && i < 0) i = track.cues.length;
    if (i < 0) i = 0;
    const next = () => {
      if (this.current !== track.id || this.paused) return;
      if (i >= track.cues.length) return this.finish(track.id);
      this.showSub(track.cues[i].text);
      const nextT = i + 1 < track.cues.length ? track.cues[i + 1].t : track.duration;
      const wait = (nextT - track.cues[i].t) * 1000;
      i++;
      this.fakeTimer = window.setTimeout(next, wait);
    };
    next();
  }

  /** Call every frame: advances subtitles in step with the audio clock. */
  update(): void {
    const p = this.playing;
    const ctx = this.audio.ctx;
    if (!p || !ctx) return;
    const t = p.from + (ctx.currentTime - p.start) / p.scale;
    const cues = TRACKS[p.id].cues;
    let k = -1;
    for (let i = 0; i < cues.length; i++) if (cues[i].t <= t + 0.05) k = i;
    if (k !== this.cueIndex && k >= 0) {
      this.cueIndex = k;
      this.showSub(cues[k].text);
    }
  }

  private showSub(text: string): void {
    if (!this.subtitlesOn) return;
    this.sub.textContent = text;
    this.sub.classList.add("on");
  }
  hideSub(): void {
    this.sub.classList.remove("on");
  }
}

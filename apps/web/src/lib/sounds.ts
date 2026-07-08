/**
 * sounds.ts — Professional UI sound engine for TERA
 *
 * All sounds are synthesised via Web Audio API (no external files).
 * AudioContext is unlocked on first user gesture (click/keydown/touch).
 *
 * Usage:
 *   import { playSound } from "@/lib/sounds";
 *   playSound("reaction");   // when reacting to a post
 *   playSound("comment");    // when submitting a comment
 *   playSound("send");       // when sending a message
 *   playSound("notification"); // incoming notification
 *   playSound("pop");        // generic micro-feedback
 *   playSound("remove");     // un-react / delete
 */

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return _ctx;
}

// Unlock on any user gesture
if (typeof window !== "undefined") {
  const unlock = async () => {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") await ctx.resume();
  };
  window.addEventListener("click",      unlock, { passive: true });
  window.addEventListener("keydown",    unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

function gainEnvelope(
  gain: GainNode,
  t: number,
  attackVol: number,
  attackTime: number,
  decayTime: number,
) {
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(attackVol, t + attackTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attackTime + decayTime);
}

function tone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  startT: number,
  stopT: number,
  vol: number,
  attack = 0.008,
  decay?: number,
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gainEnvelope(gain, startT, vol, attack, decay ?? (stopT - startT - attack));
  osc.start(startT);
  osc.stop(stopT);
}

// ─── Sound definitions ────────────────────────────────────────────────────────

type SoundName = "reaction" | "comment" | "send" | "notification" | "pop" | "remove" | "save" | "error";

const SOUNDS: Record<SoundName, (ctx: AudioContext, t: number) => void> = {

  /** Heart-pop feel — two harmonic tones that rise */
  reaction(ctx, t) {
    tone(ctx, 440,  "sine",     t,        t + 0.15, 0.14, 0.005, 0.14);
    tone(ctx, 660,  "sine",     t + 0.07, t + 0.25, 0.10, 0.005, 0.18);
    tone(ctx, 880,  "triangle", t + 0.14, t + 0.35, 0.06, 0.005, 0.18);
  },

  /** Soft ascending chime — like typing Enter */
  comment(ctx, t) {
    tone(ctx, 392, "sine", t,        t + 0.12, 0.12, 0.006, 0.11);
    tone(ctx, 523, "sine", t + 0.08, t + 0.22, 0.10, 0.006, 0.13);
    tone(ctx, 659, "sine", t + 0.16, t + 0.32, 0.08, 0.006, 0.15);
  },

  /** Whoosh-up — message sent */
  send(ctx, t) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(1047, t + 0.18);
    gainEnvelope(gain, t, 0.16, 0.01, 0.18);
    osc.start(t);
    osc.stop(t + 0.22);
  },

  /** Double-ding notification chime */
  notification(ctx, t) {
    tone(ctx, 587, "sine", t,        t + 0.18, 0.18, 0.008, 0.16);
    tone(ctx, 880, "sine", t + 0.12, t + 0.40, 0.14, 0.008, 0.26);
  },

  /** Micro pop — generic lightweight feedback */
  pop(ctx, t) {
    tone(ctx, 700, "sine", t, t + 0.09, 0.12, 0.004, 0.08);
  },

  /** Soft descending — un-react */
  remove(ctx, t) {
    tone(ctx, 500, "sine", t,        t + 0.12, 0.10, 0.005, 0.11);
    tone(ctx, 350, "sine", t + 0.08, t + 0.22, 0.07, 0.005, 0.12);
  },

  /** Soft bookmark chime */
  save(ctx, t) {
    tone(ctx, 523, "sine",     t,        t + 0.14, 0.12, 0.006, 0.12);
    tone(ctx, 784, "triangle", t + 0.10, t + 0.28, 0.08, 0.006, 0.16);
  },

  /** Error buzz */
  error(ctx, t) {
    tone(ctx, 180, "sawtooth", t, t + 0.15, 0.12, 0.005, 0.13);
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export async function playSound(name: SoundName): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return;
    SOUNDS[name]?.(ctx, ctx.currentTime);
  } catch (err) {
    // Silently ignore autoplay blocks
    if (process.env.NODE_ENV === "development") {
      console.warn("[TERA sounds] blocked:", err);
    }
  }
}

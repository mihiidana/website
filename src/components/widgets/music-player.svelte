<script lang="ts">
import { Music2, Pause, Play, Volume2, VolumeX } from "@lucide/svelte";
import { on } from "svelte/events";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import type { SiteTrack } from "@/lib/site";
import { cn } from "@/lib/utils";

interface Props {
  class?: string;
  track: SiteTrack;
  /** Pre-optimized artwork URL (build-time processed); falls back to track.artwork. */
  artwork?: string;
}

let { class: className, track, artwork }: Props = $props();

let cardEl: HTMLElement | null = $state(null);
let audioEl: HTMLAudioElement | null = $state(null);
let playing = $state(false);
let volume = $state(0.5);
let muted = $state(false);

function toggle() {
  const audio = audioEl;
  if (!audio) return;

  if (audio.paused) {
    audio.play().catch(() => (playing = false));
  } else {
    audio.pause();
  }
}

function changeVolume(value: number | number[]) {
  const level = typeof value === "number" ? value : value[0];
  volume = level;
  muted = level === 0;
}

function toggleMute() {
  if (!muted) {
    muted = true;
    return;
  }

  // Unmuting from a zero-volume slider restores a sensible level.
  if (volume === 0) volume = 0.5;
  muted = false;
}

/**
 * Volume change per wheel pixel. A mouse notch (deltaY ~100) moves the level
 * by 0.05, and the per-event clamp keeps a page-mode delta from jumping the
 * whole range at once.
 */
const VOLUME_PER_WHEEL_PIXEL = 0.0005;
const MAX_WHEEL_VOLUME_STEP = 0.1;

$effect(() => {
  const audio = audioEl;
  if (!audio) return;

  audio.volume = volume;
  audio.muted = muted;
});

// Wheel over the widget adjusts volume and must not scroll the page with it,
// so the listener is registered non-passive and the default scroll is
// cancelled synchronously. It is scoped to the player element and removed by
// the cleanup `on()` returns when the component is destroyed.
$effect(() => {
  const card = cardEl;
  if (!card) return;

  // Firefox reports wheel deltas in lines, Safari in pages.
  const pixels = (event: WheelEvent) => {
    if (event.deltaMode === 1) return event.deltaY * 33;
    if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
    return event.deltaY;
  };

  return on(
    card,
    "wheel",
    (event) => {
      // Leave pinch-zoom and modified gestures to the browser.
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      // Horizontal trackpad gestures are not this widget's business.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const dy = pixels(event);
      if (dy === 0) return;

      // The widget owns the vertical gesture wherever it is handled, so the
      // document must not scroll underneath it.
      if (event.cancelable) event.preventDefault();

      // Already silent: scrolling further down changes nothing, and scrolling
      // up is the gesture that brings the sound back.
      if (muted && dy > 0) return;

      const step = Math.max(
        -MAX_WHEEL_VOLUME_STEP,
        Math.min(MAX_WHEEL_VOLUME_STEP, dy * VOLUME_PER_WHEEL_PIXEL),
      );
      const next = Math.min(1, Math.max(0, volume - step));

      volume = next;
      // Silence at the floor, and scrolling up is an intentional unmute.
      if (next === 0) muted = true;
      else if (dy < 0) muted = false;
    },
    { passive: false },
  );
});
</script>

<Card
  bind:ref={cardEl}
  data-music-player
  data-playing={playing}
  class={cn("player h-full flex-row gap-0 p-0", className)}
>
  <!-- Square artwork panel, full-bleed to the left edge. -->
  <div class="relative aspect-square h-full shrink-0 overflow-hidden">
    <img
      src={artwork ?? track.artwork}
      alt=""
      width={320}
      height={320}
      loading="lazy"
      class="absolute inset-0 size-full object-cover"
    >
    <div
      aria-hidden="true"
      class={cn(
        "eq absolute right-2.5 bottom-2.5 flex items-end gap-1 rounded bg-background/70 px-1.5 py-1 backdrop-blur-sm",
      )}
    >
      <span class="bar w-0.5 rounded-full bg-foreground"></span>
      <span class="bar w-0.5 rounded-full bg-foreground"></span>
      <span class="bar w-0.5 rounded-full bg-foreground"></span>
      <span class="bar w-0.5 rounded-full bg-foreground"></span>
    </div>
  </div>

  <div class="flex min-w-0 flex-1 flex-col justify-between p-4">
    <div class="flex items-center justify-between gap-2">
      <span
        class="min-w-0 truncate text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {track.label}
      </span>
      <!-- biome-ignore lint/a11y/useAnchorContent: the link is named by aria-label. -->
      <a
        href={track.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Listen to ${track.title} by ${track.artist}`}
        class="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Music2 class="size-4" aria-hidden="true" />
      </a>
    </div>

    <div class="min-w-0">
      <!-- A widget label, not a document section: keeping it out of the
           heading outline leaves the page hierarchy to the page. -->
      <p class="truncate font-medium text-foreground">{track.title}</p>
      <p class="truncate text-sm text-muted-foreground">{track.artist}</p>
      <p class="truncate text-xs text-muted-foreground">{track.album}</p>
    </div>

    <div class="flex items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        onclick={toggle}
        class="rounded-full transition-transform active:scale-95"
      >
        {#if playing}
          <Pause class="fill-current" aria-hidden="true" />
        {:else}
          <Play class="translate-x-px fill-current" aria-hidden="true" />
        {/if}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={muted ? `Unmute ${track.title}` : `Mute ${track.title}`}
        aria-pressed={muted}
        onclick={toggleMute}
        class="rounded-full text-muted-foreground"
      >
        {#if muted}
          <VolumeX aria-hidden="true" />
        {:else}
          <Volume2 aria-hidden="true" />
        {/if}
      </Button>
      <Slider
        type="single"
        value={volume}
        onValueChange={changeVolume}
        min={0}
        max={1}
        step={0.01}
        aria-label={`Volume for ${track.title}`}
        class="min-w-0 flex-1"
      />
    </div>
  </div>

  <!-- biome-ignore lint/a11y/useMediaCaption: music track, captions do not apply. -->
  <audio
    bind:this={audioEl}
    src={track.audio}
    preload="none"
    loop
    onplay={() => (playing = true)}
    onpause={() => (playing = false)}
    onended={() => (playing = false)}
  ></audio>
</Card>

<style>
@keyframes eq-bar {
  0%,
  100% {
    height: 3px;
  }
  50% {
    height: 13px;
  }
}

.bar {
  height: 3px;
  animation: eq-bar 0.9s ease-in-out infinite;
  animation-play-state: paused;
}

.bar:nth-child(2) {
  animation-delay: 0.15s;
  animation-duration: 0.7s;
}

.bar:nth-child(3) {
  animation-delay: 0.3s;
  animation-duration: 0.8s;
}

.bar:nth-child(4) {
  animation-delay: 0.1s;
  animation-duration: 1s;
}

.eq {
  opacity: 0;
  transition: opacity 0.3s ease-out;
}

:global(.player[data-playing="true"]) .eq {
  opacity: 1;
}

:global(.player[data-playing="true"]) .bar {
  animation-play-state: running;
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    height: 6px;
    animation: none;
  }

  .eq {
    transition: none;
  }
}
</style>

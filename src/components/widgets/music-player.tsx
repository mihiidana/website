import { Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import styles from "@/components/widgets/music-player.module.css";
import type { SiteTrack } from "@/lib/site";
import { cn } from "@/lib/utils";

interface MusicPlayerProps {
  class?: string;
  track: SiteTrack;
  /** Pre-optimized artwork URL (build-time processed); falls back to track.artwork. */
  artwork?: string;
}

export default function MusicPlayer({ class: className, track, artwork }: MusicPlayerProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  const changeVolume = ([value]: number[]) => {
    setVolume(value);
    setMuted(value === 0);
  };

  const toggleMute = () => {
    setMuted((wasMuted) => {
      if (!wasMuted) return true;
      // Unmuting from a zero-volume slider restores a sensible level.
      if (volume === 0) setVolume(0.5);
      return false;
    });
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // Wheel over the widget adjusts volume. Needs a manual non-passive
  // listener because React registers wheel events as passive.
  const levelRef = useRef(volume);
  useEffect(() => {
    levelRef.current = volume;
  }, [volume]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Firefox reports wheel deltas in lines, Safari in pages.
    const pixels = (event: WheelEvent) => {
      if (event.deltaMode === 1) return event.deltaY * 33;
      if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
      return event.deltaY;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // pinch-zoom gesture
      const dy = pixels(event);
      if (muted && dy >= 0) return; // already silent, keep the level

      const next = Math.min(1, Math.max(0, levelRef.current - dy * 0.0005));
      levelRef.current = next;
      setVolume(next);
      setMuted(next === 0);
    };

    card.addEventListener("wheel", onWheel, { passive: false });
    return () => card.removeEventListener("wheel", onWheel);
  }, [muted]);

  return (
    <Card
      ref={cardRef}
      data-music-player
      data-playing={playing}
      className={cn(styles.player, "h-full flex-row gap-0 p-0", className)}
    >
      {/* Square artwork panel, full-bleed to the left edge. */}
      <div className="relative aspect-square h-full shrink-0 overflow-hidden">
        <img
          src={artwork ?? track.artwork}
          alt=""
          width={320}
          height={320}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <div
          aria-hidden="true"
          className={cn(
            styles.eq,
            "absolute right-2.5 bottom-2.5 flex items-end gap-1 rounded bg-background/70 px-1.5 py-1 backdrop-blur-sm",
          )}
        >
          <span className={cn(styles.bar, "w-0.5 rounded-full bg-foreground")} />
          <span className={cn(styles.bar, "w-0.5 rounded-full bg-foreground")} />
          <span className={cn(styles.bar, "w-0.5 rounded-full bg-foreground")} />
          <span className={cn(styles.bar, "w-0.5 rounded-full bg-foreground")} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {track.label}
          </span>
          <a
            href={track.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Listen to ${track.title} by ${track.artist}`}
            className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Music2 className="size-4" aria-hidden="true" />
          </a>
        </div>

        <div className="min-w-0">
          <h2 className="truncate font-medium text-foreground">{track.title}</h2>
          <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
          <p className="truncate text-xs text-muted-foreground">{track.album}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="icon-lg"
            aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
            onClick={toggle}
            className="rounded-full transition-transform active:scale-95"
          >
            {playing ? (
              <Pause className="fill-current" aria-hidden="true" />
            ) : (
              <Play className="translate-x-px fill-current" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={muted ? `Unmute ${track.title}` : `Mute ${track.title}`}
            aria-pressed={muted}
            onClick={toggleMute}
            className="rounded-full text-muted-foreground"
          >
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </Button>
          <Slider
            value={[volume]}
            onValueChange={changeVolume}
            min={0}
            max={1}
            step={0.01}
            aria-label={`Volume for ${track.title}`}
            className="min-w-0 flex-1"
          />
        </div>
      </div>

      {/* biome-ignore lint/a11y/useMediaCaption: music track, captions do not apply. */}
      <audio
        ref={audioRef}
        src={track.audio}
        preload="none"
        loop
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </Card>
  );
}

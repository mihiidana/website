import { Music2, Pause, Play } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import styles from "@/components/widgets/music-player.module.css";
import type { SiteTrack } from "@/lib/site";
import { cn } from "@/lib/utils";

interface MusicPlayerProps {
  class?: string;
  track: SiteTrack;
}

export default function MusicPlayer({ class: className, track }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  return (
    <Card
      data-music-player
      data-playing={playing}
      className={cn(
        styles.player,
        "@container relative h-full justify-between gap-3 p-4",
        className,
      )}
    >
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

      <div className="flex items-center gap-3.5 py-1">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-foreground/10 @max-[10rem]:size-12">
          <img
            src={track.artwork}
            alt=""
            width={64}
            height={64}
            loading="lazy"
            className="size-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute right-1 bottom-1 flex items-end gap-0.5 rounded bg-background/70 px-1 py-0.5 backdrop-blur-sm"
          >
            <span className={cn(styles.bar, "w-0.5 rounded-full bg-foreground")} />
            <span className={cn(styles.bar, "w-0.5 rounded-full bg-foreground")} />
            <span className={cn(styles.bar, "w-0.5 rounded-full bg-foreground")} />
            <span className={cn(styles.bar, "w-0.5 rounded-full bg-foreground")} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-foreground">{track.title}</h3>
          <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
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

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-pressed={playing}
          aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
          onClick={toggle}
          className="rounded-full transition-transform active:scale-95"
        >
          {playing ? (
            <Pause data-icon="inline-start" aria-hidden="true" />
          ) : (
            <Play data-icon="inline-start" aria-hidden="true" />
          )}
          <span>{playing ? "Pause" : "Play"}</span>
        </Button>
      </div>
    </Card>
  );
}

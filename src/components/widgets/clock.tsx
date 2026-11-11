import { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LOCATION = "Dhaka, Bangladesh";
const TIME_ZONE = "Asia/Dhaka";

interface ClockProps {
  class?: string;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function setAngle(element: HTMLElement | null, degrees: number) {
  if (element) {
    element.style.transform = `translateX(-50%) rotate(${degrees}deg)`;
  }
}

export default function Clock({ class: className }: ClockProps) {
  const [digital, setDigital] = useState(false);
  const clockRef = useRef<HTMLButtonElement>(null);
  const hourHandRef = useRef<HTMLSpanElement>(null);
  const minuteHandRef = useRef<HTMLSpanElement>(null);
  const secondHandRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const secondsRef = useRef<HTMLSpanElement>(null);
  const periodRef = useRef<HTMLSpanElement>(null);

  const offsetLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value ?? "",
    [],
  );

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      fractionalSecondDigits: 3,
    });

    const update = () => {
      let hour = 0;
      let minute = 0;
      let second = 0;
      let fraction = 0;

      for (const part of formatter.formatToParts(new Date())) {
        if (part.type === "hour") hour = Number(part.value);
        else if (part.type === "minute") minute = Number(part.value);
        else if (part.type === "second") second = Number(part.value);
        else if (part.type === "fractionalSecond") fraction = Number(part.value);
        else if (part.type === "dayPeriod" && periodRef.current) {
          periodRef.current.textContent = part.value.toUpperCase();
        }
      }

      const seconds = second + fraction / 1000;
      const minutes = minute + seconds / 60;
      const hours = (hour % 12) + minutes / 60;

      setAngle(hourHandRef.current, (hours / 12) * 360);
      setAngle(minuteHandRef.current, (minutes / 60) * 360);
      setAngle(secondHandRef.current, (seconds / 60) * 360);

      if (timeRef.current) timeRef.current.textContent = `${pad(hour)}:${pad(minute)}`;
      if (secondsRef.current) secondsRef.current.textContent = `:${pad(second)}`;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update();
      const interval = window.setInterval(update, 1000);
      return () => window.clearInterval(interval);
    }

    const clock = clockRef.current;
    if (!clock) return;

    let frame = 0;

    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !frame) {
          update();
          frame = window.requestAnimationFrame(function tick() {
            update();
            frame = window.requestAnimationFrame(tick);
          });
        } else if (!entry.isIntersecting) {
          stop();
        }
      },
      { threshold: 0 },
    );

    intersectionObserver.observe(clock);

    return () => {
      stop();
      intersectionObserver.disconnect();
    };
  }, []);

  return (
    <Card className={cn("@container justify-center p-2", className)}>
      <button
        ref={clockRef}
        type="button"
        onClick={() => setDigital((value) => !value)}
        aria-label={
          digital
            ? `Digital clock for ${LOCATION} — switch to analog`
            : `Analog clock for ${LOCATION} — switch to digital`
        }
        className="relative m-auto aspect-square max-h-full w-full cursor-pointer overflow-hidden rounded-lg border border-border bg-radial from-card to-background text-left select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 transition-all duration-300 motion-reduce:transition-none",
            digital ? "pointer-events-none scale-95 opacity-0" : "opacity-100",
          )}
        >
          <span className="absolute top-2 left-1/2 -translate-x-1/2 font-mono text-[clamp(6px,8cqi,11px)] font-semibold text-foreground">
            12
          </span>
          <span className="absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[clamp(6px,8cqi,11px)] font-semibold text-foreground">
            3
          </span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[clamp(6px,8cqi,11px)] font-semibold text-foreground">
            6
          </span>
          <span className="absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[clamp(6px,8cqi,11px)] font-semibold text-foreground">
            9
          </span>

          <span className="pointer-events-none absolute inset-2 rounded-full border border-dashed border-border opacity-50" />

          <span
            ref={hourHandRef}
            className="absolute bottom-1/2 left-1/2 h-[24%] w-1 origin-bottom rounded-full bg-foreground"
          />
          <span
            ref={minuteHandRef}
            className="absolute bottom-1/2 left-1/2 h-[34%] w-[3px] origin-bottom rounded-full bg-foreground"
          />
          <span
            ref={secondHandRef}
            className="absolute bottom-1/2 left-1/2 h-[40%] w-[1.5px] origin-bottom rounded-full bg-foreground/70"
          />

          <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground" />
        </span>

        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center px-2 transition-all duration-300 motion-reduce:transition-none",
            digital ? "opacity-100" : "pointer-events-none scale-95 opacity-0",
          )}
        >
          <span className="flex items-baseline font-mono tabular-nums whitespace-nowrap text-foreground">
            <span ref={timeRef} className="text-[clamp(0.7rem,16cqi,2.5rem)] tracking-tight">
              06:54
            </span>
            <span
              ref={secondsRef}
              className="ml-0.5 text-[clamp(0.55rem,7cqi,1.125rem)] text-muted-foreground @max-[5rem]:hidden"
            >
              :25
            </span>
            <span
              ref={periodRef}
              className="ml-1 text-[clamp(0.5rem,5.5cqi,1rem)] font-medium text-muted-foreground @max-[5rem]:hidden"
            >
              AM
            </span>
          </span>

          <span className="mt-2 flex flex-col items-center gap-0.5 text-center font-mono text-[9px] leading-tight tracking-wide text-muted-foreground uppercase @max-[5rem]:hidden">
            <span>{LOCATION}</span>
            <span>{offsetLabel}</span>
          </span>
        </span>
      </button>
    </Card>
  );
}

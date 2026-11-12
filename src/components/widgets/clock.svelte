<script lang="ts">
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  class?: string;
}

let { class: className }: Props = $props();

const LOCATION = "Dhaka, Bangladesh";
const TIME_ZONE = "Asia/Dhaka";

let digital = $state(false);
let clockEl: HTMLButtonElement | null = $state(null);
let hourHand: HTMLSpanElement | null = $state(null);
let minuteHand: HTMLSpanElement | null = $state(null);
let secondHand: HTMLSpanElement | null = $state(null);
let timeText: HTMLSpanElement | null = $state(null);
let secondsText: HTMLSpanElement | null = $state(null);
let periodText: HTMLSpanElement | null = $state(null);

const offsetLabel =
  new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "shortOffset" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value ?? "";

const toggleLabel = $derived(
  digital
    ? `Digital clock for ${LOCATION} — switch to analog`
    : `Analog clock for ${LOCATION} — switch to digital`,
);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function setAngle(element: HTMLElement | null, degrees: number) {
  if (element) {
    element.style.transform = `translateX(-50%) rotate(${degrees}deg)`;
  }
}

$effect(() => {
  const clock = clockEl;
  if (!clock) return;

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
      else if (part.type === "dayPeriod" && periodText) {
        periodText.textContent = part.value.toUpperCase();
      }
    }

    const seconds = second + fraction / 1000;
    const minutes = minute + seconds / 60;
    const hours = (hour % 12) + minutes / 60;

    setAngle(hourHand, (hours / 12) * 360);
    setAngle(minuteHand, (minutes / 60) * 360);
    setAngle(secondHand, (seconds / 60) * 360);

    if (timeText) timeText.textContent = `${pad(hour)}:${pad(minute)}`;
    if (secondsText) secondsText.textContent = `:${pad(second)}`;
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }

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
});
</script>

<Card class={cn("@container justify-center p-2", className)}>
  <!-- The face is a decorative readout hidden from AT. Keeping its visible text
       outside the toggle button lets the button carry a stable, meaningful
       accessible name (WCAG 2.5.3 label in name). -->
  <div class="relative m-auto aspect-square max-h-full w-full select-none">
    <div
      aria-hidden="true"
      class="absolute inset-0 overflow-hidden rounded-lg border border-border bg-radial from-card to-background text-left"
    >
      <span
        class={cn(
          "absolute inset-0 transition-all duration-300 motion-reduce:transition-none",
          digital ? "pointer-events-none scale-95 opacity-0" : "opacity-100",
        )}
      >
        <span
          class="absolute top-2 left-1/2 -translate-x-1/2 font-mono text-[clamp(6px,8cqi,11px)] font-semibold text-foreground"
        >
          12
        </span>
        <span
          class="absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[clamp(6px,8cqi,11px)] font-semibold text-foreground"
        >
          3
        </span>
        <span
          class="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[clamp(6px,8cqi,11px)] font-semibold text-foreground"
        >
          6
        </span>
        <span
          class="absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[clamp(6px,8cqi,11px)] font-semibold text-foreground"
        >
          9
        </span>

        <span
          class="pointer-events-none absolute inset-2 rounded-full border border-dashed border-border opacity-50"
        ></span>

        <span
          bind:this={hourHand}
          class="absolute bottom-1/2 left-1/2 h-[24%] w-1 origin-bottom rounded-full bg-foreground"
        ></span>
        <span
          bind:this={minuteHand}
          class="absolute bottom-1/2 left-1/2 h-[34%] w-[3px] origin-bottom rounded-full bg-foreground"
        ></span>
        <span
          bind:this={secondHand}
          class="absolute bottom-1/2 left-1/2 h-[40%] w-[1.5px] origin-bottom rounded-full bg-foreground/70"
        ></span>

        <span
          class="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
        ></span>
      </span>

      <span
        class={cn(
          "absolute inset-0 flex flex-col items-center justify-center px-2 transition-all duration-300 motion-reduce:transition-none",
          digital ? "opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <span class="flex items-baseline font-mono tabular-nums whitespace-nowrap text-foreground">
          <span bind:this={timeText} class="text-[clamp(0.7rem,16cqi,2.5rem)] tracking-tight">
            06:54
          </span>
          <span
            bind:this={secondsText}
            class="ml-0.5 text-[clamp(0.55rem,7cqi,1.125rem)] text-muted-foreground @max-[5rem]:hidden"
          >
            :25
          </span>
          <span
            bind:this={periodText}
            class="ml-1 text-[clamp(0.5rem,5.5cqi,1rem)] font-medium text-muted-foreground @max-[5rem]:hidden"
          >
            AM
          </span>
        </span>

        <span
          class="mt-2 flex flex-col items-center gap-0.5 text-center font-mono text-[9px] leading-tight tracking-wide text-muted-foreground uppercase @max-[5rem]:hidden"
        >
          <span>{LOCATION}</span>
          <span>{offsetLabel}</span>
        </span>
      </span>
    </div>

    <button
      bind:this={clockEl}
      type="button"
      onclick={() => (digital = !digital)}
      aria-label={toggleLabel}
      class="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    ></button>
  </div>
</Card>

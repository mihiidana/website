<script lang="ts">
/**
 * Debounce playground for the debouncing article.
 *
 * Hydrated with `client:visible`; the server-rendered markup is the full
 * controls and labels, so the demo reads correctly before (and without) JS.
 * The only timers here are the debounce timers, and each effect run returns a
 * cleanup so a keystroke always cancels the pending commit.
 */
import { Card } from "@/components/ui/card";

const MIN_DELAY = 0;
const MAX_DELAY = 1000;
const STEP = 50;

let query = $state("");
let delay = $state(300);
let settled = $state("");
let commits = $state(0);
let cancelled = $state(0);

// Plain (non-reactive) bookkeeping: the last value that actually committed.
// Reading it inside the effect must not re-trigger the effect.
let committed = "";

$effect(() => {
  const value = query;
  const wait = delay;
  if (value === committed) return;

  let fired = false;
  const id = setTimeout(() => {
    fired = true;
    committed = value;
    settled = value;
    commits += 1;
  }, wait);

  return () => {
    clearTimeout(id);
    if (!fired) cancelled += 1;
  };
});

const pending = $derived(query !== settled);
</script>

<Card class="my-8 gap-0 p-0">
  <div class="flex flex-col gap-4 p-4 sm:p-5">
    <div class="flex flex-col gap-2">
      <label for="debounce-query" class="text-sm font-medium">Search text</label>
      <input
        id="debounce-query"
        type="text"
        bind:value={query}
        placeholder="Type something…"
        autocomplete="off"
        class="w-full border bg-background px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between gap-4">
        <label for="debounce-delay" class="text-sm font-medium">Debounce delay</label>
        <output for="debounce-delay" class="font-mono text-xs text-muted-foreground">
          {delay}
          ms
        </output>
      </div>
      <input
        id="debounce-delay"
        type="range"
        bind:value={delay}
        min={MIN_DELAY}
        max={MAX_DELAY}
        step={STEP}
        class="w-full accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
    </div>

    <dl class="grid grid-cols-1 gap-3 border-t pt-4 font-mono text-xs sm:grid-cols-2">
      <div class="flex flex-col gap-1">
        <dt class="text-muted-foreground">Immediate (every keystroke)</dt>
        <dd class="break-all text-sm">{query || "—"}</dd>
      </div>
      <div class="flex flex-col gap-1">
        <dt class="text-muted-foreground">Debounced ({delay} ms after you stop)</dt>
        <dd class="break-all text-sm" aria-live="polite">{settled || "—"}</dd>
      </div>
    </dl>

    <p
      class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 font-mono text-xs text-muted-foreground"
    >
      <span>{commits} committed</span>
      <span aria-hidden="true">·</span>
      <span>{cancelled} cancelled</span>
      <span aria-hidden="true">·</span>
      <span>{pending ? "waiting…" : "up to date"}</span>
    </p>
  </div>
</Card>

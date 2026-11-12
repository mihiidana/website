<script lang="ts">
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  class?: string;
}

let { class: className }: Props = $props();

// A 5×7 lowercase "m", scaled 2× and centered in a 16×16 matrix.
const GLYPH = ["10101", "11111", "10101", "10101", "10101", "10101", "10101"];
const GLYPH_SCALE = 2;
const GRID = 16;
const GLYPH_WIDTH = GLYPH[0].length * GLYPH_SCALE;
const GLYPH_HEIGHT = GLYPH.length * GLYPH_SCALE;
const OFFSET_X = Math.floor((GRID - GLYPH_WIDTH) / 2);
const OFFSET_Y = Math.floor((GRID - GLYPH_HEIGHT) / 2);
const LABEL = "Dot matrix monogram";

let canvasEl: HTMLCanvasElement | null = $state(null);

function isLit(row: number, col: number) {
  const x = col - OFFSET_X;
  const y = row - OFFSET_Y;
  if (x < 0 || y < 0 || x >= GLYPH_WIDTH || y >= GLYPH_HEIGHT) return false;
  return GLYPH[Math.floor(y / GLYPH_SCALE)][Math.floor(x / GLYPH_SCALE)] === "1";
}

$effect(() => {
  const canvas = canvasEl;
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let color = getComputedStyle(canvas).color;
  let hoverX = -1;
  let hoverY = -1;
  let frame = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(rect.width, 1);
    height = Math.max(rect.height, 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const render = (time: number) => {
    const cell = width / GRID;
    const radius = cell * 0.38;

    context.clearRect(0, 0, width, height);

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const hovered = Math.hypot(col - hoverX, row - hoverY) < 2.5;

        if (!isLit(row, col) && !hovered) {
          context.globalAlpha = 0.14;
          context.fillStyle = color;
          context.shadowBlur = 0;
        } else {
          const pulse = motion ? Math.sin(time * 0.003 + (row + col) * 0.2) * 0.15 + 0.85 : 1;
          context.globalAlpha = hovered ? 1 : 0.9 * pulse;
          context.fillStyle = color;
          context.shadowColor = color;
          context.shadowBlur = hovered ? 10 : 4;
        }

        context.beginPath();
        context.arc(col * cell + cell / 2, row * cell + cell / 2, radius, 0, Math.PI * 2);
        context.fill();
      }
    }

    context.globalAlpha = 1;
    context.shadowBlur = 0;
  };

  const loop = (time: number) => {
    render(time);
    frame = window.requestAnimationFrame(loop);
  };

  const play = () => {
    if (frame) return;
    if (motion) {
      frame = window.requestAnimationFrame(loop);
    } else {
      render(0);
    }
  };

  const stop = () => {
    window.cancelAnimationFrame(frame);
    frame = 0;
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    hoverX = Math.floor(((event.clientX - rect.left) / rect.width) * GRID);
    hoverY = Math.floor(((event.clientY - rect.top) / rect.height) * GRID);
    if (!frame) render(0);
  };

  const onPointerLeave = () => {
    hoverX = -1;
    hoverY = -1;
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (!frame) render(0);
  });

  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) play();
      else stop();
    },
    { threshold: 0 },
  );

  const themeObserver = new MutationObserver(() => {
    color = getComputedStyle(canvas).color;
    if (!frame) render(0);
  });

  resize();
  render(0);
  resizeObserver.observe(canvas);
  intersectionObserver.observe(canvas);
  themeObserver.observe(document.documentElement, {
    attributeFilter: ["class"],
    attributes: true,
  });

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return () => {
    stop();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    themeObserver.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
  };
});
</script>

<Card class={cn("p-2", className)}>
  <div role="img" aria-label={LABEL} class="m-auto aspect-square max-h-full w-full">
    <canvas
      bind:this={canvasEl}
      aria-hidden="true"
      class="size-full cursor-crosshair rounded-lg text-foreground"
    ></canvas>
  </div>
</Card>

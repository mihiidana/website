<script lang="ts">
import { Moon, Sun } from "@lucide/svelte";

import { Button } from "@/components/ui/button";
import { THEME_COLORS, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still changes for this page view.
  }
}

function toggleTheme(event: MouseEvent) {
  const nextTheme: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as ViewTransitionDocument;

  if (!doc.startViewTransition || reduceMotion) {
    applyTheme(nextTheme);
    return;
  }

  const button = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
  // Keyboard activation reports 0,0; start the reveal from the button instead.
  const x = event.detail === 0 ? button.left + button.width / 2 : event.clientX;
  const y = event.detail === 0 ? button.top + button.height / 2 : event.clientY;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = doc.startViewTransition(() => applyTheme(nextTheme));

  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});
}
</script>

<Button
  data-theme-toggle
  variant="ghost"
  size="icon"
  class="relative"
  aria-label="Toggle color theme"
  title="Toggle color theme"
  onclick={toggleTheme}
>
  <Sun
    aria-hidden="true"
    class="size-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0"
  />
  <Moon
    aria-hidden="true"
    class="absolute size-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100"
  />
</Button>

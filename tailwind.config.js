/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        elevated: "var(--color-elevated)",
        borderDark: "var(--color-border-dark)",
        borderSoft: "var(--color-border-soft)",
        gold: "var(--color-gold)",
        goldBright: "var(--color-gold-bright)",
        goldDim: "var(--color-gold-dim)",
        profit: "var(--color-profit)",
        profitDim: "var(--color-profit-dim)",
        loss: "var(--color-loss)",
        lossDim: "var(--color-loss-dim)",
        textMain: "var(--color-text-main)",
        mutedMain: "var(--color-text-muted)",
        mutedDim: "var(--color-text-dim)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", 'sans-serif'],
        body: ["'Inter'", 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'monospace'],
      },
    },
  },
  plugins: [],
}

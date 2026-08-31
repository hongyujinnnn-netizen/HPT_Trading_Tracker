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
        bg: "#0A0C0E",
        surface: "#131619",
        elevated: "#1B1F23",
        borderDark: "#262B30",
        borderSoft: "#1E2226",
        gold: "#C9A227",
        goldBright: "#E4C468",
        goldDim: "#8A7332",
        profit: "#3FA88C",
        profitDim: "#1F4A40",
        loss: "#C1502E",
        lossDim: "#4A2A1E",
        textMain: "#EDEAE3",
        mutedMain: "#8B8D91",
        mutedDim: "#5A5D61",
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

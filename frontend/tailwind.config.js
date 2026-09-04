/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        platform: {
          950: "#070B18",
          900: "#0D1226",
          800: "#141B36",
          700: "#22315296",
        },
        // "flap" is the legacy departure-board name for the primary accent —
        // kept as-is so every existing bg-flap-amber / text-flap-amber /
        // border-flap-amber usage across the app picks up the new
        // neon-cyan theme automatically. flapViolet is the new secondary
        // accent for the futuristic glow/gradient treatment.
        flap: {
          amber: "#22E5EA",
          amberDim: "#0F6E72",
          violet: "#8B5CF6",
          violetDim: "#4C2E93",
        },
        signal: {
          go: "#4ADE80",
          stop: "#FF5C7A",
          wait: "#FFC857",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 22px rgba(34, 229, 234, 0.35)",
        glowViolet: "0 0 26px rgba(139, 92, 246, 0.35)",
      },
    },
  },
  plugins: [],
};

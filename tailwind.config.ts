import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        navy: {
          50: "#f3f6fa",
          100: "#e6edf5",
          700: "#243b55",
          800: "#182b43",
          900: "#102033",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,32,51,.08), 0 1px 8px rgba(16,32,51,.04)",
        panel: "0 22px 65px rgba(16,32,51,.22)",
      },
    },
  },
  plugins: [],
};

export default config;

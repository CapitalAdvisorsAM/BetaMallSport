import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Geist",
          "Geist Sans",
          "GT America",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ],
        serif: ["Fraunces", "ui-serif", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      fontSize: {
        "display-lg": ["3rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        display: ["2.125rem", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
        headline: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        title: ["1.125rem", { lineHeight: "1.3", letterSpacing: "-0.005em" }],
        body: ["0.9375rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.4" }],
        overline: ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.12em" }]
      },
      colors: {
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          500: "#164786",
          700: "#011E42",
          900: "#010F21"
        },
        secondary: {
          300: "#7BAED6",
          500: "#3F7CCA",
          700: "#2860A8"
        },
        gold: {
          300: "#f0d080",
          400: "#d4a84b",
          500: "#b8860b"
        },
        positive: {
          50: "#ecfdf5",
          100: "#d1fae5",
          600: "#059669",
          700: "#047857"
        },
        negative: {
          50: "#fff1f2",
          100: "#ffe4e6",
          600: "#e11d48",
          700: "#be123c"
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          600: "#d97706",
          700: "#b45309"
        },
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0"
        }
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 1px 0 rgb(15 23 42 / 0.02)",
        "card-hover":
          "0 6px 16px -6px rgb(15 23 42 / 0.10), 0 2px 4px 0 rgb(15 23 42 / 0.04)",
        "ribbon": "inset 0 -1px 0 rgb(212 168 75 / 0.6)"
      },
      spacing: {
        "18": "4.5rem"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "success-flash": {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "rgb(209 250 229 / 1)" }
        }
      },
      animation: {
        "fade-up": "fade-up 480ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "success-flash": "success-flash 800ms ease-out"
      }
    }
  },
  plugins: []
};

export default config;

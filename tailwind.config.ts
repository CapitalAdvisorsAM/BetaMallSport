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
        sans: ["Outfit", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
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
        }
      }
    }
  },
  plugins: []
};

export default config;

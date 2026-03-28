import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dce6ff",
          200: "#b9cbff",
          300: "#7a9aff",
          500: "#1a3a6b",
          700: "#0d1f4a",
          900: "#060e26"
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

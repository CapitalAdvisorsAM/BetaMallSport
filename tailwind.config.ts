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
          50: "#ecf7f3",
          100: "#d3eee5",
          500: "#0f766e",
          700: "#0f4f4b"
        }
      }
    }
  },
  plugins: []
};

export default config;

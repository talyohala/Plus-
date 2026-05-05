import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#60A5FA",
          dark: "#334155",
          gray: "#94A3B8",
          light: "#F8FAFC"
        }
      }
    },
  },
  plugins: [],
} satisfies Config;

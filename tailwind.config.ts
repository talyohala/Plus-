import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#1D4ED8",   // הוחזר לכחול העמוק והמקורי
          dark: "#334155",   // אפור-כחול (Slate) מודרני
          gray: "#94A3B8",   // כחול-אפור עדין
          light: "#F8FAFC"   // רקע בהיר
        }
      }
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#1D4ED8",   // כחול ראשי מהלוגו
          dark: "#1E293B",   // טקסט כהה
          gray: "#64748B",   // טקסט משני משתלב
          light: "#F8FAFC"   // רקע בהיר
        }
      }
    },
  },
  plugins: [],
} satisfies Config;

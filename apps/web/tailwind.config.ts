import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Dark surface palette
        surface: {
          DEFAULT: "#0b0f14",
          raised: "#111820",
          border: "#1f2a37",
        },
        primary: colors.emerald,
        accent: colors.blue,
      },
    },
  },
  plugins: [],
} satisfies Config;

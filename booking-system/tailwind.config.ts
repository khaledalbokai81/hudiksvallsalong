import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2a211c",
        mint: "#8a4b2a",
        aqua: "#efe4d8",
        marigold: "#a96842",
        cloud: "#faf7f3"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 24px 70px rgba(23, 33, 38, 0.14)"
      }
    }
  },
  plugins: []
} satisfies Config;

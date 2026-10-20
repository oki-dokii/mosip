import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        canvas: "#f4f7f9",
        issuer: "#2563eb",
        wallet: "#16a34a",
        verifier: "#ea580c",
        ok: "#15803d",
        bad: "#b91c1c",
      },
      boxShadow: { card: "0 16px 45px rgba(31, 44, 61, 0.08)" },
    },
  },
  plugins: [],
} satisfies Config;

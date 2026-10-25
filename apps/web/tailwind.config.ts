import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        canvas: "#f4f7f9",
        issuer: "#2563eb",
        wallet: "#15803d",
        verifier: "#c2410c",
        ok: "#15803d",
        bad: "#b91c1c",
        fail: "#b91c1c",
      },
      boxShadow: { card: "0 16px 45px rgba(31, 44, 61, 0.08)" },
    },
  },
  plugins: [],
} satisfies Config;

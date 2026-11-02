import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        canvas: "#f8fafc",
        issuer: "#2563eb",
        wallet: "#059669",
        verifier: "#d97706",
        ok: "#059669",
        bad: "#dc2626",
        fail: "#dc2626",
      },
      boxShadow: { card: "0 16px 45px rgba(31, 44, 61, 0.08)" },
    },
  },
  plugins: [],
} satisfies Config;

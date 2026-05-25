import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        navy: "#12355b",
        mint: "#e7f6ef",
        coral: "#e86f51",
        gold: "#f4b942"
      }
    }
  },
  plugins: []
};

export default config;

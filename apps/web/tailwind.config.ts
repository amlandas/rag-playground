import type { Config } from "tailwindcss";
import daisyui from "daisyui";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      "light",
      {
        forest: {
          primary: "#22d3ee",
          "primary-content": "#03151c",
          secondary: "#a78bfa",
          "secondary-content": "#120926",
          accent: "#f472b6",
          "accent-content": "#1f0c18",
          neutral: "#1f2937",
          "neutral-content": "#f5f7fa",
          "base-100": "#121721",
          "base-200": "#0d121b",
          "base-300": "#1f2933",
          "base-content": "#f5f7fa",
          info: "#38bdf8",
          success: "#4ade80",
          warning: "#facc15",
          error: "#f87171",
        },
      },
    ],
  },
};
export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "rgb(var(--surface) / <alpha-value>)",
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          500: "#1d4ed8",
          600: "#1e40af",
          700: "#1e3a8a",
          900: "#0f172a",
        },
      },
    },
  },
  plugins: [],
};

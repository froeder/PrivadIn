/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        privadin: {
          gold: "#facc15",
          amber: "#f59e0b",
          ink: "#020617",
        },
      },
      boxShadow: {
        glow: "0 0 40px rgba(250, 204, 21, 0.22)",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#064E3B",
          deep: "#04382B",
          muted: "#3D6B5C",
        },
        champagne: {
          DEFAULT: "#F8E7C9",
          dark: "#E6D4A8",
        },
        parchment: "#F4EFE6",
        cream: "#FBFAF7",
        sage: "#E7F0EB",
      },
      fontFamily: {
        serif: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Source Sans 3"', "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 8px 30px rgba(6, 78, 59, 0.08)",
      },
    },
  },
  plugins: [],
};

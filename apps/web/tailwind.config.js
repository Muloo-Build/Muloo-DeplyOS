/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Muloo brand colors
        background: {
          primary: "#080d1f",
          card: "#0e1530",
          elevated: "#141d3d"
        },
        text: {
          primary: "#ffffff",
          secondary: "#8b93b0",
          muted: "#555e7a"
        },
        accent: {
          solid: "#e0529c"
        },
        status: {
          success: "#2dd4a0",
          warning: "#f0a050",
          error: "#e05060",
          info: "#4f8ef7"
        },
        hub: {
          sales: "#4f8ef7",
          marketing: "#2dd4a0",
          service: "#f0a050",
          cms: "#a07cf0",
          ops: "#8b93b0"
        }
      },
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
        heading: ["system-ui", "sans-serif"]
      },
      backgroundImage: {
        "muloo-gradient":
          "linear-gradient(135deg, #7c5cbf 0%, #e0529c 50%, #f0824a 100%)"
      },
      spacing: {
        sidebar: "240px"
      }
    }
  },
  plugins: []
};

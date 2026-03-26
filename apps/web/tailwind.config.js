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
          primary: "#050a30",
          card: "#0a1236",
          elevated: "#0a1040"
        },
        text: {
          primary: "#ffffff",
          secondary: "#a0abc7",
          muted: "#7b86a8"
        },
        brand: {
          teal: "#00c4cc",
          purple: "#c140ff",
          orange: "#f47621",
          blue: "#155dfc",
          green: "#59bf96",
          navy: "#050a30"
        },
        accent: {
          solid: "#00c4cc"
        },
        status: {
          success: "#59bf96",
          warning: "#f47621",
          error: "#fb2c36",
          info: "#155dfc"
        },
        hub: {
          sales: "#155dfc",
          marketing: "#59bf96",
          service: "#f47621",
          cms: "#c140ff",
          ops: "#a0abc7"
        }
      },
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
        heading: ["Montserrat", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "muloo-gradient":
          "linear-gradient(135deg, #00c4cc 0%, #c140ff 52%, #f47621 100%)"
      },
      spacing: {
        sidebar: "240px"
      }
    }
  },
  plugins: []
};

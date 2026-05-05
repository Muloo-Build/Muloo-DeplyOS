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
        // Redesign tokens — INK (backgrounds)
        ink: {
          0: "#06080F",
          1: "#0B0E18",
          2: "#11151F",
          3: "#181D29",
          4: "#222837",
          5: "#2C3344"
        },
        // Redesign tokens — TEXT
        text: {
          // New scale
          1: "#E8EAF0",
          2: "#B0B6C5",
          3: "#7B8195",
          4: "#525868",
          // Legacy aliases (mapped to new scale so unrestyled pages still render)
          primary: "#E8EAF0",
          secondary: "#B0B6C5",
          muted: "#7B8195"
        },
        // Background legacy aliases mapped to ink scale
        background: {
          primary: "#06080F",
          card: "#0B0E18",
          elevated: "#11151F"
        },
        // Brand (wordmark + .btn.brand only)
        brand: {
          from: "#7C5CFF",
          to: "#E94BD4",
          // Legacy aliases
          teal: "#4ADBC0",
          purple: "#7C5CFF",
          orange: "#FFB454",
          blue: "#6EA8FE",
          green: "#4ADBC0",
          navy: "#06080F"
        },
        // Accent (single chromatic for actions/active states)
        accent: {
          DEFAULT: "#4ADBC0",
          solid: "#4ADBC0",
          soft: "rgba(74, 219, 192, 0.12)",
          line: "rgba(74, 219, 192, 0.35)"
        },
        // Status
        status: {
          ok: "#4ADBC0",
          warn: "#FFB454",
          danger: "#FF6B7A",
          info: "#6EA8FE",
          // Legacy aliases
          success: "#4ADBC0",
          warning: "#FFB454",
          error: "#FF6B7A"
        },
        // Hub tag colors (legacy, remapped to new palette)
        hub: {
          sales: "#6EA8FE",
          marketing: "#4ADBC0",
          service: "#FFB454",
          cms: "#B59BFF",
          ops: "#7B8195"
        }
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        heading: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "monospace"
        ]
      },
      backgroundImage: {
        "muloo-gradient": "linear-gradient(135deg, #7C5CFF 0%, #E94BD4 100%)",
        "brand-grad": "linear-gradient(135deg, #7C5CFF 0%, #E94BD4 100%)"
      },
      borderRadius: {
        "r-sm": "6px",
        "r-md": "10px",
        "r-lg": "14px",
        "r-xl": "20px"
      },
      spacing: {
        sidebar: "240px",
        "nav-w": "240px",
        "subnav-w": "220px",
        "header-h": "56px"
      },
      boxShadow: {
        "elev-sm":
          "0 1px 0 0 rgba(255,255,255,0.03), 0 1px 2px rgba(0,0,0,0.4)",
        "elev-md": "0 8px 24px rgba(0,0,0,0.5)",
        "elev-pop": "0 12px 40px rgba(0,0,0,0.6)"
      },
      fontSize: {
        eyebrow: ["11px", { lineHeight: "1.4", letterSpacing: "0.14em" }],
        body: ["13.5px", { lineHeight: "1.5" }],
        "h2-section": ["16px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "h1-page": ["26px", { lineHeight: "1.2", letterSpacing: "-0.02em" }]
      }
    }
  },
  plugins: []
};

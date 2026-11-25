import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#171A18",
        paper: "#F2F1EB",
        signal: "#C8F169",
        machine: "#888E87",
        rust: "#C65D40",
        sage: "#DADFD4",
        "pale-sage": "#DADFD4",
        forest: "#243D31",
        "ink-muted": "#4B534C",
        "ink-subtle": "#5E655E",
        "paper-muted": "#C6CDC4",
        "rust-ink": "#9B3E25",
        line: "#D6D8D0",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        label: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.18em" }],
        caption: ["0.75rem", { lineHeight: "1.25rem", letterSpacing: "0.02em" }],
        section: ["1.75rem", { lineHeight: "2rem", letterSpacing: "-0.035em" }],
        display: ["clamp(2.75rem, 7.4vw, 7rem)", { lineHeight: "0.88", letterSpacing: "-0.06em" }],
      },
      backgroundImage: {
        "fine-grid":
          "linear-gradient(to right, rgba(23,26,24,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(23,26,24,0.055) 1px, transparent 1px)",
      },
      transitionTimingFunction: {
        instrument: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      borderRadius: {
        lg: "0.3rem",
        md: "0.22rem",
        sm: "0.14rem",
      },
      letterSpacing: {
        label: "0.18em",
        tightest: "-0.06em",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

/** @type {import('tailwindcss').Config} */
const c = (v) => `hsl(var(--${v}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "22px" }],
        md: ["15px", { lineHeight: "24px" }],
        lg: ["17px", { lineHeight: "26px", letterSpacing: "-0.01em" }],
        xl: ["20px", { lineHeight: "28px", letterSpacing: "-0.015em" }],
        "2xl": ["24px", { lineHeight: "30px", letterSpacing: "-0.02em" }],
        "3xl": ["32px", { lineHeight: "38px", letterSpacing: "-0.025em" }],
        "4xl": ["44px", { lineHeight: "48px", letterSpacing: "-0.03em" }],
        "5xl": ["56px", { lineHeight: "58px", letterSpacing: "-0.035em" }],
        "6xl": ["72px", { lineHeight: "72px", letterSpacing: "-0.04em" }],
      },
      colors: {
        bg: { DEFAULT: c("bg"), subtle: c("bg-subtle") },
        surface: { DEFAULT: c("surface"), 2: c("surface-2"), 3: c("surface-3") },
        border: { DEFAULT: c("border"), strong: c("border-strong") },
        fg: { DEFAULT: c("fg"), muted: c("fg-muted"), subtle: c("fg-subtle") },
        accent: { DEFAULT: c("accent"), fg: c("accent-fg"), text: c("accent-text") },
        positive: c("positive"),
        warning: c("warning"),
        danger: c("danger"),
        overlay: c("overlay"),
        risk: { 1: c("risk-1"), 2: c("risk-2"), 3: c("risk-3"), 4: c("risk-4"), 5: c("risk-5") },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },
      maxWidth: {
        page: "1180px",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "translateY(4px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "none" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "pop-in": "pop-in 160ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-left": "slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Pre-bundle every dependency at startup. Without this, opening a lazily
  // loaded page for the first time makes Vite discover new dependencies,
  // re-bundle and force a full page reload, which can loop on Windows.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "gsap",
      "gsap/ScrollTrigger",
      "gsap/SplitText",
      "@gsap/react",
      "lucide-react",
      "recharts",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-slider",
      "@radix-ui/react-switch",
    ],
  },
  server: {
    port: 5173,
    // Only the frontend's own files should trigger reloads; the database and
    // backend files change constantly while the app runs.
    watch: { ignored: ["**/backend/**", "**/*.db", "**/*.db-*", "**/ml-service/**"] },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});

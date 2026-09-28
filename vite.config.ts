import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app under /<repo-name>/,
// so base must match the repository name (github.com/ArtyomUsov/Green_Api).
// https://vitejs.dev/config/
export default defineConfig({
  base: "/Green_Api/",
  plugins: [react()],
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://127.0.0.1:8000",
      "/users": "http://127.0.0.1:8000",
      "/coins": "http://127.0.0.1:8000",
      "/countries": "http://127.0.0.1:8000",
      "/metals": "http://127.0.0.1:8000",
      "/cart": "http://127.0.0.1:8000",
      "/orders": "http://127.0.0.1:8000",
      "/static": "http://127.0.0.1:8000",
    },
  },
});

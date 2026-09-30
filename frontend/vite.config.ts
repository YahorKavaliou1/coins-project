import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = "http://127.0.0.1:8000";

// Some API prefixes are also SPA routes (/auth, /cart, /coins/:id). When the
// browser navigates to such a URL (a full page load asks for HTML), serve the
// SPA's index.html instead of proxying; API calls ask for JSON and are proxied.
const apiProxy: ProxyOptions = {
  target: API_TARGET,
  bypass: (req) => {
    if (req.method === "GET" && req.headers.accept?.includes("text/html")) {
      return "/index.html";
    }
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": apiProxy,
      "/users": apiProxy,
      "/coins": apiProxy,
      "/countries": apiProxy,
      "/metals": apiProxy,
      "/cart": apiProxy,
      "/orders": apiProxy,
      "/favourites": apiProxy,
      "/static": API_TARGET,
    },
  },
});

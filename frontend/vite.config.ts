import { defineConfig, type ProxyOptions } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

const API_TARGET = "http://127.0.0.1:8000";

// Some API prefixes are also page addresses (/auth, /cart, /coins/:id). A page load (asks for
// HTML) and React Router's data requests for a page ("/coins/12-....data") are left to the
// app's server rendering instead of proxying; API calls ask for JSON and are proxied.
const apiProxy: ProxyOptions = {
  target: API_TARGET,
  bypass: (req) => {
    const path = req.url?.split("?")[0] ?? "";
    if (req.method === "GET" && (req.headers.accept?.includes("text/html") || path.endsWith(".data"))) {
      return req.url;
    }
  },
};

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
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
      "/account": apiProxy,
      "/static": API_TARGET,
    },
  },
});

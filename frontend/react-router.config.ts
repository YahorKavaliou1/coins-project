import type { Config } from "@react-router/dev/config";

// Server rendering: search engines and link previews get complete HTML for every page.
export default {
  appDirectory: "src",
  ssr: true,
} satisfies Config;

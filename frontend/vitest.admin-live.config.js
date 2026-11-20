import { mergeConfig } from "vite";
import base from "./vite.config.js";

export default mergeConfig(base, {
  test: { environment: "jsdom", include: ["src/features/admin/admin.live.jsx"] },
});

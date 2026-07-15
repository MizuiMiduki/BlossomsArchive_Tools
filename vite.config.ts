import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import devtools from "solid-devtools/vite";
import sitemap from "vite-plugin-sitemap";
import { routes } from "./src/routes";

export default defineConfig({
    plugins: [
        devtools(),
        solidPlugin(),
        tailwindcss(),
        sitemap({
            hostname: "https://tools.blossomsarchive.com",
            routes: routes.map((r) => r.path),
        } as any),
    ],
    server: {
        port: 3000,
    },
    build: {
        target: "esnext",
    },
});

// vite.config.ts の末尾に追加にゃ！
console.log("=== [DEBUG] routesの型:", typeof routes);
console.log("=== [DEBUG] routesの長さ:", routes.length);
console.log(
    "=== [DEBUG] routesのパス一覧:",
    routes.map((r) => r.path),
);

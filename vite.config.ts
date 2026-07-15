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
        // vite.config.ts
        sitemap({
            hostname: "https://tools.blossomsarchive.com",
            routes: routes.map((r) => ({
                url: r.path,
                changefreq: "daily",
                priority: 0.7,
            })),
        } as any),
    ],
    server: {
        port: 3000,
    },
    build: {
        target: "esnext",
    },
});

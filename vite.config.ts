/// <reference types="vitest" />
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig(({ mode }) => ({
    plugins: [
        solidPlugin({ hot: false }),
        tailwindcss(),
    ],
    resolve: {
        conditions: mode === "test" ? ["development", "browser"] : [],
    },
    server: {
        port: 3000,
    },
    build: {
        target: "esnext",
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/setupTests.ts"],
        server: {
            deps: {
                inline: [/solid-js/],
            },
        },
    },
}));

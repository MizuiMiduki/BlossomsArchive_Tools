/// <reference types="vitest" />
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";

function ogpProxyDevPlugin(): Plugin {
    const handler = async (req: any, res: any, next: () => void) => {
        if (!req.url || !req.url.startsWith("/ogp-proxy.php")) {
            next();
            return;
        }

        try {
            const reqUrl = new URL(req.url, "http://localhost");
            const targetUrl = reqUrl.searchParams.get("url")?.trim() || "";
            if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(
                    JSON.stringify({
                        ok: false,
                        error: "Valid http/https URL parameter is required",
                    }),
                );
                return;
            }

            const upstream = await fetch(targetUrl, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
                },
                redirect: "follow",
            });

            let html = await upstream.text();
            if (!upstream.ok || !html.toLowerCase().includes("og:")) {
                try {
                    const botUpstream = await fetch(targetUrl, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (compatible; Twitterbot/1.0)",
                            Accept: "text/html,application/xhtml+xml",
                        },
                        redirect: "follow",
                    });
                    if (botUpstream.ok) {
                        const botHtml = await botUpstream.text();
                        if (botHtml) html = botHtml;
                    }
                } catch {
                    // ignore bot fallback error
                }
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
                JSON.stringify({
                    ok: true,
                    finalUrl: upstream.url || targetUrl,
                    html,
                }),
            );
        } catch (err: any) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
                JSON.stringify({
                    ok: false,
                    error: err?.message || "Failed to fetch target URL",
                }),
            );
        }
    };

    return {
        name: "ogp-proxy-dev",
        configureServer(server) {
            server.middlewares.use(handler);
        },
        configurePreviewServer(server) {
            server.middlewares.use(handler);
        },
    };
}

export default defineConfig(({ mode }) => ({
    plugins: [
        ogpProxyDevPlugin(),
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

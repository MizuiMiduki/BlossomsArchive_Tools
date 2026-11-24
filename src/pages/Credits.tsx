// src/pages/Credits.tsx
import { onSettled } from "solid-js";
import { playPageEntrance } from "../utils/animations";

interface Library {
    name: string;
    license: string;
    url: string;
}

const libraries: Library[] = [
    {
        name: "Solid.js",
        license: "MIT",
        url: "https://github.com/solidjs/solid",
    },
    {
        name: "@solidjs/router",
        license: "MIT",
        url: "https://github.com/solidjs/solid-router",
    },
    {
        name: "@solid-primitives/script-loader",
        license: "MIT",
        url: "https://github.com/solidjs-community/solid-primitives/tree/main/packages/script-loader",
    },
    {
        name: "Tailwind CSS",
        license: "MIT",
        url: "https://github.com/tailwindlabs/tailwindcss",
    },
    {
        name: "DaisyUI",
        license: "MIT",
        url: "https://github.com/saadeghi/daisyui",
    },
    {
        name: "qrcode",
        license: "MIT",
        url: "https://github.com/soldair/node-qrcode",
    },
    {
        name: "exifr",
        license: "MIT",
        url: "https://github.com/MikeKovarik/exifr",
    },
    {
        name: "piexifjs",
        license: "MIT",
        url: "https://github.com/hMatoba/piexifjs",
    },
    {
        name: "encoding-japanese",
        license: "MIT",
        url: "https://github.com/polygonplanet/encoding.js",
    },
    {
        name: "Vite",
        license: "MIT",
        url: "https://github.com/vitejs/vite",
    },
];

export default function Credits() {
    let containerRef: HTMLDivElement | undefined;

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
    });

    return (
        <div ref={containerRef} class="ba-page ba-page--narrow">
            <h1 class="ba-title">使用ライブラリ</h1>

            <div class="ba-stack-3">
                {libraries.map((lib) => (
                    <div
                        class="ba-card ba-flex ba-items-center ba-justify-between ba-gap-2"
                        style={{ padding: "0.85rem 1rem" }}
                    >
                        <a
                            href={lib.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="ba-font-bold ba-text-sm ba-text-primary ba-truncate ba-underline"
                        >
                            {lib.name}
                        </a>
                        <span class="ba-badge ba-badge--outline ba-shrink-0">
                            {lib.license} License
                        </span>
                    </div>
                ))}
            </div>

            <h2 class="ba-section-title" style={{ "padding-top": "0.5rem" }}>使用アイコン</h2>

            <div class="ba-stack-3">
                <div
                    class="ba-card ba-flex ba-items-center ba-justify-between ba-gap-2"
                    style={{ padding: "0.85rem 1rem" }}
                >
                    <a
                        href="https://github.com/simple-icons/simple-icons"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="ba-font-bold ba-text-sm ba-text-primary ba-truncate ba-underline"
                    >
                        Simple Icons
                    </a>
                    <span class="ba-badge ba-badge--outline ba-shrink-0">
                        CC0 1.0 License
                    </span>
                </div>
                <div
                    class="ba-card ba-flex ba-items-center ba-justify-between ba-gap-2"
                    style={{ padding: "0.85rem 1rem" }}
                >
                    <a
                        href="https://misskey-hub.net/brand-assets/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="ba-font-bold ba-text-sm ba-text-primary ba-truncate ba-underline"
                    >
                        Misskey Logo
                    </a>
                    <span class="ba-badge ba-badge--outline ba-shrink-0">
                        CC BY-SA License
                    </span>
                </div>
                <div
                    class="ba-card ba-flex ba-items-center ba-justify-between ba-gap-2"
                    style={{ padding: "0.85rem 1rem" }}
                >
                    <a
                        href="https://github.com/mastodon/mastodon"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="ba-font-bold ba-text-sm ba-text-primary ba-truncate ba-underline"
                    >
                        Mastodon Logo
                    </a>
                    <span class="ba-badge ba-badge--outline ba-shrink-0">
                        AGPL-3.0 License
                    </span>
                </div>
            </div>

            <div style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}>
                <a href="/" class="ba-btn ba-btn--outline">
                    トップへ戻る
                </a>
            </div>
        </div>
    );
}

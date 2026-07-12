// src/pages/Credits.tsx

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
        name: "Vite",
        license: "MIT",
        url: "https://github.com/vitejs/vite",
    },
];

export default function Credits() {
    return (
        <div class="max-w-2xl mx-auto p-6 space-y-6">
            <h1 class="text-3xl font-bold">使用ライブラリ</h1>

            <div class="space-y-3">
                {libraries.map((lib) => (
                    <div class="card bg-base-100 border border-base-300 shadow-sm">
                        <div class="card-body p-4 flex-row items-center justify-between">
                            <a
                                href={lib.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="font-medium text-primary hover:underline"
                            >
                                {lib.name}
                            </a>
                            <span class="badge badge-outline badge-sm shrink-0">
                                {lib.license} License
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div class="pt-4 border-t border-base-200">
                <a href="/" class="btn btn-outline">
                    トップへ戻る
                </a>
            </div>
        </div>
    );
}

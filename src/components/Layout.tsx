// src/components/Layout.tsx
import { JSX, For, createEffect, createSignal } from "solid-js";
import { useLocation } from "@solidjs/router";
import { createScriptLoader } from "@solid-primitives/script-loader";
import { routes } from "../routes";
import ThemeToggle from "./ThemeToggle";

interface LayoutProps {
    children?: JSX.Element;
}

export default function Layout(props: LayoutProps) {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = createSignal(false);
    const [isPcMenuOpen, setIsPcMenuOpen] = createSignal(localStorage.getItem("isPcMenuOpen") !== "false");
    const [isPcMenuHovered, setIsPcMenuHovered] = createSignal(false);

    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const adsenseId = import.meta.env.VITE_ADSENSE_CLIENT_ID;

    let hoverTimeout: number | undefined;

    createEffect(() => {
        localStorage.setItem("isPcMenuOpen", String(isPcMenuOpen()));
    });

    const handleMouseEnter = () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        if (!isPcMenuOpen()) setIsPcMenuHovered(true);
    };

    const handleMouseLeave = () => {
        hoverTimeout = window.setTimeout(() => setIsPcMenuHovered(false), 200);
    };

    const gaTag = gaId ? createScriptLoader({ src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`, async onLoad() { (window as any).dataLayer = (window as any).dataLayer || []; function gtag(..._args: any[]) { (window as any).dataLayer.push(arguments); } (window as any).gtag = gtag; gtag("js", new Date()); gtag("config", gaId, { send_page_view: false }); } }) : null;
    const adsenseTag = adsenseId ? createScriptLoader({ src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", crossOrigin: "anonymous" }) : null;

    const getHeaderTitle = () => {
        const route = routes.find((r) => r.path === location.pathname);
        return route ? route.title : "ツールダッシュボード";
    };

    const getShareText = () => {
        const baseTitle = "BlossomsArchive Tools";
        const title = location.pathname === "/" ? baseTitle : `${getHeaderTitle()} | ${baseTitle}`;
        return title + "\n" + window.location.href;
    };

    createEffect(() => {
        location.pathname;
        setIsMenuOpen(false);
    });

    createEffect(() => {
        const baseTitle = "BlossomsArchive Tools";
        const fullTitle = location.pathname === "/" ? baseTitle : `${getHeaderTitle()} | ${baseTitle}`;
        document.title = fullTitle;
        if (gaId && (window as any).gtag) {
            (window as any).gtag("config", gaId, { page_path: location.pathname, page_title: fullTitle });
        }
    });

    return (
        <div class="min-h-screen bg-base-200 flex overflow-x-hidden">
            {gaTag}
            {adsenseTag}

            <div
                class={`fixed inset-0 bg-black/50 z-20 lg:hidden ${isMenuOpen() ? "block" : "hidden"}`}
                onClick={() => setIsMenuOpen(false)}
            />

            {/* サイドメニュー本体 */}
            <aside
                class={`fixed inset-y-0 z-50 bg-base-100 p-6 flex flex-col transition-all duration-300 border-r border-base-300 w-64 ${
                    isMenuOpen() ? "left-0" : "-left-64"
                } ${
                    isPcMenuOpen() 
                        ? "lg:left-0" 
                        : isPcMenuHovered() 
                            ? "lg:left-0 lg:shadow-xl" 
                            : "lg:-left-64"
                }`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div class="w-52 flex flex-col h-full">
                    <div class="flex items-center justify-between mb-8 px-2 gap-2">
                        <div class="flex items-center gap-3">
                            <img src="https://blossomsarchive.com/wp-content/uploads/2021/10/cropped-d42dee79c2a98cc8da98f9d600398a05-32x32.png" alt="Logo" class="w-8 h-8 rounded-full border border-base-300" />
                            <span class="font-bold whitespace-nowrap">BA Tools</span>
                        </div>
                        {/* 開閉ボタン：押すと常時表示とホバー表示を切り替える */}
                        <button type="button" class="hidden lg:flex btn btn-ghost btn-xs btn-square" onClick={() => setIsPcMenuOpen(!isPcMenuOpen())}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class={`w-4 h-4 stroke-current transition-transform ${isPcMenuOpen() ? "" : "rotate-180"}`}>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>

                    <nav class="space-y-2 flex-1 flex flex-col justify-between">
                        <div class="space-y-2">
                            <For each={routes}>
                                {(route) => (
                                    <a href={route.path} class={`block py-2 px-4 rounded-lg font-medium transition-colors ${location.pathname === route.path ? "bg-primary text-white" : "hover:bg-base-200"}`}>
                                        {route.title}
                                    </a>
                                )}
                            </For>
                        </div>

                        {/* SNS共有ボタン */}
                        <div class="pt-4 border-t border-base-300">
                            <p class="text-xs font-semibold opacity-60 mb-2 px-1">このサイトを共有</p>
                            <div class="flex items-center gap-2 px-1 flex-wrap">
                                {/* Twitter / X */}
                                <a
                                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-ghost btn-square btn-sm tooltip tooltip-top"
                                    data-tip="X (Twitter)"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 fill-current">
                                        <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
                                    </svg>
                                </a>
                                {/* Misskey */}
                                <a
                                    href={`https://misskey-hub.net/share/?text=${encodeURIComponent(getShareText())}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-ghost btn-square btn-sm tooltip tooltip-top"
                                    data-tip="Misskey"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 fill-current">
                                        <path d="M8.91076 16.8915c-1.03957.0038-1.93213-.6294-2.35267-1.366-.22516-.3217-.66989-.4364-.6761 0v2.0148c0 .8094-.29152 1.5097-.87581 2.1002-.56755.573-1.25977.8595-2.0779.8595-.80014 0-1.49298-.2865-2.07727-.8601C.28408 19.05 0 18.3497 0 17.5403V6.45968c0-.62378.17553-1.18863.52599-1.69455.36657-.52284.83426-.88582 1.4018-1.08769a2.84574 2.84574 0 0 1 1.00049-.17742c.90125 0 1.65239.35421 2.25281 1.06262l2.99713 3.51572c.06699.05016.263.43696.73192.43696.47016 0 .6916-.3868.75796-.43758l2.9717-3.5151c.6178-.70841 1.377-1.06262 2.2782-1.06262.3337 0 .6675.05893 1.0012.17742.5669.20187 1.0259.56422 1.377 1.08769.3665.50592.5501 1.07077.5501 1.69455V17.5403c0 .8094-.2915 1.5097-.8758 2.1002-.5675.573-1.2604.8595-2.0779.8595-.8008 0-1.493-.2865-2.0779-.8601-.5669-.5899-.8504-1.2902-.8504-2.0996v-2.0148c-.0496-.5499-.5303-.2032-.7009 0-.4503.8431-1.31369 1.3616-2.35264 1.366ZM21.447 8.60998c-.7009 0-1.3015-.24449-1.8019-.73348-.4838-.50571-.7257-1.11277-.7257-1.82118s.2419-1.30711.7257-1.79611c.5004-.50571 1.101-.75856 1.8019-.75856.7009 0 1.3017.25285 1.8025.75856.5003.489.7505 1.0877.7505 1.79611 0 .70841-.2502 1.31547-.7505 1.82118-.5008.48899-1.1016.73348-1.8025.73348Zm.0248.50655c.7009 0 1.2935.25285 1.7777.75856.5003.50571.7505 1.11301.7505 1.82181v6.2484c0 .7084-.2502 1.3155-.7505 1.8212-.4838.489-1.0764.7335-1.7777.7335-.7005 0-1.3011-.2445-1.8019-.7335-.5003-.5057-.7505-1.1128-.7505-1.8212v-6.2484c0-.7084.2502-1.3157.7505-1.82181.5004-.50571 1.101-.75856 1.8019-.75856Z" />
                                    </svg>
                                </a>
                                {/* Bluesky */}
                                <a
                                    href={`https://bsky.app/intent/compose?text=${encodeURIComponent(getShareText())}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-ghost btn-square btn-sm tooltip tooltip-top"
                                    data-tip="Bluesky"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 fill-current">
                                        <path d="M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026" />
                                    </svg>
                                </a>
                                {/* Mastodon */}
                                <a
                                    href={`https://donshare.net/share.html?text=${encodeURIComponent(getShareText())}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-ghost btn-square btn-sm tooltip tooltip-top"
                                    data-tip="Mastodon"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5 fill-current">
                                        <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054 19.648 19.648 0 0 0 4.636.536c.562 0 1.124 0 1.69-.016 1.939-.056 3.995-.154 5.906-.45 .047-.007.093-.015.14-.023 2.476-.42 4.83-1.735 5.073-5.753.01-.17.038-1.774.038-1.947 0-.596.183-4.24-.025-6.478zM19.52 13.527h-2.76V7.836c0-1.202-.505-1.813-1.515-1.813-1.117 0-1.676.724-1.676 2.156v3.12h-2.744v-3.12c0-1.432-.56-2.156-1.676-2.156-1.01 0-1.515.611-1.515 1.813v5.691H4.873V7.639c0-1.202.308-2.159.924-2.87.636-.71 1.468-1.074 2.498-1.074 1.19 0 2.091.456 2.689 1.37L12 6.388l1.016-1.323c.598-.914 1.499-1.37 2.689-1.37 1.03 0 1.862.364 2.498 1.074.616.711.924 1.668.924 2.87z" />
                                    </svg>
                                </a>
                                {/* OS標準の共有 */}
                                {"share" in navigator && (
                                    <button
                                        type="button"
                                        class="btn btn-ghost btn-square btn-sm tooltip tooltip-top"
                                        data-tip="その他の共有"
                                        onClick={() => {
                                            const baseTitle = "BlossomsArchive Tools";
                                            const title = location.pathname === "/" ? baseTitle : `${getHeaderTitle()} | ${baseTitle}`;
                                            navigator.share({
                                                title: title,
                                                url: window.location.href,
                                            }).catch(() => {});
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5 stroke-current">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 0 5.368-2.684 3 3 0 0 0-5.368 2.684zm0 9.316a3 3 0 1 0 5.368 2.684 3 3 0 0 0-5.368-2.684z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <footer class="text-center pt-4 pb-4 opacity-60 text-sm">
                            <a href="/privacy" class="block hover:underline">プライバシーポリシー</a>
                            <a href="/credits" class="block hover:underline">使用ライブラリ</a>
                            <p class="text-xs mt-2">© BlossomsArchive</p>
                        </footer>
                    </nav>
                </div>
            </aside>

            {/* メインエリア */}
            <div class={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ${isPcMenuOpen() ? "lg:ml-64" : "lg:ml-0"}`}>
                <header class="h-16 bg-base-100/70 backdrop-blur-md border-b border-base-300 sticky top-0 z-40 flex items-center px-4 lg:px-8 shadow-sm justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <button
                            class={`btn btn-ghost btn-square ${isPcMenuOpen() ? "lg:hidden" : "flex"}`}
                            onClick={() => {
                                setIsPcMenuOpen(true);
                                setIsMenuOpen(!isMenuOpen());
                            }}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-6 h-6 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        </button>
                        <span class="font-bold text-lg">{getHeaderTitle()}</span>
                    </div>
                    <ThemeToggle />
                </header>

                <main class="flex-1 overflow-y-auto">
                    <div class="p-4 lg:p-8">
                        {props.children}
                    </div>
                </main>
            </div>
        </div>
    );
}

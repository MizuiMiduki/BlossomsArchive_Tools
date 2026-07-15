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
    const adsenseTag = adsenseId ? createScriptLoader({ src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`, crossOrigin: "anonymous" }) : null;

    const getHeaderTitle = () => {
        const route = routes.find((r) => r.path === location.pathname);
        return route ? route.title : "ツールダッシュボード";
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
                        <footer class="text-center pt-8 pb-4 opacity-60 text-sm">
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

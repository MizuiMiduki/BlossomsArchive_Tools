// src/components/Layout.tsx
import { JSX, For, createEffect, createSignal, onMount } from "solid-js";
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

    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const adsenseId = import.meta.env.VITE_ADSENSE_CLIENT_ID;

    // GA4: createScriptLoader で非同期ロード → onLoad でタグ設定
    const gaTag = gaId
        ? createScriptLoader({
              src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`,
              async onLoad() {
                  (window as any).dataLayer = (window as any).dataLayer || [];
                  function gtag(..._args: any[]) {
                      (window as any).dataLayer.push(arguments);
                  }
                  (window as any).gtag = gtag;
                  gtag("js", new Date());
                  // send_page_view: false にしてページ遷移は createEffect で手動送信
                  gtag("config", gaId, { send_page_view: false });
              },
          })
        : null;

    // AdSense: script タグを head に追加
    onMount(() => {
        if (adsenseId) {
            const script = document.createElement("script");
            script.async = true;
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`;
            script.crossOrigin = "anonymous";
            document.head.appendChild(script);
        }
    });

    // ★ ページ遷移したら自動でメニューを閉じます
    createEffect(() => {
        location.pathname; // 追跡
        setIsMenuOpen(false);
    });

    const getHeaderTitle = () => {
        const route = routes.find((r) => r.path === location.pathname);
        return route ? route.title : "ツールダッシュボード";
    };

    // タイトル管理 & GA4 ページビュー送信
    createEffect(() => {
        const baseTitle = "BlossomsArchive Tools";
        const currentPageTitle = getHeaderTitle();
        const fullTitle =
            location.pathname === "/"
                ? baseTitle
                : `${currentPageTitle} | ${baseTitle}`;
        document.title = fullTitle;

        if (gaId && (window as any).gtag) {
            (window as any).gtag("config", gaId, {
                page_path: location.pathname,
                page_title: fullTitle,
            });
        }
    });

    return (
        <div class="min-h-screen bg-base-200 flex">
            {/* GA4 スクリプトを JSX に挿入（createScriptLoader の要件） */}
            {gaTag}
            {/* ★ モバイル用オーバーレイ（メニューが開いている時だけ背景を暗くします） */}
            <div
                class={`fixed inset-0 bg-black/50 z-20 lg:hidden ${isMenuOpen() ? "block" : "hidden"}`}
                onClick={() => setIsMenuOpen(false)}
            />

            {/* サイドバー */}
            <aside
                class={`fixed inset-y-0 left-0 z-30 w-64 bg-base-100 border-r border-base-300 p-6 flex flex-col transition-transform duration-300 lg:static lg:transform-none ${isMenuOpen() ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
            >
                <div class="flex items-center gap-3 mb-8 px-2">
                    <img
                        src="https://blossomsarchive.com/wp-content/uploads/2021/10/cropped-d42dee79c2a98cc8da98f9d600398a05-32x32.png"
                        alt="Blossoms Logo"
                        class="w-8 h-8 rounded-full object-cover border border-base-300"
                    />
                    <span class="font-bold">BA Tools</span>
                </div>

                <nav class="space-y-2">
                    <For each={routes}>
                        {(route) => (
                            <a
                                href={route.path}
                                class={`block py-2 px-4 rounded-lg font-medium transition-all ${
                                    location.pathname === route.path
                                        ? "bg-primary text-white"
                                        : "hover:bg-base-200"
                                }`}
                            >
                                {route.title}
                            </a>
                        )}
                    </For>
                    <footer class="text-center p-8 opacity-60">
                        <a href="/privacy" class="text-sm hover:underline">
                            プライバシーポリシー
                        </a>
                        <p class="text-xs mt-2">© BlossomsArchive</p>
                    </footer>
                </nav>
            </aside>

            {/* メインエリア */}
            <div class="flex-1 flex flex-col">
                <header class="h-16 bg-white/70 backdrop-blur-md border-b border-base-300 sticky top-0 z-10 flex items-center px-4 lg:px-8 shadow-sm justify-between">
                    {/* ★ ハンバーガーボタン（スマホのみ表示） */}
                    <button
                        class="lg:hidden btn btn-ghost btn-square"
                        onClick={() => setIsMenuOpen(!isMenuOpen())}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            class="inline-block w-6 h-6 stroke-current"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 6h16M4 12h16M4 18h16"
                            ></path>
                        </svg>
                    </button>
                    <span class="font-bold text-lg">{getHeaderTitle()}</span>
                    <div class="w-10">
                        <ThemeToggle />
                    </div>
                </header>
                <main class="flex-1 p-4 lg:p-8">{props.children}</main>
            </div>
        </div>
    );
}

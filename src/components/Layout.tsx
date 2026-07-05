// src/components/Layout.tsx
import { JSX, For, createEffect, createSignal } from "solid-js";
import { useLocation } from "@solidjs/router";
import { routes } from "../routes";
import ThemeToggle from "./ThemeToggle";

interface LayoutProps {
    children?: JSX.Element;
}

export default function Layout(props: LayoutProps) {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = createSignal(false);

    // ★ ページ遷移したら自動でメニューを閉じます
    createEffect(() => {
        location.pathname; // 追跡
        setIsMenuOpen(false);
    });

    const getHeaderTitle = () => {
        const route = routes.find((r) => r.path === location.pathname);
        return route ? route.title : "ツールダッシュボード";
    };

    // タイトル管理
    createEffect(() => {
        const baseTitle = "BlossomsArchive Tools";
        const currentPageTitle = getHeaderTitle();
        document.title =
            location.pathname === "/"
                ? baseTitle
                : `${currentPageTitle} | ${baseTitle}`;
    });

    return (
        <div class="min-h-screen bg-base-200 flex">
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
                    <span class="font-bold">Blossoms Tools</span>
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

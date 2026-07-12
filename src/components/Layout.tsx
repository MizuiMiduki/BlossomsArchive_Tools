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

    const initialPcMenuState = localStorage.getItem("isPcMenuOpen") !== "false";
    const [isPcMenuOpen, setIsPcMenuOpen] = createSignal(initialPcMenuState);
    const [isPcMenuHovered, setIsPcMenuHovered] = createSignal(false);

    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const adsenseId = import.meta.env.VITE_ADSENSE_CLIENT_ID;

    let hoverTimeout: number | undefined;

    createEffect(() => {
        localStorage.setItem("isPcMenuOpen", String(isPcMenuOpen()));
    });

    const handleMouseEnter = () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        if (!isPcMenuOpen()) {
            setIsPcMenuHovered(true);
        }
    };

    const handleMouseLeave = () => {
        hoverTimeout = window.setTimeout(() => {
            setIsPcMenuHovered(false);
        }, 200);
    };

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
                  gtag("config", gaId, { send_page_view: false });
              },
          })
        : null;

    const adsenseTag = adsenseId
        ? createScriptLoader({
              src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`,
              crossOrigin: "anonymous",
          })
        : null;

    createEffect(() => {
        location.pathname;
        setIsMenuOpen(false);
    });

    const getHeaderTitle = () => {
        const route = routes.find((r) => r.path === location.pathname);
        return route ? route.title : "ツールダッシュボード";
    };

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

    const getPcClasses = () => {
        if (isPcMenuOpen()) {
            return "lg:static lg:translate-x-0 lg:w-64 lg:p-6 lg:opacity-100 lg:border-r lg:border-base-300 pointer-events-auto";
        }
        if (isPcMenuHovered()) {
            return "lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:translate-x-0 lg:w-64 lg:p-6 lg:opacity-100 lg:bg-base-100 lg:border-r lg:border-base-300 lg:shadow-xl pointer-events-auto";
        }
        return "lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:-translate-x-full lg:w-64 lg:p-6 lg:opacity-0 lg:border-r-0 overflow-hidden pointer-events-none";
    };

    return (
        <div class="min-h-screen bg-base-200 flex overflow-x-hidden">
            {gaTag}
            {adsenseTag}

            <div
                class={`fixed inset-0 bg-black/50 z-20 lg:hidden ${isMenuOpen() ? "block" : "hidden"}`}
                onClick={() => setIsMenuOpen(false)}
            />

            <aside
                class={`fixed inset-y-0 left-0 z-30 bg-base-100 p-6 flex flex-col transition-all duration-300 border-r border-base-300 ${
                    isMenuOpen()
                        ? "translate-x-0 w-64"
                        : "-translate-x-full w-64"
                } ${getPcClasses()}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div class="w-52 flex flex-col h-full">
                    <div class="flex items-center justify-between mb-8 px-2 gap-2">
                        <div class="flex items-center gap-3">
                            <img
                                src="https://blossomsarchive.com/wp-content/uploads/2021/10/cropped-d42dee79c2a98cc8da98f9d600398a05-32x32.png"
                                alt="Blossoms Logo"
                                class="w-8 h-8 rounded-full object-cover border border-base-300"
                            />
                            <span class="font-bold whitespace-nowrap">
                                BA Tools
                            </span>
                        </div>

                        <button
                            type="button"
                            class="hidden lg:flex btn btn-ghost btn-xs btn-square text-slate-400 hover:text-slate-700"
                            onClick={() => {
                                setIsPcMenuOpen(false);
                                setIsPcMenuHovered(false);
                            }}
                            title="メニューを折りたたむ"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                class="w-4 h-4 stroke-current"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2.5"
                                    d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
                                />
                            </svg>
                        </button>
                    </div>

                    <nav class="space-y-2 flex-1 flex flex-col justify-between">
                        <div class="space-y-2">
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
                        </div>

                        <footer class="text-center pt-8 pb-4 opacity-60 space-y-1 mt-auto">
                            <a
                                href="/privacy"
                                class="block text-sm hover:underline"
                            >
                                プライバシーポリシー
                            </a>
                            <a
                                href="/credits"
                                class="block text-sm hover:underline"
                            >
                                使用ライブラリ
                            </a>
                            <p class="text-xs mt-2">© BlossomsArchive</p>
                        </footer>
                    </nav>
                </div>
            </aside>

            <div class="flex-1 flex flex-col min-w-0">
                <header class="h-16 bg-white/70 backdrop-blur-md border-b border-base-300 sticky top-0 z-10 flex items-center px-4 lg:px-8 shadow-sm justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <button
                            class={`btn btn-ghost btn-square ${isPcMenuOpen() ? "lg:hidden" : "flex"}`}
                            onClick={() => {
                                if (window.innerWidth >= 1024) {
                                    setIsPcMenuOpen(true);
                                } else {
                                    setIsMenuOpen(!isMenuOpen());
                                }
                            }}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            title="メニューを開く"
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

                        <span class="font-bold text-lg">
                            {getHeaderTitle()}
                        </span>
                    </div>

                    <div class="w-10">
                        <ThemeToggle />
                    </div>
                </header>
                <main class="flex-1 p-4 lg:p-8">{props.children}</main>
            </div>
        </div>
    );
}

// src/components/Layout.tsx
import { For, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { useLocation } from "@solidjs/router";
import { Link, Meta, Title } from "@solidjs/meta";
import {
    getPageMetadata,
    getPageJsonLd,
    normalizePath,
    routes,
    DEFAULT_OG_IMAGE,
    SITE_FAVICON,
    SITE_LOGO,
    SITE_TITLE,
    PUBLISHER_NAME,
} from "../routes";
import ThemeToggle from "./ThemeToggle";
import { delayedCall } from "../utils/gsapAnimations";

interface LayoutProps {
    children?: JSX.Element;
}

export default function Layout(props: LayoutProps) {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = createSignal(false);
    const [isPcMenuOpen, setIsPcMenuOpen] = createSignal(
        localStorage.getItem("isPcMenuOpen") !== "false",
    );
    const [isPcMenuHovered, setIsPcMenuHovered] = createSignal(false);

    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const adsenseId = import.meta.env.VITE_ADSENSE_CLIENT_ID;

    let hoverTween: ReturnType<typeof delayedCall> | undefined;
    let mainRef: HTMLElement | undefined;

    // ブラウザの自動スクロール復元を無効化（戻る/進む時の位置ずれ防止）
    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }

    onSettled(() => {
        let thirdPartyLoaded = false;
        const triggerLoad = () => {
            if (thirdPartyLoaded) return;
            thirdPartyLoaded = true;
            window.removeEventListener("pointerdown", triggerLoad);
            window.removeEventListener("touchstart", triggerLoad);
            window.removeEventListener("keydown", triggerLoad);
            window.removeEventListener("wheel", triggerLoad);
            window.removeEventListener("click", triggerLoad);

            if (gaId && typeof document !== "undefined") {
                const gaScript = document.createElement("script");
                gaScript.async = true;
                gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
                gaScript.onload = () => {
                    (window as any).dataLayer = (window as any).dataLayer || [];
                    function gtag(..._args: any[]) {
                        (window as any).dataLayer.push(arguments);
                    }
                    (window as any).gtag = gtag;
                    gtag("js", new Date());
                    gtag("config", gaId, {
                        page_path: location.pathname,
                        page_title: getMetadata().title,
                    });
                };
                document.head.appendChild(gaScript);
            }

            if (adsenseId && typeof document !== "undefined") {
                const adsScript = document.createElement("script");
                adsScript.async = true;
                adsScript.src =
                    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
                adsScript.crossOrigin = "anonymous";
                document.head.appendChild(adsScript);

                // Google AdSenseが自動広告・トップアンカー広告でbody/htmlに余白を注入して押し下げるのを防止
                if (typeof MutationObserver !== "undefined") {
                    const preventPushdown = () => {
                        if (document.body.style.paddingTop) document.body.style.paddingTop = "0px";
                        if (document.body.style.marginTop) document.body.style.marginTop = "0px";
                        if (document.documentElement.style.paddingTop) document.documentElement.style.paddingTop = "0px";
                        if (document.documentElement.style.marginTop) document.documentElement.style.marginTop = "0px";
                    };
                    const observer = new MutationObserver(preventPushdown);
                    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
                    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
                }
            }
        };

        window.addEventListener("pointerdown", triggerLoad, { passive: true, once: true });
        window.addEventListener("touchstart", triggerLoad, { passive: true, once: true });
        window.addEventListener("keydown", triggerLoad, { passive: true, once: true });
        window.addEventListener("wheel", triggerLoad, { passive: true, once: true });
        window.addEventListener("click", triggerLoad, { passive: true, once: true });

        return () => {
            if (hoverTween !== undefined) window.clearTimeout(hoverTween);
            window.removeEventListener("pointerdown", triggerLoad);
            window.removeEventListener("touchstart", triggerLoad);
            window.removeEventListener("keydown", triggerLoad);
            window.removeEventListener("wheel", triggerLoad);
            window.removeEventListener("click", triggerLoad);
        };
    });

    createEffect(
        () => isPcMenuOpen(),
        (open) => {
            localStorage.setItem("isPcMenuOpen", String(open));
        }
    );

    const handleMouseEnter = () => {
        if (hoverTween !== undefined) window.clearTimeout(hoverTween);
        if (!isPcMenuOpen()) setIsPcMenuHovered(true);
    };

    const handleMouseLeave = () => {
        hoverTween = delayedCall(0.2, () => setIsPcMenuHovered(false));
    };

    const currentPath = createMemo(() => normalizePath(location.pathname));

    const getHeaderTitle = createMemo(() => {
        const route = routes.find((r) => r.path === currentPath());
        return route ? route.title : "ツールダッシュボード";
    });

    const getMetadata = createMemo(() => getPageMetadata(currentPath()));
    const getCurrentUrl = () => window.location.origin + currentPath();
    const getKeywordsText = createMemo(() => (getMetadata().keywords ?? []).join(", "));

    const getShareTitle = () => {
        const baseTitle = "BlossomsArchive Tools";
        return currentPath() === "/"
            ? baseTitle
            : `${getHeaderTitle()} | ${baseTitle}`;
    };

    const getShareText = () => {
        return getShareTitle() + "\n" + getCurrentUrl();
    };

    createEffect(
        () => ({ pathname: location.pathname, hash: location.hash }),
        ({ hash }) => {
            setIsMenuOpen(false);

            if (hash) {
                const target = document.getElementById(hash.slice(1));
                if (target) {
                    target.scrollIntoView();
                    return;
                }
            }

            let userScrolled = false;
            const markUserScrolled = () => {
                userScrolled = true;
                cleanupScrollLock();
            };

            const resetScroll = () => {
                if (userScrolled) return;
                if (mainRef) {
                    mainRef.scrollTop = 0;
                    mainRef.scrollTo?.({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
                }
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
            };

            const handleNonUserScroll = () => {
                if (userScrolled) return;
                resetScroll();
            };

            const cleanupScrollLock = () => {
                mainRef?.removeEventListener("scroll", handleNonUserScroll);
                window.removeEventListener("scroll", handleNonUserScroll);
                window.removeEventListener("wheel", markUserScrolled);
                window.removeEventListener("touchmove", markUserScrolled);
                window.removeEventListener("pointerdown", markUserScrolled);
                window.removeEventListener("keydown", markUserScrolled);
            };

            window.addEventListener("wheel", markUserScrolled, { passive: true });
            window.addEventListener("touchmove", markUserScrolled, { passive: true });
            window.addEventListener("pointerdown", markUserScrolled, { passive: true });
            window.addEventListener("keydown", markUserScrolled, { passive: true });
            mainRef?.addEventListener("scroll", handleNonUserScroll, { passive: true });
            window.addEventListener("scroll", handleNonUserScroll, { passive: true });

            resetScroll();

            return cleanupScrollLock;
        }
    );

    createEffect(
        () => ({
            pathname: location.pathname,
            title: getMetadata().title,
            url: getMetadata().url,
        }),
        ({ pathname, title, url }) => {
            if (gaId && (window as any).gtag) {
                (window as any).gtag("config", gaId, {
                    page_path: pathname,
                    page_title: title,
                });
            }

            // 全ページ共通 JSON-LD 構造化データと canonical の動的更新
            if (typeof document !== "undefined") {
                const jsonLd = getPageJsonLd(pathname);
                let script = document.getElementById(
                    "ba-tools-global-jsonld",
                ) as HTMLScriptElement | null;
                if (!script) {
                    script = document.createElement("script");
                    script.type = "application/ld+json";
                    script.id = "ba-tools-global-jsonld";
                    document.head.appendChild(script);
                }
                script.textContent = JSON.stringify(jsonLd);

                let canonical = document.querySelector('link[rel="canonical"]');
                if (!canonical) {
                    canonical = document.createElement("link");
                    canonical.setAttribute("rel", "canonical");
                    document.head.appendChild(canonical);
                }
                canonical.setAttribute("href", url);
            }
        }
    );

    return (
        <div class="h-dvh max-h-dvh bg-base-200 flex overflow-hidden w-full">
            {/* 基本SEOメタタグ */}
            <Title>{getMetadata().title}</Title>
            <Meta name="description" content={getMetadata().description} />
            <Meta
                name="robots"
                content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
            />
            <Meta name="format-detection" content="telephone=no" />
            <Meta name="author" content={PUBLISHER_NAME} />
            <Show when={getKeywordsText()}>
                <Meta
                    name="keywords"
                    content={getKeywordsText()}
                />
            </Show>
            <Link rel="icon" href={SITE_FAVICON} />
            <Link rel="apple-touch-icon" href={SITE_LOGO} />
            <Link rel="alternate" type="text/plain" href="https://tools.blossomsarchive.com/llms.txt" />
            <Link rel="ard" type="application/ai-catalog+json" href="https://tools.blossomsarchive.com/.well-known/ard.json" />

            {/* OGP (Open Graph Protocol) タグ */}
            <Meta property="og:type" content="website" />
            <Meta property="og:site_name" content={SITE_TITLE} />
            <Meta property="og:locale" content="ja_JP" />
            <Meta property="og:title" content={getMetadata().title} />
            <Meta
                property="og:description"
                content={getMetadata().description}
            />
            <Meta property="og:url" content={getMetadata().url} />
            <Meta property="og:image" content={DEFAULT_OG_IMAGE} />
            <Meta property="og:image:width" content="192" />
            <Meta property="og:image:height" content="192" />
            <Meta property="og:image:alt" content={getMetadata().title} />

            {/* Twitter カード */}
            <Meta name="twitter:card" content="summary" />
            <Meta name="twitter:title" content={getMetadata().title} />
            <Meta
                name="twitter:description"
                content={getMetadata().description}
            />
            <Meta name="twitter:image" content={DEFAULT_OG_IMAGE} />

            <div
                class={`fixed inset-0 bg-black/50 z-20 lg:hidden ${isMenuOpen() ? "block" : "hidden"}`}
                onClick={() => setIsMenuOpen(false)}
            />

            {/* サイドメニュー本体 */}
            <aside
                class={`fixed inset-y-0 z-50 bg-base-100 flex flex-col transition-all duration-300 border-r border-base-300 w-64 max-w-[85vw] ${
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
                {/* ヘッダー部（ロゴ・開閉ボタン）: 上部固定 */}
                <div class="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 gap-2">
                    <div class="flex items-center gap-3">
                        <img
                            src="/icon-32.png"
                            alt="BlossomsArchive Tools Logo"
                            width="32"
                            height="32"
                            class="w-8 h-8 rounded-full border border-base-300"
                        />
                        <span class="font-bold whitespace-nowrap">
                            BA Tools
                        </span>
                    </div>
                    {/* 開閉ボタン：押すと常時表示とホバー表示を切り替える */}
                    <button
                        type="button"
                        class="hidden lg:flex btn btn-ghost btn-xs btn-square"
                        aria-label={isPcMenuOpen() ? "サイドメニューを閉じる" : "サイドメニューを開く"}
                        onClick={() => setIsPcMenuOpen(!isPcMenuOpen())}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            class={`w-4 h-4 stroke-current transition-transform ${isPcMenuOpen() ? "" : "rotate-180"}`}
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

                {/* スクロール領域 */}
                <div class="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
                    <nav class="flex flex-col min-h-full justify-between gap-6">
                        <div class="space-y-2">
                            <For each={routes.filter((r) => !r.hidden)}>
                                {(route) => (
                                    <a
                                        href={route.path}
                                        class={`block py-2 px-4 rounded-lg font-medium transition-colors ${currentPath() === route.path ? "bg-primary text-white" : "hover:bg-base-200"}`}
                                    >
                                        {route.title}
                                    </a>
                                )}
                            </For>
                        </div>

                        <div class="space-y-4">
                            {/* SNS共有ボタン */}
                            <div class="pt-4 border-t border-base-300">
                                <p class="text-xs font-semibold opacity-60 mb-2 px-1">
                                    このサイトを共有
                                </p>
                                <div class="flex items-center gap-2 px-1 flex-wrap">
                                    {/* Twitter / X */}
                                    <a
                                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="btn btn-ghost btn-square btn-sm"
                                        title="X (Twitter)"
                                        aria-label="X"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            class="w-5 h-5"
                                            style="fill: #000000"
                                            aria-hidden="true"
                                        >
                                            <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
                                        </svg>
                                    </a>
                                    {/* Threads */}
                                    <a
                                        href={`https://www.threads.net/intent/post?text=${encodeURIComponent(getShareTitle())}&url=${encodeURIComponent(getCurrentUrl())}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="btn btn-ghost btn-square btn-sm"
                                        title="Threads"
                                        aria-label="Threads"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            class="w-5 h-5"
                                            style="fill: #000000"
                                            aria-hidden="true"
                                        >
                                            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098c1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015c-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164c1.43 1.783 3.631 2.698 6.54 2.717c2.623-.02 4.358-.631 5.8-2.045c1.647-1.613 1.618-3.593 1.09-4.798c-.31-.71-.873-1.3-1.634-1.75c-.192 1.352-.622 2.446-1.284 3.272c-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801c-1.063-.689-1.685-1.74-1.752-2.964c-.065-1.19.408-2.285 1.33-3.082c.88-.76 2.119-1.207 3.583-1.291a14 14 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757c-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32l-1.757-1.18c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388q.163.07.321.142c1.49.7 2.58 1.761 3.154 3.07c.797 1.82.871 4.79-1.548 7.158c-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69q-.362 0-.739.021c-1.836.103-2.98.946-2.916 2.143c.067 1.256 1.452 1.839 2.784 1.767c1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221" />
                                        </svg>
                                    </a>
                                    {/* Misskey */}
                                    <a
                                        href={`https://misskey-hub.net/share/?text=${encodeURIComponent(getShareText())}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="btn btn-ghost btn-square btn-sm"
                                        title="Misskey"
                                        aria-label="Misskey"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            class="w-5 h-5"
                                            style="fill: #86B300"
                                            aria-hidden="true"
                                        >
                                            <path d="M8.91076 16.8915c-1.03957.0038-1.93213-.6294-2.35267-1.366-.22516-.3217-.66989-.4364-.6761 0v2.0148c0 .8094-.29152 1.5097-.87581 2.1002-.56755.573-1.25977.8595-2.0779.8595-.80014 0-1.49298-.2865-2.07727-.8601C.28408 19.05 0 18.3497 0 17.5403V6.45968c0-.62378.17553-1.18863.52599-1.69455.36657-.52284.83426-.88582 1.4018-1.08769a2.84574 2.84574 0 0 1 1.00049-.17742c.90125 0 1.65239.35421 2.25281 1.06262l2.99713 3.51572c.06699.05016.263.43696.73192.43696.47016 0 .6916-.3868.75796-.43758l2.9717-3.5151c.6178-.70841 1.377-1.06262 2.2782-1.06262.3337 0 .6675.05893 1.0012.17742.5669.20187 1.0259.56422 1.377 1.08769.3665.50592.5501 1.07077.5501 1.69455V17.5403c0 .8094-.2915 1.5097-.8758 2.1002-.5675.573-1.2604.8595-2.0779.8595-.8008 0-1.493-.2865-2.0779-.8601-.5669-.5899-.8504-1.2902-.8504-2.0996v-2.0148c-.0496-.5499-.5303-.2032-.7009 0-.4503.8431-1.31369 1.3616-2.35264 1.366ZM21.447 8.60998c-.7009 0-1.3015-.24449-1.8019-.73348-.4838-.50571-.7257-1.11277-.7257-1.82118s.2419-1.30711.7257-1.79611c.5004-.50571 1.101-.75856 1.8019-.75856.7009 0 1.3017.25285 1.8025.75856.5003.489.7505 1.0877.7505 1.79611 0 .70841-.2502 1.31547-.7505 1.82118-.5008.48899-1.1016.73348-1.8025.73348Zm.0248.50655c.7009 0 1.2935.25285 1.7777.75856.5003.50571.7505 1.11301.7505 1.82181v6.2484c0 .7084-.2502 1.3155-.7505 1.8212-.4838.489-1.0764.7335-1.7777.7335-.7005 0-1.3011-.2445-1.8019-.7335-.5003-.5057-.7505-1.1128-.7505-1.8212v-6.2484c0-.7084.2502-1.3157.7505-1.82181.5004-.50571 1.101-.75856 1.8019-.75856Z" />
                                        </svg>
                                    </a>
                                    {/* Bluesky */}
                                    <a
                                        href={`https://bsky.app/intent/compose?text=${encodeURIComponent(getShareText())}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="btn btn-ghost btn-square btn-sm"
                                        title="Bluesky"
                                        aria-label="Bluesky"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            class="w-5 h-5"
                                            style="fill: #0085ff"
                                            aria-hidden="true"
                                        >
                                            <path d="M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026" />
                                        </svg>
                                    </a>
                                    {/* Mastodon */}
                                    <a
                                        href={`https://www.addtoany.com/add_to/mastodon?linkurl=${encodeURIComponent(getCurrentUrl())}&linkname=${encodeURIComponent(getShareTitle())}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="btn btn-ghost btn-square btn-sm"
                                        title="Mastodon"
                                        aria-label="Mastodon"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            class="w-5 h-5"
                                            style="fill: #6364ff"
                                            aria-hidden="true"
                                        >
                                            <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054 19.648 19.648 19.648 0 0 0 4.636.536c.562 0 1.124 0 1.69-.016 1.939-.056 3.995-.154 5.906-.45 .047-.007.093-.015.14-.023 2.476-.42 4.83-1.735 5.073-5.753.01-.17.038-1.774.038-1.947 0-.596.183-4.24-.025-6.478zM19.52 13.527h-2.76V7.836c0-1.202-.505-1.813-1.515-1.813-1.117 0-1.676.724-1.676 2.156v3.12h-2.744v-3.12c0-1.432-.56-2.156-1.676-2.156-1.01 0-1.515.611-1.515 1.813v5.691H4.873V7.639c0-1.202.308-2.159.924-2.87.636-.71 1.468-1.074 2.498-1.074 1.19 0 2.091.456 2.689 1.37L12 6.388l1.016-1.323c.598-.914 1.499-1.37 2.689-1.37 1.03 0 1.862.364 2.498 1.074.616.711.924 1.668.924 2.87z" />
                                        </svg>
                                    </a>
                                    {/* OS標準の共有 */}
                                    <Show when={typeof navigator !== "undefined" && "share" in navigator}>
                                        <button
                                            type="button"
                                            class="btn btn-ghost btn-square btn-sm"
                                            title="その他の共有"
                                            aria-label="その他の共有"
                                            onClick={() => {
                                                navigator
                                                    .share({
                                                        title: getShareTitle(),
                                                        url: window.location.href,
                                                    })
                                                    .catch(() => {});
                                            }}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                class="w-5 h-5 stroke-current"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 0 5.368-2.684 3 3 0 0 0-5.368 2.684zm0 9.316a3 3 0 1 0 5.368 2.684 3 3 0 0 0-5.368-2.684z"
                                                />
                                            </svg>
                                        </button>
                                    </Show>
                                </div>
                            </div>

                            <footer class="text-center opacity-60 text-sm">
                                <a href="/privacy" class="block hover:underline">
                                    プライバシーポリシー
                                </a>
                                <a href="/credits" class="block hover:underline">
                                    使用ライブラリ
                                </a>
                                <p class="text-xs mt-2">© BlossomsArchive</p>
                            </footer>
                        </div>
                    </nav>
                </div>
            </aside>

            {/* メインエリア */}
            <div
                class={`flex-1 flex flex-col min-w-0 h-dvh max-h-dvh overflow-hidden transition-all duration-300 ${isPcMenuOpen() ? "lg:ml-64" : "lg:ml-0"}`}
            >
                <header class="h-16 shrink-0 bg-base-100/70 backdrop-blur-md border-b border-base-300 sticky top-0 z-40 flex items-center px-3 sm:px-4 lg:px-8 shadow-sm justify-between gap-2 sm:gap-4 google-anno-skip">
                    <div class="flex items-center gap-2 sm:gap-4 min-w-0">
                        <button
                            class={`btn btn-ghost btn-square btn-sm sm:btn-md shrink-0 ${isPcMenuOpen() ? "lg:hidden" : "flex"}`}
                            aria-label="メニューを開く"
                            onClick={() => {
                                setIsPcMenuOpen(true);
                                setIsMenuOpen(!isMenuOpen());
                            }}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                class="w-6 h-6 stroke-current"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 6h16M4 12h16M4 18h16"
                                ></path>
                            </svg>
                        </button>
                        <span class="font-bold text-base sm:text-lg truncate">
                            {getHeaderTitle()}
                        </span>
                    </div>
                    <div class="shrink-0">
                        <ThemeToggle />
                    </div>
                </header>

                <main ref={mainRef} class="flex-1 min-h-0 max-h-[calc(100dvh-4rem)] overflow-y-auto overflow-x-hidden [overflow-anchor:auto]">
                    <div class="p-3 sm:p-4 lg:p-8 w-full max-w-full min-w-0 google-anno-skip">{props.children}</div>
                </main>
            </div>
        </div>
    );
}

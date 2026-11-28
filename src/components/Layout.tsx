// src/components/Layout.tsx
import { For, Show, createEffect, createMemo, createSignal, lazy, onSettled } from "solid-js";
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
    SITE_URL,
} from "../routes";
import {
    getLocaleFromPath,
    getPathWithoutLocale,
    getPathWithLocale,
    getHreflangLinks,
    getUiTranslations,
} from "../i18n/index";
import { ROUTE_TRANSLATIONS } from "../i18n/routeTranslations";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
const CommandPalette = lazy(() => import("./CommandPalette"));
import { delayedCall } from "../utils/animations";
import { filterRoutesByQuery } from "../utils/search";
import { getFavorites } from "../utils/favorites";
import { CATEGORIES, TOOL_CATEGORIES_CONFIG, getToolIcon } from "../utils/categories";
import ToolIcon from "./ToolIcon";

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
    const [sidebarSearchQuery, setSidebarSearchQuery] = createSignal("");
    const [isPaletteOpen, setIsPaletteOpen] = createSignal(false);

    const favoriteRoutes = createMemo(() => {
        const favs = getFavorites();
        return routes.filter((r) => !r.hidden && favs.includes(r.path));
    });

    const getCategoryName = (cat: { id: string; name: string }) => {
        if (currentLocale() === "ja") return cat.name;
        switch (cat.id) {
            case "camera":
                return currentUi().categoryCamera;
            case "utility":
                return currentUi().categoryUtility;
            case "developer":
                return currentUi().categoryDeveloper;
            case "audio":
                return currentUi().categoryAudio;
            default:
                return cat.name;
        }
    };

    const getLocalizedRouteTitle = (path: string) => {
        return ROUTE_TRANSLATIONS[path]?.[currentLocale()]?.title ?? routes.find((r) => r.path === path)?.title ?? "";
    };

    const getLocalizedRouteHref = (path: string) => {
        return getPathWithLocale(path, currentLocale());
    };

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
                    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`;
                adsScript.crossOrigin = "anonymous";
                document.head.appendChild(adsScript);

                // Google AdSenseが自動広告・トップアンカー広告でbody/htmlに余白を注入してメインコンテンツを押し下げるのを防止（オーバーレイ化）
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

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setIsPaletteOpen((prev) => !prev);
            }
        };

        window.addEventListener("pointerdown", triggerLoad, { passive: true, once: true });
        window.addEventListener("touchstart", triggerLoad, { passive: true, once: true });
        window.addEventListener("keydown", triggerLoad, { passive: true, once: true });
        window.addEventListener("wheel", triggerLoad, { passive: true, once: true });
        window.addEventListener("click", triggerLoad, { passive: true, once: true });
        window.addEventListener("keydown", handleGlobalKeyDown);

        return () => {
            if (hoverTween !== undefined) window.clearTimeout(hoverTween);
            window.removeEventListener("pointerdown", triggerLoad);
            window.removeEventListener("touchstart", triggerLoad);
            window.removeEventListener("keydown", triggerLoad);
            window.removeEventListener("wheel", triggerLoad);
            window.removeEventListener("click", triggerLoad);
            window.removeEventListener("keydown", handleGlobalKeyDown);
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
    const currentLocale = createMemo(() => getLocaleFromPath(location.pathname));
    const currentUi = createMemo(() => getUiTranslations(currentLocale()));
    const internalPath = createMemo(() => getPathWithoutLocale(currentPath()));

    const getHeaderTitle = createMemo(() => {
        const trans = ROUTE_TRANSLATIONS[internalPath()]?.[currentLocale()];
        if (trans) return trans.title;
        const route = routes.find((r) => r.path === internalPath());
        return route ? route.title : currentUi().dashboardTitle;
    });

    const getMetadata = createMemo(() => getPageMetadata(currentPath()));
    const getCurrentUrl = () => window.location.origin + currentPath();
    const getKeywordsText = createMemo(() => (getMetadata().keywords ?? []).join(", "));
    const hreflangLinks = createMemo(() => getHreflangLinks(currentPath(), SITE_URL));

    const getShareTitle = () => {
        const baseTitle = "BlossomsArchive Tools";
        return internalPath() === "/"
            ? baseTitle
            : `${getHeaderTitle()} | ${baseTitle}`;
    };

    const getShareText = () => {
        return getShareTitle() + "\n" + getCurrentUrl();
    };

    let isFirstNavigation = true;
    createEffect(
        () => ({ pathname: location.pathname, hash: location.hash }),
        ({ hash }) => {
            setIsMenuOpen(false);
            setSidebarSearchQuery("");

            if (hash) {
                const target = document.getElementById(hash.slice(1));
                if (target) {
                    target.scrollIntoView();
                    return;
                }
            }

            if (isFirstNavigation) {
                isFirstNavigation = false;
                return;
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
                if (typeof document !== "undefined") {
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                }
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
            langTag: getMetadata().langTag,
        }),
        ({ pathname, title, url, langTag }) => {
            if (gaId && (window as any).gtag) {
                (window as any).gtag("config", gaId, {
                    page_path: pathname,
                    page_title: title,
                });
            }

            // 全ページ共通 JSON-LD 構造化データと canonical の動的更新
            if (typeof document !== "undefined") {
                document.documentElement.lang = langTag;

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
        <div class="ba-app-shell">
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
            <For each={hreflangLinks()}>
                {(link) => <Link rel="alternate" hreflang={link.lang} href={link.href} />}
            </For>
            <Link rel="alternate" type="text/plain" href="https://tools.blossomsarchive.com/llms.txt" />
            <Link rel="ard" type="application/ai-catalog+json" href="https://tools.blossomsarchive.com/.well-known/ard.json" />

            {/* OGP (Open Graph Protocol) タグ */}
            <Meta property="og:type" content="website" />
            <Meta property="og:site_name" content={SITE_TITLE} />
            <Meta property="og:locale" content={getMetadata().ogLocale} />
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

            <Show when={isMenuOpen()}>
                <div
                    class="ba-sidebar-backdrop ba-hidden-desktop"
                    onClick={() => setIsMenuOpen(false)}
                />
            </Show>

            {/* サイドメニュー本体 */}
            <aside
                class={`ba-sidebar ${isMenuOpen() ? "is-open" : ""} ${
                    !isPcMenuOpen() && !isPcMenuHovered() ? "is-collapsed" : ""
                } ${!isPcMenuOpen() && isPcMenuHovered() ? "is-hovered" : ""}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* ヘッダー部（ロゴ・開閉ボタン）: 上部固定 */}
                <div class="ba-flex ba-items-center ba-justify-between ba-shrink-0 ba-gap-2" style={{ padding: "1.25rem 1.25rem 0.875rem" }}>
                    <a
                        href={getLocalizedRouteHref("/")}
                        class="ba-flex ba-items-center ba-gap-3"
                        style={{ color: "inherit", "text-decoration": "none" }}
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <img
                            src="/icon-32.png"
                            alt="BlossomsArchive Tools Logo"
                            width="32"
                            height="32"
                            class="ba-logo-img"
                        />
                        <span class="ba-font-black" style={{ "white-space": "nowrap" }}>
                            BA Tools
                        </span>
                    </a>
                    <button
                        type="button"
                        class="ba-btn ba-btn--ghost ba-btn--xs ba-btn--square ba-only-desktop"
                        aria-label={isPcMenuOpen() ? "サイドメニューを閉じる" : "サイドメニューを開く"}
                        onClick={() => setIsPcMenuOpen(!isPcMenuOpen())}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            class={`ba-icon-sm ${isPcMenuOpen() ? "" : "ba-rotate-180"}`}
                            stroke="currentColor"
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

                {/* サイドバー用メニュー検索バー */}
                <div class="ba-shrink-0" style={{ padding: "0 1.25rem 0.75rem" }}>
                    <label for="sidebar-menu-search" class="ba-sr-only">
                        {currentUi().searchMenu}
                    </label>
                    <div class="ba-input-icon-wrap">
                        <span class="ba-input-icon">
                            <ToolIcon name="search" class="ba-icon-xs" />
                        </span>
                        <input
                            id="sidebar-menu-search"
                            type="search"
                            class="ba-input ba-input--sm"
                            style={{ "padding-left": "2.25rem", "padding-right": "1.75rem" }}
                            placeholder={currentUi().searchPlaceholder}
                            value={sidebarSearchQuery()}
                            onInput={(e) => setSidebarSearchQuery(e.currentTarget.value)}
                            aria-label={currentUi().searchMenu}
                        />
                        <Show when={sidebarSearchQuery().trim()}>
                            <button
                                type="button"
                                class="ba-input-clear"
                                onClick={() => setSidebarSearchQuery("")}
                                aria-label="メニュー検索をクリア"
                            >
                                ×
                            </button>
                        </Show>
                    </div>
                </div>

                {/* スクロール領域 */}
                <div class="ba-flex-1 ba-scroll-y" style={{ padding: "0 1.25rem 1.25rem" }}>
                    <nav class="ba-flex ba-flex-col ba-justify-between ba-gap-6" style={{ "min-height": "100%" }}>
                        <div class="ba-stack-2">
                            {/* お気に入りピン留めセクション */}
                            <Show when={!sidebarSearchQuery().trim() && favoriteRoutes().length > 0}>
                                <div style={{ "margin-bottom": "0.75rem", "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}>
                                    <div class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-font-bold" style={{ padding: "0 0.5rem 0.4rem", color: "#f59e0b" }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="ba-icon-xs" fill="currentColor" aria-hidden="true">
                                            <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                        </svg>
                                        <span>{currentUi().favorites}</span>
                                    </div>
                                    <div class="ba-stack-1">
                                        <For each={favoriteRoutes()}>
                                            {(route) => (
                                                <a
                                                    href={getLocalizedRouteHref(route.path)}
                                                    class={`ba-nav-link ${internalPath() === route.path ? "is-active" : ""}`}
                                                >
                                                    <ToolIcon name={getToolIcon(route.path)} class="ba-icon-sm ba-shrink-0" />
                                                    <span class="ba-truncate">{getLocalizedRouteTitle(route.path)}</span>
                                                </a>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* 検索時: マッチしたツール一覧 */}
                            <Show
                                when={!sidebarSearchQuery().trim()}
                                fallback={
                                    <>
                                        <For
                                            each={filterRoutesByQuery(
                                                routes.filter((r) => !r.hidden),
                                                sidebarSearchQuery()
                                            )}
                                        >
                                            {(route) => (
                                                <a
                                                    href={getLocalizedRouteHref(route.path)}
                                                    class={`ba-nav-link ${internalPath() === route.path ? "is-active" : ""}`}
                                                >
                                                    <ToolIcon name={getToolIcon(route.path)} class="ba-icon-sm ba-shrink-0" />
                                                    <span class="ba-truncate">{getLocalizedRouteTitle(route.path)}</span>
                                                </a>
                                            )}
                                        </For>
                                        <Show
                                            when={
                                                filterRoutesByQuery(
                                                    routes.filter((r) => !r.hidden),
                                                    sidebarSearchQuery()
                                                ).length === 0
                                            }
                                        >
                                            <div class="ba-text-center ba-text-xs ba-text-muted" style={{ padding: "1.5rem 0.5rem" }}>
                                                {currentUi().noResults}
                                            </div>
                                        </Show>
                                    </>
                                }
                            >
                                {/* 通常時: カテゴリ別グループ表示 */}
                                <For each={CATEGORIES.filter((c) => c.id !== "all")}>
                                    {(cat) => {
                                        const catRoutes = routes.filter(
                                            (r) => !r.hidden && TOOL_CATEGORIES_CONFIG[r.path]?.category === cat.id
                                        );
                                        return (
                                            <Show when={catRoutes.length > 0}>
                                                <div style={{ "margin-bottom": "0.75rem" }}>
                                                    <div class="ba-flex ba-items-center ba-gap-2 ba-text-xs ba-font-bold ba-text-muted" style={{ padding: "0.25rem 0.5rem", "letter-spacing": "0.04em" }}>
                                                        <ToolIcon name={cat.icon} class="ba-icon-xs ba-shrink-0" />
                                                        <span>{getCategoryName(cat)}</span>
                                                        <span style={{ "margin-left": "auto", "font-weight": 500 }}>
                                                            {catRoutes.length}
                                                        </span>
                                                    </div>
                                                    <div class="ba-stack-1">
                                                        <For each={catRoutes}>
                                                            {(route) => (
                                                                <a
                                                                    href={getLocalizedRouteHref(route.path)}
                                                                    class={`ba-nav-link ${internalPath() === route.path ? "is-active" : ""}`}
                                                                >
                                                                    <ToolIcon name={getToolIcon(route.path)} class="ba-icon-sm ba-shrink-0" />
                                                                    <span class="ba-truncate">{getLocalizedRouteTitle(route.path)}</span>
                                                                </a>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                            </Show>
                                        );
                                    }}
                                </For>
                            </Show>
                        </div>

                        <div class="ba-stack-4">
                            {/* SNS共有ボタン */}
                            <div style={{ "padding-top": "0.875rem", "border-top": "1px solid var(--ba-border)" }}>
                                <p class="ba-text-xs ba-font-bold ba-text-muted" style={{ "margin-top": 0, "margin-bottom": "0.5rem" }}>
                                    {currentUi().share}
                                </p>
                                <div class="ba-flex ba-items-center ba-gap-1 ba-flex-wrap">
                                    {/* Twitter / X */}
                                    <a
                                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--square"
                                        title="X (Twitter)"
                                        aria-label="X"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            width="24"
                                            height="24"
                                            class="ba-icon-md" fill="currentColor"
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
                                        class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--square"
                                        title="Threads"
                                        aria-label="Threads"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            width="24"
                                            height="24"
                                            class="ba-icon-md" fill="currentColor"
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
                                        class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--square"
                                        title="Misskey"
                                        aria-label="Misskey"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            width="24"
                                            height="24"
                                            class="ba-icon-md" fill="#86B300"
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
                                        class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--square"
                                        title="Bluesky"
                                        aria-label="Bluesky"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            width="24"
                                            height="24"
                                            class="ba-icon-md" fill="#0085ff"
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
                                        class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--square"
                                        title="Mastodon"
                                        aria-label="Mastodon"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            width="24"
                                            height="24"
                                            class="ba-icon-md" fill="#6364ff"
                                            aria-hidden="true"
                                        >
                                            <path d="M23.193 7.88c0-5.207-3.411-6.733-3.411-6.733C18.062.357 15.108.025 12.041 0h-.076c-3.069.025-6.02.357-7.74 1.147 0 0-3.412 1.526-3.412 6.732 0 1.193-.023 2.619.015 4.13.124 5.092.934 10.11 5.641 11.355 2.17.574 4.034.695 5.536.612 2.722-.15 4.25-.972 4.25-.972l-.09-1.975s-1.945.613-4.13.54c-2.165-.075-4.449-.234-4.799-2.892a5.5 5.5 0 0 1-.048-.745s2.125.52 4.818.643c1.646.075 3.19-.097 4.758-.283 3.007-.359 5.625-2.212 5.954-3.905.517-2.665.475-6.508.475-6.508zm-4.024 6.709h-2.497v-6.12c0-1.29-.543-1.944-1.628-1.944-1.2 0-1.802.776-1.802 2.313v3.349h-2.484v-3.35c0-1.537-.602-2.313-1.802-2.313-1.085 0-1.628.655-1.628 1.945v6.119H4.831V8.285c0-1.29.328-2.314.987-3.07.68-.759 1.57-1.147 2.674-1.147 1.278 0 2.246.491 2.886 1.474L12 6.585l.622-1.043c.64-.983 1.608-1.474 2.886-1.474 1.104 0 1.994.388 2.674 1.147.659.756.987 1.78.987 3.07v6.304z" />
                                        </svg>
                                    </a>
                                    {/* OS標準の共有 */}
                                    <Show when={typeof navigator !== "undefined" && "share" in navigator}>
                                        <button
                                            type="button"
                                            class="ba-btn ba-btn--ghost ba-btn--sm ba-btn--square"
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
                                                width="24"
                                                height="24"
                                                class="ba-icon-md" stroke="currentColor"
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

                            <footer class="ba-text-center ba-text-xs ba-text-muted ba-stack-1">
                                <a href={getPathWithLocale("/privacy", currentLocale())} class="ba-underline">
                                    {currentUi().privacyPolicy}
                                </a>
                                <a href={getPathWithLocale("/credits", currentLocale())} class="ba-underline">
                                    {currentUi().credits}
                                </a>
                                <p style={{ "margin-top": "0.35rem", "margin-bottom": 0 }}>© BlossomsArchive</p>
                            </footer>
                        </div>
                    </nav>
                </div>
            </aside>

            {/* メインエリア */}
            <div class="ba-content-col">
                <header class="ba-topbar google-anno-skip">
                    <div class="ba-flex ba-items-center ba-gap-3 ba-min-w-0">
                        <button
                            type="button"
                            class={`ba-btn ba-btn--ghost ba-btn--sm ba-btn--square ba-shrink-0 ${isPcMenuOpen() ? "ba-hidden-desktop" : ""}`}
                            aria-label={currentUi().menuOpen}
                            onClick={() => {
                                setIsPcMenuOpen(true);
                                setIsMenuOpen(!isMenuOpen());
                            }}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="24" height="24" class="ba-icon-lg" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <span class="ba-font-black ba-text-lg ba-truncate">
                            {getHeaderTitle()}
                        </span>
                    </div>
                    <div class="ba-flex ba-items-center ba-gap-2 ba-shrink-0">
                        <button
                            type="button"
                            class="ba-btn ba-btn--secondary ba-btn--sm"
                            onClick={() => setIsPaletteOpen(true)}
                        >
                            <ToolIcon name="search" class="ba-icon-xs" />
                            <span class="ba-text-xs">{currentUi().searchPlaceholder}</span>
                            <kbd class="ba-kbd ba-hidden-mobile">⌘K</kbd>
                        </button>
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </header>

                <main ref={mainRef} class="ba-main">
                    <div class="google-anno-skip ba-w-full ba-min-w-0">{props.children}</div>
                </main>
            </div>

            {/* クイック検索コマンドパレット（開くまでチャンクを遅延ロードして初回JSを軽量化） */}
            <Show when={isPaletteOpen()}>
                <CommandPalette isOpen={isPaletteOpen()} onClose={() => setIsPaletteOpen(false)} />
            </Show>
        </div>
    );
}

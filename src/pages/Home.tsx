import { For, Show, createSignal, createMemo, onSettled } from "solid-js";
import { useLocation } from "@solidjs/router";
import { routes, type Route } from "../routes";
import AdSense from "../components/AdSense";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import { getFavorites, toggleFavorite } from "../utils/favorites";
import {
    CATEGORIES,
    TOOL_CATEGORIES_CONFIG,
    type ToolCategoryId,
    getToolIcon,
    getToolCategory,
    getRoutesByCategory,
} from "../utils/categories";
import {
    getLocaleFromPath,
    getPathWithLocale,
    getUiTranslations,
    getLocalizedRouteMeta,
    type SupportedLocale,
} from "../i18n/index";

type HomeGridItem =
    | { type: "tool"; route: Route }
    | { type: "ad"; id: string };

export default function Home() {
    let containerRef: HTMLDivElement | undefined;
    let location: { pathname: string };
    try {
        location = useLocation();
    } catch {
        location = { pathname: typeof window !== "undefined" ? window.location.pathname : "/" };
    }

    const currentLocale = createMemo<SupportedLocale>(() => getLocaleFromPath(location.pathname));
    const ui = createMemo(() => getUiTranslations(currentLocale()));

    const initialQuery =
        typeof window !== "undefined"
            ? (new URLSearchParams(window.location.search).get("q") ?? "").slice(0, 100)
            : "";
    const [searchQuery, setSearchQuery] = createSignal(initialQuery);
    const [selectedCategory, setSelectedCategory] = createSignal<ToolCategoryId>("all");

    const availableRoutes = createMemo(() =>
        routes.filter((r) => r.path !== "/" && !r.hidden)
    );

    const categoryCounts = createMemo(() => {
        const counts: Record<ToolCategoryId, number> = {
            all: availableRoutes().length,
            camera: 0,
            utility: 0,
            developer: 0,
            audio: 0,
        };
        for (const route of availableRoutes()) {
            const cat = TOOL_CATEGORIES_CONFIG[route.path]?.category;
            if (cat && cat in counts) {
                counts[cat]++;
            }
        }
        return counts;
    });

    const categoryRoutes = createMemo(() =>
        getRoutesByCategory(availableRoutes(), selectedCategory())
    );

    const filteredRoutes = createMemo(() => {
        const q = searchQuery().trim().toLowerCase();
        const base = categoryRoutes();
        if (!q) return base;
        const loc = currentLocale();

        return base.filter((r) => {
            const localized = getLocalizedRouteMeta(r.path, loc);
            const titleMatch = (localized.title || r.title || "").toLowerCase().includes(q);
            const descMatch = (localized.description || r.description || "").toLowerCase().includes(q);
            const pathMatch = r.path.toLowerCase().includes(q);
            const kwMatch = localized.keywords?.some((k) => k.toLowerCase().includes(q));
            return titleMatch || descMatch || pathMatch || kwMatch;
        });
    });

    const gridItems = createMemo<HomeGridItem[]>(() => {
        const list = filteredRoutes();
        const items: HomeGridItem[] = [];

        list.forEach((route, idx) => {
            items.push({ type: "tool", route });
            if ((idx + 1) % 6 === 0 && idx + 1 < list.length) {
                items.push({ type: "ad", id: `infeed-ad-${idx}` });
            }
        });

        return items;
    });

    onSettled(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".ba-card");
        }
    });

    const getLocalizedCategoryName = (id: ToolCategoryId) => {
        const t = ui();
        switch (id) {
            case "all":
                return t.categoryAll;
            case "camera":
                return t.categoryCamera;
            case "utility":
                return t.categoryUtility;
            case "developer":
                return t.categoryDeveloper;
            case "audio":
                return t.categoryAudio;
            default:
                return id;
        }
    };

    return (
        <div ref={containerRef} class="ba-page">
            <header class="ba-home-header">
                <div>
                    <h1 class="ba-title">{ui().homeTitle}</h1>
                    <p class="ba-text-sm ba-text-muted" style={{ "margin-top": "0.35rem", "margin-bottom": 0 }}>
                        {ui().homeSubtitle}
                    </p>
                </div>

                {/* トップページ用ツール検索バー */}
                <div class="ba-search-box">
                    <label for="home-tool-search" class="ba-sr-only">
                        {ui().homeSearchLabel}
                    </label>
                    <div class="ba-input-icon-wrap">
                        <span class="ba-input-icon">
                            <ToolIcon name="search" class="ba-icon-sm" />
                        </span>
                        <input
                            id="home-tool-search"
                            type="search"
                            class="ba-input"
                            style={{ "padding-left": "2.5rem", "padding-right": "2.25rem", "border-radius": "0.75rem" }}
                            placeholder={ui().homeSearchPlaceholder}
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            aria-label={ui().homeSearchLabel}
                        />
                        <Show when={searchQuery().trim()}>
                            <button
                                type="button"
                                class="ba-input-clear"
                                onClick={() => setSearchQuery("")}
                                aria-label={ui().clearSearchInput}
                            >
                                ×
                            </button>
                        </Show>
                    </div>
                </div>
            </header>

            {/* カテゴリ切り替えフィルター */}
            <div class="ba-flex ba-items-center ba-gap-2 ba-scroll-x" role="tablist" aria-label="ツールカテゴリ">
                <For each={CATEGORIES}>
                    {(cat) => {
                        const isSelected = () => selectedCategory() === cat.id;
                        return (
                            <button
                                type="button"
                                role="tab"
                                aria-selected={isSelected() ? "true" : "false"}
                                class={`ba-btn ba-btn--sm ba-btn--pill ba-shrink-0 ${
                                    isSelected() ? "ba-btn--primary" : "ba-btn--secondary"
                                }`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                <ToolIcon name={cat.icon} class="ba-icon-xs" />
                                <span>{getLocalizedCategoryName(cat.id)}</span>
                                <span
                                    class="ba-badge ba-mono"
                                    style={{
                                        "background-color": isSelected() ? "#ffffff" : "var(--ba-surface-3)",
                                        color: isSelected() ? "#0f172a" : "var(--ba-text)",
                                    }}
                                >
                                    {categoryCounts()[cat.id]}
                                </span>
                            </button>
                        );
                    }}
                </For>
            </div>

            {/* 検索結果・絞り込み件数表示 */}
            <Show when={searchQuery().trim() || selectedCategory() !== "all"}>
                <div class="ba-flex ba-items-center ba-justify-between ba-text-xs ba-text-muted">
                    <span>
                        <Show when={selectedCategory() !== "all"}>
                            <span class="ba-badge ba-badge--outline" style={{ "margin-right": "0.4rem" }}>
                                {getLocalizedCategoryName(selectedCategory())}
                            </span>
                        </Show>
                        <Show when={searchQuery().trim()}>
                            「<strong style={{ color: "var(--ba-text)" }}>{searchQuery().trim()}</strong>」{ui().searchResultsFor}{" "}
                        </Show>
                        <strong class="ba-text-primary">{filteredRoutes().length}</strong> {ui().itemsCount}
                    </span>
                    <button
                        type="button"
                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                        onClick={() => {
                            setSearchQuery("");
                            setSelectedCategory("all");
                        }}
                    >
                        {ui().showAll}
                    </button>
                </div>
            </Show>

            {/* 検索結果が0件の時のEmpty state */}
            <Show when={filteredRoutes().length === 0}>
                <div class="ba-card ba-text-center" style={{ "max-width": "28rem", margin: "1.5rem auto", padding: "2rem" }}>
                    <div class="ba-flex ba-justify-center ba-text-muted" style={{ "margin-bottom": "0.75rem" }} aria-hidden="true">
                        <ToolIcon name="search" class="ba-icon-xl" />
                    </div>
                    <h2 class="ba-section-title" style={{ "margin-bottom": "0.5rem" }}>
                        {ui().noToolsFound}
                    </h2>
                    <p class="ba-text-xs ba-text-muted" style={{ "margin-bottom": "1rem" }}>
                        {searchQuery().trim()
                            ? `「${searchQuery()}」 - ${ui().noToolsFoundHint}`
                            : ui().noToolsFoundHint}
                    </p>
                    <div class="ba-flex ba-items-center ba-justify-center ba-gap-2">
                        <Show when={searchQuery().trim()}>
                            <button type="button" class="ba-btn ba-btn--sm ba-btn--outline" onClick={() => setSearchQuery("")}>
                                {ui().clearSearch}
                            </button>
                        </Show>
                        <Show when={selectedCategory() !== "all"}>
                            <button type="button" class="ba-btn ba-btn--sm ba-btn--primary" onClick={() => setSelectedCategory("all")}>
                                {ui().showAllCategories}
                            </button>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* ツール一覧グリッド */}
            <Show when={filteredRoutes().length > 0}>
                <div class="ba-grid-3">
                    <For each={gridItems()}>
                        {(item) => (
                            <Show
                                when={item.type === "tool"}
                                fallback={
                                    <div class="ba-card ba-tool-card">
                                        <div>
                                            <div class="ba-flex ba-items-center ba-justify-between" style={{ "margin-bottom": "0.5rem" }}>
                                                <span class="ba-badge ba-badge--neutral">{ui().sponsorBadge}</span>
                                                <span class="ba-text-xs ba-text-muted">ADVERTISEMENT</span>
                                            </div>
                                            <div class="ba-flex ba-items-center ba-justify-center ba-w-full" style={{ "min-height": "140px", overflow: "hidden" }}>
                                                <AdSense />
                                            </div>
                                        </div>
                                        <div class="ba-flex ba-justify-end" style={{ "padding-top": "0.5rem" }}>
                                            <span class="ba-text-xs ba-text-muted">{ui().supportFreeTools}</span>
                                        </div>
                                    </div>
                                }
                            >
                                {(() => {
                                    const route = (item as { type: "tool"; route: Route }).route;
                                    const meta = () => getLocalizedRouteMeta(route.path, currentLocale());
                                    const isFav = () => getFavorites().includes(route.path);
                                    const catInfo = () => getToolCategory(route.path);
                                    const localizedHref = () => getPathWithLocale(route.path, currentLocale());

                                    return (
                                        <div class="ba-card ba-tool-card">
                                            <div>
                                                <div class="ba-flex ba-items-start ba-justify-between ba-gap-2" style={{ "margin-bottom": "0.75rem" }}>
                                                    <div class="ba-flex ba-items-center ba-gap-3 ba-min-w-0">
                                                        <span class="ba-icon-box" aria-hidden="true">
                                                            <ToolIcon name={getToolIcon(route.path)} class="ba-icon-md" />
                                                        </span>
                                                        <div class="ba-min-w-0">
                                                            <h2 class="ba-section-title ba-truncate" style={{ "font-size": "1.05rem" }}>
                                                                {meta().title}
                                                            </h2>
                                                            <span
                                                                class={catInfo().badgeClass}
                                                                style={{ "margin-top": "0.2rem" }}
                                                            >
                                                                {getLocalizedCategoryName(catInfo().id)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-btn--square ba-shrink-0"
                                                        style={{ color: isFav() ? "#f59e0b" : "var(--ba-text-subtle)" }}
                                                        onClick={() => toggleFavorite(route.path)}
                                                        aria-label={
                                                            isFav()
                                                                ? `${meta().title} - ${ui().unpinTool}`
                                                                : `${meta().title} - ${ui().pinTool}`
                                                        }
                                                    >
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            viewBox="0 0 24 24"
                                                            class="ba-icon-sm"
                                                            fill={isFav() ? "currentColor" : "none"}
                                                            stroke="currentColor"
                                                            stroke-width="2"
                                                            aria-hidden="true"
                                                        >
                                                            <path
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <p class="ba-text-sm ba-text-muted" style={{ "margin-top": 0, "margin-bottom": "1rem", "line-height": "1.6" }}>
                                                    {meta().description || "Free online tool"}
                                                </p>
                                            </div>

                                            <div class="ba-flex ba-justify-end">
                                                <a
                                                    href={localizedHref()}
                                                    class="ba-btn ba-btn--primary ba-btn--sm"
                                                    aria-label={`${meta().title} - ${ui().tryTool}`}
                                                >
                                                    {ui().tryTool}
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </Show>
                        )}
                    </For>
                </div>
            </Show>

            <AdSense />
        </div>
    );
}

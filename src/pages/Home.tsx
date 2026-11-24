import { For, Show, createSignal, createMemo, onSettled } from "solid-js";
import { routes, type Route } from "../routes";
import AdSense from "../components/AdSense";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import { filterRoutesByQuery } from "../utils/search";
import { getFavorites, toggleFavorite } from "../utils/favorites";
import {
    CATEGORIES,
    TOOL_CATEGORIES_CONFIG,
    type ToolCategoryId,
    getToolIcon,
    getToolCategory,
    getRoutesByCategory,
} from "../utils/categories";

type HomeGridItem =
    | { type: "tool"; route: Route }
    | { type: "ad"; id: string };

export default function Home() {
    let containerRef: HTMLDivElement | undefined;
    const [searchQuery, setSearchQuery] = createSignal("");
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

    const filteredRoutes = createMemo(() =>
        filterRoutesByQuery(categoryRoutes(), searchQuery())
    );

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

    return (
        <div ref={containerRef} class="ba-page">
            <header class="ba-home-header">
                <div>
                    <h1 class="ba-title">Webツール一覧</h1>
                    <p class="ba-text-sm ba-text-muted" style={{ "margin-top": "0.35rem", "margin-bottom": 0 }}>
                        日常やWeb制作・開発に役立つ高品質な便利ツールを完全無料でご利用いただけます。
                    </p>
                </div>

                {/* トップページ用ツール検索バー */}
                <div class="ba-search-box">
                    <label for="home-tool-search" class="ba-sr-only">
                        ツールを検索
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
                            placeholder="ツール名やキーワードで検索..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            aria-label="ツールを検索"
                        />
                        <Show when={searchQuery().trim()}>
                            <button
                                type="button"
                                class="ba-input-clear"
                                onClick={() => setSearchQuery("")}
                                aria-label="検索キーワードをクリア"
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
                                <span>{cat.name}</span>
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
                                {CATEGORIES.find((c) => c.id === selectedCategory())?.name}
                            </span>
                        </Show>
                        <Show when={searchQuery().trim()}>
                            「<strong style={{ color: "var(--ba-text)" }}>{searchQuery().trim()}</strong>」の検索結果:{" "}
                        </Show>
                        <strong class="ba-text-primary">{filteredRoutes().length}</strong> 件
                    </span>
                    <button
                        type="button"
                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                        onClick={() => {
                            setSearchQuery("");
                            setSelectedCategory("all");
                        }}
                    >
                        すべて表示
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
                        ツールが見つかりませんでした
                    </h2>
                    <p class="ba-text-xs ba-text-muted" style={{ "margin-bottom": "1rem" }}>
                        {searchQuery().trim()
                            ? `「${searchQuery()}」に一致するツールは見つかりませんでした。別のキーワードでお試しください。`
                            : "このカテゴリに一致するツールはありません。"}
                    </p>
                    <div class="ba-flex ba-items-center ba-justify-center ba-gap-2">
                        <Show when={searchQuery().trim()}>
                            <button type="button" class="ba-btn ba-btn--sm ba-btn--outline" onClick={() => setSearchQuery("")}>
                                検索をクリア
                            </button>
                        </Show>
                        <Show when={selectedCategory() !== "all"}>
                            <button type="button" class="ba-btn ba-btn--sm ba-btn--primary" onClick={() => setSelectedCategory("all")}>
                                すべてのカテゴリを表示
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
                                                <span class="ba-badge ba-badge--neutral">スポンサー</span>
                                                <span class="ba-text-xs ba-text-muted">ADVERTISEMENT</span>
                                            </div>
                                            <div class="ba-flex ba-items-center ba-justify-center ba-w-full" style={{ "min-height": "140px", overflow: "hidden" }}>
                                                <AdSense />
                                            </div>
                                        </div>
                                        <div class="ba-flex ba-justify-end" style={{ "padding-top": "0.5rem" }}>
                                            <span class="ba-text-xs ba-text-muted">無料ツールの運営を支援</span>
                                        </div>
                                    </div>
                                }
                            >
                                {(() => {
                                    const route = (item as { type: "tool"; route: Route }).route;
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
                                                                {route.title}
                                                            </h2>
                                                            <span
                                                                class={getToolCategory(route.path).badgeClass}
                                                                style={{ "margin-top": "0.2rem" }}
                                                            >
                                                                {getToolCategory(route.path).name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-btn--square ba-shrink-0"
                                                        style={{ color: getFavorites().includes(route.path) ? "#f59e0b" : "var(--ba-text-subtle)" }}
                                                        onClick={() => toggleFavorite(route.path)}
                                                        aria-label={
                                                            getFavorites().includes(route.path)
                                                                ? `${route.title}のピン留めを解除`
                                                                : `${route.title}をピン留め`
                                                        }
                                                    >
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            viewBox="0 0 24 24"
                                                            class="ba-icon-sm"
                                                            fill={getFavorites().includes(route.path) ? "currentColor" : "none"}
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
                                                    {route.description || "便利なツールです"}
                                                </p>
                                            </div>

                                            <div class="ba-flex ba-justify-end">
                                                <a
                                                    href={route.path}
                                                    class="ba-btn ba-btn--primary ba-btn--sm"
                                                    aria-label={`${route.title} を使ってみる`}
                                                >
                                                    使ってみる →
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

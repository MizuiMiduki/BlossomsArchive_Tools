import { For, Show, createSignal, createMemo, onSettled } from "solid-js";
import { routes, type Route } from "../routes";
import AdSense from "../components/AdSense";
import { playPageEntrance } from "../utils/animations";
import { filterRoutesByQuery } from "../utils/search";

type HomeGridItem =
    | { type: "tool"; route: Route }
    | { type: "ad"; id: string };

export default function Home() {
    let containerRef: HTMLDivElement | undefined;
    const [searchQuery, setSearchQuery] = createSignal("");

    const availableRoutes = createMemo(() =>
        routes.filter((r) => r.path !== "/" && !r.hidden)
    );

    const filteredRoutes = createMemo(() =>
        filterRoutesByQuery(availableRoutes(), searchQuery())
    );

    // ツールカードの合間にデザインの揃った広告カードを挿入
    const gridItems = createMemo<HomeGridItem[]>(() => {
        const list = filteredRoutes();
        const items: HomeGridItem[] = [];

        list.forEach((route, idx) => {
            items.push({ type: "tool", route });
            // 6項目ごとにインフィード広告カードを挿入（カードのデザイン・サイズ感をツールカードと完全統一）
            if ((idx + 1) % 6 === 0 && idx + 1 < list.length) {
                items.push({ type: "ad", id: `infeed-ad-${idx}` });
            }
        });

        return items;
    });

    onSettled(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".card");
        }
    });

    return (
        <div ref={containerRef} class="max-w-5xl mx-auto space-y-6 sm:space-y-8 min-w-0 w-full">
            <header class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4 sm:mb-6">
                <div>
                    <h1 class="text-xl sm:text-2xl md:text-3xl font-black text-base-content dark:text-white">
                        Webツール一覧
                    </h1>
                    <p class="text-xs sm:text-sm text-base-content/85 mt-1 sm:mt-2">
                        日常やWeb制作・開発に役立つ高品質な便利ツールを完全無料でご利用いただけます。
                    </p>
                </div>

                {/* トップページ用ツール検索バー */}
                <div class="relative w-full sm:w-72 shrink-0">
                    <label for="home-tool-search" class="sr-only">
                        ツールを検索
                    </label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-base-content/60">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </span>
                        <input
                            id="home-tool-search"
                            type="search"
                            class="input input-bordered input-sm sm:input-md w-full !pl-11 !pr-9 rounded-xl bg-base-100 focus:outline-primary transition-all text-xs sm:text-sm"
                            style={{ "padding-left": "2.75rem", "padding-right": "2.25rem" }}
                            placeholder="ツール名やキーワードで検索..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            aria-label="ツールを検索"
                        />
                        <Show when={searchQuery().trim()}>
                            <button
                                type="button"
                                class="absolute inset-y-0 right-0 flex items-center pr-3 text-base-content/60 hover:text-base-content transition-colors"
                                onClick={() => setSearchQuery("")}
                                aria-label="検索キーワードをクリア"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </Show>
                    </div>
                </div>
            </header>

            {/* 検索結果件数表示（検索時のみ） */}
            <Show when={searchQuery().trim()}>
                <div class="flex items-center justify-between text-xs text-base-content/70 px-1">
                    <span>
                        「<span class="font-bold text-base-content">{searchQuery().trim()}</span>」の検索結果:{" "}
                        <span class="font-bold text-primary">{filteredRoutes().length}</span> 件
                    </span>
                    <button
                        type="button"
                        class="text-xs text-primary hover:underline"
                        onClick={() => setSearchQuery("")}
                    >
                        すべて表示
                    </button>
                </div>
            </Show>

            {/* 検索結果が0件の時のEmpty state */}
            <Show when={filteredRoutes().length === 0}>
                <div class="card bg-base-100 border border-base-300 p-8 text-center max-w-md mx-auto my-8 shadow-xs">
                    <div class="text-4xl mb-3" aria-hidden="true">
                        🔍
                    </div>
                    <h2 class="text-base sm:text-lg font-bold text-base-content mb-1">
                        ツールが見つかりませんでした
                    </h2>
                    <p class="text-xs text-base-content/60 mb-4 leading-relaxed">
                        「{searchQuery()}」に一致するツールは見つかりませんでした。別のキーワードでお試しください。
                    </p>
                    <button
                        type="button"
                        class="btn btn-sm btn-ghost border-base-300 mx-auto"
                        onClick={() => setSearchQuery("")}
                    >
                        検索をクリア
                    </button>
                </div>
            </Show>

            {/* ツール一覧グリッド（項目の間にデザインの揃った広告カードを自然に配置） */}
            <Show when={filteredRoutes().length > 0}>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <For each={gridItems()}>
                        {(item) => (
                            <Show
                                when={item.type === "tool"}
                                fallback={
                                    /* ツールカードと枠線・背景・サイズ感を統一したインフィード広告カード */
                                    <div class="card bg-base-100 border border-base-300 shadow-sm min-w-0 flex flex-col justify-between">
                                        <div class="card-body p-4 sm:p-6 flex flex-col justify-between h-full">
                                            <div>
                                                <div class="flex items-center justify-between mb-2">
                                                    <span class="badge badge-sm badge-ghost border-base-300 text-base-content/70 font-medium text-[10px]">
                                                        スポンサー
                                                    </span>
                                                    <span class="text-[10px] text-base-content/60 tracking-wider">
                                                        ADVERTISEMENT
                                                    </span>
                                                </div>
                                                <div class="min-h-[140px] flex items-center justify-center overflow-hidden w-full">
                                                    <AdSense />
                                                </div>
                                            </div>
                                            <div class="card-actions justify-end mt-auto pt-2">
                                                <span class="text-[11px] text-base-content/60">
                                                    無料ツールの運営を支援
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                }
                            >
                                {(() => {
                                    const route = (item as { type: "tool"; route: Route }).route;
                                    return (
                                        <div class="card bg-base-100 border border-base-300 shadow-sm min-w-0 flex flex-col">
                                            <div class="card-body p-4 sm:p-6 flex flex-col justify-between h-full">
                                                <div>
                                                    <h2 class="card-title text-base sm:text-lg font-black text-base-content dark:text-white">
                                                        {route.title}
                                                    </h2>
                                                    <p class="text-xs sm:text-sm text-base-content/85 leading-relaxed mb-4">
                                                        {route.description || "便利なツールです"}
                                                    </p>
                                                </div>

                                                <div class="card-actions justify-end mt-auto">
                                                    <a
                                                        href={route.path}
                                                        class="btn btn-primary btn-sm px-4 sm:px-6"
                                                        aria-label={`${route.title} を使ってみる`}
                                                    >
                                                        使ってみる →
                                                    </a>
                                                </div>
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

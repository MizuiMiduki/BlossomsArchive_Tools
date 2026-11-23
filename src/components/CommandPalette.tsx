import { For, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { routes, type Route } from "../routes";
import { filterRoutesByQuery } from "../utils/search";
import { getFavorites, toggleFavorite } from "../utils/favorites";

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CommandPalette(props: CommandPaletteProps) {
    const [query, setQuery] = createSignal("");
    const [selectedIndex, setSelectedIndex] = createSignal(0);
    let inputRef: HTMLInputElement | undefined;

    // 非表示ルート（hidden）を除外
    const availableRoutes = createMemo(() => routes.filter((r) => !r.hidden));

    // 検索結果
    const filteredRoutes = createMemo(() => {
        const q = query().trim();
        if (!q) {
            // クエリが空のときはお気に入りがあれば先頭にし、全ルートを表示
            const favs = getFavorites();
            return [...availableRoutes()].sort((a, b) => {
                const aFav = favs.includes(a.path) ? 1 : 0;
                const bFav = favs.includes(b.path) ? 1 : 0;
                return bFav - aFav;
            });
        }
        return filterRoutesByQuery(availableRoutes(), q);
    });

    // 検索結果が変わったらインデックスをリセット
    createEffect(
        () => filteredRoutes().length,
        () => {
            setSelectedIndex(0);
        }
    );

    // モーダルオープン時に入力欄へフォーカス
    createEffect(
        () => props.isOpen,
        (open) => {
            if (open) {
                setQuery("");
                setSelectedIndex(0);
                setTimeout(() => inputRef?.focus(), 50);
            }
        }
    );

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!props.isOpen) return;

        if (e.key === "Escape") {
            e.preventDefault();
            props.onClose();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            const max = filteredRoutes().length;
            if (max > 0) {
                setSelectedIndex((prev) => (prev + 1) % max);
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const max = filteredRoutes().length;
            if (max > 0) {
                setSelectedIndex((prev) => (prev - 1 + max) % max);
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            const target = filteredRoutes()[selectedIndex()];
            if (target) {
                props.onClose();
                window.location.href = target.path;
            }
        }
    };

    onSettled(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    });

    const getCategoryBadge = (category?: Route["applicationCategory"]) => {
        switch (category) {
            case "UtilityApplication":
                return { text: "便利ツール", class: "badge-primary" };
            case "DeveloperApplication":
                return { text: "開発者", class: "badge-secondary" };
            case "DesignApplication":
                return { text: "デザイン", class: "badge-accent" };
            case "MultimediaApplication":
                return { text: "メディア", class: "badge-neutral" };
            default:
                return { text: "基本", class: "badge-ghost" };
        }
    };

    return (
        <Show when={props.isOpen}>
            <div
                class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs transition-opacity"
                onClick={(e) => {
                    if (e.target === e.currentTarget) props.onClose();
                }}
                role="dialog"
                aria-modal="true"
                aria-label="コマンドパレット"
            >
                <div class="w-full max-w-xl bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden flex flex-col max-h-[75vh]">
                    {/* 検索入力ヘッダー */}
                    <div class="flex items-center px-4 py-3 border-b border-base-300 gap-3">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-5 h-5 text-base-content/60 shrink-0"
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
                        <input
                            ref={inputRef}
                            type="search"
                            class="w-full bg-transparent text-base-content text-base outline-none placeholder:text-base-content/60"
                            placeholder="ツール名、キーワード、機能で検索..."
                            value={query()}
                            onInput={(e) => setQuery(e.currentTarget.value)}
                            aria-label="ツールクイック検索"
                        />
                        <button
                            type="button"
                            onClick={props.onClose}
                            class="btn btn-ghost btn-xs btn-square shrink-0 text-base-content/60"
                            aria-label="検索を閉じる"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* リスト領域 */}
                    <div class="flex-1 overflow-y-auto p-2 space-y-1">
                        <Show
                            when={filteredRoutes().length > 0}
                            fallback={
                                <div class="py-12 text-center text-sm text-base-content/60">
                                    一致するツールが見つかりませんでした
                                </div>
                            }
                        >
                            <For each={filteredRoutes()}>
                                {(route, idx) => {
                                    const isFav = () => getFavorites().includes(route.path);
                                    const badge = getCategoryBadge(route.applicationCategory);
                                    const isSelected = () => idx() === selectedIndex();

                                    return (
                                        <div
                                            class={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                                                isSelected()
                                                    ? "bg-primary text-primary-content font-medium"
                                                    : "hover:bg-base-200 text-base-content"
                                            }`}
                                            onClick={() => {
                                                props.onClose();
                                                window.location.href = route.path;
                                            }}
                                            onMouseEnter={() => setSelectedIndex(idx())}
                                        >
                                            <div class="flex items-center gap-3 min-w-0">
                                                <button
                                                    type="button"
                                                    class={`btn btn-ghost btn-xs btn-square shrink-0 ${
                                                        isFav()
                                                            ? isSelected()
                                                                ? "text-yellow-300"
                                                                : "text-amber-500"
                                                            : isSelected()
                                                              ? "text-primary-content/60"
                                                              : "text-base-content/60 hover:text-base-content"
                                                    }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFavorite(route.path);
                                                    }}
                                                    aria-label={isFav() ? `${route.title}のピン留めを解除` : `${route.title}をピン留め`}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 24 24"
                                                        class="w-4 h-4"
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
                                                <div class="truncate">
                                                    <div class="flex items-center gap-2">
                                                        <span class="font-bold truncate text-sm">{route.title}</span>
                                                        <span class={`badge badge-xs text-[10px] ${badge.class}`}>
                                                            {badge.text}
                                                        </span>
                                                    </div>
                                                    <p
                                                        class={`text-xs truncate ${
                                                            isSelected() ? "text-primary-content/80" : "text-base-content/60"
                                                        }`}
                                                    >
                                                        {route.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div class="shrink-0 pl-2">
                                                <span
                                                    class={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                                                        isSelected() ? "bg-white/20 text-white" : "bg-base-200 text-base-content/60"
                                                    }`}
                                                >
                                                    Enter
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </Show>
                    </div>

                    {/* フッターヒント */}
                    <div class="flex items-center justify-between px-4 py-2 border-t border-base-300 text-[11px] text-base-content/60 bg-base-200/50">
                        <div class="flex items-center gap-3">
                            <span><kbd class="kbd kbd-xs">↑</kbd> <kbd class="kbd kbd-xs">↓</kbd> 移動</span>
                            <span><kbd class="kbd kbd-xs">Enter</kbd> 選択</span>
                            <span><kbd class="kbd kbd-xs">ESC</kbd> 閉じる</span>
                        </div>
                        <div>
                            <span>お気に入りは <kbd class="kbd kbd-xs">★</kbd> で固定</span>
                        </div>
                    </div>
                </div>
            </div>
        </Show>
    );
}

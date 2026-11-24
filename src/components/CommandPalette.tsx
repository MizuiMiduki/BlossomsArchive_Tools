import { For, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import { routes, type Route } from "../routes";
import { filterRoutesByQuery } from "../utils/search";
import { getFavorites, toggleFavorite } from "../utils/favorites";
import ToolIcon from "./ToolIcon";

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CommandPalette(props: CommandPaletteProps) {
    const [query, setQuery] = createSignal("");
    const [selectedIndex, setSelectedIndex] = createSignal(0);
    let inputRef: HTMLInputElement | undefined;

    const availableRoutes = createMemo(() => routes.filter((r) => !r.hidden));

    const filteredRoutes = createMemo(() => {
        const q = query().trim();
        if (!q) {
            const favs = getFavorites();
            return [...availableRoutes()].sort((a, b) => {
                const aFav = favs.includes(a.path) ? 1 : 0;
                const bFav = favs.includes(b.path) ? 1 : 0;
                return bFav - aFav;
            });
        }
        return filterRoutesByQuery(availableRoutes(), q);
    });

    createEffect(
        () => filteredRoutes().length,
        () => {
            setSelectedIndex(0);
        }
    );

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
                return { text: "便利ツール", class: "ba-badge ba-badge--utility" };
            case "DeveloperApplication":
                return { text: "開発者", class: "ba-badge ba-badge--developer" };
            case "DesignApplication":
                return { text: "デザイン", class: "ba-badge ba-badge--camera" };
            case "MultimediaApplication":
                return { text: "メディア", class: "ba-badge ba-badge--audio" };
            default:
                return { text: "基本", class: "ba-badge ba-badge--neutral" };
        }
    };

    return (
        <Show when={props.isOpen}>
            <div
                class="ba-palette-backdrop"
                onClick={(e) => {
                    if (e.target === e.currentTarget) props.onClose();
                }}
                role="dialog"
                aria-modal="true"
                aria-label="コマンドパレット"
            >
                <div class="ba-palette-panel">
                    {/* 検索入力ヘッダー */}
                    <div
                        class="ba-flex ba-items-center ba-gap-3"
                        style={{ padding: "0.75rem 1rem", "border-bottom": "1px solid var(--ba-border)" }}
                    >
                        <ToolIcon name="search" class="ba-icon-md ba-shrink-0 ba-text-muted" />
                        <input
                            ref={inputRef}
                            type="search"
                            class="ba-flex-1 ba-text-base"
                            style={{ background: "transparent", border: "none", outline: "none" }}
                            placeholder="ツール名、キーワード、機能で検索..."
                            value={query()}
                            onInput={(e) => setQuery(e.currentTarget.value)}
                            aria-label="ツールクイック検索"
                        />
                        <button
                            type="button"
                            onClick={props.onClose}
                            class="ba-btn ba-btn--ghost ba-btn--xs ba-btn--square"
                            aria-label="検索を閉じる"
                        >
                            ×
                        </button>
                    </div>

                    {/* リスト領域 */}
                    <div class="ba-flex-1 ba-scroll-y ba-stack-1" style={{ padding: "0.5rem" }}>
                        <Show
                            when={filteredRoutes().length > 0}
                            fallback={
                                <div class="ba-text-center ba-text-sm ba-text-muted" style={{ padding: "3rem 1rem" }}>
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
                                            class={`ba-palette-item ${isSelected() ? "is-selected" : ""}`}
                                            onClick={() => {
                                                props.onClose();
                                                window.location.href = route.path;
                                            }}
                                            onMouseEnter={() => setSelectedIndex(idx())}
                                        >
                                            <div class="ba-flex ba-items-center ba-gap-2 ba-min-w-0 ba-flex-1">
                                                <button
                                                    type="button"
                                                    class="ba-btn ba-btn--ghost ba-btn--xs ba-btn--square ba-shrink-0"
                                                    style={{ color: isFav() ? "#f59e0b" : undefined }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFavorite(route.path);
                                                    }}
                                                    aria-label={isFav() ? `${route.title}のピン留めを解除` : `${route.title}をピン留め`}
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
                                                <div class="ba-min-w-0 ba-flex-1">
                                                    <div class="ba-flex ba-items-center ba-gap-2">
                                                        <span class="ba-font-bold ba-text-sm ba-truncate">{route.title}</span>
                                                        <span class={badge.class}>{badge.text}</span>
                                                    </div>
                                                    <p class="ba-text-xs ba-truncate ba-text-muted" style={{ margin: 0 }}>
                                                        {route.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <span class="ba-kbd ba-shrink-0">Enter</span>
                                        </div>
                                    );
                                }}
                            </For>
                        </Show>
                    </div>

                    {/* フッターヒント */}
                    <div
                        class="ba-flex ba-items-center ba-justify-between ba-text-xs ba-text-muted"
                        style={{
                            padding: "0.5rem 1rem",
                            "border-top": "1px solid var(--ba-border)",
                            "background-color": "var(--ba-surface-2)",
                        }}
                    >
                        <div class="ba-flex ba-items-center ba-gap-3">
                            <span><kbd class="ba-kbd">↑</kbd> <kbd class="ba-kbd">↓</kbd> 移動</span>
                            <span><kbd class="ba-kbd">Enter</kbd> 選択</span>
                            <span><kbd class="ba-kbd">ESC</kbd> 閉じる</span>
                        </div>
                        <span>お気に入りは ★ で固定</span>
                    </div>
                </div>
            </div>
        </Show>
    );
}

import { createSignal } from "solid-js";

const FAVORITES_STORAGE_KEY = "ba_tools_favorites";

function readFavoritesFromStorage(): string[] {
    if (typeof window === "undefined" || !window.localStorage) return [];
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.filter((item): item is string => typeof item === "string");
        }
    } catch {
        // パース失敗時は空配列
    }
    return [];
}

let cachedFavorites: string[] = readFavoritesFromStorage();
const [favoritesSignal, setFavoritesSignal] = createSignal<string[]>(cachedFavorites);

export function getFavorites(): string[] {
    // リアクティブ追跡用にシグナルを購読
    try {
        favoritesSignal();
    } catch {
        // 非リアクティブ環境でも安全
    }
    return [...cachedFavorites];
}

export function isFavorite(path: string): boolean {
    return getFavorites().includes(path);
}

export function toggleFavorite(path: string): boolean {
    if (cachedFavorites.includes(path)) {
        cachedFavorites = cachedFavorites.filter((p) => p !== path);
    } else {
        cachedFavorites = [...cachedFavorites, path];
    }
    setFavoritesSignal([...cachedFavorites]);

    if (typeof window !== "undefined" && window.localStorage) {
        try {
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(cachedFavorites));
        } catch {
            // ストレージ書き込みエラーは無視
        }
    }
    return cachedFavorites.includes(path);
}

export function resetFavoritesForTesting(): void {
    cachedFavorites = [];
    setFavoritesSignal([]);
    if (typeof window !== "undefined" && window.localStorage) {
        try {
            localStorage.removeItem(FAVORITES_STORAGE_KEY);
        } catch {
            // エラー無視
        }
    }
}

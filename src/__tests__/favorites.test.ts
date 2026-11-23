import { describe, it, expect, beforeEach } from "vitest";
import {
    getFavorites,
    isFavorite,
    toggleFavorite,
    resetFavoritesForTesting,
} from "../utils/favorites";

describe("favorites utility", () => {
    beforeEach(() => {
        resetFavoritesForTesting();
    });

    it("初期状態ではお気に入りは空であること", () => {
        expect(getFavorites()).toEqual([]);
        expect(isFavorite("/calculator")).toBe(false);
    });

    it("toggleFavoriteでお気に入りの追加と削除ができること", () => {
        const added = toggleFavorite("/calculator");
        expect(added).toBe(true);
        expect(isFavorite("/calculator")).toBe(true);
        expect(getFavorites()).toContain("/calculator");

        const removed = toggleFavorite("/calculator");
        expect(removed).toBe(false);
        expect(isFavorite("/calculator")).toBe(false);
        expect(getFavorites()).not.toContain("/calculator");
    });

    it("複数のお気に入りを管理できること", () => {
        toggleFavorite("/calculator");
        toggleFavorite("/qr_code");
        expect(getFavorites()).toEqual(["/calculator", "/qr_code"]);

        toggleFavorite("/calculator");
        expect(getFavorites()).toEqual(["/qr_code"]);
    });
});

import { describe, it, expect } from "vitest";
import {
    CATEGORIES,
    TOOL_CATEGORIES_CONFIG,
    getToolIcon,
    getToolCategory,
    getRoutesByCategory,
} from "../utils/categories";
import { routes } from "../routes";

describe("categories utility", () => {
    it("定義されたカテゴリが正しく取得できること", () => {
        expect(CATEGORIES.length).toBe(5);
        expect(CATEGORIES.map((c) => c.id)).toEqual([
            "all",
            "camera",
            "utility",
            "developer",
            "audio",
        ]);
    });

    it("ツールのパスから対応するアイコンとカテゴリを取得できること", () => {
        expect(getToolIcon("/calculator")).toBe("calculator");
        expect(getToolIcon("/exposure-calculator")).toBe("camera");
        expect(getToolIcon("/json-formatter")).toBe("code");
        expect(getToolIcon("/bpm-calculator")).toBe("music");

        expect(getToolCategory("/calculator").id).toBe("utility");
        expect(getToolCategory("/exposure-calculator").id).toBe("camera");
        expect(getToolCategory("/json-formatter").id).toBe("developer");
        expect(getToolCategory("/bpm-calculator").id).toBe("audio");
    });

    it("getRoutesByCategory でカテゴリに応じた絞り込みができること", () => {
        const nonHiddenRoutes = routes.filter((r) => r.path !== "/" && !r.hidden);

        const all = getRoutesByCategory(nonHiddenRoutes, "all");
        expect(all.length).toBe(nonHiddenRoutes.length);

        const camera = getRoutesByCategory(nonHiddenRoutes, "camera");
        expect(camera.length).toBeGreaterThanOrEqual(6);
        expect(camera.some((r) => r.path === "/exposure-calculator")).toBe(true);

        const developer = getRoutesByCategory(nonHiddenRoutes, "developer");
        expect(developer.length).toBeGreaterThanOrEqual(6);
        expect(developer.some((r) => r.path === "/json-formatter")).toBe(true);
    });
});

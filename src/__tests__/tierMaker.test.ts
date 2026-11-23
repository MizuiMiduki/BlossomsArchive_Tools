import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    getContrastTextColor,
    generateTierId,
    cycleSubTier,
    getSubTierInfo,
    renderTierListToCanvas,
    DEFAULT_TIERS,
    PRESET_COLORS,
    type TierListState,
} from "../utils/tierMaker";

describe("tierMaker utility tests", () => {
    describe("getContrastTextColor", () => {
        it("明るい背景色には黒 (#111827) を返すこと", () => {
            expect(getContrastTextColor("#ffffff")).toBe("#111827");
            expect(getContrastTextColor("#ffff00")).toBe("#111827");
            expect(getContrastTextColor("#ffff7f")).toBe("#111827");
            expect(getContrastTextColor("#7fff7f")).toBe("#111827");
            expect(getContrastTextColor("fff")).toBe("#111827");
        });

        it("暗い背景色には白 (#ffffff) を返すこと", () => {
            expect(getContrastTextColor("#000000")).toBe("#ffffff");
            expect(getContrastTextColor("#111827")).toBe("#ffffff");
            expect(getContrastTextColor("#374151")).toBe("#ffffff");
            expect(getContrastTextColor("#1e3a8a")).toBe("#ffffff");
            expect(getContrastTextColor("000")).toBe("#ffffff");
        });

        it("不正なカラーコードの場合もクラッシュせず安全にフォールバックすること", () => {
            expect(getContrastTextColor("invalid")).toBe("#111827");
            expect(getContrastTextColor("")).toBe("#111827");
            expect(getContrastTextColor("#zzz")).toBe("#111827");
        });
    });

    describe("generateTierId", () => {
        it("指定したプレフィックスを含むユニークIDを生成すること", () => {
            const id1 = generateTierId("tier");
            const id2 = generateTierId("tier");
            expect(id1.startsWith("tier-")).toBe(true);
            expect(id2.startsWith("tier-")).toBe(true);
            expect(id1).not.toBe(id2);
        });
    });

    describe("cycleSubTier", () => {
        it("normal -> plus -> minus -> normal の順序で巡回すること", () => {
            expect(cycleSubTier("normal")).toBe("plus");
            expect(cycleSubTier("plus")).toBe("minus");
            expect(cycleSubTier("minus")).toBe("normal");
        });
    });

    describe("getSubTierInfo", () => {
        it("plus: バッジ '+' と上寄りオフセット (-8px) を返すこと", () => {
            const info = getSubTierInfo("plus");
            expect(info.badgeText).toBe("+");
            expect(info.offsetPx).toBe(-8);
            expect(info.translateYClass).toBe("-translate-y-2");
            expect(info.ariaLabel).toContain("+");
        });

        it("minus: バッジ '-' と下寄りオフセット (8px) を返すこと", () => {
            const info = getSubTierInfo("minus");
            expect(info.badgeText).toBe("-");
            expect(info.offsetPx).toBe(8);
            expect(info.translateYClass).toBe("translate-y-2");
            expect(info.ariaLabel).toContain("-");
        });

        it("normal: バッジなし、オフセット 0px を返すこと", () => {
            const info = getSubTierInfo("normal");
            expect(info.badgeText).toBe("");
            expect(info.offsetPx).toBe(0);
            expect(info.translateYClass).toBe("translate-y-0");
        });
    });

    describe("renderTierListToCanvas", () => {
        it("Canvasコンテキストが正常に呼び出され描画が完了すること", async () => {
            const mockCtx = {
                fillRect: vi.fn(),
                fillText: vi.fn(),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                stroke: vi.fn(),
                arc: vi.fn(),
                fill: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                clip: vi.fn(),
                drawImage: vi.fn(),
                scale: vi.fn(),
                measureText: vi.fn().mockReturnValue({ width: 50 }),
                roundRect: vi.fn(),
            };

            const canvas = {
                getContext: vi.fn().mockReturnValue(mockCtx),
                width: 0,
                height: 0,
            } as unknown as HTMLCanvasElement;

            const state: TierListState = {
                title: "テストティア表",
                tiers: DEFAULT_TIERS,
                items: [
                    {
                        id: "item-1",
                        type: "text",
                        tierId: "tier-s",
                        subTier: "plus",
                        label: "テストアイテム1",
                    },
                    {
                        id: "item-2",
                        type: "text",
                        tierId: "tier-a",
                        subTier: "minus",
                        label: "テストアイテム2",
                    },
                    {
                        id: "item-3",
                        type: "text",
                        tierId: null,
                        subTier: "normal",
                        label: "プール内アイテム",
                    },
                ],
            };

            await renderTierListToCanvas(canvas, state);

            expect(mockCtx.fillRect).toHaveBeenCalled();
            expect(mockCtx.fillText).toHaveBeenCalledWith(
                "テストティア表",
                expect.any(Number),
                expect.any(Number),
            );
            expect(canvas.width).toBeGreaterThan(0);
            expect(canvas.height).toBeGreaterThan(0);
        });

        it("コンテキストが取得できない場合はエラーをスローすること", async () => {
            const canvas = {
                getContext: vi.fn().mockReturnValue(null),
            } as unknown as HTMLCanvasElement;

            const state: TierListState = {
                title: "",
                tiers: [],
                items: [],
            };

            await expect(renderTierListToCanvas(canvas, state)).rejects.toThrow(
                "Canvas context is not available",
            );
        });
    });
});

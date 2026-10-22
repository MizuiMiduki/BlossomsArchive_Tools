import { describe, it, expect, vi } from "vitest";
import {
    playPageEntrance,
    animateFadeIn,
    animateStaggerIn,
    animatePop,
    delayedCall,
    setupHoverAnimation,
} from "../utils/gsapAnimations";

describe("gsapAnimations", () => {
    it("playPageEntrance が正しくタイムラインを生成すること", () => {
        const container = document.createElement("div");
        const tl = playPageEntrance(container);
        expect(tl).toBeDefined();
        expect(typeof tl.kill).toBe("function");
    });

    it("playPageEntrance で staggerTargets が指定された場合も動作すること", () => {
        const container = document.createElement("div");
        const child1 = document.createElement("div");
        child1.className = "card";
        const child2 = document.createElement("div");
        child2.className = "card";
        container.appendChild(child1);
        container.appendChild(child2);

        const tl = playPageEntrance(container, ".card");
        expect(tl).toBeDefined();
    });

    it("animateFadeIn がトゥイーンを返すこと", () => {
        const el = document.createElement("div");
        const tween = animateFadeIn(el);
        expect(tween).toBeDefined();
        expect(typeof tween.kill).toBe("function");
    });

    it("animateStaggerIn が子要素がある場合にトゥイーンを返すこと", () => {
        const container = document.createElement("div");
        const item1 = document.createElement("div");
        item1.className = "item";
        container.appendChild(item1);

        const tween = animateStaggerIn(container, ".item");
        expect(tween).not.toBeNull();
    });

    it("animateStaggerIn が子要素がない場合に null を返すこと", () => {
        const container = document.createElement("div");
        const tween = animateStaggerIn(container, ".non-existent");
        expect(tween).toBeNull();
    });

    it("animatePop がタイムラインを返すこと", () => {
        const el = document.createElement("button");
        const tl = animatePop(el);
        expect(tl).toBeDefined();
    });

    it("delayedCall がコールバックを遅延実行すること", async () => {
        const callback = vi.fn();
        const tween = delayedCall(0.01, callback);
        expect(tween).toBeDefined();

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(callback).toHaveBeenCalled();
    });

    it("setupHoverAnimation がイベントリスナを登録しクリーンアップ関数を返すこと", () => {
        const el = document.createElement("div");
        const cleanup = setupHoverAnimation(
            el,
            { scale: 1.05 },
            { scale: 1 },
        );
        expect(typeof cleanup).toBe("function");

        // イベント発火
        el.dispatchEvent(new MouseEvent("mouseenter"));
        el.dispatchEvent(new MouseEvent("mouseleave"));

        // クリーンアップ
        cleanup();
    });
});

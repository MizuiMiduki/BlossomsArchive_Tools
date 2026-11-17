import { describe, it, expect, vi } from "vitest";
import {
    playPageEntrance,
    animateFadeIn,
    animateStaggerIn,
    animatePop,
    delayedCall,
    setupHoverAnimation,
} from "../utils/animations";

describe("animations (Web Animations API)", () => {
    it("playPageEntrance がエラーなく実行されること", () => {
        const container = document.createElement("div");
        expect(() => playPageEntrance(container)).not.toThrow();
    });

    it("playPageEntrance で staggerTargets が指定された場合もエラーなく動作すること", () => {
        const container = document.createElement("div");
        const child1 = document.createElement("div");
        child1.className = "card";
        const child2 = document.createElement("div");
        child2.className = "card";
        container.appendChild(child1);
        container.appendChild(child2);

        expect(() => playPageEntrance(container, ".card")).not.toThrow();
    });

    it("animateFadeIn がエラーなく実行されること", () => {
        const el = document.createElement("div");
        expect(() => animateFadeIn(el)).not.toThrow();
    });

    it("animateStaggerIn がエラーなく実行されること", () => {
        const container = document.createElement("div");
        const item1 = document.createElement("div");
        item1.className = "item";
        container.appendChild(item1);

        expect(() => animateStaggerIn(container, ".item")).not.toThrow();
        expect(() => animateStaggerIn(container, ".non-existent")).not.toThrow();
    });

    it("animatePop がエラーなく実行されること", () => {
        const el = document.createElement("button");
        expect(() => animatePop(el)).not.toThrow();
    });

    it("delayedCall がコールバックを遅延実行すること", async () => {
        const callback = vi.fn();
        const timerId = delayedCall(0.01, callback);
        expect(timerId).toBeDefined();

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

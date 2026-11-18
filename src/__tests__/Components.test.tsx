import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRouter, memoryHistory } from "@solidjs/router";
import ToolCard from "../components/ToolCard";
import AdSense from "../components/AdSense";

describe("UI Components (ToolCard & AdSense)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.useRealTimers();
    });

    describe("ToolCard Component", () => {
        it("タイトル、説明文、リンク先が正しくレンダリングされること", () => {
            render(() => (
                <ToolCard
                    title="テスト電卓"
                    desc="四則演算ができる便利な電卓ツールです。"
                    href="/calculator"
                />
            ));

            expect(
                screen.getByRole("heading", { name: "テスト電卓" }),
            ).toBeInTheDocument();
            expect(
                screen.getByText("四則演算ができる便利な電卓ツールです。"),
            ).toBeInTheDocument();

            const link = screen.getByRole("link", { name: "開く" });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute("href", "/calculator");
        });
    });

    describe("AdSense Component", () => {
        it("VITE_ADSENSE_CLIENT_ID が未設定の場合は広告コンテナを描画しないこと", () => {
            const { container } = render(() => <AdSense />);
            expect(container.querySelector("ins")).toBeNull();
        });

        it("環境変数が設定されている場合、ユーザー操作を契機に ins 要素を生成し幅確定後に adsbygoogle.push を呼ぶこと", async () => {
            vi.useFakeTimers();
            vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "ca-pub-1234567890123456");
            vi.stubEnv("VITE_ADSENSE_DEFAULT_SLOT", "9876543210");
            vi.resetModules();

            const { default: ConfiguredAdSense } = await import(
                "../components/AdSense"
            );
            const { createRouter: createFreshRouter, memoryHistory: freshMemoryHistory } =
                await import("@solidjs/router");

            window.adsbygoogle = [];

            const AdRouter = createFreshRouter({
                history: freshMemoryHistory(),
                routes: [
                    {
                        path: "/",
                        component: () => (
                            <ConfiguredAdSense
                                slot="1122334455"
                                format="rectangle"
                                class="custom-ad-unit"
                            />
                        ),
                    },
                ],
            });

            const { container, unmount } = render(() => <AdRouter />);
            const adContainer = container.querySelector(
                ".custom-ad-unit",
            ) as HTMLDivElement;
            expect(adContainer).not.toBeNull();

            // 初期状態（ユーザー操作前）では ins はまだ生成されない
            expect(adContainer.querySelector("ins")).toBeNull();

            // コンテナ幅が 0 の状態でクリックイベントを発火
            Object.defineProperty(adContainer, "offsetWidth", {
                configurable: true,
                get: () => 0,
            });
            fireEvent.click(window);

            const ins = adContainer.querySelector("ins") as HTMLElement;
            expect(ins).not.toBeNull();
            expect(ins.className).toBe("adsbygoogle-stealth");
            expect(ins.dataset.adClient).toBe("ca-pub-1234567890123456");
            expect(ins.dataset.adSlot).toBe("1122334455");
            expect(ins.dataset.adFormat).toBe("rectangle");

            // 幅 0 の間はタイマーが経過しても push されない
            vi.advanceTimersByTime(150);
            expect(window.adsbygoogle?.length).toBe(0);

            // 幅が確定したあとにタイマーが進むと adsbygoogle クラスが付与され push される
            Object.defineProperty(adContainer, "offsetWidth", {
                configurable: true,
                get: () => 320,
            });
            vi.advanceTimersByTime(150);

            expect(ins.className).toBe("adsbygoogle");
            expect(window.adsbygoogle?.length).toBe(1);

            unmount();
        });
    });
});

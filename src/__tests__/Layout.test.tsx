import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Router, Route, useNavigate } from "@solidjs/router";
import { MetaProvider } from "@solidjs/meta";
import Layout from "../components/Layout";

describe("Layout Component", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.scrollTo = vi.fn();
    });

    it("ヘッダー、サイドバー、メインコンテンツが正常にレンダリングされること", () => {
        render(() => (
            <MetaProvider>
                <Router root={Layout}>
                    <Route path="/" component={() => <div>テストページ本文</div>} />
                </Router>
            </MetaProvider>
        ));

        expect(screen.getByText("テストページ本文")).toBeInTheDocument();
        expect(screen.getByText("BA Tools")).toBeInTheDocument();
    });

    it("ページ遷移時に main 要素の scrollTop が 0 にリセットされること", async () => {
        function PageOne() {
            const navigate = useNavigate();
            return (
                <div>
                    <div>トップページ</div>
                    <button onClick={() => navigate("/subpage")}>サブページへ移動</button>
                </div>
            );
        }

        const { container } = render(() => (
            <MetaProvider>
                <Router root={Layout}>
                    <Route path="/" component={PageOne} />
                    <Route path="/subpage" component={() => <div>サブページ本文</div>} />
                </Router>
            </MetaProvider>
        ));

        const mainElement = container.querySelector("main") as HTMLElement;
        expect(mainElement).not.toBeNull();

        // jsdom 上で scrollTop プロパティを模擬
        let currentScrollTop = 500;
        Object.defineProperty(mainElement, "scrollTop", {
            get: () => currentScrollTop,
            set: (val: number) => {
                currentScrollTop = val;
            },
            configurable: true,
        });

        // ページ遷移を実行
        const button = screen.getByText("サブページへ移動");
        fireEvent.click(button);

        expect(await screen.findByText("サブページ本文")).toBeInTheDocument();
        expect(currentScrollTop).toBe(0);
        expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    });
});

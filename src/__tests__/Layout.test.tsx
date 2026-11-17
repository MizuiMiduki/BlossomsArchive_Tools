import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouter, useNavigate, memoryHistory } from "@solidjs/router";
import Layout from "../components/Layout";

describe("Layout Component", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.scrollTo = vi.fn();
    });

    it("ヘッダー、サイドバー、メインコンテンツが正常にレンダリングされ、JSON-LDがheadに生成されること", () => {
        const TestRouter = createRouter({
            history: memoryHistory(),
            routes: [
                { path: "/", component: () => <div>テストページ本文</div> },
            ],
        });

        render(() => (
            <TestRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </TestRouter>
        ));

        expect(screen.getByText("テストページ本文")).toBeInTheDocument();
        expect(screen.getByText("BA Tools")).toBeInTheDocument();

        // JSON-LD スクリプトが head 内に生成されていること
        const jsonLdScript = document.getElementById("ba-tools-global-jsonld");
        expect(jsonLdScript).not.toBeNull();
        expect(jsonLdScript?.textContent).toContain("https://schema.org");
        expect(jsonLdScript?.textContent).toContain("BlossomsArchive Tools");
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

        const SubpageRouter = createRouter({
            history: memoryHistory(),
            routes: [
                { path: "/", component: PageOne },
                { path: "/subpage", component: () => <div>サブページ本文</div> },
            ],
        });

        const { container } = render(() => (
            <SubpageRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </SubpageRouter>
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

        // スクロール量0になったあとに遅延して広告要素が差し込まれ、スクロール位置が下に戻された場合を模擬
        currentScrollTop = 420;
        const adIns = document.createElement("ins");
        adIns.className = "adsbygoogle";
        mainElement.appendChild(adIns);
        fireEvent.scroll(mainElement);

        expect(currentScrollTop).toBe(0);
    });

    it("Threadsを含む各SNS共有ボタンが正常にレンダリングされ、正しいリンク先が設定されていること", () => {
        const ShareRouter = createRouter({
            history: memoryHistory(),
            routes: [
                { path: "/", component: () => <div>テストページ</div> },
            ],
        });

        render(() => (
            <ShareRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </ShareRouter>
        ));

        // Threads 共有ボタンの確認
        const threadsLink = screen.getByRole("link", { name: "Threads" });
        expect(threadsLink).toBeInTheDocument();
        expect(threadsLink).toHaveAttribute("target", "_blank");
        expect(threadsLink).toHaveAttribute("rel", "noopener noreferrer");
        expect(threadsLink.getAttribute("href")).toContain("https://www.threads.net/intent/post");
        expect(threadsLink.getAttribute("href")).toContain("text=");
        expect(threadsLink.getAttribute("href")).toContain("url=");

        // 他のSNS共有ボタンも確認
        expect(screen.getByRole("link", { name: "X" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Misskey" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Bluesky" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Mastodon" })).toBeInTheDocument();
    });
});

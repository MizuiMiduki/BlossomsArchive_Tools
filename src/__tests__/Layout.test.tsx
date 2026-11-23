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

    it("GA4・AdSense の外部スクリプトが初期描画やscrollでは読み込まれず、ユーザー操作時のみ1回だけ遅延注入されること", async () => {
        vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123456");
        vi.stubEnv("VITE_ADSENSE_CLIENT_ID", "ca-pub-9999999999999999");
        vi.resetModules();

        // 既存スクリプト掃除
        document
            .querySelectorAll('script[src*="googletagmanager"], script[src*="adsbygoogle"]')
            .forEach((el) => el.remove());

        const { default: FreshLayout } = await import("../components/Layout");
        const { createRouter: createFreshRouter, memoryHistory: freshHistory } =
            await import("@solidjs/router");

        const DeferredRouter = createFreshRouter({
            history: freshHistory(),
            routes: [{ path: "/", component: () => <div>遅延読込テスト</div> }],
        });

        const { unmount } = render(() => (
            <DeferredRouter>
                {(props) => <FreshLayout>{props.children}</FreshLayout>}
            </DeferredRouter>
        ));

        await Promise.resolve();

        // 初期状態では GA4 / AdSense スクリプトは注入されない
        expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
        expect(document.querySelector('script[src*="adsbygoogle"]')).toBeNull();

        // scroll イベントでは発火しないこと（LCP/TBT保護）
        fireEvent.scroll(window);
        expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
        expect(document.querySelector('script[src*="adsbygoogle"]')).toBeNull();

        // ユーザー操作（pointerdown）で1回だけ注入されること
        fireEvent.pointerDown(window);
        expect(
            document.querySelectorAll('script[src*="googletagmanager"]').length,
        ).toBe(1);
        expect(
            document.querySelectorAll('script[src*="adsbygoogle"]').length,
        ).toBe(1);

        // 2回目の操作で重複注入されないこと
        fireEvent.click(window);
        expect(
            document.querySelectorAll('script[src*="googletagmanager"]').length,
        ).toBe(1);

        unmount();
        vi.unstubAllEnvs();
    });

    it("PCサイドバーの開閉ボタン操作が localStorage に永続化されること", async () => {
        localStorage.clear();
        const SidebarRouter = createRouter({
            history: memoryHistory(),
            routes: [{ path: "/", component: () => <div>サイドバーテスト</div> }],
        });

        render(() => (
            <SidebarRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </SidebarRouter>
        ));

        const closeBtn = screen.getByRole("button", {
            name: "サイドメニューを閉じる",
        });
        fireEvent.click(closeBtn);
        await Promise.resolve();
        expect(localStorage.getItem("isPcMenuOpen")).toBe("false");

        const openBtn = screen.getByRole("button", { name: "メニューを開く" });
        fireEvent.click(openBtn);
        await Promise.resolve();
        expect(localStorage.getItem("isPcMenuOpen")).toBe("true");
    });

    it("サイドバーの検索バーでメニューをリアルタイムに絞り込めること", () => {
        const MenuSearchRouter = createRouter({
            history: memoryHistory(),
            routes: [{ path: "/", component: () => <div>メニュー検索テスト</div> }],
        });

        render(() => (
            <MenuSearchRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </MenuSearchRouter>
        ));

        const searchInput = screen.getByLabelText("メニュー内を検索");
        expect(searchInput).toBeInTheDocument();
        // アイコンとの重なり防止のため十分な左パディングが確保されていること
        expect((searchInput as HTMLInputElement).style.paddingLeft).toBe("2.25rem");

        // 「電卓」で絞り込み
        fireEvent.input(searchInput, { target: { value: "電卓" } });
        expect(screen.getByText("電卓ツール")).toBeInTheDocument();
        expect(screen.queryByText("QRコード生成")).not.toBeInTheDocument();

        // 検索クリアボタンでリセット
        const clearBtn = screen.getByLabelText("メニュー検索をクリア");
        fireEvent.click(clearBtn);
        expect(screen.getByText("QRコード生成")).toBeInTheDocument();
    });

    it("ダークモード視認性: サイドバーのタイトルおよび非アクティブリンクに高明度文字色クラスが付与されていること", () => {
        const HighContrastRouter = createRouter({
            history: memoryHistory(),
            routes: [{ path: "/", component: () => <div>視認性テスト</div> }],
        });

        render(() => (
            <HighContrastRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </HighContrastRouter>
        ));

        // タイトル
        const brandTitle = screen.getByText("BA Tools");
        expect(brandTitle.className).toContain("dark:text-white");

        // 非アクティブリンク（例: QRコード生成）
        const qrLink = screen.getByRole("link", { name: "QRコード生成" });
        expect(qrLink.className).toContain("dark:text-gray-100");
    });

    it("ヘッダーの検索ボタンクリックでコマンドパレットが開くこと", () => {
        const PaletteRouter = createRouter({
            history: memoryHistory(),
            routes: [{ path: "/", component: () => <div>パレットテスト</div> }],
        });

        render(() => (
            <PaletteRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </PaletteRouter>
        ));

        const searchBtn = screen.getByRole("button", { name: /検索/ });
        expect(searchBtn).toBeInTheDocument();
        fireEvent.click(searchBtn);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/ツール名、キーワード、機能で検索/i)).toBeInTheDocument();
    });

    it("サイドバーが通常時にカテゴリ別セクションにグループ化され、各リンクに絵文字アイコンが表示されること", () => {
        const CategorySidebarRouter = createRouter({
            history: memoryHistory(),
            routes: [{ path: "/", component: () => <div>カテゴリサイドバーテスト</div> }],
        });

        render(() => (
            <CategorySidebarRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </CategorySidebarRouter>
        ));

        // 各カテゴリ見出しが表示されていること
        expect(screen.getByText("写真・カメラ")).toBeInTheDocument();
        expect(screen.getByText("日常・便利")).toBeInTheDocument();
        expect(screen.getByText("開発者・Web")).toBeInTheDocument();
        expect(screen.getByText("音響・オーディオ")).toBeInTheDocument();

        // リンク内にアイコンが含まれていること
        const qrLink = screen.getByRole("link", { name: "QRコード生成" });
        expect(qrLink.textContent).toContain("📱");
    });
});

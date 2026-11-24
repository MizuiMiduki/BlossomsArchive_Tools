import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import Home from "../pages/Home";

describe("Home page", () => {
    it("初期レンダリングでツール検索バーおよびツールカード一覧が表示されること", () => {
        const { container } = render(() => <Home />);

        expect(screen.getByRole("heading", { level: 1, name: "Webツール一覧" })).toBeInTheDocument();

        const searchInput = screen.getByLabelText("ツールを検索");
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute("placeholder", "ツール名やキーワードで検索...");
        // アイコンとの重なり防止のためインラインスタイルおよびクラスで左パディングが確保されていること
        expect((searchInput as HTMLInputElement).style.paddingLeft).toBe("2.75rem");

        // ツールカードが複数表示されていること
        const cards = container.querySelectorAll(".card");
        expect(cards.length).toBeGreaterThanOrEqual(10);
    });

    it("ツールカードの合間にデザインの揃ったインフィード広告カード（スポンサーバッジ付き）が挿入されていること", () => {
        const { container } = render(() => <Home />);

        // スポンサーバッジ付き広告カードの確認
        const sponsorBadges = screen.getAllByText("スポンサー");
        expect(sponsorBadges.length).toBeGreaterThanOrEqual(1);

        // 広告カードがツールカードと同じ .card クラス構造を持ちデザインが揃っていること
        const adCard = sponsorBadges[0].closest(".card");
        expect(adCard).not.toBeNull();
        expect(adCard).toHaveClass("bg-base-100", "border-base-300", "shadow-sm");
    });

    it("検索バーに入力するとリアルタイムにツールが絞り込まれること", () => {
        render(() => <Home />);

        const searchInput = screen.getByLabelText("ツールを検索");

        // 「電卓」で絞り込み
        fireEvent.input(searchInput, { target: { value: "電卓" } });
        expect(screen.getByText("電卓ツール")).toBeInTheDocument();
        expect(screen.queryByText("QRコード生成")).not.toBeInTheDocument();

        // 検索結果件数メッセージが表示されること
        expect(screen.getByText(/の検索結果:/)).toBeInTheDocument();

        // クリアボタンをクリックすると元に戻ること
        const clearBtn = screen.getByLabelText("検索キーワードをクリア");
        fireEvent.click(clearBtn);
        expect(screen.getByText("QRコード生成")).toBeInTheDocument();
    });

    it("一致するツールがない場合に適切なEmpty Stateが表示され、リセットできること", () => {
        render(() => <Home />);

        const searchInput = screen.getByLabelText("ツールを検索");

        fireEvent.input(searchInput, { target: { value: "全く存在しないツール9999" } });
        expect(screen.getByText("ツールが見つかりませんでした")).toBeInTheDocument();

        // リセットボタンを押してクリアできること
        const resetBtn = screen.getByRole("button", { name: "検索をクリア" });
        fireEvent.click(resetBtn);
        expect(screen.getByText("電卓ツール")).toBeInTheDocument();
    });

    it("カテゴリタブでツールを切り替えて絞り込めること", () => {
        render(() => <Home />);

        // 写真・カメラ カテゴリを選択
        const cameraTab = screen.getByRole("tab", { name: /写真・カメラ/ });
        expect(cameraTab).toBeInTheDocument();
        fireEvent.click(cameraTab);

        // 写真系ツールが表示され、日常ツールは非表示になること
        expect(screen.getByText("カメラ露出計算機")).toBeInTheDocument();
        expect(screen.queryByText("電卓ツール")).not.toBeInTheDocument();

        // すべてタブで全件表示に戻ること
        const allTab = screen.getByRole("tab", { name: /すべて/ });
        fireEvent.click(allTab);
        expect(screen.getByText("電卓ツール")).toBeInTheDocument();
    });

    it("各ツールカードにアイコンとカテゴリバッジが表示されていること", () => {
        render(() => <Home />);

        // 電卓ツールのカード内に日常・便利バッジが存在すること
        const calcTitle = screen.getByText("電卓ツール");
        const cardBody = calcTitle.closest(".card-body");
        expect(cardBody).not.toBeNull();
        expect(cardBody?.textContent).toContain("日常・便利");
        expect(cardBody?.querySelector("svg")).not.toBeNull();
    });
});

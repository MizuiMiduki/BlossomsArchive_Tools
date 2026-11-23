import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TierMaker from "../pages/TierMaker";

describe("TierMaker Page Component Tests", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.alert = vi.fn();
        window.confirm = vi.fn().mockReturnValue(true);
        // HTMLDialogElement の showModal / close モック
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();

        // Canvas context モック
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
        HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);
        HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue("data:image/png;base64,mock");
    });

    it("初期描画時に見出し h1 とデフォルトランク (S, A, B, C, D) が描画されること", () => {
        render(() => <TierMaker />);

        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading).toHaveTextContent("ティア表作成ツール (Tier List)");

        expect(screen.getByDisplayValue("S")).toBeInTheDocument();
        expect(screen.getByDisplayValue("A")).toBeInTheDocument();
        expect(screen.getByDisplayValue("B")).toBeInTheDocument();
        expect(screen.getByDisplayValue("C")).toBeInTheDocument();
        expect(screen.getByDisplayValue("D")).toBeInTheDocument();
    });

    it("「+ ランク追加」ボタンで新しいランク行が追加されること", () => {
        render(() => <TierMaker />);

        const addTierButton = screen.getByRole("button", {
            name: "+ ランク追加",
        });
        fireEvent.click(addTierButton);

        expect(screen.getByDisplayValue("Rank 6")).toBeInTheDocument();
    });

    it("ランク追加後にリネームで連続入力しても入力要素が破棄されず値が更新されること", () => {
        render(() => <TierMaker />);

        const addTierButton = screen.getByRole("button", {
            name: "+ ランク追加",
        });
        fireEvent.click(addTierButton);

        const newTierInput = screen.getByDisplayValue("Rank 6") as HTMLInputElement;
        newTierInput.focus();

        // 1文字目入力
        fireEvent.input(newTierInput, { target: { value: "神" } });
        expect(screen.getByDisplayValue("神")).toBe(newTierInput);

        // 2文字目以降の連続入力
        fireEvent.input(newTierInput, { target: { value: "神ランク" } });
        expect(screen.getByDisplayValue("神ランク")).toBe(newTierInput);
    });

    it("ランク削除時に段が消え、アイテムが未分類プールへ安全に戻ること", () => {
        render(() => <TierMaker />);

        // 初期状態で S ランクには3つのアイテムがある
        const deleteButtons = screen.getAllByTitle("ランクを削除");
        expect(deleteButtons.length).toBeGreaterThanOrEqual(5);

        // 最初のランク（S）を削除
        fireEvent.click(deleteButtons[0]);

        // 未分類アイテムプールのカウントが増加することを確認
        expect(screen.getByText(/未分類アイテムプール \([4-9]\)/)).toBeInTheDocument();
    });

    it("テキストアイテムを追加できること", () => {
        render(() => <TierMaker />);

        const textarea = screen.getByPlaceholderText(
            "アイテム名（例: キャラ名、曲名、単語など）",
        );
        const submitButton = screen.getByRole("button", {
            name: "+ テキストを追加",
        });

        fireEvent.input(textarea, { target: { value: "新キャラX\n新キャラY" } });
        fireEvent.click(submitButton);

        expect(screen.getByText("新キャラX")).toBeInTheDocument();
        expect(screen.getByText("新キャラY")).toBeInTheDocument();
    });

    it("サブティア微調整（+ / - / 通常）の切り替えが機能すること", () => {
        render(() => <TierMaker />);

        // 初期状態の「S+ 最上位」アイテムをクリック
        const item = screen.getByText("S+ 最上位");
        fireEvent.click(item);

        // 選択アイテムの微調整ボタン
        const normalButton = screen.getByRole("button", {
            name: "選択中アイテムを中央に設定 (通常)",
        });
        fireEvent.click(normalButton);

        // サブティアが normal になりバッジが無くなるかチェック
        const minusButton = screen.getByRole("button", {
            name: "選択中アイテムを下寄りに設定 (-)",
        });
        fireEvent.click(minusButton);

        // 下寄りバッジ "-" が複数表示されること（初期データのS-と、今回のS+→S-変更分）
        const minusBadges = screen.getAllByText("-");
        expect(minusBadges.length).toBeGreaterThanOrEqual(2);
    });

    it("画像エクスポートボタン押下でプレビューモーダルが開くこと", async () => {
        render(() => <TierMaker />);

        const exportButton = screen.getByRole("button", {
            name: "画像として保存 (PNG)",
        });

        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        });
    });

    it("WebMCP form 属性とアクセシビリティ要件を満たしていること", () => {
        const { container } = render(() => <TierMaker />);

        const form = container.querySelector(
            'form[toolname="tier-list-maker"]',
        );
        expect(form).toBeInTheDocument();
        expect(form?.getAttribute("tooldescription")).toBeTruthy();

        // 見出し構造
        const h1s = screen.getAllByRole("heading", { level: 1 });
        expect(h1s.length).toBe(1);

        const h2s = screen.getAllByRole("heading", { level: 2 });
        expect(h2s.length).toBeGreaterThanOrEqual(1);
    });
});

import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import QrGenerator from "../pages/QrGenerator";

describe("QrGenerator", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("初期状態で入力エリアとフォーマット選択ボタンが表示されること", () => {
        render(() => <QrGenerator />);
        expect(screen.getByText("QRコード作成・生成ツール")).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/https:\/\/example\.com/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "QRコードを作成する" })).toBeInTheDocument();

        // 各フォーマット
        expect(screen.getByText("PNG")).toBeInTheDocument();
        expect(screen.getByText("JPEG")).toBeInTheDocument();
        expect(screen.getByText("WebP")).toBeInTheDocument();
        expect(screen.getByText("SVG")).toBeInTheDocument();
    });

    it("文字列が未入力の場合、生成ボタンが無効化されていること", () => {
        render(() => <QrGenerator />);
        const generateBtn = screen.getByRole("button", { name: "QRコードを作成する" });
        expect(generateBtn).toBeDisabled();
    });

    it("文字列を入力して「QRコードを作成する」をクリックするとプレビューが表示されること", async () => {
        render(() => <QrGenerator />);
        const textarea = screen.getByPlaceholderText(/https:\/\/example\.com/);

        fireEvent.input(textarea, { target: { value: "https://test.example.com" } });

        const generateBtn = screen.getByRole("button", { name: "QRコードを作成する" });
        expect(generateBtn).not.toBeDisabled();

        fireEvent.click(generateBtn);

        const img = await screen.findByAltText("QRコード プレビュー");
        expect(img).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "表示拡大" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /保存/ })).toBeInTheDocument();
    });

    it("フォーマットを切り替えると保存ボタンのラベルが切り替わること", async () => {
        render(() => <QrGenerator />);
        const textarea = screen.getByPlaceholderText(/https:\/\/example\.com/);
        fireEvent.input(textarea, { target: { value: "sample data" } });

        fireEvent.click(screen.getByRole("button", { name: "QRコードを作成する" }));

        await screen.findByAltText("QRコード プレビュー");
        expect(screen.getByRole("button", { name: "保存 (PNG)" })).toBeInTheDocument();

        // SVGを選択
        fireEvent.click(screen.getByText("SVG"));
        expect(screen.getByRole("button", { name: "保存 (SVG)" })).toBeInTheDocument();
    });
});

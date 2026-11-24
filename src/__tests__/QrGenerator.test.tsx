import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import QrGenerator from "../pages/QrGenerator";

describe("QrGenerator", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("初期状態で入力エリアとフォーマット選択ボタンが表示され、高視認性クラスが付与されていること", () => {
        render(() => <QrGenerator />);
        expect(screen.getByText("QRコード作成・生成ツール")).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/https:\/\/example\.com/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "QRコードを作成する" })).toBeInTheDocument();

        // 各フォーマットと選択状態クラス
        const pngBtn = screen.getByText("PNG").closest("button");
        expect(pngBtn).toHaveClass("is-active");
        expect(pngBtn).toHaveAttribute("aria-pressed", "true");
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

    it("「表示拡大」と「縮小」のトグル、およびPNG・SVGでの保存処理がエラーなく実行できること", async () => {
        globalThis.URL.createObjectURL = vi
            .fn()
            .mockReturnValue("blob:http://localhost/mock-svg");

        render(() => <QrGenerator />);
        const textarea = screen.getByPlaceholderText(/https:\/\/example\.com/);
        fireEvent.input(textarea, {
            target: { value: "https://tools.blossomsarchive.com/qr_code" },
        });

        fireEvent.click(
            screen.getByRole("button", { name: "QRコードを作成する" }),
        );
        await screen.findByAltText("QRコード プレビュー");

        const zoomBtn = screen.getByRole("button", { name: "表示拡大" });
        fireEvent.click(zoomBtn);
        expect(screen.getByAltText("QRコード 拡大表示")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

        // PNG保存クリック
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        fireEvent.click(screen.getByRole("button", { name: "保存 (PNG)" }));

        // SVGに切り替えて保存クリック
        fireEvent.click(screen.getByText("SVG"));
        fireEvent.click(screen.getByRole("button", { name: "保存 (SVG)" }));
    });

    it("Wi-Fiモードに切り替えてSSIDを入力し、Wi-Fi用QRコードが作成できること", async () => {
        render(() => <QrGenerator />);

        // Wi-Fi接続設定タブに切り替え
        const wifiTab = screen.getByRole("button", { name: "Wi-Fi接続設定" });
        fireEvent.click(wifiTab);

        const ssidInput = screen.getByLabelText("SSID (ネットワーク名)");
        expect(ssidInput).toBeInTheDocument();

        const generateBtn = screen.getByRole("button", { name: "QRコードを作成する" });
        expect(generateBtn).toBeDisabled();

        fireEvent.input(ssidInput, { target: { value: "Blossoms_Guest_WiFi" } });
        expect(generateBtn).not.toBeDisabled();

        const passInput = screen.getByLabelText("Wi-Fiパスワード");
        fireEvent.input(passInput, { target: { value: "SecurePass123" } });

        fireEvent.click(generateBtn);
        const img = await screen.findByAltText("QRコード プレビュー");
        expect(img).toBeInTheDocument();
    });
});

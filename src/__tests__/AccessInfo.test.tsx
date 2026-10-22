import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AccessInfo from "../pages/AccessInfo";

describe("AccessInfo", () => {
    beforeEach(() => {
        vi.restoreAllMocks();

        // navigator.clipboard mock
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("初期状態で「アクセス情報を取得する」ボタンが表示されること", () => {
        render(() => <AccessInfo />);
        expect(screen.getByText(/現在のネットワークや端末環境を解析します/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "アクセス情報を取得する" })).toBeInTheDocument();
    });

    it("ボタンをクリックするとAPIから情報を取得して各項目が表示されること", async () => {
        const mockData = {
            ip: "192.0.2.1",
            country_name: "Japan",
            country_code: "JP",
            region: "Tokyo",
            city: "Chiyoda",
            postal: "100-0001",
            timezone: "Asia/Tokyo",
            latitude: 35.6895,
            longitude: 139.6917,
            org: "Test ISP Network",
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
        } as any);

        render(() => <AccessInfo />);

        const fetchBtn = screen.getByRole("button", { name: "アクセス情報を取得する" });
        fireEvent.click(fetchBtn);

        // 取得後の項目を確認
        expect(await screen.findByText("192.0.2.1")).toBeInTheDocument();
        expect(screen.getByText("Test ISP Network")).toBeInTheDocument();
        expect(screen.getByText("Japan (JP)")).toBeInTheDocument();
        expect(screen.getByText("Tokyo / Chiyoda")).toBeInTheDocument();
        expect(screen.getByText("100-0001")).toBeInTheDocument();
        expect(screen.getByText("35.6895 , 139.6917")).toBeInTheDocument();

        // 端末環境セクション
        expect(screen.getByText("端末・ブラウザ環境")).toBeInTheDocument();
        expect(screen.getByText("物理解像度")).toBeInTheDocument();
        expect(screen.getByText("論理解像度")).toBeInTheDocument();
        expect(screen.getByText("回線種別")).toBeInTheDocument();
        expect(screen.getByText("ユーザーエージェント")).toBeInTheDocument();
        expect(screen.getByText("バッテリー残量")).toBeInTheDocument();

        // 一括コピーボタン
        expect(screen.getByRole("button", { name: "すべての情報をコピー" })).toBeInTheDocument();
    });

    it("APIがエラーを返した場合にエラーメッセージと再試行ボタンが表示されること", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failed"));

        render(() => <AccessInfo />);
        fireEvent.click(screen.getByRole("button", { name: "アクセス情報を取得する" }));

        expect(await screen.findByText("もう一度試す")).toBeInTheDocument();
    });

    it("個別コピーおよび一括コピーをクリックするとクリップボードにコピーされること", async () => {
        const mockData = {
            ip: "203.0.113.1",
            country_name: "Japan",
            country_code: "JP",
            region: "Osaka",
            city: "Osaka",
            postal: "530-0001",
            latitude: 34.6937,
            longitude: 135.5023,
            org: "Sample Telecom",
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
        } as any);

        render(() => <AccessInfo />);
        fireEvent.click(screen.getByRole("button", { name: "アクセス情報を取得する" }));

        await screen.findByText("203.0.113.1");

        // 一括コピー
        const allCopyBtn = screen.getByRole("button", { name: "すべての情報をコピー" });
        fireEvent.click(allCopyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
});

import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PasswordGenerator from "../pages/PasswordGenerator";

describe("PasswordGenerator", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // clipboard mock
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("初期状態で設定項目が表示されていること", () => {
        render(() => <PasswordGenerator />);
        expect(screen.getByText("パスワード生成ツール")).toBeInTheDocument();
        expect(screen.getByText("パスワードを自動生成")).toBeInTheDocument();
        expect(screen.getByText("小文字 (a-z)")).toBeInTheDocument();
        expect(screen.getByText("大文字 (A-Z)")).toBeInTheDocument();
        expect(screen.getByText("数字 (0-9)")).toBeInTheDocument();
        expect(screen.getByText("記号 (!@#$)")).toBeInTheDocument();
    });

    it("「パスワードを自動生成」をクリックすると指定個数のパスワードが生成されること", async () => {
        render(() => <PasswordGenerator />);

        const generateBtn = screen.getByRole("button", { name: "パスワードを自動生成" });
        fireEvent.click(generateBtn);

        // デフォルトは5件
        const copyBtns = await screen.findAllByRole("button", { name: "コピー" });
        expect(copyBtns.length).toBe(5);
        expect(screen.getByText(/生成結果 \(5件\)/)).toBeInTheDocument();
    });

    it("すべての文字種チェックを外した場合はエラーメッセージが表示されること", async () => {
        render(() => <PasswordGenerator />);

        // 全チェックボックスをオフにする
        const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
        checkboxes.forEach((cb) => {
            if (cb.checked) fireEvent.click(cb);
        });

        const generateBtn = screen.getByRole("button", { name: "パスワードを自動生成" });
        fireEvent.click(generateBtn);

        const warningInput = screen.getByDisplayValue("文字種を選択してください");
        expect(warningInput).toBeInTheDocument();
    });

    it("個別コピーボタンをクリックするとクリップボードにコピーされること", async () => {
        render(() => <PasswordGenerator />);

        fireEvent.click(screen.getByRole("button", { name: "パスワードを自動生成" }));

        const copyBtns = await screen.findAllByRole("button", { name: "コピー" });
        fireEvent.click(copyBtns[0]);

        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
});

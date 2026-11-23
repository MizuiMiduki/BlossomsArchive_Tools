import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import CommandPalette from "../components/CommandPalette";

describe("CommandPalette Component", () => {
    it("isOpenがfalseのときは表示されないこと", () => {
        render(() => <CommandPalette isOpen={false} onClose={() => {}} />);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("isOpenがtrueのときに表示され、検索と選択ができること", () => {
        const handleClose = vi.fn();
        render(() => <CommandPalette isOpen={true} onClose={handleClose} />);

        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();

        const input = screen.getByPlaceholderText(/ツール名、キーワード、機能で検索/i);
        expect(input).toBeInTheDocument();

        // 検索クエリ入力
        fireEvent.input(input, { target: { value: "電卓" } });
        expect(screen.getByText("電卓ツール")).toBeInTheDocument();

        // 閉じるボタン
        const closeBtn = screen.getByLabelText("検索を閉じる");
        fireEvent.click(closeBtn);
        expect(handleClose).toHaveBeenCalled();
    });
});

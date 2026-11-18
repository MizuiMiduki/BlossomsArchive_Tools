import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TimerStopwatch from "../pages/TimerStopwatch";

describe("TimerStopwatch", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("初期状態でストップウォッチが表示されること", () => {
        render(() => <TimerStopwatch />);
        expect(screen.getByText("ストップウォッチ")).toBeInTheDocument();
        expect(screen.getByText("タイマー")).toBeInTheDocument();
        expect(screen.getByText("ポモドーロ")).toBeInTheDocument();
        expect(screen.getByText("00:00.00")).toBeInTheDocument();
    });

    it("モード切り替えが正常に行えること", () => {
        render(() => <TimerStopwatch />);

        // タイマーモードに切り替え
        fireEvent.click(screen.getByText("タイマー"));
        expect(screen.getByText("05:00")).toBeInTheDocument();
        expect(screen.getByText("時間入力 (H:M:S)")).toBeInTheDocument();

        // ポモドーロモードに切り替え
        fireEvent.click(screen.getByText("ポモドーロ"));
        expect(screen.getByText("集中タイム")).toBeInTheDocument();
        expect(screen.getByText("25:00")).toBeInTheDocument();
    });

    it("スタートと一時停止のボタン切り替えができること", () => {
        render(() => <TimerStopwatch />);
        const startBtn = screen.getByRole("button", { name: "スタート" });
        expect(startBtn).toBeInTheDocument();

        fireEvent.click(startBtn);
        expect(screen.getByRole("button", { name: "一時停止" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "一時停止" }));
        expect(screen.getByRole("button", { name: "スタート" })).toBeInTheDocument();
    });

    it("リセットボタンで時間がリセットされること", () => {
        render(() => <TimerStopwatch />);
        const resetBtn = screen.getByRole("button", { name: "リセット" });
        expect(resetBtn).toBeInTheDocument();
        fireEvent.click(resetBtn);
        expect(screen.getByText("00:00.00")).toBeInTheDocument();
    });

    it("タイマーモードでH:M:S入力・プリセット設定・カウントダウン終了時のダイアログ表示が動作すること", async () => {
        vi.useFakeTimers({
            toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"],
        });
        if (typeof HTMLDialogElement !== "undefined") {
            HTMLDialogElement.prototype.showModal = vi.fn();
            HTMLDialogElement.prototype.close = vi.fn();
        }
        render(() => <TimerStopwatch />);

        fireEvent.click(screen.getByText("タイマー"));

        // H:M:S 入力: 1時間2分3秒 -> 01:02:03
        const hInput = screen.getByLabelText("時間（時）");
        const mInput = screen.getByLabelText("時間（分）");
        const sInput = screen.getByLabelText("時間（秒）");
        fireEvent.input(hInput, { target: { value: "1" } });
        fireEvent.input(mInput, { target: { value: "2" } });
        fireEvent.input(sInput, { target: { value: "3" } });
        fireEvent.click(screen.getByRole("button", { name: "セット" }));
        expect(screen.getByText("01:02:03")).toBeInTheDocument();

        // プリセット「1分」クリック -> 01:00
        fireEvent.click(screen.getByRole("button", { name: "1分" }));
        expect(screen.getByText("01:00")).toBeInTheDocument();

        // 1秒にセットしてカウントダウン完了させる
        fireEvent.input(hInput, { target: { value: "0" } });
        fireEvent.input(mInput, { target: { value: "0" } });
        fireEvent.input(sInput, { target: { value: "1" } });
        fireEvent.click(screen.getByRole("button", { name: "セット" }));
        expect(screen.getByText("00:01")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "スタート" }));
        await vi.advanceTimersByTimeAsync(2500);
        expect(screen.getByText("00:00")).toBeInTheDocument();
        vi.useRealTimers();
    });

    it("ポモドーロモードで集中時間・休憩時間の変更と自動ループ切り替えが動作すること", async () => {
        vi.useFakeTimers({
            toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"],
        });
        render(() => <TimerStopwatch />);

        fireEvent.click(screen.getByText("ポモドーロ"));
        expect(screen.getByText("集中タイム")).toBeInTheDocument();

        const focusInput = screen.getByLabelText("集中時間（分）");
        const breakInput = screen.getByLabelText("休憩時間（分）");
        fireEvent.input(focusInput, { target: { value: "1" } });
        fireEvent.input(breakInput, { target: { value: "2" } });
        await Promise.resolve();
        expect(screen.getByText("01:00")).toBeInTheDocument();

        // スタートして61秒進めると休憩中に自動遷移する
        fireEvent.click(screen.getByRole("button", { name: "スタート" }));
        await vi.advanceTimersByTimeAsync(61500);
        expect(screen.getByText("休憩中")).toBeInTheDocument();
        expect(screen.getByText("02:00")).toBeInTheDocument();

        vi.useRealTimers();
    });
});

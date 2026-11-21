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

    it("リセットボタンで時間がリセットされ、動作中の場合は確実に停止すること", () => {
        render(() => <TimerStopwatch />);
        fireEvent.click(screen.getByRole("button", { name: "スタート" }));
        expect(screen.getByRole("button", { name: "一時停止" })).toBeInTheDocument();

        const resetBtn = screen.getByRole("button", { name: "リセット" });
        fireEvent.click(resetBtn);
        expect(screen.getByText("00:00.00")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "スタート" })).toBeInTheDocument();
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

    it("ストップウォッチモードでは通知音設定が表示されず、タイマーやポモドーロで表示されること", () => {
        render(() => <TimerStopwatch />);
        expect(screen.queryByText("通知音設定")).not.toBeInTheDocument();

        // タイマーモードに切り替え
        fireEvent.click(screen.getByText("タイマー"));
        expect(screen.getByText("通知音設定")).toBeInTheDocument();
        expect(screen.getByLabelText("通知音を有効にする")).toBeChecked();
        expect(screen.getByLabelText("音量")).toBeInTheDocument();
        expect(screen.getByLabelText("音の種類")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "試聴" })).toBeInTheDocument();

        // ポモドーロモードに切り替え
        fireEvent.click(screen.getByText("ポモドーロ"));
        expect(screen.getByText("通知音設定")).toBeInTheDocument();
    });

    it("通知音のON/OFF切り替えや音量・音色変更、試聴が動作すること", () => {
        render(() => <TimerStopwatch />);
        fireEvent.click(screen.getByText("タイマー"));

        const toggle = screen.getByLabelText("通知音を有効にする");
        expect(toggle).toBeChecked();

        // 音量変更
        const volumeInput = screen.getByLabelText("音量");
        fireEvent.input(volumeInput, { target: { value: "50" } });
        expect(screen.getByText("50%")).toBeInTheDocument();

        // 音色変更
        const soundSelect = screen.getByLabelText("音の種類");
        fireEvent.change(soundSelect, { target: { value: "chime" } });

        // 試聴ボタン
        const previewBtn = screen.getByRole("button", { name: "試聴" });
        expect(() => fireEvent.click(previewBtn)).not.toThrow();

        // OFFに切り替えると詳細設定が非表示になること
        fireEvent.click(toggle);
        expect(screen.queryByLabelText("音量")).not.toBeInTheDocument();
        expect(screen.getByText("OFF")).toBeInTheDocument();
    });
});

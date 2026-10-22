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
});

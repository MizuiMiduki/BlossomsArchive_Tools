import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import Clock from "../pages/Clock";

describe("Clock", () => {
    it("初期レンダリングでデジタル時計が表示されていること", () => {
        const { container } = render(() => <Clock />);
        expect(screen.getByRole("button", { name: "デジタル" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "アナログ" })).toBeInTheDocument();

        // デジタル表示コンテナ
        const digitalDisplay = container.querySelector(".font-mono.tracking-tighter");
        expect(digitalDisplay).toBeInTheDocument();
    });

    it("「アナログ」ボタンをクリックするとアナログ時計（SVG）が表示されること", () => {
        const { container } = render(() => <Clock />);

        const analogBtn = screen.getByRole("button", { name: "アナログ" });
        fireEvent.click(analogBtn);

        const svg = container.querySelector("svg");
        expect(svg).toBeInTheDocument();

        // 針の存在確認（hour, min, sec）
        const lines = container.querySelectorAll("svg line");
        // 目盛り12本 + 針3本 = 15本
        expect(lines.length).toBeGreaterThanOrEqual(15);
    });

    it("アナログからデジタルへの切り替えが正常に行えること", () => {
        const { container } = render(() => <Clock />);

        // アナログに切り替え
        fireEvent.click(screen.getByRole("button", { name: "アナログ" }));
        expect(container.querySelector("svg")).toBeInTheDocument();

        // 再びデジタルに切り替え
        fireEvent.click(screen.getByRole("button", { name: "デジタル" }));
        expect(container.querySelector("svg")).not.toBeInTheDocument();
        expect(container.querySelector(".font-mono.tracking-tighter")).toBeInTheDocument();
    });

    it("時間の経過に合わせてデジタル表示の秒がリアルタイムに更新されること", async () => {
        vi.useFakeTimers({
            toFake: ["setInterval", "clearInterval", "Date"],
        });
        vi.setSystemTime(new Date("2026-11-19T12:34:56"));

        const { container, unmount } = render(() => <Clock />);
        const digitalDisplay = container.querySelector(".font-mono.tracking-tighter");
        expect(digitalDisplay?.textContent).toContain("12:34:56");

        await vi.advanceTimersByTimeAsync(2000);
        expect(digitalDisplay?.textContent).toContain("12:34:58");

        unmount();
        vi.useRealTimers();
    });
});

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

        // 目盛り（時目盛り+分のコマ 計60本）+ 針3本 = 63本
        const lines = container.querySelectorAll("svg line");
        expect(lines.length).toBe(63);

        // 文字盤の時間数字（1〜12）
        const texts = container.querySelectorAll("svg text");
        expect(texts.length).toBe(12);
        expect(texts[0].textContent).toBe("1");
        expect(texts[11].textContent).toBe("12");
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

    it("秒針音トグルおよび音量スライダーがアナログモード時のみ表示され、ON/OFFと音量変更がlocalStorageに永続化されること", () => {
        const { unmount } = render(() => <Clock />);

        // 初期（デジタルモード）では秒針音UIは非表示
        expect(screen.queryByRole("button", { name: "秒針音をオンにする" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("秒針音の音量")).not.toBeInTheDocument();

        // アナログモードに切り替えると秒針音コントロールが表示される（初期状態はOFF）
        fireEvent.click(screen.getByRole("button", { name: "アナログ" }));
        const soundBtn = screen.getByRole("button", { name: "秒針音をオンにする" });
        expect(soundBtn).toBeInTheDocument();
        expect(soundBtn.textContent).toContain("OFF");

        const volumeSlider = screen.getByLabelText("秒針音の音量");
        expect(volumeSlider).toBeInTheDocument();

        // 音量スライダーを変更しても勝手にONにならず、カチカチ音も鳴らないこと
        fireEvent.input(volumeSlider, { target: { value: "70" } });
        expect(localStorage.getItem("ba_clock_sound_volume")).toBe("70");
        expect(soundBtn.textContent).toContain("OFF");
        expect(localStorage.getItem("ba_clock_sound_enabled")).not.toBe("true");

        // クリックして ON
        fireEvent.click(soundBtn);
        expect(soundBtn.textContent).toContain("ON");
        expect(soundBtn).toHaveAttribute("aria-label", "秒針音をオフにする");
        expect(localStorage.getItem("ba_clock_sound_enabled")).toBe("true");

        // 音量スライダーの再変更
        fireEvent.input(volumeSlider, { target: { value: "50" } });
        expect(localStorage.getItem("ba_clock_sound_volume")).toBe("50");

        // 再度クリックして OFF
        fireEvent.click(soundBtn);
        expect(soundBtn.textContent).toContain("OFF");
        expect(localStorage.getItem("ba_clock_sound_enabled")).toBe("false");

        // デジタルモードに戻すと再び非表示になる
        fireEvent.click(screen.getByRole("button", { name: "デジタル" }));
        expect(screen.queryByRole("button", { name: "秒針音をオンにする" })).not.toBeInTheDocument();

        unmount();
    });
});

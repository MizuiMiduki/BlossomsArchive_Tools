import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Lottery from "../pages/Lottery";

describe("Lottery", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("初期状態で入力エリアと「抽選を実行」ボタンが表示されること", () => {
        render(() => <Lottery />);
        expect(screen.getByText("抽選・ランダム選定ツール")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "抽選を実行" })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/項目 A/)).toBeInTheDocument();
    });

    it("テキストエリアが空の状態で抽選を実行すると注意文が表示されること", () => {
        render(() => <Lottery />);
        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        expect(screen.getByText("抽選対象を入力してください")).toBeInTheDocument();
    });

    it("リストを入力して抽選を実行すると当選結果が表示されること", () => {
        render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;

        fireEvent.input(textarea, { target: { value: "りんご\nみかん\nバナナ" } });
        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        expect(screen.getByText("選定結果")).toBeInTheDocument();
        expect(screen.getByText("実行ログ")).toBeInTheDocument();

        // りんご、みかん、バナナのいずれかが当選
        const isOneOfItems = ["りんご", "みかん", "バナナ"].some((fruit) =>
            screen.queryAllByText(fruit).length > 0,
        );
        expect(isOneOfItems).toBe(true);
    });

    it("「クリア」ボタンで入力と結果がリセットされること", () => {
        render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;

        fireEvent.input(textarea, { target: { value: "A\nB\nC" } });
        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        expect(screen.getByText("選定結果")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "クリア" }));
        expect(textarea.value).toBe("");
        expect(screen.queryByText("選定結果")).not.toBeInTheDocument();
    });

    it("「当選時にリストから除外」が有効な場合、当選項目がテキストエリアから削除されること", () => {
        const { container } = render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;

        fireEvent.input(textarea, { target: { value: "項目1\n項目2" } });

        // 除外チェックボックスをONにする
        const checkbox = container.querySelector("input.checkbox-primary") as HTMLInputElement;
        expect(checkbox).not.toBeNull();
        fireEvent.click(checkbox);

        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        // 1件引かれたので残りは1行
        const remainingItems = textarea.value.trim().split("\n");
        expect(remainingItems.length).toBe(1);
    });

    it("複数同時選定・結果コピー・シェア・履歴クリアが正常に動作すること", () => {
        render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;

        fireEvent.input(textarea, {
            target: { value: "候補1\n候補2\n候補3\n候補4\n候補5" },
        });

        const countSelect = screen.getByLabelText("同時選定数") as HTMLSelectElement;
        fireEvent.change(countSelect, { target: { value: "3" } });

        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        // 結果コピーと共有ボタン
        const copyBtn = screen.getByRole("button", { name: /クリップボードにコピー/ });
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();

        const shareBtn = screen.getByRole("button", { name: /共有 \/ 出力/ });
        fireEvent.click(shareBtn);

        // 履歴クリア
        const clearHistoryBtn = screen.getByRole("button", { name: /ログを消去/ });
        fireEvent.click(clearHistoryBtn);
    });

    it("抽選演出の選択（デフォルトは演出オフ）およびドキドキ演出（ルーレット・カウントダウン）とスキップ機能が正常に動作すること", () => {
        render(() => <Lottery />);

        // 1. デフォルト設定の確認: 演出は「演出なし（即時）」が選択されていること
        const animSelect = screen.getByLabelText("抽選演出") as HTMLSelectElement;
        expect(animSelect).toBeInTheDocument();
        expect(animSelect.value).toBe("none");

        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: "金賞\n銀賞\n銅賞" } });

        // 2. 「ドキドキ演出（ルーレット）」を選択
        fireEvent.change(animSelect, { target: { value: "roulette" } });
        expect(animSelect.value).toBe("roulette");

        // 抽選ボタンを押すと演出中（ROULETTE表示、ボタンdisabled）になる
        const drawBtn = screen.getByRole("button", { name: "抽選を実行" });
        fireEvent.click(drawBtn);

        expect(screen.getByText("ROULETTE")).toBeInTheDocument();
        expect(screen.getAllByText(/抽選中/).length).toBeGreaterThan(0);

        // 演出スキップボタンを押すと即座に結果が確定すること
        const skipBtn = screen.getByRole("button", { name: /演出をスキップ/ });
        expect(skipBtn).toBeInTheDocument();
        fireEvent.click(skipBtn);

        expect(screen.getByText("選定結果")).toBeInTheDocument();
        expect(screen.getByText("当選")).toBeInTheDocument();

        // 3. 「カウントダウン演出（3秒）」を選択してテスト
        fireEvent.change(animSelect, { target: { value: "countdown" } });
        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        expect(screen.getByText("COUNTDOWN")).toBeInTheDocument();
        const skipBtn2 = screen.getByRole("button", { name: /演出をスキップ/ });
        fireEvent.click(skipBtn2);

        expect(screen.getByText("選定結果")).toBeInTheDocument();
    });

    it("演出用音量スライダーおよびミュートボタンで音量を小さく調整でき、localStorageに保存されること", () => {
        localStorage.clear();
        const { unmount } = render(() => <Lottery />);

        // 演出なし（デフォルト）では音量スライダーは非表示
        expect(screen.queryByLabelText("演出音量")).not.toBeInTheDocument();

        // 演出モードをルーレットに切り替えると音量スライダーが表示される
        const animSelect = screen.getByLabelText("抽選演出") as HTMLSelectElement;
        fireEvent.change(animSelect, { target: { value: "roulette" } });

        const volumeSlider = screen.getByLabelText("演出音量") as HTMLInputElement;
        expect(volumeSlider).toBeInTheDocument();
        // 初期値（デフォルト）は 50%
        expect(volumeSlider.value).toBe("50");

        // 音量を小さく（20%）変更
        fireEvent.input(volumeSlider, { target: { value: "20" } });
        expect(localStorage.getItem("ba_lottery_sound_volume")).toBe("20");
        expect(screen.getByText("20%")).toBeInTheDocument();

        // ミュートボタンをクリックして 0% にできること
        const muteBtn = screen.getByRole("button", { name: "ミュート" });
        fireEvent.click(muteBtn);
        expect(localStorage.getItem("ba_lottery_sound_volume")).toBe("0");
        expect(screen.getByText("0%")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ミュート解除" })).toBeInTheDocument();

        unmount();

        // 再レンダリング（リロード）時に小さくした音量（0%）が復元されること
        const { unmount: unmount2 } = render(() => <Lottery />);
        const animSelect2 = screen.getByLabelText("抽選演出") as HTMLSelectElement;
        fireEvent.change(animSelect2, { target: { value: "roulette" } });

        const volumeSlider2 = screen.getByLabelText("演出音量") as HTMLInputElement;
        expect(volumeSlider2.value).toBe("0");
        unmount2();
    });
});

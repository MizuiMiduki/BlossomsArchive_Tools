import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import ExposureCalculator from "../pages/ExposureCalculator";

describe("ExposureCalculator Page Component", () => {
    it("初期状態でタイトルH1、各タブナビゲーション、シミュレーターが表示されること", () => {
        render(() => <ExposureCalculator />);
        expect(
            screen.getByRole("heading", { level: 1, name: /カメラ露出計算機/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /カメラ露出計/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /適正露出計算/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /ND長秒/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /等価露出換算/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /星空限界速度/ }),
        ).toBeInTheDocument();
    });

    it("タブ切り替えが正常に行えること", () => {
        render(() => <ExposureCalculator />);

        // ND長秒タブへ
        fireEvent.click(
            screen.getByRole("button", { name: /ND長秒/ }),
        );
        expect(
            screen.getByText(/NDなしの基準シャッタースピード/),
        ).toBeInTheDocument();

        // 等価露出換算タブへ
        fireEvent.click(
            screen.getByRole("button", { name: /等価露出換算/ }),
        );
        expect(
            screen.getByText(/現在の基準設定 \(ベース露出\)/),
        ).toBeInTheDocument();

        // 星空タブへ
        fireEvent.click(
            screen.getByRole("button", { name: /星空限界速度/ }),
        );
        expect(
            screen.getByText(/星景・天体写真 露光限界速度の計算/),
        ).toBeInTheDocument();

        // 再びシミュレータータブへ
        fireEvent.click(
            screen.getByRole("button", { name: /適正露出計算/ }),
        );
        expect(
            screen.getByText(/撮影環境・シーンの選択/),
        ).toBeInTheDocument();
    });

    it("適正露出シミュレーターでシーンや計算対象を変更できること", () => {
        render(() => <ExposureCalculator />);

        // シーンを「天の川・星空」に変更
        const sceneSelect = screen.getByLabelText("撮影シーンプリセット選択") as HTMLSelectElement;
        fireEvent.change(sceneSelect, { target: { value: "milky-way" } });
        expect(sceneSelect.value).toBe("milky-way");

        // 計算対象を「絞り(F値)」に変更
        const radioAperture = screen.getByLabelText("絞り値を自動計算する");
        fireEvent.click(radioAperture);
        expect(screen.getByText(/理論値: f\//)).toBeInTheDocument();

        // 手動EV入力モードに切り替え
        const toggle = screen.getByLabelText("EV値を数値で直接手動入力する");
        fireEvent.click(toggle);
        expect(screen.getByLabelText("手動EVスライダー")).toBeInTheDocument();
    });

    it("ND長秒タブでタイマーのセット・スタート・一時停止・リセットができること", () => {
        vi.useFakeTimers();
        render(() => <ExposureCalculator />);

        fireEvent.click(
            screen.getByRole("button", { name: /ND長秒/ }),
        );

        // タイマーにセット
        const setBtn = screen.getByRole("button", { name: /タイマーにセット/ });
        fireEvent.click(setBtn);

        // スタート
        const startBtn = screen.getByRole("button", { name: /スタート/ });
        fireEvent.click(startBtn);

        // タイマーが進む
        vi.advanceTimersByTime(2000);

        // 一時停止
        const pauseBtn = screen.getByRole("button", { name: /一時停止/ });
        fireEvent.click(pauseBtn);

        // リセット
        const resetBtn = screen.getByRole("button", { name: /リセット/ });
        fireEvent.click(resetBtn);

        vi.useRealTimers();
    });

    it("等価露出換算タブでパラメータを変更して再計算されること", () => {
        render(() => <ExposureCalculator />);

        fireEvent.click(
            screen.getByRole("button", { name: /等価露出換算/ }),
        );

        const newAperture = screen.getByLabelText("変更後絞り値") as HTMLSelectElement;
        fireEvent.change(newAperture, { target: { value: "1.4" } });
        expect(newAperture.value).toBe("1.4");

        // 求めたいパラメータを絞りに変更
        const radioSolveF = screen.getByLabelText("換算絞り値を求める");
        fireEvent.click(radioSolveF);
        expect(screen.getByText("必要絞り値(F値)")).toBeInTheDocument();
    });

    it("星空タブで焦点距離を全消ししてから新しい数値をスムーズに入力できること", () => {
        const { container } = render(() => <ExposureCalculator />);

        fireEvent.click(
            screen.getByRole("button", { name: /星空限界速度/ }),
        );

        const focalInput = screen.getByLabelText("焦点距離mm入力") as HTMLInputElement;

        // 全て消して空文字にする
        fireEvent.input(focalInput, { target: { value: "" } });
        expect(focalInput.value).toBe("");

        // 空文字の状態でも NaN が画面に表示されないこと
        expect(container.textContent).not.toContain("NaN");

        // 新しい数値 (50mm) を入力
        fireEvent.input(focalInput, { target: { value: "50" } });
        expect(focalInput.value).toBe("50");

        // 再計算結果が表示されていること
        expect(screen.getByText("約 10 秒")).toBeInTheDocument();
    });

    it("カメラ露出計タブで測光モード変更やシミュレーターへの値反映ができること", () => {
        render(() => <ExposureCalculator />);

        // カメラ露出計タブへ切り替え
        fireEvent.click(
            screen.getByRole("button", { name: /カメラ露出計/ }),
        );
        expect(
            screen.getByText(/スマホカメラ リアルタイム露出計/),
        ).toBeInTheDocument();

        // 測光モードの切り替え
        const spotRadio = screen.getByLabelText("スポット測光モード");
        fireEvent.click(spotRadio);

        // キャリブレーション補正
        const calibSlider = screen.getByLabelText("露出計キャリブレーションスライダー") as HTMLInputElement;
        fireEvent.input(calibSlider, { target: { value: "1.0" } });
        expect(calibSlider.value).toBe("1");

        // 「この露出値で計算する」ボタン押下でシミュレータータブへ移動すること
        const applyBtn = screen.getByRole("button", {
            name: /この露出値で計算する/,
        });
        fireEvent.click(applyBtn);

        // シミュレーター画面になり手動EVスライダーが表示されていること
        expect(screen.getByLabelText("手動EVスライダー")).toBeInTheDocument();
    });

    it("カメラ露出計から『選択式(シーン)に戻る』ボタンでシーン選択式シミュレーターに即座に戻れること", () => {
        render(() => <ExposureCalculator />);

        // カメラ露出計タブへ切り替え
        fireEvent.click(
            screen.getByRole("button", { name: /カメラ露出計/ }),
        );

        // 選択式に戻るボタンをクリック
        const backButtons = screen.getAllByRole("button", { name: /選択式.*戻る/ });
        expect(backButtons.length).toBeGreaterThan(0);
        fireEvent.click(backButtons[0]);

        // シミュレーターのシーン選択セレクトボックスが表示されていること
        expect(screen.getByLabelText("撮影シーンプリセット選択")).toBeInTheDocument();
    });

    it("手動EV入力モードから『シーン選択式』ボタンで1タップでプリセット選択に戻れること", () => {
        render(() => <ExposureCalculator />);

        // 手動EVモードへ切り替え
        const manualBtn = screen.getByRole("button", { name: /手動EV/ });
        fireEvent.click(manualBtn);
        expect(screen.getByLabelText("手動EVスライダー")).toBeInTheDocument();

        // 「シーン選択式に戻る」ボタンを押す
        const sceneBackBtn = screen.getByRole("button", { name: "☀️ シーン選択式に戻る" });
        fireEvent.click(sceneBackBtn);

        // プリセットセレクトボックスが表示され、スライダーが消えていること
        expect(screen.getByLabelText("撮影シーンプリセット選択")).toBeInTheDocument();
        expect(screen.queryByLabelText("手動EVスライダー")).not.toBeInTheDocument();
    });

    it("シミュレーターの最上部に計算結果カードが配置され、スクロールなしで最適露出を確認できること", () => {
        const { container } = render(() => <ExposureCalculator />);

        // フォーム内の最初のカードが計算結果カードであること
        const form = container.querySelector("form");
        expect(form).not.toBeNull();
        const firstCard = form?.querySelector(".card");
        expect(firstCard?.textContent).toContain("計算された最適露出設定");
        expect(firstCard?.textContent).toContain("目標 EV");
    });
});

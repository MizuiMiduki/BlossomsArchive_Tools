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
            screen.getByRole("button", { name: "適正露出シミュレータータブ" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "ND長秒露光とタイマータブ" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "等価露出換算タブ" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "星空シャッター限界タブ" }),
        ).toBeInTheDocument();
    });

    it("タブ切り替えが正常に行えること", () => {
        render(() => <ExposureCalculator />);

        // ND長秒タブへ
        fireEvent.click(
            screen.getByRole("button", { name: "ND長秒露光とタイマータブ" }),
        );
        expect(
            screen.getByText(/NDなしの基準シャッタースピード/),
        ).toBeInTheDocument();

        // 等価露出換算タブへ
        fireEvent.click(
            screen.getByRole("button", { name: "等価露出換算タブ" }),
        );
        expect(
            screen.getByText(/現在の基準設定 \(ベース露出\)/),
        ).toBeInTheDocument();

        // 星空タブへ
        fireEvent.click(
            screen.getByRole("button", { name: "星空シャッター限界タブ" }),
        );
        expect(
            screen.getByText(/星景・天体写真 露光限界速度の計算/),
        ).toBeInTheDocument();

        // 再びシミュレータータブへ
        fireEvent.click(
            screen.getByRole("button", { name: "適正露出シミュレータータブ" }),
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
            screen.getByRole("button", { name: "ND長秒露光とタイマータブ" }),
        );

        // タイマーにセット
        const setBtn = screen.getByLabelText("計算された時間をタイマーにセットする");
        fireEvent.click(setBtn);

        // スタート
        const startBtn = screen.getByLabelText("タイマースタート");
        fireEvent.click(startBtn);

        // タイマーが進む
        vi.advanceTimersByTime(2000);

        // 一時停止
        const pauseBtn = screen.getByLabelText("タイマーを一時停止");
        fireEvent.click(pauseBtn);

        // リセット
        const resetBtn = screen.getByLabelText("タイマーリセット");
        fireEvent.click(resetBtn);

        vi.useRealTimers();
    });

    it("等価露出換算タブでパラメータを変更して再計算されること", () => {
        render(() => <ExposureCalculator />);

        fireEvent.click(
            screen.getByRole("button", { name: "等価露出換算タブ" }),
        );

        const newAperture = screen.getByLabelText("変更後絞り値") as HTMLSelectElement;
        fireEvent.change(newAperture, { target: { value: "1.4" } });
        expect(newAperture.value).toBe("1.4");

        // 求めたいパラメータを絞りに変更
        const radioSolveF = screen.getByLabelText("換算絞り値を求める");
        fireEvent.click(radioSolveF);
        expect(screen.getByText("必要絞り値(F値)")).toBeInTheDocument();
    });

    it("星空タブで焦点距離やセンサーサイズ変更で限界速度が再計算されること", () => {
        const { container } = render(() => <ExposureCalculator />);

        fireEvent.click(
            screen.getByRole("button", { name: "星空シャッター限界タブ" }),
        );

        const focalInput = screen.getByLabelText("焦点距離mm入力") as HTMLInputElement;
        fireEvent.input(focalInput, { target: { value: "14" } });
        expect(focalInput.value).toBe("14");

        // NaNを入力しても画面に NaN が露出しないこと
        fireEvent.input(focalInput, { target: { value: "NaN" } });
        expect(container.textContent).not.toContain("NaN");
    });
});

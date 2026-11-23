import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import JsonFormatter from "../pages/JsonFormatter";

describe("JsonFormatter Component", () => {
    it("初期描画で見出し、入力欄、ツールバーが表示されること", () => {
        render(() => <JsonFormatter />);

        expect(screen.getByText("JSON整形・検証・ミニファイ")).toBeInTheDocument();
        expect(screen.getByLabelText("JSON入力欄")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "サンプル読込" })).toBeInTheDocument();
    });

    it("サンプルを読み込むと構文OKバッジと統計情報が表示されること", () => {
        render(() => <JsonFormatter />);

        const sampleBtn = screen.getByRole("button", { name: "サンプル読込" });
        fireEvent.click(sampleBtn);

        expect(screen.getByText("構文OK")).toBeInTheDocument();
        expect(screen.getByText("データ統計情報")).toBeInTheDocument();
        expect(screen.getByText("プロパティ数")).toBeInTheDocument();
    });

    it("不正なJSONを入力すると構文エラーが表示されること", () => {
        render(() => <JsonFormatter />);

        const input = screen.getByLabelText("JSON入力欄");
        fireEvent.input(input, { target: { value: '{"broken": json without quotes}' } });

        expect(screen.getByText("構文エラー")).toBeInTheDocument();
        expect(screen.getByText("JSON構文エラー")).toBeInTheDocument();
    });

    it("圧縮（Minify）ボタンで1行に圧縮されること", () => {
        render(() => <JsonFormatter />);

        const input = screen.getByLabelText("JSON入力欄") as HTMLTextAreaElement;
        fireEvent.input(input, { target: { value: '{\n  "a": 1,\n  "b": 2\n}' } });

        const minifyBtn = screen.getByRole("button", { name: "圧縮 (Minify)" });
        fireEvent.click(minifyBtn);

        expect(input.value).toBe('{"a":1,"b":2}');
    });
});

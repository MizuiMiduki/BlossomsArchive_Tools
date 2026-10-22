import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { MetaProvider } from "@solidjs/meta";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";
import Credits from "../pages/Credits";
import PrivacyPolicy from "../pages/PrivacyPolicy";

describe("Static & Informational Pages", () => {
    describe("Home", () => {
        it("各ツールカードとリンクが一覧表示されること", () => {
            render(() => <Home />);
            expect(screen.getByText("電卓ツール")).toBeInTheDocument();
            expect(screen.getByText("QRコード生成")).toBeInTheDocument();
            expect(screen.getByText("パスワード生成")).toBeInTheDocument();
            expect(screen.getByText("抽選ツール")).toBeInTheDocument();
        });
    });

    describe("NotFound", () => {
        it("404メッセージとホームへのリンクが表示されること", () => {
            render(() => (
                <MetaProvider>
                    <NotFound />
                </MetaProvider>
            ));
            expect(screen.getByText("404")).toBeInTheDocument();
            expect(screen.getByText("お探しのページは見つかりませんでした。")).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "ホームに戻る" })).toBeInTheDocument();
        });
    });

    describe("Credits", () => {
        it("使用ライブラリの一覧が表示されること", () => {
            render(() => <Credits />);
            expect(screen.getByText("使用ライブラリ")).toBeInTheDocument();
            expect(screen.getByText("Solid.js")).toBeInTheDocument();
            expect(screen.getByText("GSAP")).toBeInTheDocument();
        });
    });

    describe("PrivacyPolicy", () => {
        it("プライバシーポリシーの内容が表示されること", () => {
            render(() => <PrivacyPolicy />);
            expect(screen.getByText("プライバシーポリシー")).toBeInTheDocument();
            expect(screen.getByText(/広告配信とアクセス解析ツールについて/)).toBeInTheDocument();
        });
    });
});

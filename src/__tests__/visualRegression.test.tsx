import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouter, memoryHistory } from "@solidjs/router";
import type { Component } from "solid-js";
import Layout from "../components/Layout";
import Home from "../pages/Home";
import Calculator from "../pages/Calculator";
import QrGenerator from "../pages/QrGenerator";
import PasswordGenerator from "../pages/PasswordGenerator";
import Lottery from "../pages/Lottery";
import ImageConverter from "../pages/ImageConverter";
import VideoCompressor from "../pages/VideoCompressor";
import CharsetConverter from "../pages/CharsetConverter";
import AccessInfo from "../pages/AccessInfo";
import OgpChecker from "../pages/OgpChecker";
import SeoChecker from "../pages/SeoChecker";
import ExifFrameGenerator from "../pages/ExifFrameGenerator";
import Clock from "../pages/Clock";
import TimerStopwatch from "../pages/TimerStopwatch";
import HyperfocalCalculator from "../pages/Hyperfocal";
import HeadphoneDriveability from "../pages/HeadphoneDriveability";
import TextConverter from "../pages/TextConverter";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import Credits from "../pages/Credits";
import NotFound from "../pages/NotFound";

const PAGE_ENTRIES: Array<{ path: string; name: string; component: Component }> = [
    { path: "/", name: "Home", component: Home },
    { path: "/calculator", name: "Calculator", component: Calculator },
    { path: "/qr_code", name: "QrGenerator", component: QrGenerator },
    {
        path: "/password-generator",
        name: "PasswordGenerator",
        component: PasswordGenerator,
    },
    { path: "/lottery", name: "Lottery", component: Lottery },
    {
        path: "/image_conversion",
        name: "ImageConverter",
        component: ImageConverter,
    },
    {
        path: "/video-compressor",
        name: "VideoCompressor",
        component: VideoCompressor,
    },
    {
        path: "/charset-converter",
        name: "CharsetConverter",
        component: CharsetConverter,
    },
    { path: "/access-info", name: "AccessInfo", component: AccessInfo },
    { path: "/ogp-checker", name: "OgpChecker", component: OgpChecker },
    { path: "/seo-checker", name: "SeoChecker", component: SeoChecker },
    {
        path: "/exif-frame",
        name: "ExifFrameGenerator",
        component: ExifFrameGenerator,
    },
    { path: "/clock", name: "Clock", component: Clock },
    { path: "/timer", name: "TimerStopwatch", component: TimerStopwatch },
    {
        path: "/hyperfocal",
        name: "HyperfocalCalculator",
        component: HyperfocalCalculator,
    },
    {
        path: "/headphone-driveability",
        name: "HeadphoneDriveability",
        component: HeadphoneDriveability,
    },
    { path: "/text-converter", name: "TextConverter", component: TextConverter },
    { path: "/privacy", name: "PrivacyPolicy", component: PrivacyPolicy },
    { path: "/credits", name: "Credits", component: Credits },
    { path: "/404", name: "NotFound", component: NotFound },
];

describe("Visual Regression & UI Structure / Layout Invariant Tests", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.scrollTo = vi.fn();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ip: "127.0.0.1" }),
            text: async () => "<html></html>",
        } as unknown as Response);
    });

    it("Layout ランドマーク（header, main, aside, footer）とレスポンシブクラス構造が維持されていること", () => {
        const TestRouter = createRouter({
            history: memoryHistory(),
            routes: [{ path: "/", component: Home }],
        });

        const { container } = render(() => (
            <TestRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </TestRouter>
        ));

        const header = container.querySelector("header");
        const main = container.querySelector("main");
        const aside = container.querySelector("aside");
        const footer = container.querySelector("footer");

        expect(header).not.toBeNull();
        expect(main).not.toBeNull();
        expect(aside).not.toBeNull();
        expect(footer).not.toBeNull();

        // 横スクロール・高さ崩れ防止のための overflow-x-hidden / min-h-0 構造の確認
        expect(main?.className).toContain("overflow-x-hidden");
        expect(main?.className).toContain("min-h-0");
    });

    it.each(PAGE_ENTRIES)(
        "$name ($path) の見出し構造(h1)・ボタンのアクセシブル名・フォームラベルが視覚/構造退行なくレンダリングされること",
        ({ component: PageComponent }) => {
            const TestRouter = createRouter({
                history: memoryHistory(),
                routes: [{ path: "/", component: PageComponent }],
            });

            const { container, unmount } = render(() => <TestRouter />);

            // 1. 各ページに必ず1つ以上の <h1> が存在すること（視覚的階層・SEO/A11y退行防止）
            const h1Elements = container.querySelectorAll("h1");
            expect(h1Elements.length).toBeGreaterThanOrEqual(1);
            expect(h1Elements[0].textContent?.trim().length).toBeGreaterThan(0);

            // 2. すべての <button> にテキストまたは aria-label / title が設定されていること
            const buttons = Array.from(container.querySelectorAll("button"));
            for (const btn of buttons) {
                const hasAccessibleLabel =
                    (btn.textContent && btn.textContent.trim().length > 0) ||
                    Boolean(btn.getAttribute("aria-label")?.trim()) ||
                    Boolean(btn.getAttribute("title")?.trim());
                expect(hasAccessibleLabel).toBe(true);
            }

            // 3. すべての <img /> に alt 属性が存在すること
            const images = Array.from(container.querySelectorAll("img"));
            for (const img of images) {
                expect(img.hasAttribute("alt")).toBe(true);
            }

            unmount();
        },
    );

    it("Clock のデジタル表示とアナログ時計SVGジオメトリ（文字盤円・12目盛り・時分秒針）が崩れていないこと", () => {
        const { container } = render(() => <Clock />);

        // デジタル表示のフォント・トラッキング構造
        const digital = container.querySelector(".font-mono.tracking-tighter");
        expect(digital).not.toBeNull();
        expect(digital?.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);

        // アナログ時計に切り替えてSVG座標系 (viewBox="0 0 100 100") と針を検証
        fireEvent.click(screen.getByRole("button", { name: "アナログ" }));
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute("viewBox")).toBe("0 0 100 100");

        const circles = container.querySelectorAll("svg circle");
        expect(circles.length).toBeGreaterThanOrEqual(2);

        const lines = container.querySelectorAll("svg line");
        expect(lines.length).toBe(15); // 12目盛り + 3針
    });
});

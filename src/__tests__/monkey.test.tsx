import { render, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

/**
 * 再現性のある決定論的疑似乱数生成器 (Mulberry32)
 */
function createSeededRandom(seed: number) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const FUZZ_STRINGS = [
    "",
    "   ",
    "https://tools.blossomsarchive.com/seo-checker?test=1&lang=ja#top",
    "://malformed-url-input",
    "javascript:alert(1)",
    "<<script>script>alert(1)</script><img src=x onerror=alert(1)>",
    "<!doctype html><html><head><title>MonkeyTest</title><meta name=\"description\" content=\"Monkey description\" /><script type=\"application/ld+json\">{broken_json</script></head><body><h1><<script>script>見出し</h1></body></html>",
    "# 見出し\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n**太字** `code`",
    "🌸👨‍👩‍👧‍👦𠮟テスト文字列\r\n改行2行目\n3行目",
    "48656c6c6f20576f726c64",
    "SGVsbG8gV29ybGQ=",
    "A".repeat(400),
];

const FUZZ_NUMBERS = [
    "",
    "0",
    "-1",
    "-9999",
    "0.001",
    "1",
    "16",
    "32",
    "100",
    "999999",
    "NaN",
    "Infinity",
    "-Infinity",
    "1e50",
    "abc",
];

const MONKEY_TARGETS: Array<{
    name: string;
    path: string;
    component: Component;
    checkNoNaN?: boolean;
}> = [
    { name: "Home", path: "/", component: Home, checkNoNaN: true },
    {
        name: "Calculator",
        path: "/calculator",
        component: Calculator,
        checkNoNaN: true,
    },
    { name: "QrGenerator", path: "/qr_code", component: QrGenerator },
    {
        name: "PasswordGenerator",
        path: "/password-generator",
        component: PasswordGenerator,
        checkNoNaN: true,
    },
    {
        name: "Lottery",
        path: "/lottery",
        component: Lottery,
        checkNoNaN: true,
    },
    {
        name: "ImageConverter",
        path: "/image_conversion",
        component: ImageConverter,
    },
    {
        name: "VideoCompressor",
        path: "/video-compressor",
        component: VideoCompressor,
    },
    {
        name: "CharsetConverter",
        path: "/charset-converter",
        component: CharsetConverter,
    },
    { name: "AccessInfo", path: "/access-info", component: AccessInfo },
    { name: "OgpChecker", path: "/ogp-checker", component: OgpChecker },
    { name: "SeoChecker", path: "/seo-checker", component: SeoChecker },
    {
        name: "ExifFrameGenerator",
        path: "/exif-frame",
        component: ExifFrameGenerator,
    },
    { name: "Clock", path: "/clock", component: Clock, checkNoNaN: true },
    {
        name: "TimerStopwatch",
        path: "/timer",
        component: TimerStopwatch,
        checkNoNaN: true,
    },
    {
        name: "HyperfocalCalculator",
        path: "/hyperfocal",
        component: HyperfocalCalculator,
        checkNoNaN: true,
    },
    {
        name: "HeadphoneDriveability",
        path: "/headphone-driveability",
        component: HeadphoneDriveability,
        checkNoNaN: true,
    },
    {
        name: "TextConverter",
        path: "/text-converter",
        component: TextConverter,
    },
    {
        name: "PrivacyPolicy",
        path: "/privacy",
        component: PrivacyPolicy,
        checkNoNaN: true,
    },
    {
        name: "Credits",
        path: "/credits",
        component: Credits,
        checkNoNaN: true,
    },
    { name: "NotFound", path: "/404", component: NotFound, checkNoNaN: true },
];

describe("Monkey & Chaos Fuzz Testing Suite (All 19 Routes + 404)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.scrollTo = vi.fn();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
        globalThis.URL.createObjectURL = vi
            .fn()
            .mockReturnValue("blob:http://localhost/monkey-blob");
        globalThis.URL.revokeObjectURL = vi.fn();

        if (typeof HTMLDialogElement !== "undefined") {
            HTMLDialogElement.prototype.showModal =
                HTMLDialogElement.prototype.showModal || vi.fn();
            HTMLDialogElement.prototype.close =
                HTMLDialogElement.prototype.close || vi.fn();
        }
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
            () => {},
        );

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () =>
                "<!doctype html><html><head><title>MockTitle</title><meta name=\"description\" content=\"MockDesc\" /></head><body><h1>MockH1</h1></body></html>",
            json: async () => ({
                status: "success",
                ip: "203.0.113.1",
                data: {
                    title: "MockTitle",
                    description: "MockDesc",
                    url: "https://example.com",
                },
            }),
        } as unknown as Response);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it.each(
        MONKEY_TARGETS.map((target, seedIndex) => ({ ...target, seedIndex })),
    )(
        "Monkey Test: $name ($path) に80回のランダム操作・境界値ファジングを加えても例外・画面崩壊・NaN露出が発生しないこと",
        ({ component: PageComponent, checkNoNaN, seedIndex }) => {
            const rand = createSeededRandom(0x20261119 + seedIndex * 997);

            const MonkeyRouter = createRouter({
                history: memoryHistory(),
                routes: [
                    { path: "/", component: PageComponent },
                    { path: "*all", component: PageComponent },
                ],
            });

            const { container, unmount } = render(() => <MonkeyRouter />);
            expect(container.innerHTML.trim().length).toBeGreaterThan(0);

            const ACTIONS_PER_PAGE = 80;

            for (let step = 0; step < ACTIONS_PER_PAGE; step++) {
                const buttons = Array.from(
                    container.querySelectorAll<HTMLButtonElement>(
                        "button:not([disabled])",
                    ),
                );
                const inputs = Array.from(
                    container.querySelectorAll<HTMLInputElement>(
                        'input:not([disabled]):not([type="file"])',
                    ),
                );
                const textareas = Array.from(
                    container.querySelectorAll<HTMLTextAreaElement>(
                        "textarea:not([disabled])",
                    ),
                );
                const selects = Array.from(
                    container.querySelectorAll<HTMLSelectElement>(
                        "select:not([disabled])",
                    ),
                );
                const forms = Array.from(
                    container.querySelectorAll<HTMLFormElement>("form"),
                );

                const totalInteractive =
                    buttons.length +
                    inputs.length +
                    textareas.length +
                    selects.length +
                    forms.length;

                if (totalInteractive === 0) break;

                const roll = rand();

                if (roll < 0.4 && buttons.length > 0) {
                    const btn = buttons[Math.floor(rand() * buttons.length)];
                    fireEvent.click(btn);
                } else if (roll < 0.7 && inputs.length > 0) {
                    const input = inputs[Math.floor(rand() * inputs.length)];
                    const type = (input.type || "text").toLowerCase();

                    if (type === "checkbox" || type === "radio") {
                        fireEvent.click(input);
                    } else if (type === "number" || type === "range") {
                        const val =
                            FUZZ_NUMBERS[
                                Math.floor(rand() * FUZZ_NUMBERS.length)
                            ];
                        fireEvent.input(input, { target: { value: val } });
                        fireEvent.change(input, { target: { value: val } });
                    } else if (type === "color") {
                        const colors = [
                            "#000000",
                            "#ffffff",
                            "#ff0055",
                            "invalid",
                        ];
                        const val =
                            colors[Math.floor(rand() * colors.length)];
                        fireEvent.input(input, { target: { value: val } });
                        fireEvent.change(input, { target: { value: val } });
                    } else {
                        const val =
                            FUZZ_STRINGS[
                                Math.floor(rand() * FUZZ_STRINGS.length)
                            ];
                        fireEvent.input(input, { target: { value: val } });
                        fireEvent.change(input, { target: { value: val } });
                    }
                } else if (roll < 0.85 && textareas.length > 0) {
                    const ta =
                        textareas[Math.floor(rand() * textareas.length)];
                    const val =
                        FUZZ_STRINGS[Math.floor(rand() * FUZZ_STRINGS.length)];
                    fireEvent.input(ta, { target: { value: val } });
                    fireEvent.change(ta, { target: { value: val } });
                } else if (roll < 0.95 && selects.length > 0) {
                    const sel = selects[Math.floor(rand() * selects.length)];
                    const options = Array.from(sel.options);
                    if (options.length > 0) {
                        const opt =
                            options[Math.floor(rand() * options.length)];
                        fireEvent.change(sel, {
                            target: { value: opt.value },
                        });
                        fireEvent.input(sel, {
                            target: { value: opt.value },
                        });
                    }
                } else if (forms.length > 0) {
                    const form = forms[Math.floor(rand() * forms.length)];
                    fireEvent.submit(form);
                } else if (buttons.length > 0) {
                    const btn = buttons[Math.floor(rand() * buttons.length)];
                    fireEvent.click(btn);
                }

                // 各ステップ後にDOMが空になっていないことを検証
                expect(container.innerHTML.trim().length).toBeGreaterThan(0);

                if (checkNoNaN) {
                    const text = container.textContent || "";
                    expect(text).not.toContain("NaN");
                }
            }

            unmount();
        },
    );

    it("Full-App Cross-Route Chaos Monkey Test: Layout + 全19ルート間で150回のランダム画面遷移・テーマ切替・要素操作を連続実行してもクラッシュしないこと", () => {
        const rand = createSeededRandom(0x99887766);

        const AppChaosRouter = createRouter({
            history: memoryHistory(),
            routes: [
                ...MONKEY_TARGETS.map((t) => ({
                    path: t.path,
                    component: t.component,
                })),
                { path: "*404", component: NotFound },
            ],
        });

        const { container, unmount } = render(() => (
            <AppChaosRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </AppChaosRouter>
        ));

        for (let step = 0; step < 150; step++) {
            const internalLinks = Array.from(
                container.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'),
            );
            const buttons = Array.from(
                container.querySelectorAll<HTMLButtonElement>(
                    "button:not([disabled])",
                ),
            );
            const inputs = Array.from(
                container.querySelectorAll<HTMLInputElement>(
                    'input:not([disabled]):not([type="file"])',
                ),
            );
            const textareas = Array.from(
                container.querySelectorAll<HTMLTextAreaElement>(
                    "textarea:not([disabled])",
                ),
            );

            const roll = rand();
            if (roll < 0.25 && internalLinks.length > 0) {
                const link =
                    internalLinks[Math.floor(rand() * internalLinks.length)];
                fireEvent.click(link);
            } else if (roll < 0.65 && buttons.length > 0) {
                const btn = buttons[Math.floor(rand() * buttons.length)];
                fireEvent.click(btn);
            } else if (roll < 0.85 && inputs.length > 0) {
                const input = inputs[Math.floor(rand() * inputs.length)];
                const type = (input.type || "text").toLowerCase();
                if (type === "checkbox" || type === "radio") {
                    fireEvent.click(input);
                } else if (type === "number" || type === "range") {
                    const val =
                        FUZZ_NUMBERS[
                            Math.floor(rand() * FUZZ_NUMBERS.length)
                        ];
                    fireEvent.input(input, { target: { value: val } });
                } else {
                    const val =
                        FUZZ_STRINGS[
                            Math.floor(rand() * FUZZ_STRINGS.length)
                        ];
                    fireEvent.input(input, { target: { value: val } });
                }
            } else if (textareas.length > 0) {
                const ta =
                    textareas[Math.floor(rand() * textareas.length)];
                const val =
                    FUZZ_STRINGS[Math.floor(rand() * FUZZ_STRINGS.length)];
                fireEvent.input(ta, { target: { value: val } });
            }

            expect(container.querySelector("header")).not.toBeNull();
            expect(container.querySelector("main")).not.toBeNull();
            expect(container.innerHTML.trim().length).toBeGreaterThan(0);
        }

        unmount();
    });
});

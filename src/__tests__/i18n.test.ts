import { describe, expect, it } from "vitest";
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    getHreflangLinks,
    getLocaleFromPath,
    getPathWithLocale,
    getPathWithoutLocale,
    getUiTranslations,
    usePageI18n,
} from "../i18n/index";
import { ROUTE_TRANSLATIONS, getLocalizedRouteMeta } from "../i18n/routeTranslations";
import {
    getPageJsonLd,
    getPageMetadata,
    routes,
    SITE_URL,
    SITE_TITLE,
} from "../routes";

describe("i18n / Internationalization System", () => {
    it("6言語すべて（ja, en, ko, zh-hans, zh-hant, ru）がサポート定義されていること", () => {
        expect(ALL_LOCALES).toEqual(["ja", "en", "ko", "zh-hans", "zh-hant", "ru"]);
        expect(DEFAULT_LOCALE).toBe("ja");

        for (const loc of ALL_LOCALES) {
            const config = SUPPORTED_LOCALES[loc];
            expect(config).toBeDefined();
            expect(config.code).toBe(loc);
            expect(config.langTag).toBeTruthy();
            expect(config.ogLocale).toBeTruthy();
            expect(config.label).toBeTruthy();
        }
    });

    describe("URLヘルパー関数", () => {
        it("getLocaleFromPath: パスからロケールを正確に抽出できること", () => {
            expect(getLocaleFromPath("/")).toBe("ja");
            expect(getLocaleFromPath("/calculator")).toBe("ja");
            expect(getLocaleFromPath("/en")).toBe("en");
            expect(getLocaleFromPath("/en/")).toBe("en");
            expect(getLocaleFromPath("/en/calculator")).toBe("en");
            expect(getLocaleFromPath("/ko/qr_code")).toBe("ko");
            expect(getLocaleFromPath("/zh-hans/timer")).toBe("zh-hans");
            expect(getLocaleFromPath("/zh-hant/clock")).toBe("zh-hant");
            expect(getLocaleFromPath("/ru/exposure-calculator")).toBe("ru");
            expect(getLocaleFromPath("/unknown/page")).toBe("ja");
        });

        it("getPathWithoutLocale: ロケールプレフィックスを取り除いた正規パスを返すこと", () => {
            expect(getPathWithoutLocale("/")).toBe("/");
            expect(getPathWithoutLocale("/calculator")).toBe("/calculator");
            expect(getPathWithoutLocale("/en")).toBe("/");
            expect(getPathWithoutLocale("/en/")).toBe("/");
            expect(getPathWithoutLocale("/en/calculator")).toBe("/calculator");
            expect(getPathWithoutLocale("/ko/qr_code")).toBe("/qr_code");
            expect(getPathWithoutLocale("/zh-hans/timer")).toBe("/timer");
            expect(getPathWithoutLocale("/zh-hant/clock")).toBe("/clock");
            expect(getPathWithoutLocale("/ru/exposure-calculator")).toBe("/exposure-calculator");
        });

        it("getPathWithLocale: 指定ロケール用のURLパスを生成できること", () => {
            expect(getPathWithLocale("/", "ja")).toBe("/");
            expect(getPathWithLocale("/calculator", "ja")).toBe("/calculator");
            expect(getPathWithLocale("/", "en")).toBe("/en");
            expect(getPathWithLocale("/calculator", "en")).toBe("/en/calculator");
            expect(getPathWithLocale("/calculator", "ko")).toBe("/ko/calculator");
            expect(getPathWithLocale("/calculator", "zh-hans")).toBe("/zh-hans/calculator");
            expect(getPathWithLocale("/calculator", "zh-hant")).toBe("/zh-hant/calculator");
            expect(getPathWithLocale("/calculator", "ru")).toBe("/ru/calculator");

            // 既に言語プレフィックスがあるパスでも正規化されて変換できること
            expect(getPathWithLocale("/en/calculator", "ko")).toBe("/ko/calculator");
            expect(getPathWithLocale("/ko/calculator", "ja")).toBe("/calculator");
        });

        it("getHreflangLinks: 全6言語とx-defaultを含む完全なhreflangリストを生成すること", () => {
            const links = getHreflangLinks("/calculator", SITE_URL);
            expect(links).toHaveLength(7); // 6言語 + 1 x-default

            const jaLink = links.find((l) => l.lang === "ja");
            const enLink = links.find((l) => l.lang === "en");
            const koLink = links.find((l) => l.lang === "ko");
            const zhHansLink = links.find((l) => l.lang === "zh-Hans");
            const zhHantLink = links.find((l) => l.lang === "zh-Hant");
            const ruLink = links.find((l) => l.lang === "ru");
            const xDefaultLink = links.find((l) => l.lang === "x-default");

            expect(jaLink?.href).toBe(`${SITE_URL}/calculator`);
            expect(enLink?.href).toBe(`${SITE_URL}/en/calculator`);
            expect(koLink?.href).toBe(`${SITE_URL}/ko/calculator`);
            expect(zhHansLink?.href).toBe(`${SITE_URL}/zh-hans/calculator`);
            expect(zhHantLink?.href).toBe(`${SITE_URL}/zh-hant/calculator`);
            expect(ruLink?.href).toBe(`${SITE_URL}/ru/calculator`);
            expect(xDefaultLink?.href).toBe(`${SITE_URL}/calculator`);
        });
    });

    describe("SEOメタデータ品質基準（AGENTS.md）", () => {
        it("全ルート × 全6言語でタイトルが15〜60文字、説明文が50〜160文字の範囲内であること", () => {
            for (const route of routes) {
                if (route.path === "*") continue;
                for (const loc of ALL_LOCALES) {
                    const meta = getPageMetadata(route.path, loc);
                    const titleLen = meta.title.length;
                    const descLen = meta.description.length;

                    expect(
                        titleLen,
                        `Title length for [${loc}] ${route.path} ("${meta.title}") must be between 15 and 60 chars`,
                    ).toBeGreaterThanOrEqual(15);
                    expect(
                        titleLen,
                        `Title length for [${loc}] ${route.path} ("${meta.title}") must be between 15 and 60 chars`,
                    ).toBeLessThanOrEqual(60);

                    expect(
                        descLen,
                        `Desc length for [${loc}] ${route.path} ("${meta.description}") must be between 50 and 160 chars`,
                    ).toBeGreaterThanOrEqual(50);
                    expect(
                        descLen,
                        `Desc length for [${loc}] ${route.path} ("${meta.description}") must be between 50 and 160 chars`,
                    ).toBeLessThanOrEqual(160);
                }
            }
        });

        it("getPageMetadata: 言語別URLから自動的にロケールメタデータを取得できること", () => {
            const enMeta = getPageMetadata("/en/calculator");
            expect(enMeta.locale).toBe("en");
            expect(enMeta.langTag).toBe("en");
            expect(enMeta.ogLocale).toBe("en_US");
            expect(enMeta.url).toBe(`${SITE_URL}/en/calculator`);
            expect(enMeta.title).toContain("Online Calculator");

            const jaMeta = getPageMetadata("/calculator");
            expect(jaMeta.locale).toBe("ja");
            expect(jaMeta.langTag).toBe("ja");
            expect(jaMeta.ogLocale).toBe("ja_JP");
            expect(jaMeta.url).toBe(`${SITE_URL}/calculator`);
            expect(jaMeta.title).toContain("電卓ツール");
        });

        it("getPageJsonLd: 言語に応じた正しいinLanguageと構造化データを出力すること", () => {
            const enJsonLd = getPageJsonLd("/en/calculator");
            const website = enJsonLd["@graph"].find((item) => item["@type"] === "WebSite");
            const webPage = enJsonLd["@graph"].find((item) => item["@type"] === "WebPage");
            const webApp = enJsonLd["@graph"].find((item) => item["@type"] === "WebApplication");

            expect(website?.inLanguage).toBe("en");
            expect(webPage?.inLanguage).toBe("en");
            expect(webApp?.inLanguage).toBe("en");
            expect(webPage?.url).toBe(`${SITE_URL}/en/calculator`);
        });
    });

    describe("共通UI翻訳辞書", () => {
        it("全6言語で主要UIキーが漏れなく定義されていること", () => {
            for (const loc of ALL_LOCALES) {
                const ui = getUiTranslations(loc);
                expect(ui.siteTitle).toBe("BlossomsArchive Tools");
                expect(ui.searchPlaceholder).toBeTruthy();
                expect(ui.favorites).toBeTruthy();
                expect(ui.allTools).toBeTruthy();
                expect(ui.home).toBeTruthy();
                expect(ui.privacyPolicy).toBeTruthy();
                expect(ui.credits).toBeTruthy();
                expect(ui.share).toBeTruthy();
                expect(ui.themeLight).toBeTruthy();
                expect(ui.themeDark).toBeTruthy();
                expect(ui.languageSelectorLabel).toBeTruthy();
                expect(ui.homeTitle).toBeTruthy();
                expect(ui.homeSubtitle).toBeTruthy();
                expect(ui.homeSearchPlaceholder).toBeTruthy();
                expect(ui.tryTool).toBeTruthy();
            }
        });
    });

    describe("getLocalizedRouteMeta & usePageI18n", () => {
        it("getLocalizedRouteMeta: 指定言語のルートメタデータを正確に取得できること", () => {
            const enCalc = getLocalizedRouteMeta("/calculator", "en");
            expect(enCalc.title).toBe("Online Calculator");
            expect(enCalc.description).toContain("online calculator");

            const jaCalc = getLocalizedRouteMeta("/calculator", "ja");
            expect(jaCalc.title).toBe("電卓ツール");
            expect(jaCalc.description).toContain("計算履歴を自動保存");
        });

        it("usePageI18n: デフォルトタイトル・説明文と翻訳結果のフォールバックが正しく動作すること", () => {
            const pageI18n = usePageI18n("/calculator", {
                defaultTitle: "デフォルト電卓",
                defaultDescription: "デフォルト説明",
            });
            expect(pageI18n.locale()).toBeTruthy();
            expect(pageI18n.title()).toBeTruthy();
            expect(pageI18n.description()).toBeTruthy();
            expect(pageI18n.ui().home).toBeTruthy();
        });
    });
});

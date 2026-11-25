export type SupportedLocale =
    | "ja"
    | "en"
    | "ko"
    | "zh-hans"
    | "zh-hant"
    | "ru";

export interface LocaleConfig {
    code: SupportedLocale;
    langTag: string; // Used for HTML lang, hreflang, and inLanguage
    ogLocale: string; // Used for og:locale
    label: string; // Native name for selector
    prefix: string; // URL prefix, e.g. "" for ja, "/en" for en
}

export const DEFAULT_LOCALE: SupportedLocale = "ja";

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleConfig> = {
    ja: {
        code: "ja",
        langTag: "ja",
        ogLocale: "ja_JP",
        label: "日本語",
        prefix: "",
    },
    en: {
        code: "en",
        langTag: "en",
        ogLocale: "en_US",
        label: "English",
        prefix: "/en",
    },
    ko: {
        code: "ko",
        langTag: "ko",
        ogLocale: "ko_KR",
        label: "한국어",
        prefix: "/ko",
    },
    "zh-hans": {
        code: "zh-hans",
        langTag: "zh-Hans",
        ogLocale: "zh_CN",
        label: "简体中文",
        prefix: "/zh-hans",
    },
    "zh-hant": {
        code: "zh-hant",
        langTag: "zh-Hant",
        ogLocale: "zh_TW",
        label: "繁體中文",
        prefix: "/zh-hant",
    },
    ru: {
        code: "ru",
        langTag: "ru",
        ogLocale: "ru_RU",
        label: "Русский",
        prefix: "/ru",
    },
};

export const ALL_LOCALES = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[];

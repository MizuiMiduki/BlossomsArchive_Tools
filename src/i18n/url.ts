import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from "./types";

/**
 * URLパスから言語ロケールを抽出する。
 * 例:
 *  "/en/calculator" -> "en"
 *  "/en" -> "en"
 *  "/calculator" -> "ja"
 *  "/" -> "ja"
 */
export function getLocaleFromPath(pathname: string): SupportedLocale {
    if (!pathname) return DEFAULT_LOCALE;
    const cleanPath = pathname.split("?")[0].split("#")[0];
    const segments = cleanPath.split("/").filter(Boolean);
    if (segments.length === 0) return DEFAULT_LOCALE;

    const first = segments[0].toLowerCase();
    const matched = ALL_LOCALES.find(
        (loc) => loc !== DEFAULT_LOCALE && loc === first,
    );
    return matched ?? DEFAULT_LOCALE;
}

/**
 * ロケールプレフィックスを取り除いた正規化された内部パスを返す。
 * 例:
 *  "/en/calculator" -> "/calculator"
 *  "/en" -> "/"
 *  "/calculator" -> "/calculator"
 *  "/" -> "/"
 */
export function getPathWithoutLocale(pathname: string): string {
    if (!pathname) return "/";
    const cleanPath = pathname.split("?")[0].split("#")[0];
    const segments = cleanPath.split("/").filter(Boolean);
    if (segments.length === 0) return "/";

    const first = segments[0].toLowerCase();
    if (ALL_LOCALES.some((loc) => loc !== DEFAULT_LOCALE && loc === first)) {
        const remaining = segments.slice(1).join("/");
        return remaining ? `/${remaining}` : "/";
    }
    return `/${segments.join("/")}`;
}

/**
 * 内部パスを指定ロケール用のパスに変換する。
 * 例:
 *  ("/calculator", "en") -> "/en/calculator"
 *  ("/", "en") -> "/en"
 *  ("/calculator", "ja") -> "/calculator"
 *  ("/", "ja") -> "/"
 */
export function getPathWithLocale(
    basePath: string,
    locale: SupportedLocale,
): string {
    const cleanBase = getPathWithoutLocale(basePath);
    const config = SUPPORTED_LOCALES[locale] ?? SUPPORTED_LOCALES[DEFAULT_LOCALE];
    if (!config.prefix) {
        return cleanBase === "" ? "/" : cleanBase;
    }
    return cleanBase === "/" ? config.prefix : `${config.prefix}${cleanBase}`;
}

/**
 * SEO用の全言語hreflangリンク一覧を生成する。
 */
export function getHreflangLinks(
    pathname: string,
    siteUrl: string,
): { lang: string; href: string }[] {
    const cleanBase = getPathWithoutLocale(pathname);
    const links: { lang: string; href: string }[] = [];

    for (const loc of ALL_LOCALES) {
        const config = SUPPORTED_LOCALES[loc];
        const localizedPath = getPathWithLocale(cleanBase, loc);
        const url = `${siteUrl}${localizedPath === "/" ? "/" : localizedPath}`;
        links.push({
            lang: config.langTag,
            href: url,
        });
    }

    // x-default はデフォルト言語（ja）のURL
    const defaultLocalizedPath = getPathWithLocale(cleanBase, DEFAULT_LOCALE);
    const defaultUrl = `${siteUrl}${defaultLocalizedPath === "/" ? "/" : defaultLocalizedPath}`;
    links.push({
        lang: "x-default",
        href: defaultUrl,
    });

    return links;
}

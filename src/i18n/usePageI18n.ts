import { useLocation } from "@solidjs/router";
import { createMemo } from "solid-js";
import type { SupportedLocale } from "./types";
import { getLocaleFromPath, getPathWithoutLocale } from "./url";
import { getUiTranslations, type UiTranslations } from "./translations";
import { getLocalizedRouteMeta, type LocalizedRouteMeta } from "./routeTranslations";

export interface PageI18nOptions {
    defaultTitle?: string;
    defaultDescription?: string;
}

export function usePageI18n(routePath?: string, options?: PageI18nOptions) {
    let location: { pathname: string };
    try {
        location = useLocation();
    } catch {
        location = { pathname: typeof window !== "undefined" ? window.location.pathname : (routePath || "/") };
    }

    const locale = createMemo<SupportedLocale>(() => getLocaleFromPath(location.pathname));
    const internalPath = createMemo(() => {
        const raw = getPathWithoutLocale(location.pathname);
        if (raw === "/" && routePath && routePath !== "/") {
            return routePath;
        }
        return raw;
    });

    const ui = createMemo<UiTranslations>(() => getUiTranslations(locale()));
    const meta = createMemo<LocalizedRouteMeta>(() => {
        const path = routePath || internalPath();
        const m = getLocalizedRouteMeta(path, locale());
        if (locale() === "ja") {
            return {
                title: options?.defaultTitle || m.title,
                description: options?.defaultDescription || m.description,
                keywords: m.keywords,
            };
        }
        return m;
    });

    return {
        locale,
        internalPath,
        ui,
        meta,
        title: () => meta().title,
        description: () => meta().description,
    };
}

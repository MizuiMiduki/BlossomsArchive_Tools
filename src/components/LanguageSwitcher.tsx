// src/components/LanguageSwitcher.tsx
import { For, Show, createSignal, onSettled } from "solid-js";
import { useLocation } from "@solidjs/router";
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    getLocaleFromPath,
    getPathWithLocale,
    getUiTranslations,
    type SupportedLocale,
} from "../i18n/index";

interface LanguageSwitcherProps {
    class?: string;
}

export default function LanguageSwitcher(props: LanguageSwitcherProps) {
    let location: { pathname: string };
    try {
        location = useLocation();
    } catch {
        location = { pathname: typeof window !== "undefined" ? window.location.pathname : "/" };
    }

    const [isOpen, setIsOpen] = createSignal(false);
    let dropdownRef: HTMLDivElement | undefined;

    const currentLocale = () => getLocaleFromPath(location.pathname);
    const ui = () => getUiTranslations(currentLocale());

    onSettled(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    });

    return (
        <div class={`relative inline-block text-left ${props.class || ""}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                class="btn btn-ghost btn-sm gap-1.5 px-2.5 h-9 min-h-[36px] font-medium border border-base-content/10 hover:border-base-content/30 transition-colors"
                aria-label={ui().languageSelectorLabel}
                aria-haspopup="true"
                aria-expanded={isOpen() ? "true" : "false"}
            >
                {/* 地球・言語アイコン */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4 text-base-content/70"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span class="text-xs uppercase font-semibold">
                    {SUPPORTED_LOCALES[currentLocale()]?.code === "zh-hans"
                        ? "简"
                        : SUPPORTED_LOCALES[currentLocale()]?.code === "zh-hant"
                          ? "繁"
                          : SUPPORTED_LOCALES[currentLocale()]?.code}
                </span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${isOpen() ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path
                        fill-rule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                    />
                </svg>
            </button>

            {isOpen() && (
                <div
                    class="absolute right-0 mt-1.5 w-44 rounded-xl shadow-2xl bg-base-100 border border-base-content/15 py-1.5 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
                    role="menu"
                    aria-orientation="vertical"
                >
                    <For each={ALL_LOCALES}>
                        {(loc: SupportedLocale) => {
                            const config = SUPPORTED_LOCALES[loc];
                            return (
                                <a
                                    href={getPathWithLocale(location.pathname, loc)}
                                    onClick={() => setIsOpen(false)}
                                    class={`flex items-center justify-between px-3.5 py-2 text-xs font-medium transition-colors ${
                                        currentLocale() === loc
                                            ? "bg-primary/10 text-primary font-bold"
                                            : "text-base-content/85 hover:bg-base-200 hover:text-base-content"
                                    }`}
                                    role="menuitem"
                                    aria-current={currentLocale() === loc ? "true" : undefined}
                                >
                                    <span>{config.label}</span>
                                    <Show when={currentLocale() === loc}>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="w-4 h-4 text-primary"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path
                                                fill-rule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clip-rule="evenodd"
                                            />
                                        </svg>
                                    </Show>
                                </a>
                            );
                        }}
                    </For>
                </div>
            )}
        </div>
    );
}

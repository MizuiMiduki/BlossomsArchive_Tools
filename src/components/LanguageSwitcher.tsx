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

    const currentDisplayLabel = () => {
        const loc = currentLocale();
        if (loc === "zh-hans") return "简";
        if (loc === "zh-hant") return "繁";
        return loc.toUpperCase();
    };

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
        <div class={`ba-lang-dropdown ${props.class || ""}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                class="ba-lang-trigger"
                aria-label={`${currentDisplayLabel()} - ${ui().languageSelectorLabel}`}
                aria-haspopup="true"
                aria-expanded={isOpen() ? "true" : "false"}
            >
                {/* 地球・言語アイコン */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="ba-icon-xs"
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
                <span>{currentDisplayLabel()}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="ba-icon-xs"
                    style={{
                        transform: isOpen() ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                        opacity: "0.7",
                    }}
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

            <Show when={isOpen()}>
                <div
                    class="ba-lang-menu"
                    role="menu"
                    aria-orientation="vertical"
                >
                    <For each={ALL_LOCALES}>
                        {(loc: SupportedLocale) => {
                            const config = SUPPORTED_LOCALES[loc];
                            const isCurrent = () => currentLocale() === loc;
                            return (
                                <a
                                    href={getPathWithLocale(location.pathname, loc)}
                                    onClick={() => setIsOpen(false)}
                                    class={`ba-lang-item ${isCurrent() ? "is-active" : ""}`}
                                    role="menuitem"
                                    aria-current={isCurrent() ? "true" : undefined}
                                >
                                    <span>{config.label}</span>
                                    <Show when={isCurrent()}>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="ba-icon-xs"
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
            </Show>
        </div>
    );
}

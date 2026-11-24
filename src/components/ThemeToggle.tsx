// src/components/ThemeToggle.tsx
import { createSignal, onSettled } from "solid-js";
import ToolIcon from "./ToolIcon";

export default function ThemeToggle() {
    let buttonRef: HTMLButtonElement | undefined;
    const [isDark, setIsDark] = createSignal(false);

    onSettled(() => {
        // 初回読み込み時にURLクエリパラメータ・localStorage・prefers-color-schemeを確認して反映します
        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const themeParam = urlParams?.get("theme");
        const savedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;

        if (themeParam === "dark" || (!themeParam && (savedTheme === "dark" || (!savedTheme && prefersDark)))) {
            document.documentElement.setAttribute("data-theme", "dark");
            setIsDark(true);
        } else {
            document.documentElement.setAttribute("data-theme", "light");
            setIsDark(false);
        }
    });

    const toggleTheme = () => {
        const newTheme = isDark() ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        setIsDark(!isDark());

        if (buttonRef && typeof buttonRef.animate === "function") {
            buttonRef.animate(
                [
                    { transform: "rotate(-90deg) scale(0.6)" },
                    { transform: "rotate(0deg) scale(1)" },
                ],
                {
                    duration: 350,
                    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                },
            );
        }
    };

    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={toggleTheme}
            class="ba-btn ba-btn--ghost ba-btn--circle"
            aria-label="Toggle Dark Mode"
        >
            <ToolIcon name={isDark() ? "sun" : "moon"} class="ba-icon-md" />
        </button>
    );
}


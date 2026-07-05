// src/components/ThemeToggle.tsx
import { createSignal, onMount } from "solid-js";

export default function ThemeToggle() {
    const [isDark, setIsDark] = createSignal(false);

    onMount(() => {
        // 初回読み込み時にlocalStorageを確認して反映します
        const savedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;

        if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
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
    };

    return (
        <button
            onClick={toggleTheme}
            class="btn btn-ghost btn-circle"
            aria-label="Toggle Dark Mode"
        >
            {isDark() ? "☀️" : "🌙"}
        </button>
    );
}

// src/components/ThemeToggle.tsx
import { createSignal, onSettled } from "solid-js";

export default function ThemeToggle() {
    let buttonRef: HTMLButtonElement | undefined;
    const [isDark, setIsDark] = createSignal(false);

    onSettled(() => {
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
            onClick={toggleTheme}
            class="btn btn-ghost btn-circle"
            aria-label="Toggle Dark Mode"
        >
            {isDark() ? "☀️" : "🌙"}
        </button>
    );
}


// src/components/ThemeToggle.tsx
import { createSignal, onMount } from "solid-js";
import gsap from "gsap";

export default function ThemeToggle() {
    let buttonRef: HTMLButtonElement | undefined;
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

        if (buttonRef) {
            gsap.fromTo(
                buttonRef,
                { rotation: -90, scale: 0.6 },
                { rotation: 0, scale: 1, duration: 0.4, ease: "back.out(2)" },
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


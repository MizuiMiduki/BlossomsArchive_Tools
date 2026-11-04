import { createEffect, onCleanup, Show } from "solid-js";
import { useLocation } from "@solidjs/router";

interface AdSenseProps {
    slot?: string;
    format?: string;
    class?: string;
}

declare global {
    interface Window {
        adsbygoogle?: unknown[];
    }
}

const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID;
const DEFAULT_SLOT = import.meta.env.VITE_ADSENSE_DEFAULT_SLOT;

/** コンテナ幅が確定するまで待つ間隔 (ms) */
const RETRY_INTERVAL_MS = 100;

/**
 * 広告ユニットを生成し、コンテナ幅が確定してから push する。
 * 幅0の状態で push すると AdSense がエラーを返すため、
 * push 直前まで "adsbygoogle" クラスを付与しない。
 * 戻り値はキャンセル用のクリーンアップ関数。
 */
function mountAd(
    container: HTMLDivElement,
    slot: string,
    format: string,
): () => void {
    container.innerHTML = "";

    const ins = document.createElement("ins");
    ins.className = "adsbygoogle-stealth";
    ins.style.display = "block";
    // Google の幅チェックを通すため <ins> 自体にも幅を指定する
    ins.style.width = "100%";
    ins.style.minWidth = "250px";
    ins.dataset.adClient = CLIENT_ID;
    ins.dataset.adSlot = slot;
    ins.dataset.adFormat = format;
    ins.dataset.fullWidthResponsive = "true";
    container.appendChild(ins);

    let timerId: number | undefined;
    let userScrolled = false;

    const markUserScrolled = () => {
        userScrolled = true;
    };

    window.addEventListener("wheel", markUserScrolled, { passive: true });
    window.addEventListener("touchmove", markUserScrolled, { passive: true });
    window.addEventListener("pointerdown", markUserScrolled, { passive: true });
    window.addEventListener("keydown", markUserScrolled, { passive: true });

    const keepTopIfNotScrolled = () => {
        if (userScrolled || window.location.hash) return;
        const mainEl = document.querySelector("main");
        if (mainEl) {
            mainEl.scrollTop = 0;
            mainEl.scrollTo?.({
                top: 0,
                left: 0,
                behavior: "instant" as ScrollBehavior,
            });
        }
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    };

    let mutationObserver: MutationObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const tryPush = () => {
        if (container.offsetWidth === 0) {
            timerId = window.setTimeout(tryPush, RETRY_INTERVAL_MS);
            return;
        }
        const mainEl = document.querySelector("main");
        const wasAtTop =
            !userScrolled &&
            (mainEl ? mainEl.scrollTop <= 1 : true) &&
            window.scrollY <= 1;

        if (wasAtTop) {
            if (typeof MutationObserver !== "undefined") {
                mutationObserver = new MutationObserver(keepTopIfNotScrolled);
                mutationObserver.observe(container, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                });
            }
            if (typeof ResizeObserver !== "undefined") {
                resizeObserver = new ResizeObserver(keepTopIfNotScrolled);
                resizeObserver.observe(container);
                resizeObserver.observe(ins);
            }
        }

        try {
            ins.className = "adsbygoogle";
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense push error:", e);
        }

        if (wasAtTop) {
            keepTopIfNotScrolled();
            requestAnimationFrame(keepTopIfNotScrolled);
        }
    };

    timerId = window.setTimeout(tryPush, RETRY_INTERVAL_MS);

    return () => {
        window.clearTimeout(timerId);
        mutationObserver?.disconnect();
        resizeObserver?.disconnect();
        window.removeEventListener("wheel", markUserScrolled);
        window.removeEventListener("touchmove", markUserScrolled);
        window.removeEventListener("pointerdown", markUserScrolled);
        window.removeEventListener("keydown", markUserScrolled);
    };
}

function AdSenseUnit(props: AdSenseProps) {
    const location = useLocation();
    let container!: HTMLDivElement;

    createEffect(() => {
        // ルート遷移時に広告を再生成する
        location.pathname;
        const slot = props.slot ?? DEFAULT_SLOT;
        if (!slot) return;

        onCleanup(mountAd(container, slot, props.format ?? "auto"));
    });

    return (
        <div
            ref={container}
            class={`my-6 flex justify-center overflow-hidden w-full min-h-[90px] [overflow-anchor:none] ${props.class ?? ""}`}
        />
    );
}

export default function AdSense(props: AdSenseProps) {
    return (
        <Show when={CLIENT_ID}>
            <AdSenseUnit {...props} />
        </Show>
    );
}

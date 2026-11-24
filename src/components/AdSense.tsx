import { createEffect, Show } from "solid-js";
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
    let timerId: number | undefined;
    let isMounted = false;

    const startMount = () => {
        if (isMounted) return;
        isMounted = true;
        cleanupTriggers();

        container.textContent = "";
        const ins = document.createElement("ins");
        ins.className = "adsbygoogle-stealth";
        ins.style.display = "block";
        ins.style.width = "100%";
        ins.style.minWidth = "250px";
        ins.style.minHeight = "250px";
        ins.dataset.adClient = CLIENT_ID;
        ins.dataset.adSlot = slot;
        ins.dataset.adFormat = format;
        ins.dataset.fullWidthResponsive = "true";
        container.appendChild(ins);

        const tryPush = () => {
            if (container.offsetWidth === 0) {
                timerId = window.setTimeout(tryPush, RETRY_INTERVAL_MS);
                return;
            }
            try {
                ins.className = "adsbygoogle";
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.error("AdSense push error:", e);
            }
        };

        timerId = window.setTimeout(tryPush, RETRY_INTERVAL_MS);
    };

    const cleanupTriggers = () => {
        window.removeEventListener("pointerdown", startMount);
        window.removeEventListener("touchstart", startMount);
        window.removeEventListener("keydown", startMount);
        window.removeEventListener("wheel", startMount);
        window.removeEventListener("click", startMount);
    };

    window.addEventListener("pointerdown", startMount, { passive: true, once: true });
    window.addEventListener("touchstart", startMount, { passive: true, once: true });
    window.addEventListener("keydown", startMount, { passive: true, once: true });
    window.addEventListener("wheel", startMount, { passive: true, once: true });
    window.addEventListener("click", startMount, { passive: true, once: true });

    return () => {
        cleanupTriggers();
        window.clearTimeout(timerId);
    };
}

function AdSenseUnit(props: AdSenseProps) {
    const location = useLocation();
    let container!: HTMLDivElement;

    createEffect(
        () => ({
            pathname: location.pathname,
            slot: props.slot ?? DEFAULT_SLOT,
            format: props.format ?? "auto",
        }),
        ({ slot, format }) => {
            if (!slot || !container) return;
            return mountAd(container, slot, format);
        }
    );

    return (
        <div
            ref={container}
            class={`ba-adsense ${props.class ?? ""}`}
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

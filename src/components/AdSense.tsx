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

    return () => window.clearTimeout(timerId);
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
            class={`my-6 flex justify-center overflow-hidden w-full min-h-[90px] ${props.class ?? ""}`}
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

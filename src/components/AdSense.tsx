import { createEffect, onCleanup } from "solid-js";
import { useLocation } from "@solidjs/router";

interface AdSenseProps {
    slot: string;
    format?: string;
    responsive?: string;
    class?: string;
}

export default function AdSense(props: AdSenseProps) {
    const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
    if (!clientId) return null;

    const location = useLocation();
    let containerRef!: HTMLDivElement;

    createEffect(() => {
        // location.pathname を追跡：マウント時・ページ遷移時に実行される
        location.pathname;

        if (!containerRef) return;

        // 前の広告をクリアして、新しい ins 要素を作り直す
        containerRef.innerHTML = "";

        const ins = document.createElement("ins");
        ins.className = "adsbygoogle";
        ins.style.display = "block";
        ins.dataset.adClient = clientId;
        ins.dataset.adSlot = props.slot;
        ins.dataset.adFormat = props.format ?? "auto";
        ins.dataset.fullWidthResponsive = props.responsive ?? "true";
        containerRef.appendChild(ins);

        // DOMへの追加が完全に完了してから push する
        const timer = setTimeout(() => {
            try {
                ((window as any).adsbygoogle =
                    (window as any).adsbygoogle || []).push({});
            } catch (e) {
                console.error("AdSense error:", e);
            }
        }, 100);

        onCleanup(() => clearTimeout(timer));
    });

    return (
        <div
            ref={containerRef!}
            class={`my-6 flex justify-center overflow-hidden w-full ${props.class ?? ""}`}
        />
    );
}

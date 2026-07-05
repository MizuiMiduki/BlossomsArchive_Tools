import { createEffect, onCleanup } from "solid-js";
import { useLocation } from "@solidjs/router";

interface AdSenseProps {
    slot: string;
    format?: string;
    class?: string;
}

export default function AdSense(props: AdSenseProps) {
    const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
    if (!clientId) return null;

    const location = useLocation();
    let container!: HTMLDivElement;

    createEffect(() => {
        // ルート変化を追跡（マウント時・ページ遷移時に実行）
        location.pathname;

        if (!container) return;

        // 前の ins 要素を完全に除去
        container.innerHTML = "";

        // 新しい ins 要素を生成
        const ins = document.createElement("ins");
        ins.className = "adsbygoogle";
        ins.style.display = "block";
        ins.setAttribute("data-ad-client", clientId);
        ins.setAttribute("data-ad-slot", props.slot);
        ins.setAttribute("data-ad-format", props.format ?? "auto");
        ins.setAttribute("data-full-width-responsive", "true");
        container.appendChild(ins);

        // rAF で ins が DOM に確定してから push する
        const raf = requestAnimationFrame(() => {
            try {
                ((window as any).adsbygoogle =
                    (window as any).adsbygoogle || []).push({});
            } catch (e) {
                console.error("AdSense error:", e);
            }
        });

        onCleanup(() => cancelAnimationFrame(raf));
    });

    return (
        <div
            ref={container!}
            class={`my-6 flex justify-center overflow-hidden w-full ${props.class ?? ""}`}
        />
    );
}

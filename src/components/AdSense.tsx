// src/components/AdSense.tsx
import { createEffect, createMemo, onCleanup } from "solid-js";
import { useLocation } from "@solidjs/router";

interface AdSenseProps {
    slot: string;
    format?: string;
    class?: string;
}

export default function AdSense(props: AdSenseProps) {
    const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;

    // クライアントIDがない場合は何も表示しない（エラー防止）
    if (!clientId) return null;

    const location = useLocation();

    // 現在のルートとスロットを監視して、変化があったら効果を再実行する
    const key = createMemo(() => location.pathname + props.slot);

    let container!: HTMLDivElement;

    createEffect(() => {
        // key() を参照することで、ルート変化やslot変更を検知する
        key();

        if (!container) return;

        // 1. 中身を一度完全に空にする
        container.innerHTML = "";

        // 2. <ins> 要素を新しく生成
        const ins = document.createElement("ins");
        ins.className = "adsbygoogle";
        ins.style.display = "block";
        ins.setAttribute("data-ad-client", clientId);
        ins.setAttribute("data-ad-slot", props.slot);
        ins.setAttribute("data-ad-format", props.format ?? "auto");
        ins.setAttribute("data-full-width-responsive", "true");
        container.appendChild(ins);

        // 3. AdSenseの初期化処理
        try {
            (window as any).adsbygoogle = (window as any).adsbygoogle || [];
            (window as any).adsbygoogle.push({});
        } catch (e) {
            console.error("AdSense error:", e);
        }
    });

    return (
        <div
            ref={container!}
            class={`my-6 flex justify-center overflow-hidden w-full ${props.class ?? ""}`}
        />
    );
}

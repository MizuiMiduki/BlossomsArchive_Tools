import { onMount, createUniqueId } from "solid-js";

interface AdSenseProps {
    slot: string;
    format?: string;
    responsive?: string;
    class?: string;
    style?: any;
}

export default function AdSense(props: AdSenseProps) {
    const id = createUniqueId();

    onMount(() => {
        // DOMに要素が完全にマウントされた後、わずかに遅延させて初期化します
        const timer = setTimeout(() => {
            try {
                const insEl = document.getElementById(id);
                if (insEl) {
                    // SPAのページ遷移で要素が再利用・再描画された場合に備えて、AdSenseの処理ステータスをリセット
                    insEl.removeAttribute("data-adsbygoogle-status");
                    insEl.innerHTML = "";
                }
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            } catch (e) {
                console.error("AdSense tracking error:", e);
            }
        }, 150);

        return () => clearTimeout(timer);
    });

    const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;

    if (!clientId) {
        return null;
    }

    return (
        <div class={`my-6 flex justify-center overflow-hidden w-full ${props.class || ""}`}>
            <ins
                id={id}
                class="adsbygoogle"
                style={props.style || { display: "block" }}
                data-ad-client={clientId}
                data-ad-slot={props.slot}
                data-ad-format={props.format || "auto"}
                data-full-width-responsive={props.responsive || "true"}
            />
        </div>
    );
}

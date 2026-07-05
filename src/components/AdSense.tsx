import { createEffect, createSignal, Show, onMount, onCleanup } from "solid-js";
import { useLocation } from "@solidjs/router";

interface AdSenseProps {
    slot: string;
    format?: string;
    responsive?: string;
    class?: string;
}

// ルート変更のたびに完全リマウントされる内部コンポーネント
function AdSlot(props: AdSenseProps & { clientId: string }) {
    onMount(() => {
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
        <div class={`my-6 flex justify-center overflow-hidden w-full ${props.class ?? ""}`}>
            <ins
                class="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client={props.clientId}
                data-ad-slot={props.slot}
                data-ad-format={props.format ?? "auto"}
                data-full-width-responsive={props.responsive ?? "true"}
            />
        </div>
    );
}

export default function AdSense(props: AdSenseProps) {
    const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
    if (!clientId) return null;

    const location = useLocation();
    // ルートが変わるたびに新しい文字列が入るシグナル
    const [pathname, setPathname] = createSignal(location.pathname);

    createEffect(() => {
        setPathname(location.pathname);
    });

    // keyed=true: pathname の値が変わると AdSlot を完全に破棄→再生成する
    return (
        <Show when={pathname()} keyed>
            <AdSlot {...props} clientId={clientId} />
        </Show>
    );
}

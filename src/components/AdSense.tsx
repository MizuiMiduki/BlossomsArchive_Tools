import { onMount } from "solid-js";

interface AdSenseProps {
    slot: string;
    format?: string;
    responsive?: string;
    class?: string;
    style?: any;
}

export default function AdSense(props: AdSenseProps) {
    onMount(() => {
        try {
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense tracking error:", e);
        }
    });

    const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;

    if (!clientId) {
        return null;
    }

    return (
        <div class={`my-6 flex justify-center overflow-hidden w-full ${props.class || ""}`}>
            <ins
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

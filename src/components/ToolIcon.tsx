import { Switch, Match } from "solid-js";

export type ToolIconName =
    | "grid"
    | "camera"
    | "wrench"
    | "code"
    | "music"
    | "calculator"
    | "qr"
    | "key"
    | "shuffle"
    | "text"
    | "trophy"
    | "clock"
    | "timer"
    | "frame"
    | "hourglass"
    | "ruler"
    | "image"
    | "video"
    | "braces"
    | "type"
    | "file-text"
    | "globe"
    | "search"
    | "radio"
    | "headphones"
    | "sun"
    | "moon"
    | "volume-on"
    | "volume-off"
    | "alert"
    | "sliders"
    | "layout"
    | "layers"
    | "download"
    | "file"
    | "monitor";

export interface ToolIconProps {
    name: ToolIconName | string;
    class?: string;
}

export default function ToolIcon(props: ToolIconProps) {
    const iconClass = () => props.class || "ba-icon-sm ba-shrink-0";

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class={iconClass()}
            aria-hidden="true"
        >
            <Switch
                fallback={
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                }
            >
                <Match when={props.name === "grid"}>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                </Match>
                <Match when={props.name === "camera"}>
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                </Match>
                <Match when={props.name === "wrench"}>
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </Match>
                <Match when={props.name === "code"}>
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                </Match>
                <Match when={props.name === "music"}>
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                </Match>
                <Match when={props.name === "calculator"}>
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <line x1="8" y1="6" x2="16" y2="6" />
                    <line x1="8" y1="11" x2="8.01" y2="11" />
                    <line x1="12" y1="11" x2="12.01" y2="11" />
                    <line x1="16" y1="11" x2="16.01" y2="11" />
                    <line x1="8" y1="15" x2="8.01" y2="15" />
                    <line x1="12" y1="15" x2="12.01" y2="15" />
                    <line x1="16" y1="15" x2="16.01" y2="15" />
                </Match>
                <Match when={props.name === "qr"}>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3h-3z" />
                    <path d="M20 14v3h-3" />
                    <path d="M14 20h7" />
                </Match>
                <Match when={props.name === "key"}>
                    <circle cx="7.5" cy="15.5" r="5.5" />
                    <path d="m21 2-9.6 9.6" />
                    <path d="m15.5 7.5 3 3L22 7l-3-3" />
                </Match>
                <Match when={props.name === "shuffle"}>
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                </Match>
                <Match when={props.name === "text"}>
                    <path d="M17 6.1H3" />
                    <path d="M21 12.1H3" />
                    <path d="M15.1 18H3" />
                </Match>
                <Match when={props.name === "trophy"}>
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </Match>
                <Match when={props.name === "clock"}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </Match>
                <Match when={props.name === "timer"}>
                    <line x1="10" y1="2" x2="14" y2="2" />
                    <line x1="12" y1="14" x2="15" y2="11" />
                    <circle cx="12" cy="14" r="8" />
                </Match>
                <Match when={props.name === "frame"}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <rect x="6.5" y="6" width="11" height="9" rx="1" />
                    <line x1="8" y1="18" x2="16" y2="18" />
                </Match>
                <Match when={props.name === "hourglass"}>
                    <path d="M5 22h14" />
                    <path d="M5 2h14" />
                    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                </Match>
                <Match when={props.name === "ruler"}>
                    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
                    <path d="m14.5 12.5 2-2" />
                    <path d="m11.5 9.5 2-2" />
                    <path d="m8.5 6.5 2-2" />
                    <path d="m17.5 15.5 2-2" />
                </Match>
                <Match when={props.name === "image"}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </Match>
                <Match when={props.name === "video"}>
                    <rect x="2" y="6" width="14" height="12" rx="2" />
                    <path d="m22 8-6 4 6 4V8Z" />
                </Match>
                <Match when={props.name === "braces"}>
                    <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
                    <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
                </Match>
                <Match when={props.name === "type"}>
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9" y1="20" x2="15" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                </Match>
                <Match when={props.name === "file-text"}>
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                </Match>
                <Match when={props.name === "globe"}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </Match>
                <Match when={props.name === "search"}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </Match>
                <Match when={props.name === "radio"}>
                    <circle cx="12" cy="12" r="2" />
                    <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                    <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
                </Match>
                <Match when={props.name === "headphones"}>
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </Match>
                <Match when={props.name === "sun"}>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                </Match>
                <Match when={props.name === "moon"}>
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </Match>
                <Match when={props.name === "volume-on"}>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </Match>
                <Match when={props.name === "volume-off"}>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M23 9 17 15M17 9 23 15" />
                </Match>
                <Match when={props.name === "alert"}>
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </Match>
                <Match when={props.name === "sliders"}>
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                </Match>
                <Match when={props.name === "layout"}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                </Match>
                <Match when={props.name === "layers"}>
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                </Match>
                <Match when={props.name === "download"}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </Match>
                <Match when={props.name === "file"}>
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                </Match>
                <Match when={props.name === "monitor"}>
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </Match>
            </Switch>
        </svg>
    );
}

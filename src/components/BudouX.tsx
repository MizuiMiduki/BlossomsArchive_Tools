import { createMemo, For, omit } from "solid-js";
import { Dynamic } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { parseBudouX } from "../utils/budoux";

export interface BudouXProps extends JSX.HTMLAttributes<HTMLElement> {
    text?: string;
    children?: string;
    class?: string;
    as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "div" | "label";
}

/**
 * BudouX を用いて日本語テキストを文節単位で自然に改行するコンポーネント。
 * `as` プロパティでレンダリングするHTMLタグ（デフォルト: span）を指定可能です。
 */
export default function BudouX(props: BudouXProps) {
    const others = omit(props, "text", "children", "class", "as");

    const tag = () => props.as || "span";
    const content = () => props.text ?? (typeof props.children === "string" ? props.children : "");
    const words = createMemo(() => parseBudouX(content()));

    return (
        <Dynamic
            component={tag()}
            {...others}
            class={`${props.class || ""}`}
            style={{
                "word-break": "keep-all",
                "overflow-wrap": "anywhere",
                ...(typeof others.style === "object" ? others.style : {}),
            }}
        >
            <For each={words()}>
                {(word, index) => (
                    <>
                        {index() > 0 && <wbr />}
                        {word}
                    </>
                )}
            </For>
        </Dynamic>
    );
}

import { JSX, createMemo, For, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
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
    const [local, others] = splitProps(props, ["text", "children", "class", "as"]);

    const tag = () => local.as || "span";
    const content = () => local.text ?? (typeof local.children === "string" ? local.children : "");
    const words = createMemo(() => parseBudouX(content()));

    return (
        <Dynamic
            component={tag()}
            {...others}
            class={`${local.class || ""}`}
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

// src/components/ToolCard.tsx
export default function ToolCard(props: {
    title: string;
    desc: string;
    href: string;
}) {
    return (
        <div class="ba-card ba-tool-card">
            <div class="ba-stack-2">
                <h2 class="ba-section-title">{props.title}</h2>
                <p class="ba-text-sm ba-text-muted">{props.desc}</p>
            </div>
            <div class="ba-flex ba-justify-end" style={{ "margin-top": "1rem" }}>
                <a href={props.href} class="ba-btn ba-btn--primary ba-btn--sm">
                    開く
                </a>
            </div>
        </div>
    );
}

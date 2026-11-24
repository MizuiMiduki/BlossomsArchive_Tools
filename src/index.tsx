/* @refresh reload */
// 本番ビルドでは critical.css を generate-route-pages.ts が全ルートHTMLへインライン埋め込みするため、
// 外部CSSへの二重配信を防ぎ、開発サーバー (DEV) 時のみ直接読み込む
if (import.meta.env.DEV) {
  import('./styles/critical.css');
}
import './styles/app.css';
import { render } from '@solidjs/web';

import App from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

if (root) {
  root.textContent = '';
}

render(() => <App />, root!);

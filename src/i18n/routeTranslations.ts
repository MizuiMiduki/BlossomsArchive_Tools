import type { SupportedLocale } from "./types";

export interface LocalizedRouteMeta {
    title: string;
    description: string;
    keywords?: string[];
}

export type RouteTranslationsMap = Record<
    string,
    Record<SupportedLocale, LocalizedRouteMeta>
>;

export const ROUTE_TRANSLATIONS: RouteTranslationsMap = {
    "/": {
        ja: {
            title: "ホーム",
            description:
                "電卓やQRコード生成、画像変換、動画圧縮、文字コード変換、OGP・SEOメタタグ確認など、日常やWeb制作・開発に役立つ高品質なWebツールを完全無料で提供しています。",
            keywords: ["Webツール", "便利ツール", "オンラインツール", "無料ツール", "BlossomsArchive Tools"],
        },
        en: {
            title: "Home",
            description:
                "Free, high-quality, privacy-first web tools for daily tasks and web dev: calculator, QR codes, media conversion, compression, and SEO checkers in your browser.",
            keywords: ["web tools", "online tools", "free utilities", "developer tools", "BlossomsArchive Tools"],
        },
        ko: {
            title: "홈",
            description:
                "계산기, QR 코드 생성, 이미지 변환, 동영상 압축, 문자 코드 변환, OGP 및 SEO 메타태그 확인 등 일상과 웹 개발에 유용한 고품질 웹 도구를 완전 무료로 제공합니다.",
            keywords: ["웹 도구", "무료 온라인 도구", "유틸리티", "개발자 도구", "BlossomsArchive Tools"],
        },
        "zh-hans": {
            title: "首页",
            description:
                "免费提供高质量、注重隐私的在线工具箱：包含计算器、二维码生成、图片转换、视频压缩、字符编码转换、SEO及OGP检测等，满足日常与开发需求。",
            keywords: ["在线工具", "免费工具箱", "实用工具", "开发者工具", "BlossomsArchive Tools"],
        },
        "zh-hant": {
            title: "首頁",
            description:
                "免費提供高品質、注重隱私的線上工具箱：包含計算機、QR碼生成、圖片轉換、影片壓縮、字元編碼轉換、SEO與OGP檢測等，滿足日常與開發需求。",
            keywords: ["線上工具", "免費工具箱", "實用工具", "開發者工具", "BlossomsArchive Tools"],
        },
        ru: {
            title: "Главная",
            description:
                "Бесплатные веб-инструменты для повседневных задач и разработки: калькулятор, QR-коды, конвертер картинок, сжатие видео, проверка SEO и OGP в браузере.",
            keywords: ["онлайн инструменты", "бесплатные утилиты", "веб инструменты", "BlossomsArchive Tools"],
        },
    },
    "/calculator": {
        ja: {
            title: "電卓ツール",
            description:
                "計算履歴を自動保存・クリック再利用しながら使えるシンプルで高機能な無料Web電卓です。四則演算や小数計算、連続計算、丸め誤差の自動補正にも対応し、ブラウザ完結で安全に動作します。",
            keywords: ["電卓", "計算機", "計算履歴", "無料電卓", "Web電卓"],
        },
        en: {
            title: "Online Calculator",
            description:
                "A fast, clean online calculator with automatic calculation history, decimal precision, keyboard support, and instant recalculation right in your browser.",
            keywords: ["calculator", "online calculator", "free calculator", "calculation history", "math tool"],
        },
        ko: {
            title: "온라인 계산기",
            description:
                "계산 기록을 자동 저장하고 클릭으로 재사용할 수 있는 깔끔하고 강력한 무료 웹 계산기입니다. 사칙연산, 소수점 계산, 키보드 입력을 완벽하게 지원합니다.",
            keywords: ["계산기", "온라인 계산기", "무료 계산기", "계산 기록", "웹 계산기"],
        },
        "zh-hans": {
            title: "在线计算器",
            description:
                "简洁高效的免费网页计算器，支持自动保存历史记录、快捷点击复用、高精度浮点数运算与键盘快捷操作，纯本地运行安全可靠。",
            keywords: ["计算器", "在线计算器", "免费计算器", "计算历史", "网页计算器"],
        },
        "zh-hant": {
            title: "線上計算機",
            description:
                "簡潔高效的免費網頁計算機，支援自動儲存歷史紀錄、點擊重複使用、高精度浮點數運算與鍵盤快捷操作，純本地運行安全可靠。",
            keywords: ["計算機", "線上計算機", "免費計算機", "計算紀錄", "網頁計算機"],
        },
        ru: {
            title: "Онлайн калькулятор",
            description:
                "Удобный бесплатный веб-калькулятор с сохранением истории вычислений, поддержкой клавиатуры, точными расчетами с плавающей точкой и локальной обработкой.",
            keywords: ["калькулятор", "онлайн калькулятор", "история вычислений", "бесплатный калькулятор"],
        },
    },
    "/qr_code": {
        ja: {
            title: "QRコード生成",
            description:
                "URLや任意のテキストから高精細なQRコードをブラウザ上で即座に作成・ダウンロードできる無料ツールです。PNG・JPEG・WebPのほか印刷に最適なベクターSVG出力にも対応しています。",
            keywords: ["QRコード作成", "QRコード生成", "無料QR", "QRコードダウンロード"],
        },
        en: {
            title: "QR Code Generator",
            description:
                "Generate high-resolution QR codes from URLs or text. Supports downloading in PNG, JPEG, WebP, and crisp vector SVG formats for print and digital use.",
            keywords: ["qr generator", "create qr code", "free qr code", "vector svg qr", "download qr"],
        },
        ko: {
            title: "QR 코드 생성기",
            description:
                "URL이나 텍스트를 입력하여 고화질 QR 코드를 즉시 생성하고 다운로드할 수 있는 무료 도구입니다. PNG, JPEG, WebP 및 인쇄용 고해상도 SVG 벡터 출력을 지원합니다.",
            keywords: ["QR코드 생성", "QR코드 만들기", "무료 QR", "SVG QR코드", "QR코드 다운로드"],
        },
        "zh-hans": {
            title: "二维码生成器",
            description:
                "快速将网址或文本生成高清晰度二维码，支持即时预览并免费导出为 PNG、JPEG、WebP 以及适用于印刷的高保真 SVG 矢量图格式。",
            keywords: ["二维码生成", "创建二维码", "免费二维码", "SVG二维码", "二维码下载"],
        },
        "zh-hant": {
            title: "QR碼生成器",
            description:
                "快速將網址或文字生成高解析度QR碼，支援即時預覽並免費匯出為 PNG、JPEG、WebP 以及適用於印刷的高解析度 SVG 向量圖格式。",
            keywords: ["QR碼生成", "製作QR碼", "免費QR碼", "SVG向量QR碼", "QR碼下載"],
        },
        ru: {
            title: "Генератор QR-кодов",
            description:
                "Бесплатный инструмент для быстрого создания QR-кодов из текста или ссылок. Скачивайте готовые коды в форматах PNG, JPEG, WebP и векторном SVG для печати.",
            keywords: ["генератор qr кодов", "создать qr код", "скачать qr", "векторный qr svg"],
        },
    },
    "/password-generator": {
        ja: {
            title: "パスワード生成",
            description:
                "文字種（大文字・小文字・数字・記号）や桁数を自由に指定し、Web Crypto API（CSPRNG）を用いて暗号学的に安全性の高い強固なパスワードを一括生成できる無料Webツールです。",
            keywords: ["パスワード生成", "パスワード作成", "ランダムパスワード", "セキュリティ"],
        },
        en: {
            title: "Password Generator",
            description:
                "Generate strong passwords using the browser's Web Crypto API (CSPRNG). Customize length, uppercase, lowercase, numbers, and symbols safely and securely.",
            keywords: ["password generator", "secure passwords", "random password", "csprng", "crypto generator"],
        },
        ko: {
            title: "비밀번호 생성기",
            description:
                "Web Crypto API(CSPRNG)를 사용하여 암호학적으로 안전한 강력한 무작위 비밀번호를 생성합니다. 대소문자, 숫자, 특수문자 조합 및 자릿수를 자유롭게 설정할 수 있습니다.",
            keywords: ["비밀번호 생성기", "랜덤 비밀번호", "강력한 패스워드", "보안 비밀번호"],
        },
        "zh-hans": {
            title: "强密码生成器",
            description:
                "利用浏览器原生 Web Crypto API (CSPRNG) 生成密码学级安全随机密码。可自由定制字符长度、大写字母、小写字母、数字及特殊符号组合。",
            keywords: ["密码生成器", "强密码", "随机密码", "密码安全", "在线密码生成"],
        },
        "zh-hant": {
            title: "強密碼產生器",
            description:
                "利用瀏覽器原生 Web Crypto API (CSPRNG) 生成密碼學級安全隨機密碼。可自由自訂字元長度、大寫字母、小寫字母、數字及特殊符號組合。",
            keywords: ["密碼產生器", "強密碼", "隨機密碼", "密碼安全", "線上密碼生成"],
        },
        ru: {
            title: "Генератор паролей",
            description:
                "Создавайте криптографически стойкие и надежные пароли с помощью Web Crypto API. Настраивайте длину, заглавные и строчные буквы, цифры и спецсимволы.",
            keywords: ["генератор паролей", "надежный пароль", "безопасный пароль", "случайный пароль"],
        },
    },
    "/lottery": {
        ja: {
            title: "抽選ツール",
            description:
                "名前や項目リストから暗号学的疑似乱数（CSPRNG）を用いて公正・ランダムに抽選・選定できる無料ツールです。重複なし抽選や複数人同時選出、実行履歴の記録・コピーにも対応しています。",
            keywords: ["抽選ツール", "ランダム抽選", "くじ引き", "ルーレット", "公正抽選"],
        },
        en: {
            title: "Fair Lottery & Raffle",
            description:
                "Pick fair, unbiased random winners from any list using cryptographic randomness (CSPRNG). Supports multiple winners, unique draws, and draw history.",
            keywords: ["lottery tool", "random picker", "raffle generator", "draw winners", "fair draw"],
        },
        ko: {
            title: "추첨 도구",
            description:
                "이름이나 항목 목록에서 암호학적 난수(CSPRNG)를 활용하여 공정하게 무작위 추첨을 진행하는 무료 도구입니다. 중복 없는 추첨, 다중 당첨자 선정, 추첨 기록을 지원합니다.",
            keywords: ["추첨 도구", "랜덤 추첨", "제비뽑기", "당첨자 추첨", "공정 추첨"],
        },
        "zh-hans": {
            title: "公正抽奖与随机挑选",
            description:
                "基于密码学伪随机数 (CSPRNG) 的完全公正随机抽奖与名单挑选工具。支持不重复抽取、多人同时中奖、结果导出与历史记录回顾。",
            keywords: ["抽奖工具", "随机抽选", "幸运抽奖", "公正抽奖", "名单挑选"],
        },
        "zh-hant": {
            title: "公正抽獎與隨機挑選",
            description:
                "基於密碼學偽隨機數 (CSPRNG) 的完全公正隨機抽獎與名單挑選工具。支援不重複抽取、多人同時中獎、結果匯出與歷史紀錄回顧。",
            keywords: ["抽獎工具", "隨機挑選", "幸運抽獎", "公正抽獎", "名單挑選"],
        },
        ru: {
            title: "Инструмент жеребьевки",
            description:
                "Честный генератор случайного выбора и розыгрышей на базе CSPRNG. Выбирайте победителей из списка без повторений с сохранением истории результатов.",
            keywords: ["жеребьевка", "случайный выбор", "генератор розыгрыша", "выбор победителя"],
        },
    },
    "/image_conversion": {
        ja: {
            title: "画像形式変換",
            description:
                "PNG・JPEG・WebPなどの画像フォーマットをサーバーへアップロードせずブラウザ内のCanvas APIで安全かつ高速に相互変換できる無料ツールです。透過画像の白背景補完にも対応します。",
            keywords: ["画像変換", "WebP変換", "PNG変換", "JPEG変換", "フォーマット変換"],
        },
        en: {
            title: "Image Format Converter",
            description:
                "Convert images between PNG, JPEG, and WebP instantly inside your browser using Canvas API without uploading files to any server. Fast, secure, and private.",
            keywords: ["image converter", "png to webp", "jpeg to webp", "convert image", "browser converter"],
        },
        ko: {
            title: "이미지 형식 변환기",
            description:
                "서버에 파일을 업로드하지 않고 브라우저 내 Canvas API를 활용하여 PNG, JPEG, WebP 이미지 형식을 안전하고 빠르게 상호 변환하는 무료 웹 도구입니다.",
            keywords: ["이미지 변환", "WebP 변환", "PNG 변환", "JPEG 변환", "포맷 변환"],
        },
        "zh-hans": {
            title: "图片格式转换工具",
            description:
                "无需上传服务器，完全在浏览器本地利用 Canvas API 极速相互转换 PNG、JPEG、WebP 格式图片，保护隐私并支持透明背景白色填充。",
            keywords: ["图片转换", "WebP转换", "PNG转换", "JPEG转换", "本地图片格式转换"],
        },
        "zh-hant": {
            title: "圖片格式轉換工具",
            description:
                "無需上傳伺服器，完全在瀏覽器本地利用 Canvas API 極速相互轉換 PNG、JPEG、WebP 格式圖片，保護隱私並支援透明背景白色填充。",
            keywords: ["圖片轉換", "WebP轉換", "PNG轉換", "JPEG轉換", "本地圖片格式轉換"],
        },
        ru: {
            title: "Конвертер изображений",
            description:
                "Быстрая и безопасная конвертация изображений между форматами PNG, JPEG и WebP прямо в браузере без загрузки на сервер с помощью Canvas API.",
            keywords: ["конвертер картинок", "png в webp", "jpeg в png", "конвертация фото онлайн"],
        },
    },
    "/video-compressor": {
        ja: {
            title: "動画圧縮",
            description:
                "動画ファイルの解像度やビットレート、フレームレートをブラウザ上で調整し、サーバーへアップロードせず完全ローカル処理で安全に圧縮・軽量化できる無料Webツールです。音声有無も設定可能です。",
            keywords: ["動画圧縮", "動画軽量化", "MP4圧縮", "ブラウザ動画圧縮", "ファイル軽量化"],
        },
        en: {
            title: "Video Compressor",
            description:
                "Compress MP4 videos in your browser. Adjust resolution, bitrate, and frame rate safely without uploading large videos to external servers.",
            keywords: ["video compressor", "compress mp4", "reduce video size", "client video compression"],
        },
        ko: {
            title: "동영상 압축기",
            description:
                "서버 업로드 없이 브라우저 로컬 환경에서 동영상의 해상도, 비트레이트, 프레임 레이트를 조절하여 안전하게 용량을 줄이고 최적화하는 무료 웹 도구입니다.",
            keywords: ["동영상 압축", "비디오 용량 줄이기", "MP4 압축", "동영상 최적화"],
        },
        "zh-hans": {
            title: "视频压缩与体积优化",
            description:
                "无需上传外部服务器，直接在浏览器端调节视频分辨率、比特率和帧率，全本地离线处理，高效安全地大幅压缩 MP4 等视频文件体积。",
            keywords: ["视频压缩", "减小视频体积", "MP4压缩", "本地视频压缩", "在线视频轻量化"],
        },
        "zh-hant": {
            title: "影片壓縮與容量最佳化",
            description:
                "無需上傳外部伺服器，直接在瀏覽器端調節影片解析度、位元速率和影格率，全本地離線處理，高效安全地大幅壓縮 MP4 等影片檔案容量。",
            keywords: ["影片壓縮", "減小影片容量", "MP4壓縮", "本地影片壓縮", "線上影片輕量化"],
        },
        ru: {
            title: "Сжатие видео онлайн",
            description:
                "Сжимайте MP4 видео локально в браузере без отправки на сервер. Настраивайте разрешение, битрейт и частоту кадров для уменьшения размера файла.",
            keywords: ["сжатие видео", "уменьшить размер mp4", "сжать видео онлайн", "оптимизация видео"],
        },
    },
    "/charset-converter": {
        ja: {
            title: "文字コード変換",
            description:
                "UTF-8・Shift_JIS・EUC-JP・JIS等の文字コードや改行コードを相互変換。16進数HEXやUnicode表記、Base64変換、Unicode正規化、文字化け修復もブラウザ内で安全に行えます。",
            keywords: ["文字コード変換", "Shift_JIS", "UTF-8", "EUC-JP", "文字化け修復"],
        },
        en: {
            title: "Charset Converter",
            description:
                "Convert text encodings between UTF-8, Shift_JIS, EUC-JP, JIS, Hex bytes, and Base64. Includes mojibake repair, newline conversion, and Unicode normalization.",
            keywords: ["charset converter", "text encoding", "utf-8", "shift_jis", "mojibake repair", "base64"],
        },
        ko: {
            title: "문자 인코딩 변환기",
            description:
                "UTF-8, Shift_JIS, EUC-JP, JIS 등 문자 인코딩과 줄바꿈 코드를 상호 변환하고, 16진수 HEX, Base64, 유니코드 정규화 및 깨진 텍스트 복구를 지원합니다.",
            keywords: ["문자 인코딩 변환", "UTF-8", "Shift_JIS", "인코딩 변환기", "텍스트 복구"],
        },
        "zh-hans": {
            title: "字符编码转换与乱码修复",
            description:
                "支持 UTF-8、Shift_JIS、EUC-JP、JIS、十六进制 HEX、Base64 与换行符的相互转换，提供 Unicode 文本正规化及乱码分析修复功能。",
            keywords: ["字符编码转换", "乱码修复", "UTF-8转换", "Shift_JIS", "Base64转换"],
        },
        "zh-hant": {
            title: "字元編碼轉換與亂碼修復",
            description:
                "支援 UTF-8、Shift_JIS、EUC-JP、JIS、十六進位 HEX、Base64 與換行符號的相互轉換，提供 Unicode 文字正規化及亂碼分析修復功能。",
            keywords: ["字元編碼轉換", "亂碼修復", "UTF-8轉換", "Shift_JIS", "Base64轉換"],
        },
        ru: {
            title: "Конвертер кодировок",
            description:
                "Конвертируйте текст между UTF-8, Shift_JIS, EUC-JP, HEX, Base64 и нормализуйте символы Unicode с функцией исправления кракозябр (модзибакэ).",
            keywords: ["конвертер кодировок", "utf-8", "кодировка текста", "исправление кракозябр"],
        },
    },
    "/access-info": {
        ja: {
            title: "アクセス情報確認",
            description:
                "IPアドレス、ホスト名、User-Agent、ブラウザ種別、画面解像度、WebGL・Canvas対応状況など、現在の接続環境や端末情報をブラウザ完結で安全・詳細に確認できる無料ツールです。",
            keywords: ["アクセス情報", "IP確認", "UserAgent", "接続情報", "端末情報"],
        },
        en: {
            title: "Connection & Device Info",
            description:
                "Inspect your current IP address, User-Agent, browser engine, screen resolution, WebGL/Canvas capabilities, and network connection details instantly.",
            keywords: ["my ip", "user agent", "device info", "browser specs", "network details"],
        },
        ko: {
            title: "접속 환경 및 기기 정보 확인",
            description:
                "IP 주소, 호스트명, User-Agent, 브라우저 버전, 화면 해상도, WebGL 및 Canvas 지원 여부 등 현재 기기와 네트워크 접속 환경을 상세하게 확인하는 무료 도구입니다.",
            keywords: ["내 IP 확인", "유저에이전트", "접속 정보", "기기 사양", "브라우저 정보"],
        },
        "zh-hans": {
            title: "网络连接与设备信息检测",
            description:
                "即时查询并详细检测当前的公网 IP 地址、User-Agent、浏览器内核、屏幕分辨率、颜色深度及 WebGL/Canvas 硬件加速支持情况。",
            keywords: ["IP查询", "UserAgent检测", "设备信息", "屏幕分辨率", "网络连接信息"],
        },
        "zh-hant": {
            title: "網路連線與裝置資訊檢測",
            description:
                "即時查詢並詳細檢測當前的公網 IP 位址、User-Agent、瀏覽器核心、螢幕解析度、色彩深度及 WebGL/Canvas 硬體加速支援情況。",
            keywords: ["IP查詢", "UserAgent檢測", "裝置資訊", "螢幕解析度", "網路連線資訊"],
        },
        ru: {
            title: "Информация об устройстве и сети",
            description:
                "Проверьте ваш IP-адрес, User-Agent, версию браузера, разрешение экрана, параметры сети, поддержку WebGL и Canvas прямо на одной странице.",
            keywords: ["мой ip адрес", "user agent", "характеристики устройства", "информация о сети"],
        },
    },
    "/ogp-checker": {
        ja: {
            title: "OGP確認",
            description:
                "WebサイトのURLを入力するだけで、X（旧Twitter）やFacebook、LINEでのシェア時に表示されるOGP画像・タイトル・説明文のプレビューとHTMLタグ解析を即座に行える無料ツールです。",
            keywords: ["OGP確認", "OGPチェッカー", "Twitterカード", "SNSプレビュー", "メタタグ確認"],
        },
        en: {
            title: "OGP Meta Tags & Social Preview",
            description:
                "Preview how your website URL appears when shared on X (Twitter), Facebook, and messaging apps. Inspect Open Graph tags, Twitter Cards, and meta descriptions.",
            keywords: ["ogp checker", "open graph preview", "twitter card validator", "social preview tool"],
        },
        ko: {
            title: "OGP 메타태그 및 SNS 미리보기",
            description:
                "웹사이트 URL을 입력하여 X(트위터), 페이스북, 카카오톡 등에 공유될 때 표시되는 OGP 이미지, 제목, 설명 미리보기와 메타태그 구성을 즉시 분석합니다.",
            keywords: ["OGP 확인", "트위터 카드 검사", "SNS 미리보기", "오픈그래프", "메타태그"],
        },
        "zh-hans": {
            title: "OGP 社交分享预览与标签检测",
            description:
                "输入网址即可即时预览在 X (Twitter)、Facebook 等社交平台分享时的 OGP 卡片效果，全面解析 Open Graph 与 Twitter Card 网页元标签。",
            keywords: ["OGP检测", "社交分享预览", "Twitter卡片", "OpenGraph检查", "网页元标签"],
        },
        "zh-hant": {
            title: "OGP 社群分享預覽與標籤檢測",
            description:
                "輸入網址即可即時預覽在 X (Twitter)、Facebook 等社群平台分享時的 OGP 卡片效果，全面解析 Open Graph 與 Twitter Card 網頁元標籤。",
            keywords: ["OGP檢測", "社群分享預覽", "Twitter卡片", "OpenGraph檢查", "網頁元標籤"],
        },
        ru: {
            title: "Проверка OGP и соцсетей",
            description:
                "Проверяйте метатеги Open Graph и Twitter Cards для любой страницы. Смотрите, как ссылки выглядят при отправке в X (Twitter), Facebook и мессенджерах.",
            keywords: ["проверка ogp", "open graph превью", "twitter card валидатор", "сниппет ссылки"],
        },
    },
    "/seo-checker": {
        ja: {
            title: "メタタグ(SEO)確認",
            description:
                "WebサイトのSEO品質を徹底分析。Title・Description・Canonical・Robots・H1階層・JSON-LD構造化データ・キーワード出現頻度などを総合診断し改善点を提示する無料ツールです。",
            keywords: ["SEO確認", "SEOチェッカー", "メタタグ診断", "構造化データ", "SEO内部対策"],
        },
        en: {
            title: "SEO Meta Tags & Structure Checker",
            description:
                "Comprehensive on-page SEO analyzer: audit Title, Meta Description, Canonical URLs, Robots directives, H1-H6 heading hierarchy, and JSON-LD schema.",
            keywords: ["seo checker", "meta tags audit", "on-page seo", "canonical tag check", "heading structure"],
        },
        ko: {
            title: "SEO 메타태그 및 구조 분석",
            description:
                "웹사이트의 Title, Description, Canonical, Robots 설정, H1-H6 제목 계층 구조, JSON-LD 구조화 데이터 등을 정밀 진단하여 온페이지 SEO 개선점을 제시합니다.",
            keywords: ["SEO 검사기", "메타태그 분석", "검색엔진 최적화", "온페이지 SEO", "구조화 데이터"],
        },
        "zh-hans": {
            title: "SEO 页面元标签与结构分析",
            description:
                "全面诊断网页 Title、Description、Canonical 规范网址、Robots 指令、H1-H6 标题层级结构及 JSON-LD 结构化数据，提供针对性 SEO 优化建议。",
            keywords: ["SEO检测", "页面SEO诊断", "元标签分析", "Title优化", "规范网址检测"],
        },
        "zh-hant": {
            title: "SEO 頁面元標籤與結構分析",
            description:
                "全面診斷網頁 Title、Description、Canonical 規範網址、Robots 指令、H1-H6 標題階層結構及 JSON-LD 結構化資料，提供針對性 SEO 最佳化建議。",
            keywords: ["SEO檢測", "頁面SEO診斷", "元標籤分析", "Title優化", "規範網址檢測"],
        },
        ru: {
            title: "Анализатор SEO метатегов",
            description:
                "Проверяйте SEO-параметры страницы: теги Title, Description, Canonical, Robots, структуру заголовков H1-H6 и микроразметку JSON-LD.",
            keywords: ["seo аудит", "проверка метатегов", "on-page seo", "анализ заголовков", "canonical url"],
        },
    },
    "/exif-frame": {
        ja: {
            title: "EXIFフレーム生成",
            description:
                "撮影写真のEXIF情報（カメラ機種・レンズ・F値・シャッタースピード・ISO感度・撮影日時等）を自動解析し、白枠や黒枠のおしゃれな額縁フレーム付き画像を作成・ダウンロードできるツールです。",
            keywords: ["EXIF", "写真フレーム", "カメラ情報", "額縁加工", "写真枠作成"],
        },
        en: {
            title: "EXIF Photo Frame Generator",
            description:
                "Extract EXIF metadata (camera, lens, focal length, aperture, shutter speed, ISO) and create elegant, framed photos with camera shot details for sharing.",
            keywords: ["exif frame", "photo border", "camera metadata frame", "shot on frame", "photography tool"],
        },
        ko: {
            title: "EXIF 사진 프레임 생성기",
            description:
                "사진의 EXIF 메타데이터(카메라 기종, 렌즈, 조리개값, 셔터속도, ISO 등)를 자동 분석하여 고급스러운 액자 프레임이 합성된 사진을 생성하고 다운로드합니다.",
            keywords: ["EXIF 프레임", "사진 액자", "카메라 정보 표시", "사진 테두리", "출사 사진"],
        },
        "zh-hans": {
            title: "EXIF 摄影参数画框生成器",
            description:
                "自动读取照片 EXIF 信息（相机型号、镜头、光圈、快门速度、ISO 等），一键合成极具质感的拍立得式留白画框与相机水印图并导出。",
            keywords: ["EXIF画框", "相机参数边框", "照片加框", "摄影水印", "相机型号水印"],
        },
        "zh-hant": {
            title: "EXIF 攝影參數畫框生成器",
            description:
                "自動讀取照片 EXIF 資訊（相機型號、鏡頭、光圈、快門速度、ISO 等），一鍵合成極具質感的拍立得式留白畫框與相機浮水印圖並匯出。",
            keywords: ["EXIF畫框", "相機參數邊框", "照片加框", "攝影浮水印", "相機型號浮水印"],
        },
        ru: {
            title: "Рамка с EXIF параметрами фото",
            description:
                "Автоматическое считывание EXIF данных (камера, объектив, выдержка, диафрагма, ISO) и создание стильных рамок для ваших фотографий с параметрами съемки.",
            keywords: ["exif рамка", "параметры съемки на фото", "фоторамка с exif", "shot on frame"],
        },
    },
    "/clock": {
        ja: {
            title: "時計",
            description:
                "ミリ秒単位まで正確に刻むデジタル時計と美しいアナログ時計。日本標準時（JST）や世界主要都市の世界時計、フルスクリーン全画面表示にも対応した無料のWeb時計ツールです。",
            keywords: ["Web時計", "デジタル時計", "アナログ時計", "世界時計", "ミリ秒時計"],
        },
        en: {
            title: "Precision Online Clock",
            description:
                "A minimalist full-screen online digital and analog clock with millisecond precision, major world timezones, and dark mode for desk display and focus sessions.",
            keywords: ["online clock", "digital clock", "analog clock", "world clock", "precision time"],
        },
        ko: {
            title: "정밀 온라인 시계",
            description:
                "밀리초 단위까지 정확한 디지털 시계와 세련된 아날로그 시계. 주요 세계 도시 시간 및 전체 화면 표시를 지원하는 고정밀 무료 웹 시계 도구입니다.",
            keywords: ["온라인 시계", "디지털 시계", "아날로그 시계", "세계 시계", "밀리초 시계"],
        },
        "zh-hans": {
            title: "高精度在线时钟与世界时间",
            description:
                "毫秒级精准走时的数字时钟与优雅指针式时钟，支持全球主要城市世界时间对照、全屏沉浸显示与深色模式，非常适合桌面常驻显示。",
            keywords: ["在线时钟", "数字时钟", "模拟时钟", "世界时间", "毫秒时钟"],
        },
        "zh-hant": {
            title: "高精度線上時鐘與世界時間",
            description:
                "毫秒級精準走時的數位時鐘與優雅指針式時鐘，支援全球主要城市世界時間對照、全螢幕沉浸顯示與深色模式，非常適合桌面常駐顯示。",
            keywords: ["線上時鐘", "數位時鐘", "指針時鐘", "世界時間", "毫秒時鐘"],
        },
        ru: {
            title: "Точные онлайн часы",
            description:
                "Минималистичные цифровые и стрелочные веб-часы с миллисекундами, мировым временем и полноэкранным режимом для отображения на мониторе.",
            keywords: ["онлайн часы", "цифровые часы", "мировое время", "точные часы с миллисекундами"],
        },
    },
    "/timer": {
        ja: {
            title: "タイマー・ストップウォッチ",
            description:
                "ラップタイム計測に対応したストップウォッチと、アラーム音・全画面表示付きのカウントダウンタイマー。ポモドーロや作業時間計測、プレゼン管理に役立つ無料ツールです。",
            keywords: ["タイマー", "ストップウォッチ", "ポモドーロ", "ラップタイム", "カウントダウン"],
        },
        en: {
            title: "Timer & Stopwatch",
            description:
                "Online stopwatch with lap recording and countdown timer with audible alarms and full-screen view. Perfect for study, work sprints, workouts, and presentations.",
            keywords: ["online timer", "stopwatch", "countdown timer", "lap timer", "pomodoro sprint"],
        },
        ko: {
            title: "타이머 및 스톱워치",
            description:
                "랩 타임 기록이 가능한 스톱워치와 알람음 및 전체화면을 지원하는 카운트다운 타이머입니다. 공부, 업무 집중, 운동, 발표 시간 관리에 이상적입니다.",
            keywords: ["온라인 타이머", "스톱워치", "카운트다운", "랩타임", "뽀모도로"],
        },
        "zh-hans": {
            title: "在线计时器与秒表",
            description:
                "支持分段计圈的精准秒表与带声音提醒、全屏显示的倒计时器。适用于番茄工作法、专注学习、运动健身及演讲时间控制。",
            keywords: ["在线计时器", "秒表", "倒计时", "分段计圈", "番茄时钟"],
        },
        "zh-hant": {
            title: "線上計時器與碼表",
            description:
                "支援分段計圈的精準碼表與帶聲音提醒、全螢幕顯示的倒數計時器。適用於番茄工作法、專注學習、運動健身及演講時間控制。",
            keywords: ["線上計時器", "碼表", "倒數計時", "分段計圈", "番茄鐘"],
        },
        ru: {
            title: "Таймер и секундомер",
            description:
                "Удобный онлайн секундомер с записью кругов и таймер обратного отсчета со звуковым сигналом и полноэкранным режимом для работы и тренировок.",
            keywords: ["онлайн таймер", "секундомер с кругами", "обратный отсчет", "таймер помидоро"],
        },
    },
    "/hyperfocal": {
        ja: {
            title: "過焦点距離計算",
            description:
                "センサーサイズ、焦点距離、絞り値（F値）から過焦点距離・被写界深度（前方・後方限界、ピント深度）を即座に算出。風景写真やスナップでパンフォーカス撮影を行うための計算ツールです。",
            keywords: ["過焦点距離", "被写界深度", "パンフォーカス", "カメラ計算", "DOF計算機"],
        },
        en: {
            title: "Hyperfocal & DoF Calculator",
            description:
                "Calculate hyperfocal distance, near/far limits, and total depth of field (DoF) for full frame, APS-C, and M4/3 sensors for tack-sharp landscape shots.",
            keywords: ["hyperfocal distance", "depth of field calculator", "dof calculator", "sharp landscapes"],
        },
        ko: {
            title: "과초점 거리 및 피사계 심도 계산기",
            description:
                "센서 크기, 초점 거리, 조리개값(F값)을 입력하여 과초점 거리와 피사계 심도(DoF)를 계산합니다. 풍경 및 스냅 사진에서 팬포커스 촬영을 위한 전문 도구입니다.",
            keywords: ["과초점 거리", "피사계 심도", "팬포커스", "DOF 계산기", "카메라 계산기"],
        },
        "zh-hans": {
            title: "超焦距与景深计算器",
            description:
                "根据感光元件画幅、焦距和光圈值，快速计算超焦距与景深前后清晰范围（DoF），为风光摄影和街头快拍实现全景深超焦距合焦提供精准指导。",
            keywords: ["超焦距计算", "景深计算器", "DoF计算", "风光摄影", "全景深对焦"],
        },
        "zh-hant": {
            title: "超焦距與景深計算器",
            description:
                "根據感光元件畫幅、焦距和光圈值，快速計算超焦距與景深前後清晰範圍（DoF），為風景攝影和街頭快拍實現全景深超焦距合焦提供精準指導。",
            keywords: ["超焦距計算", "景深計算器", "DoF計算", "風景攝影", "全景深對焦"],
        },
        ru: {
            title: "Калькулятор ГРИП и гиперфокала",
            description:
                "Рассчитывайте гиперфокальное расстояние и глубину резко изображаемого пространства (ГРИП) для пейзажной фотографии с учетом размера матрицы и диафрагмы.",
            keywords: ["гиперфокальное расстояние", "калькулятор грип", "глубина резкости", "dof калькулятор"],
        },
    },
    "/headphone-driveability": {
        ja: {
            title: "イヤホン・ヘッドホン鳴らしやすさ",
            description:
                "ヘッドホン・イヤホンのインピーダンス（Ω）と感度（dB/mWまたはdB/V）から、目標音圧（dB SPL）に必要な電圧（Vrms）・電流（mA）・電力（mW）を正確に計算するオーディオ設計ツールです。",
            keywords: ["ヘッドホン感度", "インピーダンス", "アンプ出力計算", "音圧レベル", "オーディオ計算機"],
        },
        en: {
            title: "Headphone Power Calculator",
            description:
                "Calculate required voltage (Vrms), current (mA), and power (mW) to drive headphones to desired sound pressure levels (SPL) based on impedance and sensitivity.",
            keywords: ["headphone power calculator", "headphone sensitivity", "impedance matching", "headphone amp"],
        },
        ko: {
            title: "헤드폰 구동력 및 필요 출력 계산기",
            description:
                "헤드폰의 임피던스(Ω)와 음압 감도(dB/mW, dB/V)를 바탕으로 목표 음압(dB SPL) 달성에 필요한 전압, 전류 및 앰프 출력(mW)을 정확하게 산출합니다.",
            keywords: ["헤드폰 계산기", "임피던스", "헤드폰 앰프 출력", "음압 감도", "오디오 계산기"],
        },
        "zh-hans": {
            title: "耳机推力与功率需求计算器",
            description:
                "依据耳机的阻抗（Ω）和灵敏度（dB/mW 或 dB/V），精确测算达到目标声压级（SPL）所需的耳放驱动电压（Vrms）、电流（mA）及输出功率（mW）。",
            keywords: ["耳机推力计算", "耳机灵敏度", "阻抗匹配", "耳放功率计算", "音频声压级"],
        },
        "zh-hant": {
            title: "耳機推力與功率需求計算器",
            description:
                "依據耳機的阻抗（Ω）和靈敏度（dB/mW 或 dB/V），精確測算達到目標聲壓級（SPL）所需的耳擴驅動電壓（Vrms）、電流（mA）及輸出功率（mW）。",
            keywords: ["耳機推力計算", "耳機靈敏度", "阻抗匹配", "耳擴功率計算", "音訊聲壓級"],
        },
        ru: {
            title: "Калькулятор мощности наушников",
            description:
                "Рассчитывайте необходимое напряжение (В), ток (мА) и мощность (мВт) усилителя для достижения нужной громкости наушников по их импедансу и чувствительности.",
            keywords: ["мощность наушников", "импеданс наушников", "чувствительность", "усилитель для наушников"],
        },
    },
    "/text-converter": {
        ja: {
            title: "テキスト・マークアップ変換",
            description:
                "全角・半角変換、大文字・小文字・キャメルケース等の命名規則変換、空白・重複行の削除、ソート、HTMLエスケープ、正規表現置換などをブラウザ内で瞬時に実行できる文章整形ツールです。",
            keywords: ["テキスト変換", "全角半角変換", "ケース変換", "重複行削除", "文章整形"],
        },
        en: {
            title: "Text Formatter & Case Converter",
            description:
                "Format, clean, and convert text: case conversions (camelCase, snake_case), zenkaku/hankaku, trim whitespace, remove duplicates, sort lines, and HTML escape.",
            keywords: ["text converter", "case converter", "remove duplicates", "text formatting tool"],
        },
        ko: {
            title: "텍스트 변환 및 텍스트 정리 도구",
            description:
                "전각/반각 변환, 대소문자 및 카멜케이스 변환, 중복 줄 제거, 텍스트 정렬, 공백 정리, HTML 이스케이프 등을 브라우저에서 즉시 처리하는 텍스트 도구입니다.",
            keywords: ["텍스트 변환", "전각 반각", "대소문자 변환", "중복 줄 제거", "텍스트 정리"],
        },
        "zh-hans": {
            title: "文本转换与排版处理工具",
            description:
                "支持全角半角转换、大小写及命名格式转换（camelCase/snake_case）、删除重复行、文本排序、空白清理、HTML 转义及正则批量替换。",
            keywords: ["文本转换", "全角半角", "大小写转换", "去除重复行", "在线文本排版"],
        },
        "zh-hant": {
            title: "文字轉換與排版處理工具",
            description:
                "支援全形半形轉換、大小寫及命名格式轉換（camelCase/snake_case）、刪除重複行、文字排序、空白清理、HTML 轉義及正規表達式批次取代。",
            keywords: ["文字轉換", "全形半形", "大小寫轉換", "去除重複行", "線上文字排版"],
        },
        ru: {
            title: "Форматирование текста",
            description:
                "Инструмент для обработки текста: смена регистра (camelCase, snake_case), удаление дубликатов строк, сортировка, экранирование HTML и замена пробелов.",
            keywords: ["форматирование текста", "смена регистра", "удаление дубликатов", "очистка текста"],
        },
    },
    "/exposure-calculator": {
        ja: {
            title: "カメラ露出計算機",
            description:
                "ISO感度、絞り値（F値）、シャッタースピードから露出値（EV）を相互計算。NDフィルター装着時の減光段数計算や長時間露光タイマーも備えた本格カメラマン向け計算ツールです。",
            keywords: ["露出計算", "EV計算", "NDフィルター計算", "シャッタースピード", "露出計"],
        },
        en: {
            title: "Exposure & ND Filter Calculator",
            description:
                "Calculate Exposure Value (EV), reciprocal shutter speeds, aperture, and ISO. Features an ND filter exposure compensation calculator and long exposure timer.",
            keywords: ["exposure calculator", "ev calculator", "nd filter calculator", "long exposure timer"],
        },
        ko: {
            title: "노출 및 ND 필터 계산기",
            description:
                "ISO 감도, 조리개값(F값), 셔터 속도로부터 노출값(EV)을 상호 계산합니다. ND 필터 장착 시 장노출 시간 보정 계산과 타이머 기능을 제공합니다.",
            keywords: ["노출 계산기", "EV 계산", "ND 필터 계산기", "셔터스피드", "장노출 타이머"],
        },
        "zh-hans": {
            title: "曝光值与 ND 滤镜曝光计算器",
            description:
                "在 ISO 感光度、光圈和快门速度之间相互换算曝光值（EV）。内置多档 ND 减光滤镜等效曝光换算以及贴心的长曝光计时器。",
            keywords: ["曝光计算器", "EV值计算", "ND滤镜换算", "长曝光计时", "摄影曝光表"],
        },
        "zh-hant": {
            title: "曝光值與 ND 濾鏡曝光計算器",
            description:
                "在 ISO 感光度、光圈和快門速度之間相互換算曝光值（EV）。內建多檔 ND 減光濾鏡等效曝光換算以及貼心的長曝光計時器。",
            keywords: ["曝光計算器", "EV值計算", "ND濾鏡換算", "長曝光計時", "攝影曝光表"],
        },
        ru: {
            title: "Калькулятор экспозиции и ND фильтров",
            description:
                "Расчет экспозиции (EV), взаимосвязи выдержки, диафрагмы и ISO. Включает расчет ND-фильтров и таймер длинных выдержек для фотографов.",
            keywords: ["калькулятор экспозиции", "число ev", "расчет nd фильтра", "длинная выдержка"],
        },
    },
    "/timelapse-calculator": {
        ja: {
            title: "タイムラプス撮影計算機",
            description:
                "撮影間隔（インターバル）、撮影時間、完成動画のフレームレート（fps）や目標尺から必要な総撮影枚数とストレージ容量を正確にシミュレーションできる計算ツールです。",
            keywords: ["タイムラプス計算", "インターバル撮影", "撮影枚数計算", "動画尺計算", "星空撮影"],
        },
        en: {
            title: "Timelapse Shooting Calculator",
            description:
                "Calculate shooting intervals, total frames, shooting duration, and finished clip length at various frame rates (24, 30, 60 fps) with storage space estimations.",
            keywords: ["timelapse calculator", "intervalometer", "timelapse shooting interval", "total frames"],
        },
        ko: {
            title: "타임랩스 인터벌 촬영 계산기",
            description:
                "촬영 간격, 총 촬영 시간, 결과물 프레임레이트(fps) 및 목표 영상 길이에 따른 필요한 촬영 컷 수와 예상 메모리 저장 용량을 정밀하게 계산합니다.",
            keywords: ["타임랩스 계산기", "인터벌 촬영", "촬영 컷수 계산", "영상 길이 계산"],
        },
        "zh-hans": {
            title: "延时摄影拍摄参数计算器",
            description:
                "根据拍摄间隔时间、总拍摄时长、成片帧率（fps）及预期视频时长，精准计算所需拍摄总张数以及存储卡空间占用预估。",
            keywords: ["延时摄影计算", "拍摄间隔计算", "延时快门", "总张数计算", "星空延时"],
        },
        "zh-hant": {
            title: "縮時攝影拍攝參數計算器",
            description:
                "根據拍攝間隔時間、總拍攝時長、成片影格率（fps）及預期影片時長，精準計算所需拍攝總張數以及記憶卡空間佔用預估。",
            keywords: ["縮時攝影計算", "拍攝間隔計算", "縮時快門", "總張數計算", "星空縮時"],
        },
        ru: {
            title: "Калькулятор таймлапса",
            description:
                "Рассчитывайте интервал съемки, общее количество кадров, время съемки и длительность готового видеоролика с оценкой необходимого места на карте памяти.",
            keywords: ["калькулятор таймлапса", "интервал съемки", "интервалометр", "расчет кадров"],
        },
    },
    "/bpm-calculator": {
        ja: {
            title: "BPMディレイ換算機",
            description:
                "スペースキーや画面タップのリズムから楽曲のテンポ（BPM）を即座に高精度測定。BPMに応じた音符ごとのミリ秒数（ms）やHz周波数一覧も自動換算し、DTMやDJに役立ちます。",
            keywords: ["BPM測定", "タップテンポ", "BPM計算", "ミリ秒換算", "DTMツール"],
        },
        en: {
            title: "Tap Tempo BPM Calculator",
            description:
                "Accurately measure tempo (BPM) by tapping. Includes conversion table for note values to milliseconds (ms) and frequency (Hz) for audio mixing.",
            keywords: ["tap tempo", "bpm calculator", "tempo detector", "delay time ms", "bpm to ms"],
        },
        ko: {
            title: "탭 템포 BPM 측정기",
            description:
                "화면 탭이나 스페이스바 입력을 통해 음악의 템포(BPM)를 즉시 정밀 측정합니다. 음표별 딜레이 타임(ms)과 Hz 주파수 변환표를 함께 제공하여 DTM 및 DJ 작업에 유용합니다.",
            keywords: ["BPM 측정", "탭 템포", "템포 측정기", "음표 딜레이 계산", "DTM 도구"],
        },
        "zh-hans": {
            title: "BPM 测速与 Tap 节奏计算器",
            description:
                "通过按键或点击节拍即时精准测算音乐速度（BPM）。自动换算各音符时值对应的延迟毫秒数（ms）与赫兹频率（Hz），助力编曲与 DJ 混音。",
            keywords: ["BPM测速", "TapTempo", "节拍计算器", "延迟时间ms换算", "编曲音频工具"],
        },
        "zh-hant": {
            title: "BPM 測速與 Tap 節奏計算器",
            description:
                "透過按鍵或點擊節拍即時精準測算音樂速度（BPM）。自動換算各音符時值對應的延遲毫秒數（ms）與赫茲頻率（Hz），助力編曲與 DJ 混音。",
            keywords: ["BPM測速", "TapTempo", "節拍計算器", "延遲時間ms換算", "編曲音訊工具"],
        },
        ru: {
            title: "Калькулятор темпа BPM (Tap Tempo)",
            description:
                "Измеряйте темп музыки (BPM) нажатием клавиши. Включает перевод длительностей нот в миллисекунды (мс) и частоту (Гц) для звукорежиссеров.",
            keywords: ["tap tempo", "определить bpm", "калькулятор темпа", "bpm в миллисекунды"],
        },
    },
    "/json-formatter": {
        ja: {
            title: "JSON整形・検証ツール",
            description:
                "JSONデータの構文エラー検証、見やすいインデント整形、データ圧縮（minify）、キーソート、構文木ツリー表示などをブラウザ完結で高速に行えるWeb開発ツールです。",
            keywords: ["JSON整形", "JSONバリデーター", "JSON検証", "JSONフォーマッター", "minify"],
        },
        en: {
            title: "JSON Formatter & Validator",
            description:
                "Format, validate, prettify, and minify JSON data. Features syntax error highlighting, key sorting, and an interactive tree viewer in your browser.",
            keywords: ["json formatter", "json validator", "prettify json", "minify json", "json tree viewer"],
        },
        ko: {
            title: "JSON 포맷터 및 문법 검사기",
            description:
                "JSON 데이터의 문법 오류 검증, 깔끔한 들여쓰기 정렬, 공백 제거 압축(Minify), 키 정렬 및 대화형 트리 뷰어 기능을 브라우저 내에서 안전하게 제공합니다.",
            keywords: ["JSON 포맷터", "JSON 검사기", "JSON 정렬", "JSON 유효성 검사", "JSON 뷰어"],
        },
        "zh-hans": {
            title: "JSON 格式化与语法校验器",
            description:
                "高效在线格式化并美化 JSON 数据，提供语法错误即时定位、紧凑压缩（Minify）、键名排序以及交互式树状结构视图，完全本地解析保护数据隐私。",
            keywords: ["JSON格式化", "JSON校验", "JSON美化", "JSON压缩", "JSON树状图"],
        },
        "zh-hant": {
            title: "JSON 格式化與語法校驗器",
            description:
                "高效線上格式化並美化 JSON 資料，提供語法錯誤即時定位、緊湊壓縮（Minify）、鍵名排序以及互動式樹狀結構視圖，完全本地解析保護資料隱私。",
            keywords: ["JSON格式化", "JSON校驗", "JSON美化", "JSON壓縮", "JSON樹狀圖"],
        },
        ru: {
            title: "JSON форматирование и валидация",
            description:
                "Проверяйте валидность, форматируйте и сжимайте (minify) JSON данные. Удобный просмотрщик древовидной структуры и подсветка синтаксических ошибок в браузере.",
            keywords: ["json форматирование", "валидатор json", "форматирование json онлайн", "json minify"],
        },
    },
    "/word-counter": {
        ja: {
            title: "文字数カウント・原稿用紙換算",
            description:
                "リアルタイムで文字数（空白除外含む）、単語数、行数、段落数、原稿用紙枚数、読了目安時間を算出。全角半角や記号の内訳もグラフィカルに可視化します。",
            keywords: ["文字数カウント", "文字数チェッカー", "単語数", "原稿用紙換算", "読了時間"],
        },
        en: {
            title: "Word & Character Counter",
            description:
                "Real-time word, character, line, paragraph, and reading time counter. Analyzes text statistics and estimated reading speeds completely client-side.",
            keywords: ["word counter", "character counter", "reading time estimator", "text statistics"],
        },
        ko: {
            title: "글자 수 세기 및 텍스트 분석",
            description:
                "실시간 공백 포함/제외 글자 수, 단어 수, 줄 수, 문단 수, 원고지 분량 환산 및 예상 읽기 시간을 분석합니다. 텍스트는 서버로 전송되지 않고 로컬에서 안전하게 처리됩니다.",
            keywords: ["글자수 세기", "단어수 계산", "원고지 매수", "읽기 시간 계산", "텍스트 통계"],
        },
        "zh-hans": {
            title: "字数统计与文本分析工具",
            description:
                "实时统计文字总数（含/不含空格）、词数、行数、段落数及预估阅读耗时。直观分析中英文、标点符号分布，文本完全在本地安全统计。",
            keywords: ["字数统计", "在线字符计数", "阅读时间估算", "文本统计分析", "段落数统计"],
        },
        "zh-hant": {
            title: "字數統計與文字分析工具",
            description:
                "即時統計文字總數（含/不含空格）、詞數、行數、段落數及預估閱讀耗時。直觀分析中英文、標點符號分佈，文字完全在本地安全統計。",
            keywords: ["字數統計", "線上字元計數", "閱讀時間估算", "文字統計分析", "段落數統計"],
        },
        ru: {
            title: "Подсчет символов и слов",
            description:
                "Мгновенный подсчет количества символов (с пробелами и без), слов, строк, абзацев и расчет примерного времени чтения текста без отправки данных на сервер.",
            keywords: ["подсчет символов", "количество слов", "счетчик знаков", "время чтения текста"],
        },
    },
    "/tier-maker": {
        ja: {
            title: "ティア表作成ツール (Tier List)",
            description:
                "画像やテキストをS・A・B・Cなどのランク行にドラッグ＆ドロップで直感的に配置し、オリジナルのティアリスト（Tier表）を作成して高画質画像で保存・共有できる無料ツールです。",
            keywords: ["Tier表作成", "ティア表", "ティアリスト", "ランキング作成", "TierMaker"],
        },
        en: {
            title: "Custom Tier List Maker",
            description:
                "Create custom tier lists by dragging and dropping images or labels into tiers (S, A, B, C, D). Export clean, high-resolution ranking cards to share.",
            keywords: ["tier list maker", "ranking maker", "custom tier list", "tier ranking creator"],
        },
        ko: {
            title: "티어표 제작기 (Tier List)",
            description:
                "이미지나 텍스트를 S, A, B, C, D 등 등급 행에 드래그 앤 드롭으로 자유롭게 배치하여 나만의 티어리스트를 만들고 고화질 이미지로 저장 및 공유할 수 있습니다.",
            keywords: ["티어표 만들기", "티어리스트", "순위표 제작", "티어메이커", "랭킹 생성기"],
        },
        "zh-hans": {
            title: "在线 Tier 排名制作器",
            description:
                "通过拖拽图片或文本标签将项目轻松划分至 S、A、B、C 等不同梯队，快速生成定制化的 Tier 梯队排行榜并导出高清图片分享至社交网络。",
            keywords: ["Tier表制作", "天梯榜制作", "排行榜生成器", "梯队排名", "TierListMaker"],
        },
        "zh-hant": {
            title: "線上 Tier 排名製作器",
            description:
                "透過拖曳圖片或文字標籤將項目輕鬆劃分至 S、A、B、C 等不同梯隊，快速生成客製化的 Tier 梯隊排行榜並匯出高解析度圖片分享至社群平台。",
            keywords: ["Tier表製作", "天梯榜製作", "排行榜生成器", "梯隊排名", "TierListMaker"],
        },
        ru: {
            title: "Создание тир-листов (Tier List)",
            description:
                "Создавайте собственные тир-листы (рейтинги S, A, B, C, D), перетаскивая изображения или текст. Экспортируйте красивые изображения для соцсетей.",
            keywords: ["тир лист", "создать тир лист", "рейтинг s a b c", "генератор tier list"],
        },
    },
    "/json-ld-viewer": {
        ja: {
            title: "JSON-LD構造可視化・検証",
            description:
                "URLを入力するだけでHTML内のJSON-LD構造化データ（Schema.org）を自動抽出・構文解析。シンタックスハイライト、エラー検証、プロパティ検索を行えるSEO支援ツールです。",
            keywords: ["JSON-LD確認", "Schema.org", "構造化データ検証", "リッチリザルト", "SEO構造化データ"],
        },
        en: {
            title: "JSON-LD & Schema Validator",
            description:
                "Extract, view, and validate JSON-LD structured data and Schema.org entities from any URL. Features syntax highlighting, error checks, and filtering.",
            keywords: ["json-ld viewer", "schema.org validator", "structured data test", "rich snippet checker"],
        },
        ko: {
            title: "JSON-LD 및 Schema.org 구조화 데이터 검사기",
            description:
                "웹사이트 URL에서 JSON-LD 구조화 데이터(Schema.org)를 자동 추출하고 문법을 분석합니다. 구문 강조, 유효성 검사, 속성 검색을 지원하는 SEO 도구입니다.",
            keywords: ["JSON-LD 검사", "Schema.org", "구조화 데이터", "리치 검색결과", "SEO 데이터 검사"],
        },
        "zh-hans": {
            title: "JSON-LD 与 Schema.org 结构化数据检测",
            description:
                "输入网页链接即可自动提取并解析其中的 JSON-LD 结构化数据（Schema.org），提供语法高亮、合规校验与属性检索功能，助力富媒体搜索结果优化。",
            keywords: ["JSON-LD检测", "Schema结构化数据", "富文本摘要", "SEO结构化数据", "数据校验"],
        },
        "zh-hant": {
            title: "JSON-LD 與 Schema.org 結構化資料檢測",
            description:
                "輸入網頁連結即可自動提取並解析其中的 JSON-LD 結構化資料（Schema.org），提供語法反白、合規校驗與屬性檢索功能，助力富媒體搜尋結果最佳化。",
            keywords: ["JSON-LD檢測", "Schema結構化資料", "複合式搜尋結果", "SEO結構化資料", "資料校驗"],
        },
        ru: {
            title: "Проверка микроразметки JSON-LD",
            description:
                "Извлекайте и проверяйте структурированные данные JSON-LD и Schema.org по URL веб-страницы с подсветкой синтаксиса и фильтрацией свойств для SEO-оптимизации.",
            keywords: ["проверка json-ld", "валидатор schema.org", "микроразметка", "структурированные данные"],
        },
    },
    "/sitemap-visualizer": {
        ja: {
            title: "サイトマップ構造可視化",
            description:
                "sitemap.xmlのURLやXMLテキストからURL一覧、更新日時（lastmod）、更新頻度、優先度、hreflang多言語設定、サイトマップインデックス階層を解析・可視化するSEOツールです。",
            keywords: ["sitemap.xml", "サイトマップ可視化", "サイト構造", "hreflang", "多言語SEO"],
        },
        en: {
            title: "XML Sitemap Visualizer & Analyzer",
            description:
                "Inspect XML sitemaps and index files. Analyze URL trees, lastmod timestamps, changefreq, priority, and hreflang multilingual alternate links.",
            keywords: ["sitemap visualizer", "sitemap xml analyzer", "hreflang audit", "sitemap index viewer"],
        },
        ko: {
            title: "sitemap.xml 사이트맵 시각화 및 분석기",
            description:
                "sitemap.xml URL 또는 XML 파일로부터 URL 목록, 최종 수정일(lastmod), 변경 주기, 우선순위, hreflang 다국어 설정 및 사이트맵 인덱스 계층을 파싱하고 시각화합니다.",
            keywords: ["sitemap.xml", "사이트맵 시각화", "사이트맵 분석", "hreflang 검사", "다국어 SEO"],
        },
        "zh-hans": {
            title: "XML 网站地图可视化与深度分析",
            description:
                "解析 sitemap.xml 网址或 XML 代码，直观可视化网址层级、最后修改时间（lastmod）、更新频率、优先级、hreflang 多语言设置及站点地图索引结构。",
            keywords: ["sitemap可视化", "网站地图分析", "XML网站地图", "hreflang分析", "多语言SEO"],
        },
        "zh-hant": {
            title: "XML 網站地圖視覺化與深度分析",
            description:
                "解析 sitemap.xml 網址或 XML 程式碼，直觀視覺化網址階層、最後修改時間（lastmod）、更新頻率、優先級、hreflang 多語言設定及網站地圖索引結構。",
            keywords: ["sitemap視覺化", "網站地圖分析", "XML網站地圖", "hreflang分析", "多語言SEO"],
        },
        ru: {
            title: "Визуализатор и анализ sitemap.xml",
            description:
                "Анализ файлов sitemap.xml и sitemap index: просмотр структуры URL, дат lastmod, приоритетов, частоты изменений и мультиязычных связей hreflang.",
            keywords: ["анализ sitemap.xml", "визуализатор карты сайта", "проверка hreflang", "sitemap index"],
        },
    },
    "/privacy": {
        ja: {
            title: "プライバシーポリシー",
            description:
                "BlossomsArchive Toolsのプライバシーポリシーです。ユーザーの入力データやファイルの完全クライアントサイド処理および個人情報保護に関する基本方針を掲載しています。",
            keywords: ["プライバシーポリシー", "個人情報保護方針", "セキュリティ方針"],
        },
        en: {
            title: "Privacy Policy",
            description:
                "Privacy policy for BlossomsArchive Tools: our commitment to client-side data processing, zero-upload architecture, and user privacy protection principles.",
            keywords: ["privacy policy", "data protection", "client-side privacy"],
        },
        ko: {
            title: "개인정보처리방침",
            description:
                "BlossomsArchive Tools의 개인정보처리방침입니다. 사용자의 데이터와 파일의 완전한 클라이언트 측 처리 및 개인정보 보호에 관한 기본 방침을 안내합니다.",
            keywords: ["개인정보처리방침", "프라이버시 정책", "데이터 보안"],
        },
        "zh-hans": {
            title: "隐私政策",
            description:
                "BlossomsArchive Tools 的隐私政策说明：我们承诺所有输入数据与文件均在客户端本地安全处理，绝不向远程服务器上传个人隐私信息。",
            keywords: ["隐私政策", "个人信息保护", "客户端隐私安全"],
        },
        "zh-hant": {
            title: "隱私權政策",
            description:
                "BlossomsArchive Tools 的隱私權政策說明：我們承諾所有輸入資料與檔案均在用戶端本地安全處理，絕不向遠端伺服器上傳個人隱私資訊。",
            keywords: ["隱私權政策", "個人資訊保護", "用戶端隱私安全"],
        },
        ru: {
            title: "Политика конфиденциальности",
            description:
                "Политика конфиденциальности BlossomsArchive Tools: обработка данных на стороне клиента, отсутствие загрузки файлов на сервер и защита данных.",
            keywords: ["политика конфиденциальности", "защита персональных данных", "безопасность данных"],
        },
    },
    "/credits": {
        ja: {
            title: "使用ライブラリ",
            description:
                "BlossomsArchive Toolsの開発・動作に使用しているオープンソースライブラリ（Solid.js・Tailwind CSS・DaisyUI等）とアイコンのライセンス情報一覧です。",
            keywords: ["ライセンス", "オープンソース", "クレジット", "OSS"],
        },
        en: {
            title: "Credits & Open Source Licenses",
            description:
                "Licenses and attributions for open-source software libraries, frameworks, and icons (Solid.js, Tailwind CSS, DaisyUI) powering BlossomsArchive Tools.",
            keywords: ["credits", "open source licenses", "third party licenses", "attributions"],
        },
        ko: {
            title: "오픈소스 라이선스 및 크레딧",
            description:
                "BlossomsArchive Tools의 개발 및 운영에 사용된 오픈소스 소프트웨어 라이브러리(Solid.js, Tailwind CSS, DaisyUI 등)와 아이콘의 라이선스 정보 목록입니다.",
            keywords: ["라이선스", "오픈소스", "크레딧", "저작권 정보"],
        },
        "zh-hans": {
            title: "开源许可与致谢",
            description:
                "BlossomsArchive Tools 所采用的开源软件库（Solid.js、Tailwind CSS、DaisyUI 等）以及图标资源的开源许可证信息与开发致谢列表。",
            keywords: ["开源许可", "开源软件致谢", "第三方许可", "版权声明"],
        },
        "zh-hant": {
            title: "開源授權與致謝",
            description:
                "BlossomsArchive Tools 所採用的開源軟體庫（Solid.js、Tailwind CSS、DaisyUI 等）以及圖示資源的開源授權條款資訊與開發致謝清單。",
            keywords: ["開源授權", "開源軟體致謝", "第三方授權", "版權聲明"],
        },
        "ru": {
            title: "Лицензии и благодарности",
            description:
                "Сведения о лицензиях библиотек с открытым исходным кодом (Solid.js, Tailwind CSS, DaisyUI) и иконок, используемых в BlossomsArchive Tools.",
            keywords: ["лицензии", "open source", "благодарности", "авторские права"],
        },
    },
    "/mosaic-art": {
        ja: {
            title: "モザイクアート作成",
            description:
                "お好みの完成画像と複数の構成画像から、色味の加工なしで素材本来の写真を並べた高精細モザイクアート（フォトモザイク）をブラウザ完結で安全に生成できる無料ツールです。",
            keywords: ["モザイクアート", "フォトモザイク", "モザイク写真", "モザイクアート作成", "画像生成"],
        },
        en: {
            title: "Mosaic Art Generator",
            description:
                "Create stunning photomosaics from your target image and multiple photo tiles without any color modification or tinting, entirely in your browser.",
            keywords: ["mosaic art", "photomosaic", "mosaic generator", "photo tile", "image tool"],
        },
        ko: {
            title: "모자이크 아트 생성기",
            description:
                "목표 이미지와 여러 장의 구성 사진을 사용하여 색상 왜곡이나 보정 없이 본래의 색감 그대로 고화질 포토모자이크를 브라우저에서 안전하게 생성합니다.",
            keywords: ["모자이크 아트", "포토모자이크", "사진 모자이크", "모자이크 생성기", "이미지 도구"],
        },
        "zh-hans": {
            title: "马赛克拼图生成器",
            description:
                "使用目标图片与多张构图照片，完全不修改素材原本色彩，在浏览器端安全生成高质量照片马赛克（Photomosaic）艺术拼图。",
            keywords: ["马赛克拼图", "照片拼贴", "照片马赛克", "拼图生成器", "图像工具"],
        },
        "zh-hant": {
            title: "馬賽克拼圖生成器",
            description:
                "使用目標圖片與多張構圖照片，完全不修改素材原本色彩，在瀏覽器端安全生成高品質照片馬賽克（Photomosaic）藝術拼圖。",
            keywords: ["馬賽克拼圖", "照片拼貼", "照片馬賽克", "拼圖生成器", "圖像工具"],
        },
        ru: {
            title: "Генератор мозаики из фото",
            description:
                "Создавайте фотомозаику из целевого изображения и набора фотографий без изменения исходных цветов и оттенков прямо в браузере.",
            keywords: ["мозаика из фото", "фотомозаика", "генератор мозаики", "обработка фото"],
        },
    },
    "/ar-camera": {
        ja: {
            title: "ARカメラ・立ち絵重ね撮影",
            description:
                "カメラ映像に立ち絵などの透過画像を重ねて撮影できる無料Webツールです。リアルな接地・投影影を計算するARモードと、画面上の自由な位置に固定できるオーバーレイモードの両方に対応しています。",
            keywords: ["ARカメラ", "立ち絵合成", "透過画像", "オーバーレイカメラ", "リアル影計算"],
        },
        en: {
            title: "AR Camera Character Overlay",
            description:
                "Overlay transparent character art onto your live camera feed with realistic AR ground shadows, ambient lighting, or fixed screen positioning.",
            keywords: ["AR camera", "character overlay", "transparent PNG", "realistic shadow", "photo studio"],
        },
        ko: {
            title: "AR 카메라 캐릭터 오버레이",
            description:
                "카메라 화면에 투명 배경 캐릭터 이미지를 겹쳐 촬영할 수 있는 무료 웹 도구입니다. 실제 같은 그림자를 계산하는 AR 모드와 자유 위치 고정 모드를 모두 지원합니다.",
            keywords: ["AR 카메라", "캐릭터 합성", "투명 PNG", "그림자 계산", "오버레이 카메라"],
        },
        "zh-hans": {
            title: "AR相机与立绘叠加拍摄",
            description:
                "在相机画面上叠加透明立绘图像的免费在线工具。支持物理投影阴影与环境光适配的 AR 模式，以及自由固定画面位置的叠加模式。",
            keywords: ["AR相机", "立绘合成", "透明图片", "阴影计算", "叠加拍摄"],
        },
        "zh-hant": {
            title: "AR相機與立繪疊加拍攝",
            description:
                "在相機畫面上疊加透明立繪圖像的免費線上工具。支援物理投影陰影與環境光適配的 AR 模式，以及自由固定畫面位置的疊加模式。",
            keywords: ["AR相機", "立繪合成", "透明圖片", "陰影計算", "疊加拍攝"],
        },
        ru: {
            title: "AR-камера с наложением спрайтов",
            description:
                "Наложение прозрачных изображений и персонажей на живую камеру. Режим AR с расчетом реалистичных теней на земле и режим свободной фиксации на экране.",
            keywords: ["AR камера", "наложение изображений", "прозрачный PNG", "реалистичные тени"],
        },
    },
    "/photo-composite": {
        ja: {
            title: "写真・立ち絵合成スタジオ",
            description:
                "背景写真に複数体の立ち絵を後から自然に合成できる無料Webツールです。AI奥行きによる遮蔽・被写界深度ボケ・接地影・環境光馴染ませ・実寸身長調整に対応しています。",
            keywords: ["写真合成", "立ち絵合成", "複数体", "被写界深度", "AI奥行き", "透過画像合成"],
        },
        en: {
            title: "Photo Character Composite Studio",
            description:
                "Composite multiple transparent character illustrations onto photos with AI depth occlusion, ambient lighting, shadows, and Depth of Field.",
            keywords: ["photo composite", "multiple characters", "transparent PNG", "depth of field", "AI depth"],
        },
        ko: {
            title: "사진 캐릭터 합성 스튜디오",
            description:
                "배경 사진에 여러 명의 투명 캐릭터 스탠딩 이미지를 자연스럽게 합성할 수 있는 무료 웹 도구입니다. AI 깊이 가림, 심도 보케, 접지 그림자, 환경광 보정을 지원합니다.",
            keywords: ["사진 합성", "다중 캐릭터", "투명 PNG", "피사계 심도", "AI 깊이"],
        },
        "zh-hans": {
            title: "照片立绘合成工作室",
            description:
                "将多张透明立绘自然合成到背景照片中的免费在线工具。支持本地 AI 深度遮挡、景深虚化、落地投影、局部环境光适配与实际身高比例调整。",
            keywords: ["照片合成", "多立绘合成", "透明图片", "景深虚化", "AI深度"],
        },
        "zh-hant": {
            title: "照片立繪合成工作室",
            description:
                "將多張透明立繪自然合成到背景照片中的免費線上工具。支援本地 AI 深度遮擋、景深虛化、落地投影、局部環境光適配與實際身高比例調整。",
            keywords: ["照片合成", "多立繪合成", "透明圖片", "景深虛化", "AI深度"],
        },
        ru: {
            title: "Студия фотокомпозиции персонажей",
            description:
                "Бесплатный веб-инструмент для естественного добавления нескольких прозрачных персонажей на готовые фотографии с поддержкой глубины ИИ, теней и боке.",
            keywords: ["фотомонтаж", "несколько персонажей", "прозрачный PNG", "глубина резкости", "ИИ глубина"],
        },
    },
};

export function getLocalizedRouteMeta(
    path: string,
    locale: SupportedLocale = "ja",
): LocalizedRouteMeta {
    const rawPath = path.replace(/^\/(?:en|ko|zh-hans|zh-hant|ru)(?=\/|$)/, "") || "/";
    const entry = ROUTE_TRANSLATIONS[rawPath];
    if (entry && entry[locale]) {
        return entry[locale];
    }
    if (entry && entry.ja) {
        return entry.ja;
    }
    return {
        title: "Web Tool",
        description: "Free online web tool for daily productivity.",
    };
}


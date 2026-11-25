import type { SupportedLocale } from "./types";

export interface UiTranslations {
    siteTitle: string;
    siteDescription: string;
    dashboardTitle: string;
    languageSelectorLabel: string;
    searchPlaceholder: string;
    favorites: string;
    allTools: string;
    home: string;
    privacyPolicy: string;
    credits: string;
    share: string;
    searchMenu: string;
    shareTwitter: string;
    copyUrl: string;
    copied: string;
    themeToggle: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    menuOpen: string;
    menuClose: string;
    close: string;
    noResults: string;
    commandPaletteTitle: string;
    commandPalettePlaceholder: string;
    commandPaletteHint: string;
    categoryWeb: string;
    categoryMedia: string;
    categoryUtility: string;
    categoryAudioPhoto: string;
    backToHome: string;
    pageNotFoundTitle: string;
    pageNotFoundDesc: string;
}

export const UI_TRANSLATIONS: Record<SupportedLocale, UiTranslations> = {
    ja: {
        siteTitle: "BlossomsArchive Tools",
        siteDescription:
            "電卓やQRコード生成、画像変換、動画圧縮、文字コード変換、OGP・SEOメタタグ確認など、日常やWeb制作・開発に役立つ高品質なWebツールを完全無料で利用できます。",
        dashboardTitle: "ツールダッシュボード",
        languageSelectorLabel: "言語を変更",
        searchPlaceholder: "メニューを検索...",
        searchMenu: "メニュー内を検索",
        favorites: "お気に入り",
        allTools: "すべてのツール",
        home: "ホーム",
        privacyPolicy: "プライバシーポリシー",
        credits: "使用ライブラリ",
        share: "このサイトを共有",
        shareTwitter: "Xでシェア",
        copyUrl: "URLをコピー",
        copied: "コピーしました",
        themeToggle: "テーマ切り替え",
        themeLight: "ライトモード",
        themeDark: "ダークモード",
        themeSystem: "システム設定に従う",
        menuOpen: "メニューを開く",
        menuClose: "メニューを閉じる",
        close: "閉じる",
        noResults: "該当するツールが見つかりません",
        commandPaletteTitle: "コマンドパレット",
        commandPalettePlaceholder: "ツールや機能を検索...",
        commandPaletteHint: "↑↓で選択、Enterで確定、Escで閉じる",
        categoryWeb: "Web・開発ツール",
        categoryMedia: "メディア・デザイン",
        categoryUtility: "便利ユーティリティ",
        categoryAudioPhoto: "オーディオ・写真",
        backToHome: "ホームに戻る",
        pageNotFoundTitle: "ページが見つかりません",
        pageNotFoundDesc: "お探しのページは移動または削除された可能性があります。",
    },
    en: {
        siteTitle: "BlossomsArchive Tools",
        siteDescription:
            "Free, high-quality, privacy-first web tools for daily use and development: calculator, QR code generator, image converter, video compressor, SEO/OGP checker, and more.",
        dashboardTitle: "Tools Dashboard",
        languageSelectorLabel: "Change Language",
        searchPlaceholder: "Search tools...",
        searchMenu: "Search menu",
        favorites: "Favorites",
        allTools: "All Tools",
        home: "Home",
        privacyPolicy: "Privacy Policy",
        credits: "Credits & Licenses",
        share: "Share",
        shareTwitter: "Share on X",
        copyUrl: "Copy URL",
        copied: "Copied!",
        themeToggle: "Toggle Theme",
        themeLight: "Light Mode",
        themeDark: "Dark Mode",
        themeSystem: "Follow System",
        menuOpen: "Open menu",
        menuClose: "Close menu",
        close: "Close",
        noResults: "No matching tools found",
        commandPaletteTitle: "Command Palette",
        commandPalettePlaceholder: "Search tools and features...",
        commandPaletteHint: "Use ↑↓ to navigate, Enter to select, Esc to close",
        categoryWeb: "Web & Developer Tools",
        categoryMedia: "Media & Design",
        categoryUtility: "Utilities",
        categoryAudioPhoto: "Audio & Photography",
        backToHome: "Back to Home",
        pageNotFoundTitle: "Page Not Found",
        pageNotFoundDesc: "The page you are looking for might have been moved or removed.",
    },
    ko: {
        siteTitle: "BlossomsArchive Tools",
        siteDescription:
            "계산기, QR 코드 생성, 이미지 변환, 동영상 압축, 문자 코드 변환, OGP 및 SEO 메타태그 확인 등 일상과 웹 개발에 유용한 고품질 웹 도구를 무료로 이용하세요.",
        dashboardTitle: "도구 대시보드",
        languageSelectorLabel: "언어 변경",
        searchPlaceholder: "도구 검색...",
        searchMenu: "메뉴 검색",
        favorites: "즐겨찾기",
        allTools: "모든 도구",
        home: "홈",
        privacyPolicy: "개인정보처리방침",
        credits: "오픈소스 라이선스",
        share: "이 사이트 공유",
        shareTwitter: "X에 공유",
        copyUrl: "URL 복사",
        copied: "복사되었습니다!",
        themeToggle: "테마 전환",
        themeLight: "라이트 모드",
        themeDark: "다크 모드",
        themeSystem: "시스템 설정 따름",
        menuOpen: "메뉴 열기",
        menuClose: "메뉴 닫기",
        close: "닫기",
        noResults: "검색된 도구가 없습니다",
        commandPaletteTitle: "커맨드 팔레트",
        commandPalettePlaceholder: "도구 및 기능 검색...",
        commandPaletteHint: "↑↓ 이동, Enter 선택, Esc 닫기",
        categoryWeb: "웹 및 개발 도구",
        categoryMedia: "미디어 및 디자인",
        categoryUtility: "편리한 유틸리티",
        categoryAudioPhoto: "오디오 및 사진",
        backToHome: "홈으로 돌아가기",
        pageNotFoundTitle: "페이지를 찾을 수 없습니다",
        pageNotFoundDesc: "요청하신 페이지가 이동되었거나 삭제되었습니다.",
    },
    "zh-hans": {
        siteTitle: "BlossomsArchive Tools",
        siteDescription:
            "免费提供高质量、注重隐私的在线工具箱：计算器、二维码生成、图片格式转换、视频压缩、字符编码转换、SEO及OGP检测等，满足日常与开发需求。",
        dashboardTitle: "工具仪表板",
        languageSelectorLabel: "切换语言",
        searchPlaceholder: "搜索工具...",
        searchMenu: "在菜单中搜索",
        favorites: "收藏夹",
        allTools: "所有工具",
        home: "首页",
        privacyPolicy: "隐私政策",
        credits: "开源许可与致谢",
        share: "分享此站点",
        shareTwitter: "分享到 X",
        copyUrl: "复制链接",
        copied: "已复制！",
        themeToggle: "切换外观主题",
        themeLight: "浅色模式",
        themeDark: "深色模式",
        themeSystem: "跟随系统",
        menuOpen: "打开菜单",
        menuClose: "关闭菜单",
        close: "关闭",
        noResults: "未找到相关工具",
        commandPaletteTitle: "命令面板",
        commandPalettePlaceholder: "搜索工具与功能...",
        commandPaletteHint: "按 ↑↓ 键导航，Enter 确认，Esc 关闭",
        categoryWeb: "Web 与开发者工具",
        categoryMedia: "多媒体与设计",
        categoryUtility: "日常实用工具",
        categoryAudioPhoto: "音频与摄影",
        backToHome: "返回首页",
        pageNotFoundTitle: "页面不存在",
        pageNotFoundDesc: "您访问的页面可能已被移动或删除。",
    },
    "zh-hant": {
        siteTitle: "BlossomsArchive Tools",
        siteDescription:
            "免費提供高品質、注重隱私的線上工具箱：計算機、QR碼生成、圖片格式轉換、影片壓縮、字符編碼轉換、SEO與OGP檢測等，滿足日常與開發需求。",
        dashboardTitle: "工具儀表板",
        languageSelectorLabel: "切換語言",
        searchPlaceholder: "搜尋工具...",
        searchMenu: "在選單中搜尋",
        favorites: "我的最愛",
        allTools: "所有工具",
        home: "首頁",
        privacyPolicy: "隱私權政策",
        credits: "開源授權與致謝",
        share: "分享此網站",
        shareTwitter: "分享至 X",
        copyUrl: "複製連結",
        copied: "已複製！",
        themeToggle: "切換主題外觀",
        themeLight: "淺色模式",
        themeDark: "深色模式",
        themeSystem: "跟隨系統",
        menuOpen: "開啟選單",
        menuClose: "關閉選單",
        close: "關閉",
        noResults: "查無符合的工具",
        commandPaletteTitle: "指令面板",
        commandPalettePlaceholder: "搜尋工具與功能...",
        commandPaletteHint: "使用 ↑↓ 鍵移動，Enter 確定，Esc 關閉",
        categoryWeb: "Web 與開發者工具",
        categoryMedia: "多媒體與設計",
        categoryUtility: "日常實用工具",
        categoryAudioPhoto: "音訊與攝影",
        backToHome: "返回首頁",
        pageNotFoundTitle: "找不到頁面",
        pageNotFoundDesc: "您所尋找的頁面可能已被移動或移除。",
    },
    ru: {
        siteTitle: "BlossomsArchive Tools",
        siteDescription:
            "Бесплатные, безопасные веб-инструменты для повседневных задач и веб-разработки: калькулятор, генератор QR-кодов, конвертер изображений, сжатие видео, проверка SEO и OGP.",
        dashboardTitle: "Панель инструментов",
        languageSelectorLabel: "Выбрать язык",
        searchPlaceholder: "Поиск инструментов...",
        searchMenu: "Поиск по меню",
        favorites: "Избранное",
        allTools: "Все инструменты",
        home: "Главная",
        privacyPolicy: "Политика конфиденциальности",
        credits: "Лицензии и благодарности",
        share: "Поделиться сайтом",
        shareTwitter: "Поделиться в X",
        copyUrl: "Скопировать ссылку",
        copied: "Скопировано!",
        themeToggle: "Переключить тему",
        themeLight: "Светлая тема",
        themeDark: "Темная тема",
        themeSystem: "Системная тема",
        menuOpen: "Открыть меню",
        menuClose: "Закрыть меню",
        close: "Закрыть",
        noResults: "Инструменты не найдены",
        commandPaletteTitle: "Палитра команд",
        commandPalettePlaceholder: "Поиск инструментов и функций...",
        commandPaletteHint: "Используйте ↑↓ для навигации, Enter для выбора, Esc для закрытия",
        categoryWeb: "Веб и разработка",
        categoryMedia: "Медиа и дизайн",
        categoryUtility: "Полезные утилиты",
        categoryAudioPhoto: "Аудио и фото",
        backToHome: "На главную",
        pageNotFoundTitle: "Страница не найдена",
        pageNotFoundDesc: "Запрашиваемая страница перемещена или удалена.",
    },
};

export function getUiTranslations(locale: SupportedLocale): UiTranslations {
    return UI_TRANSLATIONS[locale] ?? UI_TRANSLATIONS.ja;
}

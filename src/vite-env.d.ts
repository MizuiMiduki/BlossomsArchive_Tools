/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_ADSENSE_DEFAULT_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

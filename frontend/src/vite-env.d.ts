/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production API base URL, e.g. https://taskpulse-api.onrender.com/api */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

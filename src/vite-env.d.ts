/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_CLOUD_MODEL?: string;
}

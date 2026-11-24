import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import firebaseConfig from "./firebase-config";

/**
 * Firebase app + AI Logic initialisation.
 *
 * App Check is required by Firebase AI Logic. Two modes are supported:
 *  - Local development: set VITE_APPCHECK_DEBUG_TOKEN in .env.local
 *    (git-ignored). We then hand the token to the SDK via the documented
 *    `self.FIREBASE_APPCHECK_DEBUG_TOKEN` global so the debug provider is
 *    used. If the variable is empty, we set it to `true` so the SDK prints
 *    a fresh debug token in the browser console on first run; register that
 *    token in Firebase Console -> App Check -> Manage debug tokens, then
 *    pin it in .env.local.
 *  - Production: set VITE_RECAPTCHA_SITE_KEY and the reCAPTCHA v3 provider
 *    is used instead.
 *
 * The debug token itself must NEVER be committed; only this wiring is.
 */
let app: FirebaseApp | null = null;
let aiInstance: AI | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
    initAppCheck(app);
  }
  return app;
}

function initAppCheck(firebaseApp: FirebaseApp): void {
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as
    | string
    | undefined;
  try {
    if (recaptchaSiteKey) {
      initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
      return;
    }
    if (import.meta.env.DEV) {
      const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as
        | string
        | undefined;
      // Documented debug-provider hookup: when this global is present
      // before initializeAppCheck(), the SDK uses the debug provider
      // instead of the configured attestation provider.
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean })
        .FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken ? debugToken : true;
      initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(
          recaptchaSiteKey ?? "debug-token-only",
        ),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    // App Check misconfiguration must not crash the whole app; AI calls
    // will surface a clear error instead.
    console.warn("[app-check] initialisation skipped/failed:", err);
  }
}

/** Shared AI Logic handle (Gemini Developer API backend, free tier). */
export function getAIHandle(): AI {
  if (!aiInstance) {
    aiInstance = getAI(getFirebaseApp(), {
      backend: new GoogleAIBackend(),
    });
  }
  return aiInstance;
}

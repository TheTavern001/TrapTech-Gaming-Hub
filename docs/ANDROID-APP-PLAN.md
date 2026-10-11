# Android app path — keep one Gaming Hub codebase

## Recommendation

Ship the web version first and keep it as the single source of truth. The repository already includes a web app manifest and service worker, so the first step is to finish PWA installability and test it on real Android devices. Do not create a separate native game implementation before the browser games are stable.

## Phase 1: installable web app

- Use a valid HTTPS production or private QA origin.
- Verify all manifest icon files exist and render at 192×192 and 512×512, including the maskable icon.
- Test Add to Home Screen / Install, launch icon, splash screen, standalone display, Android Back navigation, login/session persistence, network loss/recovery, and service-worker updates.
- Do not cache API responses, authenticated user data, payment checkout pages, admin pages, or any response marked no-store.
- Verify game pages do not overwrite the cached home page and that a failed navigation falls back safely.
- Test the actual install flow on the target Android device; a manifest alone does not prove the PWA is installable.

## Phase 2: Play Store packaging

Once web QA is green, compare:
- **Trusted Web Activity (TWA):** a browser-backed Android shell for a well-tested HTTPS PWA. It requires domain ownership verification and a reliable web experience.
- **Native wrapper/WebView:** more control over app-level features, but adds maintenance and policy risk if it is just a thin website shell without useful mobile functionality.

Use the same website and game code wherever possible. Choose the packaging route only after the private web QA proves that the product offers stable, meaningful functionality.

## Google Play checklist

- Create the developer account and verify identity through Google Play Console privately. Public developer-profile information may be visible according to account type and Play requirements; do not assume an app listing can conceal legally required developer details.
- Publish a real privacy policy and complete Data safety declarations accurately.
- Set accurate age/content ratings, including any cannabis-themed fictional art, social features, prizes, user-generated content, and purchase flows.
- Review Google Play's current payments policy before selling digital goods inside the Android app. A web Stripe checkout must not be assumed permitted for in-app digital items; Google Play Billing or an applicable policy exception may be required.
- Provide reviewers with a working test account if sign-in gates any feature.
- Use internal testing first, then closed testing, then production after policy requirements are met.
- Do not use misleading store screenshots or promise features that are not actually implemented.
- Monitor crashes, ANRs, memory, performance, user feedback, and policy notices after launch.

Official references:
- Play testing tracks: https://support.google.com/googleplay/android-developer/answer/9845334
- New personal developer account testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
- Play quality guidance: https://support.google.com/googleplay/android-developer/answer/13965279
- Android Trusted Web Activity helper: https://android.googlesource.com/platform/external/android-browser-helper/

## Do not submit yet

The current project is not ready for a Play Store submission while the games have known bugs, full game visuals are incomplete, the provider connections have not been tested, and security review is unfinished. Play Store distribution should follow—not replace—the private QA process.

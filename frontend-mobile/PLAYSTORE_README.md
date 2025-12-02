# Publishing to Google Play (CI)

This project includes a GitHub Actions workflow to build and publish an Android App Bundle (AAB) to Google Play.

Required repository secrets (add these in GitHub Settings > Secrets > Actions):

- `PLAYSTORE_SERVICE_ACCOUNT_JSON` — JSON key contents for a Google Play service account with `Release` permissions.
- `ANDROID_KEYSTORE_BASE64` — Base64-encoded JKS keystore file used to sign your app.
- `ANDROID_KEYSTORE_PASSWORD` — Password for the keystore.
- `ANDROID_KEY_ALIAS` — Key alias inside the keystore.
- `ANDROID_KEY_PASSWORD` — Password for the key alias.

Notes:
- Replace the placeholder `packageName` in `.github/workflows/publish-playstore.yml` with your app's package id (e.g., `com.example.app`).
- The workflow builds the web assets, syncs Capacitor for production, builds the Android App Bundle using Gradle, and uploads it to the `internal` track by default.

Triggering manually:
- From GitHub: Actions -> Build and Publish to Google Play -> Run workflow
- From CLI: push to `main` branch (workflow runs on push to `main`).

# CleanExpense Android

Android companion for https://cleanexpense.vercel.app, package `com.cleanexpense.app`, version 1.0.0. Uses the existing responsive web screens inside an Android WebView, plus native bottom navigation, the Android document picker, share-to-app PDF support and CSV export to a chosen document.

## Use

1. Install the signed APK on your phone. Android may ask you to allow installation from the browser or file manager you use.
2. Open CleanExpense and sign in with the same app passphrase as the website. The app remembers its own session for seven days; it does not share browser cookies with Chrome.
3. Overview loads the saved PostgreSQL transactions. Category corrections, statement duplicate checks, charts, the timeline and saved/on-demand AI forecasts use the same HTTPS service and database.
4. Select **Import PDF** or the screen's **Import statement** button. Pick a PDF or CSV from Android Files, Downloads or a document provider. You can also share a PDF from another app to CleanExpense.
5. For NAB text-based transaction listings, keep Local PDF mode: PDF text extraction occurs inside the device WebView. Other/scanned PDFs require the existing OpenAI mode and consent. Preview and confirm new transactions; the service skips duplicates and saves the import.
6. **Export CSV** opens Android's save-document picker.

The app requires internet for its screens, saved records, duplicate checking and AI generation. It is not a separate offline database. Supports Android 8.0+ with a recent compatible Android System WebView. Local PDF limit is 20 MB; CSV and AI PDF limits remain those enforced by the web app.

## Security

- Only the INTERNET permission is declared. File access uses individually selected document URIs; no broad storage permission is needed.
- No PostgreSQL connection string, OpenAI key or app passphrase is bundled in the APK.
- Main-frame app navigation stays on the production HTTPS origin. External HTTPS links open in the system browser. Cleartext and mixed content are blocked; certificate errors are rejected.
- Android backup/device transfer is excluded for the app's local data, including session cookies.
- The export bridge accepts bounded CSV content and always asks the user to select an output document. It does not expose arbitrary filesystem access or native credentials.

## Build

Open this directory in Android Studio, or use the included Gradle 8.9 wrapper with JDK 17/21 and Android SDK 35. Set `sdk.dir` in ignored `local.properties`.

For a signed release, create `signing.properties`:

```properties
storeFile=.android-signing/release.p12
storePassword=YOUR_LOCAL_KEYSTORE_PASSWORD
keyAlias=cleanexpense
keyPassword=YOUR_LOCAL_KEY_PASSWORD
```

Then run `gradlew.bat :app:assembleRelease :app:lintRelease` (Windows) or `./gradlew :app:assembleRelease :app:lintRelease`. Output: `app/build/outputs/apk/release/app-release.apk`.

The initial release signing key and its passwords are stored locally in ignored `.android-signing/` and `signing.properties`. Retain them for compatible future updates; neither is committed. A fresh checkout without them can build `:app:assembleDebug` for development.

In a Windows environment with an excessively long temporary directory, Java local sockets may fail. Set `JAVA_TOOL_OPTIONS` to `-Djdk.net.unixdomain.tmpdir=C:/Temp/Code/sense/.java-tmp -Djava.io.tmpdir=C:/Temp/Code/sense/.java-tmp` after creating that short directory, then retry.

## Verification

Release build, Android lint and APK signature verification are run before delivery. Device installation and native document-picker interaction still require a connected phone or emulator; none was available during this build.

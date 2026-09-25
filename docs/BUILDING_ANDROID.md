# Building an Android APK you can install and test

This project builds Android apps in the cloud with **EAS Build** (Expo's build service), so you do not need Android Studio, Java or the Android SDK on your computer. You run one command, wait, and get a link to an `.apk` file you install on a phone.

## What you are building

| Profile (in `eas.json`) | Produces | Use it for |
|---|---|---|
| `preview` | an **APK** (installs directly) | testing the real app on your phone. **This is the one you want.** |
| `development` | a dev-client APK | day-to-day coding with live reload (needs Metro running) |
| `production` | an **AAB** (Play Store format, cannot be installed directly) | uploading to Google Play |

A `preview` APK is a normal release build: the JavaScript is bundled inside it, so it works without your computer or Metro.

## One-time setup

1. **Node** (v20+) and this repo's dependencies: `npm install`
2. **EAS CLI**: `npm install -g eas-cli` (or prefix every command below with `npx`)
3. **Log in** to the Expo account that owns the project (`dnlcodes`):
   ```sh
   eas login
   eas whoami        # should print dnlcodes
   ```
4. The project is already linked (`extra.eas.projectId` in `app.json`) and already has an Android signing key stored on EAS. Nothing to do.

### Environment variables

The app reads `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_BASE_URL`. Locally they live in `.env` (git-ignored). **EAS builds in the cloud and never sees your `.env`**, so they are stored on EAS instead:

```sh
eas env:list preview                       # see what is set
eas env:set preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://…" \
    --visibility plaintext                     # add or change one
```

If they are missing the app installs but cannot reach Supabase (empty screens, sign-in errors). `EXPO_PUBLIC_*` values end up inside the app anyway, so plaintext is right; never put a service-role key here.

## Build

From the repo root, on the branch/commit you want to test (commit your work first: EAS builds what is in the working folder, minus git-ignored files):

```sh
eas build --platform android --profile preview
```

* It uploads the project, queues, builds (roughly 10 to 25 minutes; the free plan can queue longer) and prints a build page URL.
* `--no-wait` returns immediately so you can close the terminal; check on it later:
  ```sh
  eas build:list --platform android --limit 3     # status of recent builds
  eas build:view <build-id>                       # details + the APK link
  ```
* When it says **finished**, the page has a download link and a QR code.

## Install on your phone

1. Open the build page (`https://expo.dev/accounts/dnlcodes/projects/litways/builds/<id>`) **on the phone**, or scan its QR code.
2. Tap **Install** / download the `.apk`.
3. Android will ask to allow installs from that app (Chrome, Files…): allow it once. (Settings → Apps → Special access → Install unknown apps.)
4. Open **Litway Picks**.

Or from a computer with the phone plugged in and USB debugging on: `adb install path/to/app.apk`.

**"App not installed"** usually means an older copy signed with a different key is on the phone. Uninstall it first, then install again. Installing a newer build over an older `preview` build keeps your data.

## What does not work in a preview APK

* **Push notifications.** Android needs Firebase (FCM) credentials for push. Until `google-services.json` is added and an FCM key is uploaded to EAS (`eas credentials`), the app cannot get a push token. It handles that quietly: the notifications inbox still works (order updates, saved-item alerts); only real pushes do not arrive.
* **Sign in with Face ID / fingerprint** works only on a device with biometrics enrolled.

## Updating what is on the phone

Any code change needs a new build (`eas build …` again, then install the new APK). Builds are numbered; the latest one is at the top of `eas build:list`. (Over-the-air updates with EAS Update would let JavaScript-only changes skip the rebuild; that is not set up yet.)

## Building from a clean copy (what we did for the test APK)

To test a combination of unmerged branches without disturbing your working folder:

```sh
git worktree add ../litways-apk -b build/android-test origin/master
cd ../litways-apk
git merge origin/feat/some-branch origin/feat/another-branch
ln -s ../mobile/node_modules node_modules      # reuse installed packages
eas build --platform android --profile preview
```

## When a build fails

1. Open the **build page → Logs** and jump to the first red error (usually under "Run gradlew" or "Install dependencies").
2. Reproduce cheaply first: `npx tsc --noEmit` and `npm run check:type`.
3. Common causes: a package added but not committed (`package-lock.json` out of date), a native module that needs a config plugin in `app.json`, or an env var missing on EAS.
4. Fix, commit, run the build command again.

## Quick reference

```sh
eas whoami                                   # who am I logged in as
eas build --platform android --profile preview           # build an installable APK
eas build --platform android --profile preview --no-wait # …and return immediately
eas build:list --platform android --limit 5  # recent builds and their status
eas build:view <id>                          # one build's details and download link
eas build:cancel <id>                        # stop a build you started by mistake
eas env:list preview                         # environment variables used by preview builds
eas credentials                              # signing keys, FCM credentials
```

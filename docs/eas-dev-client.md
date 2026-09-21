# EAS Build + Expo Dev Client Setup

This document describes how to create and use development client builds with EAS Build. Development clients are required for testing **in-app purchases (IAP)** on physical devices and simulators, as IAP cannot be tested in Expo Go.

## Why Development Clients?

- **IAP Testing**: Apple and Google IAP sandbox/test purchases require a real app bundle, not Expo Go
- **Native Code**: Test custom native modules and configurations
- **Production Parity**: Closer to actual App Store / Play Store builds

## Prerequisites

### 1. Expo Account

You need an Expo account to use EAS Build services:

1. Sign up at [https://expo.dev/signup](https://expo.dev/signup)
2. Run `eas login` in your terminal
3. Follow the authentication prompts

### 2. EAS CLI

Install the EAS CLI globally:

```bash
npm install -g eas-cli
```

### 3. Expo Project Setup

If this is your first time using EAS with this project, initialize it:

```bash
eas init
```

This command will:
- Create or link your project to an Expo account
- Add an `owner` field to your `app.json` (if not present)
- Generate an `extra.eas.projectId` in your `app.json`

**Note**: Brian must run `eas init` to link the project to his Expo account and generate the project ID. Do not commit a fake/placeholder project ID.

### 4. Apple Developer Account (for iOS)

To build for iOS:

1. You need an Apple Developer account ($99/year for individuals)
2. During your first iOS build, EAS will guide you through:
   - Generating or uploading signing certificates
   - Creating provisioning profiles
   - Registering your app bundle identifier

For development builds, EAS can auto-generate development credentials.

### 5. Google Play Console Account (for Android)

To build for Android:

1. You need a Google Play Console account (one-time $25 fee)
2. Android development builds use debug keystore by default (no special setup needed initially)
3. For internal distribution, you may need to set up signing keys (EAS can help)

## Build Profiles

This project has three EAS build profiles defined in `eas.json`:

### Development

```bash
npm run eas:dev:ios      # Build development client for iOS
npm run eas:dev:android  # Build development client for Android
```

- **Purpose**: Local development with native code
- **Features**: Includes expo-dev-client launcher, debug tools
- **Distribution**: Internal (simulator/device testing)
- **iOS**: Builds for simulator by default
- **Android**: Builds APK for easy device installation

### Preview

```bash
npm run eas:preview:ios      # Build preview for iOS
npm run eas:preview:android  # Build preview for Android
```

- **Purpose**: Internal testing, QA, beta testing
- **Distribution**: Internal (not for app stores)
- **Android**: Builds APK for easy sharing

### Production

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

- **Purpose**: App Store / Play Store submission
- **Distribution**: Store builds

## Simulator vs Device Builds (iOS)

For iOS development, this project provides two profiles:

### Simulator Profile (`development`)

```bash
npm run eas:dev:ios      # Builds for iOS Simulator
```

- **Best for**: Day-to-day development and testing
- **Faster**: No provisioning/signing overhead
- **Limitations**: Some native features behave differently on simulator

### Device Profile (`development-device`)

```bash
npm run eas:dev:ios:device      # Builds for physical iPhone/iPad
```

- **Best for**: Testing real device behavior, especially IAP
- **IAP Testing**: StoreKit sandbox purchases are **more reliable on physical devices**
- **Requires**: Apple Developer account and device provisioning (EAS guides you through this)

**Recommendation**: Use the simulator profile for daily development. When testing in-app purchases (PR #22), use the device profile on a physical iPhone to avoid StoreKit sandbox quirks that can occur on simulator.

## First-Time Build Workflow

### iOS Development Client

1. **Build the development client**:
   ```bash
   npm run eas:dev:ios
   ```

2. **Choose your target** when prompted:
   - Select "simulator" for testing on Xcode Simulator
   - Select "device" for testing on a physical iPhone/iPad (requires provisioning)

3. **Wait for build** (typically 5-15 minutes)
   - EAS Build will run in the cloud
   - You'll get a link to monitor progress

4. **Download and install**:
   - For simulator: Download the `.tar.gz` file, extract it, and drag the `.app` to your simulator
   - For device: Download via the Expo Go app or scan the QR code

### Android Development Client

1. **Build the development client**:
   ```bash
   npm run eas:dev:android
   ```

2. **Wait for build** (typically 5-15 minutes)

3. **Download and install**:
   - Download the APK to your Android device or emulator
   - Enable "Install from Unknown Sources" if needed
   - Install the APK

## Local Development with Dev Client

Once you have a development client installed on your device/simulator/emulator:

1. **Start Metro bundler with dev-client flag**:
   ```bash
   npm run start:dev-client
   ```

2. **Open the app** on your device/simulator/emulator

3. **Connect to Metro**:
   - The dev client will show connection options
   - Choose "Enter URL manually" if auto-connect fails
   - Enter your dev machine's local IP (e.g., `192.168.1.100:8081`)

4. **Develop normally**:
   - Code changes will hot-reload
   - Use shake gesture for dev menu
   - Same workflow as Expo Go, but with native capabilities

## IAP Testing (PR #22 Context)

**Important**: Once PR #22 (in-app purchases) merges, you'll need to rebuild your development client to include the `expo-iap` native module:

```bash
npm run eas:dev:ios      # Rebuild with IAP support
npm run eas:dev:android  # Rebuild with IAP support
```

After rebuilding, you can test sandbox purchases:

- **iOS**: Configure sandbox tester accounts in App Store Connect
- **Android**: Use test tracks in Google Play Console

## Troubleshooting

### Build Fails with "No project ID"

Run `eas init` to link your project to an Expo account.

### Build Fails with Missing Credentials

For iOS:
```bash
eas credentials
```

Follow prompts to configure signing credentials.

### Can't Connect to Metro from Dev Client

1. Ensure your dev machine and device are on the same network
2. Try entering the Metro URL manually: `http://YOUR_IP:8081`
3. Check firewall settings on your dev machine
4. For Android: Use `adb reverse tcp:8081 tcp:8081` if USB-connected

### "This app is not compatible with Expo Go"

This error appears if you try to open the project in Expo Go after adding native dependencies (like `expo-iap` in PR #22). You **must** use a development client instead.

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo Dev Client Documentation](https://docs.expo.dev/development/introduction/)
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [Internal Distribution](https://docs.expo.dev/build/internal-distribution/)

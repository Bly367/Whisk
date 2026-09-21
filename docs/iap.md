# In-App Purchase Setup

Whisk uses **expo-iap** for real App Store and Google Play one-time unlock purchases.

## Product overview

- **Base unlock**: One-time purchase at $6.99 (default)
- **Influencer discount**: $4.99 via promo codes (single SKU approach)
- **Admin codes**: Free unlock for testing/demo (local entitlement only)

## Product ID configuration

Product IDs are defined in `features/trust/iapConfig.ts`:

```typescript
export const IAP_PRODUCT_IDS = {
  fullUnlock: __DEV__ 
    ? 'app.whisk.unlock.onetime.dev' 
    : 'app.whisk.unlock.onetime',
  discountedUnlock: null, // Using promo codes instead
};
```

**Replace these placeholders with your actual product IDs from App Store Connect and Google Play Console.**

## Store setup

### App Store Connect (iOS)

1. **Create in-app purchase product**:
   - Go to App Store Connect → Your App → Features → In-App Purchases
   - Click "+" to create new product
   - Type: **Non-Consumable** (one-time unlock)
   - Product ID: Match `IAP_PRODUCT_IDS.fullUnlock` (e.g., `app.whisk.unlock.onetime`)
   - Price: $6.99 USD (Tier 7)
   - Display name: "Whisk Full Unlock"
   - Description: "One-time unlock for unlimited imports and all features"

2. **Set up promo codes (optional)**:
   - In the same product, go to "Promotional Offers"
   - Create offer code: e.g., "WHISK499" for $4.99
   - Duration: One-time
   - This integrates with influencer codes in `features/trust/influencerCodes.ts`

3. **Add metadata**:
   - Screenshot: Upload a promotional image
   - Review notes: Explain test account credentials

### Google Play Console (Android)

1. **Create in-app product**:
   - Go to Play Console → Your App → Monetize → Products → In-app products
   - Click "Create product"
   - Product ID: Match `IAP_PRODUCT_IDS.fullUnlock` (e.g., `app.whisk.unlock.onetime`)
   - Name: "Whisk Full Unlock"
   - Description: "One-time unlock for unlimited imports and all features"
   - Price: $6.99 USD
   - Type: Non-consumable

2. **Configure promotional pricing**:
   - Use promo codes or pricing tiers for influencer discounts
   - Link with `features/trust/influencerCodes.ts` registry

3. **Activate the product**:
   - Status must be "Active" for production
   - Use "Inactive" for dev/testing only

## Environment requirements

### Expo Go (❌ NOT SUPPORTED)

In-app purchases **require native modules** that are not available in Expo Go. You must use:

- **Development client** (recommended for testing)
- **Production build** (EAS Build or bare workflow)

### Development client setup

1. **Install expo-iap** (already done):
   ```bash
   npm install expo-iap
   ```

2. **Add plugin to app.json** (already configured):
   ```json
   {
     "expo": {
       "plugins": ["expo-iap"]
     }
   }
   ```

3. **Build development client**:
   ```bash
   npx expo prebuild --clean
   npx expo run:ios  # or expo run:android
   ```

   Or use EAS Build:
   ```bash
   eas build --profile development --platform ios
   ```

4. **Verify installation**:
   - Open the app in your dev client
   - Navigate to Account → Unlock
   - Should see "Unlock now" button (not "In-app purchases require...")

## Testing purchases

### Sandbox testing (iOS)

1. **Create sandbox test account**:
   - App Store Connect → Users and Access → Sandbox Testers
   - Add new tester with unique email (can be fake, e.g., `test@example.com`)
   - Password: Set a test password

2. **Sign out of App Store**:
   - Settings → App Store → Sign Out (not iCloud!)
   - Do NOT sign in to sandbox account yet

3. **Make test purchase**:
   - Open Whisk dev client
   - Tap "Unlock now" button
   - When prompted, enter sandbox tester credentials
   - Purchase completes without real charge

4. **Test restore**:
   - Tap "Restore purchases" → should restore the sandbox purchase
   - Delete app and reinstall → restore again to verify persistence

### Test tracks (Android)

1. **Internal testing track**:
   - Play Console → Testing → Internal testing
   - Upload APK/AAB via EAS Build or manual build
   - Add testers by email
   - Share testing link

2. **Test purchase flow**:
   - Install app from internal testing link
   - Use real Google account (test card not charged in test tracks)
   - Complete purchase → verify entitlement
   - Test restore purchases

3. **License testing**:
   - Play Console → Settings → License Testing
   - Add test accounts for instant purchase approval

## Dev-only simulate mode

For local development **without a dev client**, the app provides `__DEV__` simulate buttons:

- **[DEV] Simulate unlock**: Sets local entitlement without store
- **[DEV] Simulate free plan**: Downgrades to test free tier

These buttons **only appear in development builds** (`__DEV__` is true). They are hidden in production.

Use the mock IAP service in tests:
```typescript
import { createMockIAPService } from '@/features/trust/iapService';

const service = createMockIAPService();
service.simulateCancellation = true;
const result = await service.purchase('product-id');
// result.success === false, result.error === 'user_cancelled'
```

## Environment variables

No secrets are required in the client. Product IDs are public configuration.

**Optional**: Use `.env` for dev/prod product ID switching:

```bash
# .env.production
IAP_PRODUCT_ID_UNLOCK=app.whisk.unlock.onetime

# .env.development
IAP_PRODUCT_ID_UNLOCK=app.whisk.unlock.onetime.dev
```

Update `iapConfig.ts` to read from env:
```typescript
import Constants from 'expo-constants';

export const IAP_PRODUCT_IDS = {
  fullUnlock: Constants.expoConfig?.extra?.iapProductId || 'app.whisk.unlock.onetime',
};
```

## Troubleshooting

### "In-app purchases require a development build"

- You're running in Expo Go or web
- Solution: Build a dev client with `npx expo prebuild` and `expo run:ios`

### "Could not connect to the app store"

- iOS: Not signed in to sandbox account, or network issue
- Android: Play Services not available, or test track not configured
- Solution: Check network, verify sandbox/test account setup

### "You already own this item"

- Purchase already completed (sandbox or real)
- Solution: Tap "Restore purchases" to sync entitlement

### Sandbox purchases not appearing

- iOS: Sign out of App Store (not iCloud), then retry purchase
- Clear sandbox test history: Settings → App Store → Sandbox Account → Delete Account
- Wait 5-10 minutes for Apple servers to sync

### Receipt validation failing

- Currently client-side only (no backend verification)
- Phase 2+ will add server-side receipt validation for security
- See `SECURITY.md` for client entitlement limitations

## Security notes

- **Client entitlements are not tamper-proof**: Local storage can be modified on jailbroken/rooted devices
- **Store is source of truth**: Restore purchases validates against App Store / Play Store
- **No privileged keys in client**: Product IDs are public; no backend secrets shipped
- **Admin codes are dev/demo only**: Do not ship production releases with undocumented admin codes

See [`SECURITY.md`](../SECURITY.md) for full security standards.

## Next steps for production

Before releasing to production:

1. ✅ Replace placeholder product IDs with real IDs from App Store Connect / Play Console
2. ✅ Set pricing ($6.99 USD or your chosen tier)
3. ✅ Configure promo codes for influencer discount ($4.99)
4. ✅ Test sandbox purchases on iOS and internal testing on Android
5. ✅ Verify restore purchases works after reinstall
6. ⏳ Add server-side receipt validation (Phase 2+)
7. ⏳ Implement cross-device entitlement sync (Phase 2+)

## Support

For issues with expo-iap, see:
- [expo-iap documentation](https://hyochan.github.io/expo-iap/)
- [GitHub issues](https://github.com/hyochan/expo-iap/issues)

For Whisk IAP questions, contact: ly.brian367@gmail.com

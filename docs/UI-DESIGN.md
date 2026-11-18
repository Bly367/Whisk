# Whisk UI Design

Every agent (Cursor cloud agents, Codex, Whisk UI, Whisk Review) must read this before it creates or changes any screen or component. If something in this guide conflicts with an older mock, this guide wins. Ask Brian before you change a rule here.

Visual reference: `docs/ui-reference/` holds `food-app-3screens.png` and `food-app-home.png`. Brian picked these on 2026-11-17 and likes their color scheme and overall feel. Match that feel; don't copy their content or branding.

## 1. Look and feel

Warm, calm and appetizing. The food photos carry the color, and the UI stays quiet around them. Use one accent color, lots of cream space, and serif headlines.

### Color tokens
Define these once in a theme module (for example `lib/theme.ts`) and import them everywhere. Never hard-code hex values in a component.

| token | value | use |
|---|---|---|
| `bg` | `#F6E9DE` | screen background (warm peach-cream) |
| `surface` | `#FFFFFF` | cards and sheets |
| `surfaceTint` | `#FBF1EA` | photo tiles and grouped rows |
| `accent` | `#F0954A` | primary buttons, active tab, prices, selected states, `+` badges |
| `accentPressed` | `#D97E35` | pressed state of the accent |
| `accentSoft` | `#FCE3CF` | accent chips and highlighted cells |
| `text` | `#1E1A17` | headings and body |
| `textMuted` | `#8A817A` | secondary text, such as "110g" or "Italian food · 60 min" |
| `border` | `#EDE3DA` | hairlines and input outlines |
| `success` | `#4CAF6A` | success badges only |
| `danger` | `#D9534F` | destructive actions and errors only |

Optional pastels for category tiles, at most one per tile: `#FDE7D6`, `#E6F0FA`, `#F3E3F6`, `#E5F3E8`.

Rules:
- Each screen gets one primary orange action. Everything else is neutral or outlined.
- Body text must reach at least 4.5:1 contrast (WCAG AA) and large text at least 3:1. White on `accent` is only for large or bold button labels. Elsewhere, put `text` on `accentSoft`.
- Ship light mode first. A dark mode, when it comes, uses its own tokens. It must never invert colors automatically.

### Typography
- Headings use a serif display font, for example Fraunces or Playfair Display loaded through `expo-font`, with Georgia as the fallback.
- Body and UI text use the system sans font (SF Pro).
- Pattern: the title is in `text` and the secondary part is in `textMuted`, as in "Choco croissant, **110g**" or "Cart, **3 items**".
- Scale: display 32, title 24, section 20, body 15–16, meta 12–13.
- Line height is about 1.25× for headings and 1.4× for body.
- Support Dynamic Type through `allowFontScaling` (on by default). Layouts must not clip text at the largest accessibility size.

### Shape, spacing and elevation
- Spacing uses a 4pt grid. Main steps are 4, 8, 12, 16, 24 and 32. Screen side padding is 16–20.
- Radius is 12 for tiles and inputs, 16 for cards and sheets, and full (pill) for chips, the CTA bar and steppers.
- Shadows are very soft (opacity ≤ 0.08, blur 12–20) or absent. Prefer tinted surfaces over heavy shadows.
- Use hairline borders (`border`) on inputs and list separators.

### Components (based on the reference)
- **Photo tile:** a rounded image on `surfaceTint`, with a label at top-left in serif 15–16 and an optional orange `+` circle at top-right.
- **Category grid:** two or three columns of tiles. A "featured" tile can use a solid `accent` fill with white text.
- **Horizontal carousels:** use them for Places, Best prices, and Add to order. The next item peeks in by about 20%. Section headers are serif.
- **Primary CTA bar:** full width, pill shape, `accent` fill, at least 52pt tall, pinned above the safe area. The price or count sits on the left, then a divider, then the action label.
- **Pills and tags:** small rounded chips on a translucent white or `accentSoft` background, such as "460 kcal", "Free" or "-50%".
- **Stepper:** `− 1 +` on an outlined pill, with each side at least 44×44.
- **Radio and check:** orange when selected. Use `accent` sparingly.
- **Tab bar:** thin line icons with labels. The active tab is `accent` and the inactive ones are `textMuted`.
- **Detail screen:** a large hero photo on a tinted background, a serif title with muted weight or size, compact ingredient text, and the CTA bar at the bottom.
- Keep Whisk's Yolk & Chick mascot moments, such as empty states, loading and success, but render them in this palette.

## 2. UI protocols (iOS / React Native)

- **Platform:** follow Apple's Human Interface Guidelines. Respect safe areas through `react-native-safe-area-context`, keep native back gestures, and don't block swipe-back.
- **Touch targets:** at least 44×44pt. Use `hitSlop` for small icons.
- **Accessibility:**
  - Every pressable needs an `accessibilityRole` and an `accessibilityLabel`.
  - Images get an `accessibilityLabel` or are marked decorative.
  - State must not depend on color alone. Pair it with an icon or text.
  - Support VoiceOver and Reduce Motion. Skip non-essential animation when reduce motion is on.
- **States:** every data view designs all five states (loading with skeletons, empty, error with a retry, partial, and success). Never leave a blank screen.
- **Feedback:**
  - Pressed states are visible within 100ms.
  - Use light haptics only for meaningful actions (add, save, complete).
  - Destructive actions need a confirmation or an undo.
- **Motion:** keep it short (150–250ms) with ease-out. Use Reanimated on the UI thread. No layout-thrashing animations.
- **Performance:**
  - Long lists use `FlashList` or `FlatList` with stable keys.
  - Images use `expo-image` with caching and fixed aspect ratios to avoid layout shift.
  - Memoize rows and don't do inline heavy work in render.
- **Forms:**
  - Use the correct `keyboardType`, `textContentType` and `autoComplete`.
  - Use keyboard-avoiding layouts.
  - Validate inline with plain-language errors.
- **Copy:** short, friendly, in sentence case. Errors say what happened and what to do. Show diagnostic codes such as `share-import-failure-code` in small `textMuted` text and never hide them.
- **Testing:**
  - New screens or components get `testID`s on key elements and a render test. Snapshot tests are only for small stable components.
  - Run targeted Jest while iterating and the full suite once at the end, per the token rules.

## 3. Security and privacy in UI

- **Secrets:**
  - Never display, log or prefill API keys or tokens. The OpenAI key field is `secureTextEntry`, never echoes its value back (show "Key saved ••••" only), and is stored only in the Keychain through `expo-secure-store`.
  - Never put secrets in AsyncStorage, SQLite, analytics, crash logs or error text.
- **Untrusted content:**
  - Treat imported captions, titles, transcripts and web text as untrusted.
  - Render them as plain `<Text>`. Never inject HTML or use a WebView for them.
  - Strip control characters and cap their length.
- **Links:**
  - Show the destination domain before you open an external URL.
  - Open links with `expo-web-browser` or `Linking` after validating `https:`.
  - Never auto-open links found in imported content.
- **Images:** only load remote images over https. Prefer saving thumbnails locally (local-first) over hot-linking.
- **Permissions:**
  - Request Photos, Microphone and similar permissions only at the moment of use, with a clear pre-prompt that says why.
  - Handle denial gracefully with a path to Settings.
- **Privacy:**
  - Data stays on the device by default (local-first SQLite).
  - Any action that sends data off the device, such as the OpenAI fallback, must be clearly labeled and opt-in.
  - Diagnostic codes contain only allow-listed tokens, never user text or URLs with tokens.
- **Destructive and sensitive actions:** confirm deletes of recipes, plans and households. Never put destructive actions in the accent color.
- **Hard rules:** no crawler UA spoofing, and Instagram never uses audio transcription.
- **Dependencies:** no new UI libraries without a reason in the PR description. Prefer Expo or first-party packages. Pin versions.

## 4. Process for agents

1. Read this file and look at both reference images before you design.
2. Use theme tokens and shared components. If something is missing, add it to the theme or a shared component and don't inline it.
3. Keep PRs small and scoped, one screen or component group at a time, to keep token cost low.
4. Every UI PR includes before and after screenshots (simulator or EAS preview) and confirms the accessibility checklist: labels, 44pt targets, contrast, Dynamic Type and Reduce Motion.
5. Whisk Review checks UI PRs against this file before Brian's device test. Never merge without Brian's go-ahead.

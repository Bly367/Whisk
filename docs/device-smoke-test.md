# Physical iPhone Device Smoke Test Checklist

**Target:** Dev client on physical iPhone (NOT Expo Go)  
**Build:** Main branch @ current commit  
**Tester:** Brian

## Pre-flight
- [ ] Build fresh dev client using `eas build --profile development-device --platform ios`
- [ ] Install on physical iPhone via TestFlight or direct install
- [ ] Confirm device has camera and photo library access capability

---

## 1. First Launch & Initialization
**Critical:** These must work or the app is DOA.

- [ ] **App opens without crash**
  - Splash screen displays
  - No immediate crash to home screen
  - Database initializes (SQLite migration completes)
  
- [ ] **Navigation works**
  - Bottom tabs render (Plan, Shop, Recipes, Add)
  - Can navigate between tabs
  - No frozen UI or navigation failures

- [ ] **Empty state renders**
  - Recipes tab shows "No recipes yet" empty state
  - Plan tab shows empty week view
  - Shop tab shows empty grocery list

**Expected behavior:** Smooth first launch, all tabs accessible, no crashes.

---

## 2. OS Share → Import Path
**Purpose:** Verify share sheet integration and social/website URL handling.

### 2a. Browser → Whisk Share (Website URL)
1. Open Safari on iPhone
2. Navigate to a recipe website (try allrecipes.com or bbcgoodfood.com)
3. Tap Share button
4. Scroll to "Whisk" in share sheet
5. Tap Whisk

**Expected:**
- [ ] Whisk opens to `/import/share` screen
- [ ] URL pre-filled in "Shared link or text" field
- [ ] Tap "Continue" button
- [ ] Website adapter runs, extracts recipe
- [ ] Preview screen shows extracted recipe with confidence indicators
- [ ] Can save to library

**Failure cases to verify:**
- [ ] Invalid URL (not https) → Shows error message with fallbacks
- [ ] Page without recipe → Shows "needs_input" error, offers paste/manual

### 2b. Instagram → Whisk Share (Social URL + Caption)
1. Open Instagram app
2. Find a recipe reel/post (or use test account)
3. Tap Share button → Copy Link
4. Open Whisk manually
5. Go to Add tab → "Share sheet" option
6. Paste Instagram URL in "Shared link or text" field
7. Paste caption text (with ingredients/steps) in "Caption" field
8. Tap "Continue"

**Expected:**
- [ ] Share sheet adapter recognizes Instagram URL
- [ ] If caption has recipe text → Creates low-confidence draft
- [ ] If caption missing → Shows "needs_input" error with clear message about needing caption
- [ ] Preview shows warnings about low confidence
- [ ] Can edit and save

**Hostile URL rejection:**
- [ ] Try pasting `javascript:alert('xss')` → Should reject with error (do NOT execute)
- [ ] Try pasting `file:///etc/passwd` → Should reject with error
- [ ] Try pasting `data:text/html,<script>alert(1)</script>` → Should reject with error

---

## 3. Paste Import Matrix
**Purpose:** Verify text paste path works for various formats.

Go to Add tab → "Paste a link"

### 3a. Website URL Only
- [ ] Paste `https://www.allrecipes.com/recipe/123/` → Imports via website adapter
- [ ] Preview shows extracted recipe

### 3b. Plain Recipe Text
1. Tap "Paste text instead" button
2. Paste multiline recipe text:
   ```
   Simple Pasta
   
   Ingredients:
   1 lb pasta
   2 tbsp olive oil
   3 cloves garlic
   Salt and pepper to taste
   
   Instructions:
   1. Boil pasta according to package
   2. Sauté garlic in oil
   3. Toss pasta with garlic oil
   4. Season and serve
   ```
3. Tap "Import with pasted text"

**Expected:**
- [ ] Creates draft from pasted text
- [ ] Title extracted (should not be "Ingredients" or start with ingredient-like line)
- [ ] Ingredients section parsed
- [ ] Instructions section parsed
- [ ] Shows low-confidence warnings
- [ ] Can edit in preview and save

### 3c. Social URL + Text Caption
- [ ] Paste TikTok/Instagram URL + caption text → Recognizes as social, uses caption text
- [ ] Shows appropriate low-confidence warnings

### 3d. Edge Cases
- [ ] Empty paste → Button disabled, no crash
- [ ] Single word → Rejects with helpful error
- [ ] URL with no recipe content → Shows needs_input error with fallbacks

---

## 4. OCR / Photo Path
**Purpose:** Verify camera/library permissions and OCR module availability.

Go to Add tab → "Scan a photo"

### 4a. Camera Permission Flow
1. Tap "Take photo" button
2. If first time: system permission prompt appears

**Expected:**
- [ ] Permission prompt shows (with our custom message from app.json)
- [ ] If granted → Camera opens
- [ ] If denied → Error message explains permission needed, offers fallbacks
- [ ] No crash on permission denial

### 4b. Take Photo → OCR
1. Grant camera permission
2. Take photo of a printed recipe or recipe card
3. Confirm photo

**Expected:**
- [ ] Photo captures successfully
- [ ] OCR processing starts (loading indicator)
- [ ] Text recognition completes (via expo-mlkit-ocr)
- [ ] Draft created from recognized text
- [ ] Preview shows ingredients/instructions with "low_confidence" warning
- [ ] imageUri preserved in draft
- [ ] Can edit and save

**Failure case:**
- [ ] If OCR module missing → Should show "native_unavailable" error (NOT crash)
- [ ] Error message mentions "dev client rebuild" needed
- [ ] Offers fallback to paste text / manual entry

### 4c. Photo Library Permission Flow
1. Tap "Choose from library" button
2. If first time: system permission prompt appears

**Expected:**
- [ ] Permission prompt shows
- [ ] If granted → Photo picker opens
- [ ] Select photo → OCR processes as above
- [ ] If denied → Error with fallbacks, no crash

### 4d. OCR Edge Cases
- [ ] Empty/blank photo → Error message "No text found", offers retry/paste/manual
- [ ] Photo with non-recipe text → May fail to parse, shows fallback options
- [ ] No crash on any OCR failure path

---

## 5. Import Preview & Save Flow
**Purpose:** Verify required preview before save, edit capability, and persistence.

After any successful import:

### 5a. Preview Screen Mandatory
- [ ] NEVER auto-saves without preview
- [ ] Preview screen shows all extracted fields
- [ ] Confidence indicators visible for low-confidence fields (warning borders)
- [ ] Warnings displayed at top (e.g., "low_confidence", "missing_ingredients")

### 5b. Edit Before Save
- [ ] Can edit title field
- [ ] Can edit ingredients (multiline text)
- [ ] Can edit instructions (multiline text)
- [ ] Can edit servings number
- [ ] Can edit notes
- [ ] Changes persist in preview UI

### 5c. Save to Library
1. Make any edits desired
2. Tap "Save recipe" button

**Expected:**
- [ ] Shows loading state
- [ ] Recipe saved to local SQLite
- [ ] Success message appears
- [ ] "Done" button navigates to Recipes tab
- [ ] New recipe appears in Recipes library

### 5d. Save Validation
- [ ] Empty title → Error "Add a recipe title before saving"
- [ ] Empty ingredients AND instructions → Error "Add ingredients or steps"
- [ ] Never writes to database on validation failure

---

## 6. Cross-Feature Integration
**Purpose:** Verify imports integrate with rest of app.

### 6a. Recipe Library
- [ ] Imported recipes appear in Recipes tab
- [ ] Can tap to view full recipe detail
- [ ] Recipe detail shows all imported fields correctly

### 6b. Data Persistence
1. Force quit app (swipe up from app switcher)
2. Reopen app

**Expected:**
- [ ] All imported recipes still present
- [ ] No data loss
- [ ] Database migrations stable

---

## 7. Error Handling & Edge Cases

### 7a. Network Failures
- [ ] Turn on Airplane Mode
- [ ] Try to import website URL → Shows network error with fallbacks
- [ ] App remains usable
- [ ] Paste/OCR/manual paths still work offline

### 7b. Malformed Input
- [ ] Very long URL (>1000 chars) → Handles gracefully
- [ ] Special characters in text → No crash
- [ ] Unicode/emoji in recipe text → Displays correctly

### 7c. Permission Edge Cases
- [ ] Deny camera permission → Recovers with error + fallbacks
- [ ] Deny photo library permission → Recovers with error + fallbacks
- [ ] Revoke permissions mid-session → Next attempt shows permission prompt again

---

## 8. Security Validation
**Critical for production readiness.**

### 8a. Hostile URL Schemes (Manual Tests)
In Add → Share sheet or Paste a link, try these:

- [ ] `javascript:alert('xss')` → MUST reject with error, NEVER execute
- [ ] `file:///etc/passwd` → MUST reject with error
- [ ] `data:text/html,<script>alert(1)</script>` → MUST reject with error
- [ ] `vbscript:msgbox('xss')` → MUST reject with error
- [ ] `JaVaScRiPt:alert(1)` (mixed case) → MUST reject (case-insensitive check)

All rejections should show user-friendly error like "That shared link does not look like a public URL."

### 8b. HTTPS Only
- [ ] `http://example.com/recipe` → Should reject (http: not allowed per SECURITY.md)
- [ ] `https://example.com/recipe` → Should accept

---

## 9. Performance & Stability

### 9a. Responsiveness
- [ ] Import operations show loading indicators
- [ ] UI never freezes for >2 seconds
- [ ] Can navigate away during import (if cancel supported)

### 9b. Memory
- [ ] Import 5+ recipes in sequence → No memory warnings
- [ ] App doesn't slow down after multiple imports

---

## Critical Failure Thresholds

**Block release if ANY of these fail:**

1. ❌ App crashes on first launch
2. ❌ OS share sheet doesn't appear or doesn't pass data to Whisk
3. ❌ Hostile URL schemes (javascript:, file:, data:) execute or crash app
4. ❌ Camera/library permissions cause crash instead of graceful error
5. ❌ OCR module missing causes crash instead of "native_unavailable" error
6. ❌ Save recipe writes to database without showing preview
7. ❌ Imported recipes don't persist after app restart

**Should-fix before production:**

1. ⚠️ Website import fails for major recipe sites (allrecipes, bbc, etc.)
2. ⚠️ Social caption parsing produces nonsensical results
3. ⚠️ OCR on clear recipe photos produces empty draft
4. ⚠️ Error messages unhelpful or scary ("NativeModule not found")
5. ⚠️ Preview editing loses data on text change

---

## Test Result Template

```
# Smoke Test Results
**Date:** ___________
**Device:** iPhone ___ (iOS ___)
**Build:** eas development-device, commit ___________
**Tester:** Brian

## Summary
- [ ] All critical paths pass
- [ ] Blockers found: _______
- [ ] Should-fix issues: _______
- [ ] Nice-to-have improvements: _______

## Detailed Results
[Paste checklist results above]

## Issues Found
1. [Severity: BLOCKER/SHOULD-FIX/NIT] Description...
2. ...

## Notes
- ...
```

---

## Next Steps After Smoke Test

If all critical paths pass:
1. ✅ Ready for internal dogfooding
2. ✅ Can proceed with TestFlight beta
3. ✅ Document any should-fix items as GitHub issues for next sprint

If blockers found:
1. 🚫 Do NOT distribute to beta testers
2. 🚫 File blocker issues
3. 🚫 Fix on main or hotfix branch
4. 🚫 Re-run full smoke test after fixes

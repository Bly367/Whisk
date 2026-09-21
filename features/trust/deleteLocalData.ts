/**
 * Local data deletion for App Store / Play compliance.
 * Honest on-device wipe while guest (no cloud account yet).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DbClient } from '@/data/client';
import { useSessionStore } from '@/features/trust/sessionStore';

/**
 * Delete all local SQLite data (recipes, plans, grocery, pantry, etc.) and
 * reset session to fresh guest state. Suitable for "delete account / data"
 * flows required by App Store / Play Store while in guest mode.
 * 
 * Does NOT touch cloud data (no cloud account exists in guest mode yet).
 * When cloud sync exists, extend this to coordinate remote deletion.
 */
export async function deleteAllLocalData(db: DbClient): Promise<void> {
  // Clear all domain tables in correct order (respecting foreign keys)
  db.withTransaction(() => {
    // Child tables first (foreign key constraints)
    db.exec('DELETE FROM recipe_tags');
    db.exec('DELETE FROM ingredients');
    db.exec('DELETE FROM collection_recipes');
    db.exec('DELETE FROM meal_plan_entries');
    db.exec('DELETE FROM meal_plan_template_entries');
    db.exec('DELETE FROM grocery_items');
    db.exec('DELETE FROM household_members');
    db.exec('DELETE FROM leftovers_links');
    db.exec('DELETE FROM compat_import_jobs');
    db.exec('DELETE FROM compat_export_packs');
    
    // Parent tables
    db.exec('DELETE FROM recipes');
    db.exec('DELETE FROM tags');
    db.exec('DELETE FROM collections');
    db.exec('DELETE FROM meal_plans');
    db.exec('DELETE FROM meal_plan_templates');
    db.exec('DELETE FROM grocery_lists');
    db.exec('DELETE FROM pantry_items');
    db.exec('DELETE FROM households');
  });

  // Clear session state and reset to fresh guest
  await AsyncStorage.clear();
  
  // Reset session store to fresh guest state
  useSessionStore.setState({
    mode: 'guest',
    hydrated: true,
    usage: {
      importsUsedThisWeek: 0,
      weekStartIso: new Date().toISOString().split('T')[0],
      isDowngraded: false,
    },
    entitlement: 'free',
    unlockPricing: {
      priceCents: 499,
      priceLabel: '$4.99',
      isDiscounted: false,
      influencerCode: null,
      influencerId: null,
    },
  });
}

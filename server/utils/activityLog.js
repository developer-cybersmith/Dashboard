/**
 * Persist an activity entry to MongoDB when connected.
 * No-op (and never throws) when using JSON-file storage.
 */

import { isMongoActive } from '../config/db.js';
import { Activity } from '../models/Activity.js';

/**
 * @param {{
 *   message: string,
 *   type?: string,
 *   who?: string,
 *   action?: string,
 *   entity?: string,
 *   entityName?: string,
 *   changes?: { field: string, from: string, to: string }[],
 * }} payload
 */
export async function recordActivity(payload) {
  if (!isMongoActive()) return null;
  try {
    const {
      message,
      type = 'project',
      who = 'System',
      action = 'updated',
      entity = '',
      entityName = '',
      changes = [],
    } = payload ?? {};
    if (!message) return null;
    return await Activity.create({
      message,
      type,
      who,
      action,
      entity,
      entityName,
      changes,
    });
  } catch (err) {
    console.error('[Activity] failed to record:', err.message);
    return null;
  }
}

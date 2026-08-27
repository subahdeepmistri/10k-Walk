import { validateSettings, validateWalk } from './documentSchema.js';
import { toQuarantineValue } from './serialization.js';

function legacyIdToStableId(id, index = 0) {
  return `legacy-${id === undefined ? `missing-${index}` : String(id)}`;
}

/**
 * Reads the current Dexie database without importing Dexie into feature code.
 * The adapter is optional: a missing IndexedDB/Dexie database is a normal case.
 */
export async function readLegacyIndexedDb({ database, idFactory = legacyIdToStableId } = {}) {
  if (!database?.walks || !database?.settings) {
    return { walks: [], settings: {}, quarantine: [], available: false };
  }

  const [rawWalks, rawSettings] = await Promise.all([
    database.walks.toArray(),
    database.settings.toArray(),
  ]);
  const quarantine = [];
  const walks = [];
  const seen = new Set();

  for (let index = 0; index < rawWalks.length; index += 1) {
    const raw = rawWalks[index];
    const id = idFactory(raw?.id, index);
    const result = validateWalk({ ...raw, id });
    if (!result.value || seen.has(result.value?.id)) {
      quarantine.push({ original: toQuarantineValue(raw), reason: result.fatal.join('; ') || 'duplicate legacy ID', source: 'indexeddb', detectedAt: Date.now() });
      continue;
    }
    seen.add(result.value.id);
    walks.push(result.value);
    if (result.warnings.length || result.unknown.length) {
      quarantine.push({
        original: toQuarantineValue(raw),
        reason: [...result.warnings, ...result.unknown.map(({ key }) => `unrecognized field: ${key}`)].join('; '),
        source: 'indexeddb-repair',
        detectedAt: Date.now(),
      });
    }
    for (const repair of result.repairs) {
      quarantine.push({
        original: repair.original,
        reason: repair.reason,
        source: 'indexeddb-repair',
        detectedAt: Date.now(),
        walkId: result.value.id,
        index: repair.index,
        kind: repair.kind,
      });
    }
  }

  const settings = {};
  for (const entry of rawSettings) {
    if (!entry || typeof entry.key !== 'string') {
      quarantine.push({ original: toQuarantineValue(entry), reason: 'invalid legacy setting entry', source: 'indexeddb', detectedAt: Date.now() });
      continue;
    }
    settings[entry.key] = entry.value;
  }
  const settingsResult = validateSettings(settings);
  if (settingsResult.issues.length) {
    quarantine.push({ original: toQuarantineValue(settings), reason: settingsResult.issues.join('; '), source: 'indexeddb', detectedAt: Date.now() });
  }

  return {
    walks,
    settings: settingsResult.value,
    quarantine,
    available: true,
  };
}

export function mergeLegacyData(document, legacy, now = Date.now()) {
  const walkIds = new Set(document.walks.map((walk) => walk.id));
  const walks = [...document.walks];
  for (const walk of legacy.walks || []) {
    if (!walkIds.has(walk.id)) {
      walkIds.add(walk.id);
      walks.push(walk);
    }
  }
  const useLegacySettings = document.revision === 0 && document.walks.length === 0;
  return {
    ...document,
    settings: useLegacySettings
      ? { ...document.settings, ...(legacy.settings || {}) }
      : document.settings,
    walks,
    quarantine: [...document.quarantine, ...(legacy.quarantine || [])],
    updatedAt: now,
    migration: {
      ...document.migration,
      legacyIndexedDbImported: true,
      legacyImportedAt: now,
    },
  };
}

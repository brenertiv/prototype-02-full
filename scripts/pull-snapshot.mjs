// Build-time snapshot pull (skills/kilowatt-prototype-testing/test-config.md › Snapshot pull, JNY-DATA-13).
// No KILOWATT_SNAPSHOT_VERSION: writes nothing and the app runs on its synthetic fixtures.
// Version set: fetches the masked snapshot with the bearer token, writes src/.snapshot/, and fails
// the build if the fetch fails, so a pinned build never falls back to synthetic data.
// Never prints the token or the data.
import { mkdir, writeFile } from 'node:fs/promises';

const version = process.env.KILOWATT_SNAPSHOT_VERSION;
if (!version) {
  console.log('[snapshot] No KILOWATT_SNAPSHOT_VERSION set; using synthetic data.');
  process.exit(0);
}
const base = process.env.KILOWATT_SNAPSHOT_URL;
const token = process.env.KILOWATT_SNAPSHOT_TOKEN;
if (!base || !token) {
  console.error('[snapshot] KILOWATT_SNAPSHOT_URL and KILOWATT_SNAPSHOT_TOKEN are required when a version is pinned.');
  process.exit(1);
}
try {
  const res = await fetch(`${base.replace(/\/$/, '')}/${encodeURIComponent(version)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  JSON.parse(body); // must be valid JSON
  await mkdir(new URL('../src/.snapshot/', import.meta.url), { recursive: true });
  await writeFile(new URL('../src/.snapshot/snapshot.json', import.meta.url), body);
  await writeFile(new URL('../src/.snapshot/version.json', import.meta.url), JSON.stringify({ version }));
  console.log(`[snapshot] Pulled snapshot ${version}.`);
} catch (err) {
  console.error(`[snapshot] Pull failed for version ${version}: ${err instanceof Error ? err.message : 'unknown error'}`);
  process.exit(1);
}

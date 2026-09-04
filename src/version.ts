import packageInfo from '../package.json';

/**
 * Single source of truth for the version strings this service reports.
 * `VERSION` is the package version (surfaced by /health, /api/metrics,
 * /api/v1/node/info and the OpenAPI document); `PROTOCOL_VERSION` is the LOOP
 * specification baseline this node implements.
 */
export const VERSION: string = packageInfo.version;
export const PROTOCOL_VERSION = '0.2.0';

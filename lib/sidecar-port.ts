/**
 * Single source of truth for the sidecar port.
 * Used by the API interceptor (client) and sidecar servers (server).
 *
 * The Tauri backend (Rust) has its own constant in src-tauri/src/lib.rs
 * since it cannot import from TypeScript.
 */
export const SIDECAR_DEFAULT_PORT = 14321;

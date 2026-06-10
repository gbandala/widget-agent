// Compatibility shim — re-exports db as createServiceClient so existing
// import sites can migrate file-by-file without a big-bang rename.
// NOTE: createServiceClient is now synchronous (no await needed).
export { db as createServiceClient } from '@/lib/db'

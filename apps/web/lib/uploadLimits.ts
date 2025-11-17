export const UPLOAD_MAX_FILE_MB = 30;
export const UPLOAD_MAX_FILE_BYTES = UPLOAD_MAX_FILE_MB * 1024 * 1024;

export function formatBytesInMB(bytes: number, fractionDigits = 1): string {
  return (bytes / (1024 * 1024)).toFixed(fractionDigits);
}

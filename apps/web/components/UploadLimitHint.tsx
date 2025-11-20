import React from "react";

import { UPLOAD_MAX_FILE_MB } from "../lib/uploadLimits";

export const UPLOAD_LIMIT_HINT_TEXT = `Max file size: ${UPLOAD_MAX_FILE_MB}MB per file (larger uploads coming soon).`;

export function UploadLimitHint() {
  return <p className="mt-2 text-xs text-base-content/60">{UPLOAD_LIMIT_HINT_TEXT}</p>;
}

export default UploadLimitHint;

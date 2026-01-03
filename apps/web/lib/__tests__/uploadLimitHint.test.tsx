import React from "react";
import { renderToString } from "react-dom/server";

import UploadLimitHint, { UPLOAD_LIMIT_HINT_TEXT } from "../../components/UploadLimitHint";
import { UPLOAD_MAX_FILE_MB } from "../../lib/uploadLimits";

if (!UPLOAD_LIMIT_HINT_TEXT.includes(`Max file size: ${UPLOAD_MAX_FILE_MB}MB per file`)) {
  throw new Error("Upload limit hint text mismatch");
}

if (UPLOAD_MAX_FILE_MB !== 32) {
  throw new Error("UPLOAD_MAX_FILE_MB should be 32MB");
}

const hintHtml = renderToString(<UploadLimitHint />);
if (!hintHtml.includes("32MB")) {
  throw new Error("Rendered hint should mention 32MB");
}

console.log("✅ upload limit hint renders with correct text");

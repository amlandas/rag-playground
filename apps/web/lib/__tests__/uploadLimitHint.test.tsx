import React from "react";
import { renderToString } from "react-dom/server";

import UploadLimitHint, { UPLOAD_LIMIT_HINT_TEXT } from "../../components/UploadLimitHint";
import { UPLOAD_MAX_FILE_MB } from "../../lib/uploadLimits";

if (!UPLOAD_LIMIT_HINT_TEXT.includes(`Max file size: ${UPLOAD_MAX_FILE_MB}MB per file`)) {
  throw new Error("Upload limit hint text mismatch");
}

if (UPLOAD_MAX_FILE_MB !== 100) {
  throw new Error("UPLOAD_MAX_FILE_MB should be 100MB");
}

const hintHtml = renderToString(<UploadLimitHint />);
if (!hintHtml.includes("100MB")) {
  throw new Error("Rendered hint should mention 100MB");
}

console.log("✅ upload limit hint renders with correct text");

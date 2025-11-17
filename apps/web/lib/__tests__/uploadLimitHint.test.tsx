import { UPLOAD_LIMIT_HINT_TEXT } from "../../components/UploadLimitHint";
import { UPLOAD_MAX_FILE_MB } from "../../lib/uploadLimits";

if (!UPLOAD_LIMIT_HINT_TEXT.includes(`Max file size: ${UPLOAD_MAX_FILE_MB}MB per file`)) {
  throw new Error("Upload limit hint text mismatch");
}

console.log("✅ upload limit hint renders with correct text");

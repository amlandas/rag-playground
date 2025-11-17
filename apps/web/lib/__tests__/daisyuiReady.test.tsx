import React from "react";
import { renderToString } from "react-dom/server";

import DaisyUiSample from "../../components/DaisyUiSample";

const html = renderToString(<DaisyUiSample />);
if (!html.includes("btn btn-primary")) {
  throw new Error("DaisyUI classes not found in rendered output");
}

console.log("✅ DaisyUI sample renders with btn classes");

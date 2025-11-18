import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import SiteNavbar from "../../components/SiteNavbar";

const html = renderToString(<SiteNavbar />);

assert(
  html.includes('data-testid="theme-switcher"'),
  "navbar should render the theme switcher control",
);

console.log("✅ Navbar renders theme switcher");

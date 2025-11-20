import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import ProfileAnswerCard from "../../components/ProfileAnswerCard";

const html = renderToString(
  <ProfileAnswerCard
    label="Answer — Profile A"
    answer="Our vacation policy grants 15 days."
    isComplete={true}
    sources={[{ rank: 1, doc_id: "doc1", start: 0, end: 10, text: "Vacation policy grants 15 days." }]}
    onCopy={() => {}}
    onDownload={() => {}}
  />,
);

assert(html.includes("15 days"), "Profile answer card should render provided answer text");

console.log("✅ Profile answer card renders provided answers");

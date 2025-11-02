import { z } from 'zod';
import summaryDefinition from '../schemas/playground-summary.json';

export const highlightSchema = z.object({
  title: z.string(),
  description: z.string()
});

export const playgroundSummarySchema = z.object({
  title: z.string(),
  tagline: z.string(),
  highlights: z.array(highlightSchema)
});

export type Highlight = z.infer<typeof highlightSchema>;
export type PlaygroundSummary = z.infer<typeof playgroundSummarySchema>;

export const staticPlaygroundSummary = playgroundSummarySchema.parse(summaryDefinition);

export const playgroundSummary = () => staticPlaygroundSummary;

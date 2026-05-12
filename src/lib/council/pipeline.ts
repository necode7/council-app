/**
 * Council Deliberation Pipeline
 *
 * Orchestrates the full multi-model advisory pipeline:
 *   1. generateTopicSlug  — short topic label from the question
 *   2. runAdvisors         — 5 advisors respond in parallel
 *   3. anonymize           — shuffle + map to letters A-E
 *   4. runPeerReview       — each advisor reviews all 5 anonymized responses
 *   5. runChairman         — chairman produces structured verdict
 *   6. runCouncil          — full pipeline orchestration with progress callbacks
 */

import { callModel, MODEL_CONFIG } from '@/lib/ai/openrouter';
import {
  type AdvisorPersona,
  DEFAULT_ADVISOR_PANEL,
  ADVISOR_SUFFIX,
  PEER_REVIEW_SYSTEM,
  PEER_REVIEW_USER,
  CHAIRMAN_SYSTEM,
  CHAIRMAN_USER,
  SLUGGER_SYSTEM,
  SLUGGER_USER,
  inject,
} from '@/lib/council/prompts';

// ============================================================
// Types
// ============================================================

export interface AdvisorPanel {
  name: string;
  system_prompt: string;
  role_description?: string;
}

export interface AnonymizeResult {
  letterToResponse: Record<string, string>;
  letterToName: Record<string, string>;
}

export interface CouncilResult {
  slug: string;
  question: string;
  advisorResponses: Record<string, string>;
  letterMap: Record<string, string>;
  reviews: Record<string, string>;
  verdict: string;
}

export type PipelineStage = 'slug' | 'advisors' | 'review' | 'chairman' | 'complete' | 'error';

// ============================================================
// 1. Generate Topic Slug
// ============================================================

/**
 * Calls the slugger model to generate a short topic label from the question.
 * Returns a sanitized underscore-joined string (e.g. "ML_Battery_Calculation").
 */
export async function generateTopicSlug(question: string): Promise<string> {
  const raw = await callModel({
    model: MODEL_CONFIG.slugger,
    system: SLUGGER_SYSTEM,
    user: inject(SLUGGER_USER, { question }),
    temperature: 0.3,
    maxTokens: 64,
    label: 'slugger',
  });

  // Sanitize: keep only word characters and underscores
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

// ============================================================
// 2. Run Advisors (Parallel)
// ============================================================

/**
 * Runs all advisors IN PARALLEL. Each advisor gets their system prompt
 * (from advisorPanel config or defaults) plus the shared suffix.
 *
 * If one advisor fails, the others still return — the failed one gets an
 * [ERROR ...] string as its response.
 */
export async function runAdvisors(
  question: string,
  advisorPanel: AdvisorPanel[] | null,
): Promise<Record<string, string>> {
  // Use provided panel or fall back to defaults
  const panel: AdvisorPersona[] = resolveAdvisorPanel(advisorPanel);

  // Each advisor gets a different model from the advisors array
  const results = await Promise.allSettled(
    panel.map(async (advisor, i) => {
      const model = MODEL_CONFIG.advisors[i % MODEL_CONFIG.advisors.length];
      const response = await callModel({
        model,
        system: advisor.systemPrompt + ADVISOR_SUFFIX,
        user: question,
        temperature: 0.7,
        maxTokens: 2048,
        label: `${advisor.name} (${model.split('/')[1]})`,
      });
      return { name: advisor.name, response };
    }),
  );

  const advisorResponses: Record<string, string> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      advisorResponses[result.value.name] = result.value.response;
    } else {
      // Extract advisor name from the error context — still include them with an error marker
      const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[runAdvisors] advisor failed: ${errorMsg}`);
    }
  }
  return advisorResponses;
}

// ============================================================
// 3. Anonymize
// ============================================================

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * Shuffles advisor names randomly and maps them to letters A-E.
 * Returns the mapping so we can de-anonymize later for the chairman.
 */
export function anonymize(
  advisorResponses: Record<string, string>,
): AnonymizeResult {
  const names = Object.keys(advisorResponses);
  const shuffled = [...names].sort(() => Math.random() - 0.5);

  const letterToResponse: Record<string, string> = {};
  const letterToName: Record<string, string> = {};

  for (let i = 0; i < shuffled.length; i++) {
    const letter = LETTERS[i] ?? String.fromCharCode(65 + i);
    const name = shuffled[i];
    letterToResponse[letter] = advisorResponses[name];
    letterToName[letter] = name;
  }

  return { letterToResponse, letterToName };
}

// ============================================================
// 4. Run Peer Review (Parallel)
// ============================================================

/**
 * Each advisor reviews all 5 anonymized responses. Runs in PARALLEL.
 *
 * Each reviewer answers:
 *   1. Strongest response and why
 *   2. Biggest blind spot
 *   3. What all five missed
 */
export async function runPeerReview(
  advisorNames: string[],
  anonymized: AnonymizeResult,
  question: string,
): Promise<Record<string, string>> {
  // Build the anonymized response block
  const anonBlock = Object.entries(anonymized.letterToResponse)
    .map(([letter, response]) => `--- Response ${letter} ---\n${response}`)
    .join('\n\n');

  const userPrompt = inject(PEER_REVIEW_USER, { question, anon_block: anonBlock });

  // Each reviewer uses the same model their advisor used (genuine multi-model review)
  const results = await Promise.allSettled(
    advisorNames.map(async (name, i) => {
      const model = MODEL_CONFIG.advisors[i % MODEL_CONFIG.advisors.length];
      const review = await callModel({
        model,
        system: PEER_REVIEW_SYSTEM,
        user: userPrompt,
        temperature: 0.5,
        maxTokens: 1024,
        label: `review-${name} (${model.split('/')[1]})`,
      });
      return { name, review };
    }),
  );

  const reviews: Record<string, string> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      reviews[result.value.name] = result.value.review;
    } else {
      const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[runPeerReview] review failed: ${errorMsg}`);
    }
  }
  return reviews;
}

// ============================================================
// 5. Run Chairman
// ============================================================

/**
 * The chairman receives de-anonymized advisor responses + all peer reviews.
 * Produces a structured verdict with 5 sections.
 */
export async function runChairman(
  question: string,
  advisorResponses: Record<string, string>,
  reviews: Record<string, string>,
  chairmanPromptOverride?: string,
): Promise<string> {
  // Build advisor response block (de-anonymized for chairman)
  const advisorBlock = Object.entries(advisorResponses)
    .map(([name, response]) => `--- ${name} ---\n${response}`)
    .join('\n\n');

  // Build review block
  const reviewBlock = Object.entries(reviews)
    .map(([name, review]) => `--- Review by ${name} ---\n${review}`)
    .join('\n\n');

  const sysPrompt = chairmanPromptOverride ?? CHAIRMAN_SYSTEM;
  const usrPrompt = inject(CHAIRMAN_USER, {
    question,
    advisor_block: advisorBlock,
    review_block: reviewBlock,
  });

  return callModel({
    model: MODEL_CONFIG.chairman,
    system: sysPrompt,
    user: usrPrompt,
    temperature: 0.4,
    maxTokens: 4096,
    label: 'chairman',
  });
}

// ============================================================
// 6. Run Council (Full Pipeline Orchestration)
// ============================================================

export interface CouncilTemplate {
  advisor_panel?: AdvisorPanel[] | null;
  chairman_prompt?: string | null;
}

/**
 * Orchestrates the full council deliberation pipeline.
 *
 * @param question      - The user's question / decision
 * @param template      - Optional template with custom advisor_panel and chairman_prompt
 * @param onProgress    - Callback fired at each pipeline stage
 * @returns             - The complete CouncilResult
 */
export async function runCouncil(
  question: string,
  template: CouncilTemplate | null,
  onProgress?: (stage: PipelineStage) => void,
): Promise<CouncilResult> {
  try {
    // --- Stage 1: Generate topic slug ---
    onProgress?.('slug');
    const slug = await generateTopicSlug(question);

    // --- Stage 2: Run advisors in parallel ---
    onProgress?.('advisors');
    const advisorPanel = template?.advisor_panel ?? null;
    const advisorResponses = await runAdvisors(question, advisorPanel);

    // --- Stage 3: Anonymize + Peer Review ---
    onProgress?.('review');
    const anonymized = anonymize(advisorResponses);
    const advisorNames = Object.keys(advisorResponses);
    const reviews = await runPeerReview(advisorNames, anonymized, question);

    // --- Stage 4: Chairman verdict ---
    onProgress?.('chairman');
    const chairmanPrompt = template?.chairman_prompt ?? undefined;
    const verdict = await runChairman(question, advisorResponses, reviews, chairmanPrompt);

    onProgress?.('complete');

    return {
      slug,
      question,
      advisorResponses,
      letterMap: anonymized.letterToName,
      reviews,
      verdict,
    };
  } catch (error) {
    onProgress?.('error');
    throw error;
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Converts an advisor_panel from the template's JSONB format
 * into the internal AdvisorPersona format. Falls back to the
 * default general-purpose panel if null/empty.
 */
function resolveAdvisorPanel(
  panel: AdvisorPanel[] | null | undefined,
): AdvisorPersona[] {
  if (!panel || panel.length === 0) {
    return DEFAULT_ADVISOR_PANEL;
  }

  return panel.map((advisor) => ({
    name: advisor.name,
    systemPrompt: advisor.system_prompt,
  }));
}

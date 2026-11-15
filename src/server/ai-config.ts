import "server-only";

/** Model for AI features. Override with AI_MODEL in .env.local (e.g. a cheaper model for simple parsing). */
export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";

/** True when the server has credentials for the Claude API. The key never reaches the browser. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Server-side refusal fallback is available on these model families (not on Haiku). */
export function supportsServerFallback(model: string): boolean {
  return /^claude-(opus-5|fable-5|mythos-5|sonnet-5-5)/.test(model);
}

/**
 * Agentic Loop for Spotify Natural Language Processing
 *
 * Implements multi-step query execution with LLM-powered planning,
 * execution, verification, and retry logic.
 */

import { interpretQuery, Intent, OpenRouterEnv } from './interpreter';
import { executeIntent, ExecutionResult } from '../utils/mapper';
import { SpotifyClient } from '../spotify/client';

export interface AgentConfig {
  maxIterations: number; // Maximum loop iterations (default: 3)
  enableRetry: boolean; // Enable retry on failures (default: true)
  enableContext: boolean; // Enable conversation context (default: true)
}

export interface AgentResult {
  success: boolean;
  message: string;
  iterations: number;
  intents: Intent[];
  executionResults: ExecutionResult[];
}

interface AgentStep {
  stepNumber: number;
  intent: Intent;
  execution: ExecutionResult;
  shouldRetry: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 3,
  enableRetry: true,
  enableContext: true,
};

/**
 * Execute agentic loop for natural language query
 *
 * Flow:
 * 1. Parse query into intent using LLM
 * 2. Execute intent via Spotify API
 * 3. If failure, analyze and decide whether to retry
 * 4. Repeat until success or max iterations reached
 *
 * @param query - User's natural language query
 * @param spotifyClient - Authenticated Spotify client
 * @param env - OpenRouter environment
 * @param config - Agent configuration
 * @returns Agent execution result
 */
export async function executeAgenticQuery(
  query: string,
  spotifyClient: SpotifyClient,
  env: OpenRouterEnv,
  config: Partial<AgentConfig> = {}
): Promise<AgentResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const steps: AgentStep[] = [];
  let currentQuery = query;
  let iteration = 0;

  console.log('[Agent] Starting agentic loop for query:', query);

  while (iteration < finalConfig.maxIterations) {
    iteration++;
    console.log(`[Agent] Iteration ${iteration}/${finalConfig.maxIterations}`);

    try {
      // Step 1: Parse intent using LLM
      const intent = await interpretQuery(currentQuery, env);
      console.log('[Agent] Parsed intent:', intent);

      // Check if LLM failed to understand
      if (intent.intent === 'unknown') {
        console.log('[Agent] Intent unknown, stopping loop');
        return {
          success: false,
          message: buildUnknownIntentMessage(query),
          iterations: iteration,
          intents: [intent],
          executionResults: [],
        };
      }

      // Step 2: Execute intent via Spotify API
      const executionResult = await executeIntent(intent, spotifyClient);
      console.log('[Agent] Execution result:', executionResult);

      // Step 3: Record step
      const step: AgentStep = {
        stepNumber: iteration,
        intent,
        execution: executionResult,
        shouldRetry: false,
      };
      steps.push(step);

      // Step 4: Check if successful
      if (executionResult.success) {
        console.log('[Agent] Success! Stopping loop');
        return {
          success: true,
          message: executionResult.message,
          iterations: iteration,
          intents: steps.map((s) => s.intent),
          executionResults: steps.map((s) => s.execution),
        };
      }

      // Step 5: Decide whether to retry
      if (!finalConfig.enableRetry || iteration >= finalConfig.maxIterations) {
        console.log('[Agent] No retry or max iterations reached');
        return {
          success: false,
          message: executionResult.message,
          iterations: iteration,
          intents: steps.map((s) => s.intent),
          executionResults: steps.map((s) => s.execution),
        };
      }

      // Step 6: Analyze failure and prepare retry
      const shouldRetry = analyzeFailureAndRetry(step);
      step.shouldRetry = shouldRetry;

      if (!shouldRetry) {
        console.log('[Agent] Failure not retryable, stopping loop');
        return {
          success: false,
          message: executionResult.message,
          iterations: iteration,
          intents: steps.map((s) => s.intent),
          executionResults: steps.map((s) => s.execution),
        };
      }

      // Step 7: Prepare modified query for retry (future enhancement: use LLM to refine query)
      console.log('[Agent] Retrying with original query');
      // currentQuery remains the same for now
      // TODO: In future, use LLM to refine query based on error
    } catch (error) {
      console.error('[Agent] Error in iteration:', error);

      // If it's a moderation error, surface it clearly
      if (error instanceof Error && error.message.includes('403')) {
        return {
          success: false,
          message: buildModerationErrorMessage(error),
          iterations: iteration,
          intents: steps.map((s) => s.intent),
          executionResults: steps.map((s) => s.execution),
        };
      }

      return {
        success: false,
        message: `❌ Error processing your request: ${error instanceof Error ? error.message : String(error)}`,
        iterations: iteration,
        intents: steps.map((s) => s.intent),
        executionResults: steps.map((s) => s.execution),
      };
    }
  }

  // Max iterations reached
  console.log('[Agent] Max iterations reached');
  return {
    success: false,
    message: buildMaxIterationsMessage(steps),
    iterations: iteration,
    intents: steps.map((s) => s.intent),
    executionResults: steps.map((s) => s.execution),
  };
}

/**
 * Analyze failure and decide if retry is worthwhile
 * @returns true if should retry, false otherwise
 */
function analyzeFailureAndRetry(step: AgentStep): boolean {
  const { execution } = step;

  // Don't retry if no error message
  if (!execution.error) {
    return false;
  }

  // Retry on specific Spotify API errors
  const retryableErrors = [
    'No active device', // Device not found
    'Restricted device', // Device restriction
    'Rate limit', // Rate limiting
    'timeout', // Network timeout
  ];

  const errorLower = execution.error.toLowerCase();
  const isRetryable = retryableErrors.some((err) => errorLower.includes(err.toLowerCase()));

  console.log('[Agent] Error retryable?', isRetryable, 'Error:', execution.error);
  return isRetryable;
}

/**
 * Build user-friendly message for unknown intent
 */
function buildUnknownIntentMessage(query: string): string {
  return `❌ I couldn't understand "${query}". Try using a direct command like:
• \`/play\` - Resume playback
• \`/pause\` - Pause playback
• \`/next\` or \`/previous\` - Skip tracks
• \`/nowplaying\` - See what's playing

Or try rephrasing your request more clearly.`;
}

/**
 * Build user-friendly message for moderation errors
 */
function buildModerationErrorMessage(error: Error): string {
  return `❌ Unable to process your request due to content filtering.

This is a temporary issue with the AI service. Please try:
• Using a direct command like \`/play\`, \`/pause\`, or \`/next\`
• Rephrasing your request more simply
• Trying again in a moment

Error details: ${error.message}`;
}

/**
 * Build user-friendly message for max iterations
 */
function buildMaxIterationsMessage(steps: AgentStep[]): string {
  const lastResult = steps[steps.length - 1]?.execution;

  if (lastResult) {
    return `${lastResult.message}

I tried ${steps.length} times but couldn't complete your request. Please try using a direct command or rephrase your query.`;
  }

  return `❌ I couldn't complete your request after multiple attempts. Please try using a direct command like \`/play\`, \`/pause\`, or \`/next\`.`;
}

/**
 * Simple query execution without agentic loop (fallback)
 * @param query - User's natural language query
 * @param spotifyClient - Authenticated Spotify client
 * @param env - OpenRouter environment
 * @returns Execution result
 */
export async function executeSimpleQuery(
  query: string,
  spotifyClient: SpotifyClient,
  env: OpenRouterEnv
): Promise<ExecutionResult> {
  try {
    console.log('[Agent] Simple query execution for:', query);

    // Parse intent
    const intent = await interpretQuery(query, env);
    console.log('[Agent] Parsed intent:', intent);

    // Execute intent
    const result = await executeIntent(intent, spotifyClient);
    console.log('[Agent] Execution result:', result);

    return result;
  } catch (error) {
    console.error('[Agent] Simple query error:', error);

    // Surface moderation errors clearly
    if (error instanceof Error && error.message.includes('403')) {
      return {
        success: false,
        message: buildModerationErrorMessage(error),
        error: error.message,
      };
    }

    return {
      success: false,
      message: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

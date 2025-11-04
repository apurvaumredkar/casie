/**
 * Short-Term Memory (STM) System for CASIE
 *
 * Provides conversational continuity by storing recent context in Cloudflare KV.
 * Memory expires after ~2 hours and includes:
 * - Recent conversation turns (last 5-10 messages)
 * - Extracted facts (user's name, preferences, etc.)
 * - Compact summary of the conversation
 */

// ========== TYPES ==========

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface STMEntry {
  // Recent conversation history (rolling window)
  messages: Message[];

  // Extracted facts from conversation
  facts: {
    userName?: string;
    [key: string]: any;
  };

  // Compact summary of conversation so far
  summary: string;

  // Metadata
  created: number;
  updated: number;
}

// ========== CONSTANTS ==========

export const STM_TTL_SECONDS = 7200; // 2 hours
export const MAX_MESSAGES = 10; // Keep last 10 messages
export const SUMMARIZE_THRESHOLD = 6; // Summarize when we have 6+ messages

// ========== KEY GENERATION ==========

/**
 * Generate a unique KV key for STM storage.
 * Format: stm:{user_id}:{channel_id}
 *
 * Note: We use user_id + channel_id to scope memory per-user per-channel.
 * Guild is not included since DMs don't have guilds, and channel_id is already unique.
 *
 * Exported for use in clearing memory manually.
 */
export function getSTMKey(guildId?: string, channelId?: string, userId?: string): string {
  const user = userId || "unknown";
  const channel = channelId || "default";
  return `stm:${user}:${channel}`;
}

// ========== LOAD/SAVE ==========

/**
 * Load STM from KV storage.
 * Returns null if no memory exists or if it's expired.
 */
export async function loadSTM(
  kv: KVNamespace,
  guildId?: string,
  channelId?: string,
  userId?: string
): Promise<STMEntry | null> {
  const key = getSTMKey(guildId, channelId, userId);
  const data = await kv.get(key, "json");

  if (!data) {
    return null;
  }

  return data as STMEntry;
}

/**
 * Save STM to KV storage with TTL.
 * Automatically trims message history to MAX_MESSAGES.
 */
export async function saveSTM(
  kv: KVNamespace,
  entry: STMEntry,
  guildId?: string,
  channelId?: string,
  userId?: string
): Promise<void> {
  const key = getSTMKey(guildId, channelId, userId);

  // Trim messages to MAX_MESSAGES (keep most recent)
  if (entry.messages.length > MAX_MESSAGES) {
    entry.messages = entry.messages.slice(-MAX_MESSAGES);
  }

  // Update timestamp
  entry.updated = Date.now();

  // Save with TTL (Time To Live) in seconds
  // Note: KV requires TTL to be at least 60 seconds
  // We use expirationTtl instead of expiration to avoid clock sync issues
  console.log(`[STM DEBUG] About to save to KV with TTL: ${STM_TTL_SECONDS} seconds`);
  console.log(`[STM DEBUG] Key: ${key}, Entry size: ${JSON.stringify(entry).length} bytes`);

  await kv.put(key, JSON.stringify(entry), {
    expirationTtl: STM_TTL_SECONDS,
  });

  console.log(`[STM DEBUG] Successfully saved to KV with TTL: ${STM_TTL_SECONDS}`);
}

/**
 * Create a new empty STM entry.
 */
export function createEmptySTM(): STMEntry {
  return {
    messages: [],
    facts: {},
    summary: "",
    created: Date.now(),
    updated: Date.now(),
  };
}

// ========== FACT EXTRACTION ==========

/**
 * Extract facts from a user message using regex patterns.
 * Currently extracts:
 * - User's name ("my name is X", "I'm X", "call me X")
 */
export function extractFacts(message: string, currentFacts: STMEntry["facts"]): STMEntry["facts"] {
  const facts = { ...currentFacts };

  // Name extraction patterns
  const namePatterns = [
    /(?:my name is|i'm|i am|call me)\s+([a-z]+)/i,
    /(?:this is|it's)\s+([a-z]+)(?:\s+speaking)?/i,
  ];

  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Capitalize first letter
      facts.userName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      break;
    }
  }

  return facts;
}

// ========== SUMMARIZATION ==========

/**
 * Create a compact summary of the conversation using LLM.
 * This runs when message count exceeds SUMMARIZE_THRESHOLD.
 */
export async function summarizeConversation(
  messages: Message[],
  ai: Ai,
  openRouterKey: string
): Promise<string> {
  // If too few messages, return empty summary
  if (messages.length < 2) {
    return "";
  }

  // Format messages for summarization
  const conversation = messages
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const systemPrompt = `You are a conversation summarizer. Create a brief 1-2 sentence summary of this conversation that captures:
- The main topic discussed
- Any key facts mentioned (names, preferences, etc.)
- The current context

Keep it extremely concise (under 50 words).`;

  const userPrompt = `Summarize this conversation:\n\n${conversation}`;

  try {
    // Try Cloudflare AI first
    const response = await ai.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    if (response.response && response.response.trim()) {
      return response.response.trim();
    }
  } catch (err) {
    console.log("Cloudflare AI summarization failed, trying OpenRouter...");
  }

  // Fallback to OpenRouter
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "X-Title": "casie-stm-summarizer",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    }
  } catch (err) {
    console.error("OpenRouter summarization failed:", err);
  }

  // If all fails, return empty summary
  return "";
}

// ========== UPDATE FUNCTIONS ==========

/**
 * Add a new message to STM and update facts/summary.
 * This is the main function called after each interaction.
 *
 * Error handling: If save fails, will retry once. If retry fails, logs error but doesn't throw
 * to avoid breaking the user's interaction flow.
 */
export async function updateSTM(
  kv: KVNamespace,
  ai: Ai,
  openRouterKey: string,
  userMessage: string,
  assistantMessage: string,
  guildId?: string,
  channelId?: string,
  userId?: string
): Promise<STMEntry> {
  try {
    // Load existing STM or create new
    let stm = await loadSTM(kv, guildId, channelId, userId);
    if (!stm) {
      stm = createEmptySTM();
    }

    // Add new messages
    const timestamp = Date.now();
    stm.messages.push(
      { role: "user", content: userMessage, timestamp },
      { role: "assistant", content: assistantMessage, timestamp }
    );

    // Extract facts from user message
    stm.facts = extractFacts(userMessage, stm.facts);

    // Summarize conversation when we have enough messages
    // Re-summarize every time we hit MAX_MESSAGES to keep it fresh
    const shouldSummarize =
      (stm.messages.length >= SUMMARIZE_THRESHOLD && !stm.summary) || // First summary
      (stm.messages.length >= MAX_MESSAGES); // Refresh summary when at capacity

    if (shouldSummarize) {
      try {
        stm.summary = await summarizeConversation(stm.messages, ai, openRouterKey);
      } catch (err) {
        console.error("Failed to generate summary, continuing without it:", err);
        // Continue without summary - not critical
      }
    }

    // Save updated STM with retry
    try {
      await saveSTM(kv, stm, guildId, channelId, userId);
    } catch (err) {
      console.error("Failed to save STM, retrying once:", err);
      // Retry once
      try {
        await saveSTM(kv, stm, guildId, channelId, userId);
        console.log("STM save retry succeeded");
      } catch (retryErr) {
        console.error("STM save retry also failed:", retryErr);
        // Don't throw - we don't want to break the user's interaction
        // The conversation will continue but without memory persistence
      }
    }

    return stm;
  } catch (err) {
    console.error("Critical error in updateSTM:", err);
    // Return empty STM to avoid breaking the flow
    return createEmptySTM();
  }
}

// ========== CONTEXT BUILDING ==========

/**
 * Build a context string from STM for injection into system prompt.
 * This is what gets prepended to the system prompt to give the model memory.
 *
 * Strategy:
 * - If we have a summary: Use summary + only the last 2 exchanges (to avoid duplication)
 * - If no summary yet: Use all recent messages (up to last 6)
 */
export function buildContextFromSTM(stm: STMEntry | null): string {
  if (!stm || (stm.messages.length === 0 && !stm.summary && !stm.facts.userName)) {
    return "";
  }

  const parts: string[] = [];

  // Add conversation summary if available
  if (stm.summary) {
    parts.push(`<conversation_context>\nRecent conversation: ${stm.summary}\n</conversation_context>`);
  }

  // Add known facts
  if (stm.facts.userName) {
    parts.push(`<known_facts>\n- User's name: ${stm.facts.userName}\n</known_facts>`);
  }

  // Add recent messages
  // If we have a summary, only include the VERY latest exchanges (last 2 turns = 4 messages)
  // to avoid duplicating what's already in the summary
  // If no summary, include more context (last 3 turns = 6 messages)
  if (stm.messages.length > 0) {
    const numMessagesToInclude = stm.summary ? 4 : 6;
    const recentMessages = stm.messages.slice(-numMessagesToInclude);
    const formatted = recentMessages
      .map((msg) => `${msg.role === "user" ? "User" : "You"}: ${msg.content}`)
      .join("\n");
    parts.push(`<recent_messages>\n${formatted}\n</recent_messages>`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `\n\n${parts.join("\n\n")}\n`;
}

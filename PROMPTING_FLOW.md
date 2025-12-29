# PromptSmith Prompting Flow

This document summarizes how prompts flow through the PromptSmith extension, from user input to AI-polished output.

---

## High-Level Architecture

```
┌──────────────┐    ┌────────────────┐    ┌──────────────────┐
│  content.js  │───▶│  background.js │───▶│   ai_service.js  │
│  (Button UI) │    │  (Router)      │    │  (AI Generation) │
└──────────────┘    └────────────────┘    └──────────────────┘
       │                    │                       │
       │                    │                       ▼
       │                    │              ┌────────────────┐
       │                    │              │ Gemini Nano OR │
       │                    │              │ Cloud API      │
       ◀────────────────────┴──────────────┤   (AI Engine)  │
       │           (Polished text response)└────────────────┘
       ▼
  Text Replaced
```

---

## 3-Layer Prompt System

PromptSmith uses a layered prompt architecture to ensure consistent, high-quality output:

| Layer | Source | Purpose |
|-------|--------|---------|
| **Layer 1** | Persona Instruction | Style-specific rewriting rules (Polisher, Developer, etc.) |
| **Layer 2** | User Input | The raw prompt to be polished |
| **Layer 3** | Meta Prompt | Forces AI to output ONLY the rewritten prompt |

### Why 3 Layers?

The Meta Prompt (Layer 3) is critical—it prevents the AI from accidentally **answering** the user's question instead of **polishing** it. The output is wrapped in `<result></result>` tags for reliable extraction.

---

## Detailed Flow

### Step 1: User Clicks "Polish" Button

**File:** `content.js` → `handlePolishClick()`

1. User types a prompt in ChatGPT/Claude/Gemini
2. User clicks the ✨ Polish button (or selects a persona from dropdown)
3. `content.js` extracts the text from the input field
4. Sends a message to the background script:
   ```javascript
   chrome.runtime.sendMessage({
     action: 'polishText',
     text: originalText,
     tempSystemPrompt: systemInstruction  // From selected persona
   });
   ```

### Step 2: Background Script Routes the Request

**File:** `background.js` → `handlePolishText()`

1. Receives the message from content script
2. Determines which system prompt to use:
   - Uses `tempSystemPrompt` if provided (from persona selection)
   - Falls back to `customPersonaPrompts[activePersona]` from storage
3. Imports and calls `AIService.generatePolishedText()`
4. Saves successful results to prompt history

### Step 3: AI Service Assembles the Full Prompt

**File:** `ai_service.js` → `generatePolishedText()`

1. Retrieves user preferences from storage:
   - `geminiApiKey` - for Cloud API
   - `aiMode` - cloud or local
2. Assembles the 3-layer prompt structure
3. Routes to appropriate AI backend based on mode

### Step 4: Prompt Assembly (The Core Logic)

#### For Local AI (Gemini Nano):

**File:** `ai_service.js` → `generateWithLocalAI()`

```javascript
const combinedPrompt = `${systemInstruction}

--- USER INPUT TO REWRITE ---
${userPrompt}
--- END USER INPUT ---
${META_PROMPT}`;
```

The `systemInstruction` is also passed when creating the AI session.

#### For Cloud AI (Gemini/Groq):

**File:** `ai_service.js` → `generateWithCloudAI()`

```javascript
// System instruction includes persona + meta prompt
const fullSystemInstruction = `${systemInstruction}\n${META_PROMPT}`;

const requestBody = {
  contents: [
    { parts: [{ text: `--- USER INPUT TO REWRITE ---\n${userPrompt}\n--- END USER INPUT ---` }] }
  ],
  systemInstruction: {
    parts: [{ text: fullSystemInstruction }]
  },
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 2048
  }
};
```

### Step 5: Response Parsing

**File:** `ai_service.js` → `cleanAIResponse()`

The AI is instructed to wrap output in `<result></result>` tags. This function extracts the content:

```javascript
const cleanAIResponse = (text) => {
  const match = text.match(/<result>([\s\S]*?)<\/result>/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return text.trim();  // Fallback: return as-is
};
```

### Step 6: Text Replacement

**File:** `content.js`

1. Receives polished text from background script
2. Replaces the original input field content using `document.execCommand` (React-compatible)
3. Shows success/error status to user

---

## Persona Definitions

**File:** `prompts.js`

### Available Personas

| Persona | Icon | Focus Area |
|---------|------|------------|
| **Polisher** | ✨ | Grammar, clarity, professional tone |
| **Developer** | 💻 | Code, JSON, structured output |
| **Thinker** | 🧠 | Chain of Thought, reasoning, verification |
| **Custom** | ⚙️ | User-defined from Settings page |

### Persona Instruction (Layer 1) Example

```javascript
export const POLISHER_INSTRUCTION = `You are a Professional Editor.
Your task: Rewrite this prompt to be grammatically perfect, clear, concise, and professional.

Focus on:
- Fix all spelling and grammar errors
- Improve clarity and readability
- Use professional, direct language
- Remove filler words and redundancy
- Keep the original intent intact`;
```

### Meta Prompt (Layer 3)

```javascript
export const META_PROMPT = `
CRITICAL INSTRUCTION: You are a prompt rewriting assistant. Your ONLY job is to rewrite the user's input as an improved prompt.

RULES:
1. Output ONLY the rewritten prompt - nothing else
2. Do NOT answer the user's question
3. Do NOT include preambles like "Here is your improved prompt:"
4. Do NOT include explanations or commentary
5. Wrap your output in <result></result> tags

Example of CORRECT output:
<result>Write a Python function that sorts an array...</result>

Example of INCORRECT output:
"Here's an improved version of your prompt: ..." (NO!)
"def quicksort(arr): ..." (NO! Don't answer the question!)
`;
```

---

## AI Mode Selection

**File:** `ai_service.js` → `generatePolishedText()`

| Mode | Execution |
|------|-----------|
| Mode | Execution |
|------|-----------|
| **Cloud Only** | Cloud API only, error if no key |
| **Local Only** | Gemini Nano only, error if unavailable |

```javascript
// Strict Mode Execution
if (mode === 'cloud') {
  return await tryCloud();
} else if (mode === 'local') {
  return await tryGeminiNano();
}
```

---

## Storage Keys

| Key | Purpose |
|-----|---------|
| `geminiApiKey` | Google AI Studio API key |
| `aiMode` | Processing mode: cloud or local |
| `activePersona` | Currently selected persona |
| `customPersonaPrompts` | User's custom prompt text |
| `enabledSites` | Per-site toggle (chatgpt, claude, gemini) |
| `promptHistory` | Last 10 polished prompts |

---

## Summary

1. **User types prompt** → ChatGPT/Claude/Gemini input
2. **Clicks Polish button** → `content.js` captures text + persona
3. **Message to background** → Routes to AI service
4. **3-Layer prompt assembled** → Persona + User Input + Meta Prompt
5. **AI generates response** → Cloud or Local depending on mode
6. **Response parsed** → Extract content from `<result>` tags
7. **Text replaced** → Original input updated with polished version

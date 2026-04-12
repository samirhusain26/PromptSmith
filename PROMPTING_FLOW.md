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
| **Layer 1** | Persona Instruction | Style-specific rewriting rules (Editor, Developer, etc.) |
| **Layer 2** | User Input | The raw prompt to be polished |
| **Layer 3** | Meta Prompt | Forces AI to output ONLY the rewritten prompt |

### Why 3 Layers?

The Meta Prompt (Layer 3) is critical—it prevents the AI from accidentally **answering** the user's question instead of **polishing** it. The output is wrapped in `<result></result>` tags for reliable extraction.

---

## Detailed Flow

### Step 1: Initialization & Persona Loading

**File:** `content.js` → `loadPersonas()`

PromptSmith dynamically imports persona definitions from `prompts.js` to ensure a single source of truth across the extension:

```javascript
const promptsUrl = chrome.runtime.getURL('prompts.js');
const module = await import(promptsUrl);
PERSONAS = module.PERSONAS;
```

### Step 2: User Clicks "Polish" Button

**File:** `content.js` → `handlePolishClick()`

1. User types a prompt in ChatGPT/Claude/Gemini.
2. User clicks the ✨ Polish button (or selects a persona from the dropdown).
3. `content.js` extracts text and identifies the active `systemPrompt` (prioritizing custom user overrides from storage).
4. Sends a message to the background service worker:
   ```javascript
   chrome.runtime.sendMessage({
     type: 'POLISH_TEXT',
     text: originalText,
     systemPrompt: selectedInstruction
   });
   ```

### Step 3: Background Script Routing

**File:** `background.js`

The background script acts as a bridge, passing the request to the `AIService` and managing prompt history for the user.

### Step 4: AI Service & Prompt Assembly

**File:** `ai_service.js` → `generatePolishedText()`

1. **Mode Selection**: Determines if it should use **Local (Gemini Nano)** or **Cloud (Gemini/Groq)** based on settings and availability.
2. **Assembly**: Combines the Layer 1 (Persona), Layer 2 (User Input), and Layer 3 (Meta Prompt).

#### Example: Editor Persona (CO-STAR Framework)
The Editor persona uses the **CO-STAR** method (Context, Objective, Style, Tone, Audience, Response format) as an internal checklist to make implicit requirements explicit. Depth adapts to input quality — light edits for clean inputs, full restructuring for rough ones.

#### Example: Developer Persona (XML Structural Enforcement)
The Developer persona enforces **XML tags** (`<context>`, `<task>`, `<constraints>`, `<output_format>`) for separation of concerns and optimized model attention. Includes concrete input/output examples and negative constraints.

#### Example: Thinker Persona (Structured CoT + Tree of Thoughts)
The Thinker persona forces System 2 reasoning with named reasoning phases, **deliberation gates** (challenge first instinct), **Tree of Thoughts** for multi-path problems, citation standards, and a reflexion step.

### Step 5: AI Execution

- **Local AI**: Uses `self.ai.languageModel` (Modern API) or `LanguageModel` (Legacy API) to process 100% on-device.
- **Cloud AI**: Sends a POST request to Google Gemini or Groq endpoints with the provided API key.

### Step 6: Response Parsing & Cleaning

**File:** `ai_service.js`

The AI is strictly instructed to wrap the final prompt in `<result></result>` tags. The service extracts this content, falling back to the full text if tags are missing.

```javascript
const cleanAIResponse = (text) => {
  const match = text.match(/<result>([\s\S]*?)<\/result>/i);
  return match && match[1] ? match[1].trim() : text.trim();
};
```

### Step 7: Text Replacement

**File:** `content.js`

The polished text is returned to the content script, which injects it back into the active input field using `document.execCommand('insertText', ...)` to ensure compatibility with React-based editors (ChatGPT/Claude).

---

## Persona Definitions

**File:** `prompts.js`

| Persona | Core Methodology | Focus |
|---------|------------------|-------|
| **Editor** | **CO-STAR Framework** | Clarity, structure, explicit requirements, adaptive depth |
| **Brainstormer** | **Divergent-then-Convergent + Role-Storming** | Multi-perspective ideation, ranked evaluation |
| **Developer** | **XML Structural Enforcement + Examples** | Code prompts, schema enforcement, negative constraints |
| **Thinker** | **Structured CoT + Tree of Thoughts + Deliberation Gates** | Deep reasoning, evidence standards, reflexion |
| **Custom** | User-defined | Fully flexible |

---

## Summary

1. **Init**: Load personas from `prompts.js`.
2. **Input**: User clicks "Polish".
3. **Route**: Background script triggers `AIService`.
4. **Assemble**: Persona (Layer 1) + User Input (Layer 2) + Meta Prompt (Layer 3).
5. **Generate**: Local Nano or Cloud API (Gemini/Groq).
6. **Extract**: Parse content from `<result>` tags.
7. **Inject**: Replace input field with polished prompt.

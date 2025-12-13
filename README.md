# ✨ PromptSmith

> **Privacy-first AI prompt refinement for ChatGPT, Claude, and Gemini**

A Chrome Extension that intelligently polishes your prompts before sending them to any major AI chat interface. PromptSmith uses a **3-tier hybrid AI system** that prioritizes local processing for privacy while falling back to cloud services when needed.

---

## Table of Contents

- [Features](#features)
- [Privacy Architecture](#-privacy-architecture)
- [AI Processing Modes](#-ai-processing-modes)
- [Persona System](#-persona-system)
- [Supported Sites](#-supported-sites)
- [Installation](#-installation)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [File Structure](#-file-structure)
- [Technical Architecture](#-technical-architecture)
- [Requirements](#-requirements)
- [Troubleshooting](#-troubleshooting)
- [License](#license)

---

## Features

| Feature | Description |
|---------|-------------|
| **✨ One-Click Polish** | Refine prompts with a single button click directly in the chat interface |
| **🎭 6 Persona Modes** | Choose from specialized prompt transformation styles |
| **🛡️ 3-Tier AI Fallback** | Robust availability (Gemini Nano → Gemini Flash → WebLLM) |
| **🎯 Smart Site Detection** | Native-feeling button injection for each platform |
| **⚙️ Fully Customizable** | Edit system prompts or use presets |
| **🔐 Privacy-First** | Local processing prioritized, data never stored on servers |
| **⚡ Low Latency** | On-device inference with no network dependency (when using local AI) |
| **🌐 Multi-Site Support** | Works on ChatGPT, Claude.ai, and Google Gemini |

---

## 🔒 Privacy Architecture

PromptSmith is designed with a **local-first** philosophy:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Processing Priority                        │
├─────────────────────────────────────────────────────────────────┤
│  Priority 1: Gemini Nano (Chrome Native)    → 100% Local        │
│  Priority 2: Gemini Flash API               → Cloud (API Key)   │
│  Priority 3: WebLLM (Llama 3.2 via WebGPU)  → 100% Local        │
└─────────────────────────────────────────────────────────────────┘
```

- **Your prompts are never stored** on external servers
- **Local models** process entirely within your browser
- **Cloud fallback** only triggers if you've provided an API key AND local options fail
- **API keys** are stored locally in Chrome Sync storage

---

## 🤖 AI Processing Modes

### Auto Mode (Recommended)
Automatically selects the best available AI in priority order:
1. **Gemini Nano** - Chrome's built-in on-device AI
2. **Gemini Flash** - Google's cloud API (requires API key)
3. **WebLLM** - Llama 3.2 running via WebGPU

### Direct Modes
Force a specific AI engine:

| Mode | Engine | Description | Requirements |
|------|--------|-------------|--------------|
| **Gemini Nano** | Chrome Native | On-device, private | Chrome 128+, enabled flags |
| **Gemini Flash** | Cloud API | Fastest, most capable | Google API key |
| **WebLLM** | WebGPU (Llama 3.2 1B) | Portable local AI | WebGPU-compatible GPU, ~870MB download |

### ⚡ Performance Comparison

**Speed Rankings** (fastest to slowest):
1. **Gemini Flash (API)** - Cloud processing, typically 1-3 seconds
2. **Gemini Nano** - On-device, typically 3-8 seconds
3. **WebLLM** - On-device, typically 5-15 seconds (varies by model and GPU)

> [!TIP]
> For the fastest experience, use **Gemini Flash** with an API key. On-device models (Gemini Nano and WebLLM) prioritize privacy over speed and run entirely locally without network requests.

---

## 🎭 Persona System

PromptSmith offers 6 specialized personas for different prompt transformation needs:

| Persona | Icon | Use Case | Transformation Style |
|---------|------|----------|---------------------|
| **The Polisher** | ✨ | Fix Grammar | Clarity, conciseness, professional tone |
| **The Architect** | 📐 | Solve Complex Problems | Tree of Thoughts, multi-branch reasoning |
| **The Agent** | 🤖 | Verify Facts | Action-Observation-Reflection loops, grounded reasoning |
| **The Compiler** | 💻 | Optimize for Production | DSPy signatures, modular structure |
| **The Structurer** | 🔧 | Generate Code/JSON | Guaranteed parsable output (XML/JSON) |
| **The Primer** | 🧠 | Creative Writing | In-Context Learning, few-shot templates |

### Persona Details

<details>
<summary><b>✨ The Polisher</b> — Grammar & Clarity</summary>

Rewrites prompts to be clear, concise, and professional. Fixes grammar errors and improves overall readability. Best for general-purpose prompt improvement.
</details>

<details>
<summary><b>📐 The Architect</b> — Complex Problem Solving</summary>

Enforces "Tree of Thoughts" (ToT) methodology. Forces the AI to simulate multiple experts, explore reasoning branches, and self-evaluate before concluding. Ideal for multi-step problems.
</details>

<details>
<summary><b>🤖 The Agent</b> — Fact Verification</summary>

Implements "Action-Observation-Reflection" loops (ReAct/Reflexion patterns). Instructs the AI to ground reasoning in observed reality and cite sources. Prevents hallucinations.
</details>

<details>
<summary><b>💻 The Compiler</b> — Production Optimization</summary>

Converts prompts into declarative DSPy-style signatures with Context, Task, Constraints, and Metrics. Strips conversational fluff for programmatic use.
</details>

<details>
<summary><b>🔧 The Structurer</b> — Code/JSON Generation</summary>

Guarantees valid, parsable structured output. Adds negative constraints to prevent markdown or conversational text outside tags. Defaults to XML if ambiguous.
</details>

<details>
<summary><b>🧠 The Primer</b> — Creative Writing</summary>

Implements In-Context Learning (ICL). Creates templates with placeholders for few-shot examples and pre-fill instructions for maximum creative output.
</details>

---

## 🌐 Supported Sites

| Platform | URLs | Button Position |
|----------|------|-----------------|
| **ChatGPT** | `chat.openai.com`, `chatgpt.com` | Toolbar (near microphone) |
| **Claude** | `claude.ai` | Toolbar (near send button) |
| **Google Gemini** | `gemini.google.com` | Toolbar (near Tools button) |

The button adapts its styling to look native on each platform:
- **ChatGPT**: Transparent split button with SVG sparkle icon
- **Claude**: Minimal toolbar integration with dark/light mode support
- **Gemini**: Pill-shaped button matching Material Design 3

---

## 🚀 Installation

### Step 1: Load the Extension

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `PromptSmith` folder

### Step 2: Configure AI (Choose One or More)

#### Option A: Gemini Nano (Recommended)
**Best for:** Speed & Privacy | **Processing:** 100% Local

1. Navigate to `chrome://flags` and enable:
   
   | Flag | Setting |
   |------|---------|
   | `#optimization-guide-on-device-model` | **Enabled BypassPerfRequirement** |
   | `#prompt-api-for-gemini-nano` | **Enabled** |
   
2. Click **Relaunch** to restart Chrome

3. Download the model:
   - Open `chrome://components`
   - Find **"Optimization Guide On Device Model"**
   - Click **"Check for update"** (~1.7GB download)
   - Wait for version to change from `0.0.0.0`

#### Option B: Gemini Flash (Cloud Fallback)
**Best for:** Reliability | **Processing:** Cloud API

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open PromptSmith Settings (click extension icon)
3. Enter your API key in the "Google API Key" section

#### Option C: WebLLM (Alternative Local)
**Best for:** Compatibility | **Processing:** 100% Local via WebGPU

1. Requires a GPU (integrated or dedicated)
2. Requires Chrome 113+ with WebGPU support
3. Open PromptSmith Settings
4. Set AI Processing Mode to "WebLLM"
5. Select a model (default: Llama 3.2 1B, ~870MB)
6. Click **Download Model**

**Available Models:**
- Llama 3.2 1B (Fastest) - ~870MB
- Llama 3.2 3B (Balanced) - ~2.3GB
- Gemma 2 2B (Google) - ~1.4GB

---

## 📖 Usage

1. Navigate to [ChatGPT](https://chat.openai.com), [Claude](https://claude.ai), or [Gemini](https://gemini.google.com)
2. Type your prompt in the chat input
3. Click the **✨ Polish** button that appears in the toolbar
4. (Optional) Click the dropdown arrow to select a different persona
5. Your prompt is instantly refined!

### Button States

| State | Appearance | Meaning |
|-------|------------|---------|
| **Ready** | Purple gradient / Native | Ready to polish |
| **Loading** | Pulsing opacity | AI is processing |
| **Success** | Green flash | Prompt replaced successfully |
| **Error** | Red flash | Processing failed |

---

## ⚙️ Configuration

Click the extension icon to open the Settings page:

### Settings Sections

| Section | Purpose |
|---------|---------|
| **System Prompt** | Custom instructions for how AI should polish prompts |
| **Model Selection** | Choose Auto, Gemini Nano, Gemini Flash, or WebLLM |
| **Active Method** | Shows currently detected/active AI engine |
| **Enabled Sites** | Toggle PromptSmith on/off for each platform |
| **Google API Key** | Store your Gemini Flash API key (for cloud fallback) |
| **WebLLM** | Download and manage the local Llama 3.2 model |

### Preset Chips

Quick-apply system prompt presets:

| Preset | Emoji | Use Case |
|--------|-------|----------|
| Architect | 🏗️ | Complex problem decomposition |
| Agent | 🕵️ | Fact-checking and grounding |
| Compiler | 💻 | Production-ready structure |
| Structurer | 🧱 | Guaranteed output format |
| Primer | 🧠 | Few-shot learning templates |
| Polisher | ✍️ | Grammar and clarity |

---

## 📁 File Structure

```
PromptSmith/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker: message handling, AI routing
├── ai_service.js       # Unified AI service with hybrid fallback logic
├── webllm_service.js   # WebLLM (Llama 3.2) integration
├── webllm_lib.js       # WebLLM library (~5.5MB)
├── content.js          # DOM injection, button creation, site detection
├── styles.css          # Button and dropdown styling
├── options.html        # Settings page UI
├── options.js          # Settings page logic
└── icons/
    ├── icon.png        # Main extension icon
    └── icon16.svg      # Small icon variant
```

### Key Components

| File | Responsibility |
|------|---------------|
| `content.js` | Site detection, button injection, persona system, text replacement |
| `ai_service.js` | AI engine selection, fallback logic, local/cloud generation |
| `background.js` | Message routing, settings management, WebLLM coordination |
| `options.js` | UI state management, preset loading, API key handling |

---

## 🔧 Technical Architecture

### Technologies Used

| Technology | Usage |
|------------|-------|
| `LanguageModel` API | Chrome's on-device Gemini Nano |
| `WebLLM` / `WebGPU` | Local Llama 3.2 inference |
| `MutationObserver` | Robust SPA input detection |
| `document.execCommand` | React-compatible text replacement |
| `chrome.storage.sync` | Cross-device settings synchronization |
| `Portal Pattern` | Dropdown rendering outside overflow containers |

### Message Flow

```
┌──────────────┐    ┌────────────────┐    ┌──────────────────┐
│  content.js  │───▶│  background.js │───▶│   ai_service.js  │
│  (Button UI) │    │  (Router)      │    │  (AI Generation) │
└──────────────┘    └────────────────┘    └──────────────────┘
       │                    │                       │
       │                    │                       ▼
       │                    │              ┌────────────────┐
       │                    │              │ Gemini Nano OR │
       │                    │              │ Gemini Flash OR│
       │                    │              │ WebLLM         │
       │                    │              └────────────────┘
       │                    │                       │
       │◀───────────────────┴───────────────────────┘
       │           (Polished text response)
       ▼
  Text Replaced
```

### Chrome Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store user settings and API keys |
| `activeTab` | Inject button into current tab |
| `unlimitedStorage` | WebLLM model caching |
| Host permissions | Access ChatGPT, Claude, Gemini, Google AI API |

---

## 📋 Requirements

### Minimum Requirements

- **Chrome**: Version 113+ (for WebGPU)
- **Recommended**: Chrome 128+ (for Gemini Nano) or 143+

### For Gemini Nano (Local)

- Chrome 128 or later
- `#prompt-api-for-gemini-nano` flag enabled
- `#optimization-guide-on-device-model` flag enabled
- ~1.7GB disk space for model
- Active Chrome profile (model downloads per-profile)

### For WebLLM (Local)

- WebGPU-compatible GPU (most modern GPUs)
- ~870MB - 2.3GB disk space (depending on model choice)
- Chrome 113+ or any WebGPU-enabled browser
- Note: Processing speeds vary by GPU and model size

### For Gemini Flash (Cloud)

- Google AI Studio API key (free tier available)
- Internet connection

---

## ❓ Troubleshooting

### "Chrome AI API not found"

1. Ensure Chrome version is 128+
2. Enable `chrome://flags/#prompt-api-for-gemini-nano`
3. Enable `chrome://flags/#optimization-guide-on-device-model` (set to "Enabled BypassPerfRequirement")
4. Restart Chrome completely (close all windows)

### "Model is downloading"

1. Check download progress at `chrome://components`
2. Look for "Optimization Guide On Device Model"
3. Wait for version to change from `0.0.0.0`
4. Typical download: ~1.7GB

### Button not appearing

1. Refresh the page
2. Check browser console for `[PromptSmith]` logs
3. Ensure the extension is enabled
4. Verify the site is toggled ON in settings
5. Check if another extension is blocking content scripts

### Dropdown menu clipped/hidden

- This has been fixed using the Portal pattern
- Dropdowns render at document root to escape `overflow: hidden` containers

### WebLLM not working

1. Check if your GPU supports WebGPU
2. Visit `chrome://gpu` to verify WebGPU status
3. Try updating graphics drivers
4. Ensure Chrome version is 113+

### API Key not saving

1. Check Chrome console for storage errors
2. Verify you have sync storage enabled in Chrome
3. Try clearing and re-entering the key

---

## License

MIT

---

<p align="center">
  Made with ❤️ for better prompts<br>
  <sub>PromptSmith v1.0</sub>
</p>

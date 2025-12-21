# ✨ PromptSmith v1.1

> **Privacy-first AI prompt refinement for ChatGPT, Claude, and Gemini**

A Chrome Extension that intelligently polishes your prompts before sending them to any major AI chat interface. PromptSmith uses a **2-tier hybrid AI system** that prioritizes cloud processing for speed while falling back to local processing for privacy.

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
| **🎭 4 Personas** | Polisher, Developer, Thinker, and Custom prompt transformation modes |
| **🛡️ 2-Tier AI Fallback** | Robust availability (Gemini 2.0 Flash → Gemini Nano) |
| **🎯 Smart Site Detection** | Native-feeling button injection for each platform |
| **⚙️ Fully Customizable** | Edit system prompts per-persona or create your own |
| **🔐 Privacy-First** | Local processing available, data never stored on servers |
| **⚡ Low Latency** | On-device inference with no network dependency (when using local AI) |
| **🌐 Multi-Site Support** | Works on ChatGPT, Claude.ai, and Google Gemini |
| **📜 Prompt History** | Track your last 10 polished prompts with timestamps and AI mode used |
| **🎓 Guided Onboarding** | Step-by-step setup wizard for first-time users |

---

## 🔒 Privacy Architecture

PromptSmith is designed with a **cloud-first** philosophy when an API key is provided:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Processing Priority                        │
├─────────────────────────────────────────────────────────────────┤
│  Priority 1: Gemini 2.0 Flash API           → Cloud (API Key)   │
│  Priority 2: Gemini Nano (Chrome Native)    → 100% Local        │
└─────────────────────────────────────────────────────────────────┘
```

- **Your prompts are never stored** on external servers
- **Local models** process entirely within your browser
- **Cloud API** is prioritized for speed when an API key is provided
- **API keys** are stored locally in Chrome Sync storage

---

## 🤖 AI Processing Modes

PromptSmith offers three processing modes to suit your needs:

| Mode | Priority | Description |
|------|----------|-------------|
| **Hybrid** (Recommended) | Cloud → Local | Tries Gemini Flash first, falls back to Nano |
| **Cloud Only** | Cloud | Uses Gemini Flash API exclusively (requires API key) |
| **Local Only** | Local | Uses Gemini Nano exclusively (requires Chrome 128+) |

### ⚡ Performance Comparison

**Speed Rankings** (fastest to slowest):
1. **Gemini 2.0 Flash (Cloud)** - Typically 1-3 seconds
2. **Gemini Nano (Local)** - Typically 3-8 seconds

> [!TIP]
> For the fastest experience, use **Hybrid** mode with an API key. Gemini Nano provides a privacy-first fallback when cloud is unavailable.

---

## 🎭 Persona System

PromptSmith offers 4 specialized personas for different prompt transformation needs:

| Persona | Icon | Use Case | Transformation Style |
|---------|------|----------|---------------------|
| **Polisher** | ✨ | Grammar & Clarity | Professional tone, conciseness, readability |
| **Developer** | 💻 | Code & Data | Structured output (JSON, XML, code conventions) |
| **Thinker** | 🧠 | Reasoning & Analysis | Chain of Thought, step-by-step verification |
| **Custom** | ⚙️ | Your Own Prompt | Fully customizable from Settings page |

### Persona Details

<details>
<summary><b>✨ Polisher</b> — Grammar & Clarity</summary>

Rewrites prompts to be clear, concise, and professional. Fixes grammar errors and improves overall readability. Best for general-purpose prompt improvement.
</details>

<details>
<summary><b>💻 Developer</b> — Code & Structured Data</summary>

Optimizes prompts for structured, parsable output. Adds constraints like "respond only with valid JSON" and defines clear input/output expectations. Ideal for API calls and data processing.
</details>

<details>
<summary><b>🧠 Thinker</b> — Reasoning & Analysis</summary>

Enforces systematic thinking with Chain of Thought reasoning. Adds self-verification steps and encourages multiple perspectives. Perfect for complex problems requiring careful analysis.
</details>

<details>
<summary><b>⚙️ Custom</b> — Your Own Instructions</summary>

Use your own system prompt saved from the Settings page. Full control over how prompts are transformed.
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

#### Option A: Gemini 2.0 Flash (Recommended)
**Best for:** Speed & Reliability | **Processing:** Cloud API

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open PromptSmith Settings (click extension icon)
3. Enter your API key in the "Google API Key" section
4. **First-time users**: Follow the guided onboarding wizard for step-by-step setup

#### Option B: Gemini Nano (Local Fallback)
**Best for:** Privacy | **Processing:** 100% Local

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
| **Ready** | Translucent Sky Blue | Ready to polish |
| **Loading** | Pulsing opacity | AI is processing |
| **Success** | Soft Mint Glow | Prompt replaced successfully |
| **Error** | Pale Rose Flash | Processing failed |

---

## ⚙️ Configuration

Click the extension icon to open the Settings page:

### Settings Sections

| Section | Purpose |
|---------|---------|
| **How It Works** | Quick setup guide for Cloud and Local AI |
| **System Prompt** | Custom instructions for how AI should polish prompts (saved per-persona) |
| **Model Selection** | Choose Hybrid, Cloud Only, or Local Only mode |
| **Enabled Sites** | Toggle PromptSmith on/off for each platform |
| **Google API Key** | Store your Gemini 2.0 Flash API key |
| **Prompt History** | View your last 10 polished prompts with timestamps |

### Persona Chips

Quick-apply system prompt presets:

| Preset | Icon | Use Case |
|--------|------|----------|
| Polisher | ✨ | Grammar and clarity |
| Developer | 💻 | Code and structured output |
| Thinker | 🧠 | Reasoning and analysis |
| Custom | ⚙️ | Your own instructions |

---

## 📁 File Structure

```
PromptSmith/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker: message handling, AI routing
├── ai_service.js       # Unified AI service with hybrid fallback logic
├── content.js          # DOM injection, button creation, site detection
├── constants.js        # Shared constants (API endpoints)
├── prompts.js          # Centralized persona prompts and presets
├── styles.css          # Button and dropdown styling
├── options.html        # Settings page UI (includes onboarding)
├── options.js          # Settings page logic + prompt history
└── icons/
    └── icon.png        # Extension icon
```

### Key Components

| File | Responsibility |
|------|---------------|
| `content.js` | Site detection, button injection, persona system, text replacement |
| `ai_service.js` | AI engine selection, fallback logic, local/cloud generation |
| `background.js` | Message routing, settings management |
| `options.js` | UI state, preset loading, API key handling, history, onboarding |
| `prompts.js` | Centralized persona instructions and advanced presets |
| `constants.js` | Shared configuration (API endpoints) |

---

## 🔧 Technical Architecture

### 3-Layer Prompt System

PromptSmith uses a layered prompt architecture to ensure consistent, high-quality output:

| Layer | Source | Purpose |
|-------|--------|---------|
| **Layer 1** | Persona Instruction | Style-specific rewriting rules (Polisher, Developer, etc.) |
| **Layer 2** | User Input | The raw prompt to be polished |
| **Layer 3** | Meta Prompt | Forces AI to output ONLY the rewritten prompt |

```
┌─────────────────────────────────────────────────────────────────┐
│                    Prompt Assembly                               │
├─────────────────────────────────────────────────────────────────┤
│  [Persona Instruction] + [User Input] + [Meta Prompt]           │
│                           ↓                                      │
│  AI outputs: <result>Polished prompt here</result>              │
└─────────────────────────────────────────────────────────────────┘
```

The Meta Prompt prevents the AI from accidentally answering the user's question instead of polishing it.

### Technologies Used

| Technology | Usage |
|------------|-------|
| `LanguageModel` API | Chrome's on-device Gemini Nano |
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
       │                    │              │ Gemini Flash   │
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
| Host permissions | Access ChatGPT, Claude, Gemini, Google AI API |

---

## 📋 Requirements

### Minimum Requirements

- **Chrome**: Version 128+ (for Gemini Nano) or any version (for Cloud only)

### For Gemini Nano (Local)

- Chrome 128 or later
- `#prompt-api-for-gemini-nano` flag enabled
- `#optimization-guide-on-device-model` flag enabled
- ~1.7GB disk space for model
- Active Chrome profile (model downloads per-profile)

### For Gemini 2.0 Flash (Cloud)

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
  <sub>PromptSmith v1.1</sub>
</p>

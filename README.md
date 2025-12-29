# ✨ PromptSmith v1.2

> **Privacy-first AI prompt refinement for Chrome.**

PromptSmith is a Chrome Extension that intelligently polishes your prompts before you send them to AI agents like ChatGPT, Claude, or Gemini.

It features a **Smart AI Mode** that automatically chooses the best privacy/performance balance by default (you can also manually lock it to Cloud or Local mode):
1. **Cloud Speed**: Uses your API keys (Gemini or Groq) for instant results.
2. **Local Privacy**: Uses **Gemini Nano** (built into Chrome) for 100% on-device processing.

---

## Table of Contents

- [Features](#features)
- [Privacy Architecture](#-privacy-architecture)
- [Smart AI Modes](#-smart-ai-modes)
- [Persona System](#-persona-system)
- [Supported Sites](#-supported-sites)
- [Installation](#-installation)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [Requirements](#-requirements)
- [Troubleshooting](#-troubleshooting)
- [License](#license)

---

## Features

| Feature | Description |
|---------|-------------|
| **✨ Smart AI Mode** | Auto-selects Cloud API for speed or Local Nano for privacy based on availability |
| **🚀 Multi-Model Support** | **Gemini 2.0/3.0** (Google) and **Llama 3.1/3.3** (Groq) supported out of the box |
| **🎭 4 Personas** | Polisher, Developer, Thinker, and Custom prompt transformation modes |
| **🎯 Native Integration** | Injects a polished button directly into ChatGPT, Claude, and Gemini interfaces |
| **⚙️ Fully Customizable** | Edit system prompts per-persona or create your own |
| **🔐 Privacy-First** | Zero data collection. Keys stored locally in Chrome Sync. |
| **📜 Prompt History** | Track your last 10 polished prompts with timestamps |

---

## 🔒 Privacy Architecture

PromptSmith is designed with a **privacy-by-default** philosophy.

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Data Flow                                 │
├─────────────────────────────────────────────────────────────────┤
│  Option 1: Google Gemini API (Cloud)      → HTTPS to Google     │
│  Option 2: Groq API (Cloud)               → HTTPS to Groq       │
│  Option 3: Gemini Nano (Device)           → NEVER leaves device │
└─────────────────────────────────────────────────────────────────┘
```

- **No Middleman**: We do not run a backend server. Your data goes directly from your browser to the provider (or stays on your browser).
- **Local Keys**: API keys are stored in `chrome.storage.sync` (encrypted by Google if Sync Passphrase is on).
- **Open Source**: You can inspect the code to verify no analytics are sent.

---

## 🤖 Smart AI Modes

The extension uses a "Smart Mode" logic to determine how to process your prompt:

| Priority | Mode | Condition | Pros/Cons |
|----------|------|-----------|-----------|
| **1** | **Cloud** | API Key is set (Gemini or Groq) | ✅ Fastest (1s)<br>✅ Smartest Models (Gemini 1.5/2.0, Llama 3.3)<br>❌ Data sent to provider |
| **2** | **Local** | No Key + Gemini Nano available | ✅ 100% Private<br>✅ Completely Free<br>❌ Slower (3-8s)<br>❌ Requires Chrome 128+ & Download |
| **3** | **Fallback** | Neither available | ❌ Prompts user to setup in Settings |

### Supported Cloud Models
- **Google Gemini**:
  - `Gemini 3.0 Flash` (Newest, Experimental)
  - `Gemini 2.5 Flash` (Balanced)
  - `Gemini 2.0 Flash` (Reliable, Cheap)
- **Groq (Llama)**:
  - `Llama 3.3 70B Versatile` (Smartest Open Source)
  - `Llama 3.1 8B Instant` (Fastest)
  - `GPT-OSS 120B` (High reasoning)
  - `GPT-OSS 20B` (Efficient Mid-Range)

---

## 🎭 Persona System

PromptSmith offers 4 specialized personas for different prompt transformation needs:

| Persona | Icon | Use Case |
|---------|------|----------|
| **Polisher** | ✨ | **Grammar & Clarity**: Professional tone, concise, readable. |
| **Developer** | 💻 | **Code & Data**: Structured output (JSON, XML), edge case handling. |
| **Thinker** | 🧠 | **Reasoning**: Chain of Thought, step-by-step verification. |
| **Custom** | ⚙️ | **Yours**: Fully customizable from the Settings page. |

> [!TIP]
> You can edit the system instructions for **any** persona in the Options page. Changes are saved per-persona.

---

## 🚀 Installation

### 1. Load the Extension
1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `PromptSmith` folder.

### 2. Configure Local AI (Privacy Mode)
*Requires Chrome 128+ on Desktop (Mac/Windows/Linux).*

**Note**: The PromptSmith Options page now includes helpful **Copy** buttons next to these URLs for easy setup.

1. **Enable Flags**: Go to `chrome://flags` and set:
   - `Optimization Guide On Device Model`: **Enabled BypassPerfRequirement**
   - `Prompt API for Gemini Nano`: **Enabled**
   
   *(Copy and paste these into the address bar)*
   ```text
   chrome://flags/#optimization-guide-on-device-model
   chrome://flags/#prompt-api-for-gemini-nano
   ```
2. **Relaunch Chrome**.
3. **Download Model**:
   - Go to `chrome://components`.
   - Find **Optimization Guide On Device Model**.
   - Click **Check for update**.
   - Wait for it to download (~1.7GB). Version will change from `0.0.0.0` when done.

### 3. Configure Cloud AI (Performance Mode)
*Best for speed and model quality.*

**Option A: Gemini (Google)**
1. Get a **Free Key** at [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open PromptSmith Settings -> **Cloud Settings**.
3. Select **Gemini** and paste your key.

**Option B: Groq (Llama/Mixtral)**
1. Get a **Free Key** at [Groq Console](https://console.groq.com/keys).
2. Open PromptSmith Settings -> **Cloud Settings**.
3. Select **Groq**, paste key, and choose your model (e.g., Llama 3.3).

---

## ⚙️ Configuration

Click the extension icon to open the **Settings Dashboard**:

- **System Prompt Editor**: live-edit the instructions for the current persona.
- **Smart Status Card**: Shows if you are running on Local (Nano) or Cloud (API).
- **Cloud Settings**: Switch providers (Gemini/Groq) and models.
- **Site Toggles**: Enable/Disable the extension for specific sites (ChatGPT, Claude, Gemini).
- **History**: View your last 10 refined prompts.

---

## 📋 Requirements

| Requirement | Local Mode (Nano) | Cloud Mode (API) |
|-------------|-------------------|------------------|
| **Chrome Version** | 128+ | Any modern version |
| **OS** | Windows, Mac, Linux | Any |
| **Disk Space** | ~2GB (for model) | Negligible |
| **Internet** | **Offline Capable** | Required |
| **Cost** | Free | Free Tier / Pay-as-you-go |

---

## ❓ Troubleshooting

**"Button doesn't appear on ChatGPT"**
- Refresh the page.
- Check if `ChatGPT` is enabled in Extension Settings -> Enabled Sites.

**"Local AI says 'Download Required'"**
- Go to `chrome://components` and check "Optimization Guide On Device Model".
- Ensure you have enough disk space.
- If it says "Updater error", try restarting Chrome or your computer.

**"Cloud API Error"**
- Check if your API key is valid.
- Gemini Free Tier has rate limits; if you hit them, wait a minute or switch to Groq.

---

## License
MIT

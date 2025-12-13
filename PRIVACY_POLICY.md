# Privacy Policy for PromptSmith

**Last Updated:** December 13, 2024

## Overview

PromptSmith is a Chrome extension that enhances your prompts on AI chat platforms (ChatGPT, Claude, and Gemini). We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection

**PromptSmith does NOT collect, transmit, or store any personal data on external servers.**

All data remains on your local device.

## Data Storage

The extension stores the following data **locally in your browser** using Chrome's storage API:

| Data Type | Purpose | Storage Location |
|-----------|---------|------------------|
| API Key (optional) | To use Gemini Flash API for prompt enhancement | Local browser storage |
| User Preferences | Site toggles, selected personas, AI mode settings | Local browser storage |
| WebLLM Models (optional) | Cached AI models for offline processing | Local browser storage |
| Custom Personas | User-created prompt enhancement personas | Local browser storage |

## AI Processing Modes

PromptSmith offers three AI processing modes:

1. **Gemini Nano (On-Device)** - All processing happens locally in your browser. No data leaves your device.

2. **WebLLM (On-Device)** - Uses locally cached models. No data leaves your device.

3. **Gemini Flash API (Cloud)** - Your prompt text is sent to Google's Generative Language API for processing. This is optional and only used if you provide an API key.

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `activeTab` | To access the current page and inject the PromptSmith button on supported AI chat sites |
| `storage` | To save your preferences, API key, and custom personas locally |
| `unlimitedStorage` | To cache WebLLM models locally for offline AI processing |
| Host permissions | To inject functionality into ChatGPT, Claude, and Gemini websites |

## Third-Party Services

- **Google Generative Language API**: Only used if you choose to enable the Gemini Flash API mode and provide your own API key. Subject to [Google's Privacy Policy](https://policies.google.com/privacy).
- **Hugging Face**: WebLLM models are downloaded from Hugging Face. No personal data is sent. Subject to [Hugging Face Privacy Policy](https://huggingface.co/privacy).

## Data Sharing

We do **NOT**:
- Sell your data
- Share your data with third parties
- Track your browsing activity
- Collect analytics or usage statistics

## Data Security

- All local data is stored using Chrome's secure storage APIs
- API keys are stored locally and never transmitted to our servers (we have no servers)
- No external connections are made except when using cloud AI features

## Your Rights

You can:
- **Delete all data**: Uninstall the extension to remove all stored data
- **Clear settings**: Use the extension's settings page to reset preferences
- **Disable cloud features**: Use only on-device AI processing

## Children's Privacy

PromptSmith does not knowingly collect any information from children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

---

**Summary**: PromptSmith processes everything locally. The only exception is if you explicitly choose to use the Gemini Flash API, in which case your prompts are sent to Google's servers for processing.

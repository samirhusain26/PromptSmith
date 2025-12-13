/**
 * PromptSmith - Options Page Script
 * Handles saving and loading user settings for system prompt and API key.
 * Detects AI availability and updates status indicator.
 */

// Default system prompt
const DEFAULT_PROMPT = 'Rewrite this prompt to be clear, concise, and professional. Fix any grammar errors.';

// Preset prompts for quick selection
const PRESETS = {
    architect: `You are an expert Prompt Engineer specializing in "Tree of Thoughts" (ToT) and advanced reasoning topologies.
Your Goal: Rewrite the user's prompt to force a Large Language Model (LLM) to use "System 2" thinking. The new prompt must require the model to simulate multiple experts, explore multiple reasoning branches, and evaluate its own steps before concluding.

Instructions:
1. Analyze the user's original request.
2. Rewrite it into a "Multi-Expert ToT Simulation" format.
3. Structure the new prompt to include:
   - A persona assignment: "Imagine three different experts are answering this question."
   - A process instruction: "All experts will write down 1 step of their thinking, then share it with the group."
   - An error correction mechanism: "If any expert realizes they're wrong, they leave."
   - The original query clearly stated at the end.
4. Do not answer the user's prompt yourself. Only output the *rewritten prompt* ready for ingestion.`,

    agent: `You are an expert in Agentic AI patterns (ReAct, Reflexion).
Your Goal: Rewrite the user's prompt to enforce a strict "Action-Observation-Reflection" loop. This is critical for tasks requiring research, facts, or tool usage to prevent hallucinations.

Instructions:
1. Analyze the user's request.
2. Rewrite the prompt to demand the following structure from the model:
   - Thought: Reason about the current state.
   - Action: Explicitly state what information needs to be retrieved/verified.
   - Observation: Analyze the findings.
   - Reflection: Critique the previous steps for errors or gaps.
3. Explicitly instruct the model to "ground its reasoning in observed reality" and "cite sources."
4. Do not execute the prompt. Only provide the *polished, agentic prompt*.`,

    compiler: `You are a DSPy Optimization Specialist.
Your Goal: Treat the user's prompt not as conversation, but as a software program. Strip away conversational fluff and restructure it into a declarative "Signature."

Instructions:
1. Identify the core "Input" (what the user provides) and "Output" (what they want).
2. Remove polite phrases ("Please," "I would like") and vague language.
3. Format the new prompt using a pseudo-code/DSPy style:
   - Context: [Background info]
   - Task: [Precise verb]
   - Constraints: [Strict rules, e.g., "Max 50 words"]
   - Metric: [How success is measured, e.g., "Exact Match"]
4. Ensure the instructions are modular and repeatable.`,

    structurer: `You are a Syntax Enforcement Engineer specializing in LLM outputs.
Your Goal: Rewrite the user's prompt to guarantee the output is valid, parsable code (XML or JSON).

Instructions:
1. Determine if the user needs a document structure (XML) or a data object (JSON).
   - If ambiguous, default to XML for content generation and JSON for data extraction.
2. If XML: Wrap instructions in <instruction> tags and require the output in <answer> tags.
3. If JSON: Define a strict JSON Schema (keys and value types) and instruct the model to "adhere strictly to this schema."
4. Add a "negative constraint": "Do not include markdown formatting or conversational filler outside the tags."`,

    primer: `You are a Contextual Scaling Strategist.
Your Goal: Rewrite the prompt to utilize "In-Context Learning" (ICL). You want to "prime" the model to behave in a specific way by establishing a pattern before the actual request.

Instructions:
1. Analyze the user's intent.
2. Create a "Template" structure for the prompt.
3. Add placeholders for "Few-Shot Examples" (e.g., "[Insert Example 1 Here]").
4. Add a "Pre-fill" instruction at the very end to force the model's starting sequence (e.g., "Assistant: <analysis>").
5. Explain to the user (in a brief comment) that they should fill in the example placeholders for maximum effect.`,

    polisher: `You are a Professional Editor for technical documentation.
Your Goal: Clean up the user's prompt to be grammatically perfect, concise, and highly legible, without changing the underlying logic or adding complex frameworks.

Instructions:
1. Fix all spelling and grammar errors.
2. Improve sentence structure for clarity and impact.
3. Use Markdown formatting (bolding, bullet points) to make the instructions scannable.
4. Separate the "Context" from the "Instruction" visually.
5. Do not add new personas or complex constraints—just make the existing intent shine.`
};

// DOM Elements
const systemPromptTextarea = document.getElementById('systemPrompt');
const charCountSpan = document.getElementById('charCount');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusDiv = document.getElementById('status');
const presetChips = document.querySelectorAll('.preset-chip');

// API Key elements
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibility');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
const apiKeyStatusDiv = document.getElementById('apiKeyStatus');

// AI Status elements (New UI)
const activeMethodIcon = document.getElementById('activeMethodIcon');
const activeMethodName = document.getElementById('activeMethodName');
const activeMethodStatus = document.getElementById('activeMethodStatus');

// WebLLM Elements
const webllmSection = document.getElementById('webllm-section');
const btnDownloadWebllm = document.getElementById('btn-download-webllm');
const webllmStatusSpan = document.getElementById('webllm-status');
const webllmModelStatusSpan = document.getElementById('webllm-model-status');
const webllmProgressContainer = document.getElementById('webllm-progress-container');
const webllmProgressBar = document.getElementById('webllm-progress-bar');
const webllmProgressText = document.getElementById('webllm-progress-text');
const webllmError = document.getElementById('webllm-error');

// ============================================================
// AI AVAILABILITY CHECK
// ============================================================

/**
 * Check if local AI (Gemini Nano) is available
 */
// Import shared AI check from service
import { AIService } from './ai_service.js';

/**
 * Check if local AI (Gemini Nano) is available
 * Wraps the shared service call
 */
async function checkLocalAIAvailability() {
    return await AIService.checkLocalAIAvailability();
}

/**
 * Update the AI status display in the UI
 */
async function updateAIStatus() {
    // Check local AI availability
    const localAI = await checkLocalAIAvailability();

    // Check if API key is configured
    const storage = await chrome.storage.sync.get(['geminiApiKey', 'aiMode']);
    const hasApiKey = storage.geminiApiKey && storage.geminiApiKey.trim().length > 0;
    const currentMode = storage.aiMode || 'auto';

    // Logic to determine what the "Default Method" block displays
    // It should reflect what will *actually* be used given the mode and availability

    let method = {
        icon: '⚠️',
        name: 'No AI Available',
        status: 'Please configure settings'
    };

    if (currentMode === 'gemini-nano') {
        if (localAI.available) {
            method = { icon: '⚡', name: 'Gemini Nano', status: 'Active (On-Device)' };
        } else {
            method = { icon: '⚠️', name: 'Gemini Nano', status: 'Unavailable / Download Required' };
        }
    } else if (currentMode === 'gemini-flash') {
        if (hasApiKey) {
            method = { icon: '☁️', name: 'Gemini Flash', status: 'Active (Cloud API)' };
        } else {
            method = { icon: '⚠️', name: 'Gemini Flash', status: 'Missing API Key' };
        }
    } else if (currentMode === 'webllm') {
        // We'll trust the separate WebLLM check to handle detailed status, but setting high level here
        method = { icon: '🌐', name: 'WebLLM', status: 'Check Download Status' };
    } else {
        // Auto Mode logic
        if (localAI.available) {
            method = { icon: '⚡', name: 'Gemini Nano', status: 'Auto: Preferred' };
        } else if (hasApiKey) {
            method = { icon: '☁️', name: 'Gemini Flash', status: 'Auto: Fallback Active' };
        } else {
            method = { icon: '⚠️', name: 'No AI Ready', status: 'Auto: No Valid Source' };
        }
    }

    // Update UI
    activeMethodIcon.textContent = method.icon;
    activeMethodName.textContent = method.name;
    activeMethodStatus.textContent = method.status;

    // Also handle the download button visibility for Nano in specific cases
    if (localAI.status === 'downloadable' && (currentMode === 'auto' || currentMode === 'gemini-nano')) {
        // Optionally prompt for download if we were in a more complex UI, 
        // but for this grid, we might just update the status text to encourage action
        // or we could repurpose the method-status to be clickable? 
        // For now, let's keep it simple as requested.
        if (method.name === 'Gemini Nano' || method.name === 'No AI Ready') {
            activeMethodStatus.textContent = 'Model Downloadable (Check Flags)';
        }
    }
}

// ============================================================
// SETTINGS MANAGEMENT
// ============================================================

/**
 * Load saved settings from Chrome storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['systemPrompt', 'geminiApiKey', 'aiMode', 'enabledSites']);

        // Load system prompt
        const savedPrompt = result.systemPrompt || DEFAULT_PROMPT;
        systemPromptTextarea.value = savedPrompt;
        updateCharCount();

        // Load API key (show masked)
        if (result.geminiApiKey && result.geminiApiKey.length > 0) {
            apiKeyInput.value = result.geminiApiKey;
        }

        // Load AI Mode
        const savedMode = result.aiMode || 'auto';
        const radio = document.querySelector(`input[name="aiMode"][value="${savedMode}"]`);
        if (radio) radio.checked = true;

        updateWebLLMUI(savedMode);

        // Load Enabled Sites
        const enabledSites = result.enabledSites || { chatgpt: true, claude: true, gemini: true };
        document.querySelectorAll('input[name="enabledSites"]').forEach(checkbox => {
            checkbox.checked = enabledSites[checkbox.value] !== false; // Default to true if undefined
        });

        console.log('[Options] Settings loaded');
    } catch (error) {
        console.error('[Options] Error loading settings:', error);
        systemPromptTextarea.value = DEFAULT_PROMPT;
        updateCharCount();
    }
}

/**
 * Save system prompt to Chrome storage
 */
async function saveSettings() {
    const systemPrompt = systemPromptTextarea.value.trim();

    if (!systemPrompt) {
        showStatus(statusDiv, 'Please enter a system prompt', 'error');
        return;
    }

    try {
        await chrome.storage.sync.set({ systemPrompt });
        showStatus(statusDiv, '✓ Settings saved successfully!', 'show');
        console.log('[Options] Settings saved');
    } catch (error) {
        console.error('[Options] Error saving settings:', error);
        showStatus(statusDiv, 'Error saving settings.', 'error');
    }
}

/**
 * Save API key to Chrome storage
 */
async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showStatus(apiKeyStatusDiv, 'Please enter an API key', 'error');
        return;
    }

    // Basic validation - Gemini API keys typically start with "AIza"
    if (!apiKey.startsWith('AIza')) {
        showStatus(apiKeyStatusDiv, 'Invalid API key format. Keys typically start with "AIza"', 'error');
        return;
    }

    try {
        await chrome.storage.sync.set({ geminiApiKey: apiKey });
        showStatus(apiKeyStatusDiv, '✓ API key saved!', 'show');
        console.log('[Options] API key saved');

        // Refresh AI status
        await updateAIStatus();
    } catch (error) {
        console.error('[Options] Error saving API key:', error);
        showStatus(apiKeyStatusDiv, 'Error due to storage issue.', 'error');
    }
}

/**
 * Clear API key from Chrome storage
 */
async function clearApiKey() {
    try {
        await chrome.storage.sync.remove(['geminiApiKey']);
        apiKeyInput.value = '';
        showStatus(apiKeyStatusDiv, 'API key cleared', 'show');
        console.log('[Options] API key cleared');

        // Refresh AI status
        await updateAIStatus();
    } catch (error) {
        console.error('[Options] Error clearing API key:', error);
        showStatus(apiKeyStatusDiv, 'Error clearing API key.', 'error');
    }
}

/**
 * Reset to default prompt
 */
function resetToDefault() {
    systemPromptTextarea.value = DEFAULT_PROMPT;
    updateCharCount();
    showStatus(statusDiv, 'Reset to default prompt', 'show');
}

/**
 * Apply a preset prompt
 */
function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (preset) {
        systemPromptTextarea.value = preset;
        updateCharCount();
        showStatus(statusDiv, `Applied "${presetName}" preset`, 'show');
    }
}

/**
 * Toggle API key visibility
 */
function toggleKeyVisibility() {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleKeyVisibilityBtn.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        toggleKeyVisibilityBtn.textContent = '👁️';
    }
}

/**
 * Update character count display
 */
function updateCharCount() {
    const count = systemPromptTextarea.value.length;
    charCountSpan.textContent = count.toLocaleString() + ' chars';
}

/**
 * Show status message with auto-hide
 */
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-msg show ${type || ''}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
        element.classList.remove('show');
    }, 3000);
}

// ============================================================
// WEBLLM HELPERS
// ============================================================

function updateWebLLMUI(mode) {
    // In grid layout, we always show the block, but maybe we disable it?
    // User requested "a square... for the web llm download settings", implies it's always there.
    // So we just check status.
    checkWebLLMStatus();
}

async function checkWebLLMStatus() {
    // Check GPU support
    if (!navigator.gpu) {
        webllmModelStatusSpan.textContent = 'Not Supported';
        webllmModelStatusSpan.style.color = 'var(--error)';
        btnDownloadWebllm.disabled = true;
        return;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            webllmModelStatusSpan.textContent = 'No WebGPU Adapter';
            webllmModelStatusSpan.style.color = 'var(--error)';
        }

        // Check if model is loaded/downloading via background
        chrome.runtime.sendMessage({ type: 'GET_WEBLLM_PROGRESS' }, (response) => {
            if (response && response.status) {
                updateDownloadUI(response);
            }
        });

    } catch (e) {
        webllmModelStatusSpan.textContent = 'Error Checking WebGPU';
    }
}

function startWebLLMDownload() {
    btnDownloadWebllm.disabled = true;
    webllmError.style.display = 'none';

    chrome.runtime.sendMessage({ type: 'START_WEBLLM_DOWNLOAD' }, (response) => {
        if (!response.success) {
            webllmError.textContent = 'Error starting download: ' + response.error;
            webllmError.style.display = 'block';
            btnDownloadWebllm.disabled = false;
        } else {
            // Start polling
            pollWebLLMProgress();
        }
    });
}

let pollingInterval = null;
function pollWebLLMProgress() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(() => {
        chrome.runtime.sendMessage({ type: 'GET_WEBLLM_PROGRESS' }, (response) => {
            updateDownloadUI(response);

            if (response.status === 'ready' || response.status === 'error') {
                clearInterval(pollingInterval);
            }
        });
    }, 500);
}

function updateDownloadUI(state) {
    if (state.status === 'downloading') {
        webllmProgressContainer.style.display = 'block';
        webllmProgressText.style.display = 'block';
        webllmProgressBar.style.width = (state.progress * 100) + '%';
        webllmProgressText.textContent = state.text;
        webllmModelStatusSpan.textContent = 'Downloading...';
        btnDownloadWebllm.style.display = 'none';
    } else if (state.status === 'ready') {
        webllmProgressContainer.style.display = 'none';
        webllmProgressText.style.display = 'none';
        webllmModelStatusSpan.textContent = 'Ready';
        webllmModelStatusSpan.style.color = 'var(--success)';
        btnDownloadWebllm.style.display = 'none';
    } else if (state.status === 'error') {
        webllmError.textContent = state.text;
        webllmError.style.display = 'block';
        btnDownloadWebllm.disabled = false;
        btnDownloadWebllm.style.display = 'inline-block';
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// System prompt buttons
saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetToDefault);
systemPromptTextarea.addEventListener('input', updateCharCount);

// API key buttons
saveApiKeyBtn.addEventListener('click', saveApiKey);
clearApiKeyBtn.addEventListener('click', clearApiKey);
toggleKeyVisibilityBtn.addEventListener('click', toggleKeyVisibility);

// Preset chip click handlers
presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const presetName = chip.dataset.preset;
        applyPreset(presetName);
    });
});

// Site Toggle Change Listeners
function setupSiteToggles() {
    const toggles = document.querySelectorAll('input[name="enabledSites"]');

    toggles.forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            // Get current state of all toggles
            const enabledSites = {};
            document.querySelectorAll('input[name="enabledSites"]').forEach(cb => {
                enabledSites[cb.value] = cb.checked;
            });

            // Save to storage
            await chrome.storage.sync.set({ enabledSites });
        });
    });
}

// AI Mode Change Listeners
document.querySelectorAll('input[name="aiMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        chrome.storage.sync.set({ aiMode: mode });
        updateWebLLMUI(mode);
        // Also refresh status
        updateAIStatus();
    });
});

// WebLLM Download Button
btnDownloadWebllm.addEventListener('click', startWebLLMDownload);

// Keyboard shortcut: Ctrl/Cmd + S to save
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveSettings();
    }
});

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Load saved settings
    await loadSettings();

    // Check and display AI status
    await updateAIStatus();

    // Setup listeners
    setupSiteToggles();
});

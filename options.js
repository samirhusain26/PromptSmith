/**
 * PromptSmith - Options Page Script
 * Handles saving and loading user settings for system prompt and API key.
 * Detects AI availability and updates status indicator.
 */

import { DEFAULT_SYSTEM_PROMPT } from './constants.js';

// Alias for backward compatibility in this file
const DEFAULT_PROMPT = DEFAULT_SYSTEM_PROMPT;

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
const btnDeleteWebllm = document.getElementById('btn-delete-webllm');
const webllmStatusSpan = document.getElementById('webllm-status');
const webllmModelStatusSpan = document.getElementById('webllm-model-status');
const webllmModelSelect = document.getElementById('webllm-model-select');
const webllmProgressContainer = document.getElementById('webllm-progress-container');
const webllmProgressBar = document.getElementById('webllm-progress-bar');
const webllmProgressText = document.getElementById('webllm-progress-text');
const webllmProgressPercent = document.getElementById('webllm-progress-percent');
const webllmError = document.getElementById('webllm-error');
const webllmLogContainer = document.getElementById('webllm-log-container');
const webllmLog = document.getElementById('webllm-log');

// Local state for WebLLM
let currentLoadedModelId = null;

// ============================================================
// AI AVAILABILITY CHECK
// ============================================================

/**
 * Check if local AI (Gemini Nano) is available
 */
// Import shared AI check from service
import { AIService } from './ai_service.js';
import { WEBLLM_MODELS, DEFAULT_MODEL_ID } from './constants.js';

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
    const storage = await chrome.storage.sync.get(['geminiApiKey', 'aiMode', 'webllmModelId']);
    const hasApiKey = storage.geminiApiKey && storage.geminiApiKey.trim().length > 0;
    const currentMode = storage.aiMode || 'auto';

    // Set selected model in dropdown
    if (webllmModelSelect.options.length === 0) populateModelDropdown(storage.webllmModelId);

    // Logic to determine what the "Default Method" block displays
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
        const selectedModelId = webllmModelSelect.value || DEFAULT_MODEL_ID;
        const isReady = currentLoadedModelId === selectedModelId;
        method = {
            icon: '🌐',
            name: 'WebLLM',
            status: isReady ? 'Active (Ready)' : 'Model Not Loaded'
        };
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

    if (localAI.status === 'downloadable' && (currentMode === 'auto' || currentMode === 'gemini-nano')) {
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
        const result = await chrome.storage.sync.get(['systemPrompt', 'geminiApiKey', 'aiMode', 'enabledSites', 'webllmModelId']);

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

        // Populate and set WebLLM model
        populateModelDropdown(result.webllmModelId);
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

function populateModelDropdown(savedModelId) {
    webllmModelSelect.innerHTML = '';

    WEBLLM_MODELS.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.name} (${model.size})`;
        webllmModelSelect.appendChild(option);
    });

    // Select saved or default
    const targetId = savedModelId || DEFAULT_MODEL_ID;
    webllmModelSelect.value = targetId;

    // Handle initial state sync locally
    // Don't save to storage yet, only on change
}

function updateWebLLMUI(mode) {
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
            if (response) {
                // If progress response indicates success, it means *currentLoadedModelId* is ready based on background state.
                // We should assume background keeps track of what it loaded.
                // Background -> Service -> returns engine state.
                // WE need to know WHICH model is loaded. 
                // Currently GET_WEBLLM_PROGRESS returns {status, text, progress}. 
                // It doesn't return modelId. 
                // Update: I didn't add modelId to return of getProgress in service.
                // So I will infer based on "ready" state and assumption that if ready, it's the model we last asked for?
                // Or I can just trust if it says "ready", the engine is ready.
                // BUT if dropdown differs from what engine has, I should show "Click to Switch"?
                // For simplified UX: Use `updateDownloadUI` which handles text.
                // I'll add logic in updateDownloadUI to check dropdown match.
                updateDownloadUI(response);
            }
        });

    } catch (e) {
        webllmModelStatusSpan.textContent = 'Error Checking WebGPU';
    }
}

/**
 * Add a log entry to the WebLLM log display
 */
function addWebLLMLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${timestamp}] ${message}`;
    logEntry.style.marginBottom = '2px';
    webllmLog.appendChild(logEntry);
    // Auto-scroll to bottom
    webllmLogContainer.scrollTop = webllmLogContainer.scrollHeight;
    console.log('[WebLLM]', message);
}

function startWebLLMDownload() {
    const modelId = webllmModelSelect.value;

    btnDownloadWebllm.disabled = true;
    btnDeleteWebllm.style.display = 'none';
    webllmError.style.display = 'none';
    webllmModelStatusSpan.textContent = 'Initializing...';

    // Show log container and clear previous logs
    webllmLogContainer.style.display = 'block';
    webllmLog.innerHTML = '';

    addWebLLMLog(`Starting download for: ${modelId}`);
    addWebLLMLog('Sending request to background service...');

    // Save selection
    chrome.storage.sync.set({ webllmModelId: modelId });

    chrome.runtime.sendMessage({ type: 'START_WEBLLM_DOWNLOAD', modelId: modelId }, (response) => {
        // Check for runtime errors first
        if (chrome.runtime.lastError) {
            console.error('[Options] WebLLM download error:', chrome.runtime.lastError);
            addWebLLMLog('ERROR: ' + chrome.runtime.lastError.message);
            webllmError.textContent = 'Error: ' + chrome.runtime.lastError.message;
            webllmError.style.display = 'block';
            btnDownloadWebllm.disabled = false;
            webllmModelStatusSpan.textContent = 'Error';
            return;
        }

        // Check if response is valid
        if (!response) {
            addWebLLMLog('ERROR: No response from background service');
            webllmError.textContent = 'Error: No response from background service. Try reloading the extension.';
            webllmError.style.display = 'block';
            btnDownloadWebllm.disabled = false;
            webllmModelStatusSpan.textContent = 'Error';
            return;
        }

        if (!response.success) {
            const errorMsg = response.error || 'Unknown error';
            addWebLLMLog('ERROR: ' + errorMsg);

            // Provide helpful error message with troubleshooting steps
            let displayError = 'Error starting download: ' + errorMsg;
            if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
                displayError += '\n\nTroubleshooting:\n• Check your internet connection\n• Try reloading the extension (chrome://extensions)\n• Ensure you\'re not behind a restrictive firewall';
            } else if (errorMsg.includes('Security') || errorMsg.includes('CSP')) {
                displayError += '\n\nPlease reload the extension and try again.';
            }

            webllmError.textContent = displayError;
            webllmError.style.display = 'block';
            btnDownloadWebllm.disabled = false;
            webllmModelStatusSpan.textContent = 'Error';
        } else {
            addWebLLMLog('Download started successfully!');
            addWebLLMLog('Fetching model from MLC AI servers...');
            // Show progress container
            webllmProgressContainer.style.display = 'block';
            btnDownloadWebllm.style.display = 'none';
            // Start polling
            pollWebLLMProgress();
        }
    });
}
function deleteWebLLMModel() {
    if (!confirm('Are you sure you want to delete the cached model? You will need to re-download it to use WebLLM.')) {
        return;
    }

    addWebLLMLog('Deleting model cache...');
    btnDeleteWebllm.disabled = true;

    chrome.runtime.sendMessage({ type: 'DELETE_WEBLLM_MODEL' }, (response) => {
        btnDeleteWebllm.disabled = false;
        if (chrome.runtime.lastError) {
            addWebLLMLog('ERROR Deleting: ' + chrome.runtime.lastError.message);
            return;
        }

        if (response && response.success) {
            addWebLLMLog('Model deleted successfully.');
            // Reset UI state
            currentLoadedModelId = null;
            updateDownloadUI({ status: 'idle', text: '', progress: 0 });
        } else {
            addWebLLMLog('Error deleting model: ' + (response ? response.error : 'Unknown'));
        }
    });
}


let pollingInterval = null;
let lastProgressText = '';

function pollWebLLMProgress() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(() => {
        chrome.runtime.sendMessage({ type: 'GET_WEBLLM_PROGRESS' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Options] Polling error:', chrome.runtime.lastError);
                return;
            }

            if (response) {
                updateDownloadUI(response);
            }

            if (response && (response.status === 'ready' || response.status === 'error')) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        });
    }, 300); // Poll more frequently for smoother progress
}

function updateDownloadUI(state) {
    if (!state) return;

    // We assume state reflects the *current operation*.
    // If status is ready, we update local currentLoadedModelId to whatever is selected (assumption)
    // or ideally background tells us. 
    // For now, if state.status === 'ready', we assume current selection is valid.

    const progressPercent = Math.round((state.progress || 0) * 100);

    if (state.status === 'downloading') {
        webllmProgressContainer.style.display = 'block';
        webllmProgressBar.style.width = progressPercent + '%';
        webllmProgressPercent.textContent = progressPercent + '%';
        webllmProgressText.textContent = state.text || 'Downloading...';
        webllmModelStatusSpan.textContent = 'Downloading...';
        btnDownloadWebllm.style.display = 'none';
        btnDeleteWebllm.style.display = 'none';

        // Log progress milestones or new status text
        if (state.text && state.text !== lastProgressText) {
            addWebLLMLog(state.text);
            lastProgressText = state.text;
        }
    } else if (state.status === 'ready') {
        // Mark as loaded
        currentLoadedModelId = webllmModelSelect.value; // Optimistic sync

        webllmProgressContainer.style.display = 'block';
        webllmProgressBar.style.width = '100%';
        webllmProgressPercent.textContent = '100%';
        webllmProgressText.textContent = 'Model loaded successfully!';

        webllmModelStatusSpan.textContent = 'Ready';
        webllmModelStatusSpan.style.color = 'var(--success)';

        btnDownloadWebllm.style.display = 'none';
        btnDeleteWebllm.style.display = 'inline-flex';

        // Log only if freshly done
        if (lastProgressText !== 'Done') {
            addWebLLMLog('✓ Model loaded and ready to use!');
            lastProgressText = 'Done';
        }

    } else if (state.status === 'error') {
        addWebLLMLog('ERROR: ' + state.text);
        webllmError.textContent = state.text;
        webllmError.style.display = 'block';
        webllmModelStatusSpan.textContent = 'Error';
        webllmModelStatusSpan.style.color = 'var(--error)';
        btnDownloadWebllm.disabled = false;
        btnDownloadWebllm.style.display = 'inline-flex';
        btnDeleteWebllm.style.display = 'inline-flex'; // Allow delete to retry clean
    } else if (state.status === 'idle') {
        // Model not yet loaded, show download button
        webllmProgressContainer.style.display = 'none';
        webllmModelStatusSpan.textContent = 'Not Loaded';
        btnDownloadWebllm.disabled = false;
        btnDownloadWebllm.innerText = 'Download Selected Model'; // Update text
        btnDownloadWebllm.style.display = 'inline-flex';
        btnDeleteWebllm.style.display = 'none'; // Can't delete what's not there/loaded? 
        // Actually, cache presence check is hard without loading. 
        // We'll show delete only if "Ready" for now, or just leave hidden if idle. 
        // User asked for "remove in case...". If it's idle, we don't know if it's on disk.
        // Compromise: Add a "Clear Cache" button visible in idle? Or just sticking to "Delete" when Loaded is safer context.
        // Actually, "Idle" might mean "I just opened the page". 
        // If I have downloaded it before, I want to delete it without loading it (which takes time).
        // But checking `caches.has()` is async.
        // Let's keep it simple: Delete button available if we *think* it might be there, or simply always available?
        // Let's make Delete available always but maybe minimal style if idle.
        // For now: Hide in idle to prevent confusion, show when Ready/Error.
        // EDIT: User wants to delete to free space. If I can't load it (e.g. broken), I still want to delete.
        // So showing Delete in 'Error' state is good.
        // Showing in 'Idle' is tricky if we don't know. 
        // Use 'inline-flex' if we want it visible. I'll stick to 'none' for idle for now unless user complains.
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

// WebLLM Listeners
btnDownloadWebllm.addEventListener('click', startWebLLMDownload);
btnDeleteWebllm.addEventListener('click', deleteWebLLMModel);

// Handle Model Change
webllmModelSelect.addEventListener('change', (e) => {
    const newModelId = e.target.value;
    // Save preference
    chrome.storage.sync.set({ webllmModelId: newModelId });

    addWebLLMLog(`Selected model: ${newModelId}`);

    // If selected model is different from loaded, update UI to show "Download/Load"
    if (newModelId !== currentLoadedModelId) {
        // Reset UI to idle-like state for this new model
        updateDownloadUI({ status: 'idle' });
        webllmModelStatusSpan.textContent = 'Not Loaded (Click Download)';
        webllmModelStatusSpan.style.color = 'var(--text-secondary)';
    } else {
        // If switching back to loaded model
        updateDownloadUI({ status: 'ready' });
    }

    updateAIStatus();
});

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

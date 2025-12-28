/**
 * PromptSmith - Options Page Script
 * Handles saving and loading user settings for system prompt and API key.
 * Detects AI availability and updates status indicator.
 */

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_GROQ_MODEL, DEFAULT_GEMINI_MODEL, CLOUD_MODELS, DEFAULT_CLOUD_PROVIDER, DEFAULT_PERSONA } from './constants.js';
import { PRESETS } from './prompts.js';

// Alias for backward compatibility in this file
const DEFAULT_PROMPT = DEFAULT_SYSTEM_PROMPT;

// DOM Elements
const systemPromptTextarea = document.getElementById('systemPrompt');
const charCountSpan = document.getElementById('charCount');
const saveBtn = document.getElementById('saveBtn');
const resetPersonaBtn = document.getElementById('resetPersonaBtn');
const statusDiv = document.getElementById('status');
const presetChips = document.querySelectorAll('.preset-chip');

// API Key elements
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibility');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
const apiKeyStatusDiv = document.getElementById('apiKeyStatus');

// Cloud Provider Toggle
const geminiSettingsDiv = document.getElementById('geminiSettings');
const groqSettingsDiv = document.getElementById('groqSettings');

// AI Status elements (New UI)
const activeMethodIcon = document.getElementById('activeMethodIcon');
const activeMethodName = document.getElementById('activeMethodName');
const activeMethodStatus = document.getElementById('activeMethodStatus');

// Mode Status Card elements (NEW)
const localStatusCard = document.getElementById('localStatusCard');
const localStatusIcon = document.getElementById('localStatusIcon');
const localStatusTitle = document.getElementById('localStatusTitle');
const localStatusSubtitle = document.getElementById('localStatusSubtitle');
const localSetupInstructions = document.getElementById('localSetupInstructions');
const cloudSettingsCard = document.getElementById('cloudSettingsCard');
const cloudProviderSelect = document.getElementById('cloudProviderSelect');
const cloudModelSelect = document.getElementById('cloudModelSelect');
const cloudApiKeyInput = document.getElementById('cloudApiKey');
const apiKeyLabel = document.getElementById('apiKeyLabel');
const getApiKeyLink = document.getElementById('getApiKeyLink');
const toggleCloudKeyVisibility = document.getElementById('toggleCloudKeyVisibility');
const saveCloudSettingsBtn = document.getElementById('saveCloudSettingsBtn');
const clearCloudSettingsBtn = document.getElementById('clearCloudSettingsBtn');
const cloudSettingsStatus = document.getElementById('cloudSettingsStatus');

// Cloud provider models configuration
const PROVIDER_CONFIG = {
    gemini: {
        keyLabel: 'Gemini API Key',
        keyPlaceholder: 'AIza...',
        keyPrefix: 'AIza',
        keyLink: 'https://aistudio.google.com/app/apikey',
        keyLinkText: 'Get Gemini API Key →'
    },
    groq: {
        keyLabel: 'Groq API Key',
        keyPlaceholder: 'gsk_...',
        keyPrefix: 'gsk_',
        keyLink: 'https://console.groq.com/keys',
        keyLinkText: 'Get Groq API Key →'
    }
};

// ============================================================
// AI AVAILABILITY CHECK
// ============================================================

import { AIService } from './ai_service.js';

/**
 * Determine the default AI mode based on availability
 * Priority: API key → cloud, Nano available (no API) → local, Neither → cloud (default fallback)
 * @returns {Promise<string>} - 'cloud' or 'local'
 */
async function determineDefaultAIMode() {
    const storage = await chrome.storage.sync.get(['geminiApiKey', 'groqApiKey']);
    const hasApiKey = (storage.geminiApiKey && storage.geminiApiKey.trim().length > 0) ||
        (storage.groqApiKey && storage.groqApiKey.trim().length > 0);

    const localAI = await AIService.checkLocalAIAvailability();
    const hasNano = localAI.available;

    if (hasApiKey) {
        return 'cloud';
    } else if (hasNano) {
        return 'local';
    } else {
        return 'cloud'; // Default fallback
    }
}

/**
 * Update the AI status display in the UI
 */
async function updateAIStatus() {
    const localAI = await AIService.checkLocalAIAvailability();
    const storage = await chrome.storage.sync.get(['geminiApiKey', 'groqApiKey', 'aiMode', 'cloudProvider', 'cloudModel']);
    const currentMode = storage.aiMode || 'cloud';

    let method = {
        icon: '⚠️',
        name: 'No AI Available',
        status: 'Please configure settings'
    };

    if (currentMode === 'local') {
        if (localAI.available) {
            method = { icon: '⚡', name: 'Local Only', status: 'Gemini Nano Active' };
        } else {
            method = { icon: '❌', name: 'Local Only', status: 'Nano Unavailable' };
        }
    } else if (currentMode === 'cloud') {
        const cloudProvider = storage.cloudProvider || DEFAULT_CLOUD_PROVIDER;
        const hasGeminiKey = storage.geminiApiKey && storage.geminiApiKey.trim().length > 0;
        const hasGroqKey = storage.groqApiKey && storage.groqApiKey.trim().length > 0;

        method = { icon: '☁️', name: 'Cloud Only', status: 'Active' };

        if (cloudProvider === 'groq') {
            if (hasGroqKey) {
                method.status = 'Groq Cloud Active';
            } else {
                method.status = 'Groq Key Required';
                method.icon = '❌';
            }
        } else {
            // Gemini Cloud
            if (hasGeminiKey) {
                method.status = 'Gemini Flash Active';
            } else {
                method.status = 'API Key Required';
                method.icon = '❌';
            }
        }
    }

    if (activeMethodIcon) activeMethodIcon.textContent = method.icon;
    if (activeMethodName) activeMethodName.textContent = method.name;
    if (activeMethodStatus) activeMethodStatus.textContent = method.status;

    updateModeStatusCards(currentMode, localAI, storage);
}

/**
 * Update the mode status cards based on current AI mode
 */
async function updateModeStatusCards(currentMode, localAI, storage) {
    if (!localStatusCard || !cloudSettingsCard) return;

    if (currentMode === 'local') {
        localStatusCard.style.display = 'block';
        cloudSettingsCard.style.display = 'none';

        if (localAI.available) {
            localStatusCard.classList.remove('not-ready');
            localStatusCard.classList.add('ready');
            localStatusIcon.textContent = '✅';
            localStatusTitle.textContent = 'Gemini Nano Ready';
            localStatusSubtitle.textContent = 'On-device AI is active and ready to use';
            localSetupInstructions.style.display = 'none';
        } else {
            localStatusCard.classList.remove('ready');
            localStatusCard.classList.add('not-ready');
            localStatusIcon.textContent = '⚠️';
            localStatusTitle.textContent = 'Gemini Nano Not Available';
            localStatusSubtitle.textContent = localAI.reason || 'Setup required to use on-device AI';
            localSetupInstructions.style.display = 'block';
        }
    } else if (currentMode === 'cloud') {
        localStatusCard.style.display = 'none';
        cloudSettingsCard.style.display = 'flex';

        const cloudProvider = storage.cloudProvider || DEFAULT_CLOUD_PROVIDER;
        const defaultModel = cloudProvider === 'groq' ? DEFAULT_GROQ_MODEL : DEFAULT_GEMINI_MODEL;
        const cloudModel = storage.cloudModel || defaultModel;

        if (cloudProviderSelect) {
            cloudProviderSelect.value = cloudProvider;
        }

        updateCloudProvider(cloudProvider, cloudModel);

        if (cloudModelSelect && cloudModelSelect.value !== cloudModel) {
            chrome.storage.sync.set({ cloudModel: cloudModelSelect.value });
        }

        if (cloudProvider === 'gemini' && storage.geminiApiKey) {
            cloudApiKeyInput.value = storage.geminiApiKey;
        } else if (cloudProvider === 'groq' && storage.groqApiKey) {
            cloudApiKeyInput.value = storage.groqApiKey;
        } else {
            cloudApiKeyInput.value = '';
        }
    } else {
        localStatusCard.style.display = 'none';
        cloudSettingsCard.style.display = 'none';
    }
}

/**
 * Update cloud provider settings (models dropdown, API key label, etc)
 */
function updateCloudProvider(provider, selectedModel = null) {
    const config = PROVIDER_CONFIG[provider];
    const models = CLOUD_MODELS[provider];

    if (cloudModelSelect) {
        cloudModelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            cloudModelSelect.appendChild(option);
        });

        if (selectedModel && models.some(m => m.value === selectedModel)) {
            cloudModelSelect.value = selectedModel;
        }
    }

    if (apiKeyLabel) apiKeyLabel.textContent = config.keyLabel;
    if (cloudApiKeyInput) {
        cloudApiKeyInput.placeholder = config.keyPlaceholder;
    }
    if (getApiKeyLink) {
        getApiKeyLink.href = config.keyLink;
        getApiKeyLink.textContent = config.keyLinkText;
    }

    loadProviderApiKey(provider);
}

/**
 * Load API key for the specified provider
 */
async function loadProviderApiKey(provider) {
    const storage = await chrome.storage.sync.get(['geminiApiKey', 'groqApiKey']);
    if (provider === 'gemini' && storage.geminiApiKey) {
        cloudApiKeyInput.value = storage.geminiApiKey;
    } else if (provider === 'groq' && storage.groqApiKey) {
        cloudApiKeyInput.value = storage.groqApiKey;
    }
}

// ============================================================
// SETTINGS MANAGEMENT
// ============================================================

/**
 * Get the prompt to display for a given persona
 */
function getPromptForPersona(personaName, customPrompts = {}) {
    if (customPrompts[personaName]) {
        return customPrompts[personaName];
    }
    if (personaName === 'custom') {
        return `[Enter your custom system prompt here]\n\nTips:\n- Define the AI's role and task clearly\n- Add constraints (what NOT to do)\n- Specify the output format you want`;
    }
    if (PRESETS[personaName]) {
        return PRESETS[personaName];
    }
    return DEFAULT_PROMPT;
}

/**
 * Load saved settings from Chrome storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['systemPrompt', 'geminiApiKey', 'aiMode', 'enabledSites', 'activePersona', 'customPersonaPrompts', 'cloudProvider', 'groqApiKey']);

        const activePersona = result.activePersona || DEFAULT_PERSONA;
        window.currentActivePersona = activePersona;
        window.customPersonaPrompts = result.customPersonaPrompts || {};

        const savedPrompt = getPromptForPersona(activePersona, window.customPersonaPrompts);
        systemPromptTextarea.value = savedPrompt;
        updateCharCount();
        updatePresetChipHighlight(activePersona);

        if (apiKeyInput && result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }

        let savedMode = result.aiMode;
        if (!savedMode || savedMode === 'hybrid' || savedMode === 'auto') {
            savedMode = await determineDefaultAIMode();
            await chrome.storage.sync.set({ aiMode: savedMode });
        }

        updateToggleUI(savedMode);

        const enabledSites = result.enabledSites || { chatgpt: true, claude: true, gemini: true };
        document.querySelectorAll('input[name="enabledSites"]').forEach(checkbox => {
            checkbox.checked = enabledSites[checkbox.value] !== false;
        });

        const cloudProvider = result.cloudProvider || DEFAULT_CLOUD_PROVIDER;
        updateProviderUI(cloudProvider);

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
        const activePersona = window.currentActivePersona || DEFAULT_PERSONA;
        const customPersonaPrompts = window.customPersonaPrompts || {};
        customPersonaPrompts[activePersona] = systemPrompt;
        window.customPersonaPrompts = customPersonaPrompts;

        await chrome.storage.sync.set({
            activePersona,
            customPersonaPrompts
        });

        updatePresetChipHighlight(activePersona);

        const personaLabel = activePersona.charAt(0).toUpperCase() + activePersona.slice(1);
        showStatus(statusDiv, `✓ Custom ${personaLabel} prompt saved!`, 'show');
    } catch (error) {
        showStatus(statusDiv, 'Error saving settings.', 'error');
    }
}

/**
 * Save API key to Chrome storage (Legacy Button Handler)
 */
async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showStatus(apiKeyStatusDiv, 'Please enter an API key', 'error');
        return;
    }
    if (!apiKey.startsWith('AIza')) {
        showStatus(apiKeyStatusDiv, 'Invalid API key format. Keys typically start with "AIza"', 'error');
        return;
    }
    try {
        await chrome.storage.sync.set({ geminiApiKey: apiKey });
        showStatus(apiKeyStatusDiv, '✓ API key saved!', 'show');
        await updateAIStatus();
    } catch (error) {
        showStatus(apiKeyStatusDiv, 'Error due to storage issue.', 'error');
    }
}

/**
 * Clear API key from Chrome storage (Legacy Button Handler)
 */
async function clearApiKey() {
    try {
        await chrome.storage.sync.remove(['geminiApiKey']);
        apiKeyInput.value = '';
        showStatus(apiKeyStatusDiv, 'API key cleared', 'show');
        await updateAIStatus();
    } catch (error) {
        showStatus(apiKeyStatusDiv, 'Error clearing API key.', 'error');
    }
}

/**
 * Update Provider UI (Toggle and Section Visibility)
 */
function updateProviderUI(provider) {
    const options = document.querySelectorAll('#cloudProviderToggle .toggle-option');
    options.forEach(opt => {
        const value = opt.dataset.value;
        const settingsDiv = document.getElementById(`settings-${value}`);

        if (value === provider) {
            opt.classList.add('active');
            if (settingsDiv) settingsDiv.style.display = 'block';
        } else {
            opt.classList.remove('active');
            if (settingsDiv) settingsDiv.style.display = 'none';
        }
    });
}

/**
 * Setup Cloud Provider Toggle
 */
function setupCloudProviderToggle() {
    if (cloudProviderSelect) {
        cloudProviderSelect.addEventListener('change', async () => {
            const provider = cloudProviderSelect.value;
            const storage = await chrome.storage.sync.get(['geminiModel', 'groqModel']);

            let targetModel = null;
            if (provider === 'gemini') targetModel = storage.geminiModel || DEFAULT_GEMINI_MODEL;
            if (provider === 'groq') targetModel = storage.groqModel || DEFAULT_GROQ_MODEL;

            updateCloudProvider(provider, targetModel);

            const newModel = cloudModelSelect.value;
            await chrome.storage.sync.set({
                cloudProvider: provider,
                cloudModel: newModel
            });
            await updateAIStatus();
        });
    }

    if (cloudModelSelect) {
        cloudModelSelect.addEventListener('change', async () => {
            const model = cloudModelSelect.value;
            await chrome.storage.sync.set({ cloudModel: model });
        });
    }

    if (saveCloudSettingsBtn) {
        saveCloudSettingsBtn.addEventListener('click', saveCloudSettings);
    }

    if (clearCloudSettingsBtn) {
        clearCloudSettingsBtn.addEventListener('click', clearCloudSettings);
    }

    if (toggleCloudKeyVisibility) {
        toggleCloudKeyVisibility.addEventListener('click', () => {
            if (cloudApiKeyInput.type === 'password') {
                cloudApiKeyInput.type = 'text';
                toggleCloudKeyVisibility.textContent = '🙈';
            } else {
                cloudApiKeyInput.type = 'password';
                toggleCloudKeyVisibility.textContent = '👁️';
            }
        });
    }
}

/**
 * Save cloud settings
 */
async function saveCloudSettings() {
    const provider = cloudProviderSelect ? cloudProviderSelect.value : DEFAULT_CLOUD_PROVIDER;
    const defaultModel = provider === 'groq' ? DEFAULT_GROQ_MODEL : DEFAULT_GEMINI_MODEL;
    const model = cloudModelSelect ? cloudModelSelect.value : defaultModel;
    const apiKey = cloudApiKeyInput ? cloudApiKeyInput.value.trim() : '';
    const config = PROVIDER_CONFIG[provider];

    if (!apiKey) {
        showStatus(cloudSettingsStatus, 'Please enter an API key', 'error');
        return;
    }

    if (!apiKey.startsWith(config.keyPrefix)) {
        showStatus(cloudSettingsStatus, `Warning: ${provider === 'gemini' ? 'Gemini' : 'Groq'} keys usually start with "${config.keyPrefix}"`, 'error');
    }

    try {
        const saveData = { cloudProvider: provider, cloudModel: model };
        if (provider === 'gemini') {
            saveData.geminiApiKey = apiKey;
            saveData.geminiModel = model;
        } else if (provider === 'groq') {
            saveData.groqApiKey = apiKey;
            saveData.groqModel = model;
        }

        await chrome.storage.sync.set(saveData);
        await chrome.storage.sync.set({ aiMode: 'cloud' });

        updateToggleUI('cloud');
        showStatus(cloudSettingsStatus, '✓ Cloud settings saved! Mode set to Cloud.', 'show');
        await updateAIStatus();
    } catch (error) {
        showStatus(cloudSettingsStatus, 'Error saving settings.', 'error');
    }
}

/**
 * Clear cloud settings
 */
async function clearCloudSettings() {
    const provider = cloudProviderSelect ? cloudProviderSelect.value : DEFAULT_CLOUD_PROVIDER;
    try {
        if (provider === 'gemini') {
            await chrome.storage.sync.remove(['geminiApiKey']);
        } else if (provider === 'groq') {
            await chrome.storage.sync.remove(['groqApiKey', 'groqModel']);
        }

        cloudApiKeyInput.value = '';

        const newMode = await determineDefaultAIMode();
        await chrome.storage.sync.set({ aiMode: newMode });
        updateToggleUI(newMode);

        const modeLabel = newMode === 'local' ? 'Local' : 'Cloud';
        showStatus(cloudSettingsStatus, `${provider === 'gemini' ? 'Gemini' : 'Groq'} key cleared. Mode set to ${modeLabel}.`, 'show');
        await updateAIStatus();
    } catch (error) {
        showStatus(cloudSettingsStatus, 'Error clearing settings.', 'error');
    }
}

/**
 * Reset to the currently active persona's default prompt
 */
async function resetToPersonaDefault() {
    const activePersona = window.currentActivePersona || DEFAULT_PERSONA;
    const customPersonaPrompts = window.customPersonaPrompts || {};
    delete customPersonaPrompts[activePersona];
    window.customPersonaPrompts = customPersonaPrompts;

    const defaultPrompt = getPromptForPersona(activePersona, {});
    systemPromptTextarea.value = defaultPrompt;
    updateCharCount();

    await chrome.storage.sync.set({
        activePersona: activePersona,
        customPersonaPrompts
    });

    updatePresetChipHighlight(activePersona);

    const personaLabel = activePersona.charAt(0).toUpperCase() + activePersona.slice(1);
    showStatus(statusDiv, `Reset to ${personaLabel} default`, 'show');
}

/**
 * Apply a preset prompt
 */
async function applyPreset(presetName) {
    if (!PRESETS[presetName]) return;

    const customPersonaPrompts = window.customPersonaPrompts || {};
    const promptToApply = getPromptForPersona(presetName, customPersonaPrompts);

    systemPromptTextarea.value = promptToApply;
    updateCharCount();

    window.currentActivePersona = presetName;
    await chrome.storage.sync.set({ activePersona: presetName });
    updatePresetChipHighlight(presetName);

    if (customPersonaPrompts[presetName]) {
        showStatus(statusDiv, `Loaded custom "${presetName}" prompt`, 'show');
    } else {
        showStatus(statusDiv, `Applied "${presetName}" preset`, 'show');
    }
}

function updatePresetChipHighlight(activePersona) {
    if (activePersona) window.currentActivePersona = activePersona;
    presetChips.forEach(chip => {
        const presetName = chip.dataset.preset;
        if (presetName === activePersona) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function toggleKeyVisibility() {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleKeyVisibilityBtn.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        toggleKeyVisibilityBtn.textContent = '👁️';
    }
}

function updateCharCount() {
    const count = systemPromptTextarea.value.length;
    charCountSpan.textContent = count.toLocaleString() + ' chars';
}

function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-msg show ${type || ''}`;
    setTimeout(() => {
        element.classList.remove('show');
    }, 3000);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

if (saveBtn) saveBtn.addEventListener('click', saveSettings);
if (resetPersonaBtn) resetPersonaBtn.addEventListener('click', resetToPersonaDefault);
if (systemPromptTextarea) systemPromptTextarea.addEventListener('input', updateCharCount);

// Legacy API key buttons
if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', saveApiKey);
if (clearApiKeyBtn) clearApiKeyBtn.addEventListener('click', clearApiKey);
if (toggleKeyVisibilityBtn) toggleKeyVisibilityBtn.addEventListener('click', toggleKeyVisibility);

setupCloudProviderToggle();

presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const presetName = chip.dataset.preset;
        applyPreset(presetName);
    });
});

function setupSiteToggles() {
    const toggles = document.querySelectorAll('input[name="enabledSites"]');
    toggles.forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            const enabledSites = {};
            document.querySelectorAll('input[name="enabledSites"]').forEach(cb => {
                enabledSites[cb.value] = cb.checked;
            });
            await chrome.storage.sync.set({ enabledSites });
        });
    });
}

function setupAIModeToggle() {
    const toggleOptions = document.querySelectorAll('#aiModeToggle .toggle-option');
    toggleOptions.forEach(option => {
        option.addEventListener('click', () => {
            const mode = option.dataset.value;
            updateToggleUI(mode);
            chrome.storage.sync.set({ aiMode: mode });
            updateAIStatus();
        });
    });
}

function updateToggleUI(mode) {
    const toggleOptions = document.querySelectorAll('#aiModeToggle .toggle-option');
    toggleOptions.forEach(opt => {
        if (opt.dataset.value === mode) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveSettings();
    }
});

// ============================================================
// PROMPT HISTORY MODULE
// ============================================================

const historyHeader = document.getElementById('history-header');
const historyToggle = document.getElementById('history-toggle');
const historyContent = document.getElementById('history-content');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const clearHistoryBtn = document.getElementById('clear-history-btn');

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function getModeInfo(mode) {
    switch (mode) {
        case 'local': return { class: 'local', text: '⚡ Local Nano' };
        case 'cloud': default: return { class: 'cloud', text: '☁️ Cloud' };
    }
}

function renderHistoryEntry(entry) {
    const modeInfo = getModeInfo(entry.mode);
    const div = document.createElement('div');
    div.className = 'history-entry';

    div.innerHTML = `
        <div class="history-entry-header">
            <span class="history-timestamp">${formatTimestamp(entry.timestamp)}</span>
            <span class="history-mode-badge ${modeInfo.class}">${modeInfo.text}</span>
        </div>
        <div class="history-section">
            <div class="history-section-label">User Input</div>
            <div class="history-section-content" data-expandable="true">${escapeHtml(entry.userInput)}</div>
            <button class="history-expand-btn" style="display: none;">Show more</button>
        </div>
        <div class="history-section">
            <div class="history-section-label">System Prompt</div>
            <div class="history-section-content" data-expandable="true">${escapeHtml(entry.systemPrompt)}</div>
            <button class="history-expand-btn" style="display: none;">Show more</button>
        </div>
        ${entry.polishedOutput ? `
        <div class="history-section">
            <div class="history-section-label">Polished Output</div>
            <div class="history-section-content" data-expandable="true">${escapeHtml(entry.polishedOutput)}</div>
            <button class="history-expand-btn" style="display: none;">Show more</button>
        </div>
        ` : ''}
    `;

    div.querySelectorAll('[data-expandable="true"]').forEach(content => {
        const btn = content.nextElementSibling;
        setTimeout(() => {
            if (content.scrollHeight > content.clientHeight + 10) {
                btn.style.display = 'block';
                btn.addEventListener('click', () => {
                    content.classList.toggle('expanded');
                    btn.textContent = content.classList.contains('expanded') ? 'Show less' : 'Show more';
                });
            }
        }, 0);
    });

    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

async function loadPromptHistory() {
    try {
        const result = await chrome.storage.local.get(['promptHistory']);
        const history = result.promptHistory || [];
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyEmpty.style.display = 'block';
            clearHistoryBtn.style.display = 'none';
        } else {
            historyEmpty.style.display = 'none';
            clearHistoryBtn.style.display = 'inline-flex';
            history.forEach(entry => historyList.appendChild(renderHistoryEntry(entry)));
        }
    } catch (error) {
        historyEmpty.style.display = 'block';
    }
}

async function clearPromptHistory() {
    if (!confirm('Are you sure you want to clear all prompt history?')) return;
    try {
        await chrome.storage.local.set({ promptHistory: [] });
        await loadPromptHistory();
    } catch (error) { }
}

function toggleHistorySection() {
    historyContent.classList.toggle('collapsed');
    historyToggle.classList.toggle('collapsed');
}

if (historyHeader) historyHeader.addEventListener('click', toggleHistorySection);
if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearPromptHistory);

// ============================================================
// ONBOARDING MODULE
// ============================================================

const onboardingOverlay = document.getElementById('onboarding-overlay');
const onboardingContent = document.getElementById('onboarding-content');
const progressDotsContainer = document.getElementById('progress-dots');
const prevStepBtn = document.getElementById('prev-step');
const nextStepBtn = document.getElementById('next-step');
const skipOnboardingBtn = document.getElementById('skip-onboarding');
const skipWarningOverlay = document.getElementById('skip-warning-overlay');
const warningGoBackBtn = document.getElementById('warning-go-back');
const warningContinueBtn = document.getElementById('warning-continue');

const ONBOARDING_STEPS = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'setup', title: 'Configure AI' },
    { id: 'nano', title: 'Local AI Setup' },
    { id: 'demo', title: 'See It In Action' },
    { id: 'ready', title: 'All Set!' }
];
let currentOnboardingStep = 0;
let onboardingState = { provider: 'groq', apiKey: '', model: '' };

function showOnboarding() {
    onboardingOverlay.style.display = 'flex';
    renderProgressDots();
    goToStep(0);
}

function hideOnboarding() {
    onboardingOverlay.style.display = 'none';
}

function renderProgressDots() {
    progressDotsContainer.innerHTML = '';
    ONBOARDING_STEPS.forEach((step, index) => {
        const dot = document.createElement('div');
        dot.className = 'progress-dot';
        if (index < currentOnboardingStep) dot.classList.add('completed');
        if (index === currentOnboardingStep) dot.classList.add('active');
        progressDotsContainer.appendChild(dot);
    });
}

function goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= ONBOARDING_STEPS.length) return;
    currentOnboardingStep = stepIndex;
    renderProgressDots();
    renderStepContent(ONBOARDING_STEPS[stepIndex].id);
    prevStepBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
    nextStepBtn.textContent = (stepIndex === ONBOARDING_STEPS.length - 1) ? 'Start Polishing! ✨' : 'Next →';
}

function renderStepContent(stepId) {
    let html = '';
    switch (stepId) {
        case 'welcome':
            html = `
                <div class="step-content">
                    <h2 class="step-title">Thank you for installing PromptSmith! ✨</h2>
                    <p class="step-subtitle">Privacy-first AI prompt refinement for ChatGPT, Claude, and Gemini.</p>
                    <div class="feature-grid">
                        <div class="feature-card"><div class="feature-icon">🧠</div><div class="feature-title">Smart AI Mode</div><div class="feature-desc">Auto-switches: Cloud API for speed, Local Nano for privacy.</div></div>
                        <div class="feature-card"><div class="feature-icon">☁️</div><div class="feature-title">Multi-Provider</div><div class="feature-desc">Support for Google Gemini and Groq Cloud APIs.</div></div>
                         <div class="feature-card"><div class="feature-icon">⚡</div><div class="feature-title">Local Fallback</div><div class="feature-desc">Works offline with Chrome's built-in Gemini Nano.</div></div>
                    </div>
                </div>`;
            break;
        case 'setup':
            const isGroq = onboardingState.provider === 'groq';
            html = `
                <div class="step-content">
                    <h2 class="step-title">Configure Your Cloud AI</h2>
                    <p class="step-subtitle">Choose your preferred Cloud AI provider.</p>
                    <div class="setup-input-group">
                        <label for="onboarding-provider">Cloud Provider</label>
                        <select id="onboarding-provider" class="dropdown-select" style="margin-bottom: 1rem;">
                            <option value="groq" ${isGroq ? 'selected' : ''}>Groq (Free, No Card)</option>
                            <option value="gemini" ${!isGroq ? 'selected' : ''}>Gemini (Free, May Need Card)</option>
                        </select>
                    </div>
                    <div class="setup-input-group">
                        <label for="onboarding-api-key">API Key</label>
                        <input type="password" id="onboarding-api-key" placeholder="${isGroq ? 'gsk_...' : 'AIza...'}" value="${onboardingState.apiKey}" spellcheck="false">
                        <p class="setup-hint" id="api-key-hint">Get a free API key from <a href="${isGroq ? 'https://console.groq.com/keys' : 'https://aistudio.google.com/app/apikey'}" target="_blank" id="api-key-link">${isGroq ? 'Groq Console' : 'Google AI Studio'}</a></p>
                    </div>
                    <div class="recommendation-box" style="margin-top: 1rem;">
                        <h4>ℹ️ Getting an API Key</h4>
                        <ul style="font-size: 0.85rem; color: var(--text-secondary); padding-left: 1.25rem; margin-top: 0.5rem;">
                            <li id="groq-note" style="${isGroq ? '' : 'display:none;'}"><strong>Groq:</strong> Requires an account, but <strong>NO credit card</strong> is needed.</li>
                            <li id="gemini-note" style="${!isGroq ? '' : 'display:none;'}"><strong>Gemini:</strong> Requires a Google cloud account and <strong>may ask for a credit card</strong>.</li>
                        </ul>
                    </div>
                </div>`;
            setTimeout(() => {
                const providerSelect = document.getElementById('onboarding-provider');
                const apiKeyInput = document.getElementById('onboarding-api-key');
                const apiKeyLink = document.getElementById('api-key-link');
                const groqNote = document.getElementById('groq-note');
                const geminiNote = document.getElementById('gemini-note');

                if (providerSelect) {
                    providerSelect.addEventListener('change', (e) => {
                        const provider = e.target.value;
                        onboardingState.provider = provider;
                        if (provider === 'groq') {
                            apiKeyInput.placeholder = 'gsk_...';
                            apiKeyLink.href = 'https://console.groq.com/keys';
                            apiKeyLink.textContent = 'Groq Console';
                            groqNote.style.display = 'list-item';
                            geminiNote.style.display = 'none';
                        } else {
                            apiKeyInput.placeholder = 'AIza...';
                            apiKeyLink.href = 'https://aistudio.google.com/app/apikey';
                            apiKeyLink.textContent = 'Google AI Studio';
                            groqNote.style.display = 'none';
                            geminiNote.style.display = 'list-item';
                        }
                    });
                }
                if (apiKeyInput) apiKeyInput.addEventListener('input', (e) => onboardingState.apiKey = e.target.value);
            }, 0);
            break;
        case 'nano':
            html = `
                <div class="step-content">
                    <h2 class="step-title">Enable Gemini Nano (Optional)</h2>
                    <p class="step-subtitle">Run AI completely on your device.</p>
                    <div class="nano-setup-steps">
                        <div class="nano-step"><div class="nano-step-number">1</div><div class="nano-step-content"><h4>Enable Chrome Flags</h4><p>Open <code>chrome://flags</code> <button class="copy-btn nano-copy-btn" data-copy="chrome://flags" title="Copy URL">📋</button></p><ul class="nano-flags-list"><li><code>#optimization-guide-on-device-model</code> → <strong>Enabled BypassPerfRequirement</strong></li><li><code>#prompt-api-for-gemini-nano</code> → <strong>Enabled</strong></li></ul></div></div>
                        <div class="nano-step"><div class="nano-step-number">2</div><div class="nano-step-content"><h4>Relaunch Chrome</h4><p>Click the <strong>Relaunch</strong> button that appears at the bottom of the flags page.</p></div></div>
                        <div class="nano-step"><div class="nano-step-number">3</div><div class="nano-step-content"><h4>Download the Model</h4><p>Go to <code>chrome://components</code> <button class="copy-btn nano-copy-btn" data-copy="chrome://components" title="Copy URL">📋</button></p><p>Find <strong>"Optimization Guide On Device Model"</strong> and click <strong>"Check for update"</strong>.</p></div></div>
                    </div>
                </div>`;
            setTimeout(() => {
                document.querySelectorAll('.nano-copy-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const text = btn.dataset.copy;
                        if (text) await navigator.clipboard.writeText(text);
                    });
                });
            }, 0);
            break;
        case 'demo':
            html = `<div class="step-content"><h2 class="step-title">See It In Action</h2><p class="step-subtitle">Watch how PromptSmith polishes your prompts.</p><div class="demo-video-container"><video id="demo-video" controls autoplay muted loop playsinline><source src="usage.mov" type="video/quicktime"><source src="usage.mov" type="video/mp4"></video></div></div>`;
            break;
        case 'ready':
            html = `<div class="step-content" style="text-align: center;"><div class="ready-icon">🎉</div><h2 class="step-title">You're All Set!</h2><p class="step-subtitle">PromptSmith is ready to polish your prompts.</p><div class="tips-list"><div class="tip-item"><span class="tip-icon">✨</span><span class="tip-text">Look for the <strong>Polish</strong> button</span></div></div></div>`;
            break;
    }
    onboardingContent.innerHTML = html;
}

async function handleNextStep() {
    const currentStepId = ONBOARDING_STEPS[currentOnboardingStep].id;
    if (currentStepId === 'setup') {
        const apiKey = onboardingState.apiKey.trim();
        const provider = onboardingState.provider;
        if (apiKey) {
            const saveData = {
                cloudProvider: provider,
                aiMode: 'cloud'
            };
            if (provider === 'gemini') {
                saveData.geminiApiKey = apiKey;
                saveData.geminiModel = DEFAULT_GEMINI_MODEL;
                saveData.cloudModel = DEFAULT_GEMINI_MODEL;
            } else {
                saveData.groqApiKey = apiKey;
                saveData.groqModel = DEFAULT_GROQ_MODEL;
                saveData.cloudModel = DEFAULT_GROQ_MODEL;
            }
            await chrome.storage.sync.set(saveData);
        }
    }
    if (currentOnboardingStep < ONBOARDING_STEPS.length - 1) {
        goToStep(currentOnboardingStep + 1);
    } else {
        await completeOnboarding();
    }
}

function handlePrevStep() {
    if (currentOnboardingStep > 0) goToStep(currentOnboardingStep - 1);
}

function showSkipWarning() { skipWarningOverlay.style.display = 'flex'; }
function hideSkipWarning() { skipWarningOverlay.style.display = 'none'; }

async function completeOnboarding() {
    await chrome.storage.sync.set({ hasCompletedOnboarding: true });
    hideOnboarding();
    await loadSettings();
    await updateAIStatus();
}

if (nextStepBtn) nextStepBtn.addEventListener('click', handleNextStep);
if (prevStepBtn) prevStepBtn.addEventListener('click', handlePrevStep);
if (skipOnboardingBtn) skipOnboardingBtn.addEventListener('click', showSkipWarning);
if (warningGoBackBtn) warningGoBackBtn.addEventListener('click', hideSkipWarning);
if (warningContinueBtn) warningContinueBtn.addEventListener('click', async () => {
    hideSkipWarning();
    await completeOnboarding();
});

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const { hasCompletedOnboarding } = await chrome.storage.sync.get(['hasCompletedOnboarding']);
    if (!hasCompletedOnboarding) showOnboarding();
    await loadSettings();
    await updateAIStatus();
    await loadPromptHistory();
    setupSiteToggles();
    setupAIModeToggle();
    setupCopyButtons();
});

function setupCopyButtons() {
    document.querySelectorAll('.copy-url-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const text = btn.dataset.copy;
            if (!text) return;
            await navigator.clipboard.writeText(text);
            const originalContent = btn.innerHTML;
            btn.innerHTML = '✓';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.classList.remove('copied');
            }, 1500);
        });
    });
}

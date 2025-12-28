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

// Groq Key elements
const groqApiKeyInput = document.getElementById('groqApiKey');
const groqModelInput = document.getElementById('groqModel');
const toggleGroqKeyVisibilityBtn = document.getElementById('toggleGroqKeyVisibility');
const saveGroqSettingsBtn = document.getElementById('saveGroqSettingsBtn');
const clearGroqSettingsBtn = document.getElementById('clearGroqSettingsBtn');
const groqStatusDiv = document.getElementById('groqStatus');

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
// Cloud provider models configuration imported from constants.js

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

/**
 * Check if local AI (Gemini Nano) is available
 */
// Import shared AI check from service
import { AIService } from './ai_service.js';

// Remove wrapper function checkLocalAIAvailability

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

    console.log('[Options] Smart mode detection - hasApiKey:', hasApiKey, 'hasNano:', hasNano);

    // Priority: API key available → cloud
    // Nano available (no API key) → local
    // Neither → cloud (default, prompts user to configure)
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
    // Check local AI availability
    const localAI = await AIService.checkLocalAIAvailability();

    // Check if API key is configured
    const storage = await chrome.storage.sync.get(['geminiApiKey', 'groqApiKey', 'aiMode', 'cloudProvider', 'cloudModel']);
    const hasApiKey = storage.geminiApiKey && storage.geminiApiKey.trim().length > 0;
    const currentMode = storage.aiMode || 'cloud';

    // Logic to determine what the "Default Method" block displays
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
        if (hasApiKey) {
            method = { icon: '☁️', name: 'Cloud Only', status: 'Cloud Active' };
        } else {
            method = { icon: '❌', name: 'Cloud Only', status: 'API Key Required' };
        }
    } else {
        // Fallback for unknown state (should not happen after migration)
        method = { icon: '⚠️', name: 'Select Mode', status: 'Configure AI Settings' };
    }

    // Provider specific status override for Cloud
    if (currentMode === 'cloud') {
        const cloudProvider = storage.cloudProvider || DEFAULT_CLOUD_PROVIDER;
        if (cloudProvider === 'groq') {
            const hasGroqKey = storage.groqApiKey && storage.groqApiKey.trim().length > 0;
            if (hasGroqKey) {
                method.status = 'Groq Cloud Active';
            } else {
                method.status = 'Groq Key Required';
                method.icon = '❌';
            }
        } else {
            // Gemini Cloud
            if (hasApiKey) {
                method.status = 'Gemini Flash Active';
            }
        }
    }

    // Update UI (with null checks since activeMethodIcon may have been removed)
    if (activeMethodIcon) activeMethodIcon.textContent = method.icon;
    if (activeMethodName) activeMethodName.textContent = method.name;
    if (activeMethodStatus) activeMethodStatus.textContent = method.status;

    if (localAI.status === 'downloadable' && currentMode === 'local') {
        if (activeMethodStatus) activeMethodStatus.textContent = 'Model Downloadable';
    }

    // Update Mode Status Cards based on current mode
    updateModeStatusCards(currentMode, localAI, hasApiKey, storage);
}

/**
 * Update the mode status cards based on current AI mode
 */
async function updateModeStatusCards(currentMode, localAI, hasApiKey, storage) {
    if (!localStatusCard || !cloudSettingsCard) return;

    if (currentMode === 'local') {
        // Show Local Status Card, hide Cloud Settings
        localStatusCard.style.display = 'block';
        cloudSettingsCard.style.display = 'none';

        // Update local status based on availability
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

            if (localAI.status === 'downloadable') {
                localStatusIcon.textContent = '⬇️';
                localStatusTitle.textContent = 'Model Download Required';
                localStatusSubtitle.textContent = 'Gemini Nano needs to be downloaded';
            } else {
                localStatusIcon.textContent = '⚠️';
                localStatusTitle.textContent = 'Gemini Nano Not Available';
                localStatusSubtitle.textContent = 'Setup required to use on-device AI';
            }
            localSetupInstructions.style.display = 'block';
        }
    } else if (currentMode === 'cloud') {
        // Show Cloud Settings Card, hide Local Status
        localStatusCard.style.display = 'none';
        cloudSettingsCard.style.display = 'flex';

        // Load current cloud settings
        const cloudProvider = storage.cloudProvider || DEFAULT_CLOUD_PROVIDER;
        const defaultModel = cloudProvider === 'groq' ? DEFAULT_GROQ_MODEL : DEFAULT_GEMINI_MODEL;
        const cloudModel = storage.cloudModel || defaultModel;

        // Update provider dropdown
        if (cloudProviderSelect) {
            cloudProviderSelect.value = cloudProvider;
        }

        // Update model dropdown and API key field based on provider
        updateCloudProvider(cloudProvider, cloudModel);

        // Load API key for current provider
        if (cloudProvider === 'gemini' && storage.geminiApiKey) {
            cloudApiKeyInput.value = storage.geminiApiKey;
        } else if (cloudProvider === 'groq' && storage.groqApiKey) {
            cloudApiKeyInput.value = storage.groqApiKey;
        } else {
            cloudApiKeyInput.value = '';
        }
    } else {
        // Hide both cards if mode is unknown
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

    // Update model dropdown
    if (cloudModelSelect) {
        cloudModelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            cloudModelSelect.appendChild(option);
        });

        // Set selected model if provided
        if (selectedModel && models.some(m => m.value === selectedModel)) {
            cloudModelSelect.value = selectedModel;
        }
    }

    // Update API key field labels (don't clear value here - it's loaded separately)
    if (apiKeyLabel) apiKeyLabel.textContent = config.keyLabel;
    if (cloudApiKeyInput) {
        cloudApiKeyInput.placeholder = config.keyPlaceholder;
    }
    if (getApiKeyLink) {
        getApiKeyLink.href = config.keyLink;
        getApiKeyLink.textContent = config.keyLinkText;
    }

    // Load the correct API key for this provider
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
 * This is the single source of truth for determining which prompt to show
 * Used by both loadSettings() and applyPreset() to ensure consistency
 * @param {string} personaName - The persona key (e.g., 'polisher', 'custom')
 * @param {object} customPrompts - The customPersonaPrompts object
 * @returns {string} - The prompt to display
 */
function getPromptForPersona(personaName, customPrompts = {}) {
    console.log('[getPromptForPersona] Called with personaName:', personaName);
    console.log('[getPromptForPersona] customPrompts keys:', Object.keys(customPrompts));
    console.log('[getPromptForPersona] customPrompts[personaName]:', customPrompts[personaName]?.substring(0, 50));

    // First, check if there's a custom prompt saved for this persona
    if (customPrompts[personaName]) {
        console.log('[getPromptForPersona] BRANCH: Returning custom prompt');
        return customPrompts[personaName];
    }

    // For 'custom' persona with no saved prompt, show help text
    if (personaName === 'custom') {
        console.log('[getPromptForPersona] BRANCH: Returning custom help text');
        return `[Enter your custom system prompt here]

Tips:
- Define the AI's role and task clearly
- Add constraints (what NOT to do)
- Specify the output format you want`;
    }

    // Fall back to the default preset for this persona
    if (PRESETS[personaName]) {
        console.log('[getPromptForPersona] BRANCH: Returning PRESETS[' + personaName + ']');
        console.log('[getPromptForPersona] PRESETS value (first 100 chars):', PRESETS[personaName]?.substring(0, 100));
        return PRESETS[personaName];
    }

    // Final fallback to default prompt
    console.log('[getPromptForPersona] BRANCH: Returning DEFAULT_PROMPT fallback');
    return DEFAULT_PROMPT;
}

/**
 * Load saved settings from Chrome storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['systemPrompt', 'geminiApiKey', 'aiMode', 'enabledSites', 'activePersona', 'customPersonaPrompts']);

        // DEBUG: Log everything from storage
        console.log('[Options] ========== LOAD SETTINGS DEBUG ==========');
        console.log('[Options] Raw storage result:', JSON.stringify(result, null, 2));
        console.log('[Options] result.systemPrompt:', result.systemPrompt?.substring(0, 50) + '...');
        console.log('[Options] result.activePersona:', result.activePersona);
        console.log('[Options] result.customPersonaPrompts:', JSON.stringify(result.customPersonaPrompts));

        // Store activePersona globally for reset functionality
        const activePersona = result.activePersona || DEFAULT_PERSONA;
        window.currentActivePersona = activePersona;
        console.log('[Options] Using activePersona:', activePersona);

        // Store custom prompts globally
        window.customPersonaPrompts = result.customPersonaPrompts || {};
        console.log('[Options] window.customPersonaPrompts:', JSON.stringify(window.customPersonaPrompts));

        // MIGRATION: Clean up stale custom prompts that match the old short default text
        // This happens when users previously saved the old DEFAULT_SYSTEM_PROMPT as a "custom" prompt
        const OLD_DEFAULT = 'Rewrite this prompt to be clear, concise, and professional. Fix any grammar errors.';
        let needsMigration = false;

        // Also migrate if the legacy systemPrompt is the old default
        if (result.systemPrompt === OLD_DEFAULT) {
            console.log('[Options] Migrating legacy systemPrompt key');
            needsMigration = true;
            // Clear legacy systemPrompt key
            await chrome.storage.sync.remove(['systemPrompt']);
        }

        for (const [persona, prompt] of Object.entries(window.customPersonaPrompts)) {
            // If a custom prompt exactly matches the old default, remove it
            // This allows the proper PRESETS value to be used instead
            if (prompt === OLD_DEFAULT) {
                console.log(`[Options] Migrating stale custom prompt for "${persona}" - removing old default text`);
                delete window.customPersonaPrompts[persona];
                needsMigration = true;
            }
        }

        // Save the cleaned up custom prompts if migration occurred
        if (needsMigration) {
            await chrome.storage.sync.set({ customPersonaPrompts: window.customPersonaPrompts });
            console.log('[Options] Migration complete - saved cleaned customPersonaPrompts');
        }

        // Load system prompt using the shared helper function
        // This ensures the same logic is used on page load as when clicking a persona
        console.log('[Options] Calling getPromptForPersona with:', activePersona, Object.keys(window.customPersonaPrompts));
        const savedPrompt = getPromptForPersona(activePersona, window.customPersonaPrompts);
        console.log('[Options] getPromptForPersona returned (first 100 chars):', savedPrompt?.substring(0, 100));
        console.log('[Options] savedPrompt length:', savedPrompt?.length);

        systemPromptTextarea.value = savedPrompt;
        updateCharCount();
        console.log('[Options] ========== END LOAD SETTINGS DEBUG ==========');

        // Highlight active preset chip based on activePersona
        updatePresetChipHighlight(activePersona);

        // Load API key (show masked) - legacy element may not exist
        if (apiKeyInput && result.geminiApiKey && result.geminiApiKey.length > 0) {
            apiKeyInput.value = result.geminiApiKey;
        }

        // Load AI Mode - smart defaults based on availability
        let savedMode = result.aiMode;

        // If no mode saved yet, or if mode was 'hybrid' (legacy), determine smart default
        if (!savedMode || savedMode === 'hybrid') {
            savedMode = await determineDefaultAIMode();
            await chrome.storage.sync.set({ aiMode: savedMode });
            console.log('[Options] Smart default mode selected:', savedMode);
        }

        updateToggleUI(savedMode);

        // Load Enabled Sites
        const enabledSites = result.enabledSites || { chatgpt: true, claude: true, gemini: true };
        document.querySelectorAll('input[name="enabledSites"]').forEach(checkbox => {
            checkbox.checked = enabledSites[checkbox.value] !== false; // Default to true if undefined
        });

        // Load Cloud Provider - update toggle UI and visibility
        const cloudProvider = result.cloudProvider || DEFAULT_CLOUD_PROVIDER;
        updateProviderUI(cloudProvider);

        // Load Groq Settings (legacy elements - may not exist in new UI)
        if (groqApiKeyInput && result.groqApiKey) {
            groqApiKeyInput.value = result.groqApiKey;
        }
        if (groqModelInput) {
            if (result.groqModel) {
                groqModelInput.value = result.groqModel;
            } else {
                groqModelInput.value = DEFAULT_GROQ_MODEL;
            }
        }

        console.log('[Options] Settings loaded');
    } catch (error) {
        console.error('[Options] Error loading settings:', error);
        systemPromptTextarea.value = DEFAULT_PROMPT;
        updateCharCount();
    }
}

/**
 * Save system prompt to Chrome storage
 * Saves the custom prompt for the currently active persona
 */
async function saveSettings() {
    const systemPrompt = systemPromptTextarea.value.trim();

    if (!systemPrompt) {
        showStatus(statusDiv, 'Please enter a system prompt', 'error');
        return;
    }

    try {
        const activePersona = window.currentActivePersona || DEFAULT_PERSONA;

        // Update the custom prompts object for the current persona
        const customPersonaPrompts = window.customPersonaPrompts || {};
        customPersonaPrompts[activePersona] = systemPrompt;
        window.customPersonaPrompts = customPersonaPrompts;

        // Save the custom prompt to storage, keeping the current persona active
        await chrome.storage.sync.set({
            activePersona,
            customPersonaPrompts
        });

        // Keep the persona chip highlighted
        updatePresetChipHighlight(activePersona);

        const personaLabel = activePersona.charAt(0).toUpperCase() + activePersona.slice(1);
        showStatus(statusDiv, `✓ Custom ${personaLabel} prompt saved!`, 'show');
        console.log(`[Options] Custom prompt saved for persona: ${activePersona}`);
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
 * Save Groq Settings
 */
async function saveGroqSettings() {
    const apiKey = groqApiKeyInput.value.trim();
    const model = groqModelInput.value.trim() || DEFAULT_GROQ_MODEL;

    if (!apiKey) {
        showStatus(groqStatusDiv, 'Please enter a Groq API key', 'error');
        return;
    }

    if (!apiKey.startsWith('gsk_')) {
        showStatus(groqStatusDiv, 'Warning: Groq keys usually start with "gsk_"', 'error');
        // We allow it anyway in case format changes, but warn
    }

    try {
        await chrome.storage.sync.set({
            groqApiKey: apiKey,
            groqModel: model
        });
        showStatus(groqStatusDiv, '✓ Groq settings saved!', 'show');
        console.log('[Options] Groq settings saved');

        // Refresh AI status
        await updateAIStatus();
    } catch (error) {
        console.error('[Options] Error saving Groq settings:', error);
        showStatus(groqStatusDiv, 'Error saving settings.', 'error');
    }
}

/**
 * Clear Groq Settings
 */
async function clearGroqSettings() {
    try {
        await chrome.storage.sync.remove(['groqApiKey', 'groqModel']);
        groqApiKeyInput.value = '';
        groqModelInput.value = DEFAULT_GROQ_MODEL;
        showStatus(groqStatusDiv, 'Groq settings cleared', 'show');

        await updateAIStatus();
    } catch (error) {
        showStatus(groqStatusDiv, 'Error clearing settings.', 'error');
    }
}

/**
 * Update Provider UI (Toggle and Section Visibility)
 * Modular approach: Uses data-value and corresponding IDs
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
 * Setup Cloud Provider Toggle (new dropdown-based)
 */
function setupCloudProviderToggle() {
    // New dropdown-based provider selector
    if (cloudProviderSelect) {
        cloudProviderSelect.addEventListener('change', async () => {
            const provider = cloudProviderSelect.value;
            updateCloudProvider(provider);
            await chrome.storage.sync.set({ cloudProvider: provider });
            await updateAIStatus();
        });
    }

    // Model selection dropdown
    if (cloudModelSelect) {
        cloudModelSelect.addEventListener('change', async () => {
            const model = cloudModelSelect.value;
            await chrome.storage.sync.set({ cloudModel: model });
        });
    }

    // Save cloud settings button
    if (saveCloudSettingsBtn) {
        saveCloudSettingsBtn.addEventListener('click', saveCloudSettings);
    }

    // Clear cloud settings button  
    if (clearCloudSettingsBtn) {
        clearCloudSettingsBtn.addEventListener('click', clearCloudSettings);
    }

    // Toggle API key visibility
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

    // Legacy toggle support (for the old UI if still present)
    const toggleOptions = document.querySelectorAll('#cloudProviderToggle .toggle-option');
    toggleOptions.forEach(option => {
        option.addEventListener('click', () => {
            const provider = option.dataset.value;
            updateProviderUI(provider);
            chrome.storage.sync.set({ cloudProvider: provider });
            updateAIStatus();
        });
    });
}

/**
 * Save cloud settings (API key and model for current provider)
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

    // Basic validation
    if (!apiKey.startsWith(config.keyPrefix)) {
        showStatus(cloudSettingsStatus, `Warning: ${provider === 'gemini' ? 'Gemini' : 'Groq'} keys usually start with "${config.keyPrefix}"`, 'error');
        // Allow saving anyway but show warning
    }

    try {
        const saveData = { cloudProvider: provider, cloudModel: model };
        if (provider === 'gemini') {
            saveData.geminiApiKey = apiKey;
        } else if (provider === 'groq') {
            saveData.groqApiKey = apiKey;
            saveData.groqModel = model;  // Also save in legacy format
        }

        await chrome.storage.sync.set(saveData);

        // Auto-switch to cloud mode when API key is saved
        await chrome.storage.sync.set({ aiMode: 'cloud' });
        updateToggleUI('cloud');

        showStatus(cloudSettingsStatus, '✓ Cloud settings saved! Mode set to Cloud.', 'show');
        console.log(`[Options] Cloud settings saved: provider=${provider}, model=${model}, mode=cloud`);

        await updateAIStatus();
    } catch (error) {
        console.error('[Options] Error saving cloud settings:', error);
        showStatus(cloudSettingsStatus, 'Error saving settings.', 'error');
    }
}

/**
 * Clear cloud settings for current provider
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

        // Re-determine smart default after clearing API key
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
 * Clears any custom prompt for this persona and restores the default
 */
async function resetToPersonaDefault() {
    // Get the current active persona
    const activePersona = window.currentActivePersona || DEFAULT_PERSONA;

    // Remove custom prompt for this persona from the storage first
    const customPersonaPrompts = window.customPersonaPrompts || {};
    delete customPersonaPrompts[activePersona];
    window.customPersonaPrompts = customPersonaPrompts;

    // Get the default prompt using the shared helper
    // Pass empty object for custom prompts to get the default preset
    const defaultPrompt = getPromptForPersona(activePersona, {});

    // Update the textarea with the persona's default prompt
    systemPromptTextarea.value = defaultPrompt;
    updateCharCount();

    // Save the reset state
    await chrome.storage.sync.set({
        activePersona: activePersona,
        customPersonaPrompts
    });

    // Keep the persona chip highlighted
    updatePresetChipHighlight(activePersona);

    const personaLabel = activePersona.charAt(0).toUpperCase() + activePersona.slice(1);
    showStatus(statusDiv, `Reset to ${personaLabel} default`, 'show');
}

/**
 * Apply a preset prompt
 * Loads the custom prompt if one exists, otherwise loads the default preset
 * Uses the shared getPromptForPersona() helper for consistent behavior
 */
async function applyPreset(presetName) {
    // Validate that this is a known persona
    if (!PRESETS[presetName]) {
        console.warn(`[Options] Unknown preset: ${presetName}`);
        return;
    }

    // Get the prompt using the shared helper function
    // This ensures the same logic is used here as in loadSettings()
    const customPersonaPrompts = window.customPersonaPrompts || {};
    const promptToApply = getPromptForPersona(presetName, customPersonaPrompts);

    systemPromptTextarea.value = promptToApply;
    updateCharCount();

    // Update the active persona
    window.currentActivePersona = presetName;

    // Save activePersona to storage (not the prompt - that's saved separately via Save button)
    await chrome.storage.sync.set({
        activePersona: presetName
    });

    updatePresetChipHighlight(presetName);

    // Show different message if using custom vs default
    if (customPersonaPrompts[presetName]) {
        showStatus(statusDiv, `Loaded custom "${presetName}" prompt`, 'show');
    } else {
        showStatus(statusDiv, `Applied "${presetName}" preset`, 'show');
    }
}

/**
 * Update visual highlight on preset chips based on active persona
 * With per-persona storage, activePersona is always a real persona name (never 'custom')
 */
function updatePresetChipHighlight(activePersona) {
    // Store the active persona for reset functionality
    if (activePersona) {
        window.currentActivePersona = activePersona;
    }

    presetChips.forEach(chip => {
        const presetName = chip.dataset.preset;
        if (presetName === activePersona) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
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

function toggleGroqKeyVisibility() {
    if (groqApiKeyInput.type === 'password') {
        groqApiKeyInput.type = 'text';
        toggleGroqKeyVisibilityBtn.textContent = '🙈';
    } else {
        groqApiKeyInput.type = 'password';
        toggleGroqKeyVisibilityBtn.textContent = '👁️';
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
// EVENT LISTENERS
// ============================================================

// System prompt buttons
if (saveBtn) saveBtn.addEventListener('click', saveSettings);
if (resetPersonaBtn) resetPersonaBtn.addEventListener('click', resetToPersonaDefault);
if (systemPromptTextarea) systemPromptTextarea.addEventListener('input', updateCharCount);

// Legacy API key buttons (from old UI - may not exist)
if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', saveApiKey);
if (clearApiKeyBtn) clearApiKeyBtn.addEventListener('click', clearApiKey);
if (toggleKeyVisibilityBtn) toggleKeyVisibilityBtn.addEventListener('click', toggleKeyVisibility);

// Legacy Groq buttons (from old UI - may not exist)
if (saveGroqSettingsBtn) saveGroqSettingsBtn.addEventListener('click', saveGroqSettings);
if (clearGroqSettingsBtn) clearGroqSettingsBtn.addEventListener('click', clearGroqSettings);
if (toggleGroqKeyVisibilityBtn) toggleGroqKeyVisibilityBtn.addEventListener('click', toggleGroqKeyVisibility);

// Setup Toggles
setupCloudProviderToggle(); // Initialize provider toggle listeners

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

// AI Mode Toggle Click Handlers
function setupAIModeToggle() {
    const toggleOptions = document.querySelectorAll('#aiModeToggle .toggle-option');

    toggleOptions.forEach(option => {
        option.addEventListener('click', () => {
            const mode = option.dataset.value;

            // Update UI
            updateToggleUI(mode);

            // Save to storage
            chrome.storage.sync.set({ aiMode: mode });

            // Refresh status display
            updateAIStatus();
        });
    });
}

/**
 * Update the toggle UI to reflect selected mode
 */
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

// Keyboard shortcut: Ctrl/Cmd + S to save
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveSettings();
    }
});

// ============================================================
// PROMPT HISTORY MODULE
// ============================================================

// History DOM Elements
const historyHeader = document.getElementById('history-header');
const historyToggle = document.getElementById('history-toggle');
const historyContent = document.getElementById('history-content');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const clearHistoryBtn = document.getElementById('clear-history-btn');

/**
 * Format timestamp to human-readable string
 */
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
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get mode badge class and text
 */
function getModeInfo(mode) {
    switch (mode) {
        case 'local':
            return { class: 'local', text: '⚡ Local Nano' };
        case 'cloud':
        default:
            return { class: 'cloud', text: '☁️ Cloud' };
    }
}

/**
 * Render a single history entry
 */
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

    // Setup expand/collapse for long content
    div.querySelectorAll('[data-expandable="true"]').forEach(content => {
        const btn = content.nextElementSibling;
        // Check if content overflows
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

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * Load and render prompt history
 */
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

            history.forEach(entry => {
                historyList.appendChild(renderHistoryEntry(entry));
            });
        }
    } catch (error) {
        console.error('[PromptSmith] Error loading prompt history:', error);
        historyEmpty.textContent = 'Error loading history.';
        historyEmpty.style.display = 'block';
    }
}

/**
 * Clear prompt history
 */
async function clearPromptHistory() {
    if (!confirm('Are you sure you want to clear all prompt history?')) {
        return;
    }

    try {
        await chrome.storage.local.set({ promptHistory: [] });
        await loadPromptHistory();
    } catch (error) {
        console.error('[PromptSmith] Error clearing prompt history:', error);
    }
}

/**
 * Toggle history section visibility
 */
function toggleHistorySection() {
    historyContent.classList.toggle('collapsed');
    historyToggle.classList.toggle('collapsed');
}

// History Event Listeners
if (historyHeader) historyHeader.addEventListener('click', toggleHistorySection);
if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearPromptHistory);

// ============================================================
// ONBOARDING MODULE
// ============================================================

// Onboarding DOM Elements
const onboardingOverlay = document.getElementById('onboarding-overlay');
const onboardingContent = document.getElementById('onboarding-content');
const progressDotsContainer = document.getElementById('progress-dots');
const prevStepBtn = document.getElementById('prev-step');
const nextStepBtn = document.getElementById('next-step');
const skipOnboardingBtn = document.getElementById('skip-onboarding');

// Skip Warning Elements
const skipWarningOverlay = document.getElementById('skip-warning-overlay');
const warningGoBackBtn = document.getElementById('warning-go-back');
const warningContinueBtn = document.getElementById('warning-continue');

// Onboarding State
const ONBOARDING_STEPS = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'setup', title: 'Configure AI' },
    { id: 'nano', title: 'Local AI Setup' },
    { id: 'demo', title: 'See It In Action' },
    { id: 'ready', title: 'All Set!' }
];
let currentOnboardingStep = 0;
let detectedFeatures = {
    geminiNano: { available: false, status: 'checking' },
    hasApiKey: false
};

// Track temporary onboarding state
let onboardingState = {
    provider: 'groq', // Default
    apiKey: '',
    model: ''
};

/**
 * Show the onboarding overlay
 */
function showOnboarding() {
    onboardingOverlay.style.display = 'flex';
    renderProgressDots();
    goToStep(0);
}

/**
 * Hide the onboarding overlay
 */
function hideOnboarding() {
    onboardingOverlay.style.display = 'none';
}

/**
 * Render progress dots based on current step
 */
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

/**
 * Navigate to a specific step
 */
function goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= ONBOARDING_STEPS.length) return;

    currentOnboardingStep = stepIndex;
    renderProgressDots();
    renderStepContent(ONBOARDING_STEPS[stepIndex].id);

    // Update navigation buttons
    prevStepBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';

    if (stepIndex === ONBOARDING_STEPS.length - 1) {
        nextStepBtn.textContent = 'Start Polishing! ✨';
    } else {
        nextStepBtn.textContent = 'Next →';
    }
}

/**
 * Render content for a specific step
 */
function renderStepContent(stepId) {
    let html = '';

    switch (stepId) {
        case 'welcome':
            html = `
                <div class="step-content">
                    <h2 class="step-title">Thank you for installing PromptSmith! ✨</h2>
                    <p class="step-subtitle">
                        Privacy-first AI prompt refinement for ChatGPT, Claude, and Gemini. 
                        Let's get you set up in just a few steps.
                    </p>
                    <div class="feature-grid">
                        <div class="feature-card">
                            <div class="feature-icon">🧠</div>
                            <div class="feature-title">Smart AI Mode</div>
                            <div class="feature-desc">Auto-switches: Cloud API for speed, Local Nano for privacy.</div>
                        </div>
                        <div class="feature-card">
                            <div class="feature-icon">☁️</div>
                            <div class="feature-title">Multi-Provider</div>
                            <div class="feature-desc">Support for Google Gemini and Groq Cloud APIs.</div>
                        </div>
                         <div class="feature-card">
                            <div class="feature-icon">⚡</div>
                            <div class="feature-title">Local Fallback</div>
                            <div class="feature-desc">Works offline with Chrome's built-in Gemini Nano.</div>
                        </div>
                    </div>
                </div>
            `;
            break;

        case 'setup':
            // Determine labels based on current selection (defaulting to groq if not set)
            const isGroq = onboardingState.provider === 'groq';
            const apiKeyPlaceholder = isGroq ? 'gsk_...' : 'AIza...';
            const keyLink = isGroq ? 'https://console.groq.com/keys' : 'https://aistudio.google.com/app/apikey';
            const linkText = isGroq ? 'Groq Console' : 'Google AI Studio';

            html = `
                <div class="step-content">
                    <h2 class="step-title">Configure Your Cloud AI</h2>
                    <p class="step-subtitle">
                        Choose your preferred Cloud AI provider for the fastest and most reliable experience.
                    </p>
                    
                    <div class="setup-input-group">
                        <label for="onboarding-provider">Cloud Provider</label>
                        <select id="onboarding-provider" class="dropdown-select" style="margin-bottom: 1rem;">
                            <option value="groq" ${isGroq ? 'selected' : ''}>Groq (Free, No Card)</option>
                            <option value="gemini" ${!isGroq ? 'selected' : ''}>Gemini (Free, May Need Card)</option>
                        </select>
                    </div>

                    <div class="setup-input-group">
                        <label for="onboarding-api-key">API Key</label>
                        <input type="password" id="onboarding-api-key" placeholder="${apiKeyPlaceholder}" value="${onboardingState.apiKey}" spellcheck="false">
                        <p class="setup-hint" id="api-key-hint">
                            Get a free API key from <a href="${keyLink}" target="_blank" id="api-key-link">${linkText}</a>
                        </p>
                    </div>

                    <div class="recommendation-box" style="margin-top: 1rem;">
                        <h4>ℹ️ Getting an API Key</h4>
                        <ul style="font-size: 0.85rem; color: var(--text-secondary); padding-left: 1.25rem; margin-top: 0.5rem;">
                            <li id="groq-note" style="${isGroq ? '' : 'display:none;'}"><strong>Groq:</strong> Requires an account, but <strong>NO credit card</strong> is needed.</li>
                            <li id="gemini-note" style="${!isGroq ? '' : 'display:none;'}"><strong>Gemini:</strong> Requires a Google cloud account and <strong>may ask for a credit card</strong> verification.</li>
                        </ul>
                    </div>
                </div>
            `;
            setTimeout(() => {
                // Add event listener to update UI when provider changes
                const providerSelect = document.getElementById('onboarding-provider');
                const apiKeyInput = document.getElementById('onboarding-api-key');
                const apiKeyLink = document.getElementById('api-key-link');
                const groqNote = document.getElementById('groq-note');
                const geminiNote = document.getElementById('gemini-note');

                if (providerSelect) {
                    providerSelect.addEventListener('change', (e) => {
                        const provider = e.target.value;
                        onboardingState.provider = provider;

                        // Update UI
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

                // Track input
                if (apiKeyInput) {
                    apiKeyInput.addEventListener('input', (e) => {
                        onboardingState.apiKey = e.target.value;
                    });
                }
            }, 0);
            break;

        case 'nano':
            html = `
                <div class="step-content">
                    <h2 class="step-title">Enable Gemini Nano (Optional)</h2>
                    <p class="step-subtitle">
                        Run AI completely on your device using Chrome's built-in model. Great for privacy and offline use.
                    </p>
                    <div class="nano-setup-steps">
                        <div class="nano-step">
                            <div class="nano-step-number">1</div>
                            <div class="nano-step-content">
                                <h4>Enable Chrome Flags</h4>
                                <p>Open <code>chrome://flags</code> <button class="copy-btn nano-copy-btn" data-copy="chrome://flags" title="Copy URL">📋</button></p>
                                <ul class="nano-flags-list">
                                    <li><code>#optimization-guide-on-device-model</code> → <strong>Enabled BypassPerfRequirement</strong></li>
                                    <li><code>#prompt-api-for-gemini-nano</code> → <strong>Enabled</strong></li>
                                </ul>
                            </div>
                        </div>
                        <div class="nano-step">
                            <div class="nano-step-number">2</div>
                            <div class="nano-step-content">
                                <h4>Relaunch Chrome</h4>
                                <p>Click the <strong>Relaunch</strong> button that appears at the bottom of the flags page.</p>
                            </div>
                        </div>
                        <div class="nano-step">
                            <div class="nano-step-number">3</div>
                            <div class="nano-step-content">
                                <h4>Download the Model</h4>
                                <p>Go to <code>chrome://components</code> <button class="copy-btn nano-copy-btn" data-copy="chrome://components" title="Copy URL">📋</button></p>
                                <p>Find <strong>"Optimization Guide On Device Model"</strong> and click <strong>"Check for update"</strong>.</p>
                                <p class="nano-note">⏳ Download is ~1.7GB. Wait for version to change from <code>0.0.0.0</code>.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            setTimeout(() => {
                const copyBtns = document.querySelectorAll('.nano-copy-btn');
                copyBtns.forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const text = btn.dataset.copy;
                        if (text) {
                            try {
                                await navigator.clipboard.writeText(text);
                                const originalText = btn.innerHTML;
                                btn.innerHTML = '✓';
                                setTimeout(() => btn.innerHTML = originalText, 1500);
                            } catch (err) {
                                console.error('Failed to copy:', err);
                                btn.classList.add('copy-error'); // Optional: Add error styling
                            }
                        }
                    });
                });
            }, 0);
            break;

        case 'demo':
            html = `
                <div class="step-content">
                    <h2 class="step-title">See It In Action</h2>
                    <p class="step-subtitle">
                        Watch how PromptSmith polishes your prompts with just one click.
                    </p>
                    <div class="demo-video-container">
                        <video id="demo-video" controls autoplay muted loop playsinline>
                            <source src="usage.mov" type="video/quicktime">
                            <source src="usage.mov" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </div>
            `;
            break;

        case 'ready':
            html = `
                <div class="step-content" style="text-align: center;">
                    <div class="ready-icon">🎉</div>
                    <h2 class="step-title">You're All Set!</h2>
                    <p class="step-subtitle">
                        PromptSmith is ready to polish your prompts on ChatGPT, Claude, and Gemini.
                    </p>
                    <div class="tips-list">
                        <div class="tip-item">
                            <span class="tip-icon">✨</span>
                            <span class="tip-text">Look for the <strong>Polish</strong> button in the chat toolbar</span>
                        </div>
                        <div class="tip-item">
                            <span class="tip-icon">🎭</span>
                            <span class="tip-text">Click the dropdown arrow to select different personas</span>
                        </div>
                        <div class="tip-item">
                            <span class="tip-icon">⚙️</span>
                            <span class="tip-text">Access settings anytime by clicking the extension icon</span>
                        </div>
                    </div>
                </div>
            `;
            break;
    }

    onboardingContent.innerHTML = html;
}

/**
 * Handle next step navigation
 */
async function handleNextStep() {
    const currentStepId = ONBOARDING_STEPS[currentOnboardingStep].id;

    // Handle setup step - save API key if entered
    if (currentStepId === 'setup') {
        const apiKeyInput = document.getElementById('onboarding-api-key');
        const providerSelect = document.getElementById('onboarding-provider');

        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        const provider = providerSelect ? providerSelect.value : 'gemini';

        // Update temp state
        onboardingState.apiKey = apiKey;
        onboardingState.provider = provider;

        if (apiKey) {
            // Validate key format based on provider
            let isValid = true;
            if (provider === 'gemini' && !apiKey.startsWith('AIza')) {
                isValid = false;
                apiKeyInput.placeholder = 'Invalid format - keys start with AIza...';
            } else if (provider === 'groq' && !apiKey.startsWith('gsk_')) {
                // Warn but maybe allow? For now strict like options.
                isValid = false;
                apiKeyInput.placeholder = 'Invalid format - keys start with gsk_...';
            }

            if (!isValid) {
                apiKeyInput.style.borderColor = 'var(--error)';
                return;
            }

            // Save to storage
            const saveData = {
                cloudProvider: provider,
                aiMode: 'cloud' // Default mode to cloud if key provided
            };

            if (provider === 'gemini') {
                saveData.geminiApiKey = apiKey;
            } else {
                saveData.groqApiKey = apiKey;
                // saveData.groqModel = DEFAULT_GROQ_MODEL; // Let options init handle default
            }

            await chrome.storage.sync.set(saveData);
            detectedFeatures.hasApiKey = true;
        }
    }

    // Go to next step or complete
    if (currentOnboardingStep < ONBOARDING_STEPS.length - 1) {
        goToStep(currentOnboardingStep + 1);
    } else {
        // Complete onboarding
        await completeOnboarding();
    }
}

/**
 * Handle previous step navigation
 */
function handlePrevStep() {
    if (currentOnboardingStep > 0) {
        goToStep(currentOnboardingStep - 1);
    }
}

/**
 * Show skip warning modal
 */
function showSkipWarning() {
    skipWarningOverlay.style.display = 'flex';
}

/**
 * Hide skip warning modal
 */
function hideSkipWarning() {
    skipWarningOverlay.style.display = 'none';
}

/**
 * Complete the onboarding process
 */
async function completeOnboarding() {
    await chrome.storage.sync.set({ hasCompletedOnboarding: true });
    hideOnboarding();

    // Refresh the main settings UI
    await loadSettings();
    await updateAIStatus();
}

/**
 * Skip onboarding and show warning
 */
function handleSkipOnboarding() {
    showSkipWarning();
}

/**
 * Continue to settings (skip confirmed)
 */
async function handleSkipConfirmed() {
    hideSkipWarning();
    await completeOnboarding();
}

/**
 * Go back to onboarding from warning
 */
function handleSkipCancelled() {
    hideSkipWarning();
}

// Onboarding Event Listeners
if (nextStepBtn) nextStepBtn.addEventListener('click', handleNextStep);
if (prevStepBtn) prevStepBtn.addEventListener('click', handlePrevStep);
if (skipOnboardingBtn) skipOnboardingBtn.addEventListener('click', handleSkipOnboarding);
if (warningGoBackBtn) warningGoBackBtn.addEventListener('click', handleSkipCancelled);
if (warningContinueBtn) warningContinueBtn.addEventListener('click', handleSkipConfirmed);

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check if onboarding has been completed
    const { hasCompletedOnboarding } = await chrome.storage.sync.get(['hasCompletedOnboarding']);

    if (!hasCompletedOnboarding) {
        // Show onboarding for first-time users
        showOnboarding();
    }

    // Load saved settings
    await loadSettings();

    // Check and display AI status
    await updateAIStatus();

    // Load prompt history
    await loadPromptHistory();

    // Setup listeners
    setupSiteToggles();
    setupAIModeToggle();
    setupCopyButtons();
});

/**
 * Setup copy buttons for the "How It Works" section
 */
function setupCopyButtons() {
    const copyBtns = document.querySelectorAll('.copy-url-btn');

    copyBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const text = btn.dataset.copy;
            if (!text) return;

            try {
                await navigator.clipboard.writeText(text);

                // Visual feedback
                const originalContent = btn.innerHTML;
                btn.innerHTML = '✓';
                btn.classList.add('copied');

                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.classList.remove('copied');
                }, 1500);
            } catch (err) {
                console.error('Failed to copy:', err);
                // Fallback or error indication could go here
            }
        });
    });
}

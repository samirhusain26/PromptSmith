/**
 * PromptSmith - Options Page Script
 * Handles saving and loading user settings for system prompt and API key.
 * Detects AI availability and updates status indicator.
 */

import { DEFAULT_SYSTEM_PROMPT } from './constants.js';
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

// AI Status elements (New UI)
const activeMethodIcon = document.getElementById('activeMethodIcon');
const activeMethodName = document.getElementById('activeMethodName');
const activeMethodStatus = document.getElementById('activeMethodStatus');

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
 * Update the AI status display in the UI
 */
async function updateAIStatus() {
    // Check local AI availability
    const localAI = await AIService.checkLocalAIAvailability();

    // Check if API key is configured
    const storage = await chrome.storage.sync.get(['geminiApiKey', 'aiMode']);
    const hasApiKey = storage.geminiApiKey && storage.geminiApiKey.trim().length > 0;
    const currentMode = storage.aiMode || 'hybrid';

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
            method = { icon: '☁️', name: 'Cloud Only', status: 'Gemini Flash Active' };
        } else {
            method = { icon: '❌', name: 'Cloud Only', status: 'API Key Required' };
        }
    } else {
        // Hybrid Mode logic
        if (hasApiKey) {
            method = { icon: '☁️', name: 'Hybrid', status: 'Cloud Primary' };
        } else if (localAI.available) {
            method = { icon: '⚡', name: 'Hybrid', status: 'Local Fallback Active' };
        } else {
            method = { icon: '⚠️', name: 'Hybrid', status: 'No AI Ready' };
        }
    }

    // Update UI (with null checks since activeMethodIcon may have been removed)
    if (activeMethodIcon) activeMethodIcon.textContent = method.icon;
    if (activeMethodName) activeMethodName.textContent = method.name;
    if (activeMethodStatus) activeMethodStatus.textContent = method.status;

    if (localAI.status === 'downloadable' && (currentMode === 'hybrid' || currentMode === 'local')) {
        if (method.name === 'Local Only' || method.name === 'Hybrid') {
            if (activeMethodStatus) activeMethodStatus.textContent = 'Model Downloadable';
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
        const result = await chrome.storage.sync.get(['systemPrompt', 'geminiApiKey', 'aiMode', 'enabledSites', 'activePersona', 'customPersonaPrompts']);

        // Store activePersona globally for reset functionality
        const activePersona = result.activePersona || 'polisher';
        window.currentActivePersona = activePersona;

        // Store custom prompts globally
        window.customPersonaPrompts = result.customPersonaPrompts || {};

        // Load system prompt - check for custom prompt first, then fall back to preset/default
        let savedPrompt;
        if (window.customPersonaPrompts[activePersona]) {
            savedPrompt = window.customPersonaPrompts[activePersona];
        } else if (PRESETS[activePersona]) {
            savedPrompt = PRESETS[activePersona];
        } else {
            savedPrompt = result.systemPrompt || DEFAULT_PROMPT;
        }

        systemPromptTextarea.value = savedPrompt;
        updateCharCount();

        // Highlight active preset chip based on activePersona
        updatePresetChipHighlight(activePersona);

        // Load API key (show masked)
        if (result.geminiApiKey && result.geminiApiKey.length > 0) {
            apiKeyInput.value = result.geminiApiKey;
        }

        // Load AI Mode - update toggle UI
        const savedMode = result.aiMode || 'hybrid';
        updateToggleUI(savedMode);

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
 * Saves the custom prompt for the currently active persona
 */
async function saveSettings() {
    const systemPrompt = systemPromptTextarea.value.trim();

    if (!systemPrompt) {
        showStatus(statusDiv, 'Please enter a system prompt', 'error');
        return;
    }

    try {
        const activePersona = window.currentActivePersona || 'polisher';

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
 * Reset to the currently active persona's default prompt
 * Clears any custom prompt for this persona and restores the default
 */
async function resetToPersonaDefault() {
    // Get the current active persona
    const activePersona = window.currentActivePersona || 'polisher';

    // Get the default preset for this persona
    const preset = PRESETS[activePersona];
    const defaultPrompt = preset || DEFAULT_PROMPT;

    // Update the textarea with the persona's default prompt
    systemPromptTextarea.value = defaultPrompt;
    updateCharCount();

    // Remove custom prompt for this persona from the storage
    const customPersonaPrompts = window.customPersonaPrompts || {};
    delete customPersonaPrompts[activePersona];
    window.customPersonaPrompts = customPersonaPrompts;

    // Save the reset state
    await chrome.storage.sync.set({
        systemPrompt: defaultPrompt,
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
 */
async function applyPreset(presetName) {
    const defaultPreset = PRESETS[presetName];
    if (defaultPreset) {
        // Check if there's a custom prompt saved for this persona
        const customPersonaPrompts = window.customPersonaPrompts || {};
        let promptToApply = customPersonaPrompts[presetName];

        // For 'custom' persona, show help text if no custom prompt saved
        if (!promptToApply) {
            if (presetName === 'custom') {
                promptToApply = `[Enter your custom system prompt here]

Tips:
- Define the AI's role and task clearly
- Add constraints (what NOT to do)
- Specify the output format you want`;
            } else {
                promptToApply = defaultPreset;
            }
        }

        systemPromptTextarea.value = promptToApply;
        updateCharCount();

        // Update the active persona
        window.currentActivePersona = presetName;

        // Save both systemPrompt and activePersona to storage
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
saveBtn.addEventListener('click', saveSettings);
resetPersonaBtn.addEventListener('click', resetToPersonaDefault);
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
                            <div class="feature-icon">🔐</div>
                            <div class="feature-title">Privacy First</div>
                            <div class="feature-desc">Your prompts stay on your device when possible</div>
                        </div>
                        <div class="feature-card">
                            <div class="feature-icon">⚡</div>
                            <div class="feature-title">2-Tier AI</div>
                            <div class="feature-desc">Cloud → Local Nano fallback</div>
                        </div>
                        <div class="feature-card">
                            <div class="feature-icon">🎭</div>
                            <div class="feature-title">4 Personas</div>
                            <div class="feature-desc">Polisher, Developer, Thinker, Custom</div>
                        </div>
                    </div>
                </div>
            `;
            break;

        case 'setup':
            html = `
                <div class="step-content">
                    <h2 class="step-title">Configure Your AI Provider</h2>
                    <p class="step-subtitle">
                        Enter your Google AI API key to enable Gemini Flash. This is the fastest and most reliable option.
                    </p>
                    <div class="setup-input-group">
                        <label for="onboarding-api-key">Google AI API Key</label>
                        <input type="password" id="onboarding-api-key" placeholder="AIza..." spellcheck="false">
                        <p class="setup-hint">
                            Get a free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>
                        </p>
                    </div>
                    <div class="recommendation-box" style="margin-top: 1rem;">
                        <h4>💡 Prefer On-Device AI?</h4>
                        <p>In the next step, you can also enable <strong>Gemini Nano</strong> for 100% local, on-device processing—no API key required!</p>
                    </div>
                </div>
            `;
            break;

        case 'nano':
            html = `
                <div class="step-content">
                    <h2 class="step-title">Enable Gemini Nano (Optional)</h2>
                    <p class="step-subtitle">
                        Run AI completely on your device for maximum privacy. Requires Chrome 128+ on supported hardware.
                    </p>
                    <div class="nano-setup-steps">
                        <div class="nano-step">
                            <div class="nano-step-number">1</div>
                            <div class="nano-step-content">
                                <h4>Enable Chrome Flags</h4>
                                <p>Open <code>chrome://flags</code> in a new tab and enable:</p>
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
                                <p>Go to <code>chrome://components</code>, find <strong>"Optimization Guide On Device Model"</strong>, and click <strong>"Check for update"</strong>.</p>
                                <p class="nano-note">⏳ Download is ~1.7GB. Wait for the version to change from <code>0.0.0.0</code>.</p>
                            </div>
                        </div>
                    </div>
                    <div class="recommendation-box" style="margin-top: 1rem;">
                        <h4>ℹ️ Already have an API key?</h4>
                        <p>You can skip this step! Gemini Nano is optional and serves as a privacy-focused fallback when the API is unavailable.</p>
                    </div>
                </div>
            `;
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
 * Get recommendation text based on detected features
 */
function getRecommendation() {
    if (detectedFeatures.hasApiKey) {
        return 'Great! You already have an API key configured. Gemini Flash will be your primary AI provider for fast, reliable polishing.';
    } else if (detectedFeatures.geminiNano.available) {
        return 'Gemini Nano is available! You can use the extension right away. Adding an API key will enable faster cloud processing as the primary option.';
    } else {
        return 'We recommend setting up a Gemini Flash API key in the next step. It\'s free and provides the best experience when local AI is unavailable.';
    }
}

/**
 * Run feature detection
 */
async function runFeatureDetection() {
    // Check Gemini Nano
    const nanoStatus = await checkLocalAIAvailability();
    detectedFeatures.geminiNano = {
        available: nanoStatus.available,
        status: nanoStatus.status
    };

    // Check for existing API key
    const storage = await chrome.storage.sync.get(['geminiApiKey']);
    detectedFeatures.hasApiKey = storage.geminiApiKey && storage.geminiApiKey.trim().length > 0;
}

/**
 * Handle next step navigation
 */
async function handleNextStep() {
    const currentStepId = ONBOARDING_STEPS[currentOnboardingStep].id;

    // Handle setup step - save API key if entered
    if (currentStepId === 'setup') {
        const apiKeyInput = document.getElementById('onboarding-api-key');
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

        if (apiKey) {
            // Validate and save API key
            if (!apiKey.startsWith('AIza')) {
                // Show error in the input
                apiKeyInput.style.borderColor = 'var(--error)';
                apiKeyInput.placeholder = 'Invalid format - keys start with AIza...';
                return;
            }

            await chrome.storage.sync.set({ geminiApiKey: apiKey });
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
});

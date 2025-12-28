/**
 * PromptSmith - Unified AI Service
 * 
 * Implements strict mode system:
 * Mode 1: Cloud (Gemini Flash or Groq) - Requires API Key
 * Mode 2: Local (Gemini Nano via LanguageModel API) - Requires Chrome built-in AI
 */

import { GEMINI_API_BASE_URL, DEFAULT_GEMINI_MODEL, GROQ_API_ENDPOINT, DEFAULT_GROQ_MODEL } from './constants.js';
import { META_PROMPT } from './prompts.js';

// Cache for AI session
let localAISession = null;
let cachedSystemPrompt = null;

// ============================================================
// LOCAL AI (Gemini Nano) FUNCTIONS
// ============================================================

/**
 * Check if local AI (Gemini Nano) is available
 * @returns {Promise<{available: boolean, reason?: string}>}
 */
async function checkLocalAIAvailability() {
    try {
        // 1. Try modern `self.ai.languageModel` API
        if (self.ai && self.ai.languageModel) {
            const capabilities = await self.ai.languageModel.capabilities();

            if (capabilities.available === 'readily') {
                return { available: true };
            } else {
                return {
                    available: false,
                    reason: `Model status: ${capabilities.available}`
                };
            }
        }

        // 2. Fallback to `LanguageModel` global (Origin Trial API)
        if (typeof LanguageModel !== 'undefined') {
            const availability = await LanguageModel.availability();

            if (availability === 'available') {
                return { available: true };
            } else {
                return {
                    available: false,
                    reason: `Model status: ${availability}`
                };
            }
        }

        return {
            available: false,
            reason: 'Chrome AI API not found. Enable chrome://flags/#optimization-guide-on-device-model'
        };

    } catch (error) {
        console.error('[AI Service] Error checking local AI:', error);
        return {
            available: false,
            reason: `Error: ${error.message}`
        };
    }
}

/**
 * Create or reuse a local AI session
 * @param {string} systemPrompt - The system instruction for the AI
 * @returns {Promise<object>} - The AI session
 */
async function getLocalAISession(systemPrompt) {
    try {
        // Destroy existing session if system prompt changed
        if (localAISession && cachedSystemPrompt !== systemPrompt) {
            if (localAISession.destroy) localAISession.destroy();
            localAISession = null;
        }

        // Reuse existing session
        if (localAISession) {
            return localAISession;
        }

        // Create new session
        console.log('[AI Service] Creating new local AI session...');

        // Try modern API
        if (self.ai && self.ai.languageModel) {
            localAISession = await self.ai.languageModel.create({
                systemPrompt: systemPrompt
            });
        }
        // Fallback to legacy API
        else if (typeof LanguageModel !== 'undefined') {
            localAISession = await LanguageModel.create({
                systemPrompt: systemPrompt
            });
        } else {
            throw new Error('Local AI API not found');
        }

        cachedSystemPrompt = systemPrompt;
        return localAISession;

    } catch (error) {
        console.error('[AI Service] Error creating local AI session:', error);
        throw error;
    }
}

/**
 * Generate text using local AI (Gemini Nano)
 * @param {string} userPrompt - The user's input text to polish
 * @param {string} systemInstruction - The system instruction for polishing
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 */
async function generateWithLocalAI(userPrompt, systemInstruction) {
    const startTotal = performance.now();

    // 3-LAYER PROMPT STRUCTURE
    const combinedPrompt = `${systemInstruction}

--- USER INPUT TO REWRITE ---
${userPrompt}
--- END USER INPUT ---
${META_PROMPT}`;

    try {
        const sessionStart = performance.now();
        const session = await getLocalAISession(systemInstruction);
        const sessionTime = performance.now() - sessionStart;

        const promptStart = performance.now();
        const result = await session.prompt(combinedPrompt);
        const promptTime = performance.now() - promptStart;

        console.log(`[AI Service] Local AI generation: ${promptTime.toFixed(2)}ms`);

        return {
            success: true,
            text: result,
            metadata: {
                sessionTime,
                inferenceTime: promptTime,
                totalTime: performance.now() - startTotal
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================================
// CLOUD AI (Gemini & Groq) FUNCTIONS
// ============================================================

/**
 * Generate text using cloud AI (Gemini Flash API)
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 */
async function generateWithCloudAI(userPrompt, systemInstruction, apiKey, model = DEFAULT_GEMINI_MODEL) {
    const fullSystemInstruction = `${systemInstruction}\n${META_PROMPT}`;

    const requestBody = {
        contents: [{ parts: [{ text: `--- USER INPUT TO REWRITE ---\n${userPrompt}\n--- END USER INPUT ---` }] }],
        systemInstruction: { parts: [{ text: fullSystemInstruction }] },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
        }
    };

    try {
        const apiEndpoint = `${GEMINI_API_BASE_URL}/${model}:generateContent`;
        const response = await fetch(`${apiEndpoint}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const rawErrorText = await response.text();
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            try {
                const errorData = JSON.parse(rawErrorText);
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) { /* ignore parse error */ }

            if (response.status === 429) {
                throw new Error(`Rate limit exceeded: ${errorMessage}`);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error('Empty response from Gemini');

        return { success: true, text: text };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Generate text using Groq API
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 */
async function generateWithGroqAI(userPrompt, systemInstruction, apiKey, model = DEFAULT_GROQ_MODEL) {
    const requestBody = {
        messages: [
            { role: "system", content: `${systemInstruction}\n${META_PROMPT}` },
            { role: "user", content: `--- USER INPUT TO REWRITE ---\n${userPrompt}\n--- END USER INPUT ---` }
        ],
        model: model,
        temperature: 0.7,
        max_tokens: 2048
    };

    try {
        const response = await fetch(GROQ_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) throw new Error('Empty response from Groq');

        return { success: true, text: text };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================================
// UNIFIED API
// ============================================================

/**
 * Get the current AI mode based on storage settings and availability
 * @returns {Promise<{mode: string, status: string, details: string}>}
 */
async function getAIMode() {
    let preferredMode = 'cloud';
    let cloudProvider = 'gemini';
    let hasGeminiKey = false;
    let hasGroqKey = false;

    try {
        const storage = await chrome.storage.sync.get(['aiMode', 'cloudProvider', 'geminiApiKey', 'groqApiKey']);
        preferredMode = storage.aiMode || 'cloud';
        cloudProvider = storage.cloudProvider || 'gemini';
        hasGeminiKey = !!(storage.geminiApiKey && storage.geminiApiKey.trim());
        hasGroqKey = !!(storage.groqApiKey && storage.groqApiKey.trim());
    } catch (e) {
        console.warn('Error reading config:', e);
    }

    const localAvailability = await checkLocalAIAvailability();

    // Mode: Local
    if (preferredMode === 'local') {
        if (localAvailability.available) {
            return {
                mode: 'local',
                status: '⚡ Local Only',
                details: 'Using on-device Chrome AI.'
            };
        }
        return {
            mode: 'none',
            status: '❌ Local AI Unavailable',
            details: localAvailability.reason || 'Browser does not support Gemini Nano.'
        };
    }

    // Mode: Cloud
    // Note: preferredMode defaults to 'cloud' if 'auto' or 'hybrid' was previously set
    if (preferredMode === 'cloud' || preferredMode === 'auto' || preferredMode === 'hybrid') {
        if (cloudProvider === 'groq') {
            if (hasGroqKey) {
                return {
                    mode: 'cloud',
                    status: '☁️ Cloud Only (Groq)',
                    details: 'Using Groq API.'
                };
            }
            return { mode: 'none', status: '❌ Groq Key Required', details: 'Please enter your Groq API Key.' };
        } else {
            // Default to Gemini
            if (hasGeminiKey) {
                return {
                    mode: 'cloud',
                    status: '☁️ Cloud Only (Gemini)',
                    details: 'Using Google Gemini API.'
                };
            }
            return { mode: 'none', status: '❌ Gemini Key Required', details: 'Please enter your Gemini API Key.' };
        }
    }

    return {
        mode: 'none',
        status: '⚠️ Select AI Mode',
        details: 'Please choose Local or Cloud in settings.'
    };
}

/**
 * Main unified function to generate polished text
 * @param {string} userPrompt
 * @param {string} systemInstruction
 * @returns {Promise<{success: boolean, text?: string, error?: string, mode: string}>}
 */
async function generatePolishedText(userPrompt, systemInstruction) {
    console.log('[AI Service] generatePolishedText called');

    let preferredMode = 'cloud';
    let cloudProvider = 'gemini';
    let config = {};

    try {
        const storage = await chrome.storage.sync.get(['geminiApiKey', 'groqApiKey', 'groqModel', 'cloudModel', 'aiMode', 'cloudProvider']);

        preferredMode = storage.aiMode || 'cloud';
        cloudProvider = storage.cloudProvider || 'gemini';

        config = {
            geminiApiKey: storage.geminiApiKey,
            geminiModel: storage.cloudModel || DEFAULT_GEMINI_MODEL, // Unified cloud model key
            groqApiKey: storage.groqApiKey,
            groqModel: storage.cloudModel || DEFAULT_GROQ_MODEL    // Unified cloud model key
        };

        // Safety check: if provider is groq but model seems to be gemini, switch to default groq
        if (cloudProvider === 'groq' && config.groqModel.startsWith('gemini')) {
            config.groqModel = DEFAULT_GROQ_MODEL;
        }
        // Vice versa
        if (cloudProvider === 'gemini' && !config.geminiModel.startsWith('gemini')) {
            config.geminiModel = DEFAULT_GEMINI_MODEL;
        }

    } catch (error) {
        console.error('[AI Service] Error accessing storage:', error);
        return { success: false, error: 'Storage access failed', mode: 'none' };
    }

    const cleanAIResponse = (text) => {
        if (!text) return '';
        const match = text.match(/<result>([\s\S]*?)<\/result>/i);
        return match && match[1] ? match[1].trim() : text.trim();
    };

    // 1. Local Mode Execution
    if (preferredMode === 'local') {
        const avail = await checkLocalAIAvailability();
        if (!avail.available) {
            return { success: false, error: 'Gemini Nano unavailable: ' + avail.reason, mode: 'local' };
        }

        const result = await generateWithLocalAI(userPrompt, systemInstruction);
        if (result.success) {
            return { success: true, text: cleanAIResponse(result.text), mode: 'local' };
        }
        return { success: false, error: result.error, mode: 'local' };
    }

    // 2. Cloud Mode Execution
    // Treat 'auto' and 'hybrid' as 'cloud' to gracefully migrate legacy users
    if (preferredMode === 'cloud' || preferredMode === 'auto' || preferredMode === 'hybrid') {
        let result;
        if (cloudProvider === 'groq') {
            if (!config.groqApiKey) return { success: false, error: 'Groq API Key missing', mode: 'cloud' };
            result = await generateWithGroqAI(userPrompt, systemInstruction, config.groqApiKey, config.groqModel);
        } else {
            if (!config.geminiApiKey) return { success: false, error: 'Gemini API Key missing', mode: 'cloud' };
            result = await generateWithCloudAI(userPrompt, systemInstruction, config.geminiApiKey, config.geminiModel);
        }

        if (result.success) {
            return { success: true, text: cleanAIResponse(result.text), mode: `cloud-${cloudProvider}` };
        }
        return { success: false, error: result.error, mode: 'cloud' };
    }

    return {
        success: false,
        error: 'Invalid AI Mode. Please check settings.',
        mode: 'none'
    };
}

export const AIService = {
    generatePolishedText,
    checkLocalAIAvailability,
    getAIMode
};

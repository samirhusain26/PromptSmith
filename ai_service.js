/**
 * PromptSmith - Unified AI Service
 * 
 * Implements hybrid fallback system:
 * Priority 1: Cloud (Gemini Flash API) - if API key is provided
 * Priority 2: Local (Gemini Nano via LanguageModel API)
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
 * @returns {Promise<{available: boolean, status: string, reason?: string}>}
 */
async function checkLocalAIAvailability() {
    console.log('[AI Service] === Checking Local AI Availability ===');
    console.log('[AI Service] self.ai exists:', !!self.ai);
    console.log('[AI Service] self.ai.languageModel exists:', !!(self.ai && self.ai.languageModel));
    console.log('[AI Service] LanguageModel global exists:', typeof LanguageModel !== 'undefined');

    try {
        // 1. Try modern `self.ai.languageModel` API
        if (self.ai && self.ai.languageModel) {
            console.log('[AI Service] Using MODERN self.ai.languageModel API');
            console.log('[AI Service] Calling capabilities() with BOTH outputLanguage and expectedOutputLanguages');

            const capabilities = await self.ai.languageModel.capabilities({
                outputLanguage: 'en',
                expectedOutputLanguages: ['en']  // Also include array form for older API versions
            });
            console.log('[AI Service] Local AI capabilities result:', JSON.stringify(capabilities));

            if (capabilities.available === 'readily') {
                console.log('[AI Service] Status: READY');
                return { available: true, status: 'ready' };
            } else if (capabilities.available === 'after-download') {
                console.log('[AI Service] Status: DOWNLOADABLE');
                return {
                    available: false,
                    status: 'downloadable',
                    reason: 'Gemini Nano model needs to be downloaded.'
                };
            } else {
                console.log('[AI Service] Status: UNAVAILABLE - capabilities.available =', capabilities.available);
                return {
                    available: false,
                    status: 'unavailable',
                    reason: 'Gemini Nano not available on this device.'
                };
            }
        }

        // 2. Fallback to `LanguageModel` global (Origin Trial API)
        if (typeof LanguageModel !== 'undefined') {
            console.log('[AI Service] Using LEGACY LanguageModel global API');
            console.log('[AI Service] Calling LanguageModel.availability()');

            // Note: The legacy availability() may not accept params, but we try to pass them
            // to suppress Chrome's "No output language was specified" warning
            let availability;
            try {
                availability = await LanguageModel.availability({
                    expectedOutputLanguages: ['en']
                });
            } catch (e) {
                // If params not supported, fall back to no-param call
                availability = await LanguageModel.availability();
            }
            console.log('[AI Service] Local AI availability (Legacy) result:', availability);

            switch (availability) {
                case 'available':
                    console.log('[AI Service] Status: AVAILABLE');
                    return { available: true, status: 'ready' };
                case 'downloadable':
                    console.log('[AI Service] Status: DOWNLOADABLE');
                    return { available: false, status: 'downloadable', reason: 'Model downloadable.' };
                case 'downloading':
                    console.log('[AI Service] Status: DOWNLOADING');
                    return { available: false, status: 'downloading', reason: 'Model downloading.' };
                default:
                    console.log('[AI Service] Status: UNKNOWN -', availability);
                    return { available: false, status: 'unavailable', reason: 'Model unavailable.' };
            }
        }

        console.log('[AI Service] No AI API found!');
        return {
            available: false,
            status: 'not_supported',
            reason: 'Chrome AI API not found. Enable chrome://flags/#optimization-guide-on-device-model'
        };

    } catch (error) {
        console.error('[AI Service] Error checking local AI:', error);
        console.error('[AI Service] Error stack:', error.stack);
        return {
            available: false,
            status: 'error',
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
    console.log('[AI Service] === Getting Local AI Session ===');
    console.log('[AI Service] Current session exists:', !!localAISession);
    console.log('[AI Service] SystemPrompt length:', systemPrompt?.length || 0);

    try {
        // Destroy existing session if system prompt changed
        if (localAISession && cachedSystemPrompt !== systemPrompt) {
            console.log('[AI Service] System prompt changed, destroying old session');
            if (localAISession.destroy) localAISession.destroy();
            localAISession = null;
        }

        // Reuse existing session
        if (localAISession) {
            console.log('[AI Service] Reusing existing session');
            return localAISession;
        }

        // Create new session
        console.log('[AI Service] Creating new local AI session...');
        console.log('[AI Service] self.ai exists:', !!self.ai);
        console.log('[AI Service] self.ai.languageModel exists:', !!(self.ai && self.ai.languageModel));
        console.log('[AI Service] LanguageModel global exists:', typeof LanguageModel !== 'undefined');

        // Try modern API
        if (self.ai && self.ai.languageModel) {
            console.log('[AI Service] Creating session with MODERN self.ai.languageModel API');
            console.log('[AI Service] Session params: { systemPrompt: [truncated], outputLanguage: "en", expectedOutputLanguages: ["en"] }');

            localAISession = await self.ai.languageModel.create({
                systemPrompt: systemPrompt,
                outputLanguage: 'en', // Required by Chrome AI API - singular for modern API
                expectedOutputLanguages: ['en']  // Also include array form for compatibility
            });
            console.log('[AI Service] Session created successfully via modern API');
        }
        // Fallback to legacy API
        else if (typeof LanguageModel !== 'undefined') {
            console.log('[AI Service] Creating session with LEGACY LanguageModel API');
            console.log('[AI Service] Session params: { systemPrompt: [truncated], expectedOutputLanguages: ["en"], outputLanguage: "en" }');

            localAISession = await LanguageModel.create({
                systemPrompt: systemPrompt,
                expectedOutputLanguages: ['en'], // Legacy param
                outputLanguage: 'en'  // Also include modern param for compatibility
            });
            console.log('[AI Service] Session created successfully via legacy API');
        } else {
            console.error('[AI Service] No Local AI API found!');
            throw new Error('Local AI API not found');
        }

        cachedSystemPrompt = systemPrompt;
        return localAISession;

    } catch (error) {
        console.error('[AI Service] Error creating local AI session:', error);
        console.error('[AI Service] Error name:', error.name);
        console.error('[AI Service] Error message:', error.message);
        console.error('[AI Service] Error stack:', error.stack);
        throw error;
    }
}

/**
 * Generate text using local AI (Gemini Nano)
 * @param {string} userPrompt - The user's input text to polish
 * @param {string} systemInstruction - The system instruction for polishing
 * @returns {Promise<string>} - The polished text
 */
async function generateWithLocalAI(userPrompt, systemInstruction) {
    const startTotal = performance.now();

    // 3-LAYER PROMPT STRUCTURE:
    // Layer 1: System Instruction (persona-specific)
    // Layer 2: User Input (the text to polish)
    // Layer 3: Meta Prompt (forces AI to return only the rewritten prompt)
    const combinedPrompt = `${systemInstruction}

--- USER INPUT TO REWRITE ---
${userPrompt}
--- END USER INPUT ---
${META_PROMPT}`;

    console.log('[AI Service] Combined Prompt:', combinedPrompt);

    const sessionStart = performance.now();
    // We pass the system instruction to the session creation too, just in case,
    // but the combined prompt is our primary enforcement mechanism.
    const session = await getLocalAISession(systemInstruction);
    const sessionTime = performance.now() - sessionStart;

    console.log(`[AI Service] Session creation/retrieval took ${sessionTime.toFixed(2)}ms`);
    console.log('[AI Service] Sending prompt to local AI...');

    const promptStart = performance.now();
    const result = await session.prompt(combinedPrompt); // Send the combined prompt
    const promptTime = performance.now() - promptStart;

    console.log(`[AI Service] Local AI response received in ${promptTime.toFixed(2)}ms`);

    return {
        text: result,
        timings: {
            session: sessionTime,
            inference: promptTime,
            total: performance.now() - startTotal
        }
    };
}

// ============================================================
// CLOUD AI (Gemini Flash) FUNCTIONS
// ============================================================

/**
 * Generate text using cloud AI (Gemini Flash API)
 * @param {string} userPrompt - The user's input text to polish
 * @param {string} systemInstruction - The system instruction for polishing
 * @param {string} apiKey - The user's Google Gemini API key
 * @param {string} model - The Gemini model to use (e.g., 'gemini-2.5-flash-preview-05-20')
 * @returns {Promise<string>} - The polished text
 */
async function generateWithCloudAI(userPrompt, systemInstruction, apiKey, model = DEFAULT_GEMINI_MODEL) {
    console.log(`[AI Service] Sending prompt to cloud AI (Gemini - ${model})...`);
    console.log('[AI Service] Prompt length:', userPrompt.length, 'chars');
    console.log('[AI Service] System instruction length:', systemInstruction.length, 'chars');

    // 3-LAYER PROMPT STRUCTURE for Cloud AI:
    // Layer 1: System Instruction (persona-specific + meta prompt)
    // Layer 2: User Input (the text to polish)
    // The meta prompt is appended to system instruction for Cloud API
    const fullSystemInstruction = `${systemInstruction}\n${META_PROMPT}`;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: `--- USER INPUT TO REWRITE ---\n${userPrompt}\n--- END USER INPUT ---` }
                ]
            }
        ],
        systemInstruction: {
            parts: [
                { text: fullSystemInstruction }
            ]
        },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
        }
    };

    try {
        const apiEndpoint = `${GEMINI_API_BASE_URL}/${model}:generateContent`;
        const fullUrl = `${apiEndpoint}?key=${apiKey}`;
        const maskedUrl = `${apiEndpoint}?key=${apiKey.substring(0, 8)}...`;
        console.log('[AI Service] Making request to:', maskedUrl);
        console.log('[AI Service] Request body:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('[AI Service] Response status:', response.status, response.statusText);
        console.log('[AI Service] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            // Get raw text first for debugging
            const rawErrorText = await response.text();
            console.error('[AI Service] RAW ERROR RESPONSE:', rawErrorText);

            // Try to parse as JSON
            let errorData = {};
            try {
                errorData = JSON.parse(rawErrorText);
            } catch (e) {
                console.error('[AI Service] Could not parse error as JSON');
            }

            const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            const errorDetails = errorData.error?.details || [];
            const errorCode = errorData.error?.code;
            const errorStatus = errorData.error?.status;

            // Log full error for debugging
            console.error('[AI Service] Cloud AI Error Response:', {
                status: response.status,
                statusText: response.statusText,
                errorCode,
                errorStatus,
                errorMessage,
                errorDetails,
                fullError: errorData,
                rawResponse: rawErrorText.substring(0, 1000),
                promptSent: userPrompt.substring(0, 200) + (userPrompt.length > 200 ? '...' : ''),
                promptLength: userPrompt.length,
                systemInstructionLength: systemInstruction.length
            });

            if (response.status === 400) {
                throw new Error(`Invalid API request: ${errorMessage}`);
            } else if (response.status === 401 || response.status === 403) {
                throw new Error(`Invalid API key (${errorStatus || response.status}): ${errorMessage}`);
            } else if (response.status === 429) {
                // Extract quota/retry details from response headers or body
                const retryAfter = response.headers.get('Retry-After');
                const quotaDetails = errorDetails.find(d => d.reason === 'RATE_LIMIT_EXCEEDED' || d['@type']?.includes('QuotaFailure'));

                // Build detailed error message
                let detailedMsg = `Rate limit (${response.status}): ${errorMessage}`;

                if (retryAfter) {
                    detailedMsg += ` Retry after: ${retryAfter}s.`;
                }

                if (quotaDetails && quotaDetails.violations) {
                    console.error('[AI Service] Quota details:', quotaDetails);
                    const violations = quotaDetails.violations.map(v => `${v.subject || 'unknown'}: ${v.description || 'unknown'}`).join('; ');
                    detailedMsg += ` Quota: ${violations}.`;
                }

                // Log what was sent for debugging
                console.error('[AI Service] Request that caused rate limit:', {
                    promptPreview: userPrompt.substring(0, 500),
                    promptLength: userPrompt.length,
                    systemInstructionPreview: systemInstruction.substring(0, 200),
                    timestamp: new Date().toISOString()
                });

                detailedMsg += ` Try "Auto" mode for local AI fallback.`;

                throw new Error(detailedMsg);
            } else {
                throw new Error(`Cloud AI error (${response.status}): ${errorMessage}`);
            }
        }

        const data = await response.json();

        // Extract text from response
        const candidates = data.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('No response generated from cloud AI');
        }

        const text = candidates[0].content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('Empty response from cloud AI');
        }

        console.log('[AI Service] Cloud AI response received');
        return text;

    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
    }
}

// ============================================================
// GROQ AI FUNCTIONS
// ============================================================

/**
 * Generate text using Groq API
 * @param {string} userPrompt - The user's input text to polish
 * @param {string} systemInstruction - The system instruction for polishing
 * @param {string} apiKey - The user's Groq API key
 * @param {string} model - The Groq model to use
 * @returns {Promise<string>} - The polished text
 */
async function generateWithGroqAI(userPrompt, systemInstruction, apiKey, model = DEFAULT_GROQ_MODEL) {
    console.log(`[AI Service] Sending prompt to Groq AI (Model: ${model})...`);
    console.log('[AI Service] Prompt length:', userPrompt.length, 'chars');

    const requestBody = {
        messages: [
            {
                role: "system",
                content: `${systemInstruction}\n${META_PROMPT}`
            },
            {
                role: "user",
                content: `--- USER INPUT TO REWRITE ---\n${userPrompt}\n--- END USER INPUT ---`
            }
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

        console.log('[AI Service] Groq Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            console.error('[AI Service] Groq AI Error:', errorMessage);

            if (response.status === 401) {
                throw new Error('Invalid Groq API key');
            } else if (response.status === 429) {
                throw new Error('Groq rate limit exceeded');
            } else {
                throw new Error(`Groq AI error: ${errorMessage}`);
            }
        }

        const data = await response.json();

        const text = data.choices?.[0]?.message?.content;
        if (!text) {
            throw new Error('Empty response from Groq AI');
        }

        return text;

    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
    }
}

const PROVIDER_HANDLERS = {
    'gemini': {
        name: 'Gemini',
        generate: async (userPrompt, systemInstruction, config) => {
            if (!config.geminiApiKey || config.geminiApiKey.trim().length === 0) {
                throw new Error('Gemini API Key missing');
            }
            return await generateWithCloudAI(userPrompt, systemInstruction, config.geminiApiKey, config.geminiModel);
        }
    },
    'groq': {
        name: 'Groq',
        generate: async (userPrompt, systemInstruction, config) => {
            if (!config.groqApiKey || config.groqApiKey.trim().length === 0) {
                throw new Error('Groq API Key missing');
            }
            return await generateWithGroqAI(userPrompt, systemInstruction, config.groqApiKey, config.groqModel);
        }
    }
};

// ============================================================
// UNIFIED API
// ============================================================

/**
 * Get the current AI mode based on availability and user preference
 * @param {string} apiKey - Optional API key to check
 * @returns {Promise<{mode: string, status: string, details: string}>}
 */
async function getAIMode(apiKey = null) {
    // Get user preference
    let preferredMode = 'cloud';
    try {
        const storage = await chrome.storage.sync.get(['aiMode']);
        preferredMode = storage.aiMode || 'cloud';
    } catch (e) {
        console.warn('Error reading aiMode config:', e);
    }

    const localAvailability = await checkLocalAIAvailability();

    // --- Mode: Local Only ---
    if (preferredMode === 'local') {
        if (localAvailability.available) {
            return {
                mode: 'local',
                status: '⚡ Local Only (Gemini Nano)',
                details: 'Using on-device Chrome AI.'
            };
        }
        return {
            mode: 'none',
            status: '❌ Local AI Unavailable',
            details: localAvailability.reason || 'Browser does not support Gemini Nano. Check chrome://flags.'
        };
    }

    // --- Mode: Cloud Only ---
    if (preferredMode === 'cloud') {
        if (apiKey && apiKey.trim().length > 0) {
            return {
                mode: 'cloud',
                status: '☁️ Cloud Only (Gemini Flash)',
                details: 'Using Google Cloud API.'
            };
        }
        return {
            mode: 'none',
            status: '❌ API Key Required',
            details: 'Cloud Only mode requires a Google Gemini API key.'
        };
    }

    // --- Mode: Cloud Only (Groq) ---
    // Note: Since we don't pass provider preference here yet, this logic is minimal.
    // The main getAIMode will need to be updated to check config if we want specific status for Groq.
    // For now, if we are in cloud mode, checking Gemini Key is the default behavior unless we update calls.



    // --- Mode: Hybrid (REMOVED) ---
    // Strict Mode Enforcement

    // Fallback if nothing matches (or if preferredMode was somehow hybrid)
    return {
        mode: 'none',
        status: '⚠️ Select AI Mode',
        details: 'Please choose Local or Cloud in settings.'
    };
}

/**
 * Main unified function to generate polished text
 * Priority depends on user preference:
 * Auto: Cloud AI → Local AI (Gemini Nano)
 * Forced: Specific Mode → Error
 * 
 * @param {string} userPrompt - The user's input text to polish
 * @param {string} systemInstruction - The system instruction for polishing
 * @returns {Promise<{success: boolean, text?: string, error?: string, mode: string}>}
 */
async function generatePolishedText(userPrompt, systemInstruction) {
    console.log('[AI Service] generatePolishedText called');
    console.log('[AI Service] Input prompt length:', userPrompt?.length || 0);
    console.log('[AI Service] System instruction length:', systemInstruction?.length || 0);

    let preferredMode = 'hybrid';
    let cloudProvider = 'gemini';
    let geminiApiKey = null;
    let geminiModel = null;
    let groqApiKey = null;
    let groqModel = null;

    try {
        const storage = await chrome.storage.sync.get(['geminiApiKey', 'groqApiKey', 'groqModel', 'cloudModel', 'aiMode', 'cloudProvider']);
        geminiApiKey = storage.geminiApiKey;
        groqApiKey = storage.groqApiKey;
        // cloudModel is the unified model selection storage key
        cloudProvider = storage.cloudProvider || 'gemini';

        // Assign models based on active provider to avoid mixing them up
        if (cloudProvider === 'gemini') {
            geminiModel = storage.cloudModel || DEFAULT_GEMINI_MODEL;
            groqModel = storage.groqModel || DEFAULT_GROQ_MODEL;
        } else if (cloudProvider === 'groq') {
            groqModel = storage.cloudModel || storage.groqModel || DEFAULT_GROQ_MODEL;
            geminiModel = DEFAULT_GEMINI_MODEL;
        } else {
            geminiModel = DEFAULT_GEMINI_MODEL;
            groqModel = DEFAULT_GROQ_MODEL;
        }

        preferredMode = storage.aiMode || 'cloud'; // Default to cloud if not set (safer default than hybrid now)

        // Smart mode fallback: if no mode stored or legacy hybrid mode
        if (!storage.aiMode || preferredMode === 'hybrid') {
            // Check availability to determine mode
            const localAvail = await checkLocalAIAvailability();
            const hasApiKey = (geminiApiKey && geminiApiKey.trim().length > 0) ||
                (groqApiKey && groqApiKey.trim().length > 0);

            if (hasApiKey) {
                preferredMode = 'cloud';
            } else if (localAvail.available) {
                preferredMode = 'local';
            } else {
                preferredMode = 'cloud'; // Default fallback
            }
            console.log('[AI Service] Smart mode fallback selected:', preferredMode);
        }

        // Debug: Log API key status (safely)
        console.log('[AI Service] Cloud Provider:', cloudProvider);
        console.log('[AI Service] Gemini Model:', geminiModel);
        console.log('[AI Service] Groq Model:', groqModel);
        console.log('[AI Service] Gemini Key:', geminiApiKey ? 'SET' : 'NOT SET');
        console.log('[AI Service] Groq Key:', groqApiKey ? 'SET' : 'NOT SET');
        console.log('[AI Service] Preferred mode:', preferredMode);
    } catch (error) {
        console.error('[AI Service] Error accessing storage:', error);
    }


    // --- Helper for execution ---

    /**
     * Helper to clean up response by stripping <result> tags
     */
    const cleanAIResponse = (text) => {
        if (!text) return '';
        // Match content inside <result>...</result>, case insensitive, across lines
        const match = text.match(/<result>([\s\S]*?)<\/result>/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        // Fallback: return original text if no tags found
        return text.trim();
    };

    const tryGeminiNano = async () => {
        const avail = await checkLocalAIAvailability();
        if (avail.available) {
            console.log('[AI Service] Attempting local Gemini Nano...');
            const result = await generateWithLocalAI(userPrompt, systemInstruction);
            return {
                success: true,
                text: cleanAIResponse(result.text),
                timings: result.timings,
                mode: 'local'
            };
        }
        throw new Error('Gemini Nano unavailable: ' + avail.reason);
    };

    const tryCloud = async () => {
        const handler = PROVIDER_HANDLERS[cloudProvider];

        if (handler) {
            console.log(`[AI Service] Using Cloud Provider: ${handler.name}`);
            // Pass all keys/config to the handler, let it pick what it needs
            const config = {
                geminiApiKey,
                geminiModel,
                groqApiKey,
                groqModel
            };

            const rawText = await handler.generate(userPrompt, systemInstruction, config);
            return {
                success: true,
                text: cleanAIResponse(rawText),
                mode: `cloud-${cloudProvider}`
            };
        } else {
            console.error(`[AI Service] Unknown cloud provider: ${cloudProvider}`);
            throw new Error(`Unknown cloud provider: ${cloudProvider}`);
        }
    };

    // --- Execution Logic ---

    // 1. Local Only Mode
    if (preferredMode === 'local') {
        try { return await tryGeminiNano(); }
        catch (e) { return { success: false, error: 'Local Only mode failed: ' + e.message, mode: 'local' }; }
    }

    // 2. Cloud Only Mode
    if (preferredMode === 'cloud') {
        try { return await tryCloud(); }
        catch (e) { return { success: false, error: 'Cloud Only mode failed: ' + e.message, mode: 'cloud' }; }
    }

    // If we get here, something is wrong with mode config
    return {
        success: false,
        error: 'Invalid AI Mode selected. Please check settings.',
        mode: 'none'
    };
}



// Export for use in other modules
export const AIService = {
    generatePolishedText,
    checkLocalAIAvailability,
    getAIMode
};

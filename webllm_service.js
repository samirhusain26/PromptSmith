/**
 * PromptSmith - WebLLM Service
 * 
 * Handles local in-browser AI using WebLLM and WebGPU.
 * Priority 3 in the fallback chain.
 */

import { DEFAULT_MODEL_ID } from './constants.js';

// State tracks
let webllmEngine = null;
let currentModelId = null;
let downloadProgress = { status: 'idle', text: '', progress: 0 };

/**
 * Check if WebLLM is supported and ready
 */
async function checkWebLLMAvailability() {
    // 1. Check WebGPU support
    if (!navigator.gpu) {
        return {
            available: false,
            status: 'not_supported',
            reason: 'WebGPU is not supported in this browser environment.'
        };
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            return {
                available: false,
                status: 'not_supported',
                reason: 'No WebGPU adapter found.'
            };
        }
    } catch (e) {
        return {
            available: false,
            status: 'error',
            reason: 'Error checking WebGPU: ' + e.message
        };
    }

    // 2. Check if engine is loaded
    if (webllmEngine) {
        return { available: true, status: 'ready', model: currentModelId };
    }

    return {
        available: true,
        status: 'ready_to_init',
        reason: 'WebGPU available. Model needs to be loaded.'
    };
}

/**
 * Initialize/Download the WebLLM model
 * @param {string} modelId - The ID of the model to load
 * @param {Function} progressCallback - Optional callback for download progress
 */
async function loadWebLLMModel(modelId = DEFAULT_MODEL_ID, progressCallback = null) {
    // If already loaded with same model, return
    if (webllmEngine && currentModelId === modelId) {
        return true;
    }

    // Ensure self.webllm is available
    if (!self.webllm) {
        throw new Error('WebLLM library not loaded');
    }

    console.log(`[WebLLM] Starting engine initialization for ${modelId}...`);

    try {
        const initProgressCallback = (report) => {
            console.log('[WebLLM] Init:', report.text);

            downloadProgress = {
                status: 'downloading',
                text: report.text,
                progress: report.progress
            };

            if (progressCallback) progressCallback(report);

            chrome.runtime.sendMessage({
                type: 'WEBLLM_PROGRESS',
                data: downloadProgress
            }).catch(() => { });
        };

        // Initialize engine (CreateMLCEngine is cleaner if available, but staying consistent with existing pattern)
        const engine = new self.webllm.MLCEngine();

        await engine.reload(modelId, {
            initProgressCallback: initProgressCallback
        });

        webllmEngine = engine;
        currentModelId = modelId;
        downloadProgress = { status: 'ready', text: 'Model loaded', progress: 1.0 };

        console.log('[WebLLM] Engine ready');
        return true;

    } catch (error) {
        console.error('[WebLLM] Load error:', error);

        // Provide more detailed error messages based on error type
        let errorMessage = error.message;

        // Network/fetch errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Network error: Failed to download model from MLC AI servers. Check your internet connection and try again.';
        }
        // CSP errors
        else if (error.message.includes('Content Security Policy') || error.message.includes('CSP')) {
            errorMessage = 'Security policy error: The browser blocked the download. Please reload the extension and try again.';
        }
        // WebGPU errors
        else if (error.message.includes('WebGPU') || error.message.includes('GPU')) {
            errorMessage = 'GPU error: ' + error.message + '. Your device may not support WebGPU.';
        }
        // Generic fetch failures
        else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Failed to download model. This may be due to:\n• Network connectivity issues\n• Browser blocking the download\n• MLC AI servers unavailable\n\nTry reloading the extension (chrome://extensions) and ensure you have a stable internet connection.';
        }

        console.error('[WebLLM] Detailed error:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            modelId: modelId
        });

        downloadProgress = { status: 'error', text: errorMessage, progress: 0 };
        throw new Error(errorMessage);
    }
}

/**
 * Delete cached model data to free space
 */
async function deleteWebLLMModel() {
    try {
        // Unload engine if active
        if (webllmEngine) {
            await webllmEngine.unload();
            webllmEngine = null;
            currentModelId = null;
        }

        // Clear WebLLM caches
        // Note: WebLLM uses 'webllm/model' and 'webllm/wasm' caches usually.
        // We will try to delete the standard ones.
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
            if (key.startsWith('webllm/')) {
                console.log(`[WebLLM] Deleting cache: ${key}`);
                await caches.delete(key);
            }
        }

        downloadProgress = { status: 'idle', text: 'Model deleted', progress: 0 };
        return true;
    } catch (e) {
        console.error('[WebLLM] Error deleting model:', e);
        throw e;
    }
}

/**
 * Generate text using WebLLM
 */
async function generateWithWebLLM(userPrompt, systemInstruction) {
    if (!webllmEngine) {
        // Fallback to default if not loaded (or handle error)
        await loadWebLLMModel(DEFAULT_MODEL_ID);
    }

    console.log('[WebLLM] Generating...');

    try {
        const messages = [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt }
        ];

        const reply = await webllmEngine.chat.completions.create({
            messages,
            temperature: 0.7,
            max_tokens: 2048,
        });

        return reply.choices[0].message.content;

    } catch (error) {
        console.error('[WebLLM] Generation failed:', error);
        if (error.message.includes('DeviceLost') || error.message.includes('OOM')) {
            webllmEngine = null;
            currentModelId = null;
        }
        throw error;
    }
}

/**
 * Get current download/init progress
 */
function getWebLLMProgress() {
    return downloadProgress;
}

// Export object for ES Module
export const WebLLMService = {
    checkAvailability: checkWebLLMAvailability,
    loadModel: loadWebLLMModel,
    deleteModel: deleteWebLLMModel,
    generate: generateWithWebLLM,
    getProgress: getWebLLMProgress,
    get modelId() { return currentModelId || DEFAULT_MODEL_ID; }
};

/**
 * PromptSmith - Background Service Worker
 * 
 * This service worker handles:
 * - Extension installation/updates
 * - Opening options page on action click
 * - Message passing between content scripts and AI service
 * - Unified AI generation with hybrid local/cloud fallback
 */

// Import dependencies as modules
import * as webllm from './webllm_lib.js';
import { WebLLMService } from './webllm_service.js';
import { AIService } from './ai_service.js';

// Attach services to global scope for debugging/interaction if needed
self.webllm = webllm;
self.WebLLMService = WebLLMService;
self.AIService = AIService;

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = 'Rewrite this prompt to be clear, concise, and professional. Fix any grammar errors.';

// ============================================================
// INSTALLATION & LIFECYCLE
// ============================================================

// Initialize default settings on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      aiMode: 'auto' // Default to auto mode
    }, () => {
      console.log('[PromptSmith] Default settings initialized');
    });
  }

  console.log(`[PromptSmith] Extension ${details.reason}: v${chrome.runtime.getManifest().version}`);
});

// Open options page when extension action is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

// ============================================================
// KEEP ALIVE
// ============================================================

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keep-alive') {
    // Keep port open to prevent service worker from sleeping
    port.onMessage.addListener((msg) => {
      // Handle ping if needed, or just ignore (activity keeps it alive)
      if (msg.type === 'ping') {
        // Optional: reply pong
      }
    });

    port.onDisconnect.addListener(() => {
      // Port closed
    });
  }
});

// ============================================================
// MESSAGE HANDLERS
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle get settings request
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['systemPrompt'], (result) => {
      sendResponse({
        systemPrompt: result.systemPrompt || DEFAULT_SYSTEM_PROMPT
      });
    });
    return true; // Required for async sendResponse
  }

  // Handle get AI mode/status request
  if (message.type === 'GET_AI_MODE') {
    handleGetAIMode(sendResponse);
    return true; // Required for async sendResponse
  }

  // Handle polish text request (main AI generation)
  if (message.type === 'POLISH_TEXT') {
    handlePolishText(message.text, sendResponse, message.systemPrompt);
    return true; // Required for async sendResponse
  }

  // Handle WebLLM Download
  if (message.type === 'START_WEBLLM_DOWNLOAD') {
    handleWebLLMDownload(sendResponse);
    return true;
  }

  // Handle WebLLM Progress Check
  if (message.type === 'GET_WEBLLM_PROGRESS') {
    if (self.WebLLMService) {
      sendResponse(self.WebLLMService.getProgress());
    } else {
      sendResponse({ status: 'error', text: 'Service not loaded', progress: 0 });
    }
    return true; // Required for async sendResponse
  }
});

/**
 * Handle WebLLM model download trigger
 */
async function handleWebLLMDownload(sendResponse) {
  if (self.WebLLMService) {
    try {
      // Start download (async)
      self.WebLLMService.loadModel();
      sendResponse({ success: true, status: 'started' });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  } else {
    sendResponse({ success: false, error: 'WebLLM Service not available' });
  }
}

/**
 * Get current AI mode (local/cloud/none)
 */
async function handleGetAIMode(sendResponse) {
  try {
    const storage = await chrome.storage.sync.get(['geminiApiKey']);
    const apiKey = storage.geminiApiKey || null;

    if (self.AIService && self.AIService.getAIMode) {
      const mode = await self.AIService.getAIMode(apiKey);
      sendResponse(mode);
    } else {
      sendResponse({
        mode: 'error',
        status: '❌ AI Service Error',
        details: 'AI service not loaded properly.'
      });
    }
  } catch (error) {
    console.error('[PromptSmith] Error getting AI mode:', error);
    sendResponse({
      mode: 'error',
      status: '❌ Error',
      details: error.message
    });
  }
}

/**
 * Handle text polishing request from content script
 */
async function handlePolishText(text, sendResponse, tempSystemPrompt = null) {
  console.log('[PromptSmith] Received polish request');

  try {
    // Determine which system prompt to use
    let systemPrompt = tempSystemPrompt;

    if (!systemPrompt) {
      // Fallback to stored settings if no specific prompt provided
      const storage = await chrome.storage.sync.get(['systemPrompt']);
      systemPrompt = storage.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    }

    // Use AI service to generate polished text
    if (self.AIService && self.AIService.generatePolishedText) {
      const result = await self.AIService.generatePolishedText(text, systemPrompt);
      console.log('[PromptSmith] AI generation result:', result.success ? 'success' : 'failed', 'mode:', result.mode);
      sendResponse(result);
    } else {
      sendResponse({
        success: false,
        error: 'AI service not available. Please reload the extension.',
        mode: 'error'
      });
    }
  } catch (error) {
    console.error('[PromptSmith] Error in handlePolishText:', error);
    sendResponse({
      success: false,
      error: error.message || 'Unknown error occurred',
      mode: 'error'
    });
  }
}

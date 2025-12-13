/**
 * PromptSmith - Content Script
 * 
 * Injects a "✨ Polish" button into ChatGPT, Claude, and Gemini interfaces.
 * Uses MutationObserver for robust detection on SPAs.
 * Communicates with background service worker for AI processing.
 */

(function () {
    'use strict';

    // ============================================================
    // CONSTANTS & CONFIG
    // ============================================================

    const ICONS = {
        sparkle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L14.39 8.26L20 12L14.39 15.74L12 22L9.61 15.74L4 12L9.61 8.26L12 2Z" fill="currentColor"/></svg>',
        chevronDown: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    const PERSONAS = {
        polisher: {
            icon: '✨',
            label: 'The Polisher (Fix Grammar)',
            description: 'Refines your prompt for clarity, conciseness,\nand professional tone.',
            instruction: 'Rewrite this prompt to be clear, concise, and professional. Fix any grammar errors. CRITICAL OUTPUT RULES: You must output ONLY the rewritten prompt. Do NOT include any conversational filler, preambles (e.g., "Here is the prompt"), or postscripts. Enclose the final result strictly within <result> tags. Example Format: <result> [The polished prompt text goes here] </result>'
        },
        architect: {
            icon: '📐',
            label: 'The Architect (Solve Complex Problems)',
            description: 'Uses "Tree of Thoughts" to explore multiple\nreasoning branches.',
            instruction: `You are an expert Prompt Engineer specializing in "Tree of Thoughts" (ToT). Rewrite the user's prompt to force a Large Language Model (LLM) to use "System 2" thinking. The new prompt must require the model to simulate multiple experts, explore multiple reasoning branches, and evaluate its own steps before concluding. CRITICAL OUTPUT RULES: You must output ONLY the rewritten prompt. Do NOT include any conversational filler, preambles (e.g., "Here is the prompt"), or postscripts. Enclose the final result strictly within <result> tags. Example Format: <result> [The polished prompt text goes here] </result>`
        },
        agent: {
            icon: '🤖',
            label: 'The Agent (Verify Facts)',
            description: 'Enforces an "Action-Observation-Reflection"\nloop for grounded reasoning.',
            instruction: `You are an expert in Agentic AI patterns (ReAct, Reflexion). Rewrite the user's prompt to enforce a strict "Action-Observation-Reflection" loop. Explicitly instruct the model to "ground its reasoning in observed reality" and "cite sources." CRITICAL OUTPUT RULES: You must output ONLY the rewritten prompt. Do NOT include any conversational filler, preambles (e.g., "Here is the prompt"), or postscripts. Enclose the final result strictly within <result> tags. Example Format: <result> [The polished prompt text goes here] </result>`
        },
        compiler: {
            icon: '💻',
            label: 'The Compiler (Optimize for Production)',
            description: 'Optimizes the prompt structure into a\ndeclarative DSPy signature.',
            instruction: `You are a DSPy Optimization Specialist. Treat the user's prompt not as conversation, but as a software program. Strip away conversational fluff and restructure it into a declarative "Signature" with Context, Task, Constraints, and Metric. CRITICAL OUTPUT RULES: You must output ONLY the rewritten prompt. Do NOT include any conversational filler, preambles (e.g., "Here is the prompt"), or postscripts. Enclose the final result strictly within <result> tags. Example Format: <result> [The polished prompt text goes here] </result>`
        },
        structurer: {
            icon: '🔧',
            label: 'The Structurer (Generate Code/JSON)',
            description: 'Guarantees valid, parsable output like\nJSON or XML.',
            instruction: `You are a Syntax Enforcement Engineer. Rewrite the user's prompt to guarantee the output is valid, parsable code (XML or JSON). If ambiguous, default to XML. Add a "negative constraint": "Do not include markdown formatting or conversational filler outside the tags". CRITICAL OUTPUT RULES: You must output ONLY the rewritten prompt. Do NOT include any conversational filler, preambles (e.g., "Here is the prompt"), or postscripts. Enclose the final result strictly within <result> tags. Example Format: <result> [The polished prompt text goes here] </result>`
        },
        primer: {
            icon: '🧠',
            label: 'The Primer (Creative Writing)',
            description: 'Uses "In-Context Learning" with robust\nfew-shot examples.',
            instruction: `You are a Contextual Scaling Strategist. Rewrite the prompt to utilize "In-Context Learning" (ICL). Create a "Template" structure with placeholders for "Few-Shot Examples" and a "Pre-fill" instruction. CRITICAL OUTPUT RULES: You must output ONLY the rewritten prompt. Do NOT include any conversational filler, preambles (e.g., "Here is the prompt"), or postscripts. Enclose the final result strictly within <result> tags. Example Format: <result> [The polished prompt text goes here] </result>`
        }
    };

    const CONFIG = {
        // Unique attribute to mark our injected elements
        MARKER_ATTR: 'data-lpp-injected',

        // Debounce delay for observer callbacks (ms)
        DEBOUNCE_DELAY: 300,

        // Max retries for finding input
        MAX_RETRIES: 50,

        // Retry interval (ms)
        RETRY_INTERVAL: 500,
    };

    // Site-specific selectors and configurations
    const SITE_CONFIGS = {
        chatgpt: {
            hostname: ['chat.openai.com', 'chatgpt.com'],
            inputSelectors: [
                '#prompt-textarea',
                'textarea[data-id="root"]',
                'div[contenteditable="true"][id="prompt-textarea"]',
                'form textarea',
            ],
            containerSelectors: [
                'form.w-full',
                'div[class*="composer"]',
                'main form',
            ],
            // Use toolbar positioning for native feel
            buttonPosition: 'toolbar-end',
        },

        claude: {
            hostname: ['claude.ai'],
            inputSelectors: [
                'div[contenteditable="true"][enterkeyhint="enter"]',
                'div[contenteditable="true"]',
                'fieldset div[contenteditable]',
            ],
            containerSelectors: [
                'fieldset',
                'form',
            ],
            buttonPosition: 'toolbar-end',
        },

        gemini: {
            hostname: ['gemini.google.com'],
            inputSelectors: [
                'rich-textarea div[contenteditable="true"]',
                '.ql-editor',
                'div[contenteditable="true"]',
            ],
            containerSelectors: [
                // Target the toolbar or input wrapper area
                '.input-area-container',
                'rich-textarea',
                'div[class*="input-area"]',
            ],
            // Special positioning for native feel
            buttonPosition: 'toolbar-end',
            // Selectors for finding the toolbar to inject into
            toolbarSelectors: [
                '.input-area-container > div:last-child', // Often the toolbar container
                'rich-textarea ~ div',
                'div[role="toolbar"]'
            ]
        },
    };

    // ============================================================
    // STATE
    // ============================================================

    let currentSite = null;
    let debounceTimer = null;
    let currentPersona = 'polisher'; // Default

    // Logic for dropdown state management
    let activeDropdownTrigger = null;
    let activeDropdownCleanup = null;

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /**
     * Inject styles for the extension
     */
    function injectStyles() {
        if (document.getElementById('lpp-styles')) return;

        const style = document.createElement('style');
        style.id = 'lpp-styles';
        style.textContent = `
            :root {
                --lpp-host-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .lpp-dropdown-portal, .lpp-tooltip, .lpp-button-group {
                font-family: var(--lpp-host-font) !important;
            }
            .lpp-button-group {
                display: inline-flex;
                align-items: center;
                margin-right: 8px; /* Spacing from other buttons */
                vertical-align: middle;
            }
            /* Adjustments for ChatGPT specifically to ensure it fits */

            .lpp-native-toolbar.lpp-chatgpt-toolbar {
                margin-right: 2px;
                /* height: 32px;  Remove fixed height to match native stretch */
                height: 100%;
                background: transparent !important;
                padding: 0;
                border: none !important;
                box-shadow: none !important;
                outline: none !important;
                display: flex;
                align-items: center; /* Vertical center */
            }
            .lpp-native-toolbar.lpp-chatgpt-toolbar .lpp-polish-action,
            .lpp-native-toolbar.lpp-chatgpt-toolbar .lpp-dropdown-trigger {
                background: transparent !important;
                color: #b4b4b4; /* Native-ish gray */
                border: none !important;
                box-shadow: none !important;
                outline: none !important;
                border-radius: 6px;
                padding: 4px 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                cursor: pointer;
                transition: background 0.2s, color 0.2s;
            }
            .lpp-native-toolbar.lpp-chatgpt-toolbar .lpp-polish-action:hover,
            .lpp-native-toolbar.lpp-chatgpt-toolbar .lpp-dropdown-trigger:hover {
                background: rgba(255, 255, 255, 0.1); /* Dark mode hover */
                color: #fff;
            }
            .lpp-native-toolbar.lpp-chatgpt-toolbar .lpp-dropdown-trigger {
                padding: 4px; /* Smaller padding for arrow */
                margin-left: 2px;
            }
            .lpp-dropdown-portal {
                font-size: 14px;
                background: #1e1e1e;
                border: 1px solid #333;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                z-index: 2147483647; /* Max z-index to ensure visibility */
                overflow: hidden;
                display: flex;
                flex-direction: column;
                min-width: 250px;
                max-width: 350px;
                padding: 4px;
            }
            .lpp-dropdown-item {
                display: flex;
                align-items: center; /* Compact again */
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 6px;
                color: #e8eaed;
                transition: background 0.2s;
            }
            .lpp-dropdown-item:hover, .lpp-dropdown-item.selected {
                background: #333;
            }
            .lpp-item-icon {
                font-size: 1.2em;
                margin-right: 12px;
                flex-shrink: 0;
            }
            .lpp-item-label {
                font-weight: 500;
                font-size: 13px;
                color: #e8eaed;
            }
            /* Tooltip Style */
            .lpp-tooltip {
                position: fixed;
                background: #000;
                color: #fff;
                border: 1px solid #333;
                padding: 8px 12px;
                border-radius: 6px;
                z-index: 10001;
                pointer-events: none;
                max-width: 200px;
                font-size: 12px;
                line-height: 1.4;
                box-shadow: 0 4px 8px rgba(0,0,0,0.5);
            }

            /* Claude Native Toolbar Styles */
            .lpp-native-toolbar.lpp-claude-toolbar {
                margin-left: 0; /* Let flex gap handle it, or minimal spacing */
                height: 32px;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 4px; /* Squared look */
                display: inline-flex;
                align-items: center;
                padding: 0 2px;
            }
            .lpp-native-toolbar.lpp-claude-toolbar .lpp-polish-action,
            .lpp-native-toolbar.lpp-claude-toolbar .lpp-dropdown-trigger {
                background: transparent !important;
                color: #525252; /* Light mode default */
                border: none !important;
                box-shadow: none !important;
                border-radius: 4px;
                padding: 4px 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                cursor: pointer;
                transition: all 0.2s;
            }
            /* Dark mode override for Claude */
            @media (prefers-color-scheme: dark) {
                .lpp-native-toolbar.lpp-claude-toolbar .lpp-polish-action,
                .lpp-native-toolbar.lpp-claude-toolbar .lpp-dropdown-trigger {
                    color: #d4d4d4;
                }
                .lpp-native-toolbar.lpp-claude-toolbar .lpp-polish-action:hover,
                .lpp-native-toolbar.lpp-claude-toolbar .lpp-dropdown-trigger:hover {
                     background: rgba(255, 255, 255, 0.1) !important;
                     color: #fff;
                }
            }
            /* Light mode hover */
            @media (prefers-color-scheme: light) {
                 .lpp-native-toolbar.lpp-claude-toolbar .lpp-polish-action:hover,
                 .lpp-native-toolbar.lpp-claude-toolbar .lpp-dropdown-trigger:hover {
                    background: rgba(0, 0, 0, 0.05) !important;
                    color: #000;
                 }
            }
            .lpp-native-toolbar.lpp-claude-toolbar .lpp-dropdown-trigger {
                padding: 4px 2px;
                margin-left: 0;
            }

            /* Gemini Native Toolbar Styles */
            .lpp-native-toolbar.lpp-gemini-toolbar {
                display: inline-flex;
                align-items: center;
                height: 48px; /* Standard Gemini toolbar height */
                width: 48px;  /* Make it circular/square like other tools */
                justify-content: center;
                margin: 0;
                padding: 0;
                border-radius: 50%; /* Circular touch target */
                background: transparent !important;
                color: var(--lpp-gemini-icon-color, #444746); /* Default dark gray */
                transition: background-color 0.2s;
                cursor: pointer;
            }

            /* Dark mode for Gemini logic (often handled by site variables, but good to have fallback) */
            @media (prefers-color-scheme: dark) {
                .lpp-native-toolbar.lpp-gemini-toolbar {
                     color: #e3e3e3;
                }
            }

            .lpp-native-toolbar.lpp-gemini-toolbar:hover {
                background-color: rgba(68, 71, 70, 0.08) !important; /* Material 3 hover */
            }
             @media (prefers-color-scheme: dark) {
                .lpp-native-toolbar.lpp-gemini-toolbar:hover {
                    background-color: rgba(227, 227, 227, 0.08) !important;
                }
             }

            .lpp-native-toolbar.lpp-gemini-toolbar .lpp-polish-action,
            .lpp-native-toolbar.lpp-gemini-toolbar .lpp-dropdown-trigger {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0;
                margin: 0;
                height: 100%;
                display: flex; /* Flex to center icon */
                align-items: center;
                justify-content: center;
                color: inherit; /* Inherit from wrapper */
                cursor: pointer;
            }

            /* Hide dropdown arrow for Gemini to look like a single action or handle it subtly */
            /* We want the split functionality, so maybe make the split invisible but clickable? */
            /* Or better: Just make the main icon open the dropdown if we want to save space? */
            /* User said "move it back to be in line... make it seem like it fits" */
            /* The user also mentioned "make the chtagpt and claude button are not changed". */
            /* Existing logic splits them. Let's try to keep the split but make it very compact. */

            .lpp-native-toolbar.lpp-gemini-toolbar .lpp-polish-action {
                 width: 100%; /* Take full width if we hide arrow, or share */
                 border-radius: 50%;
            }

            /* If we want to keep the dropdown trigger visible but integrated: */
             .lpp-native-toolbar.lpp-gemini-toolbar {
                /* Actually, Gemini tools are usually single buttons. 
                   Let's make it a pill shape if we have two buttons, or just a circle if we hide the arrow.
                   Given the "Native" requirement, a single circle is best. 
                   We can make the whole button trigger the action, and maybe a long press or right click? 
                   OR, we keep the split but make it a pill shape like [ ✨ | ▼ ] */
                
                width: auto; /* Allow growth for pill */
                border-radius: 24px; /* Pill radius */
                padding: 0 4px;
                border: none !important;
                box-shadow: none !important;
                outline: none !important;
            }
            
            .lpp-native-toolbar.lpp-gemini-toolbar .lpp-polish-action {
                width: 32px;
                height: 32px;
                border-radius: 50%;
            }
            .lpp-native-toolbar.lpp-gemini-toolbar .lpp-dropdown-trigger {
                 width: 16px; 
                 height: 32px;
                 border-radius: 16px; /* Pill end */
                 opacity: 0.6;
            }
            .lpp-native-toolbar.lpp-gemini-toolbar .lpp-polish-action:hover,
            .lpp-native-toolbar.lpp-gemini-toolbar .lpp-dropdown-trigger:hover {
                 background-color: rgba(68, 71, 70, 0.08) !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Detect which site we're on
     */
    function detectSite() {
        const hostname = window.location.hostname;

        for (const [siteName, config] of Object.entries(SITE_CONFIGS)) {
            if (config.hostname.some(h => hostname.includes(h))) {
                console.log(`[PromptSmith] Detected site: ${siteName}`);
                return siteName;
            }
        }
        return null;
    }

    /**
     * Find the main input element on the page
     */
    function findInputElement() {
        if (!currentSite) return null;

        const config = SITE_CONFIGS[currentSite];

        for (const selector of config.inputSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element && isElementVisible(element)) {
                    return element;
                }
            } catch (e) {
                // Selector might be invalid, continue
            }
        }
        return null;
    }

    /**
     * Find a suitable container for button injection
     */
    function findContainer(inputElement) {
        if (!currentSite || !inputElement) return null;

        const config = SITE_CONFIGS[currentSite];

        // First, try explicit container selectors
        for (const selector of config.containerSelectors) {
            try {
                const container = document.querySelector(selector);
                // For Gemini toolbar injection, we might not want strict containment
                if (config.buttonPosition === 'toolbar-end' && container) {
                    return container;
                }

                if (container && container.contains(inputElement)) {
                    return container;
                }
            } catch (e) {
                // Selector might be invalid, continue to next
            }
        }

        // Fallback: walk up the DOM
        let parent = inputElement.parentElement;
        let depth = 0;
        const maxDepth = 10;

        while (parent && depth < maxDepth) {
            if (parent.tagName === 'FORM' ||
                parent.tagName === 'FIELDSET' ||
                parent.getAttribute('role') === 'form') {
                return parent;
            }
            parent = parent.parentElement;
            depth++;
        }

        return inputElement.parentElement;
    }

    /**
     * Check if element is visible
     */
    function isElementVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    /**
     * Update the host font variable
     */
    function updateHostFont(element) {
        if (!element) return;
        const font = window.getComputedStyle(element).fontFamily;
        if (font) {
            document.documentElement.style.setProperty('--lpp-host-font', font);
        }
    }

    /**
     * Generate unique ID for tracking buttons
     */
    function generateButtonId(inputElement) {
        const rect = inputElement.getBoundingClientRect();
        // Use coordinates to distinguish inputs, but round heavily to handle minor shifts
        // Adding random suffix to avoid collisions on completely dynamic re-renders
        return `lpp-${Math.round(rect.top / 50)}-${Math.round(rect.left / 50)}`;
    }


    function setInputText(inputElement, newText) {
        if (!inputElement) return false;
        try {
            inputElement.focus();
            if (inputElement.tagName === 'TEXTAREA') {
                inputElement.select();
                const success = document.execCommand('insertText', false, newText);
                if (!success) {
                    inputElement.value = newText;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return true;
            }
            if (inputElement.getAttribute('contenteditable') === 'true') {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(inputElement);
                selection.removeAllRanges();
                selection.addRange(range);
                const success = document.execCommand('insertText', false, newText);
                if (!success) {
                    inputElement.textContent = newText;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('[PromptSmith] Error setting text:', error);
            return false;
        }
    }

    function getInputText(inputElement) {
        if (!inputElement) return '';
        if (inputElement.tagName === 'TEXTAREA') return inputElement.value;
        if (inputElement.getAttribute('contenteditable') === 'true') {
            return inputElement.innerText || inputElement.textContent || '';
        }
        return inputElement.value || '';
    }

    // ============================================================
    // DROPDOWN PORTAL (To avoid overflow issues)
    // ============================================================

    /**
     * Close the currently active dropdown if any
     */
    function closeActiveDropdown() {
        if (activeDropdownCleanup) {
            activeDropdownCleanup();
            activeDropdownCleanup = null;
        }
        activeDropdownTrigger = null;

        // Safety cleanup in case manual removal happened
        document.querySelectorAll('.lpp-dropdown-portal').forEach(el => el.remove());
        document.querySelectorAll('.lpp-tooltip').forEach(el => el.remove());
    }

    function createDropdownPortal(items, onSelect, rect, triggerElement) {
        // Ensure clean state
        closeActiveDropdown();

        // Update active trigger
        activeDropdownTrigger = triggerElement;

        const portal = document.createElement('div');
        portal.className = 'lpp-dropdown-menu lpp-dropdown-portal';

        // Calculate positions
        const viewportHeight = window.innerHeight;
        // Estimate height: approx 5 item x ~40px + padding = ~220px
        const estimatedHeight = Object.keys(items).length * 45 + 20;
        const spaceBelow = viewportHeight - rect.bottom;

        // Smart Positioning Logic
        if (spaceBelow < estimatedHeight) {
            // Not enough space below, flip upwards
            portal.style.bottom = `${viewportHeight - rect.top + 8}px`;
            portal.style.top = 'auto'; // Reset top
            portal.style.transformOrigin = 'bottom left';
        } else {
            // Standard positioning
            portal.style.top = `${rect.bottom + 8}px`;
            portal.style.bottom = 'auto';
            portal.style.transformOrigin = 'top left';
        }

        // Horizontal positioning: Align left edge, but keep on screen
        let left = rect.left;
        if (left + 300 > window.innerWidth) {
            // If it would go off screen right, align right edge
            left = rect.right - 300;
        }
        portal.style.left = `${Math.max(10, left)}px`; // Ensure not off left screen
        portal.style.position = 'fixed';

        Object.entries(items).forEach(([key, persona]) => {
            const item = document.createElement('div');
            item.className = 'lpp-dropdown-item';
            if (key === currentPersona) item.classList.add('selected');

            item.innerHTML = `
            <span class="lpp-item-icon">${persona.icon}</span>
                <span class="lpp-item-label">${persona.label}</span>
        `;

            // Tooltip Logic
            item.addEventListener('mouseenter', () => {
                const tooltip = document.createElement('div');
                tooltip.className = 'lpp-tooltip';
                tooltip.textContent = persona.description;
                document.body.appendChild(tooltip);

                const itemRect = item.getBoundingClientRect();
                let tooltipTop = itemRect.top;
                let tooltipLeft = itemRect.right + 10;

                // Check right edge
                const tooltipRect = tooltip.getBoundingClientRect();
                if (tooltipLeft + tooltipRect.width > window.innerWidth) {
                    tooltipLeft = itemRect.left - tooltipRect.width - 10;
                }

                tooltip.style.top = `${tooltipTop}px`;
                tooltip.style.left = `${tooltipLeft}px`;
            });

            item.addEventListener('mouseleave', () => {
                document.querySelectorAll('.lpp-tooltip').forEach(el => el.remove());
            });

            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(key);
                closeActiveDropdown(); // Clean close
            });

            portal.appendChild(item);
        });

        // Close logic
        const closeHandler = (e) => {
            // Ignore clicks on the trigger button itself (handled by its own listener)
            if (activeDropdownTrigger && activeDropdownTrigger.contains(e.target)) {
                return;
            }
            if (!portal.contains(e.target)) {
                closeActiveDropdown();
            }
        };

        // Delay adding listener to avoid immediate close
        setTimeout(() => document.addEventListener('click', closeHandler), 0);

        document.body.appendChild(portal);

        // Store cleanup function
        activeDropdownCleanup = () => {
            portal.remove();
            document.removeEventListener('click', closeHandler);
        };

        return portal;
    }

    // ============================================================
    // BUTTON CREATION & INJECTION
    // ============================================================

    /**
     * Create the SPLIT Polish button group
     */
    function createPolishButton(inputElement) {
        const wrapper = document.createElement('div');
        wrapper.className = 'lpp-button-group';
        if (currentSite === 'gemini') {
            wrapper.classList.add('lpp-native-toolbar');
            wrapper.classList.add('lpp-gemini-toolbar');
        } else if (currentSite === 'chatgpt') {
            wrapper.classList.add('lpp-native-toolbar');
            wrapper.classList.add('lpp-chatgpt-toolbar');
        } else if (currentSite === 'claude') {
            wrapper.classList.add('lpp-native-toolbar');
            wrapper.classList.add('lpp-claude-toolbar');
        }

        wrapper.setAttribute(CONFIG.MARKER_ATTR, 'true');

        // Main Action Button
        const actionBtn = document.createElement('button');
        actionBtn.className = 'lpp-polish-action';
        actionBtn.type = 'button';
        actionBtn.title = `Polish with ${PERSONAS[currentPersona].label}`;

        // Dynamic Icon based on current persona
        const iconSpan = document.createElement('span');
        iconSpan.className = 'lpp-icon';

        // Use SVG for ChatGPT, Emoji for others (unless we want to unify)
        if (currentSite === 'chatgpt') {
            iconSpan.innerHTML = ICONS.sparkle;
        } else {
            iconSpan.textContent = PERSONAS[currentPersona].icon;
        }

        // Label (optional, hidden on some layouts)
        const labelSpan = document.createElement('span');
        labelSpan.className = 'lpp-label';
        labelSpan.textContent = PERSONAS[currentPersona].label;
        if (currentSite === 'gemini' || currentSite === 'chatgpt' || currentSite === 'claude') {
            labelSpan.style.display = 'none';
        }

        actionBtn.appendChild(iconSpan);
        actionBtn.appendChild(labelSpan);

        // Dropdown Trigger Button
        const triggerBtn = document.createElement('button');
        triggerBtn.className = 'lpp-dropdown-trigger';
        triggerBtn.type = 'button';
        if (currentSite === 'chatgpt' || currentSite === 'claude') {
            triggerBtn.innerHTML = ICONS.chevronDown;
        } else {
            triggerBtn.innerHTML = `<span class="lpp-arrow">▼</span>`;
        }

        // Event Listeners
        actionBtn.addEventListener('click', (e) => handlePolishClick(e, inputElement));

        triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            // Toggle Logic
            if (activeDropdownTrigger === triggerBtn) {
                closeActiveDropdown();
                return;
            }

            // Use portal for dropdown to escape overflow:hidden containers on Gemini
            const rect = wrapper.getBoundingClientRect();
            createDropdownPortal(PERSONAS, (key) => {
                // Update State
                currentPersona = key;
                // Update UI
                iconSpan.textContent = PERSONAS[key].icon;
                labelSpan.textContent = PERSONAS[key].label;
                actionBtn.title = `Polish with ${PERSONAS[key].label}`;
            }, rect, triggerBtn); // Pass triggerBtn for tracking
        });

        wrapper.appendChild(actionBtn);
        wrapper.appendChild(triggerBtn);

        return wrapper;
    }


    /**
     * Helper to find Claude Toolbar specifically (Right side)
     */
    function findClaudeToolbar(inputElement) {
        // Claude structure is typically: fieldset -> [Input] ... [Left Toolbar] ... [Right Toolbar]
        // We want to find the toolbar containing the "Send" button (and Model Selector).

        let container = inputElement.closest('fieldset');

        // Fallback if not in fieldset
        if (!container) {
            container = inputElement.closest('div[class*="input-container"]') || inputElement.closest('form');
        }

        if (container) {
            // Target the "Send" button
            const sendBtn = container.querySelector(
                'button[aria-label*="Send"], ' +
                'button[data-testid="send-button"]'
            );

            if (sendBtn) {
                // Return the parent container of the send button
                return sendBtn.parentElement;
            }
        }

        return null;
    }




    /**
     * Helper to find Gemini Toolbar specifically
     */
    function findGeminiToolbar(inputElement) {
        // 1. Try to find "Tools" button
        // It helps to look broadly in the container first
        const container = inputElement.closest('div[class*="input-area"]') || document.body;

        // Look for buttons with text content "Tools"
        const buttons = Array.from(container.querySelectorAll('button, div[role="button"]'));
        const toolsBtn = buttons.find(b => b.innerText.includes('Tools') || b.getAttribute('aria-label') === 'Tools');

        if (toolsBtn) {
            return toolsBtn.parentElement;
        }

        // 2. Try to find Microphone button (usually aria-label="Use microphone" or similar)
        const micBtn = container.querySelector('div[aria-label*="microphone"], button[aria-label*="microphone"]');
        if (micBtn) {
            return micBtn.parentElement;
        }

        return null;
    }

    /**
     * Helper to find ChatGPT Toolbar specifically
     */
    function findChatGPTToolbar(inputElement) {
        // Look for the container that holds the send button and mic button
        const form = inputElement.closest('form');
        if (!form) return null;

        // Strategy A: Find the send button (robust selectors)
        const sendBtn = form.querySelector('button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Stop generating"]');
        if (sendBtn) {
            // Usually buttons are in a flex div.
            // Check parent. If parent is just a wrapper (e.g. tooltip trigger), go up one more.
            let parent = sendBtn.parentElement;

            // Check grand-parent if parent is too small (often Tooltip wrapper)
            if (parent && parent.className.includes('Tooltip')) {
                parent = parent.parentElement;
            }

            // Check if this parent contains other buttons (like mic) or has flex
            const style = window.getComputedStyle(parent);
            if (style.display === 'flex' || style.display === 'inline-flex') {
                return parent;
            }

            // Try one level up if we haven't found a flex container
            if (parent.parentElement) {
                const grandParent = parent.parentElement;
                const grandStyle = window.getComputedStyle(grandParent);
                if (grandStyle.display === 'flex' || grandStyle.display === 'inline-flex') {
                    return grandParent;
                }
            }

            // Fallback: return direct parent
            return sendBtn.parentElement;
        }

        // Strategy B: Mic button (Voice mode)
        const micBtn = form.querySelector('button[aria-label*="Use microphone"]');
        if (micBtn && micBtn.parentElement) {
            // Often mic button is in the same toolbar wrapper
            return micBtn.parentElement;
        }

        // Strategy C: Attachment button (often on the left)
        const attachBtn = form.querySelector('button[aria-label*="Attach file"]');
        if (attachBtn) {
            // We want the right side, so this might be tricky if they are split.
            // But usually they are all in one big footer container. 
            // Ideally we want to be near Send.
        }

        return null;
    }

    /**
 * Inject button near the input element
 */
    function injectButton(inputElement) {
        // Check stable tracking flag on the input element itself
        if (inputElement.dataset.lppInjected === 'true') {
            // fast validation: check if the button we think we injected is actually still there
            // We can look for our marker attribute inside the container or fallbacks
            const expectedButton = document.querySelector(`[${CONFIG.MARKER_ATTR}]`);
            if (expectedButton && document.body.contains(expectedButton)) {
                return;
            }
            // If missing, reset flag and re-inject
            inputElement.dataset.lppInjected = 'false';
        }

        const buttonWrapper = createPolishButton(inputElement);
        const config = SITE_CONFIGS[currentSite];

        // Update font based on input
        updateHostFont(inputElement);

        let injected = false;

        // Specific Injection Logic
        if (config.buttonPosition === 'toolbar-end') {
            let toolbar = null;
            if (currentSite === 'gemini') {
                toolbar = findGeminiToolbar(inputElement);
            } else if (currentSite === 'chatgpt') {
                toolbar = findChatGPTToolbar(inputElement);
            } else if (currentSite === 'claude') {
                toolbar = findClaudeToolbar(inputElement);
            }

            if (toolbar) {
                // Check if toolbar already has a button
                if (toolbar.querySelector(`[${CONFIG.MARKER_ATTR}]`)) {
                    return;
                }

                // DUPLICATION FIX:
                // Check if we previously injected a "fallback" button (next to input) and remove it.
                // This happens if the toolbar wasn't found initially but is found now.
                const container = findContainer(inputElement);
                if (container) {
                    const staleButton = container.querySelector(`[${CONFIG.MARKER_ATTR}]`);
                    if (staleButton && !toolbar.contains(staleButton)) {
                        staleButton.remove();
                        console.log('[PromptSmith] Removed stale fallback button');
                    }
                }

                if (currentSite === 'chatgpt') {
                    // For ChatGPT, we want it explicitly BEFORE the mic button if possible,
                    // or just prepend to the toolbar so it sits left of the existing buttons.
                    toolbar.insertBefore(buttonWrapper, toolbar.firstChild);
                } else if (currentSite === 'claude') {
                    // Claude: Insert before the other buttons in the right toolbar (Model Selector, Send)
                    toolbar.insertBefore(buttonWrapper, toolbar.firstChild);
                } else {
                    // Gemini logic:
                    // Try to place it nicely relative to other icons.
                    // If we found the toolbar, we usually want to be at the end of the left-aligned tools (like gallery, etc)
                    // or before the mic/send button.

                    // Simple append often puts it at the very end.
                    // If the toolbar is using flex-end alignment (often the right side), append works.
                    // If it's flex-start (left side), append works to put it after the last tool.
                    toolbar.appendChild(buttonWrapper);
                }
                injected = true;
            } else {
                console.log(`[PromptSmith] ${currentSite} toolbar not found, falling back`);

                // STRICT MODE FOR CHATGPT:
                // If we are on ChatGPT and didn't find the toolbar, DO NOT fall back to messy injection.
                // Just return and let the observer try again when the toolbar loads.
                if (currentSite === 'chatgpt') {
                    return;
                }
            }
        }

        if (!injected) {
            // ... fallback to standard logic ...
            const container = findContainer(inputElement);
            if (config.buttonPosition === 'before-submit') {
                const submitBtn = container ? container.querySelector('button[type="submit"], button[data-testid*="send"]') : null;
                if (submitBtn && submitBtn.parentElement) {
                    submitBtn.parentElement.insertBefore(buttonWrapper, submitBtn);
                    injected = true;
                } else if (container) {
                    container.appendChild(buttonWrapper);
                    injected = true;
                }
            } else {
                // Last ditch fallback
                if (inputElement.nextSibling) {
                    inputElement.parentElement.insertBefore(buttonWrapper, inputElement.nextSibling);
                    injected = true;
                } else {
                    inputElement.parentElement.appendChild(buttonWrapper);
                    injected = true;
                }
            }
        }

        if (injected) {
            inputElement.dataset.lppInjected = 'true';
            console.log('[PromptSmith] Button injected successfully');
        }
    }

    // ============================================================
    // CLICK HANDLER
    // ============================================================

    async function handlePolishClick(event, inputElement) {
        event.preventDefault();
        event.stopPropagation();

        const actionBtn = event.currentTarget;
        const wrapper = actionBtn.closest('.lpp-button-group');

        const originalText = getInputText(inputElement);

        if (!originalText || originalText.trim().length === 0) {
            showStatus('Please enter some text first', 'error');
            return;
        }

        // Show loading state on the wrapper/action button
        wrapper.classList.add('lpp-loading');
        showStatus(`✨ Polishing as ${PERSONAS[currentPersona].label}...`, 'info');

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        type: 'POLISH_TEXT',
                        text: originalText,
                        // Send the specific instruction for the selected persona
                        systemPrompt: PERSONAS[currentPersona].instruction
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                            return;
                        }
                        resolve(response);
                    }
                );
            });

            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to polish text');
            }

            const success = setInputText(inputElement, response.text);

            if (success) {
                wrapper.classList.remove('lpp-loading');
                wrapper.classList.add('lpp-success');

                // Map mode to user-friendly indicator
                let modeIndicator = '☁️ Cloud';
                if (response.mode === 'local') {
                    modeIndicator = '⚡ Local';
                } else if (response.mode === 'webllm') {
                    modeIndicator = '🚀 WebLLM';
                }
                showStatus(`✓ Done! (${modeIndicator})`, 'success');

                setTimeout(() => {
                    wrapper.classList.remove('lpp-success');
                }, 2000);
            } else {
                throw new Error('Failed to update input field');
            }

        } catch (error) {
            console.error('[PromptSmith] Polish error:', error);
            wrapper.classList.remove('lpp-loading');
            wrapper.classList.add('lpp-error');

            showStatus(`Error: ${error.message}`, 'error');

            setTimeout(() => {
                wrapper.classList.remove('lpp-error');
            }, 3000);
        }
    }

    // ============================================================
    // STATUS POPUP
    // ============================================================

    /**
     * Show a status popup message
     */
    function showStatus(message, type = 'info') {
        const existing = document.querySelector('.lpp-status-popup');
        if (existing) {
            existing.remove();
        }

        const popup = document.createElement('div');
        popup.className = `lpp-status-popup lpp-${type}`;
        popup.textContent = message;

        document.body.appendChild(popup);

        setTimeout(() => {
            popup.classList.add('lpp-hiding');
            setTimeout(() => popup.remove(), 300);
        }, 3000);
    }

    // ============================================================
    // MUTATION OBSERVER
    // ============================================================

    function debouncedObserverCallback() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            tryInjectButton();
        }, CONFIG.DEBOUNCE_DELAY);
    }

    function tryInjectButton() {
        const inputElement = findInputElement();

        if (inputElement) {
            injectButton(inputElement);
        }
    }



    /**
     * Keep Alive Connection
     * Connects to background script to keep Service Worker alive while this tab is active.
     */
    function connectKeepAlive() {
        try {
            const port = chrome.runtime.connect({ name: 'keep-alive' });
            port.onDisconnect.addListener(() => {
                console.log('[PromptSmith] Keep-alive disconnected, reconnecting...');
                setTimeout(connectKeepAlive, 1000);
            });

            // Optional: Send ping periodically to defeat idle timers
            const interval = setInterval(() => {
                try {
                    port.postMessage({ type: 'ping' });
                } catch (e) {
                    clearInterval(interval);
                }
            }, 20000); // 20 seconds

        } catch (e) {
            console.error('[PromptSmith] Error connecting keep-alive:', e);
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    /**
     * initialize
     */
    async function init() {
        currentSite = detectSite();
        if (!currentSite) return;

        // Check if site is enabled
        const storage = await chrome.storage.sync.get(['enabledSites']);
        const enabledSites = storage.enabledSites || { chatgpt: true, claude: true, gemini: true };

        if (enabledSites[currentSite] === false) {
            console.log(`[PromptSmith] ${currentSite} is disabled in settings. Skipping injection.`);
            return;
        }
        console.log(`[PromptSmith] Site ${currentSite} is enabled. Settings:`, enabledSites);

        injectStyles();

        // Start observer
        const observer = new MutationObserver((mutations) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const input = findInputElement();
                if (input) {
                    injectButton(input);
                }
            }, CONFIG.DEBOUNCE_DELAY);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial check

        setTimeout(() => {
            const input = findInputElement();
            if (input) {
                injectButton(input);
            }
        }, 1000);

        // Log AI mode on startup
        chrome.runtime.sendMessage({ type: 'GET_AI_MODE' }, (response) => {
            if (response) {
                console.log('[PromptSmith] AI Mode:', response.status);
            }
        });

        // Init keep-alive
        connectKeepAlive();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

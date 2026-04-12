/**
 * PromptSmith - Content Script (FAB Edition)
 *
 * Injects a draggable Floating Action Button into ChatGPT, Claude, and Gemini.
 * Uses ResizeObserver + MutationObserver for robust positioning.
 */

(function () {
    'use strict';

    // ============================================================
    // CONSTANTS & CONFIG
    // ============================================================

    const ICONS = {
        chevronDown: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    let PERSONAS = null;

    async function loadPersonas() {
        try {
            const promptsUrl = chrome.runtime.getURL('prompts.js');
            const module = await import(promptsUrl);
            PERSONAS = module.PERSONAS;
            console.log('[PromptSmith] PERSONAS loaded successfully from prompts.js');
            return true;
        } catch (error) {
            console.error('[PromptSmith] Failed to load PERSONAS from prompts.js:', error);
            PERSONAS = getFallbackPersonas();
            return false;
        }
    }

    function getFallbackPersonas() {
        console.warn('[PromptSmith] dynamic import of prompts.js failed. Fallback active.');
        return {
            editor: {
                icon: '✨',
                label: 'Editor',
                description: 'Clarity, structure, and professional tone using CO-STAR.',
                instruction: 'Error: Could not load personas. Please reload the page.'
            },
            brainstormer: {
                icon: '🗣️',
                label: 'Brainstormer',
                description: 'Divergent ideation, role-storming, and ranked evaluation.',
                instruction: 'Error: Could not load personas. Please reload the page.'
            },
            developer: {
                icon: '💻',
                label: 'Developer',
                description: 'Structured code prompts with XML tags and examples.',
                instruction: 'Error: Could not load personas. Please reload the page.'
            },
            thinker: {
                icon: '🧠',
                label: 'Thinker',
                description: 'Deep reasoning, Chain of Thought, and evidence standards.',
                instruction: 'Error: Could not load personas. Please reload the page.'
            },
            custom: {
                icon: '⚙️',
                label: 'Custom',
                description: 'Your own system prompt from Settings.',
                instruction: '[CUSTOM_PROMPT_PLACEHOLDER]'
            }
        };
    }

    const CONFIG = {
        MARKER_ATTR: 'data-lpp-injected',
        DEBOUNCE_DELAY: 300,
        MAX_RETRIES: 50,
        RETRY_INTERVAL: 500,
        FAB_SIZE: 32,
        FAB_OFFSET: 8, // px gap below the input box
    };

    const SITE_CONFIGS = {
        chatgpt: {
            hostname: ['chat.openai.com', 'chatgpt.com'],
            inputSelectors: [
                '#prompt-textarea',
                'textarea[data-id="root"]',
                'div[contenteditable="true"][id="prompt-textarea"]',
                'form textarea',
            ],
        },
        claude: {
            hostname: ['claude.ai'],
            inputSelectors: [
                'div[contenteditable="true"][enterkeyhint="enter"]',
                'div[contenteditable="true"]',
                'fieldset div[contenteditable]',
            ],
        },
        gemini: {
            hostname: ['gemini.google.com'],
            inputSelectors: [
                'rich-textarea div[contenteditable="true"]',
                '.ql-editor',
                'div[contenteditable="true"]',
            ],
        },
    };

    // ============================================================
    // STATE
    // ============================================================

    let currentSite = null;
    let debounceTimer = null;
    let currentPersona = 'editor';
    let customPersonaPrompts = {};
    let activeDropdownCleanup = null;
    let activeDropdownTrigger = null;

    // FAB state
    let fabElement = null;
    let fabResizeObserver = null;
    let fabDragOffset = null; // { x, y } when user has manually dragged
    let isDragging = false;
    let dragStartPos = null;

    // ============================================================
    // STYLES
    // ============================================================

    // Site-specific theme tokens
    const SITE_THEMES = {
        chatgpt: {
            fabBg: '#10a37f',
            fabBgHover: '#0ec48e',
            fabBorder: 'rgba(255,255,255,0.15)',
            fabShadow: 'rgba(16,163,127,0.35)',
            dropdownBg: 'rgba(32,33,35,0.97)',
            dropdownBorder: '#444',
            textColor: '#ececec',
            textMuted: '#999',
            accentColor: '#10a37f',
            accentSubtle: 'rgba(16,163,127,0.15)',
            fabTextColor: '#fff',
        },
        claude: {
            fabBg: '#d97757',
            fabBgHover: '#e08a6c',
            fabBorder: 'rgba(255,255,255,0.15)',
            fabShadow: 'rgba(217,119,87,0.35)',
            dropdownBg: 'rgba(43,42,39,0.97)',
            dropdownBorder: '#4a4843',
            textColor: '#e8e6e3',
            textMuted: '#9b9890',
            accentColor: '#d97757',
            accentSubtle: 'rgba(217,119,87,0.15)',
            fabTextColor: '#fff',
        },
        gemini: {
            fabBg: '#669df6',
            fabBgHover: '#7baaf7',
            fabBorder: 'rgba(255,255,255,0.15)',
            fabShadow: 'rgba(102,157,246,0.35)',
            dropdownBg: 'rgba(30,31,32,0.97)',
            dropdownBorder: '#3c3f41',
            textColor: '#e3e3e3',
            textMuted: '#8e918f',
            accentColor: '#669df6',
            accentSubtle: 'rgba(102,157,246,0.15)',
            fabTextColor: '#fff',
        },
    };

    function injectStyles() {
        if (document.getElementById('lpp-styles')) return;

        const t = SITE_THEMES[currentSite] || SITE_THEMES.chatgpt;

        const style = document.createElement('style');
        style.id = 'lpp-styles';
        style.textContent = `
            /* ── FAB ── */
            .lpp-fab {
                position: fixed;
                z-index: 2147483646;
                width: ${CONFIG.FAB_SIZE}px;
                height: ${CONFIG.FAB_SIZE}px;
                border-radius: 50%;
                background: ${t.fabBg};
                border: 1px solid ${t.fabBorder};
                box-shadow: 0 2px 8px ${t.fabShadow};
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: grab;
                user-select: none;
                color: ${t.fabTextColor};
                font-size: 14px;
                line-height: 1;
                opacity: 0.75;
                transition: opacity 0.2s ease, box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
            }
            .lpp-fab:hover {
                opacity: 1;
                background: ${t.fabBgHover};
                box-shadow: 0 4px 14px ${t.fabShadow};
                transform: scale(1.1);
            }
            .lpp-fab.lpp-dragging {
                cursor: grabbing;
                opacity: 1;
                box-shadow: 0 6px 20px ${t.fabShadow};
                transform: scale(1.15);
                transition: none;
            }
            .lpp-fab.lpp-loading {
                opacity: 0.9;
                pointer-events: none;
            }
            .lpp-fab.lpp-loading::after {
                content: '';
                position: absolute;
                inset: -3px;
                border-radius: 50%;
                border: 2px solid transparent;
                border-top-color: ${t.accentColor};
                animation: lpp-spin 0.6s linear infinite;
            }

            @keyframes lpp-spin {
                to { transform: rotate(360deg); }
            }

            /* ── Sparkle burst ── */
            @keyframes lpp-sparkle-burst {
                0% { transform: scale(0.8); opacity: 1; }
                50% { transform: scale(1.35); }
                100% { transform: scale(1); opacity: 1; }
            }
            .lpp-fab.lpp-sparkle {
                animation: lpp-sparkle-burst 0.45s ease-out;
                opacity: 1;
            }

            /* ── Sparkle particles ── */
            .lpp-sparkle-particle {
                position: fixed;
                z-index: 2147483647;
                pointer-events: none;
                font-size: 10px;
                animation: lpp-particle-fly 0.55s ease-out forwards;
            }
            @keyframes lpp-particle-fly {
                0% { opacity: 1; transform: translate(0, 0) scale(1); }
                100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.2); }
            }

            /* ── Dropdown ── */
            .lpp-dropdown-portal {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                font-size: 13px;
                font-weight: 400;
                background: ${t.dropdownBg};
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid ${t.dropdownBorder};
                border-radius: 10px;
                box-shadow: 0 12px 32px -8px rgba(0,0,0,0.45);
                z-index: 2147483647;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                min-width: 180px;
                max-width: 240px;
                padding: 4px;
                position: fixed;
            }
            .lpp-dropdown-item {
                display: flex;
                align-items: center;
                padding: 9px 12px;
                cursor: pointer;
                border-radius: 7px;
                color: ${t.textColor};
                transition: all 0.12s ease;
                gap: 8px;
            }
            .lpp-dropdown-item:hover {
                background: ${t.accentSubtle};
                color: ${t.accentColor};
            }
            .lpp-dropdown-item.selected {
                background: ${t.accentSubtle};
                color: ${t.accentColor};
            }
            .lpp-item-icon {
                font-size: 1em;
                flex-shrink: 0;
                width: 16px;
                text-align: center;
                color: ${t.textMuted};
            }
            .lpp-dropdown-item:hover .lpp-item-icon,
            .lpp-dropdown-item.selected .lpp-item-icon {
                color: ${t.accentColor};
            }
            .lpp-item-label {
                font-weight: 400;
                font-size: 12px;
                color: inherit;
            }

            /* ── Tooltip ── */
            .lpp-tooltip {
                position: fixed;
                background: ${t.fabBg};
                color: ${t.textColor};
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid ${t.fabBorder};
                z-index: 2147483647;
                pointer-events: none;
                max-width: 180px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 11px;
                line-height: 1.4;
                box-shadow: 0 8px 24px -8px rgba(0,0,0,0.3);
                animation: lpp-tooltip-in 0.1s ease-out;
            }
            @keyframes lpp-tooltip-in {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }

            /* ── Status label (anchored to FAB) ── */
            .lpp-status {
                position: fixed;
                z-index: 2147483647;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 11px;
                font-weight: 500;
                line-height: 1;
                padding: 5px 10px;
                border-radius: 6px;
                white-space: nowrap;
                color: ${t.textColor};
                background: ${t.dropdownBg};
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid ${t.dropdownBorder};
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            .lpp-status.lpp-visible { opacity: 1; }
            .lpp-status.lpp-error { color: #f87171; }
            .lpp-status.lpp-success { color: ${t.accentColor}; }
        `;
        document.head.appendChild(style);
    }

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

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

    function findInputElement() {
        if (!currentSite) return null;
        const config = SITE_CONFIGS[currentSite];
        for (const selector of config.inputSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element && isElementVisible(element)) return element;
            } catch (e) { /* continue */ }
        }
        return null;
    }

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
    // DROPDOWN PORTAL
    // ============================================================

    function closeActiveDropdown() {
        if (activeDropdownCleanup) {
            activeDropdownCleanup();
            activeDropdownCleanup = null;
        }
        activeDropdownTrigger = null;
        document.querySelectorAll('.lpp-dropdown-portal').forEach(el => el.remove());
        document.querySelectorAll('.lpp-tooltip').forEach(el => el.remove());
    }

    function createDropdownPortal(items, onSelect, rect, triggerElement) {
        closeActiveDropdown();
        activeDropdownTrigger = triggerElement;

        const portal = document.createElement('div');
        portal.className = 'lpp-dropdown-menu lpp-dropdown-portal';

        const viewportHeight = window.innerHeight;
        const estimatedHeight = Object.keys(items).length * 45 + 20;
        const spaceBelow = viewportHeight - rect.bottom;

        if (spaceBelow < estimatedHeight) {
            portal.style.bottom = `${viewportHeight - rect.top + 8}px`;
            portal.style.top = 'auto';
        } else {
            portal.style.top = `${rect.bottom + 8}px`;
            portal.style.bottom = 'auto';
        }

        let left = rect.left;
        if (left + 300 > window.innerWidth) {
            left = rect.right - 300;
        }
        portal.style.left = `${Math.max(10, left)}px`;

        Object.entries(items).forEach(([key, persona]) => {
            const item = document.createElement('div');
            item.className = 'lpp-dropdown-item';
            if (key === currentPersona) item.classList.add('selected');

            item.innerHTML = `
                <span class="lpp-item-icon">${persona.icon}</span>
                <span class="lpp-item-label">${persona.label}</span>
            `;

            item.addEventListener('mouseenter', () => {
                const tooltip = document.createElement('div');
                tooltip.className = 'lpp-tooltip';
                tooltip.textContent = persona.description;
                document.body.appendChild(tooltip);

                const itemRect = item.getBoundingClientRect();
                let tooltipLeft = itemRect.right + 10;
                const tooltipRect = tooltip.getBoundingClientRect();
                if (tooltipLeft + tooltipRect.width > window.innerWidth) {
                    tooltipLeft = itemRect.left - tooltipRect.width - 10;
                }
                tooltip.style.top = `${itemRect.top}px`;
                tooltip.style.left = `${tooltipLeft}px`;
            });

            item.addEventListener('mouseleave', () => {
                document.querySelectorAll('.lpp-tooltip').forEach(el => el.remove());
            });

            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(key);
                closeActiveDropdown();
            });

            portal.appendChild(item);
        });

        const closeHandler = (e) => {
            if (activeDropdownTrigger && activeDropdownTrigger.contains(e.target)) return;
            if (!portal.contains(e.target)) closeActiveDropdown();
        };

        setTimeout(() => document.addEventListener('click', closeHandler), 0);
        document.body.appendChild(portal);

        activeDropdownCleanup = () => {
            portal.remove();
            document.removeEventListener('click', closeHandler);
        };

        return portal;
    }

    // ============================================================
    // FAB CREATION & POSITIONING
    // ============================================================

    function createFAB() {
        const fab = document.createElement('div');
        fab.className = 'lpp-fab';
        fab.setAttribute(CONFIG.MARKER_ATTR, 'true');
        fab.textContent = PERSONAS[currentPersona].icon;
        fab.title = `Polish with ${PERSONAS[currentPersona].label} · Right-click to change persona`;

        // ── Click: polish ──
        fab.addEventListener('click', (e) => {
            if (isDragging) return; // ignore click after drag
            e.preventDefault();
            e.stopPropagation();

            const inputElement = findInputElement();
            if (!inputElement) {
                showStatus('Input not found', 'error');
                return;
            }
            handlePolishClick(inputElement);
        });

        // ── Right-click: persona dropdown ──
        fab.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (activeDropdownTrigger === fab) {
                closeActiveDropdown();
                return;
            }

            const rect = fab.getBoundingClientRect();
            createDropdownPortal(PERSONAS, (key) => {
                currentPersona = key;
                chrome.storage.sync.set({ activePersona: key }).catch(() => {});
                fab.textContent = PERSONAS[key].icon;
                fab.title = `Polish with ${PERSONAS[key].label} · Right-click to change persona`;
            }, rect, fab);
        });

        // ── Drag ──
        fab.addEventListener('mousedown', onDragStart);
        fab.addEventListener('touchstart', onDragStart, { passive: false });

        document.body.appendChild(fab);
        return fab;
    }

    // ── Drag handlers ──

    function onDragStart(e) {
        if (e.button && e.button !== 0) return; // only left mouse
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        dragStartPos = { x: clientX, y: clientY };
        isDragging = false;

        const onMove = (ev) => {
            const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
            const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
            const dx = cx - dragStartPos.x;
            const dy = cy - dragStartPos.y;

            if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                isDragging = true;
                fabElement.classList.add('lpp-dragging');
            }

            if (isDragging) {
                ev.preventDefault();
                const fabRect = fabElement.getBoundingClientRect();
                let newLeft = fabRect.left + (cx - (ev.touches ? ev.touches[0].clientX : ev.clientX) || 0);

                // Direct position from cursor
                newLeft = cx - CONFIG.FAB_SIZE / 2;
                let newTop = cy - CONFIG.FAB_SIZE / 2;

                // Clamp to viewport
                newLeft = Math.max(0, Math.min(window.innerWidth - CONFIG.FAB_SIZE, newLeft));
                newTop = Math.max(0, Math.min(window.innerHeight - CONFIG.FAB_SIZE, newTop));

                fabElement.style.left = `${newLeft}px`;
                fabElement.style.top = `${newTop}px`;
                fabElement.style.right = 'auto';
                fabElement.style.bottom = 'auto';

                // Store manual offset so we stop auto-positioning
                fabDragOffset = { left: newLeft, top: newTop };
            }
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
            fabElement.classList.remove('lpp-dragging');

            // Suppress the click event that fires after mouseup if we were dragging
            if (isDragging) {
                setTimeout(() => { isDragging = false; }, 50);
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    }

    /**
     * Position FAB relative to the input element's bounding box.
     * Places it just outside the bottom-right corner of the input.
     */
    /**
     * Find the outermost input container (the visible rounded box) for better anchor positioning.
     */
    function findInputContainer(inputElement) {
        if (currentSite === 'chatgpt') {
            return inputElement.closest('form') || inputElement.parentElement;
        }
        if (currentSite === 'claude') {
            return inputElement.closest('fieldset') || inputElement.closest('form') || inputElement.parentElement;
        }
        if (currentSite === 'gemini') {
            return inputElement.closest('.input-area-container') ||
                   inputElement.closest('rich-textarea')?.parentElement ||
                   inputElement.parentElement;
        }
        return inputElement.parentElement;
    }

    function positionFAB(inputElement) {
        if (!fabElement || fabDragOffset) return; // don't reposition if user dragged it

        // Use the outer container for positioning so we're outside the visible box
        const container = findInputContainer(inputElement);
        const rect = container ? container.getBoundingClientRect() : inputElement.getBoundingClientRect();
        const offset = CONFIG.FAB_OFFSET;
        const size = CONFIG.FAB_SIZE;

        // Right-aligned, 16px inset from the container's right edge
        let left = rect.right - size - 16;

        // Determine if input is near the bottom (conversation mode)
        const spaceBelow = window.innerHeight - rect.bottom;
        let top;

        if (spaceBelow >= size + offset + 10) {
            // Enough room below — place FAB under the input
            top = rect.bottom + offset;
        } else {
            // Input is at the bottom of viewport — place FAB above the input, right side
            top = rect.top - size - offset;
        }

        // Clamp to viewport
        left = Math.max(10, Math.min(window.innerWidth - size - 10, left));
        top = Math.max(10, Math.min(window.innerHeight - size - 10, top));

        fabElement.style.left = `${left}px`;
        fabElement.style.top = `${top}px`;
        fabElement.style.right = 'auto';
        fabElement.style.bottom = 'auto';
    }

    /**
     * Set up ResizeObserver + scroll/resize listeners to track the input box
     */
    function attachTracker(inputElement) {
        // Clean up previous observer
        if (fabResizeObserver) {
            fabResizeObserver.disconnect();
        }

        fabResizeObserver = new ResizeObserver(() => {
            positionFAB(inputElement);
        });

        fabResizeObserver.observe(inputElement);

        // Also observe ancestor scroll containers
        const scrollHandler = () => positionFAB(inputElement);
        window.addEventListener('resize', scrollHandler);
        window.addEventListener('scroll', scrollHandler, true); // capture for nested scrolls
    }

    // ============================================================
    // SPARKLE EFFECT
    // ============================================================

    function playSparkle() {
        if (!fabElement) return;

        fabElement.classList.remove('lpp-sparkle');
        // Force reflow to restart animation
        void fabElement.offsetWidth;
        fabElement.classList.add('lpp-sparkle');

        // Emit particles
        const rect = fabElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const particles = ['✨', '⭐', '💫', '✦'];

        for (let i = 0; i < 6; i++) {
            const p = document.createElement('span');
            p.className = 'lpp-sparkle-particle';
            p.textContent = particles[i % particles.length];

            const angle = (Math.PI * 2 / 6) * i;
            const dist = 25 + Math.random() * 15;
            p.style.left = `${cx}px`;
            p.style.top = `${cy}px`;
            p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);

            document.body.appendChild(p);
            setTimeout(() => p.remove(), 700);
        }

        setTimeout(() => fabElement.classList.remove('lpp-sparkle'), 500);
    }

    // ============================================================
    // POLISH HANDLER
    // ============================================================

    async function handlePolishClick(inputElement) {
        const originalText = getInputText(inputElement);

        if (!originalText || originalText.trim().length === 0) {
            showStatus('No text to polish', 'error');
            return;
        }

        fabElement.classList.add('lpp-loading');
        showStatus('Polishing...', 'info');

        try {
            let systemPrompt = customPersonaPrompts[currentPersona] || PERSONAS[currentPersona].instruction;

            if (currentPersona === 'custom') {
                const customPrompt = customPersonaPrompts['custom'];
                if (!customPrompt ||
                    customPrompt.trim() === '' ||
                    customPrompt === '[CUSTOM_PROMPT_PLACEHOLDER]' ||
                    customPrompt.startsWith('[Enter your custom system prompt here]')) {
                    showStatus('Set a custom prompt in Settings', 'error');
                    fabElement.classList.remove('lpp-loading');
                    return;
                }
                systemPrompt = customPrompt;
            }

            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { type: 'POLISH_TEXT', text: originalText, systemPrompt },
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
                fabElement.classList.remove('lpp-loading');

                // Sparkle effect!
                playSparkle();

                showStatus('Done', 'success');
            } else {
                throw new Error('Failed to update input field');
            }

        } catch (error) {
            console.error('[PromptSmith] Polish error:', error);
            fabElement.classList.remove('lpp-loading');
            showStatus('Failed to polish', 'error');
        }
    }

    // ============================================================
    // STATUS POPUP
    // ============================================================

    let statusTimer = null;

    function showStatus(message, type = 'info') {
        if (statusTimer) clearTimeout(statusTimer);

        let el = document.querySelector('.lpp-status');
        if (!el) {
            el = document.createElement('div');
            el.className = 'lpp-status';
            document.body.appendChild(el);
        }

        // Position next to the FAB
        if (fabElement) {
            const r = fabElement.getBoundingClientRect();
            el.style.top = `${r.top + r.height / 2 - 10}px`;
            // Place to the left of the FAB
            el.style.left = 'auto';
            el.style.right = `${window.innerWidth - r.left + 8}px`;
        }

        el.textContent = message;
        el.className = `lpp-status lpp-${type}`;

        // Force reflow then fade in
        void el.offsetWidth;
        el.classList.add('lpp-visible');

        const duration = type === 'info' ? 10000 : 2500;
        statusTimer = setTimeout(() => {
            el.classList.remove('lpp-visible');
            setTimeout(() => el.remove(), 250);
            statusTimer = null;
        }, duration);
    }

    // ============================================================
    // KEEP ALIVE
    // ============================================================

    function connectKeepAlive() {
        try {
            const port = chrome.runtime.connect({ name: 'keep-alive' });
            port.onDisconnect.addListener(() => {
                setTimeout(connectKeepAlive, 1000);
            });
            const interval = setInterval(() => {
                try { port.postMessage({ type: 'ping' }); } catch (e) { clearInterval(interval); }
            }, 20000);
        } catch (e) {
            console.error('[PromptSmith] Error connecting keep-alive:', e);
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    function ensureFAB() {
        // Re-inject if our FAB was wiped by a hard SPA re-render
        if (fabElement && document.body.contains(fabElement)) return;

        fabElement = createFAB();

        const inputElement = findInputElement();
        if (inputElement) {
            positionFAB(inputElement);
            attachTracker(inputElement);
        }
    }

    async function init() {
        await loadPersonas();

        currentSite = detectSite();
        if (!currentSite) return;

        const storage = await chrome.storage.sync.get(['enabledSites', 'activePersona', 'customPersonaPrompts']);
        const enabledSites = storage.enabledSites || { chatgpt: true, claude: true, gemini: true };
        customPersonaPrompts = storage.customPersonaPrompts || {};

        if (enabledSites[currentSite] === false) {
            console.log(`[PromptSmith] ${currentSite} is disabled in settings.`);
            return;
        }

        injectStyles();

        // MutationObserver: re-inject FAB if wiped, re-track if input changes
        let lastInputElement = null;

        const observer = new MutationObserver(() => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                ensureFAB();

                const input = findInputElement();
                if (input && input !== lastInputElement) {
                    lastInputElement = input;
                    positionFAB(input);
                    attachTracker(input);
                }
            }, CONFIG.DEBOUNCE_DELAY);
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Initial injection with slight delay for SPA hydration
        setTimeout(() => {
            ensureFAB();
            const input = findInputElement();
            if (input) {
                lastInputElement = input;
                positionFAB(input);
                attachTracker(input);
            }
        }, 1000);

        // Log AI mode
        chrome.runtime.sendMessage({ type: 'GET_AI_MODE' }, (response) => {
            if (response) console.log('[PromptSmith] AI Mode:', response.status);
        });

        connectKeepAlive();

        // Sync storage changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.customPersonaPrompts) {
                    customPersonaPrompts = changes.customPersonaPrompts.newValue || {};
                }
                if (changes.activePersona && changes.activePersona.newValue) {
                    const newPersona = changes.activePersona.newValue;
                    if (PERSONAS && PERSONAS[newPersona]) {
                        currentPersona = newPersona;
                        if (fabElement) {
                            fabElement.textContent = PERSONAS[newPersona].icon;
                            fabElement.title = `Polish with ${PERSONAS[newPersona].label} · Right-click to change persona`;
                        }
                    }
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

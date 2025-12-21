# 🎨 PromptSmith Design Guide

> **Version:** 2.0 (Light & Airy)
> **Philosophy:** "Weightless Utility."
> The interface should feel like it floats. We avoid heavy containers, aggressive gradients, and deep blacks. We use whitespace, soft blurs, and thin strokes to create structure without visual weight.

---

## 1. Color Palette

We replace heavy violet with a **Sky & Stone** palette. The primary action color is a soft, optimistic blue (`Airy Blue`), grounded by warm grays and pure white.

### Primary Colors

| Role | Color Name | Hex | Usage |
| --- | --- | --- | --- |
| **Primary** | **Airy Blue** | `#0EA5E9` | Primary text in buttons, active icons, focus rings. |
| **Hover** | **Deep Sky** | `#0284C7` | Button hover states (solid fills). |
| **Subtle** | **Pale Blue** | `#E0F2FE` | Button backgrounds (inactive state). |
| **Accent** | **Soft Mint** | `#2DD4BF` | "Polished" success states, subtle badges. |
| **Alert** | **Pale Rose** | `#FB7185` | Errors (softened, non-aggressive red). |

### Surface & Neutrals

| Role | Hex | Usage |
| --- | --- | --- |
| **Canvas** | `#FFFFFF` | Main backgrounds, cards. |
| **Vapor** | `#F8FAFC` | Secondary backgrounds, input fills. |
| **Mist** | `#E2E8F0` | Subtle borders, dividers. |
| **Ink** | `#334155` | Primary text (Softened black/slate). |
| **Stone** | `#94A3B8` | Muted text, icons, metadata. |

---

## 2. Typography

The goal is **readability through breathing room**. We increase tracking and line height to let the text float.

### Font Stacks

* **UI:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
* **Code:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`

### Hierarchy & Weight

* **Headings:** Light/Regular weight (`300` or `400`). Let size define hierarchy, not boldness.
* **Body:** Regular (`400`) with loose line-height (`1.6`).
* **Microcopy:** Small (`12px`), uppercase, generous tracking (`0.05em`), Color: `Stone`.

---

## 3. Component Design

### ☁️ The "Polish" Button (In-Chat)

Moves away from the solid gradient pill. It is now a light, translucent element that fills on hover.

* **Background:** `rgba(14, 165, 233, 0.1)` (Very faint blue tint).
* **Text:** **Airy Blue** (`#0EA5E9`).
* **Border:** `1px solid rgba(14, 165, 233, 0.2)`.
* **Radius:** `6px` (Slightly more squared, modern tech feel).
* **Interaction:**
* *Hover:* Background becomes solid **Airy Blue**, Text becomes **White**. Transition `0.2s ease`.



### 📄 The Dropdown (The "Sheet")

Instead of a heavy card, it should feel like a piece of paper lifting slightly off the desk.

* **Shadow:** Diffuse and wide.
```css
box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.05);

```


* **Border:** `1px solid #F1F5F9`.
* **Backdrop:** `backdrop-filter: blur(8px)` with semi-transparent white (`rgba(255,255,255,0.95)`).

### ⚙️ Settings Page

* **Layout:** Clean whitespace. No "boxes within boxes."
* **Inputs:**
* Background: `#F8FAFC` (Vapor).
* Border: None (or very faint `#F1F5F9`).
* Text: Dark Slate (`Ink`).
* Focus: A soft blue glow, no hard ring.



---

## 4. Iconography

Use **Lucide Icons** with a **Thin Stroke (1.5px)**. Heavy icons make the UI feel cluttered.

* **Polisher:** `Sparkles` (✨)
* **Developer:** `Code` (💻)
* **Thinker:** `Brain` (🧠)
* **Custom:** `Sliders-Horizontal` (⚙️)

---

## 5. Visual Effects & Micro-Interactions

* **"Breathing" Loading:** Instead of a spin or pulse opacity, use a soft **shimmer**.
* A gradient mask sliding across the text/icon from left to right.


* **Success State:** The text turns **Soft Mint**, and the border glows Mint for `1s` before fading back to Blue.

---

## 6. CSS Variables (Copy-Paste Ready)

Add this to your `styles.css` `:root` to apply the theme instantly.

```css
:root {
  /* Palette: Light & Airy */
  --ps-primary: #0EA5E9;       /* Sky Blue */
  --ps-primary-hover: #0284C7; /* Deep Sky */
  --ps-primary-subtle: #E0F2FE; /* Pale Blue Background */
  
  --ps-success: #2DD4BF;       /* Soft Mint */
  --ps-error: #FB7185;         /* Pale Rose */
  
  /* Neutrals */
  --ps-bg: #FFFFFF;            /* Pure White */
  --ps-surface: #F8FAFC;       /* Vapor Gray */
  --ps-border: #E2E8F0;        /* Mist */
  
  /* Text */
  --ps-text-main: #334155;     /* Slate 700 */
  --ps-text-muted: #94A3B8;    /* Slate 400 */

  /* Physics */
  --ps-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.08); /* Diffuse Shadow */
  --ps-radius: 8px;            /* Modern Radius */
}

/* Dark Mode (Muted Slate, not Pitch Black) */
@media (prefers-color-scheme: dark) {
  :root {
    --ps-primary: #38BDF8;     /* Lighter Sky for Dark Mode */
    --ps-primary-subtle: #0F172A; 
    
    --ps-bg: #1e293b;          /* Slate 900 */
    --ps-surface: #334155;     /* Slate 700 */
    --ps-border: #475569;      /* Slate 600 */
    
    --ps-text-main: #F1F5F9;   /* Slate 100 */
    --ps-text-muted: #94A3B8;  /* Slate 400 */
    
    --ps-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
  }
}

```
---
name: Ikigai for Humanity
description: A friendly pastel card game for imagining work with friends.
colors:
  ink: "#21312b"
  muted: "#58665f"
  paper: "#f7f3ed"
  cream: "#fffdf9"
  line: "#d8dcd3"
  coral: "#ef7657"
  blue: "#80b7d6"
  yellow: "#efc85d"
  green: "#78aa85"
  love-tint: "#f9dfd5"
  strength-tint: "#deedf5"
  opportunity-tint: "#f8edc5"
  need-tint: "#e2eee0"
  primary-hover: "#3b5145"
  coral-hover: "#f38e73"
  field-border: "#a9b4aa"
  card-border: "#b7c1b8"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(44px, 6.5vw, 76px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-.03em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(30px, 4vw, 44px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-.03em"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "25px"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-.03em"
  card-title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-.02em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    lineHeight: 1.5
  lead:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "17px"
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  button:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 800
rounded:
  field: "10px"
  chip: "12px"
  panel: "14px"
  pill: "999px"
spacing:
  compact: "8px"
  gap: "12px"
  inset: "16px"
  field-group: "22px"
  section: "24px"
  split: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-coral:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
  button-coral-hover:
    backgroundColor: "{colors.coral-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
  input:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  panel:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "clamp(20px, 3.5vw, 36px)"
  activity-card-love:
    backgroundColor: "{colors.love-tint}"
    textColor: "{colors.ink}"
    typography: "{typography.card-title}"
    rounded: "{rounded.panel}"
    padding: "20px 16px"
  activity-card-selected:
    backgroundColor: "{colors.cream}"
  prompt-card-love:
    backgroundColor: "{colors.love-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "12px 16px"
  vote-card:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  vote-card-selected:
    backgroundColor: "{colors.love-tint}"
  navigation:
    textColor: "{colors.ink}"
---

# Design system: Ikigai for Humanity

## Overview

**Creative North Star: "The original pastel card game"**

Keep the user's existing warm cream game, with dark green text, four pastel categories and Fraunces headings. Manrope labels and controls keep actions readable. Reduce repeated instructions and expose optional choices only where needed.

This document records the implementation in `public/game.css`, `public/room.js`, `public/game-core.js` and `app/game.html`, checked on 2026-10-04. The user rejected replacing this identity. The discarded direction comps carry no approval.

**Key Characteristics:**

- Cream panels sit on a warm paper background.
- Pastel category fills repeat in labels, activity cards and turn prompts.
- Serif headings and card titles pair with compact sans-serif controls.
- Selection changes fill and adds a dark outline and dot.

## Colors

Coral leads the entry actions. Blue, yellow and green identify the other activity categories. Dark green ink supplies text, focus and selection contrast.

### Primary

- Coral colors Host, Create, Join and turn confirmation buttons. Its pale love tint colors the love category, brand mark and selected idea cards.
- Ink colors standard primary buttons, the selection bar and toasts. Cream text sits on those dark fills.

### Secondary

- Blue and the strength tint identify "What you are good at".
- Yellow and the opportunity tint identify "What you can be paid for". Yellow also highlights text selection.

### Tertiary

- Green and the need tint identify "What the world needs".

### Neutral

- Paper is the page background. Cream fills panels, fields, selected activity cards and recap items.
- Muted text carries supporting copy and status. Line separates players and reflection items. Field and card borders remain darker than panel dividers.

**The category rule.** Keep the love, strength, opportunity and need color mapping consistent across every view.

## Typography

Fraunces with Georgia fallback supplies headings, the brand and activity titles. Manrope with Arial fallback supplies body copy, forms, buttons and status. The stylesheet imports both families from Google Fonts.

The display role belongs to the home question. Headline belongs to each game step. Title belongs to section headings. Headings use balanced wrapping; long player content can wrap anywhere. Lead copy has a maximum width of 65ch. Screen leads reduce to 16px, helpers use 13px and compact status uses 12px. Room codes and progress counts use tabular numerals.

At the mobile breakpoint, activity titles reduce to 17px and category labels reduce from 24px to 22px. Keep button weight at 800; heading weight remains 500.

## Layout

The shell has a maximum width of 1040px and 24px side gutters. Panels cap at 860px; entry panels cap at 520px. The desktop home question is centered. Category labels and activity cards use four equal columns with 12px gaps. Idea cards use two columns, while reflection uses a 1.3-to-1 split.

At 760px and below, side gutters become 16px and the home question aligns left. Category labels and activity cards use two columns. Idea cards, reflection and recap become one column. Form footers and the sticky selection bar stack vertically. The page has a 320px minimum width. Long room links and user ideas wrap within their containers. Activity titles allow automatic hyphenation.

The activity selection bar stays 12px above the viewport bottom. Its summary and navigation remain visible while players browse cards. Its cream buttons use paper fill and ink text on hover.

## Elevation & Depth

Panels use cream fill without a resting shadow. Borders divide rows and separate controls. Only activity-card hover and transient toasts use shadows. Exact shadow values live in the sidecar. Selected cards use outlines rather than elevation.

Button color transitions last 180ms. Activity selection transitions last 200ms, with `cubic-bezier(.16,1,.3,1)` for the fill. Reduced-motion preferences disable transitions and animations and use automatic scrolling.

## Shapes

Panels and cards share the panel radius. Inputs use the smaller field radius; prompt and recap items use the chip radius. Buttons are pills. Standard controls are at least 46px tall. The compact brand button is at least 44px tall.

Keyboard focus uses a 3px ink outline with a 4px offset on buttons, fields, links and disclosure summaries. Activity selection uses a 3px ink outline with a 1px offset and a small bottom-right dot. Idea selection uses a 2px outline offset. Keep selection visible independently of category color.

## Components

### Buttons and navigation

Coral buttons carry entry and turn confirmation actions. Ink buttons carry actions such as sending and saving. Quiet buttons use a line border and transparent fill. Hover changes the background; disabled buttons use half opacity and a not-allowed cursor. The header uses the compact full-name brand, room status and a Back or Leave room action when relevant.

### Forms and optional settings

Fields use cream backgrounds and visible labels. Textareas start at 150px high and resize vertically. Host setup initially shows name and player count. A native "Game options" disclosure contains the room name and activity-card settings. Join shows name and room code. Home has Host and Join actions only.

### Category and activity cards

The four home category labels use pale category fills. Activity cards preserve those fills at rest, have a minimum desktop height of 146px and show a cream fill, ink outline and dot when selected. Their button semantics expose `aria-pressed`. Reaching the category limit disables unselected cards. The count and Next category or Save cards action update together. Search covers the full deck; the default view shows its first 24 cards plus selected cards.

### Turn prompts, ideas and recap

Prompt chips carry the activity text and category tint without decorative dots. Anonymous idea buttons use cream, with the love tint on hover and selection. Reflection uses checkboxes to keep multiple ideas; the chosen idea has a "Your favourite" label. Recap groups kept ideas and the idea bank under each player's name.

Waiting text identifies who is writing or choosing. Toasts report brief action results and use `role="status"`. The app container announces updates politely.

Current setup still exposes round settings within Game options, and the current recap has Copy recap and Done actions. The requested Keep playing, Stop playing, winner and tie behavior remains pending. This document does not define or claim those game rules.

## Do's and Don'ts

### Do:

- Do preserve the warm paper, cream, coral, blue, yellow and green palette.
- Do use Fraunces for headings and activity titles and Manrope for controls and body copy.
- Do keep category identity consistent in labels, cards and prompts.
- Do show selection through fill, outline and a dot, with keyboard focus visible.
- Do put concise instructions beside the action that needs them.
- Do respect the existing mobile grids and reduced-motion behavior.

### Don't:

- Don't treat the discarded direction comps as an approved replacement identity.
- Don't add decoration, repeated explanation or setup choices to the home actions.
- Don't use category color as the sole indication of selected state.
- Don't present pending round-ending or scoring rules as implemented behavior.

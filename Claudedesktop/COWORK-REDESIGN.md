# Cowork Page Redesign - Task Summary

## Figma Design Reference
- **URL**: https://www.figma.com/design/yIHKtceB7qr2mE2kgN02KG/Untitled--18-?node-id=1-2&m=dev
- **MCP Tool**: `plugin-figma-figma` → `get_design_context` with `fileKey: "yIHKtceB7qr2mE2kgN02KG"`, `nodeId: "1-2"`
- **Assets**: Downloaded to `src/assets/figma-exports/` (PNG originals + SVG conversions via potrace)

## Files to Modify
1. `src/components/CoworkPage.tsx` - Main Cowork page component
2. `src/index.css` - Cowork-specific CSS classes (`.cowork-*`)
3. `src/components/Icons.tsx` - `IconCoworkSparkle` component (7-pointed star SVG)

## Design Spec from Figma (Light Mode)

### Layout Structure
1. **Background**: Warm dot-grid pattern on `#F8F8F6` base
2. **Hero**: 7-pointed star SVG (#D97757) + serif title "Let's knock something off your list" (42px, semibold, #313131)
3. **Subtitle**: "Learn how to use Cowork safely." (#979591, 17px, underlined)
4. **Composer Card** (layered):
   - Outer base: `#F7F7F6` bg, rounded ~40px, contains everything
   - Inner card: `#FFFFFF` bg, border `#C7C7C7`, rounded 29px
   - Input: "How can I help you today?" placeholder (#8E8D89, 23px Inter)
   - Bottom left: "+" icon (22px)
   - Bottom right: Microphone icon (25x18px)
   - Below card (in base): "Work in a project ▾" (#61615F) | "Ask ▾" (#767674) | "Opus 4.7 ▾" (#6D6D6A)
5. **Get to know Cowork** section (NOT "Pick a task"):
   - Title: "Get to know Cowork" (#A19F9C, 21px)
   - Items with circle checkmarks:
     - ✅ "Download Cowork" / "Welcome!" 
     - ✅ "Connect your everyday tools" / "The more Claude knows your setup..."
     - ○ "Customize Claude to your role" / "Add ready-made tools and workflows"
     - ○ "Ask Claude to create something" / "Try a spreadsheet, doc, or presentation"
     - ○ "Schedule a recurring task" / "Great for reminders, reports, or regular check-ins"
   - Each item has a 36px circle (border #D1C9BA or #D2CABC), plus subtitle text

### Key Colors (Light Mode)
- Page bg: `#F8F8F6`
- Composer base: `#F7F7F6`
- Composer inner: `#FFFFFF`, border `#C7C7C7`
- Star: `#D97757`
- Title: `#313131`
- Body text: `#5E5E5E` / `#5F5F5F`
- Secondary text: `#A3A19E` / `#A19F9C`
- Placeholder: `#8E8D89`
- Footer labels: `#61615F`, `#767674`, `#6D6D6A`

### Key Colors (Dark Mode - to be derived)
- Page bg: `#191919` (neutral, NO warm orange tint)
- Composer base: `#1E1E1C`
- Composer inner: `#2A2A28`
- Text: cream/warm white `#D6CEC3`

### SVG Assets
- **7-pointed star**: Already in `Icons.tsx` as `IconCoworkSparkle` (32x32 viewBox, fill #D97757)
- **Gift lottie**: `src/assets/home/gift-giving.lottie` for Guest Pass section
- **Figma PNGs**: `src/assets/figma-exports/asset-*.png` (icons, backgrounds)
- **Figma SVGs converted**: `src/assets/figma-exports/svg-converted/asset-*.svg`
- **Vectorized SVGs**: `src/assets/figma-exports/vectorized1.svg` (chevron), `vectorized2.svg` (leaf), `vectorized3.svg`

### Important Notes
- Use Anthropic Serif font (`"Anthropic Serif", Spectral, "Source Serif 4"`) for input placeholder
- Title uses Inter Semi Bold at 42px
- All suggestion/checklist icons are monochrome gray, NOT colorful
- Background dot pattern uses warm gray dots that fade from center
- Composer card has TWO layers: outer base and inner white card
- "Let's go ↓" button (Claude orange #BF6A4A, rounded 10px) replaces mic when user types
- Keep the code highly maintainable with clear component structure

## Current State
- CoworkPage.tsx has been modified multiple times with various experiments
- CSS cowork classes are in index.css (lines ~484-610)
- `MainContent.tsx` also uses `IconCoworkSparkle` for the Chat home page

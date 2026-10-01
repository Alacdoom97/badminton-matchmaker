# Accessibility notes

Target: WCAG 2.2 Level AA. This is a design and implementation target, **not a conformance certification**. A complete audit with assistive technology and the deployed build remains necessary.

## Implemented

- Native links, buttons, selects, date/time fields, fieldsets and radio/checkbox controls, with visible labels.
- A keyboard-first skip link which focuses main content without destroying snapshot URL fragments.
- Semantic headings, landmarks, list structures and all-round schedule tables. Tables include captions and scoped row/column headers.
- Native modal dialogs with an accessible title, modal behavior, Escape support and focus return.
- Visible focus outlines, generously sized interactive controls, explicit status text and no color-only format/status encoding.
- Status announcements and error alerts. Live court-capacity warnings use a polite, atomic status region with explicit counts and text; color is supplementary. SVG decoration is hidden from assistive technology.
- Singles has named players on each side. Kungen has a numbered three-player list, textual rotation instructions, and no misleading two-against-one team. Participation counts distinguish court-group membership from active simultaneous play.
- Reflow from 320 CSS pixels up; wide data tables have labeled keyboard-focusable, contained scroll regions.
- Reduced-motion and forced-colors styles. No autoplay animation and no external fonts.
- Offline HTML and plain-text equivalents for the image exports.

## Contrast palette

The automated palette test checks 21 configured text/background pairs against 4.5:1, and input borders/focus indicators against 3:1 on white. Examples: white on primary blue `#194dc7`, white on navy `#122d4b`, primary text `#192f49` on white, muted text `#53667e` on white, and dark text on format badges. This palette test is not a substitute for checking every rendered element, hover state, overlay and exported image.

## JPEGs are supplementary, not the accessible source

The app renders the live schedule as real text. Its JPEG download uses large, high-contrast text, clear court/round/time labels, names, explicit team/player or Kungen rotation labels, format words and rest/unavailable lists. It renders each round separately so the full session does not become a single impractically tall image.

A JPEG still has no semantic table structure, adjustable text, or intrinsic screen-reader equivalent. **Send `schedule.html` or `schedule.txt` together with the JPEG.** The full ZIP includes one JPEG per round and both text alternatives. A useful short image description is: "Badminton schedule, round 2, 18:20-18:40. Full accessible schedule in the accompanying HTML/text file." The accompanying file must contain the actual complete assignments.

## Verified during preparation

Node contrast tests and 52 isolated Chromium UI checks passed. Checks included keyboard skip navigation, modal Escape/focus return, live capacity messages, singles/Kungen displays and schedule reflow at 320, 390, 768, 1024 and 1440 CSS pixels. Shared-mobile and exported JPEG output were inspected. See TESTING.md for the injected browser harness limitations; no served axe pass or assistive-technology audit is claimed.

## Audit still needed before claiming conformance

Run the included axe checks on the normally served production app. Manually check NVDA/Firefox and VoiceOver/Safari reading order, status announcements, dialogs and table navigation; 200% and 400% zoom; text-spacing overrides; mobile touch use; high-contrast modes; every validation/error state; long names and long translated labels; and exported HTML. Verify that every implemented target-size exception is acceptable under SC 2.5.8. Automated tests cannot establish full WCAG conformance.

Sources:
- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/images-of-text.html

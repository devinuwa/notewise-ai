# NoteWise AI: Prompt 01 (Setup, Design System, Loader, Home)

This file replaces section 3 (Design system) and the Home screen in BUILD_BRIEF.md, and answers the auth question.

## 0. Decision: do we need sign up / log in?

No accounts. Local-first.

- Nobody creates an account.
- First launch asks "What should we call you?" The name is saved on the device only.
- Avatar is initials in a circle.
- Data lives in IndexedDB via Dexie. Nothing is sent to our servers.
- Google sign-in is only for the later optional "Connect Google Drive" backup, with the `drive.file` scope.
- "Sign out" is "Clear my data" and "Disconnect Drive".
- The signed-out page is "Data cleared. See you soon."

Switching phones means restoring from Drive or a downloaded backup file.

## 1. Design system

Style: neo-brutalist, pixel-block. Flat colour, thick dark borders, hard offset shadows with no blur, mono labels, chunky condensed headlines.

Colours were eyedropped from the published reference brand swatches, not left as the first estimates. See BUILD_BRIEF.md section 3 for the final hex values and the one token (`--page`) that was not on that swatch list.

Fonts: Archivo (variable, narrow width, 800–900) for headlines, with Barlow Condensed ExtraBold as the fallback. Inter for body. Space Mono for nav, buttons, chips, and eyebrows.

Components: header, card, primary and secondary buttons with the press effect, four status chips, section heading with one red word and full stop, profile bar, and `PixelStairs`.

Layout: max-width 1200px. Desktop header with Home, Scan, Library, Practice, Tutor and a salmon "My NoteWise" button. Mobile: logo plus menu, and a bottom tab bar with Scan as the larger centre tab. Live Tutor stays full-screen and dark.

## 2. Loading motion

Full-viewport green splash, header visible, four squares (red, blue, yellow, salmon). They pop in, then wave. Minimum 600ms. Exit collapses the squares and fades. Content then reveals line by line, then the profile bar, then the cards. Stairs step in from the edges. `PixelLoader` is reused for waits, with a mono caption. Reduced motion shows the squares static and uses a simple fade. Content is never left at opacity 0.

## 3. Home screen

First-launch name question. Hero greeting. Profile actions. "Your Notes." and "Your Activities." Empty state for a student with no subjects. Cleared-data page after a wipe.

## 6. Originality

Use the reference only as inspiration for the style language. Do not copy its logo, wordmark, exact pixel artwork, or text. The wordmark, stair pattern, and wording are NoteWise's.

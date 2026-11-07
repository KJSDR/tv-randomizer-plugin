# TV Randomizer

Chrome extension that shuffles episodes across the shows you pick. Add a few shows, turn on shuffle, and it keeps jumping to a random episode as each one ends.

## Done

- Netflix support
- Add the current show from the popup (works from a show page, an episode, or the details popup)
- Saved show list with remove
- Shuffle on/off toggle and "Shuffle now" button
- Jumps to a random episode near the end of each episode, before Netflix's autoplay
- No repeats until every episode has played, then the list resets
- Everything is stored locally (`chrome.storage.local`), no data leaves the browser

## Planned

- Disney+ support
- Peacock support

## Publishing to the Chrome Web Store

- [ ] Add icons (16, 48, 128 px) and list them under `icons` in `manifest.json`
- [ ] Remove the empty `background.js` (or give it a job)
- [ ] Register a developer account ($5 one-time fee)
- [ ] Take at least 1 screenshot (1280×800 or 640×400), no Netflix logos
- [ ] Write the store listing: short description, category
- [ ] Fill in the privacy section (no user data collected)
- [ ] Zip the folder (not the `.crx`) and upload it
- [ ] Wait for review (usually a few days)

Updates: bump `version` in `manifest.json`, zip, upload. Adding a new site (e.g. Disney+) adds a host permission, so Chrome asks users to approve it again.

## Constraints

- It's built for background noise, not careful viewing.
- The jump happens near the end, so it may cut off the last bit of an episode (end scenes, post-credit bits).
- Timing isn't exact; it checks once a second and relies on Netflix's own episode data.
- It uses Netflix's internal player and metadata, which can change and break it without notice.

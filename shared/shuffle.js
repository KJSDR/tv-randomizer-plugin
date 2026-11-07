// Shuffle logic shared by the popup and the Netflix content script.

// Picks a random episode that hasn't been played yet, across all saved shows,
// and marks it as played. Once every episode has played, the list resets.
// Returns the episode ID, or null if no shows are saved.
async function pickNextEpisode() {
  const { shows = {}, played = [] } = await chrome.storage.local.get(["shows", "played"]);

  const allIds = Object.values(shows).flatMap((show) => show.episodes.map((ep) => ep.id));
  if (allIds.length === 0) return null;

  // Drop IDs from shows that were removed since.
  const allSet = new Set(allIds);
  let stillPlayed = played.filter((id) => allSet.has(id));

  const playedSet = new Set(stillPlayed);
  let pool = allIds.filter((id) => !playedSet.has(id));
  if (pool.length === 0) {
    pool = allIds;
    stillPlayed = [];
  }

  const nextId = pool[Math.floor(Math.random() * pool.length)];
  await chrome.storage.local.set({ played: [...stillPlayed, nextId] });
  return nextId;
}

// Marks an episode as played (used when the user opens a saved episode themselves).
async function markPlayed(episodeId) {
  const { played = [] } = await chrome.storage.local.get("played");
  if (!played.includes(episodeId)) {
    await chrome.storage.local.set({ played: [...played, episodeId] });
  }
}

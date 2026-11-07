// Runs on netflix.com pages.

// Finds the show/episode ID in the current Netflix URL.
// Works for /watch/<id>, /title/<id> and ?jbv=<id> (details popup).
function getVideoIdFromUrl(url) {
  const u = new URL(url);
  const pathMatch = u.pathname.match(/\/(?:watch|title)\/(\d+)/);
  if (pathMatch) return pathMatch[1];
  return u.searchParams.get("jbv");
}

// Fetches a show's seasons and episodes from Netflix's internal metadata endpoint.
// Runs here (not in the popup) so the request is same-origin and uses the user's login.
async function fetchShow(videoId) {
  const params = new URLSearchParams({
    movieid: videoId,
    imageFormat: "webp",
    withSize: "true",
    materialize: "true",
  });
  const res = await fetch(`/nq/website/memberapi/release/metadata?${params}`);
  if (!res.ok) throw new Error(`Netflix request failed (${res.status})`);

  const { video } = await res.json();
  if (video.type !== "show") throw new Error("This title is not a TV show");

  return {
    id: video.id,
    title: video.title,
    episodes: video.seasons.flatMap((season) =>
      season.episodes.map((ep) => ({
        id: ep.id,
        season: season.seq,
        episode: ep.seq,
        title: ep.title,
        // All in seconds. The jump uses the first one that exists.
        watchedToEndOffset: ep.watchedToEndOffset, // Netflix counts the episode as watched here; before its next-episode countdown
        creditsOffset: ep.creditsOffset, // when the credits start
        runtime: ep.runtime, // full length
      }))
    ),
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_CURRENT_SHOW") {
    const videoId = getVideoIdFromUrl(location.href);
    if (!videoId) {
      sendResponse({ error: "Open a show or an episode first." });
      return;
    }
    fetchShow(videoId)
      .then((show) => sendResponse({ show }))
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep the channel open for the async response
  }
});

// --- Shuffle: jump to a random episode near the end, before Netflix's autoplay ---

// Cached copy of storage so the timer below doesn't read storage every second.
let shuffleOn = false;
let episodesById = new Map(); // episodeId -> saved episode

function loadState(shows, on) {
  shuffleOn = Boolean(on);
  episodesById = new Map(
    Object.values(shows || {}).flatMap((show) => show.episodes.map((ep) => [ep.id, ep]))
  );
}

chrome.storage.local.get(["shows", "shuffleOn"]).then(({ shows, shuffleOn: on }) => {
  loadState(shows, on);
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !(changes.shows || changes.shuffleOn)) return;
  const { shows, shuffleOn: on } = await chrome.storage.local.get(["shows", "shuffleOn"]);
  loadState(shows, on);
});

let currentWatchId = null;
let jumping = false;

// Latest episode time from content/netflix-page.js (Netflix's player API, ads excluded).
let player = { time: null, duration: null, receivedAt: 0 };
// Ignore readings right after the episode changes, so the old episode's time can't trigger a jump.
let ignoreReadingsUntil = 0;

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "tv-randomizer") return;
  if (Date.now() < ignoreReadingsUntil) return;
  const { time, duration } = event.data;
  if (typeof time !== "number" || typeof duration !== "number") return;
  player = { time, duration, receivedAt: Date.now() };
});

// Netflix changes pages without reloading, so check the URL and video once a second.
const timer = setInterval(async () => {
  // After the extension is reloaded, this old copy of the script is cut off from Chrome.
  // Stop instead of throwing "Extension context invalidated" every second.
  if (!chrome.runtime?.id) {
    clearInterval(timer);
    return;
  }

  const match = location.pathname.match(/^\/watch\/(\d+)/);
  const watchId = match ? Number(match[1]) : null;

  if (watchId !== currentWatchId) {
    currentWatchId = watchId;
    player = { time: null, duration: null, receivedAt: 0 };
    ignoreReadingsUntil = Date.now() + 3000;
    // An episode from a saved show counts as played as soon as it's opened.
    if (watchId && episodesById.has(watchId)) markPlayed(watchId);
  }

  // Only take over during saved shows.
  if (!shuffleOn || jumping || !watchId) return;
  const episode = episodesById.get(watchId);
  if (!episode) return;

  // Need a fresh reading from Netflix's player.
  if (player.time === null || Date.now() - player.receivedAt > 3000) return;

  const jumpAt = episode.watchedToEndOffset ?? episode.creditsOffset ?? episode.runtime;
  if (jumpAt && player.time >= jumpAt) {
    jumping = true;
    const nextId = await pickNextEpisode();
    if (nextId) {
      location.href = `/watch/${nextId}`;
    } else {
      jumping = false;
    }
  }
}, 1000);

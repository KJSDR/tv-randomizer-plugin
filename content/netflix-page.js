// Runs inside Netflix's own page (manifest "world": "MAIN") so it can reach Netflix's player API.
// The <video> element's time is wrong when ads play, but the player API reports the real episode time.
// Once a second, this posts { time, duration } in seconds to content/netflix.js.

setInterval(() => {
  try {
    const videoPlayer = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
    // The episode's session ID starts with "watch-".
    const sessionId = videoPlayer.getAllPlayerSessionIds().find((id) => id.startsWith("watch-"));
    if (!sessionId) return;

    const player = videoPlayer.getVideoPlayerBySessionId(sessionId);
    window.postMessage(
      {
        source: "tv-randomizer",
        time: player.getCurrentTime() / 1000,
        duration: player.getDuration() / 1000,
      },
      location.origin
    );
  } catch {
    // Player not ready yet (or not on a watch page).
  }
}, 1000);

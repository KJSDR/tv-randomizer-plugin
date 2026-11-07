const addButton = document.getElementById("add-show");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("show-list");
const shuffleToggle = document.getElementById("shuffle-on");
const shuffleNowButton = document.getElementById("shuffle-now");

function setStatus(text) {
  statusEl.textContent = text;
}

// Saved shows look like: { [showId]: { id, title, episodes: [{ id, season, episode, title }] } }
async function getShows() {
  const { shows = {} } = await chrome.storage.local.get("shows");
  return shows;
}

async function renderShows() {
  const shows = await getShows();
  listEl.replaceChildren();

  for (const show of Object.values(shows)) {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = `${show.title} (${show.episodes.length} episodes)`;

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
      const current = await getShows();
      delete current[show.id];
      await chrome.storage.local.set({ shows: current });
      renderShows();
    });

    li.append(label, removeButton);
    listEl.append(li);
  }
}

addButton.addEventListener("click", async () => {
  setStatus("Loading…");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_SHOW" });
  } catch {
    setStatus("Open Netflix in this tab. If you just reloaded the extension, refresh the page.");
    return;
  }

  if (response.error) {
    setStatus(response.error);
    return;
  }

  const shows = await getShows();
  shows[response.show.id] = response.show;
  await chrome.storage.local.set({ shows });

  setStatus(`Added ${response.show.title}.`);
  renderShows();
});

// Shuffle on/off switch.
chrome.storage.local.get("shuffleOn").then(({ shuffleOn = false }) => {
  shuffleToggle.checked = shuffleOn;
});

shuffleToggle.addEventListener("change", () => {
  chrome.storage.local.set({ shuffleOn: shuffleToggle.checked });
});

// Turns shuffle on and opens a random episode right away.
shuffleNowButton.addEventListener("click", async () => {
  const nextId = await pickNextEpisode();
  if (!nextId) {
    setStatus("Add a show first.");
    return;
  }

  await chrome.storage.local.set({ shuffleOn: true });
  shuffleToggle.checked = true;

  const url = `https://www.netflix.com/watch/${nextId}`;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // tab.url is only visible for Netflix tabs, so this reuses a Netflix tab and opens a new one otherwise.
  if (tab?.url?.startsWith("https://www.netflix.com/")) {
    await chrome.tabs.update(tab.id, { url });
  } else {
    await chrome.tabs.create({ url });
  }
  window.close();
});

renderShows();

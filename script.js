"use strict";

const STORAGE_KEY = "matchlens.events.v1";
const EVENT_TYPES = [
  "Pass",
  "Shot",
  "Goal",
  "Dribble",
  "Tackle",
  "Interception",
  "Turnover",
  "Foul",
];

const elements = {
  videoInput: document.querySelector("#video-input"),
  video: document.querySelector("#match-video"),
  videoEmpty: document.querySelector("#video-empty"),
  videoMeta: document.querySelector("#video-meta"),
  metaName: document.querySelector("#meta-name"),
  metaDuration: document.querySelector("#meta-duration"),
  metaResolution: document.querySelector("#meta-resolution"),
  metaSize: document.querySelector("#meta-size"),
  eventForm: document.querySelector("#event-form"),
  timestamp: document.querySelector("#timestamp"),
  player: document.querySelector("#player"),
  eventType: document.querySelector("#event-type"),
  notes: document.querySelector("#notes"),
  useVideoTime: document.querySelector("#use-video-time"),
  playerSuggestions: document.querySelector("#player-suggestions"),
  statsGrid: document.querySelector("#stats-grid"),
  eventsBody: document.querySelector("#events-body"),
  eventsEmpty: document.querySelector("#events-empty"),
  eventCount: document.querySelector("#event-count"),
  exportCsv: document.querySelector("#export-csv"),
  clearEvents: document.querySelector("#clear-events"),
  playerFilter: document.querySelector("#player-filter"),
  playerEmpty: document.querySelector("#player-empty"),
  playerContent: document.querySelector("#player-content"),
  playerStats: document.querySelector("#player-stats"),
  performanceSummary: document.querySelector("#performance-summary"),
  toast: document.querySelector("#toast"),
};

let events = loadEvents();
let activeVideoUrl = null;
let toastTimer = null;

function loadEvents() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];

    return saved.filter(
      (event) =>
        event &&
        typeof event.id === "string" &&
        typeof event.player === "string" &&
        EVENT_TYPES.includes(event.eventType) &&
        ["Successful", "Unsuccessful"].includes(event.outcome) &&
        Number.isFinite(event.seconds),
    );
  } catch {
    return [];
  }
}

function saveEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    showToast("Browser storage is unavailable. Events will last until this tab closes.");
  }
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseTime(value) {
  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (
    (parts.length !== 2 && parts.length !== 3) ||
    parts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return seconds < 60 ? minutes * 60 + seconds : null;
  }

  const [hours, minutes, seconds] = parts;
  return minutes < 60 && seconds < 60 ? hours * 3600 + minutes * 60 + seconds : null;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 || value >= 100 ? 0 : 1)} ${units[index]}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function countType(source, type) {
  return source.filter((event) => event.eventType === type).length;
}

function getSummary(source) {
  const total = source.length;
  const successful = source.filter((event) => event.outcome === "Successful").length;

  return {
    total,
    successful,
    unsuccessful: total - successful,
    successRate: total ? Math.round((successful / total) * 100) : 0,
    passes: countType(source, "Pass"),
    shots: countType(source, "Shot"),
    goals: countType(source, "Goal"),
    dribbles: countType(source, "Dribble"),
    tackles: countType(source, "Tackle"),
    interceptions: countType(source, "Interception"),
    turnovers: countType(source, "Turnover"),
    fouls: countType(source, "Foul"),
  };
}

function sortedEvents() {
  return [...events].sort(
    (a, b) => a.seconds - b.seconds || (a.createdAt || 0) - (b.createdAt || 0),
  );
}

function renderStats() {
  const stats = getSummary(events);
  const cards = [
    ["Total events", stats.total],
    ["Successful actions", stats.successful],
    ["Unsuccessful actions", stats.unsuccessful],
    ["Success rate", `${stats.successRate}%`, true],
    ["Passes", stats.passes],
    ["Shots", stats.shots],
    ["Goals", stats.goals],
    ["Tackles", stats.tackles],
    ["Interceptions", stats.interceptions],
    ["Turnovers", stats.turnovers],
  ];

  elements.statsGrid.replaceChildren(
    ...cards.map(([label, value, featured]) => {
      const card = document.createElement("article");
      card.className = `stat-card${featured ? " featured" : ""}`;

      const labelElement = document.createElement("span");
      labelElement.className = "stat-label";
      labelElement.textContent = label;

      const valueElement = document.createElement("strong");
      valueElement.className = "stat-value";
      valueElement.textContent = value;

      card.append(labelElement, valueElement);
      return card;
    }),
  );
}

function makeCell(content, className = "") {
  const cell = document.createElement("td");
  cell.textContent = content;
  if (className) cell.className = className;
  return cell;
}

function renderEvents() {
  const ordered = sortedEvents();
  elements.eventsBody.replaceChildren();

  ordered.forEach((event) => {
    const row = document.createElement("tr");
    const timeCell = makeCell(formatTime(event.seconds));
    const playerCell = makeCell(event.player);

    const eventCell = document.createElement("td");
    const eventChip = document.createElement("span");
    eventChip.className = "event-chip";
    eventChip.textContent = event.eventType;
    eventCell.append(eventChip);

    const outcomeCell = document.createElement("td");
    const outcomeChip = document.createElement("span");
    outcomeChip.className = `outcome-chip ${event.outcome === "Successful" ? "success" : "fail"}`;
    outcomeChip.textContent = event.outcome;
    outcomeCell.append(outcomeChip);

    const notesCell = makeCell(event.notes || "—", "notes-cell");
    notesCell.title = event.notes || "";

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-event";
    deleteButton.type = "button";
    deleteButton.dataset.eventId = event.id;
    deleteButton.setAttribute("aria-label", `Delete ${event.eventType} by ${event.player}`);
    deleteButton.title = "Delete event";
    deleteButton.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';
    actionCell.append(deleteButton);

    row.append(timeCell, playerCell, eventCell, outcomeCell, notesCell, actionCell);
    elements.eventsBody.append(row);
  });

  const hasEvents = events.length > 0;
  elements.eventsEmpty.hidden = hasEvents;
  elements.eventCount.textContent = events.length;
  elements.exportCsv.disabled = !hasEvents;
  elements.clearEvents.disabled = !hasEvents;
}

function renderPlayerOptions() {
  const players = [...new Set(events.map((event) => event.player))].sort((a, b) =>
    a.localeCompare(b),
  );
  const selected = players.includes(elements.playerFilter.value)
    ? elements.playerFilter.value
    : players[0] || "";

  elements.playerFilter.replaceChildren();
  elements.playerSuggestions.replaceChildren(
    ...players.map((player) => {
      const option = document.createElement("option");
      option.value = player;
      return option;
    }),
  );

  if (!players.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No players yet";
    elements.playerFilter.append(option);
    elements.playerFilter.disabled = true;
    return;
  }

  players.forEach((player) => {
    const option = document.createElement("option");
    option.value = player;
    option.textContent = player;
    elements.playerFilter.append(option);
  });
  elements.playerFilter.disabled = false;
  elements.playerFilter.value = selected;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function makePerformanceSummary(player, stats) {
  if (!stats.total) return "No actions have been recorded for this player.";

  const sentences = [
    `${player} recorded ${pluralize(stats.total, "action")} with a ${stats.successRate}% success rate.`,
  ];

  if (stats.goals > 0) {
    const shotContext =
      stats.shots > 0 ? ` from ${pluralize(stats.shots, "shot")}` : "";
    sentences.push(
      `${pluralize(stats.goals, "goal")}${shotContext} provided clear attacking impact.`,
    );
  } else if (stats.shots > 0) {
    sentences.push(
      `${pluralize(stats.shots, "shot")} were logged, with no goals recorded in this sample.`,
    );
  }

  if (stats.passes >= 3) {
    sentences.push(
      `${pluralize(stats.passes, "pass", "passes")} made passing the player's most frequent recorded contribution.`,
    );
  }

  if (stats.tackles + stats.interceptions >= 2) {
    sentences.push(
      `${pluralize(stats.tackles + stats.interceptions, "defensive action")} showed active defensive involvement.`,
    );
  }

  if (stats.turnovers >= 2) {
    sentences.push(
      `${pluralize(stats.turnovers, "turnover")} suggest ball retention is an area to review.`,
    );
  } else if (stats.successRate >= 80 && stats.total >= 3) {
    sentences.push("The recorded sample shows strong execution and consistency.");
  } else if (stats.successRate < 50 && stats.total >= 3) {
    sentences.push("The recorded sample highlights opportunities to improve action completion.");
  }

  if (stats.total < 3) {
    sentences.push("Log more actions before drawing a firm performance conclusion.");
  }

  return sentences.join(" ");
}

function renderPlayerAnalysis() {
  const selected = elements.playerFilter.value;
  const playerEvents = events.filter((event) => event.player === selected);
  const hasPlayer = Boolean(selected && playerEvents.length);

  elements.playerEmpty.hidden = hasPlayer;
  elements.playerContent.hidden = !hasPlayer;
  if (!hasPlayer) return;

  const stats = getSummary(playerEvents);
  const metrics = [
    ["Total actions", stats.total],
    ["Successful", stats.successful],
    ["Success rate", `${stats.successRate}%`],
    ["Passes", stats.passes],
    ["Shots", stats.shots],
    ["Goals", stats.goals],
    ["Tackles", stats.tackles],
    ["Turnovers", stats.turnovers],
  ];

  elements.playerStats.replaceChildren(
    ...metrics.map(([label, value]) => {
      const item = document.createElement("div");
      item.className = "player-stat";
      const labelElement = document.createElement("span");
      labelElement.textContent = label;
      const valueElement = document.createElement("strong");
      valueElement.textContent = value;
      item.append(labelElement, valueElement);
      return item;
    }),
  );
  elements.performanceSummary.textContent = makePerformanceSummary(selected, stats);
}

function render() {
  renderStats();
  renderEvents();
  renderPlayerOptions();
  renderPlayerAnalysis();
}

function handleVideoSelection() {
  const file = elements.videoInput.files?.[0];
  if (!file) return;

  if (file.type && file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
    showToast("Please select an MP4 video.");
    elements.videoInput.value = "";
    return;
  }

  if (activeVideoUrl) URL.revokeObjectURL(activeVideoUrl);
  activeVideoUrl = URL.createObjectURL(file);

  elements.video.src = activeVideoUrl;
  elements.video.hidden = false;
  elements.videoEmpty.hidden = true;
  elements.videoMeta.hidden = false;
  elements.metaName.textContent = file.name;
  elements.metaDuration.textContent = "Reading…";
  elements.metaResolution.textContent = "Reading…";
  elements.metaSize.textContent = formatFileSize(file.size);
  elements.useVideoTime.disabled = false;
  elements.video.load();
}

function useCurrentVideoTime() {
  if (!elements.video.src || !Number.isFinite(elements.video.currentTime)) return;
  elements.timestamp.value = formatTime(elements.video.currentTime);
  showToast(`Timestamp set to ${elements.timestamp.value}`);
}

function handleEventSubmit(event) {
  event.preventDefault();
  const seconds = parseTime(elements.timestamp.value);
  const player = elements.player.value.trim().replace(/\s+/g, " ");

  if (seconds === null) {
    elements.timestamp.setCustomValidity("Use MM:SS or H:MM:SS (for example, 12:34).");
    elements.timestamp.reportValidity();
    return;
  }

  if (!player) {
    elements.player.setCustomValidity("Enter a player name.");
    elements.player.reportValidity();
    return;
  }

  const outcome = new FormData(elements.eventForm).get("outcome");
  const newEvent = {
    id: makeId(),
    seconds,
    player,
    eventType: elements.eventType.value,
    outcome,
    notes: elements.notes.value.trim(),
    createdAt: Date.now(),
  };

  events.push(newEvent);
  saveEvents();
  render();

  elements.notes.value = "";
  if (elements.video.src && Number.isFinite(elements.video.currentTime)) {
    elements.timestamp.value = formatTime(elements.video.currentTime);
  }
  showToast(`${newEvent.eventType} recorded for ${newEvent.player}`);
  elements.eventType.focus();
}

function deleteEvent(id) {
  events = events.filter((event) => event.id !== id);
  saveEvents();
  render();
  showToast("Event deleted");
}

function csvValue(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  if (!events.length) return;
  const rows = [
    ["Timestamp", "Seconds", "Player", "Event Type", "Outcome", "Notes"],
    ...sortedEvents().map((event) => [
      formatTime(event.seconds),
      event.seconds,
      event.player,
      event.eventType,
      event.outcome,
      event.notes,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `matchlens-events-${date}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV exported");
}

elements.videoInput.addEventListener("change", handleVideoSelection);
elements.video.addEventListener("loadedmetadata", () => {
  elements.metaDuration.textContent = formatTime(elements.video.duration);
  elements.metaResolution.textContent = `${elements.video.videoWidth} × ${elements.video.videoHeight}`;
});
elements.video.addEventListener("error", () => {
  elements.metaDuration.textContent = "Unavailable";
  elements.metaResolution.textContent = "Unavailable";
  showToast("This browser could not play the selected MP4 codec.");
});
elements.useVideoTime.addEventListener("click", useCurrentVideoTime);
elements.eventForm.addEventListener("submit", handleEventSubmit);
elements.timestamp.addEventListener("input", () => elements.timestamp.setCustomValidity(""));
elements.player.addEventListener("input", () => elements.player.setCustomValidity(""));
elements.eventsBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-event-id]");
  if (button) deleteEvent(button.dataset.eventId);
});
elements.clearEvents.addEventListener("click", () => {
  if (!events.length || !window.confirm("Clear every recorded event? This cannot be undone.")) return;
  events = [];
  saveEvents();
  render();
  showToast("All events cleared");
});
elements.exportCsv.addEventListener("click", exportCsv);
elements.playerFilter.addEventListener("change", renderPlayerAnalysis);
window.addEventListener("beforeunload", () => {
  if (activeVideoUrl) URL.revokeObjectURL(activeVideoUrl);
});

render();

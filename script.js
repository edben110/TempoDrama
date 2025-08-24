const audio = document.getElementById("audioPlayer");
const playPauseBtn = document.getElementById("playPause");
const seekBar = document.getElementById("seekBar");
const volumeBar = document.getElementById("volumeBar");
const timeDisplay = document.getElementById("timeDisplay");

let timer, timeRemaining = 0, isPaused = false;
let songs = [], selectedSong = null;
const songList = document.getElementById("songList");

let db;

/*Init Index*/
const request = indexedDB.open("MiReproductorDB", 1);

request.onupgradeneeded = function (event) {
  db = event.target.result;
  if (!db.objectStoreNames.contains("songs")) {
    db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = function (event) {
  db = event.target.result;
  cargarCanciones();
};

request.onerror = function (event) {
  console.error("Error al abrir IndexedDB", event.target.error);
};

/*player controler*/
playPauseBtn.addEventListener("click", () => {
  if (audio.paused) {
    audio.play();
    playPauseBtn.textContent = "⏸";
  } else {
    audio.pause();
    playPauseBtn.textContent = "▶";
  }
});

audio.addEventListener("loadedmetadata", () => {
  seekBar.max = Math.floor(audio.duration);
  timeDisplay.textContent = "00:00 / " + formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  seekBar.value = Math.floor(audio.currentTime);
  timeDisplay.textContent =
    formatTime(audio.currentTime) + " / " + formatTime(audio.duration);
});

seekBar.addEventListener("input", () => {
  audio.currentTime = seekBar.value;
});

volumeBar.addEventListener("input", () => {
  audio.volume = volumeBar.value;
});

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

/*Temporizer*/
function startTimer() {
  if (isPaused) return;
  const horas = +document.getElementById("horas").value || 0;
  const minutos = +document.getElementById("minutos").value || 0;
  const segundos = +document.getElementById("segundos").value || 0;

  timeRemaining = horas * 3600 + minutos * 60 + segundos;
  clearInterval(timer);
  timer = setInterval(updateTimer, 1000);
  isPaused = false;
}

function pauseTimer() {
  clearInterval(timer);
  isPaused = true;
  audio.pause();
}

function resumeTimer() {
  if (isPaused && timeRemaining > 0) {
    timer = setInterval(updateTimer, 1000);
    isPaused = false;
    if (selectedSong && audio.src) audio.play();
  }
}

function resetTimer() {
  clearInterval(timer);
  timeRemaining = 0;
  isPaused = false;
  document.getElementById("timerDisplay").textContent = "00:00:00";
  audio.pause();
  audio.currentTime = 0;
}

function updateTimer() {
  if (timeRemaining <= 0) {
    clearInterval(timer);
    document.getElementById("timerDisplay").textContent = "00:00:00";
    if (selectedSong && getMode() === "end") playSong(selectedSong);
    return;
  }

  timeRemaining--;

  if (selectedSong && getMode() === "before" && timeRemaining === selectedSong.duration) {
    playSong(selectedSong);
  }

  document.getElementById("timerDisplay").textContent = formatTimeHMS(timeRemaining);
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function formatTimeHMS(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

/*Indexed DB*/
document.getElementById("fileInput").addEventListener("change", (event) => {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const tempAudio = new Audio(URL.createObjectURL(file));
    tempAudio.addEventListener("loadedmetadata", () => {
      const song = {
        name: file.name,
        blob: file,
        duration: Math.floor(tempAudio.duration)
      };
      guardarCancion(song);
    });
  });
});

function guardarCancion(song) {
  const tx = db.transaction("songs", "readwrite");
  const store = tx.objectStore("songs");
  store.add(song);
  tx.oncomplete = () => cargarCanciones();
  tx.onerror = (e) => console.error("Error guardando canción", e);
}

function cargarCanciones() {
  songs = [];
  const tx = db.transaction("songs", "readonly");
  const store = tx.objectStore("songs");
  const request = store.openCursor();

  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      const song = cursor.value;
      const url = URL.createObjectURL(song.blob);
      songs.push({ id: song.id, name: song.name, url, duration: song.duration });
      cursor.continue();
    } else {
      renderSongs();
    }
  };
}

function renderSongs() {
  songList.innerHTML = "";
  songs.forEach((song, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${song.name}</strong> - ${formatTime(song.duration)}<br>`;
    
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Seleccionar";
    selectBtn.addEventListener("click", () => selectSong(index));

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Eliminar";
    removeBtn.addEventListener("click", () => removeSong(index));

    li.append(selectBtn, removeBtn);
    if (selectedSong && selectedSong.id === song.id) li.classList.add("selected");
    songList.appendChild(li);
  });
}

function selectSong(index) {
  selectedSong = songs[index];
  renderSongs();
}

function removeSong(index) {
  const song = songs[index];
  if (!song) return;

  const tx = db.transaction("songs", "readwrite");
  const store = tx.objectStore("songs");
  store.delete(song.id);

  tx.oncomplete = () => {
    if (selectedSong && selectedSong.id === song.id) {
      selectedSong = null;
      audio.pause();
      audio.src = "";
    }
    cargarCanciones();
  };
}

function playSong(song) {
  audio.src = song.url;
  audio.play();
}
/*Control Buttons*/
document.getElementById("start").addEventListener("click", startTimer);
document.getElementById("pause").addEventListener("click", pauseTimer);
document.getElementById("resume").addEventListener("click", resumeTimer);
document.getElementById("reset").addEventListener("click", resetTimer);

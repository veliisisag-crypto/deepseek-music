// Welly Player v18.5 - iframe + Wake Lock (ekran kapanmaz)
console.log('🎵 Welly Player v18.5');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let localAudio = document.getElementById('localAudio');
let isPlaying = false;
let currentSource = null;
let searchResults = [];
let searchResultIndex = -1;
let localFiles = [];
let searchMode = null;
let seekInterval = null;
let m3uPlaylists = {};
let activePlaylist = 'all';
let shuffleMode = false;
let shuffleHistory = [];
let wakeLock = null; // Wake Lock

// ============ INDEXEDDB (aynı) ============
// ... (önceki sürümdeki IndexedDB kodları aynen)
const DB_NAME = 'welly_db_v17';
const DB_VERSION = 2;
const STORE_FILES = 'music_files';
const STORE_M3U = 'm3u_playlists';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORE_M3U)) db.createObjectStore(STORE_M3U, { keyPath: 'name' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveFilesToDB(files) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FILES, 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        store.clear();
        for (let i = 0; i < files.length; i++) {
            store.put({ id: i, name: files[i].name, fullName: files[i].fullName, size: files[i].size, type: files[i].type, file: files[i].file });
        }
        return new Promise(resolve => { tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); });
    } catch(e) { return false; }
}

async function loadFilesFromDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FILES, 'readonly');
        const store = tx.objectStore(STORE_FILES);
        return new Promise(resolve => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result.map(item => ({ name: item.name, fullName: item.fullName, size: item.size, type: item.type, file: item.file })));
            req.onerror = () => resolve([]);
        });
    } catch(e) { return []; }
}

async function saveM3UToDB(name, tracks) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_M3U, 'readwrite');
        const store = tx.objectStore(STORE_M3U);
        store.put({ name, tracks: tracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, source: t.source })) });
        return new Promise(resolve => { tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); });
    } catch(e) { return false; }
}

async function loadM3UFromDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_M3U, 'readonly');
        const store = tx.objectStore(STORE_M3U);
        return new Promise(resolve => {
            const req = store.getAll();
            req.onsuccess = () => {
                const playlists = {};
                req.result.forEach(item => { playlists[item.name] = item.tracks || []; });
                resolve(playlists);
            };
            req.onerror = () => resolve({});
        });
    } catch(e) { return {}; }
}

// ============ YÜKLE (aynı) ============
try { playlist = JSON.parse(localStorage.getItem('playlist_v17') || '[]'); } catch(e) { playlist = []; }

Promise.all([loadFilesFromDB(), loadM3UFromDB()]).then(([files, m3u]) => {
    if (files.length > 0) {
        localFiles = files;
        const hasRealFiles = files.some(f => f.file && f.file instanceof File);
        const info = document.getElementById('folderInfo');
        const btn = document.getElementById('folderBtn');
        if (hasRealFiles) {
            if (info) info.textContent = `Kayıtlı (${files.length} şarkı) ✅`;
            if (btn) { btn.style.borderColor = '#00ff00'; btn.style.color = '#00ff00'; }
        } else {
            if (info) info.textContent = `Kayıtlı (${files.length} şarkı) ⚠️`;
            if (btn) { btn.style.borderColor = '#ffaa00'; btn.style.color = '#ffaa00'; }
        }
        buildAllSongsPlaylist();
        switchPlaylist('all');
    }
    if (Object.keys(m3u).length > 0) {
        m3uPlaylists = m3u;
        updatePlaylistSelector();
    }
    restoreSession();
    updateUI();
});

// ============ WAKE LOCK ============
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock serbest bırakıldı');
            });
            console.log('🔒 Wake Lock aktif');
        } catch (err) {
            console.warn('Wake Lock alınamadı:', err);
        }
    }
}

async function releaseWakeLock() {
    if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
        console.log('🔓 Wake Lock bırakıldı');
    }
}

function onYouTubeIframeAPIReady() {
    console.log('✅ YouTube IFrame API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ TÜM ŞARKILAR ============
function buildAllSongsPlaylist() {
    const allTracks = localFiles
        .filter(f => f.file && f.file instanceof File)
        .map(f => ({ id: 'local_' + f.name, title: f.name, artist: 'Telefon', thumbnail: '', source: 'local', file: f }));
    m3uPlaylists['all'] = allTracks;
}

// ============ PLAYLIST SEÇİCİ ============
// ... (öncekiyle aynı) ...

function updatePlaylistSelector() {
    const playlistBox = document.getElementById('playlist');
    if (!playlistBox) return;
    const m3uNames = Object.keys(m3uPlaylists).filter(name => name !== 'all');
    const tabsHTML = `
        <button onclick="switchPlaylist('all')" style="padding:6px 12px;border-radius:15px;border:1px solid #555;background:${activePlaylist==='all'?'#ff0000':'#222'};color:#fff;font-size:11px;cursor:pointer;margin:2px">📁 Tüm Şarkılar</button>
        ${m3uNames.map(name => `<button onclick="switchPlaylist('${name}')" style="padding:6px 12px;border-radius:15px;border:1px solid #ff8800;background:${activePlaylist===name?'#ff8800':'#222'};color:#fff;font-size:11px;cursor:pointer;margin:2px">📋 ${name}</button>`).join('')}
    `;
    let container = playlistBox.querySelector('.playlist-tabs');
    if (!container) {
        container = document.createElement('div');
        container.className = 'playlist-tabs';
        container.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px';
        playlistBox.prepend(container);
    }
    container.innerHTML = tabsHTML;
}

function switchPlaylist(name) {
    activePlaylist = name;
    currentIndex = -1;
    stopAll();
    document.getElementById('player').style.display = 'none';
    shuffleHistory = [];
    searchResults = [];
    searchResultIndex = -1;
    if (name === 'all') buildAllSongsPlaylist();
    if (m3uPlaylists[name]) {
        playlist = m3uPlaylists[name].map(t => {
            const localFile = localFiles.find(f => f.name.toLowerCase().includes(t.title.toLowerCase()) && f.file && f.file instanceof File);
            return { id: t.id || 'm3u_' + t.title, title: t.title, artist: t.artist || 'M3U', thumbnail: '', source: localFile ? 'local' : (t.source || 'youtube'), file: localFile || (t.file || null) };
        });
    } else { playlist = []; }
    savePlaylist();
    updateUI();
    updatePlaylistSelector();
    showStatus(`📋 ${name === 'all' ? 'Tüm Şarkılar' : name} (${playlist.length} şarkı)`);
}

// ============ SHUFFLE ============
function toggleShuffle() {
    shuffleMode = !shuffleMode;
    const btn = document.getElementById('shuffleBtn');
    if (shuffleMode) { btn.textContent = '🔀'; btn.style.background = '#ff8800'; btn.title = 'Karışık'; showStatus('🔀 Karışık çalma'); }
    else { btn.textContent = '🔁'; btn.style.background = '#333'; btn.title = 'Sıralı'; showStatus('🔁 Sıralı çalma'); }
}

// ============ KLASÖR, M3U, SESLİ ARAMA (aynı) ============
// ... (öncekiyle aynı) ...
// (Kod tekrarı olmaması için buraya yazmıyorum, önceki sürümdeki haliyle kalacak)

// ============ ARAMA (aynı) ============
// ...

// ============ OYNATMA ============
function addAndPlay(track) { const existing = playlist.findIndex(t => t.id === track.id); if (existing >= 0) currentIndex = existing; else { playlist.push(track); savePlaylist(); currentIndex = playlist.length - 1; } updateUI(); playTrack(track); }

function playTrack(track) {
    stopAll();
    const idx = playlist.findIndex(t => t.id === track.id); if (idx >= 0) currentIndex = idx;
    document.getElementById('player').style.display = 'block';
    document.getElementById('title').textContent = track.title;
    document.getElementById('artist').textContent = track.artist;
    document.getElementById('thumbnail').src = track.thumbnail || '';
    document.getElementById('playBtn').textContent = '⏸️';
    document.getElementById('seekSlider').value = 0;
    document.getElementById('seekTime').textContent = '00:00 / 00:00';
    isPlaying = true; currentSource = track.source;
    
    if (track.source === 'youtube') {
        playYouTube(track);
        requestWakeLock(); // Ekranı açık tut
    } else {
        playLocal(track);
        releaseWakeLock(); // Yerel çalarken wake lock gerekmez
    }
    updateUI(); saveSession(track);
    document.getElementById('player').scrollIntoView({ behavior: 'smooth' });
}

function playYouTube(track) {
    destroyPlayer();
    document.getElementById('playerFrame').innerHTML = '<div id="ytplayer"></div>';
    setTimeout(() => {
        try {
            ytPlayer = new YT.Player('ytplayer', {
                height: '1', width: '1', videoId: track.id,
                playerVars: { autoplay: 1, controls: 0, playsinline: 1, origin: window.location.origin },
                events: {
                    onReady: (e) => {
                        e.target.setVolume(localStorage.getItem('vol_v18') || 70);
                        e.target.unMute();
                        e.target.playVideo();
                        startSeekUpdate();
                    },
                    onStateChange: (e) => {
                        if (e.data === 0) { stopSeekUpdate(); releaseWakeLock(); nextTrack(); }
                        else if (e.data === 1) { isPlaying = true; document.getElementById('playBtn').textContent = '⏸️'; }
                        else if (e.data === 2) { isPlaying = false; document.getElementById('playBtn').textContent = '▶️'; releaseWakeLock(); }
                    },
                    onError: () => { stopSeekUpdate(); releaseWakeLock(); nextTrack(); }
                }
            });
        } catch(e) {}
    }, 100);

    fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${track.id}&format=json`)
        .then(r => r.json()).then(d => {
            track.title = cleanFileName(d.title.replace(' - YouTube', ''));
            track.artist = d.author_name || 'YouTube';
            document.getElementById('title').textContent = track.title;
            document.getElementById('artist').textContent = track.artist;
            savePlaylist(); updateUI();
        }).catch(() => {});
}

function playLocal(track) {
    if (!track.file || !track.file.file) { showStatus('❌ Dosya bulunamadı'); stopAll(); document.getElementById('player').style.display = 'none'; return; }
    try {
        const url = URL.createObjectURL(track.file.file); localAudio.src = url;
        localAudio.volume = (localStorage.getItem('vol_v18')||70)/100;
        localAudio.onloadedmetadata = () => { localAudio.play(); startSeekUpdate(); };
        localAudio.onended = () => { stopSeekUpdate(); nextTrack(); };
        localAudio.onerror = () => { stopSeekUpdate(); nextTrack(); };
        localAudio.play().catch(() => {});
    } catch(e) {}
}

function destroyPlayer() {
    if (ytPlayer) { try { ytPlayer.stopVideo(); ytPlayer.destroy(); } catch(e) {} ytPlayer = null; }
}

function stopAll() {
    stopSeekUpdate();
    destroyPlayer();
    try { localAudio.pause(); localAudio.src = ''; } catch(e) {}
    isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️';
    document.getElementById('seekSlider').value = 0;
    document.getElementById('seekTime').textContent = '00:00 / 00:00';
    releaseWakeLock();
}

function togglePlay() {
    if (!isPlaying && !ytPlayer && !localAudio.src) { if (currentIndex >= 0 && playlist[currentIndex]) playTrack(playlist[currentIndex]); return; }
    if (currentSource === 'youtube' && ytPlayer) {
        try { if (isPlaying) ytPlayer.pauseVideo(); else { ytPlayer.unMute(); ytPlayer.playVideo(); requestWakeLock(); } } catch(e) {}
    } else if (currentSource === 'local' && localAudio.src) {
        if (isPlaying) localAudio.pause(); else localAudio.play();
        isPlaying = !isPlaying;
        document.getElementById('playBtn').textContent = isPlaying ? '⏸️' : '▶️';
    }
}

// ============ SEEK BAR (güncellendi) ============
function startSeekUpdate() {
    stopSeekUpdate();
    seekInterval = setInterval(() => {
        let c=0, d=0;
        if (currentSource === 'youtube' && ytPlayer && ytPlayer.getCurrentTime) {
            c = ytPlayer.getCurrentTime() || 0;
            d = ytPlayer.getDuration() || 0;
        } else if (currentSource === 'local' && localAudio.duration) {
            c = localAudio.currentTime;
            d = localAudio.duration;
        }
        if (d > 0) {
            document.getElementById('seekSlider').max = d;
            document.getElementById('seekSlider').value = c;
            document.getElementById('seekTime').textContent = formatTime(c) + ' / ' + formatTime(d);
        }
    }, 500);
}
function stopSeekUpdate() { if (seekInterval) { clearInterval(seekInterval); seekInterval = null; } }
function seekTo(value) {
    const t = parseFloat(value);
    if (currentSource === 'youtube' && ytPlayer) ytPlayer.seekTo(t, true);
    else if (currentSource === 'local') localAudio.currentTime = t;
}
function formatTime(sec) { if (!sec||isNaN(sec)) return '00:00'; const m=Math.floor(sec/60),s=Math.floor(sec%60); return m.toString().padStart(2,'0')+':'+s.toString().padStart(2,'0'); }

// ============ GEZİNME ============
function nextTrack() {
    if (searchResults.length > 0 && searchResultIndex < searchResults.length - 1) {
        playResult(searchResultIndex + 1); return;
    }
    if (playlist.length === 0) { stopAll(); document.getElementById('player').style.display = 'none'; return; }
    
    if (shuffleMode) {
        let nextIdx; if (playlist.length === 1) nextIdx = 0;
        else { do { nextIdx = Math.floor(Math.random() * playlist.length); } while (nextIdx === currentIndex && playlist.length > 1); }
        shuffleHistory.push(nextIdx); if (shuffleHistory.length > playlist.length) shuffleHistory = shuffleHistory.slice(-playlist.length);
        currentIndex = nextIdx;
    } else {
        if (currentIndex < playlist.length - 1) currentIndex++;
        else { stopAll(); document.getElementById('player').style.display = 'none'; showStatus('📋 Liste sonu'); return; }
    }
    playTrack(playlist[currentIndex]);
}

function prevTrack() {
    if (searchResults.length > 0 && searchResultIndex > 0) { playResult(searchResultIndex - 1); return; }
    if (playlist.length === 0) { stopAll(); document.getElementById('player').style.display = 'none'; return; }
    if (shuffleMode && shuffleHistory.length > 1) { shuffleHistory.pop(); const prevIdx = shuffleHistory[shuffleHistory.length - 1]; currentIndex = prevIdx; }
    else if (currentIndex > 0) { currentIndex--; }
    else {
        if (currentSource === 'youtube' && ytPlayer) { ytPlayer.seekTo(0); ytPlayer.playVideo(); }
        else if (currentSource === 'local') { localAudio.currentTime = 0; localAudio.play(); }
        showStatus('🔄 Başa sarıldı'); return;
    }
    playTrack(playlist[currentIndex]);
}

function pauseTrack() {
    if (currentSource === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
    else if (currentSource === 'local') localAudio.pause();
    isPlaying = false; document.getElementById('playBtn').textContent = '▶️';
    releaseWakeLock();
}
function resumeTrack() {
    if (currentSource === 'youtube' && ytPlayer) { ytPlayer.playVideo(); requestWakeLock(); }
    else if (currentSource === 'local') localAudio.play();
    isPlaying = true; document.getElementById('playBtn').textContent = '⏸️';
}
function setVolume(val) {
    if (currentSource === 'youtube' && ytPlayer) ytPlayer.setVolume(val);
    else if (currentSource === 'local') localAudio.volume = val/100;
    localStorage.setItem('vol_v18', val);
}

// ============ PLAYLIST ve YARDIMCILAR (aynı) ============
// ... (öncekiyle aynı)

// ============ ENTER ============
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('keypress', (e) => { if (e.key==='Enter') { const v=document.getElementById('searchInput').value.trim(); if (v.includes('youtube.com')||v.includes('youtu.be')) pasteAndPlay(); else searchYouTube(); } });
});

document.getElementById('volSlider').value = localStorage.getItem('vol_v18') || 70;
updateUI();
console.log('✅ v18.5 hazır - Wake Lock ile ekran açık kalır');

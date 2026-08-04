// YT MUSIC v17.0 - IndexedDB'ye Dosya Kaydetme (Tek Seferlik Klasör)
console.log('🎵 YT Music v17.0');

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

// ============ INDEXEDDB (DOSYALARI SAKLA) ============

const DB_NAME = 'ytmusic_files_v17';
const DB_VERSION = 1;
const STORE_NAME = 'music_files';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// DOSYALARI IndexedDB'ye KAYDET (File objesi dahil)
async function saveFilesToDB(files) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            store.put({
                id: i,
                name: f.name,
                fullName: f.fullName,
                size: f.size,
                type: f.type,
                file: f.file  // FILE OBJESİNİ KAYDET!
            });
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) {
        console.error('Kayıt hatası:', e);
        return false;
    }
}

// IndexedDB'den DOSYALARI YÜKLE
async function loadFilesFromDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve) => {
            const req = store.getAll();
            req.onsuccess = () => {
                const data = req.result;
                const files = data.map(item => ({
                    name: item.name,
                    fullName: item.fullName,
                    size: item.size,
                    type: item.type,
                    file: item.file  // FILE OBJESİ BURADA!
                }));
                resolve(files);
            };
            req.onerror = () => resolve([]);
        });
    } catch(e) { return []; }
}

// IndexedDB'de dosya var mı?
async function hasFilesInDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        return new Promise(resolve => {
            const req = store.count();
            req.onsuccess = () => resolve(req.result > 0);
            req.onerror = () => resolve(false);
        });
    } catch(e) { return false; }
}

// ============ YÜKLE ============

try { playlist = JSON.parse(localStorage.getItem('playlist_v17') || '[]'); } catch(e) { playlist = []; }

// IndexedDB'den dosyaları yükle
loadFilesFromDB().then(files => {
    if (files.length > 0) {
        localFiles = files;
        const hasRealFiles = files.some(f => f.file && f.file instanceof File);
        
        const info = document.getElementById('folderInfo');
        const btn = document.getElementById('folderBtn');
        
        if (hasRealFiles) {
            if (info) info.textContent = `Kayıtlı (${files.length} şarkı) ✅`;
            if (btn) { btn.style.borderColor = '#00ff00'; btn.style.color = '#00ff00'; }
            console.log('✅ ' + files.length + ' dosya IndexedDBden yüklendi (çalabilir)');
        } else {
            if (info) info.textContent = `Kayıtlı (${files.length} şarkı) ⚠️`;
            if (btn) { btn.style.borderColor = '#ffaa00'; btn.style.color = '#ffaa00'; }
            console.log('⚠️ ' + files.length + ' dosya var ama File objesi bozuk');
        }
    }
});

function onYouTubeIframeAPIReady() {
    console.log('✅ API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ KLASÖR ============

function pickFolder() { document.getElementById('folderInput').click(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanFileName(name) {
    let fixed = name;
    try { fixed = decodeURIComponent(name); } catch(e) {}
    
    const chars = {
        '%C4%B1':'ı','%C4%B0':'İ','%C3%BC':'ü','%C3%9C':'Ü',
        '%C3%B6':'ö','%C3%96':'Ö','%C3%A7':'ç','%C3%87':'Ç',
        '%C5%9F':'ş','%C5%9E':'Ş','%C4%9F':'ğ','%C4%9E':'Ğ',
        '%20':' ','%2F':'/','%3A':':','%2C':',','%27':"'",'%26':'&','%23':'#','%21':'!','%28':'(','%29':')','%5B':'[','%5D':']','%2B':'+','%3D':'=','%3B':';','%40':'@','%24':'$','%25':'%','%5E':'^','%60':'`'
    };
    for (const [c, r] of Object.entries(chars)) {
        while (fixed.includes(c)) fixed = fixed.replace(c, r);
    }
    
    const parts = fixed.split('/');
    fixed = parts[parts.length - 1];
    fixed = fixed.replace(/\.[^.]+$/, '');
    fixed = fixed.replace(/^\d+[\.\-\s\)]\s*/, '');
    fixed = fixed.replace(/^\d+\s*-\s*/, '');
    fixed = fixed.replace(/\(_[a-zA-Z0-9_-]{8,15}_\)/g, '');
    fixed = fixed.replace(/\([a-zA-Z0-9_-]{11}\)$/g, '');
    fixed = fixed.replace(/[a-zA-Z0-9_-]{11}$/g, '');
    fixed = fixed.replace(/\(.*?\)/g, '');
    fixed = fixed.replace(/\[.*?\]/g, '');
    fixed = fixed.replace(/\s*-\s*$/, '');
    fixed = fixed.replace(/\s+/g, ' ').trim();
    
    if (!fixed || fixed.length < 2) {
        fixed = parts[parts.length - 1]?.replace(/\.[^.]+$/, '') || 'Bilinmeyen';
    }
    return fixed;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('folderInput').addEventListener('change', async (e) => {
        const allFiles = Array.from(e.target.files);
        if (!allFiles.length) { showStatus('❌ Klasör boş!'); return; }
        
        showStatus(`📂 ${allFiles.length} dosya taranıyor...`);
        await sleep(50);
        
        const validExts = ['mp3','m4a','wav','flac','ogg','aac','opus','wma'];
        const junkWords = ['ringtone','rington','alarm','notification','notify','ui_sound','system','camera','screenshot','whatsapp audio','whatsapp voice','ptt-','voice note','call recording','callrecord'];
        
        const musicFiles = allFiles.filter(f => {
            const name = f.name.toLowerCase();
            const ext = name.split('.').pop();
            if (!validExts.includes(ext)) return false;
            if (junkWords.some(j => name.includes(j))) return false;
            if (f.size < 10000) return false;
            return true;
        });
        
        if (!musicFiles.length) { showStatus('❌ Müzik bulunamadı!'); return; }
        
        showStatus(`📂 ${musicFiles.length} müzik bulundu, IndexedDBye kaydediliyor...`);
        await sleep(50);
        
        // DOSYALARI İŞLE VE KAYDET
        localFiles = [];
        const chunkSize = 20; // Daha küçük chunk
        
        for (let i = 0; i < musicFiles.length; i += chunkSize) {
            const chunk = musicFiles.slice(i, i + chunkSize);
            for (const f of chunk) {
                localFiles.push({
                    name: cleanFileName(f.name),
                    fullName: f.name,
                    size: f.size,
                    type: f.type,
                    file: f
                });
            }
            showStatus(`💾 ${Math.min(i + chunkSize, musicFiles.length)}/${musicFiles.length} kaydediliyor...`);
            await sleep(50);
        }
        
        // IndexedDB'ye kaydet
        const saved = await saveFilesToDB(localFiles);
        
        let folderName = 'Müzik';
        try {
            const path = musicFiles[0].webkitRelativePath || musicFiles[0].name;
            const parts = path.split('/');
            if (parts.length > 1) folderName = cleanFileName(parts[0]);
        } catch(e) {}
        
        if (saved) {
            document.getElementById('folderInfo').textContent = `${folderName} (${localFiles.length} şarkı) ✅`;
            document.getElementById('folderBtn').style.borderColor = '#00ff00';
            document.getElementById('folderBtn').style.color = '#00ff00';
            showStatus(`✅ ${localFiles.length} şarkı kalıcı olarak kaydedildi!`);
        } else {
            document.getElementById('folderInfo').textContent = `${folderName} (${localFiles.length} şarkı) ⚠️`;
            showStatus('⚠️ Kayıt başarısız, depolama alanı yetersiz olabilir');
        }
        
        e.target.value = '';
    });
});

// ============ SESLİ ARAMA ============

let voiceRecognition = null;

function startVoiceSearch() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Chrome kullanın.'); return; }
    
    if (voiceRecognition) {
        voiceRecognition.stop(); voiceRecognition = null;
        document.getElementById('micBtn').classList.remove('listening');
        showStatus(''); return;
    }
    
    voiceRecognition = new SR();
    voiceRecognition.lang = 'tr-TR';
    document.getElementById('micBtn').classList.add('listening');
    showStatus('🎤 Konuşun...');
    voiceRecognition.start();
    
    voiceRecognition.onresult = (e) => {
        const text = e.results[0][0].transcript.trim();
        document.getElementById('searchInput').value = text;
        const lower = text.toLowerCase();
        if (lower.includes('youtube')) { document.getElementById('searchInput').value = text.replace(/youtube/gi, '').trim(); searchYouTube(); }
        else if (lower.includes('telefon') || lower.includes('dosya')) { document.getElementById('searchInput').value = text.replace(/telefon|dosya/gi, '').trim(); searchLocal(); }
        else if (lower.includes('dur')) pauseTrack();
        else if (lower.includes('devam')) resumeTrack();
        else if (lower.includes('sonraki') || lower.includes('atla')) nextTrack();
        else if (lower.includes('önceki') || lower.includes('geri')) prevTrack();
        else searchYouTube();
    };
    
    voiceRecognition.onerror = (e) => { showStatus('❌ ' + e.error); };
    voiceRecognition.onend = () => { document.getElementById('micBtn').classList.remove('listening'); voiceRecognition = null; };
}

// ============ ARAMA ============

async function searchYouTube() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    searchMode = 'youtube';
    searchResults = [];
    searchResultIndex = -1;
    
    showResults('🔍 YouTube: ' + query);
    document.getElementById('resultsList').innerHTML = '<div class="loading-state"><div class="spinner"></div>Aranıyor...</div>';
    
    try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        
        searchResults = data.results.map(item => ({
            type: 'youtube',
            videoId: item.videoId,
            title: cleanFileName(item.title),
            artist: item.channelTitle,
            thumbnail: item.thumbnailUrl
        }));
        
        document.getElementById('resultCount').textContent = searchResults.length;
        displayResults();
    } catch(e) {
        document.getElementById('resultsList').innerHTML = '<div class="empty-state">❌ ' + e.message + '</div>';
    }
}

function searchLocal() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    
    searchMode = 'local';
    searchResults = [];
    searchResultIndex = -1;
    
    showResults('📱 Telefon' + (query ? ': ' + query : ''));
    
    if (localFiles.length === 0) {
        document.getElementById('resultsList').innerHTML = `
            <div class="empty-state">
                📂 Henüz klasör seçilmedi<br>
                <button onclick="pickFolder()" style="margin-top:8px;background:#0066ff;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px;width:100%">📂 Klasör Seç</button>
            </div>`;
        return;
    }
    
    // Filtrele ve göster
    searchResults = localFiles
        .filter(f => !query || f.name.toLowerCase().includes(query))
        .map(f => ({ type: 'local', name: f.name, file: f }));
    
    document.getElementById('resultCount').textContent = searchResults.length;
    displayLocalResults();
}

// ============ SONUÇ GÖSTERİMİ ============

function showResults(title) {
    document.getElementById('resultsTitle').innerHTML = title + ' (<span id="resultCount">0</span>)';
    document.getElementById('resultsBox').style.display = 'block';
}

function displayResults() {
    const list = document.getElementById('resultsList');
    if (!searchResults.length) { list.innerHTML = '<div class="empty-state">😔 Sonuç bulunamadı</div>'; return; }
    
    list.innerHTML = searchResults.map((item, i) => `
        <div class="result-item youtube" onclick="playResult(${i})">
            <img src="${item.thumbnail}" onerror="this.style.display='none'" loading="lazy">
            <div class="result-info">
                <strong>${esc(item.title)} <span class="badge badge-yt">YT</span></strong>
                <small>${esc(item.artist)}</small>
            </div>
        </div>
    `).join('');
    
    if (searchResults.length > 0) setTimeout(() => playResult(0), 400);
}

function displayLocalResults() {
    const list = document.getElementById('resultsList');
    if (!searchResults.length) { list.innerHTML = '<div class="empty-state">😔 Dosya bulunamadı</div>'; return; }
    
    list.innerHTML = searchResults.map((item, i) => `
        <div class="result-item local" onclick="playResult(${i})">
            <div class="result-icon">🎵</div>
            <div class="result-info">
                <strong>${esc(item.name)} <span class="badge badge-local">📱</span></strong>
                <small>Telefon</small>
            </div>
        </div>
    `).join('');
    
    if (searchResults.length > 0) setTimeout(() => playResult(0), 400);
}

function playResult(index) {
    if (index < 0 || index >= searchResults.length) return;
    
    searchResultIndex = index;
    document.querySelectorAll('.result-item').forEach((el, i) => el.classList.toggle('playing', i === index));
    
    const item = searchResults[index];
    if (item.type === 'youtube') {
        addAndPlay({ id: item.videoId, title: item.title, artist: item.artist, thumbnail: item.thumbnail, source: 'youtube' });
    } else {
        // File objesini kontrol et
        if (!item.file || !item.file.file) {
            showStatus('❌ Dosya bulunamadı! IndexedDBden yüklenemedi.');
            return;
        }
        addAndPlay({ id: 'local_' + item.name, title: item.name, artist: 'Telefon', thumbnail: '', source: 'local', file: item.file });
    }
}

function closeResults() { document.getElementById('resultsBox').style.display = 'none'; }

// ============ LİNK ============

async function pasteAndPlay() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('searchInput').value = text;
        const videoId = extractId(text);
        if (videoId) {
            searchMode = null;
            addAndPlay({ id: videoId, title: 'Yükleniyor...', artist: 'YouTube', thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, source: 'youtube' });
            document.getElementById('searchInput').value = '';
        }
    } catch(e) {}
}

function extractId(input) {
    if (!input) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    const m = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

// ============ OYNATMA ============

function addAndPlay(track) {
    const existing = playlist.findIndex(t => t.id === track.id);
    if (existing >= 0) currentIndex = existing;
    else { playlist.push(track); savePlaylist(); currentIndex = playlist.length - 1; }
    updateUI();
    playTrack(track);
}

function playTrack(track) {
    stopAll();
    
    const idx = playlist.findIndex(t => t.id === track.id);
    if (idx >= 0) currentIndex = idx;
    
    document.getElementById('player').style.display = 'block';
    document.getElementById('title').textContent = track.title;
    document.getElementById('artist').textContent = track.artist;
    document.getElementById('thumbnail').src = track.thumbnail || '';
    document.getElementById('playBtn').textContent = '⏸️';
    document.getElementById('seekSlider').value = 0;
    document.getElementById('seekTime').textContent = '00:00 / 00:00';
    isPlaying = true;
    currentSource = track.source;
    
    if (track.source === 'youtube') playYouTube(track);
    else if (track.source === 'local') playLocal(track);
    
    updateUI();
    saveSession(track);
    document.getElementById('player').scrollIntoView({ behavior: 'smooth' });
}

function playYouTube(track) {
    document.getElementById('playerFrame').innerHTML = '<div id="ytplayer"></div>';
    
    setTimeout(() => {
        try {
            ytPlayer = new YT.Player('ytplayer', {
                height: '1', width: '1', videoId: track.id,
                playerVars: { autoplay: 1, controls: 0, playsinline: 1, origin: window.location.origin },
                events: {
                    onReady: (e) => {
                        e.target.setVolume(localStorage.getItem('vol_v17') || 70);
                        e.target.unMute(); e.target.playVideo();
                        startSeekUpdate();
                    },
                    onStateChange: (e) => {
                        if (e.data === 0) { stopSeekUpdate(); nextTrack(); }
                        else if (e.data === 1) { isPlaying = true; document.getElementById('playBtn').textContent = '⏸️'; }
                        else if (e.data === 2) { isPlaying = false; document.getElementById('playBtn').textContent = '▶️'; }
                    },
                    onError: () => { stopSeekUpdate(); setTimeout(() => nextTrack(), 1000); }
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
    if (!track.file || !track.file.file) {
        showStatus('❌ Dosya bulunamadı! IndexedDBde yok.');
        stopAll(); document.getElementById('player').style.display = 'none'; return;
    }
    
    try {
        const url = URL.createObjectURL(track.file.file);
        localAudio.src = url;
        localAudio.volume = (localStorage.getItem('vol_v17') || 70) / 100;
        localAudio.onloadedmetadata = () => { localAudio.play(); startSeekUpdate(); };
        localAudio.onended = () => { stopSeekUpdate(); nextTrack(); };
        localAudio.onerror = () => { stopSeekUpdate(); setTimeout(() => nextTrack(), 1000); };
        localAudio.play().catch(() => {});
    } catch(e) {}
}

function stopAll() {
    stopSeekUpdate();
    if (ytPlayer) { try { ytPlayer.stopVideo(); ytPlayer.destroy(); } catch(e) {} ytPlayer = null; }
    try { localAudio.pause(); localAudio.src = ''; } catch(e) {}
    isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️';
    document.getElementById('seekSlider').value = 0;
    document.getElementById('seekTime').textContent = '00:00 / 00:00';
}

function togglePlay() {
    if (!isPlaying && !ytPlayer && !localAudio.src) {
        if (currentIndex >= 0 && playlist[currentIndex]) playTrack(playlist[currentIndex]);
        return;
    }
    if (currentSource === 'youtube' && ytPlayer) {
        try { if (isPlaying) ytPlayer.pauseVideo(); else { ytPlayer.unMute(); ytPlayer.playVideo(); } } catch(e) {}
    } else if (currentSource === 'local' && localAudio.src) {
        if (isPlaying) localAudio.pause(); else localAudio.play();
        isPlaying = !isPlaying;
        document.getElementById('playBtn').textContent = isPlaying ? '⏸️' : '▶️';
    }
}

// ============ SEEK BAR ============

function startSeekUpdate() {
    stopSeekUpdate();
    seekInterval = setInterval(() => {
        let c = 0, d = 0;
        if (currentSource === 'youtube' && ytPlayer && ytPlayer.getCurrentTime) {
            c = ytPlayer.getCurrentTime() || 0; d = ytPlayer.getDuration() || 0;
        } else if (currentSource === 'local' && localAudio.duration) {
            c = localAudio.currentTime; d = localAudio.duration;
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

function formatTime(sec) {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m.toString().padStart(2,'0') + ':' + s.toString().padStart(2,'0');
}

// ============ GEZİNME ============

function nextTrack() {
    if (searchResults.length > 0 && searchResultIndex < searchResults.length - 1) {
        playResult(searchResultIndex + 1); return;
    }
    if (currentIndex < playlist.length - 1) {
        currentIndex++; playTrack(playlist[currentIndex]); return;
    }
    stopAll(); document.getElementById('player').style.display = 'none';
    showStatus('📋 Liste sonu');
}

function prevTrack() {
    if (searchResults.length > 0 && searchResultIndex > 0) {
        playResult(searchResultIndex - 1); return;
    }
    if (currentIndex > 0) {
        currentIndex--; playTrack(playlist[currentIndex]); return;
    }
    if (currentSource === 'youtube' && ytPlayer) { ytPlayer.seekTo(0); ytPlayer.playVideo(); }
    else if (currentSource === 'local') { localAudio.currentTime = 0; localAudio.play(); }
    showStatus('🔄 Başa sarıldı');
}

function pauseTrack() {
    if (currentSource === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
    else if (currentSource === 'local') localAudio.pause();
    isPlaying = false; document.getElementById('playBtn').textContent = '▶️';
}

function resumeTrack() {
    if (currentSource === 'youtube' && ytPlayer) { ytPlayer.unMute(); ytPlayer.playVideo(); }
    else if (currentSource === 'local' && localAudio.src) localAudio.play();
    isPlaying = true; document.getElementById('playBtn').textContent = '⏸️';
}

function setVolume(val) {
    if (ytPlayer) ytPlayer.setVolume(val);
    localAudio.volume = val / 100;
    localStorage.setItem('vol_v17', val);
}

// ============ PLAYLIST ============

function clearPlaylist() {
    if (!playlist.length) return;
    if (confirm('Listeyi temizle?')) {
        stopAll(); playlist = []; currentIndex = -1;
        searchResults = []; searchResultIndex = -1; searchMode = null;
        document.getElementById('player').style.display = 'none';
        savePlaylist(); updateUI();
    }
}

function updateUI() {
    const pl = document.getElementById('playlist');
    document.getElementById('count').textContent = playlist.length;
    if (!playlist.length) {
        pl.innerHTML = '<div class="empty-state">🎵 Liste boş</div>';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
        return;
    }
    pl.innerHTML = playlist.map((t, i) => `
        <div class="playlist-item${i === currentIndex ? ' active' : ''}" onclick="clickTrack(${i})">
            ${t.thumbnail ? `<img src="${t.thumbnail}" onerror="this.style.display='none'">` : '<div class="result-icon icon">🎵</div>'}
            <div class="info"><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></div>
            <button class="btn-remove" onclick="event.stopPropagation();removeTrack(${i})">✕</button>
        </div>
    `).join('');
    document.getElementById('prevBtn').disabled = (currentIndex <= 0 && searchResultIndex <= 0);
    document.getElementById('nextBtn').disabled = (currentIndex >= playlist.length - 1 && searchResultIndex >= searchResults.length - 1);
}

function clickTrack(i) { searchResults = []; searchResultIndex = -1; searchMode = null; currentIndex = i; playTrack(playlist[i]); }

function removeTrack(i) {
    event.stopPropagation();
    if (currentIndex === i) { stopAll(); document.getElementById('player').style.display = 'none'; currentIndex = -1; }
    else if (currentIndex > i) currentIndex--;
    playlist.splice(i, 1); savePlaylist(); updateUI();
}

// ============ YARDIMCILAR ============

function esc(t) { if(!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function savePlaylist() { try { localStorage.setItem('playlist_v17', JSON.stringify(playlist)); } catch(e) {} }
function saveSession(t) { try { localStorage.setItem('session_v17', JSON.stringify({id:t.id, index:currentIndex})); } catch(e) {} }

function restoreSession() {
    try {
        const s = localStorage.getItem('session_v17');
        if (s && playlist.length) {
            const d = JSON.parse(s), t = playlist.find(x => x.id === d.id);
            if (t) {
                currentIndex = d.index;
                document.getElementById('player').style.display = 'block';
                document.getElementById('title').textContent = t.title;
                document.getElementById('artist').textContent = t.artist;
                if(t.thumbnail) document.getElementById('thumbnail').src = t.thumbnail;
            }
        }
    } catch(e) {}
}

function showStatus(msg) { document.getElementById('statusBar').textContent = msg; }

// Enter
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const v = document.getElementById('searchInput').value.trim();
            if (v.includes('youtube.com') || v.includes('youtu.be')) pasteAndPlay();
            else searchYouTube();
        }
    });
});

document.getElementById('volSlider').value = localStorage.getItem('vol_v17') || 70;
updateUI();
console.log('🎵 Welly Player v17.1');

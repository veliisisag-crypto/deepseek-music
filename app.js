// YT MUSIC v15.0 - IndexedDB Klasör Saklama + Telefon İsim Düzeltme
console.log('🎵 YT Music v15.0');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let localAudio = document.getElementById('localAudio');
let isPlaying = false;
let currentSource = null;
let searchResults = [];
let localFiles = [];

// ============ INDEXEDDB ============

const DB_NAME = 'ytmusic_db';
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

async function saveFilesToDB(files) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Önce temizle
        store.clear();
        
        // Dosyaları kaydet (File objesi hariç)
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            store.put({
                id: i,
                name: f.name,
                fullName: f.fullName,
                size: f.size,
                type: f.type,
                lastModified: f.file?.lastModified || Date.now()
            });
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) {
        console.log('IndexedDB kayıt hatası:', e);
        return false;
    }
}

async function loadFilesFromDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const data = request.result;
                // name ve fullName ile localFiles oluştur (File objesi yok)
                const files = data.map(item => ({
                    name: item.name,
                    fullName: item.fullName,
                    size: item.size,
                    type: item.type,
                    file: null // IndexedDB'den gelince File objesi olmaz
                }));
                resolve(files);
            };
            request.onerror = () => reject(request.error);
        });
    } catch(e) {
        console.log('IndexedDB okuma hatası:', e);
        return [];
    }
}

// ============ YÜKLE ============

try { playlist = JSON.parse(localStorage.getItem('playlist_v15') || '[]'); } catch(e) { playlist = []; }

// IndexedDB'den önceki dosyaları yükle
loadFilesFromDB().then(files => {
    if (files.length > 0) {
        localFiles = files;
        document.getElementById('folderInfo').textContent = `Kayıtlı (${files.length} şarkı)`;
        document.getElementById('folderBtn').style.borderColor = '#00ff00';
        document.getElementById('folderBtn').style.color = '#00ff00';
        console.log('✅ IndexedDB\'den ' + files.length + ' dosya yüklendi');
    }
});

function onYouTubeIframeAPIReady() {
    console.log('✅ API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ KLASÖR SEÇME (TELEFON DÜZELTMESİ) ============

function pickFolder() {
    document.getElementById('folderInput').click();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanFileName(name) {
    let fixed = name;
    
    // URL decode
    try {
        fixed = decodeURIComponent(name);
    } catch(e) {}
    
    // Manuel Türkçe karakter
    const charMap = {
        '%C4%B1': 'ı', '%C4%B0': 'İ', '%C3%BC': 'ü', '%C3%9C': 'Ü',
        '%C3%B6': 'ö', '%C3%96': 'Ö', '%C3%A7': 'ç', '%C3%87': 'Ç',
        '%C5%9F': 'ş', '%C5%9E': 'Ş', '%C4%9F': 'ğ', '%C4%9E': 'Ğ',
        '%20': ' ', '%2F': '/', '%3A': ':', '%2C': ',',
        '%27': "'", '%26': '&', '%23': '#', '%21': '!',
        '%28': '(', '%29': ')', '%5B': '[', '%5D': ']',
        '%2B': '+', '%3D': '=', '%3B': ';', '%40': '@',
        '%24': '$', '%25': '%', '%5E': '^', '%60': '`'
    };
    
    for (const [code, char] of Object.entries(charMap)) {
        fixed = fixed.split(code).join(char);
    }
    
    // SADECE dosya adı (son bölüm)
    const parts = fixed.split('/');
    fixed = parts[parts.length - 1];
    
    // Uzantıyı kaldır
    fixed = fixed.replace(/\.[^.]+$/, '');
    
    // Baştaki numaraları temizle
    fixed = fixed.replace(/^\d+[\.\-\s\)]\s*/, '');
    fixed = fixed.replace(/^\d+\s*-\s*/, '');
    
    // Gereksiz etiketler
    fixed = fixed
        .replace(/\(Official.*?\)/gi, '')
        .replace(/\[Official.*?\]/gi, '')
        .replace(/\(Lyric.*?\)/gi, '')
        .replace(/\(Audio.*?\)/gi, '')
        .replace(/\(Video.*?\)/gi, '')
        .replace(/\(HD.*?\)/gi, '')
        .replace(/\(HQ.*?\)/gi, '')
        .replace(/\(1080p.*?\)/gi, '')
        .replace(/\(720p.*?\)/gi, '');
    
    // Fazla boşluk
    fixed = fixed.replace(/\s+/g, ' ').trim();
    
    // Hala % işareti varsa
    if (fixed.includes('%') && parts.length > 1) {
        fixed = parts[parts.length - 1].replace(/\.[^.]+$/, '');
    }
    
    return fixed || 'Bilinmeyen';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('folderInput').addEventListener('change', async (e) => {
        const allFiles = Array.from(e.target.files);
        
        if (allFiles.length === 0) {
            showStatus('❌ Klasör boş!');
            return;
        }
        
        const totalCount = allFiles.length;
        showStatus(`📂 ${totalCount} dosya taranıyor...`);
        await sleep(50);
        
        // Müzik dosyalarını filtrele
        const musicFiles = allFiles.filter(f => {
            const name = f.name.toLowerCase();
            const ext = name.split('.').pop();
            const validExts = ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'aac', 'opus', 'wma'];
            
            if (!validExts.includes(ext)) return false;
            
            const junkPatterns = [
                'ringtone', 'rington', 'alarm', 'notification', 'notify',
                'ui_sound', 'system', 'camera', 'screenshot',
                'whatsapp audio', 'whatsapp voice', 'ptt-', 'voice note',
                'call recording', 'callrecord'
            ];
            
            for (const pattern of junkPatterns) {
                if (name.includes(pattern)) return false;
            }
            
            if (f.size < 10000) return false;
            return true;
        });
        
        showStatus(`📂 ${musicFiles.length} müzik (${totalCount - musicFiles.length} elendi)`);
        await sleep(50);
        
        if (musicFiles.length === 0) {
            showStatus('❌ Müzik dosyası bulunamadı!');
            return;
        }
        
        // Parça parça işle
        localFiles = [];
        const chunkSize = 50;
        
        for (let i = 0; i < musicFiles.length; i += chunkSize) {
            const chunk = musicFiles.slice(i, i + chunkSize);
            
            for (const f of chunk) {
                const cleanName = cleanFileName(f.name);
                localFiles.push({
                    name: cleanName,
                    fullName: f.name,
                    size: f.size,
                    type: f.type,
                    file: f
                });
            }
            
            const progress = Math.min(i + chunkSize, musicFiles.length);
            showStatus(`📂 ${progress}/${musicFiles.length}`);
            await sleep(30);
        }
        
        // IndexedDB'ye kaydet (kalıcı)
        const saved = await saveFilesToDB(localFiles);
        
        // Klasör adı
        let folderName = 'Müzik';
        try {
            const path = musicFiles[0].webkitRelativePath || musicFiles[0].name;
            const parts = path.split('/');
            if (parts.length > 1) folderName = cleanFileName(parts[0]);
        } catch(e) {}
        
        document.getElementById('folderInfo').textContent = 
            `${folderName} (${localFiles.length} şarkı)${saved ? ' ✅' : ''}`;
        document.getElementById('folderBtn').style.borderColor = '#00ff00';
        document.getElementById('folderBtn').style.color = '#00ff00';
        
        showStatus(`✅ ${localFiles.length} şarkı kaydedildi!`);
        
        // Bellek temizliği
        e.target.value = '';
    });
});

// ============ SESLİ ARAMA ============

let voiceRecognition = null;

function startVoiceSearch() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Chrome kullanın.'); return; }
    
    if (voiceRecognition) {
        voiceRecognition.stop();
        voiceRecognition = null;
        document.getElementById('micBtn').classList.remove('listening');
        showStatus('');
        return;
    }
    
    voiceRecognition = new SR();
    voiceRecognition.lang = 'tr-TR';
    
    document.getElementById('micBtn').classList.add('listening');
    document.getElementById('searchInput').placeholder = '🎤 Dinliyorum...';
    showStatus('🎤 Konuşun...');
    
    voiceRecognition.start();
    
    voiceRecognition.onresult = (e) => {
        const text = e.results[0][0].transcript.trim();
        document.getElementById('searchInput').value = text;
        showStatus('✅ "' + text + '"');
        
        const lower = text.toLowerCase();
        if (lower.includes('youtube')) { 
            document.getElementById('searchInput').value = text.replace(/youtube/gi, '').trim(); 
            searchYouTube(); 
        } else if (lower.includes('telefon') || lower.includes('dosya')) { 
            document.getElementById('searchInput').value = text.replace(/telefon|dosya/gi, '').trim(); 
            searchLocal(); 
        } else if (lower.includes('dur')) pauseTrack();
        else if (lower.includes('devam') || lower.includes('başlat')) resumeTrack();
        else if (lower.includes('sonraki') || lower.includes('atla')) nextTrack();
        else if (lower.includes('önceki') || lower.includes('geri')) prevTrack();
        else searchYouTube();
    };
    
    voiceRecognition.onerror = (e) => { showStatus('❌ ' + e.error); };
    voiceRecognition.onend = () => {
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('searchInput').placeholder = 'Şarkı ara...';
        voiceRecognition = null;
    };
}

// ============ YOUTUBE ARAMA ============

async function searchYouTube() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    showResults('🔍 YouTube: ' + query);
    document.getElementById('resultsList').innerHTML = '<div class="loading-state"><div class="spinner"></div>Aranıyor...</div>';
    
    try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        
        searchResults = data.results.map(item => ({
            type: 'youtube',
            videoId: item.videoId,
            title: item.title,
            artist: item.channelTitle,
            thumbnail: item.thumbnailUrl
        }));
        
        document.getElementById('resultCount').textContent = searchResults.length;
        displayResults();
    } catch(e) {
        document.getElementById('resultsList').innerHTML = '<div class="empty-state">❌ ' + e.message + '</div>';
    }
}

// ============ YEREL ARAMA ============

function searchLocal() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    showResults('📱 Telefon' + (query ? ': ' + query : ''));
    
    if (localFiles.length === 0) {
        document.getElementById('resultsList').innerHTML = `
            <div class="empty-state">
                📂 Klasör seçilmedi<br>
                <button onclick="pickFolder()" style="margin-top:8px;background:#0066ff;color:#fff;border:none;padding:8px 16px;border-radius:15px;cursor:pointer;font-size:12px">📂 Klasör Seç</button>
            </div>`;
        return;
    }
    
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
    document.querySelectorAll('.result-item').forEach((el, i) => el.classList.toggle('playing', i === index));
    
    const item = searchResults[index];
    if (item.type === 'youtube') {
        addAndPlay({ id: item.videoId, title: item.title, artist: item.artist, thumbnail: item.thumbnail, source: 'youtube' });
    } else {
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
    document.getElementById('player').style.display = 'block';
    document.getElementById('title').textContent = track.title;
    document.getElementById('artist').textContent = track.artist;
    document.getElementById('thumbnail').src = track.thumbnail || '';
    document.getElementById('playBtn').textContent = '⏸️';
    isPlaying = true;
    currentSource = track.source;
    
    if (track.source === 'youtube') {
        document.getElementById('playerFrame').innerHTML = '<div id="ytplayer"></div>';
        setTimeout(() => {
            ytPlayer = new YT.Player('ytplayer', {
                height: '1', width: '1', videoId: track.id,
                playerVars: { autoplay: 1, controls: 0, playsinline: 1, origin: window.location.origin },
                events: {
                    onReady: (e) => { e.target.setVolume(localStorage.getItem('vol_v15')||70); e.target.unMute(); e.target.playVideo(); },
                    onStateChange: (e) => {
                        if (e.data === 0) nextTrack();
                        else if (e.data === 1) { isPlaying = true; document.getElementById('playBtn').textContent = '⏸️'; }
                        else if (e.data === 2) { isPlaying = false; document.getElementById('playBtn').textContent = '▶️'; }
                    },
                    onError: () => nextTrack()
                }
            });
        }, 100);
        
        fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${track.id}&format=json`)
            .then(r => r.json()).then(d => {
                track.title = d.title.replace(' - YouTube', '').trim();
                track.artist = d.author_name || 'YouTube';
                document.getElementById('title').textContent = track.title;
                document.getElementById('artist').textContent = track.artist;
                savePlaylist(); updateUI();
            }).catch(() => {});
    } else if (track.source === 'local' && track.file?.file) {
        const url = URL.createObjectURL(track.file.file);
        localAudio.src = url;
        localAudio.volume = (localStorage.getItem('vol_v15')||70)/100;
        localAudio.play();
        localAudio.onended = () => nextTrack();
    }
    
    saveSession(track);
    document.getElementById('player').scrollIntoView({ behavior: 'smooth' });
}

function stopAll() {
    if (ytPlayer) { try { ytPlayer.destroy(); } catch(e) {} ytPlayer = null; }
    try { localAudio.pause(); localAudio.src = ''; } catch(e) {}
    isPlaying = false;
}

function togglePlay() {
    if (currentSource === 'youtube' && ytPlayer) {
        try { if (isPlaying) ytPlayer.pauseVideo(); else { ytPlayer.unMute(); ytPlayer.playVideo(); } } catch(e) {}
    } else if (currentSource === 'local' && localAudio.src) {
        if (isPlaying) localAudio.pause(); else localAudio.play();
        isPlaying = !isPlaying;
        document.getElementById('playBtn').textContent = isPlaying ? '⏸️' : '▶️';
    }
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

function nextTrack() {
    if (currentIndex < playlist.length - 1) { currentIndex++; playTrack(playlist[currentIndex]); }
    else { stopAll(); document.getElementById('player').style.display = 'none'; }
}

function prevTrack() {
    if (currentIndex > 0) { currentIndex--; playTrack(playlist[currentIndex]); }
}

function setVolume(val) {
    if (ytPlayer) ytPlayer.setVolume(val);
    localAudio.volume = val/100;
    localStorage.setItem('vol_v15', val);
}

// ============ PLAYLIST ============

function clearPlaylist() {
    if (!playlist.length) return;
    if (confirm('Listeyi temizle?')) { stopAll(); playlist = []; currentIndex = -1; document.getElementById('player').style.display = 'none'; savePlaylist(); updateUI(); }
}

function updateUI() {
    const pl = document.getElementById('playlist');
    document.getElementById('count').textContent = playlist.length;
    if (!playlist.length) { pl.innerHTML = '<div class="empty-state">🎵 Liste boş</div>'; return; }
    
    pl.innerHTML = playlist.map((t, i) => `
        <div class="playlist-item${i === currentIndex ? ' active' : ''}" onclick="clickTrack(${i})">
            ${t.thumbnail ? `<img src="${t.thumbnail}">` : '<div class="result-icon icon">🎵</div>'}
            <div class="info"><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></div>
            <button class="btn-remove" onclick="event.stopPropagation();removeTrack(${i})">✕</button>
        </div>
    `).join('');
    document.getElementById('prevBtn').disabled = currentIndex <= 0;
    document.getElementById('nextBtn').disabled = currentIndex >= playlist.length - 1;
}

function clickTrack(i) { currentIndex = i; playTrack(playlist[i]); }
function removeTrack(i) {
    event.stopPropagation();
    if (currentIndex === i) { stopAll(); document.getElementById('player').style.display = 'none'; currentIndex = -1; }
    else if (currentIndex > i) currentIndex--;
    playlist.splice(i, 1); savePlaylist(); updateUI();
}

// ============ YARDIMCILAR ============

function esc(t) { if(!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function savePlaylist() { try { localStorage.setItem('playlist_v15', JSON.stringify(playlist)); } catch(e) {} }
function saveSession(t) { try { localStorage.setItem('session_v15', JSON.stringify({id:t.id, index:currentIndex})); } catch(e) {} }
function restoreSession() {
    try {
        const s = localStorage.getItem('session_v15');
        if (s && playlist.length) {
            const d = JSON.parse(s), t = playlist.find(x => x.id === d.id);
            if (t) { currentIndex = d.index; document.getElementById('player').style.display = 'block'; document.getElementById('title').textContent = t.title; document.getElementById('artist').textContent = t.artist; if(t.thumbnail) document.getElementById('thumbnail').src = t.thumbnail; }
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

document.getElementById('volSlider').value = localStorage.getItem('vol_v15') || 70;
updateUI();
console.log('✅ v15.0 hazır - IndexedDB + Telefon düzeltmesi');

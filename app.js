// YT MUSIC v8.0 - Dahili Arama
console.log('🎵 YT Music v8.0 - Dahili arama aktif');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let isPlaying = false;
let currentTrack = null;
let searchResults = [];
let currentSearchIndex = -1;

// Invidious API havuzu
const API_POOL = [
    'https://inv.nadeko.net',
    'https://invidious.snopyta.org',
    'https://yewtu.be',
    'https://vid.puffyan.us',
    'https://invidious.namazso.eu',
    'https://inv.riverside.rocks',
    'https://invidious.sethforprivacy.com',
    'https://yt.artemislena.eu'
];

// LocalStorage
try {
    const saved = localStorage.getItem('playlist_v8');
    if (saved) playlist = JSON.parse(saved);
} catch(e) { playlist = []; }

function onYouTubeIframeAPIReady() {
    console.log('✅ YouTube API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ ARAMA ============

async function doSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return alert('Lütfen aramak istediğiniz şarkıyı yazın!');
    
    const resultsDiv = document.getElementById('searchResults');
    const resultsList = document.getElementById('resultsList');
    
    resultsDiv.style.display = 'block';
    resultsList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Aranıyor...</div>';
    
    searchResults = [];
    currentSearchIndex = -1;
    
    // API'leri sırayla dene
    for (const api of API_POOL) {
        try {
            const url = `${api}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`;
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
            
            if (response.ok) {
                const data = await response.json();
                
                // Sadece video sonuçlarını filtrele
                searchResults = data.filter(item => item.type === 'video' && item.videoId);
                
                if (searchResults.length > 0) {
                    console.log(`✅ ${api} - ${searchResults.length} sonuç`);
                    displayResults();
                    return;
                }
            }
        } catch(e) {
            console.log(`❌ ${api} çalışmıyor`);
        }
    }
    
    // Hiçbir API çalışmazsa YouTube'da aç
    resultsList.innerHTML = `
        <div style="text-align:center;padding:20px;color:#888">
            <p>😔 Dahili arama şu anda çalışmıyor</p>
            <button onclick="openYouTubeSearch()" style="margin-top:10px;background:#ff0000;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px">
                🔗 YouTube'da Ara
            </button>
        </div>`;
}

function openYouTubeSearch() {
    const query = document.getElementById('searchInput').value.trim();
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
    document.getElementById('searchResults').style.display = 'none';
}

function displayResults() {
    const resultsList = document.getElementById('resultsList');
    
    resultsList.innerHTML = searchResults.map((item, index) => {
        const duration = formatDuration(item.lengthSeconds);
        const thumbnail = item.videoThumbnails?.[0]?.url || 
                        `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
        
        return `
            <div class="result-item" onclick="playSearchResult(${index})" id="result-${index}">
                <img src="${thumbnail}" class="result-thumb" 
                     onerror="this.style.display='none'"
                     loading="lazy">
                <div class="result-info">
                    <strong>${escapeHtml(item.title)}</strong>
                    <small>${escapeHtml(item.author)} • ${item.viewCount ? formatViews(item.viewCount) : ''}</small>
                </div>
                ${duration ? `<span class="result-duration">${duration}</span>` : ''}
            </div>
        `;
    }).join('');
    
    // İlk sonucu otomatik oynat
    if (searchResults.length > 0) {
        playSearchResult(0);
    }
}

function playSearchResult(index) {
    if (index < 0 || index >= searchResults.length) return;
    
    currentSearchIndex = index;
    const item = searchResults[index];
    
    // UI güncelle - hangi sonuç çalıyor
    document.querySelectorAll('.result-item').forEach((el, i) => {
        el.classList.toggle('playing', i === index);
    });
    
    // Sonucu kaydır
    const resultEl = document.getElementById(`result-${index}`);
    if (resultEl) {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Track oluştur ve oynat
    const track = {
        id: item.videoId,
        title: item.title,
        artist: item.author,
        thumbnail: item.videoThumbnails?.[1]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
        duration: item.lengthSeconds
    };
    
    // Playlist'e ekle (yoksa)
    const existing = playlist.findIndex(t => t.id === track.id);
    if (existing >= 0) {
        currentIndex = existing;
    } else {
        playlist.push(track);
        savePlaylist();
        currentIndex = playlist.length - 1;
    }
    
    updateUI();
    playTrack(track);
}

function prevSearchResult() {
    if (currentSearchIndex > 0) {
        playSearchResult(currentSearchIndex - 1);
    }
}

function nextSearchResult() {
    if (currentSearchIndex < searchResults.length - 1) {
        playSearchResult(currentSearchIndex + 1);
    }
}

function closeSearch() {
    document.getElementById('searchResults').style.display = 'none';
    searchResults = [];
    currentSearchIndex = -1;
}

// ============ DİĞER FONKSİYONLAR ============

function playDirectUrl() {
    const url = document.getElementById('searchInput').value.trim();
    if (!url) return alert('Link yapıştırın!');
    
    const videoId = extractId(url);
    if (videoId) {
        addTrackById(videoId);
        document.getElementById('searchInput').value = '';
    } else {
        // Arama yap
        doSearch();
    }
}

async function pasteAndPlay() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('searchInput').value = text;
        
        const videoId = extractId(text);
        if (videoId) {
            addTrackById(videoId);
            document.getElementById('searchInput').value = '';
        } else {
            alert('Panoda YouTube linki yok. Arama yapmayı deneyin.');
        }
    } catch(e) {
        alert('Panodan yapıştırılamadı.');
        document.getElementById('searchInput').focus();
    }
}

function extractId(input) {
    if (!input) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const m = input.match(p);
        if (m) return m[1];
    }
    return null;
}

async function addTrackById(videoId) {
    const existing = playlist.findIndex(t => t.id === videoId);
    if (existing >= 0) {
        currentIndex = existing;
        playTrack(playlist[existing]);
        return;
    }
    
    // Hızlı bilgi almayı dene
    let title = 'YouTube Videosu';
    let artist = 'YouTube';
    let thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    
    try {
        const api = API_POOL[0];
        const response = await fetch(`${api}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
            const data = await response.json();
            title = data.title;
            artist = data.author;
            thumbnail = data.videoThumbnails?.[0]?.url || thumbnail;
        }
    } catch(e) {}
    
    const track = { id: videoId, title, artist, thumbnail, addedAt: Date.now() };
    playlist.push(track);
    savePlaylist();
    currentIndex = playlist.length - 1;
    updateUI();
    playTrack(track);
}

function playTrack(track) {
    currentTrack = track;
    document.getElementById('player').style.display = 'block';
    document.getElementById('thumbnail').src = track.thumbnail;
    document.getElementById('title').textContent = track.title;
    document.getElementById('artist').textContent = track.artist;
    
    destroyPlayer();
    document.getElementById('playerFrame').innerHTML = '<div id="ytplayer"></div>';
    
    setTimeout(() => {
        try {
            ytPlayer = new YT.Player('ytplayer', {
                height: '1', width: '1',
                videoId: track.id,
                playerVars: {
                    autoplay: 1, controls: 0, disablekb: 1,
                    fs: 0, modestbranding: 1, playsinline: 1,
                    rel: 0, origin: window.location.origin
                },
                events: {
                    onReady: (e) => {
                        e.target.setVolume(localStorage.getItem('volume_v8') || 70);
                        e.target.unMute();
                        e.target.playVideo();
                    },
                    onStateChange: (e) => {
                        if (e.data === 0) nextTrack();
                        else if (e.data === 1) { isPlaying = true; document.getElementById('playBtn').textContent = '⏸️'; }
                        else if (e.data === 2) { isPlaying = false; document.getElementById('playBtn').textContent = '▶️'; }
                    },
                    onError: () => { alert('Bu video çalınamadı.'); nextTrack(); }
                }
            });
        } catch(e) { console.error('Player hatası:', e); }
    }, 100);
    
    updateUI();
    saveSession(track);
}

function destroyPlayer() {
    if (ytPlayer) {
        try { ytPlayer.stopVideo(); ytPlayer.destroy(); } catch(e) {}
        ytPlayer = null;
    }
    isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️';
}

function togglePlay() {
    if (!ytPlayer) {
        if (currentIndex >= 0 && playlist[currentIndex]) playTrack(playlist[currentIndex]);
        return;
    }
    try {
        const state = ytPlayer.getPlayerState();
        if (state === 1) ytPlayer.pauseVideo();
        else { ytPlayer.unMute(); ytPlayer.playVideo(); }
    } catch(e) { if (currentTrack) playTrack(currentTrack); }
}

function nextTrack() {
    if (searchResults.length > 0 && currentSearchIndex < searchResults.length - 1) {
        // Arama sonuçlarında ilerle
        playSearchResult(currentSearchIndex + 1);
    } else if (currentIndex < playlist.length - 1) {
        currentIndex++;
        playTrack(playlist[currentIndex]);
    } else {
        destroyPlayer();
        document.getElementById('player').style.display = 'none';
    }
}

function prevTrack() {
    if (searchResults.length > 0 && currentSearchIndex > 0) {
        playSearchResult(currentSearchIndex - 1);
    } else if (currentIndex > 0) {
        currentIndex--;
        playTrack(playlist[currentIndex]);
    }
}

function setVolume(val) {
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(val);
    localStorage.setItem('volume_v8', val);
}

function clearPlaylist() {
    if (playlist.length === 0) return;
    if (confirm('Listeyi temizle?')) {
        destroyPlayer();
        playlist = [];
        currentIndex = -1;
        currentTrack = null;
        document.getElementById('player').style.display = 'none';
        savePlaylist();
        updateUI();
    }
}

function updateUI() {
    const pl = document.getElementById('playlist');
    document.getElementById('count').textContent = playlist.length;
    
    if (playlist.length === 0) {
        pl.innerHTML = '<p style="text-align:center;color:#555;padding:30px;font-size:14px">🎵 Liste boş</p>';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
        return;
    }
    
    pl.innerHTML = playlist.map((t, i) => `
        <div class="playlist-item${i === currentIndex ? ' active' : ''}" onclick="clickTrack(${i})">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
                <img src="${t.thumbnail}" width="40" height="40" style="border-radius:6px" onerror="this.style.display='none'">
                <div style="min-width:0">
                    <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">${t.title}</strong>
                    <small style="color:#888;font-size:11px">${t.artist}</small>
                </div>
            </div>
            <button class="remove-btn" onclick="event.stopPropagation();removeTrack(${i})">✕</button>
        </div>
    `).join('');
    
    document.getElementById('prevBtn').disabled = currentIndex <= 0 && currentSearchIndex <= 0;
    document.getElementById('nextBtn').disabled = currentIndex >= playlist.length - 1 && currentSearchIndex >= searchResults.length - 1;
}

function clickTrack(index) { 
    currentIndex = index; 
    searchResults = []; 
    currentSearchIndex = -1;
    playTrack(playlist[index]); 
}

function removeTrack(index) {
    event.stopPropagation();
    if (currentIndex === index) {
        destroyPlayer();
        document.getElementById('player').style.display = 'none';
        currentIndex = -1;
        currentTrack = null;
    } else if (currentIndex > index) currentIndex--;
    playlist.splice(index, 1);
    savePlaylist();
    updateUI();
}

// ============ SESLİ ARAMA ============

let recognition = null;

function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('Tarayıcınız sesli aramayı desteklemiyor. Chrome kullanın.');
        return;
    }
    
    if (recognition) {
        recognition.stop();
        recognition = null;
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('voiceStatus').textContent = '';
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    const micBtn = document.getElementById('micBtn');
    micBtn.classList.add('listening');
    document.getElementById('voiceStatus').textContent = '🎤 Dinliyorum...';
    
    recognition.start();
    
    recognition.onresult = (event) => {
        const voiceText = event.results[0][0].transcript;
        document.getElementById('searchInput').value = voiceText;
        document.getElementById('voiceStatus').textContent = '✅ "' + voiceText + '"';
        doSearch();
    };
    
    recognition.onerror = (event) => {
        document.getElementById('voiceStatus').textContent = '❌ Hata: ' + event.error;
    };
    
    recognition.onend = () => {
        micBtn.classList.remove('listening');
        recognition = null;
        setTimeout(() => { document.getElementById('voiceStatus').textContent = ''; }, 2000);
    };
}

// ============ YARDIMCILAR ============

function formatDuration(seconds) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2,'0')}`;
}

function formatViews(views) {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(0) + 'B';
    return views.toString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function savePlaylist() {
    try { localStorage.setItem('playlist_v8', JSON.stringify(playlist)); } catch(e) {}
}

function saveSession(track) {
    try { localStorage.setItem('session_v8', JSON.stringify({id: track.id, index: currentIndex})); } catch(e) {}
}

function restoreSession() {
    try {
        const saved = localStorage.getItem('session_v8');
        if (saved && playlist.length > 0) {
            const data = JSON.parse(saved);
            const track = playlist.find(t => t.id === data.id);
            if (track) {
                currentIndex = data.index;
                currentTrack = track;
                document.getElementById('player').style.display = 'block';
                document.getElementById('thumbnail').src = track.thumbnail;
                document.getElementById('title').textContent = track.title;
                document.getElementById('artist').textContent = track.artist;
            }
        }
    } catch(e) {}
}

// Başlangıç
document.getElementById('volSlider').value = localStorage.getItem('volume_v8') || 70;
updateUI();
console.log('✅ v8.0 hazır');

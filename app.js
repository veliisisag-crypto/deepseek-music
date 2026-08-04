// YT MUSIC v8.1 - YouTube Direct Scraping
console.log('🎵 YT Music v8.1 - YouTube scraping aktif');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let isPlaying = false;
let currentTrack = null;
let searchResults = [];
let currentSearchIndex = -1;

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

// ============ ARAMA (YOUTUBE SAYFASINDAN) ============

async function doSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return alert('Lütfen aramak istediğiniz şarkıyı yazın!');
    
    const resultsDiv = document.getElementById('searchResults');
    const resultsList = document.getElementById('resultsList');
    
    resultsDiv.style.display = 'block';
    resultsList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Aranıyor...</div>';
    
    searchResults = [];
    currentSearchIndex = -1;
    
    try {
        // YouTube arama sayfasını fetch et
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`;
        const response = await fetch(searchUrl);
        
        if (!response.ok) throw new Error('YouTube erişilemedi');
        
        const html = await response.text();
        
        // YouTube'un initial data JSON'unu bul
        const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
        
        if (!match || !match[1]) {
            throw new Error('Veri parse edilemedi');
        }
        
        const data = JSON.parse(match[1]);
        
        // Video sonuçlarını çıkar
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents
            ?.sectionListRenderer?.contents;
        
        if (!contents) throw new Error('Sonuç bulunamadı');
        
        const items = [];
        
        for (const section of contents) {
            const itemSection = section.itemSectionRenderer?.contents;
            if (!itemSection) continue;
            
            for (const item of itemSection) {
                const videoRenderer = item.videoRenderer;
                if (!videoRenderer) continue;
                
                const videoId = videoRenderer.videoId;
                const title = videoRenderer.title?.runs?.[0]?.text || 'Bilinmeyen';
                const author = videoRenderer.ownerText?.runs?.[0]?.text || 'YouTube';
                const lengthText = videoRenderer.lengthText?.simpleText || '';
                const viewCountText = videoRenderer.viewCountText?.simpleText || '';
                
                // Thumbnail
                const thumbnails = videoRenderer.thumbnail?.thumbnails;
                const thumbnail = thumbnails?.[thumbnails.length - 1]?.url || 
                                 `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                
                // Süreyi saniyeye çevir
                const lengthSeconds = parseDuration(lengthText);
                
                items.push({
                    videoId,
                    title,
                    author,
                    thumbnail,
                    lengthSeconds,
                    lengthText,
                    viewCountText
                });
            }
        }
        
        searchResults = items;
        
        if (searchResults.length === 0) {
            resultsList.innerHTML = `
                <div style="text-align:center;padding:20px;color:#888">
                    <p>😔 Sonuç bulunamadı</p>
                    <button onclick="openYouTubeSearch()" style="margin-top:10px;background:#ff0000;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px">
                        🔗 YouTube'da Ara
                    </button>
                </div>`;
            return;
        }
        
        console.log(`✅ ${searchResults.length} sonuç bulundu`);
        displayResults();
        
    } catch (error) {
        console.error('Arama hatası:', error);
        
        // Fallback: YouTube'da aç
        resultsList.innerHTML = `
            <div style="text-align:center;padding:20px;color:#888">
                <p>😔 Dahili arama çalışmıyor</p>
                <p style="font-size:12px;margin:5px 0">${error.message}</p>
                <button onclick="openYouTubeSearch()" style="margin-top:10px;background:#ff0000;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px">
                    🔗 YouTube'da Ara
                </button>
                <button onclick="tryAlternativeSearch()" style="margin-top:10px;background:#333;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px;display:block;width:100%">
                    🔄 Alternatif Yöntemle Dene
                </button>
            </div>`;
    }
}

async function tryAlternativeSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const resultsList = document.getElementById('resultsList');
    
    resultsList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div>Alternatif yöntem deneniyor...</div>';
    
    // Invidious API'leri dene
    const apis = [
        'https://inv.nadeko.net',
        'https://invidious.snopyta.org', 
        'https://yewtu.be',
        'https://vid.puffyan.us'
    ];
    
    for (const api of apis) {
        try {
            const url = `${api}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
            
            if (response.ok) {
                const data = await response.json();
                searchResults = data
                    .filter(item => item.videoId)
                    .map(item => ({
                        videoId: item.videoId,
                        title: item.title || 'Bilinmeyen',
                        author: item.author || 'YouTube',
                        thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
                        lengthSeconds: item.lengthSeconds || 0,
                        lengthText: formatDuration(item.lengthSeconds),
                        viewCountText: item.viewCount ? item.viewCount.toLocaleString() : ''
                    }));
                
                if (searchResults.length > 0) {
                    console.log(`✅ Alternatif: ${api} - ${searchResults.length} sonuç`);
                    displayResults();
                    return;
                }
            }
        } catch(e) {
            console.log(`❌ ${api}`);
        }
    }
    
    resultsList.innerHTML = `
        <div style="text-align:center;padding:20px;color:#888">
            <p>😔 Tüm yöntemler başarısız</p>
            <button onclick="openYouTubeSearch()" style="margin-top:10px;background:#ff0000;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px">
                🔗 YouTube'da Aç
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
        const duration = item.lengthText || formatDuration(item.lengthSeconds);
        
        return `
            <div class="result-item" onclick="playSearchResult(${index})" id="result-${index}">
                <img src="${item.thumbnail}" class="result-thumb" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect fill=%22%23333%22 width=%2260%22 height=%2260%22 rx=%228%22/><text fill=%22%23fff%22 x=%2230%22 y=%2235%22 text-anchor=%22middle%22 font-size=%2220%22>🎵</text></svg>'"
                     loading="lazy">
                <div class="result-info">
                    <strong>${escapeHtml(item.title)}</strong>
                    <small>${escapeHtml(item.author)} ${item.viewCountText ? '• ' + item.viewCountText : ''}</small>
                </div>
                ${duration ? `<span class="result-duration">${duration}</span>` : ''}
            </div>
        `;
    }).join('');
    
    // İlk sonucu otomatik oynat
    if (searchResults.length > 0) {
        setTimeout(() => playSearchResult(0), 300);
    }
}

function playSearchResult(index) {
    if (index < 0 || index >= searchResults.length) return;
    
    currentSearchIndex = index;
    const item = searchResults[index];
    
    // UI güncelle
    document.querySelectorAll('.result-item').forEach((el, i) => {
        el.classList.toggle('playing', i === index);
    });
    
    // Sonucu kaydır
    const resultEl = document.getElementById(`result-${index}`);
    if (resultEl) {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    const track = {
        id: item.videoId,
        title: item.title,
        artist: item.author,
        thumbnail: item.thumbnail,
        duration: item.lengthSeconds
    };
    
    // Playlist'e ekle
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

function closeSearch() {
    document.getElementById('searchResults').style.display = 'none';
    searchResults = [];
    currentSearchIndex = -1;
}

// ============ DİĞER FONKSİYONLAR (DEĞİŞMEDİ) ============

function playDirectUrl() {
    const url = document.getElementById('searchInput').value.trim();
    if (!url) return alert('Link yapıştırın!');
    
    const videoId = extractId(url);
    if (videoId) {
        addTrackById(videoId);
        document.getElementById('searchInput').value = '';
    } else {
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
            alert('Panoda YouTube linki yok. Arama yapın.');
        }
    } catch(e) {
        alert('Panodan yapıştırılamadı.');
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
    
    const track = {
        id: videoId,
        title: 'YouTube Videosu',
        artist: 'YouTube',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        addedAt: Date.now()
    };
    
    // oEmbed ile bilgi almayı dene
    try {
        const resp = await fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`);
        if (resp.ok) {
            const data = await resp.json();
            track.title = data.title.replace(' - YouTube', '');
            track.artist = data.author_name || 'YouTube';
        }
    } catch(e) {}
    
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
        alert('Tarayıcınız sesli aramayı desteklemiyor.');
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
    
    document.getElementById('micBtn').classList.add('listening');
    document.getElementById('voiceStatus').textContent = '🎤 Dinliyorum...';
    
    recognition.start();
    
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('searchInput').value = text;
        document.getElementById('voiceStatus').textContent = '✅ "' + text + '"';
        doSearch();
    };
    
    recognition.onerror = (e) => {
        document.getElementById('voiceStatus').textContent = '❌ ' + e.error;
    };
    
    recognition.onend = () => {
        document.getElementById('micBtn').classList.remove('listening');
        recognition = null;
    };
}

// ============ YARDIMCILAR ============

function parseDuration(text) {
    if (!text) return 0;
    const parts = text.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2,'0')}`;
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
console.log('✅ v8.1 hazır - YouTube scraping aktif');

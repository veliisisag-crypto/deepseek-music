// YT MUSIC v11.0 - YouTube RSS Feed ile Arama
console.log('🎵 YT Music v11.0 - RSS Arama');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let isPlaying = false;
let searchResults = [];
let currentSearchIndex = -1;

// Yükle
try { playlist = JSON.parse(localStorage.getItem('playlist_v11') || '[]'); } catch(e) { playlist = []; }

function onYouTubeIframeAPIReady() {
    console.log('✅ API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ RSS ARAMA ============

async function doSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return alert('Aramak için bir şey yazın!');
    
    const resultsBox = document.getElementById('resultsBox');
    const resultsList = document.getElementById('resultsList');
    
    resultsBox.style.display = 'block';
    resultsList.innerHTML = '<div class="loading-state"><div class="spinner"></div>Aranıyor...</div>';
    
    searchResults = [];
    currentSearchIndex = -1;
    
    try {
        // YouTube RSS Feed (CORS sorunu olmaz!)
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?q=${encodeURIComponent(query)}`;
        const response = await fetch(rssUrl);
        
        if (!response.ok) throw new Error('YouTube yanıt vermedi');
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Entry'leri al
        const entries = xmlDoc.querySelectorAll('entry');
        
        if (entries.length === 0) {
            resultsList.innerHTML = '<div class="empty-state"><p>😔 Sonuç bulunamadı</p></div>';
            document.getElementById('resultCount').textContent = '0';
            return;
        }
        
        searchResults = Array.from(entries).map(entry => {
            const videoId = entry.querySelector('yt\\:videoId')?.textContent || 
                           entry.querySelector('videoId')?.textContent || '';
            const title = entry.querySelector('title')?.textContent || 'Bilinmeyen';
            const author = entry.querySelector('author name')?.textContent || 'YouTube';
            
            // Thumbnail
            const mediaGroup = entry.querySelector('media\\:group, group');
            const thumbnail = mediaGroup?.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url') ||
                            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            
            return { videoId, title, author, thumbnail };
        }).filter(item => item.videoId);
        
        document.getElementById('resultCount').textContent = searchResults.length;
        displayResults();
        
    } catch (error) {
        console.error('RSS hatası:', error);
        
        // Fallback: Invidious API dene
        resultsList.innerHTML = '<div class="loading-state"><div class="spinner"></div>Alternatif yöntem deneniyor...</div>';
        await tryInvidiousSearch(query);
    }
}

async function tryInvidiousSearch(query) {
    const resultsList = document.getElementById('resultsList');
    const apis = [
        'https://inv.nadeko.net/api/v1/search',
        'https://invidious.snopyta.org/api/v1/search',
        'https://yewtu.be/api/v1/search'
    ];
    
    for (const api of apis) {
        try {
            const resp = await fetch(`${api}?q=${encodeURIComponent(query)}&type=video`, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (resp.ok) {
                const data = await resp.json();
                searchResults = data
                    .filter(item => item.videoId)
                    .map(item => ({
                        videoId: item.videoId,
                        title: item.title || 'Bilinmeyen',
                        author: item.author || 'YouTube',
                        thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`
                    }));
                
                document.getElementById('resultCount').textContent = searchResults.length;
                displayResults();
                return;
            }
        } catch(e) {}
    }
    
    // Tamamen başarısız
    resultsList.innerHTML = `
        <div class="empty-state">
            <p>😔 Arama şu anda çalışmıyor</p>
            <button onclick="searchOnYouTube()" style="margin-top:15px;background:#ff0000;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px">
                🔗 YouTube'da Ara
            </button>
        </div>`;
}

function searchOnYouTube() {
    const query = document.getElementById('searchInput').value.trim();
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
    document.getElementById('resultsBox').style.display = 'none';
}

function displayResults() {
    const resultsList = document.getElementById('resultsList');
    
    resultsList.innerHTML = searchResults.map((item, i) => `
        <div class="result-item" id="result-${i}" onclick="playSearchResult(${i})">
            <img src="${item.thumbnail}" onerror="this.style.display='none'" loading="lazy">
            <div class="result-info">
                <strong>${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(item.author)}</small>
            </div>
        </div>
    `).join('');
    
    // İlk sonucu otomatik oynat
    if (searchResults.length > 0) {
        setTimeout(() => playSearchResult(0), 500);
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
    
    // Kaydır
    document.getElementById(`result-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Track oluştur
    const track = {
        id: item.videoId,
        title: item.title,
        artist: item.author,
        thumbnail: item.thumbnail
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

function closeResults() {
    document.getElementById('resultsBox').style.display = 'none';
    searchResults = [];
    currentSearchIndex = -1;
}

// ============ LİNK İŞLEMLERİ ============

function playFromInput() {
    const input = document.getElementById('searchInput').value.trim();
    if (!input) return alert('Link yapıştırın!');
    
    const videoId = extractId(input);
    if (videoId) {
        addAndPlay(videoId);
        document.getElementById('searchInput').value = '';
    } else if (!input.includes('youtube.com')) {
        doSearch();
    } else {
        alert('Geçersiz link!');
    }
}

async function pasteAndPlay() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('searchInput').value = text;
        const videoId = extractId(text);
        if (videoId) {
            addAndPlay(videoId);
            document.getElementById('searchInput').value = '';
        } else {
            alert('Panoda YouTube linki yok. Arama yapın.');
        }
    } catch(e) {
        alert('Panoya erişilemedi.');
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

function addAndPlay(videoId) {
    const existing = playlist.findIndex(t => t.id === videoId);
    if (existing >= 0) {
        currentIndex = existing;
        playTrack(playlist[existing]);
        return;
    }
    
    const track = {
        id: videoId,
        title: 'Yükleniyor...',
        artist: 'YouTube',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    };
    
    playlist.push(track);
    savePlaylist();
    currentIndex = playlist.length - 1;
    updateUI();
    playTrack(track);
    
    // oEmbed ile bilgi al
    fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`)
        .then(r => r.json())
        .then(data => {
            track.title = data.title.replace(' - YouTube', '').trim();
            track.artist = data.author_name || 'YouTube';
            document.getElementById('title').textContent = track.title;
            document.getElementById('artist').textContent = track.artist;
            savePlaylist();
            updateUI();
        }).catch(() => {});
}

// ============ PLAYER ============

function playTrack(track) {
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
                        e.target.setVolume(localStorage.getItem('volume_v11') || 70);
                        e.target.unMute();
                        e.target.playVideo();
                        isPlaying = true;
                        document.getElementById('playBtn').textContent = '⏸️';
                    },
                    onStateChange: (e) => {
                        if (e.data === 0) nextTrack();
                        else if (e.data === 1) { isPlaying = true; document.getElementById('playBtn').textContent = '⏸️'; }
                        else if (e.data === 2) { isPlaying = false; document.getElementById('playBtn').textContent = '▶️'; }
                    },
                    onError: () => { alert('Video çalınamadı.'); nextTrack(); }
                }
            });
        } catch(e) {}
    }, 100);
    
    updateUI();
    saveSession(track);
    document.getElementById('player').scrollIntoView({ behavior: 'smooth' });
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
        if (isPlaying) ytPlayer.pauseVideo();
        else { ytPlayer.unMute(); ytPlayer.playVideo(); }
    } catch(e) {}
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
    if (ytPlayer) ytPlayer.setVolume(val);
    localStorage.setItem('volume_v11', val);
}

// ============ PLAYLIST ============

function clearPlaylist() {
    if (!playlist.length) return;
    if (confirm('Listeyi temizle?')) {
        destroyPlayer();
        playlist = [];
        currentIndex = -1;
        document.getElementById('player').style.display = 'none';
        savePlaylist();
        updateUI();
    }
}

function updateUI() {
    const pl = document.getElementById('playlist');
    document.getElementById('count').textContent = playlist.length;
    
    if (!playlist.length) {
        pl.innerHTML = '<div class="empty-state"><p>🎵 Liste boş</p></div>';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
        return;
    }
    
    pl.innerHTML = playlist.map((t, i) => `
        <div class="playlist-item${i === currentIndex ? ' active' : ''}" onclick="clickTrack(${i})">
            <img src="${t.thumbnail}" onerror="this.style.display='none'">
            <div class="info">
                <strong>${escapeHtml(t.title)}</strong>
                <small>${escapeHtml(t.artist)}</small>
            </div>
            <button class="btn-remove" onclick="event.stopPropagation();removeTrack(${i})">✕</button>
        </div>
    `).join('');
    
    document.getElementById('prevBtn').disabled = currentIndex <= 0 && currentSearchIndex <= 0;
    document.getElementById('nextBtn').disabled = currentIndex >= playlist.length - 1 && currentSearchIndex >= searchResults.length - 1;
}

function clickTrack(i) { currentIndex = i; searchResults = []; currentSearchIndex = -1; playTrack(playlist[i]); }

function removeTrack(i) {
    event.stopPropagation();
    if (currentIndex === i) { destroyPlayer(); document.getElementById('player').style.display = 'none'; currentIndex = -1; }
    else if (currentIndex > i) currentIndex--;
    playlist.splice(i, 1);
    savePlaylist();
    updateUI();
}

// ============ SESLİ ARAMA ============

function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('Sesli arama desteklenmiyor.');
    
    if (window._rec) { window._rec.stop(); window._rec = null; document.getElementById('micBtn').classList.remove('listening'); return; }
    
    const rec = new SR();
    rec.lang = 'tr-TR';
    window._rec = rec;
    
    document.getElementById('micBtn').classList.add('listening');
    document.getElementById('searchInput').placeholder = '🎤 Dinliyorum...';
    
    rec.start();
    rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        document.getElementById('searchInput').value = text;
        doSearch();
    };
    rec.onend = () => {
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('searchInput').placeholder = 'Şarkı veya sanatçı ara...';
        window._rec = null;
    };
}

// ============ YARDIMCILAR ============

function escapeHtml(t) {
    if (!t) return '';
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function savePlaylist() { try { localStorage.setItem('playlist_v11', JSON.stringify(playlist)); } catch(e) {} }

function saveSession(track) {
    try { localStorage.setItem('session_v11', JSON.stringify({id: track.id, index: currentIndex})); } catch(e) {}
}

function restoreSession() {
    try {
        const s = localStorage.getItem('session_v11');
        if (s && playlist.length) {
            const d = JSON.parse(s);
            const t = playlist.find(x => x.id === d.id);
            if (t) { currentIndex = d.index; document.getElementById('player').style.display = 'block'; document.getElementById('thumbnail').src = t.thumbnail; document.getElementById('title').textContent = t.title; document.getElementById('artist').textContent = t.artist; }
        }
    } catch(e) {}
}

// Enter tuşu
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const v = document.getElementById('searchInput').value.trim();
            if (v.includes('youtube.com') || v.includes('youtu.be')) playFromInput();
            else if (v) doSearch();
        }
    });
});

// Başlangıç
document.getElementById('volSlider').value = localStorage.getItem('volume_v11') || 70;
updateUI();
console.log('✅ v11.0 hazır - RSS Arama');

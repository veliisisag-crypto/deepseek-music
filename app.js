// YT MUSIC v6.0 - ANA UYGULAMA
console.log('🎵 YT Music v6.0');

// Veri yönetimi için yardımcı fonksiyonlar
const DataManager = {
    getPlaylist() {
        try { return JSON.parse(localStorage.getItem('playlist_v6') || '[]'); } 
        catch(e) { return []; }
    },
    
    savePlaylist(playlist) {
        try { localStorage.setItem('playlist_v6', JSON.stringify(playlist)); } 
        catch(e) {}
    },
    
    getStats() {
        try { 
            return JSON.parse(localStorage.getItem('stats_v6') || '{"totalSeconds":0,"totalDataMB":0,"songsPlayed":0,"history":[]}'); 
        } catch(e) { 
            return {totalSeconds:0, totalDataMB:0, songsPlayed:0, history:[]}; 
        }
    },
    
    saveStats(stats) {
        try { localStorage.setItem('stats_v6', JSON.stringify(stats)); } 
        catch(e) {}
    },
    
    getVolume() {
        return parseInt(localStorage.getItem('volume_v6') || '70');
    },
    
    saveVolume(vol) {
        try { localStorage.setItem('volume_v6', vol.toString()); } 
        catch(e) {}
    },
    
    addToHistory(song) {
        const stats = this.getStats();
        const today = new Date().toISOString().split('T')[0];
        
        let todayRecord = stats.history.find(h => h.date === today);
        if (!todayRecord) {
            todayRecord = {date: today, songs: 0, dataMB: 0, seconds: 0};
            stats.history.push(todayRecord);
        }
        
        todayRecord.songs++;
        stats.songsPlayed++;
        stats.totalSeconds += 180; // Ortalama 3 dakika
        stats.totalDataMB += (140 * 180) / 8 / 1024; // ~3 MB per song
        
        // Son 30 günü tut
        if (stats.history.length > 30) {
            stats.history = stats.history.slice(-30);
        }
        
        this.saveStats(stats);
    }
};

// Ana uygulama
let playlist = DataManager.getPlaylist();
let currentIndex = -1;
let ytPlayer = null;
let isPlaying = false;
let currentTrack = null;
let playTimer = null;
let startTime = null;

function onYouTubeIframeAPIReady() {
    console.log('✅ YouTube API hazır');
    restoreSession();
    updateUI();
    updateMiniStats();
}

if (window.YT && YT.Player) onYouTubeIframeAPIReady();

function playUrl() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) return alert('Link yapıştırın!');
    
    const videoId = extractId(url);
    if (!videoId) return alert('Geçersiz YouTube linki!');
    
    addTrack(videoId);
    document.getElementById('urlInput').value = '';
}

async function pasteUrl() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('urlInput').value = text;
        const videoId = extractId(text);
        if (videoId) addTrack(videoId);
    } catch(e) {
        alert('Manuel yapıştırın');
        document.getElementById('urlInput').focus();
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

function addTrack(videoId) {
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
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        addedAt: Date.now()
    };
    
    playlist.push(track);
    DataManager.savePlaylist(playlist);
    DataManager.addToHistory(track);
    updateUI();
    
    currentIndex = playlist.length - 1;
    playTrack(track);
}

function playTrack(track) {
    currentTrack = track;
    updateStatus('Yükleniyor...');
    
    document.getElementById('player').style.display = 'block';
    document.getElementById('thumbnail').src = track.thumbnail;
    document.getElementById('title').textContent = track.title;
    document.getElementById('artist').textContent = track.artist;
    
    destroyPlayer();
    startPlayTimer();
    
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
                        console.log('✅ Oynatılıyor:', track.id);
                        e.target.setVolume(DataManager.getVolume());
                        e.target.unMute();
                        e.target.playVideo();
                        updateStatus('▶️ Oynatılıyor');
                        
                        setTimeout(() => {
                            try {
                                const data = e.target.getVideoData();
                                if (data && data.title && currentTrack) {
                                    currentTrack.title = data.title;
                                    currentTrack.artist = data.author || 'YouTube';
                                    document.getElementById('title').textContent = currentTrack.title;
                                    document.getElementById('artist').textContent = currentTrack.artist;
                                    DataManager.savePlaylist(playlist);
                                    updateUI();
                                }
                            } catch(ex) {}
                        }, 2000);
                    },
                    onStateChange: (e) => {
                        if (e.data === 0) { stopPlayTimer(); nextTrack(); }
                        else if (e.data === 1) { isPlaying = true; document.getElementById('playBtn').textContent = '⏸️'; updateStatus('▶️ Oynatılıyor'); }
                        else if (e.data === 2) { isPlaying = false; document.getElementById('playBtn').textContent = '▶️'; updateStatus('⏸️ Duraklatıldı'); stopPlayTimer(); }
                    },
                    onError: (e) => {
                        stopPlayTimer();
                        alert('Video çalınamadı. Embed engeli olabilir.');
                        nextTrack();
                    }
                }
            });
        } catch(e) { updateStatus('❌ Hata'); }
    }, 100);
    
    updateUI();
    updateMiniStats();
    saveSession(track);
}

function destroyPlayer() {
    stopPlayTimer();
    if (ytPlayer) {
        try { ytPlayer.stopVideo(); ytPlayer.destroy(); } catch(e) {}
        ytPlayer = null;
    }
    isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️';
}

function startPlayTimer() {
    stopPlayTimer();
    startTime = Date.now();
    playTimer = setInterval(updatePlayTime, 1000);
}

function stopPlayTimer() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    startTime = null;
}

function updatePlayTime() {
    const stats = DataManager.getStats();
    const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const totalSec = stats.totalSeconds + elapsed;
    
    document.getElementById('playTime').textContent = formatTime(totalSec);
    document.getElementById('trackNum').textContent = `${currentIndex + 1}/${playlist.length}`;
    updateMiniStats();
}

function updateMiniStats() {
    const stats = DataManager.getStats();
    const totalMB = (140 * stats.totalSeconds) / 8 / 1024;
    const videoMB = (2500 * stats.totalSeconds) / 8 / 1024;
    const savedMB = videoMB - totalMB;
    const percent = videoMB > 0 ? Math.round((savedMB / videoMB) * 100) : 0;
    
    document.getElementById('miniData').textContent = formatMB(totalMB);
    document.getElementById('miniSaved').textContent = formatMB(savedMB);
    document.getElementById('miniPercent').textContent = '%' + percent;
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
    if (currentIndex < playlist.length - 1) {
        currentIndex++;
        playTrack(playlist[currentIndex]);
    } else {
        destroyPlayer();
        document.getElementById('player').style.display = 'none';
        updateStatus('📋 Liste sonu');
    }
}

function prevTrack() {
    if (currentIndex > 0) {
        currentIndex--;
        playTrack(playlist[currentIndex]);
    }
}

function setVolume(val) {
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(val);
    document.getElementById('volText').textContent = val + '%';
    DataManager.saveVolume(val);
}

function clearPlaylist() {
    if (playlist.length === 0) return;
    if (confirm('Listeyi temizle?')) {
        destroyPlayer();
        playlist = [];
        currentIndex = -1;
        currentTrack = null;
        document.getElementById('player').style.display = 'none';
        DataManager.savePlaylist(playlist);
        updateUI();
    }
}

function updateUI() {
    const pl = document.getElementById('playlist');
    document.getElementById('count').textContent = playlist.length;
    
    if (playlist.length === 0) {
        pl.innerHTML = '<p style="text-align:center;color:#888;padding:20px">Liste boş</p>';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
        return;
    }
    
    pl.innerHTML = playlist.map((t, i) => `
        <div class="playlist-item${i === currentIndex ? ' active' : ''}" onclick="clickTrack(${i})">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
                <img src="${t.thumbnail}" width="40" height="40" style="border-radius:5px" onerror="this.style.display='none'">
                <div style="min-width:0">
                    <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">${t.title}</strong>
                    <small style="color:#aaa;font-size:11px">${t.artist}</small>
                </div>
            </div>
            <button class="remove-btn" onclick="event.stopPropagation();removeTrack(${i})">✕</button>
        </div>
    `).join('');
    
    document.getElementById('prevBtn').disabled = currentIndex <= 0;
    document.getElementById('nextBtn').disabled = currentIndex >= playlist.length - 1;
}

function clickTrack(index) { currentIndex = index; playTrack(playlist[index]); }

function removeTrack(index) {
    event.stopPropagation();
    if (currentIndex === index) {
        destroyPlayer();
        document.getElementById('player').style.display = 'none';
        currentIndex = -1;
        currentTrack = null;
    } else if (currentIndex > index) currentIndex--;
    playlist.splice(index, 1);
    DataManager.savePlaylist(playlist);
    updateUI();
}

function saveSession(track) {
    try { localStorage.setItem('session_v6', JSON.stringify({id: track.id, index: currentIndex})); } catch(e) {}
}

function restoreSession() {
    try {
        const saved = localStorage.getItem('session_v6');
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
                updateStatus('🔄 Son oturum');
            }
        }
    } catch(e) {}
}

function updateStatus(msg) { document.getElementById('status').textContent = msg; }

function formatMB(mb) {
    if (mb < 0.01) return '0 MB';
    if (mb < 1) return mb.toFixed(2) + ' MB';
    if (mb < 1024) return mb.toFixed(1) + ' MB';
    return (mb / 1024).toFixed(2) + ' GB';
}

function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// Başlangıç
document.getElementById('volSlider').value = DataManager.getVolume();
document.getElementById('volText').textContent = DataManager.getVolume() + '%';
updateUI();
updateMiniStats();

window.addEventListener('beforeunload', () => { stopPlayTimer(); });
console.log('✅ v6.0 hazır');

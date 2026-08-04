// YT MUSIC v9.0 - Basit ve Çalışan
console.log('🎵 YT Music v9.0');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let isPlaying = false;
let currentTrack = null;

// Yükle
try { 
    const saved = localStorage.getItem('playlist_v9');
    if (saved) playlist = JSON.parse(saved); 
} catch(e) {}

function onYouTubeIframeAPIReady() {
    console.log('✅ API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ ARAMA ============

function searchOnYouTube() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return alert('Şarkı adı yazın!');
    
    // YouTube'da yeni sekmede ara
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
    
    document.getElementById('searchInput').value = '';
    document.getElementById('searchInput').placeholder = 'Linki kopyalayıp yapıştırın...';
}

function toggleYTSearch() {
    const frame = document.getElementById('ytFrame');
    const query = document.getElementById('searchInput').value.trim() || 'müzik';
    
    if (frame.style.display === 'block') {
        frame.style.display = 'none';
        frame.src = '';
        return;
    }
    
    frame.style.display = 'block';
    frame.src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=0`;
    
    // Kullanıcıya talimat
    setTimeout(() => {
        alert('💡 Video linkini kopyalamak için:\n\n1. Videoya tıklayın\n2. Adres çubuğundan linki kopyalayın\n3. Buraya yapıştırıp ▶️ Oynat\'a basın');
    }, 1000);
}

// Enter tuşu
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const input = document.getElementById('searchInput').value.trim();
            if (input.includes('youtube.com') || input.includes('youtu.be')) {
                playFromInput();
            } else if (input) {
                searchOnYouTube();
            }
        }
    });
});

// ============ OYNATMA ============

function playFromInput() {
    const input = document.getElementById('searchInput').value.trim();
    if (!input) return alert('Link yapıştırın!');
    
    const videoId = extractId(input);
    if (videoId) {
        addAndPlay(videoId);
        document.getElementById('searchInput').value = '';
    } else if (!input.includes('youtube.com')) {
        searchOnYouTube();
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
            alert('Panoda YouTube linki bulunamadı.\n\nYouTube\'dan video linki kopyalayın.');
        }
    } catch(e) {
        alert('Panoya erişilemedi. Linki manuel yapıştırın.');
    }
}

function extractId(input) {
    if (!input) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/
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
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        addedAt: Date.now()
    };
    
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
                        e.target.setVolume(localStorage.getItem('volume_v9') || 70);
                        e.target.unMute();
                        e.target.playVideo();
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
    
    // oEmbed ile bilgi al
    fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${track.id}&format=json`)
        .then(r => r.json())
        .then(data => {
            track.title = data.title.replace(' - YouTube', '');
            track.artist = data.author_name || 'YouTube';
            document.getElementById('title').textContent = track.title;
            document.getElementById('artist').textContent = track.artist;
            savePlaylist();
            updateUI();
        })
        .catch(() => {});
    
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
    if (currentIndex < playlist.length - 1) {
        currentIndex++;
        playTrack(playlist[currentIndex]);
    } else {
        destroyPlayer();
        document.getElementById('player').style.display = 'none';
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
    localStorage.setItem('volume_v9', val);
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
        pl.innerHTML = '<p style="text-align:center;color:#555;padding:30px">🎵 Liste boş</p>';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
        return;
    }
    
    pl.innerHTML = playlist.map((t, i) => `
        <div class="playlist-item${i === currentIndex ? ' active' : ''}" onclick="clickTrack(${i})">
            <img src="${t.thumbnail}" onerror="this.style.display='none'">
            <div class="info">
                <strong>${t.title}</strong>
                <small>${t.artist}</small>
            </div>
            <button class="btn-remove" onclick="event.stopPropagation();removeTrack(${i})">✕</button>
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
    savePlaylist();
    updateUI();
}

// ============ SESLİ ARAMA ============

function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('Sesli arama desteklenmiyor.');
        return;
    }
    
    if (window._recognition) {
        window._recognition.stop();
        window._recognition = null;
        document.getElementById('micBtn').classList.remove('listening');
        return;
    }
    
    const rec = new SpeechRecognition();
    rec.lang = 'tr-TR';
    window._recognition = rec;
    
    document.getElementById('micBtn').classList.add('listening');
    document.getElementById('voiceStatus').textContent = '🎤 Dinliyorum...';
    
    rec.start();
    
    rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        document.getElementById('searchInput').value = text;
        document.getElementById('voiceStatus').textContent = '✅ ' + text;
        searchOnYouTube();
    };
    
    rec.onerror = (e) => {
        document.getElementById('voiceStatus').textContent = '❌ ' + e.error;
    };
    
    rec.onend = () => {
        document.getElementById('micBtn').classList.remove('listening');
        window._recognition = null;
    };
}

function savePlaylist() {
    try { localStorage.setItem('playlist_v9', JSON.stringify(playlist)); } catch(e) {}
}

function saveSession(track) {
    try { localStorage.setItem('session_v9', JSON.stringify({id: track.id, index: currentIndex})); } catch(e) {}
}

function restoreSession() {
    try {
        const saved = localStorage.getItem('session_v9');
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
document.getElementById('volSlider').value = localStorage.getItem('volume_v9') || 70;
updateUI();
console.log('✅ v9.0 hazır');

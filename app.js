// YT MUSIC v7.0 - Sesli Aramalı
console.log('🎵 YT Music v7.0');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let isPlaying = false;
let currentTrack = null;

// LocalStorage'dan yükle
try {
    const saved = localStorage.getItem('playlist_v7');
    if (saved) playlist = JSON.parse(saved);
} catch(e) { playlist = []; }

// YouTube API
function onYouTubeIframeAPIReady() {
    console.log('✅ YouTube API hazır');
    restoreSession();
    updateUI();
}

if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ ARAMA FONKSİYONLARI ============

function searchYouTube() {
    const query = document.getElementById('urlInput').value.trim();
    if (!query) {
        alert('Lütfen bir şarkı adı veya sanatçı yazın!');
        return;
    }
    
    // YouTube'da ara (yeni sekmede)
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`;
    window.open(searchUrl, '_blank');
    
    // Kullanıcıya bilgi ver
    document.getElementById('urlInput').value = '';
    document.getElementById('urlInput').placeholder = 'Linki yapıştırıp ▶️ Oynat\'a basın...';
}

function playUrl() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        alert('Lütfen bir YouTube linki yapıştırın!');
        return;
    }
    
    const videoId = extractId(url);
    if (!videoId) {
        // Belki arama terimi yazılmıştır
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            searchYouTube();
        } else {
            alert('Geçersiz YouTube linki!\n\nÖrnek: youtube.com/watch?v=VIDEO_ID');
        }
        return;
    }
    
    addTrack(videoId);
    document.getElementById('urlInput').value = '';
    document.getElementById('urlInput').placeholder = 'Şarkı ara veya link yapıştır...';
}

async function pasteAndPlay() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('urlInput').value = text;
        
        const videoId = extractId(text);
        if (videoId) {
            addTrack(videoId);
            document.getElementById('urlInput').value = '';
        } else {
            alert('Panoda geçerli bir YouTube linki bulunamadı.');
        }
    } catch(e) {
        alert('Panodan yapıştırılamadı. Manuel yapıştırın.');
        document.getElementById('urlInput').focus();
    }
}

// ============ SESLİ ARAMA ============

let recognition = null;

function startVoiceSearch() {
    // Tarayıcı desteği kontrolü
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('❌ Sesli arama tarayıcınızda desteklenmiyor.\n\nChrome tarayıcı kullanın.');
        return;
    }
    
    // Mikrofon izni kontrolü
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('❌ Mikrofon erişimi yok.\n\nLütfen site ayarlarından mikrofon izni verin.');
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
    recognition.continuous = false;
    
    // Mikrofon butonunu aktif et
    const micBtn = document.getElementById('micBtn');
    micBtn.classList.add('listening');
    document.getElementById('voiceStatus').textContent = '🎤 Dinliyorum...';
    document.getElementById('urlInput').placeholder = 'Söylemek istediğiniz şarkıyı söyleyin...';
    
    recognition.start();
    
    recognition.onresult = (event) => {
        const voiceText = event.results[0][0].transcript;
        console.log('🎤 Algılanan:', voiceText);
        
        document.getElementById('urlInput').value = voiceText;
        document.getElementById('voiceStatus').textContent = '✅ Algılandı: "' + voiceText + '"';
        
        // Otomatik arama yap
        setTimeout(() => {
            searchYouTube();
            document.getElementById('voiceStatus').textContent = '';
        }, 1500);
    };
    
    recognition.onerror = (event) => {
        console.error('🎤 Hata:', event.error);
        
        let message = '';
        switch(event.error) {
            case 'no-speech': message = 'Ses algılanamadı. Tekrar deneyin.'; break;
            case 'aborted': message = 'İptal edildi.'; break;
            case 'audio-capture': message = 'Mikrofon bulunamadı.'; break;
            case 'not-allowed': message = 'Mikrofon izni verilmedi.'; break;
            case 'network': message = 'İnternet bağlantısı yok.'; break;
            default: message = 'Hata: ' + event.error;
        }
        
        document.getElementById('voiceStatus').textContent = '❌ ' + message;
        
        setTimeout(() => {
            document.getElementById('voiceStatus').textContent = '';
        }, 3000);
    };
    
    recognition.onend = () => {
        micBtn.classList.remove('listening');
        recognition = null;
        document.getElementById('urlInput').placeholder = 'Şarkı ara veya link yapıştır...';
    };
}

// ============ VİDEO İŞLEMLERİ ============

function extractId(input) {
    if (!input) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/
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
    savePlaylist();
    updateUI();
    
    currentIndex = playlist.length - 1;
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
                        console.log('✅ Oynatılıyor:', track.id);
                        const vol = localStorage.getItem('volume_v7') || 70;
                        e.target.setVolume(vol);
                        e.target.unMute();
                        e.target.playVideo();
                        
                        setTimeout(() => {
                            try {
                                const data = e.target.getVideoData();
                                if (data && data.title && currentTrack) {
                                    currentTrack.title = data.title;
                                    currentTrack.artist = data.author || 'YouTube';
                                    document.getElementById('title').textContent = currentTrack.title;
                                    document.getElementById('artist').textContent = currentTrack.artist;
                                    savePlaylist();
                                    updateUI();
                                }
                            } catch(ex) {}
                        }, 2000);
                    },
                    onStateChange: (e) => {
                        if (e.data === 0) nextTrack();
                        else if (e.data === 1) { isPlaying = true; document.getElementById('playBtn').textContent = '⏸️'; }
                        else if (e.data === 2) { isPlaying = false; document.getElementById('playBtn').textContent = '▶️'; }
                    },
                    onError: (e) => {
                        console.error('Hata:', e.data);
                        alert('Bu video çalınamadı. Başka bir video deneyin.');
                        nextTrack();
                    }
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
    localStorage.setItem('volume_v7', val);
}

function clearPlaylist() {
    if (playlist.length === 0) return;
    if (confirm('Çalma listesini temizlemek istediğinize emin misiniz?')) {
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
        pl.innerHTML = '<p style="text-align:center;color:#555;padding:30px;font-size:14px">🎵 Liste boş<br><small>Şarkı arayın veya link yapıştırın</small></p>';
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

function savePlaylist() {
    try { localStorage.setItem('playlist_v7', JSON.stringify(playlist)); } catch(e) {}
}

function saveSession(track) {
    try { localStorage.setItem('session_v7', JSON.stringify({id: track.id, index: currentIndex})); } catch(e) {}
}

function restoreSession() {
    try {
        const saved = localStorage.getItem('session_v7');
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
const savedVol = localStorage.getItem('volume_v7') || 70;
document.getElementById('volSlider').value = savedVol;
updateUI();
console.log('✅ v7.0 hazır - Sesli arama aktif');

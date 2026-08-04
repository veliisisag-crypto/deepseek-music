// YT MUSIC v10.0 - Basit, Sade, Çalışan
console.log('🎵 YT Music v10.0');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let isPlaying = false;

// LocalStorage'dan yükle
try { playlist = JSON.parse(localStorage.getItem('playlist_v10') || '[]'); } catch(e) { playlist = []; }

// YouTube API hazır olunca
function onYouTubeIframeAPIReady() {
    console.log('✅ YouTube API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ LİNK İŞLEMLERİ ============

function playUrl() {
    const input = document.getElementById('urlInput').value.trim();
    if (!input) return shakeInput();
    
    const videoId = extractVideoId(input);
    if (videoId) {
        addAndPlay(videoId);
        document.getElementById('urlInput').value = '';
    } else {
        alert('❌ Geçersiz YouTube linki!\n\nÖrnekler:\n• youtube.com/watch?v=VIDEO_ID\n• youtu.be/VIDEO_ID\n• youtube.com/shorts/VIDEO_ID');
        shakeInput();
    }
}

async function pasteAndPlay() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return alert('📋 Panoda hiçbir şey yok!');
        
        document.getElementById('urlInput').value = text;
        const videoId = extractVideoId(text);
        
        if (videoId) {
            addAndPlay(videoId);
            document.getElementById('urlInput').value = '';
        } else {
            alert('📋 Panoda geçerli bir YouTube linki bulunamadı.\n\nYouTube\'a gidip video linkini kopyalayın.');
        }
    } catch(e) {
        alert('📋 Panoya erişilemedi. Linki manuel yapıştırıp ▶️ tuşuna basın.');
        document.getElementById('urlInput').focus();
    }
}

function extractVideoId(input) {
    if (!input) return null;
    
    // Direkt video ID (11 karakter)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    
    // URL'lerden çıkar
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/watch\?.*?v=)([a-zA-Z0-9_-]{11})/
    ];
    
    for (const p of patterns) {
        const m = input.match(p);
        if (m) return m[1];
    }
    
    return null;
}

// ============ HIZLI ARAMA (YOUTUBE'A YÖNLENDİR) ============

function quickSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    // YouTube'da ara (yeni sekme)
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' şarkı')}`;
    window.open(searchUrl, '_blank');
    
    // Kullanıcıya bilgi
    document.getElementById('searchInput').value = '';
    document.getElementById('urlInput').placeholder = 'Linki buraya yapıştırın...';
    
    // Toast mesajı
    showToast('🔗 YouTube açıldı! Linki kopyalayıp buraya yapıştırın.');
}

// Enter tuşları
document.addEventListener('DOMContentLoaded', () => {
    // URL input - Enter
    document.getElementById('urlInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') playUrl();
    });
    
    // Search input - Enter
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') quickSearch();
    });
});

// ============ ŞARKI EKLEME VE OYNATMA ============

function addAndPlay(videoId) {
    // Zaten listede var mı?
    const existingIndex = playlist.findIndex(t => t.id === videoId);
    if (existingIndex >= 0) {
        currentIndex = existingIndex;
        playTrack(playlist[existingIndex]);
        return;
    }
    
    // Yeni şarkı
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
    
    // oEmbed ile bilgileri güncelle
    fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`)
        .then(r => r.json())
        .then(data => {
            track.title = data.title.replace(' - YouTube', '').trim();
            track.artist = data.author_name || 'YouTube';
            document.getElementById('title').textContent = track.title;
            document.getElementById('artist').textContent = track.artist;
            savePlaylist();
            updateUI();
        })
        .catch(() => {
            // oEmbed çalışmazsa thumbnail'dan anla
            track.title = `Video: ${videoId}`;
            document.getElementById('title').textContent = track.title;
        });
}

function playTrack(track) {
    // UI göster
    document.getElementById('player').style.display = 'block';
    document.getElementById('thumbnail').src = track.thumbnail;
    document.getElementById('title').textContent = track.title;
    document.getElementById('artist').textContent = track.artist;
    
    // Eski player'ı temizle
    destroyPlayer();
    
    // Yeni player div'i
    document.getElementById('playerFrame').innerHTML = '<div id="ytplayer"></div>';
    
    // Player'ı oluştur
    setTimeout(() => {
        try {
            ytPlayer = new YT.Player('ytplayer', {
                height: '1',
                width: '1',
                videoId: track.id,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    rel: 0,
                    origin: window.location.origin
                },
                events: {
                    onReady: (e) => {
                        const vol = localStorage.getItem('volume_v10') || 70;
                        e.target.setVolume(vol);
                        e.target.unMute();
                        e.target.playVideo();
                        document.getElementById('playBtn').textContent = '⏸️';
                        isPlaying = true;
                    },
                    onStateChange: (e) => {
                        if (e.data === 0) { // Bitti
                            nextTrack();
                        } else if (e.data === 1) { // Oynuyor
                            isPlaying = true;
                            document.getElementById('playBtn').textContent = '⏸️';
                        } else if (e.data === 2) { // Duraklatıldı
                            isPlaying = false;
                            document.getElementById('playBtn').textContent = '▶️';
                        }
                    },
                    onError: (e) => {
                        console.error('Player hatası:', e.data);
                        showToast('❌ Bu video çalınamadı. Atlanıyor...');
                        setTimeout(() => nextTrack(), 1500);
                    }
                }
            });
        } catch(e) {
            console.error('Player oluşturma hatası:', e);
            showToast('❌ Player başlatılamadı');
        }
    }, 100);
    
    updateUI();
    saveSession(track);
    
    // Player'a scroll
    document.getElementById('player').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function destroyPlayer() {
    if (ytPlayer) {
        try { ytPlayer.stopVideo(); ytPlayer.destroy(); } catch(e) {}
        ytPlayer = null;
    }
    isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️';
}

// ============ KONTROLLER ============

function togglePlay() {
    if (!ytPlayer) {
        if (currentIndex >= 0 && playlist[currentIndex]) {
            playTrack(playlist[currentIndex]);
        }
        return;
    }
    
    try {
        const state = ytPlayer.getPlayerState();
        if (state === 1) {
            ytPlayer.pauseVideo();
        } else {
            ytPlayer.unMute();
            ytPlayer.playVideo();
        }
    } catch(e) {
        if (currentIndex >= 0 && playlist[currentIndex]) {
            playTrack(playlist[currentIndex]);
        }
    }
}

function nextTrack() {
    if (currentIndex < playlist.length - 1) {
        currentIndex++;
        playTrack(playlist[currentIndex]);
    } else {
        destroyPlayer();
        document.getElementById('player').style.display = 'none';
        showToast('📋 Çalma listesinin sonuna geldiniz');
    }
}

function prevTrack() {
    if (currentIndex > 0) {
        currentIndex--;
        playTrack(playlist[currentIndex]);
    }
}

function setVolume(val) {
    if (ytPlayer && ytPlayer.setVolume) {
        ytPlayer.setVolume(val);
    }
    localStorage.setItem('volume_v10', val);
}

// ============ PLAYLIST ============

function clearPlaylist() {
    if (playlist.length === 0) return;
    if (confirm('Çalma listesindeki tüm şarkılar silinecek. Emin misiniz?')) {
        destroyPlayer();
        playlist = [];
        currentIndex = -1;
        document.getElementById('player').style.display = 'none';
        savePlaylist();
        updateUI();
        showToast('🗑 Çalma listesi temizlendi');
    }
}

function updateUI() {
    const pl = document.getElementById('playlist');
    document.getElementById('count').textContent = playlist.length;
    
    if (playlist.length === 0) {
        pl.innerHTML = `
            <div class="empty-state">
                <div class="icon">🎵</div>
                <p>Henüz şarkı eklenmedi</p>
                <p style="font-size:12px;margin-top:5px">YouTube linki yapıştırarak başlayın</p>
            </div>`;
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
        return;
    }
    
    pl.innerHTML = playlist.map((t, i) => `
        <div class="playlist-item${i === currentIndex ? ' active' : ''}" onclick="clickTrack(${i})">
            <img src="${t.thumbnail}" onerror="this.style.display='none'" alt="">
            <div class="info">
                <strong>${escapeHtml(t.title)}</strong>
                <small>${escapeHtml(t.artist)}</small>
            </div>
            <button class="btn-remove" onclick="event.stopPropagation();removeTrack(${i})" title="Kaldır">✕</button>
        </div>
    `).join('');
    
    document.getElementById('prevBtn').disabled = currentIndex <= 0;
    document.getElementById('nextBtn').disabled = currentIndex >= playlist.length - 1;
}

function clickTrack(index) {
    currentIndex = index;
    playTrack(playlist[index]);
}

function removeTrack(index) {
    event.stopPropagation();
    
    if (currentIndex === index) {
        destroyPlayer();
        document.getElementById('player').style.display = 'none';
        currentIndex = -1;
    } else if (currentIndex > index) {
        currentIndex--;
    }
    
    const removed = playlist.splice(index, 1)[0];
    savePlaylist();
    updateUI();
    showToast(`🗑 "${removed.title}" listeden kaldırıldı`);
}

// ============ SESLİ ARAMA ============

let recognition = null;

function quickSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' şarkı')}`, '_blank');
    document.getElementById('searchInput').value = '';
    showToast('🔗 YouTube açıldı! Linki kopyalayıp 📋 tuşuna basın.');
}

// Mikrofon butonu - artık quickSearch'e bağlı
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('micBtn').addEventListener('click', startVoiceSearch);
});

function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert('🎤 Sesli arama tarayıcınızda desteklenmiyor.\n\nChrome tarayıcı kullanın.');
        return;
    }
    
    if (recognition) {
        recognition.stop();
        recognition = null;
        document.getElementById('micBtn').classList.remove('listening');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    const micBtn = document.getElementById('micBtn');
    micBtn.classList.add('listening');
    document.getElementById('searchInput').placeholder = '🎤 Dinliyorum...';
    
    recognition.start();
    
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('searchInput').value = text;
        document.getElementById('searchInput').placeholder = 'Şarkı adı yazın...';
        
        // Otomatik ara
        setTimeout(() => quickSearch(), 500);
    };
    
    recognition.onerror = (event) => {
        console.error('Ses hatası:', event.error);
        let msg = 'Hata oluştu';
        switch(event.error) {
            case 'no-speech': msg = 'Ses algılanamadı'; break;
            case 'not-allowed': msg = 'Mikrofon izni verilmedi'; break;
            case 'network': msg = 'İnternet bağlantısı yok'; break;
        }
        showToast('❌ ' + msg);
    };
    
    recognition.onend = () => {
        micBtn.classList.remove('listening');
        recognition = null;
        document.getElementById('searchInput').placeholder = 'Şarkı adı yazın...';
    };
}

// ============ YARDIMCILAR ============

function showToast(message) {
    // Basit toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #ff0000;
        color: #fff;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: bold;
        z-index: 9999;
        animation: toastIn 0.3s ease;
        white-space: nowrap;
        box-shadow: 0 5px 20px rgba(255,0,0,0.4);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function shakeInput() {
    const input = document.getElementById('urlInput');
    input.style.animation = 'shake 0.5s ease';
    input.style.borderColor = '#ff0000';
    setTimeout(() => {
        input.style.animation = '';
        input.style.borderColor = '#333';
    }, 500);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function savePlaylist() {
    try { localStorage.setItem('playlist_v10', JSON.stringify(playlist)); } catch(e) {}
}

function saveSession(track) {
    try { 
        localStorage.setItem('session_v10', JSON.stringify({
            id: track.id, 
            index: currentIndex
        })); 
    } catch(e) {}
}

function restoreSession() {
    try {
        const saved = localStorage.getItem('session_v10');
        if (saved && playlist.length > 0) {
            const data = JSON.parse(saved);
            const track = playlist.find(t => t.id === data.id);
            if (track) {
                currentIndex = data.index;
                document.getElementById('player').style.display = 'block';
                document.getElementById('thumbnail').src = track.thumbnail;
                document.getElementById('title').textContent = track.title;
                document.getElementById('artist').textContent = track.artist;
            }
        }
    } catch(e) {}
}

// ============ BAŞLANGIÇ ============

// Ses seviyesini ayarla
const savedVol = localStorage.getItem('volume_v10') || 70;
document.getElementById('volSlider').value = savedVol;

// CSS animasyonları ekle
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        50% { transform: translateX(10px); }
        75% { transform: translateX(-5px); }
    }
    @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(styleSheet);

updateUI();
console.log('✅ v10.0 hazır - Basit ve çalışan');

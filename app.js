// YT MUSIC v13.0 - Sürekli Dinleme + Yerel Dosya + YouTube
console.log('🎵 YT Music v13.0');

// ============ GLOBAL STATE ============
let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let localAudio = document.getElementById('localAudio');
let isPlaying = false;
let currentSource = null; // 'youtube' | 'local'
let searchResults = [];
let currentSearchIndex = -1;
let localFiles = []; // Yerel dosyalar
let continuousListening = false;
let recognition = null;
let restartRecognition = true;

// Yükle
try { playlist = JSON.parse(localStorage.getItem('playlist_v13') || '[]'); } catch(e) { playlist = []; }
try { localFiles = JSON.parse(localStorage.getItem('localFiles_v13') || '[]'); } catch(e) { localFiles = []; }

function onYouTubeIframeAPIReady() {
    console.log('✅ YouTube API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ SÜREKLİ DİNLEME ============

function toggleContinuousListening() {
    if (continuousListening) {
        stopContinuousListening();
    } else {
        startContinuousListening();
    }
}

async function startContinuousListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SR) {
        alert('Tarayıcınız Speech Recognition desteklemiyor. Chrome kullanın.');
        return;
    }
    
    // Mikrofon izni iste
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(e) {
        alert('Mikrofon izni verilmedi!');
        return;
    }
    
    continuousListening = true;
    updateMicUI();
    
    startRecognition();
}

function startRecognition() {
    if (!continuousListening) return;
    
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        const text = last[0].transcript.toLowerCase().trim();
        
        console.log('🎤 Algılandı:', text);
        processVoiceCommand(text);
    };
    
    recognition.onerror = (event) => {
        console.error('Ses hatası:', event.error);
        
        if (event.error === 'no-speech' || event.error === 'aborted') {
            // Sessizce yeniden başlat
        } else {
            updateMicStatus('❌ Hata: ' + event.error);
        }
    };
    
    recognition.onend = () => {
        if (continuousListening && restartRecognition) {
            setTimeout(() => startRecognition(), 300);
        }
    };
    
    try {
        recognition.start();
        updateMicStatus('🎤 Dinliyor...');
    } catch(e) {
        console.error('Başlatma hatası:', e);
    }
}

function stopContinuousListening() {
    continuousListening = false;
    restartRecognition = false;
    
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
    }
    
    updateMicUI();
    updateMicStatus('');
}

function updateMicUI() {
    const statusEl = document.getElementById('micStatus');
    const btnEl = document.getElementById('btnMicToggle');
    
    if (continuousListening) {
        statusEl.classList.remove('off');
        statusEl.querySelector('.mic-text').textContent = '🎤 Sürekli Dinleme: AÇIK';
        btnEl.textContent = 'Kapat';
    } else {
        statusEl.classList.add('off');
        statusEl.querySelector('.mic-text').textContent = '🎤 Sürekli Dinleme: KAPALI';
        btnEl.textContent = 'Aç';
    }
}

function updateMicStatus(msg) {
    if (continuousListening) {
        const statusEl = document.getElementById('micStatus');
        statusEl.querySelector('.mic-text').textContent = '🎤 ' + (msg || 'Dinliyor...');
    }
}

// ============ SESLİ KOMUT İŞLEME ============

function processVoiceCommand(text) {
    updateMicStatus('🎤 Algılandı: "' + text + '"');
    
    // YouTube komutları
    if (text.includes('youtube') || text.includes('yutup') || text.includes('yu tup')) {
        const query = text
            .replace(/youtube|yutup|yu tup/gi, '')
            .replace(/ara|bul|çal|aç/gi, '')
            .trim();
        
        if (query) {
            updateMicStatus('🔍 YouTube: ' + query);
            document.getElementById('searchInput').value = query;
            searchYouTube();
        }
        return;
    }
    
    // Yerel/telefon komutları
    if (text.includes('telefonda') || text.includes('yerel') || text.includes('lokal') || 
        text.includes('dosya') || text.includes('telefon')) {
        const query = text
            .replace(/telefonda|yerel|lokal|dosya|telefon/gi, '')
            .replace(/ara|bul|çal|aç/gi, '')
            .trim();
        
        if (query) {
            updateMicStatus('📱 Yerel: ' + query);
            document.getElementById('searchInput').value = query;
            searchLocal();
        }
        return;
    }
    
    // Kontrol komutları
    if (text.includes('dur') || text.includes('durdur') || text.includes('stop') || text.includes('pause')) {
        pauseTrack();
        updateMicStatus('⏸️ Duraklatıldı');
        return;
    }
    
    if (text.includes('devam') || text.includes('başlat') || text.includes('oynat') || text.includes('play') || text.includes('çal')) {
        resumeTrack();
        updateMicStatus('▶️ Devam ediyor');
        return;
    }
    
    if (text.includes('sonraki') || text.includes('ileri') || text.includes('next') || text.includes('atla')) {
        nextTrack();
        updateMicStatus('⏭️ Sonraki');
        return;
    }
    
    if (text.includes('önceki') || text.includes('geri') || text.includes('prev')) {
        prevTrack();
        updateMicStatus('⏮️ Önceki');
        return;
    }
    
    // Varsayılan: YouTube'da ara
    if (text.length > 2) {
        updateMicStatus('🔍 Aranıyor: ' + text);
        document.getElementById('searchInput').value = text;
        searchYouTube();
    }
}

// ============ YOUTUBE ARAMA ============

async function searchYouTube() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    const resultsBox = document.getElementById('resultsBox');
    const resultsList = document.getElementById('resultsList');
    
    document.getElementById('resultsTitle').innerHTML = '🔍 YouTube Sonuçları (<span id="resultCount">0</span>)';
    resultsBox.style.display = 'block';
    resultsList.innerHTML = '<div class="loading-state"><div class="spinner"></div>YouTube\'da aranıyor...</div>';
    
    searchResults = [];
    currentSearchIndex = -1;
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        searchResults = data.results.map(item => ({
            videoId: item.videoId,
            title: item.title,
            author: item.channelTitle,
            thumbnail: item.thumbnailUrl,
            source: 'youtube'
        }));
        
        document.getElementById('resultCount').textContent = searchResults.length;
        displayResults();
        
    } catch (error) {
        resultsList.innerHTML = `<div class="empty-state">❌ ${error.message}</div>`;
    }
}

// ============ YEREL DOSYA ============

function pickFolder() {
    document.getElementById('folderInput').click();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('folderInput').addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => 
            f.type.startsWith('audio/') || 
            f.name.match(/\.(mp3|m4a|wav|ogg|flac|aac|wma)$/i)
        );
        
        if (files.length === 0) {
            alert('Klasörde ses dosyası bulunamadı!');
            return;
        }
        
        localFiles = files.map(f => ({
            name: f.name.replace(/\.[^.]+$/, ''),
            fullName: f.name,
            size: f.size,
            type: f.type,
            file: f
        }));
        
        localStorage.setItem('localFiles_v13', JSON.stringify(localFiles.map(f => ({
            name: f.name,
            fullName: f.fullName,
            size: f.size,
            type: f.type
            // File objesi localStorage'a kaydedilemez
        }))));
        
        updateMicStatus('📂 ' + files.length + ' dosya yüklendi');
        alert(files.length + ' şarkı yüklendi!');
        
        // Dosyaları tekrar yükle (File objelerini koru)
        restoreLocalFiles(files);
    });
});

function restoreLocalFiles(fileList) {
    if (fileList) {
        localFiles = fileList.map(f => ({
            name: f.name.replace(/\.[^.]+$/, ''),
            fullName: f.name,
            size: f.size,
            type: f.type,
            file: f
        }));
    }
}

function searchLocal() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    
    const resultsBox = document.getElementById('resultsBox');
    const resultsList = document.getElementById('resultsList');
    
    document.getElementById('resultsTitle').innerHTML = '📱 Telefon Sonuçları (<span id="resultCount">0</span>)';
    resultsBox.style.display = 'block';
    
    if (localFiles.length === 0) {
        resultsList.innerHTML = `
            <div class="empty-state">
                <p>📂 Henüz klasör seçilmedi</p>
                <button onclick="pickFolder()" style="margin-top:10px;background:#0066ff;color:#fff;border:none;padding:10px 20px;border-radius:20px;cursor:pointer">📂 Klasör Seç</button>
            </div>`;
        return;
    }
    
    if (!query) {
        searchResults = localFiles.map(f => ({
            name: f.name,
            file: f,
            source: 'local'
        }));
    } else {
        searchResults = localFiles
            .filter(f => f.name.toLowerCase().includes(query))
            .map(f => ({
                name: f.name,
                file: f,
                source: 'local'
            }));
    }
    
    document.getElementById('resultCount').textContent = searchResults.length;
    displayLocalResults();
}

function displayResults() {
    const resultsList = document.getElementById('resultsList');
    
    if (searchResults.length === 0) {
        resultsList.innerHTML = '<div class="empty-state">😔 Sonuç bulunamadı</div>';
        return;
    }
    
    resultsList.innerHTML = searchResults.map((item, i) => `
        <div class="result-item youtube" id="result-${i}" onclick="playSearchResult(${i})">
            <img src="${item.thumbnail}" onerror="this.style.display='none'" loading="lazy">
            <div class="result-info">
                <strong>${escapeHtml(item.title)} <span class="badge badge-yt">YT</span></strong>
                <small>${escapeHtml(item.author)}</small>
            </div>
        </div>
    `).join('');
    
    if (searchResults.length > 0) {
        setTimeout(() => playSearchResult(0), 300);
    }
}

function displayLocalResults() {
    const resultsList = document.getElementById('resultsList');
    
    if (searchResults.length === 0) {
        resultsList.innerHTML = '<div class="empty-state">😔 Dosya bulunamadı</div>';
        return;
    }
    
    resultsList.innerHTML = searchResults.map((item, i) => `
        <div class="result-item local" id="result-${i}" onclick="playSearchResult(${i})">
            <div class="result-icon local">🎵</div>
            <div class="result-info">
                <strong>${escapeHtml(item.name)} <span class="badge badge-local">📱</span></strong>
                <small>Telefon</small>
            </div>
        </div>
    `).join('');
    
    if (searchResults.length > 0) {
        setTimeout(() => playSearchResult(0), 300);
    }
}

function playSearchResult(index) {
    if (index < 0 || index >= searchResults.length) return;
    
    currentSearchIndex = index;
    const item = searchResults[index];
    
    document.querySelectorAll('.result-item').forEach((el, i) => {
        el.classList.toggle('playing', i === index);
    });
    
    if (item.source === 'youtube') {
        const track = {
            id: item.videoId,
            title: item.title,
            artist: item.author,
            thumbnail: item.thumbnail,
            source: 'youtube'
        };
        addToPlaylist(track);
        playYouTubeTrack(track);
    } else if (item.source === 'local') {
        const track = {
            id: 'local_' + item.name,
            title: item.name,
            artist: 'Telefon',
            thumbnail: '',
            source: 'local',
            file: item.file
        };
        addToPlaylist(track);
        playLocalTrack(track);
    }
}

function closeResults() {
    document.getElementById('resultsBox').style.display = 'none';
}

// ============ OYNATMA ============

function playFromInput() {
    const input = document.getElementById('searchInput').value.trim();
    if (!input) return;
    
    const videoId = extractId(input);
    if (videoId) {
        const track = {
            id: videoId,
            title: 'Yükleniyor...',
            artist: 'YouTube',
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            source: 'youtube'
        };
        addToPlaylist(track);
        playYouTubeTrack(track);
        document.getElementById('searchInput').value = '';
    } else if (!input.includes('youtube.com')) {
        searchYouTube();
    }
}

async function pasteAndPlay() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('searchInput').value = text;
        const videoId = extractId(text);
        if (videoId) {
            const track = {
                id: videoId,
                title: 'Yükleniyor...',
                artist: 'YouTube',
                thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                source: 'youtube'
            };
            addToPlaylist(track);
            playYouTubeTrack(track);
            document.getElementById('searchInput').value = '';
        }
    } catch(e) {}
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

function addToPlaylist(track) {
    const existing = playlist.findIndex(t => t.id === track.id);
    if (existing >= 0) {
        currentIndex = existing;
    } else {
        playlist.push(track);
        savePlaylist();
        currentIndex = playlist.length - 1;
    }
    updateUI();
}

function playYouTubeTrack(track) {
    stopLocalAudio();
    currentSource = 'youtube';
    
    document.getElementById('player').style.display = 'block';
    document.getElementById('thumbnail').src = track.thumbnail;
    document.getElementById('title').textContent = track.title;
    document.getElementById('artist').textContent = track.artist;
    document.getElementById('source').innerHTML = '<span class="badge badge-yt">🔗 YouTube</span>';
    
    destroyYouTubePlayer();
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
                        e.target.setVolume(localStorage.getItem('volume_v13') || 70);
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
                    onError: () => nextTrack()
                }
            });
        } catch(e) {}
    }, 100);
    
    // oEmbed bilgi
    fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${track.id}&format=json`)
        .then(r => r.json())
        .then(data => {
            track.title = data.title.replace(' - YouTube', '').trim();
            track.artist = data.author_name || 'YouTube';
            document.getElementById('title').textContent = track.title;
            document.getElementById('artist').textContent = track.artist;
            savePlaylist();
            updateUI();
        }).catch(() => {});
    
    saveSession(track);
    document.getElementById('player').scrollIntoView({ behavior: 'smooth' });
}

function playLocalTrack(track) {
    stopYouTubePlayer();
    stopLocalAudio();
    currentSource = 'local';
    
    document.getElementById('player').style.display = 'block';
    document.getElementById('thumbnail').src = '';
    document.getElementById('title').textContent = track.title;
    document.getElementById('artist').textContent = track.artist;
    document.getElementById('source').innerHTML = '<span class="badge badge-local">📱 Telefon</span>';
    
    if (track.file && track.file.file) {
        const url = URL.createObjectURL(track.file.file);
        localAudio.src = url;
        localAudio.volume = (localStorage.getItem('volume_v13') || 70) / 100;
        localAudio.play();
        isPlaying = true;
        document.getElementById('playBtn').textContent = '⏸️';
        
        localAudio.onended = () => nextTrack();
    }
    
    saveSession(track);
    document.getElementById('player').scrollIntoView({ behavior: 'smooth' });
}

function stopYouTubePlayer() {
    if (ytPlayer) {
        try { ytPlayer.stopVideo(); ytPlayer.destroy(); } catch(e) {}
        ytPlayer = null;
    }
}

function stopLocalAudio() {
    try { localAudio.pause(); localAudio.src = ''; } catch(e) {}
}

function destroyYouTubePlayer() {
    stopYouTubePlayer();
    isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️';
}

function togglePlay() {
    if (currentSource === 'youtube') {
        if (!ytPlayer) {
            if (currentIndex >=

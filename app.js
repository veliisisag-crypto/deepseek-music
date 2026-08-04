// YT MUSIC v14.0 - Bas-Konuş Stabil
console.log('🎵 YT Music v14.0');

let playlist = [];
let currentIndex = -1;
let ytPlayer = null;
let localAudio = document.getElementById('localAudio');
let isPlaying = false;
let currentSource = null;
let searchResults = [];
let localFiles = [];

// YÜKLE
try { playlist = JSON.parse(localStorage.getItem('playlist_v14') || '[]'); } catch(e) { playlist = []; }

// Klasör bilgisini hatırla
const savedFolderName = localStorage.getItem('folderName_v14');
if (savedFolderName) {
    document.getElementById('folderInfo').textContent = savedFolderName;
    document.getElementById('folderBtn').style.borderColor = '#0066ff';
    document.getElementById('folderBtn').style.color = '#0066ff';
}

// Önceki dosya listesini yükle (isimler)
try { 
    const saved = localStorage.getItem('localFiles_v14');
    if (saved) localFiles = JSON.parse(saved);
} catch(e) { localFiles = []; }

function onYouTubeIframeAPIReady() {
    console.log('✅ YouTube API hazır');
    restoreSession();
    updateUI();
}
if (window.YT && YT.Player) onYouTubeIframeAPIReady();

// ============ KLASÖR SEÇME ============

function pickFolder() {
    document.getElementById('folderInput').click();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('folderInput').addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => 
            f.type.startsWith('audio/') || f.name.match(/\.(mp3|m4a|wav|ogg|flac|aac|wma|opus)$/i)
        );
        
        if (files.length === 0) {
            showStatus('❌ Ses dosyası bulunamadı!');
            return;
        }
        
        localFiles = files.map(f => ({
            name: f.name.replace(/\.[^.]+$/, ''),
            fullName: f.name,
            size: f.size,
            type: f.type,
            file: f
        }));
        
        // Klasör adını hatırla
        const folderName = files[0].webkitRelativePath.split('/')[0] || 'Klasör';
        localStorage.setItem('folderName_v14', folderName);
        localStorage.setItem('localFiles_v14', JSON.stringify(localFiles.map(f => ({
            name: f.name, fullName: f.fullName, size: f.size, type: f.type
        }))));
        
        document.getElementById('folderInfo').textContent = folderName + ' (' + files.length + ' şarkı)';
        document.getElementById('folderBtn').style.borderColor = '#0066ff';
        document.getElementById('folderBtn').style.color = '#0066ff';
        
        showStatus('✅ ' + files.length + ' şarkı yüklendi');
    });
});

// ============ SESLİ ARAMA (BAS-KONUŞ) ============

let voiceRecognition = null;

function startVoiceSearch() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SR) {
        alert('Tarayıcınız sesli aramayı desteklemiyor. Chrome kullanın.');
        return;
    }
    
    if (voiceRecognition) {
        voiceRecognition.stop();
        voiceRecognition = null;
        document.getElementById('micBtn').classList.remove('listening');
        showStatus('');
        return;
    }
    
    voiceRecognition = new SR();
    voiceRecognition.lang = 'tr-TR';
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 1;
    
    document.getElementById('micBtn').classList.add('listening');
    document.getElementById('searchInput').placeholder = '🎤 Dinliyorum...';
    showStatus('🎤 Konuşun...');
    
    voiceRecognition.start();
    
    voiceRecognition.onresult = (event) => {
        const text = event.results[0][0].transcript.trim();
        document.getElementById('searchInput').value = text;
        showStatus('✅ Algılandı: "' + text + '"');
        
        // Akıllı yönlendirme
        if (text.toLowerCase().includes('youtube') || text.toLowerCase().includes('yutup')) {
            const q = text.replace(/youtube|yutup/gi, '').trim();
            if (q) { document.getElementById('searchInput').value = q; searchYouTube(); }
        } else if (text.toLowerCase().includes('telefon') || text.toLowerCase().includes('yerel') || text.toLowerCase().includes('dosya')) {
            const q = text.replace(/telefon|yerel|dosya/gi, '').trim();
            if (q) { document.getElementById('searchInput').value = q; searchLocal(); }
        } else if (text.toLowerCase().includes('dur') || text.toLowerCase().includes('durdur')) {
            pauseTrack();
        } else if (text.toLowerCase().includes('devam') || text.toLowerCase().includes('başlat')) {
            resumeTrack();
        } else if (text.toLowerCase().includes('sonraki') || text.toLowerCase().includes('atla')) {
            nextTrack();
        } else if (text.toLowerCase().includes('önceki') || text.toLowerCase().includes('geri')) {
            prevTrack();
        } else {
            // Varsayılan YouTube ara
            searchYouTube();
        }
    };
    
    voiceRecognition.onerror = (event) => {
        showStatus('❌ ' + (event.error === 'no-speech' ? 'Ses algılanamadı' : event.error));
    };
    
    voiceRecognition.onend = () => {
        document.getElementById('micBtn').classList.remove('listening');
        document.getElementById('searchInput').placeholder = 'Şarkı ara veya link yapıştır...';
        voiceRecognition = null;
    };
}

// ============ YOUTUBE ARAMA ============

async function searchYouTube() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    showResults('🔍 YouTube: ' + query);
    document.getElementById('resultsList').innerHTML = '<div class="loading-state"><div class="spinner"></div>YouTube aranıyor...</div>';
    
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
                <button onclick="pickFolder()" style="margin-top:8px;background:#0066ff;color:#fff;border:none;padding:8px 16px;border-radius:15px;cursor:pointer;font-size:12px">Klasör Seç</button>
            </div>`;
        return;
    }
    
    searchResults = localFiles
        .filter(f => !query || f.name.toLowerCase().includes(query))
        .map(f => ({
            type: 'local',
            name: f.name,
            file: f
        }));
    
    displayLocalResults();
}

// ============ SONUÇ GÖSTERİMİ ============

function showResults(title) {
    document.getElementById('resultsTitle').innerHTML = title + ' (<span id="resultCount">0</span>)';
    document.getElementById('resultsBox').style.display = 'block';
}

function displayResults() {
    document.getElementById('resultCount').textContent = searchResults.length;
    const list = document.getElementById('resultsList');
    
    if (!searchResults.length) {
        list.innerHTML = '<div class="empty-state">😔 Sonuç bulunamadı</div>';
        return;
    }
    
    list.innerHTML = searchResults.map((item, i) => `
        <div class="result-item youtube" onclick="playResult(${i})">
            <img src="${item.thumbnail}" onerror="this.style.display='none'">
            <div class="result-info">
                <strong>${esc(item.title)} <span class="badge badge-yt">YT</span></strong>
                <small>${esc(item.artist)}</small>
            </div>
        </div>
    `).join('');
    
    // Otomatik ilk sonucu oynat
    if (searchResults.length > 0) setTimeout(() => playResult(0), 400);
}

function displayLocalResults() {
    document.getElementById('resultCount').textContent = searchResults.length;
    const list = document.getElementById('resultsList');
    
    if (!searchResults.length) {
        list.innerHTML = '<div class="empty-state">😔 Dosya bulunamadı</div>';
        return;
    }
    
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
        const track = { id: item.videoId, title: item.title, artist: item.artist, thumbnail: item.thumbnail, source: 'youtube' };
        addAndPlay(track);
    } else {
        const track = { id: 'local_' + item.name, title: item.name, artist: 'Telefon', thumbnail: '', source: 'local', file: item.file };
        addAndPlay(track);
    }
}

function closeResults() { document.getElementById('resultsBox').style.display = 'none'; }

// ============ LİNK İŞLEMLERİ ============

async function pasteAndPlay() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('searchInput').value = text;
        const videoId = extractId(text);
        if (videoId) {
            const track = { id: videoId, title: 'Yükleniyor...', artist: 'YouTube', thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, source: 'youtube' };
            addAndPlay(track);
            document.getElementById('searchInput').value = '';
        } else {
            showStatus('📋 Panoda YouTube linki yok');
        }
    } catch(e) { showStatus('❌ Panoya erişilemedi'); }
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
                    onReady: (e) => { e.target.setVolume(localStorage.getItem('vol_v14') || 70); e.target.unMute(); e.target.playVideo(); },
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
            
    } else if (track.source === 'local' && track.file && track.file.file) {
        const url = URL.createObjectURL(track.file.file);
        localAudio.src = url;
        localAudio.volume = (localStorage.getItem('vol_v14') || 70) / 100;
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
    localAudio.volume = val / 100;
    localStorage.setItem('vol_v14', val);
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
function savePlaylist() { try { localStorage.setItem('playlist_v14', JSON.stringify(playlist)); } catch(e) {} }
function saveSession(t) { try { localStorage.setItem('session_v14', JSON.stringify({id:t.id, index:currentIndex})); } catch(e) {} }
function restoreSession() {
    try {
        const s = localStorage.getItem('session_v14');
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

document.getElementById('volSlider').value = localStorage.getItem('vol_v14') || 70;
updateUI();
console.log('✅ v14.0 hazır - Bas-Konuş Stabil');

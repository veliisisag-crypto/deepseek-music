// YOUTUBE MUSIC PWA v4.0
console.log('🎵 YouTube Music PWA v4.0 başlatılıyor...');

class YouTubeMusicPlayer {
    constructor() {
        this.playlist = JSON.parse(localStorage.getItem('playlist_v4')) || [];
        this.currentIndex = -1;
        this.player = null;
        this.isPlaying = false;
        this.init();
    }

    init() {
        console.log('✅ Player v4.0 hazır');
        this.setupEventListeners();
        this.renderPlaylist();
        this.restoreLastSession();
    }

    setupEventListeners() {
        // Oynat butonu
        document.getElementById('playBtn').addEventListener('click', () => {
            const url = document.getElementById('urlInput').value.trim();
            if (url) {
                this.addVideoFromUrl(url);
            }
        });

        // Enter tuşu
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('playBtn').click();
            }
        });

        // Kontrol butonları
        document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('prevBtn').addEventListener('click', () => this.playPrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.playNext());

        // Ses kontrolü
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        const savedVolume = localStorage.getItem('volume_v4') || 70;
        
        volumeSlider.value = savedVolume;
        volumeValue.textContent = `${savedVolume}%`;

        volumeSlider.addEventListener('input', (e) => {
            const vol = e.target.value;
            if (this.player && this.player.setVolume) {
                this.player.setVolume(vol);
            }
            volumeValue.textContent = `${vol}%`;
            localStorage.setItem('volume_v4', vol);
        });

        // Listeyi temizle
        document.getElementById('clearPlaylist').addEventListener('click', () => {
            if (this.playlist.length === 0) return;
            if (confirm('Çalma listesini temizlemek istediğinize emin misiniz?')) {
                this.stopPlayback();
                this.playlist = [];
                this.currentIndex = -1;
                this.savePlaylist();
                this.renderPlaylist();
            }
        });
    }

    extractVideoId(input) {
        if (!input) return null;
        
        // Direkt video ID
        if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
            return input;
        }
        
        // YouTube URL'leri
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
            /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
            /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }

    addVideoFromUrl(url) {
        const videoId = this.extractVideoId(url);
        
        if (!videoId) {
            alert('❌ Geçersiz YouTube linki!\n\nÖrnek: https://www.youtube.com/watch?v=dQw4w9WgXcQ\n\nveya direkt video ID: dQw4w9WgXcQ');
            return;
        }

        this.showLoading('Video ekleniyor...');
        
        const track = {
            id: videoId,
            title: `Video: ${videoId}`,
            artist: 'YouTube',
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            addedAt: Date.now()
        };

        // Duplicate kontrolü
        if (this.playlist.find(t => t.id === videoId)) {
            this.hideLoading();
            this.playTrack(track);
            document.getElementById('urlInput').value = '';
            return;
        }

        this.addToPlaylist(track);
        this.playTrack(track);
        document.getElementById('urlInput').value = '';
    }

    addToPlaylist(track) {
        this.playlist.push(track);
        this.savePlaylist();
        this.renderPlaylist();
    }

    playTrack(track) {
        this.currentIndex = this.playlist.findIndex(t => t.id === track.id);
        this.loadVideo(track);
    }

    loadVideo(track) {
        this.showLoading('Yükleniyor...');
        this.updateStatus('Yükleniyor: ' + track.id);
        
        // Eski player'ı temizle
        this.destroyPlayer();
        
        // UI'ı güncelle
        document.getElementById('playerContainer').style.display = 'block';
        document.getElementById('title').textContent = track.title;
        document.getElementById('artist').textContent = track.artist;
        document.getElementById('thumbnail').src = track.thumbnail;

        // Yeni player oluştur
        this.createPlayer(track.id);
        
        this.renderPlaylist();
        this.saveLastSession(track);
    }

    createPlayer(videoId) {
        const container = document.getElementById('yt-player');
        
        this.player = new YT.Player('yt-player', {
            height: '1',
            width: '1',
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                enablejsapi: 1,
                fs: 0,
                iv_load_policy: 3,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
                origin: window.location.origin
            },
            events: {
                onReady: (event) => {
                    console.log('✅ Player hazır');
                    event.target.setVolume(localStorage.getItem('volume_v4') || 70);
                    event.target.playVideo();
                    
                    // Video bilgilerini al
                    setTimeout(() => {
                        try {
                            const videoData = event.target.getVideoData();
                            if (videoData && videoData.title) {
                                const track = this.playlist[this.currentIndex];
                                if (track) {
                                    track.title = videoData.title;
                                    track.artist = videoData.author || 'YouTube';
                                    document.getElementById('title').textContent = track.title;
                                    document.getElementById('artist').textContent = track.artist;
                                    this.savePlaylist();
                                    this.renderPlaylist();
                                }
                            }
                        } catch (e) {
                            console.log('Video bilgisi alınamadı');
                        }
                        this.hideLoading();
                    }, 1000);
                    
                    this.updateStatus('▶️ Oynatılıyor');
                },
                onStateChange: (event) => {
                    switch(event.data) {
                        case YT.PlayerState.ENDED:
                            console.log('⏹️ Bitti');
                            this.updateStatus('⏹️ Bitti');
                            this.playNext();
                            break;
                        case YT.PlayerState.PLAYING:
                            this.isPlaying = true;
                            document.getElementById('playPauseBtn').textContent = '⏸️';
                            this.updateStatus('▶️ Oynatılıyor');
                            break;
                        case YT.PlayerState.PAUSED:
                            this.isPlaying = false;
                            document.getElementById('playPauseBtn').textContent = '▶️';
                            this.updateStatus('⏸️ Duraklatıldı');
                            break;
                        case YT.PlayerState.BUFFERING:
                            this.updateStatus('🔄 Yükleniyor...');
                            break;
                    }
                },
                onError: (event) => {
                    console.error('❌ Hata:', event.data);
                    this.hideLoading();
                    
                    let message = 'Video çalınamadı. ';
                    switch(event.data) {
                        case 2: message += 'Geçersiz ID.'; break;
                        case 5: message += 'HTML5 hatası.'; break;
                        case 100: message += 'Video bulunamadı.'; break;
                        case 101: message += 'Embed izni yok.'; break;
                        case 150: message += 'Embed izni yok.'; break;
                    }
                    
                    this.updateStatus('❌ ' + message);
                    alert(message + '\n\nTelif hakkı veya embed kısıtlaması olabilir.');
                    this.playNext();
                }
            }
        });
    }

    destroyPlayer() {
        if (this.player) {
            try {
                this.player.stopVideo();
                this.player.destroy();
            } catch (e) {
                console.log('Destroy hatası:', e);
            }
            this.player = null;
        }
        
        const container = document.getElementById('yt-player');
        if (container) {
            container.innerHTML = '';
            // Yeniden oluştur
            const newDiv = document.createElement('div');
            newDiv.id = 'yt-player';
            container.appendChild(newDiv);
        }
        
        this.isPlaying = false;
        document.getElementById('playPauseBtn').textContent = '▶️';
    }

    stopPlayback() {
        this.destroyPlayer();
        document.getElementById('playerContainer').style.display = 'none';
        this.currentIndex = -1;
        this.updateStatus('Hazır');
        localStorage.removeItem('lastSession_v4');
    }

    togglePlayPause() {
        if (!this.player) {
            if (this.currentIndex >= 0 && this.playlist[this.currentIndex]) {
                this.loadVideo(this.playlist[this.currentIndex]);
            }
            return;
        }

        try {
            const state = this.player.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
                this.player.pauseVideo();
            } else {
                this.player.playVideo();
            }
        } catch (e) {
            console.error('Toggle hatası:', e);
        }
    }

    playNext() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            this.loadVideo(this.playlist[this.currentIndex]);
        } else {
            this.stopPlayback();
            this.updateStatus('📋 Liste sonu');
        }
    }

    playPrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.loadVideo(this.playlist[this.currentIndex]);
        }
    }

    renderPlaylist() {
        const playlistElement = document.getElementById('playlistItems');
        const countElement = document.getElementById('playlistCount');
        
        playlistElement.innerHTML = '';
        countElement.textContent = `(${this.playlist.length})`;
        
        if (this.playlist.length === 0) {
            playlistElement.innerHTML = `
                <div style="text-align: center; color: #888; padding: 30px 20px;">
                    <p style="font-size: 40px; margin-bottom: 15px;">🎵</p>
                    <p>Liste boş</p>
                    <p style="font-size: 13px; margin-top: 10px;">YouTube linki yapıştırın</p>
                </div>`;
            document.getElementById('prevBtn').disabled = true;
            document.getElementById('nextBtn').disabled = true;
            return;
        }
        
        this.playlist.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            if (index === this.currentIndex) li.classList.add('active');
            
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                    <img src="${track.thumbnail}" width="45" height="45" 
                         style="border-radius: 8px; object-fit: cover;"
                         onerror="this.style.display='none'">
                    <div style="min-width: 0;">
                        <strong style="display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px;">${track.title}</strong>
                        <small style="color: #aaa; font-size: 12px;">${track.artist}</small>
                    </div>
                </div>
                <button class="remove-btn" onclick="event.stopPropagation(); window.player.removeFromPlaylist(${index})">✕</button>
            `;
            
            li.addEventListener('click', () => this.loadVideo(track));
            playlistElement.appendChild(li);
        });
        
        document.getElementById('prevBtn').disabled = this.currentIndex <= 0;
        document.getElementById('nextBtn').disabled = this.currentIndex >= this.playlist.length - 1;
    }

    removeFromPlaylist(index) {
        if (this.currentIndex === index) {
            this.stopPlayback();
        } else if (this.currentIndex > index) {
            this.currentIndex--;
        }
        
        this.playlist.splice(index, 1);
        this.savePlaylist();
        this.renderPlaylist();
    }

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }

    savePlaylist() {
        localStorage.setItem('playlist_v4', JSON.stringify(this.playlist));
    }

    saveLastSession(track) {
        localStorage.setItem('lastSession_v4', JSON.stringify({
            track: track,
            index: this.currentIndex,
            timestamp: Date.now()
        }));
    }

    restoreLastSession() {
        const lastSession = JSON.parse(localStorage.getItem('lastSession_v4'));
        if (lastSession && this.playlist.length > 0) {
            const track = this.playlist.find(t => t.id === lastSession.track.id);
            if (track) {
                document.getElementById('playerContainer').style.display = 'block';
                document.getElementById('title').textContent = track.title;
                document.getElementById('artist').textContent = track.artist;
                document.getElementById('thumbnail').src = track.thumbnail;
                this.updateStatus('🔄 Son oturum geri yüklendi');
                this.currentIndex = lastSession.index;
                this.renderPlaylist();
            }
        }
    }

    showLoading(text) {
        document.getElementById('loadingText').textContent = text || 'Yükleniyor...';
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Global değişken
let player;

// YouTube API hazır olduğunda başlat
function onYouTubeIframeAPIReady() {
    console.log('✅ YouTube IFrame API hazır');
    player = new YouTubeMusicPlayer();
}

// YouTube API geç yüklenirse
window.addEventListener('load', () => {
    if (window.YT && YT.Player) {
        console.log('✅ YouTube API zaten yüklü');
        player = new YouTubeMusicPlayer();
    }
});

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ SW v4.0 kaydedildi'))
        .catch(err => console.log('SW:', err));
}

console.log('🎵 YouTube Music PWA v4.0 yüklendi');

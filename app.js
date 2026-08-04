class YouTubeMusicPlayer {
    constructor() {
        this.playlist = JSON.parse(localStorage.getItem('playlist')) || [];
        this.currentIndex = -1;
        this.ytPlayer = null;
        this.isPlaying = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderPlaylist();
        this.loadYouTubeAPI();
    }

    loadYouTubeAPI() {
        // YouTube API yüklü mü kontrol et
        if (window.YT && YT.Player) {
            console.log('✅ YouTube API zaten yüklü');
            return;
        }
        
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = () => {
            console.log('✅ YouTube API hazır');
        };
    }

    setupEventListeners() {
        // Ara butonu
        document.getElementById('searchBtn').addEventListener('click', () => {
            const query = document.getElementById('searchInput').value.trim();
            if (query) {
                // YouTube'da ara
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
                document.getElementById('searchInput').value = '';
                alert('🎵 YouTube açıldı!\n\n1. Beğendiğiniz videonun linkini kopyalayın\n2. Buraya geri gelin\n3. "📋 Yapıştır" butonuna tıklayın');
            }
        });

        // Enter ile ara
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('searchBtn').click();
            }
        });

        // Yapıştır butonu
        document.getElementById('pasteBtn').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                document.getElementById('searchInput').value = text;
                
                const videoId = this.extractVideoId(text);
                if (videoId) {
                    await this.addVideo(videoId);
                    document.getElementById('searchInput').value = '';
                } else {
                    alert('❌ Geçerli bir YouTube linki değil!\n\nÖrnek: https://www.youtube.com/watch?v=VIDEO_ID');
                }
            } catch (err) {
                alert('📋 Panodan yapıştırma başarısız.\n\nLinki manuel olarak yapıştırıp Enter tuşuna basın.');
            }
        });

        // Oynatma kontrolleri
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prevBtn').addEventListener('click', () => this.playPrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.playNext());

        // Ses kontrolü
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        const savedVolume = localStorage.getItem('volume') || 70;
        volumeSlider.value = savedVolume;
        volumeValue.textContent = `${savedVolume}%`;

        volumeSlider.addEventListener('input', (e) => {
            const vol = e.target.value;
            if (this.ytPlayer && this.ytPlayer.setVolume) {
                this.ytPlayer.setVolume(vol);
            }
            volumeValue.textContent = `${vol}%`;
            localStorage.setItem('volume', vol);
        });

        // Listeyi temizle
        document.getElementById('clearPlaylist').addEventListener('click', () => {
            if (this.playlist.length === 0) return;
            if (confirm('Çalma listesini temizlemek istediğinize emin misiniz?')) {
                this.stopPlayback();
                this.playlist = [];
                this.currentIndex = -1;
                localStorage.setItem('playlist', JSON.stringify(this.playlist));
                this.renderPlaylist();
            }
        });
    }

    extractVideoId(url) {
        if (!url) return null;
        
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        // Belki direkt video ID'si yapıştırılmıştır
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
            return url;
        }
        
        return null;
    }

    async addVideo(videoId) {
        this.showLoading('Video ekleniyor...');
        
        try {
            // Direkt video bilgisi oluştur (API'siz)
            const track = {
                id: videoId,
                title: 'Yükleniyor...',
                artist: 'YouTube',
                thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
            
            // Thumbnail'ı yükle ve kontrol et
            const img = new Image();
            img.src = track.thumbnail;
            
            img.onload = () => {
                // Thumbnail yüklendiyse video geçerli
                track.title = `YouTube Videosu (${videoId})`;
                this.addToPlaylist(track);
                this.playTrack(track);
                this.hideLoading();
            };
            
            img.onerror = () => {
                // Thumbnail yüklenemediyse bile ekle (bazı videolarda olmayabilir)
                track.thumbnail = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/><text fill="%23fff" x="50" y="60" text-anchor="middle" font-size="40">🎵</text></svg>';
                this.addToPlaylist(track);
                this.playTrack(track);
                this.hideLoading();
            };
            
            // 3 saniye timeout
            setTimeout(() => {
                if (document.getElementById('loading').style.display !== 'none') {
                    this.hideLoading();
                }
            }, 3000);
            
        } catch (error) {
            console.error('Ekleme hatası:', error);
            this.hideLoading();
            alert('Video eklenemedi. Lütfen farklı bir link deneyin.');
        }
    }

    addToPlaylist(track) {
        if (!this.playlist.find(t => t.id === track.id)) {
            this.playlist.push(track);
            localStorage.setItem('playlist', JSON.stringify(this.playlist));
            this.renderPlaylist();
        }
    }

    playTrack(track) {
        this.currentIndex = this.playlist.findIndex(t => t.id === track.id);
        this.loadTrack(track);
    }

    loadTrack(track) {
        this.showLoading('Şarkı yükleniyor...');
        
        // Önceki player'ı temizle
        this.destroyPlayer();
        
        // Bilgileri güncelle
        document.getElementById('title').textContent = track.title;
        document.getElementById('artist').textContent = track.artist;
        document.getElementById('thumbnail').src = track.thumbnail;
        document.getElementById('playerContainer').style.display = 'block';
        
        // Yeni player div'i oluştur
        const oldDiv = document.getElementById('yt-player');
        if (oldDiv) oldDiv.remove();
        
        const playerDiv = document.createElement('div');
        playerDiv.id = 'yt-player';
        playerDiv.style.position = 'fixed';
        playerDiv.style.bottom = '-9999px';
        playerDiv.style.right = '-9999px';
        playerDiv.style.width = '1px';
        playerDiv.style.height = '1px';
        document.body.appendChild(playerDiv);
        
        // YouTube player'ı oluştur
        try {
            this.ytPlayer = new YT.Player('yt-player', {
                height: '1',
                width: '1',
                videoId: track.id,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    enablejsapi: 1,
                    fs: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    rel: 0,
                    origin: window.location.origin
                },
                events: {
                    onReady: (event) => {
                        console.log('✅ Player hazır:', track.id);
                        event.target.setVolume(localStorage.getItem('volume') || 70);
                        event.target.playVideo();
                        this.hideLoading();
                        
                        // Başlığı güncelle
                        try {
                            const videoData = event.target.getVideoData();
                            if (videoData && videoData.title) {
                                track.title = videoData.title;
                                track.artist = videoData.author || 'YouTube';
                                document.getElementById('title').textContent = track.title;
                                document.getElementById('artist').textContent = track.artist;
                                this.savePlaylist();
                            }
                        } catch (e) {
                            console.log('Video data alınamadı:', e);
                        }
                    },
                    onStateChange: (event) => {
                        // YT.PlayerState.ENDED = 0
                        if (event.data === 0) {
                            console.log('⏹️ Video bitti');
                            this.playNext();
                        }
                        // YT.PlayerState.PLAYING = 1
                        else if (event.data === 1) {
                            this.isPlaying = true;
                            document.getElementById('playBtn').textContent = '⏸️';
                            this.hideLoading();
                        }
                        // YT.PlayerState.PAUSED = 2
                        else if (event.data === 2) {
                            this.isPlaying = false;
                            document.getElementById('playBtn').textContent = '▶️';
                        }
                    },
                    onError: (event) => {
                        console.error('❌ Player hatası:', event.data);
                        this.hideLoading();
                        
                        let errorMsg = 'Bu video çalınamıyor. ';
                        switch(event.data) {
                            case 2: errorMsg += 'Geçersiz video ID.'; break;
                            case 5: errorMsg += 'HTML5 player hatası.'; break;
                            case 100: errorMsg += 'Video bulunamadı veya silinmiş.'; break;
                            case 101:
                            case 150: errorMsg += 'Video sahibi embed etmeye izin vermiyor.'; break;
                            default: errorMsg += 'Bilinmeyen hata.';
                        }
                        
                        alert(errorMsg);
                        this.playNext();
                    }
                }
            });
        } catch (e) {
            console.error('Player oluşturma hatası:', e);
            this.hideLoading();
            alert('Player oluşturulamadı. Sayfayı yenileyip tekrar deneyin.');
        }
        
        this.updatePlaylistUI();
        this.saveLastPlayed(track);
    }

    destroyPlayer() {
        if (this.ytPlayer) {
            try {
                this.ytPlayer.stopVideo();
                this.ytPlayer.destroy();
            } catch (e) {
                console.log('Destroy hatası:', e);
            }
            this.ytPlayer = null;
        }
        
        const oldDiv = document.getElementById('yt-player');
        if (oldDiv) oldDiv.remove();
        
        this.isPlaying = false;
        document.getElementById('playBtn').textContent = '▶️';
    }

    stopPlayback() {
        this.destroyPlayer();
        document.getElementById('playerContainer').style.display = 'none';
        this.currentIndex = -1;
        localStorage.removeItem('lastPlayed');
    }

    togglePlay() {
        if (!this.ytPlayer || !this.ytPlayer.playVideo) {
            if (this.currentIndex >= 0 && this.playlist[this.currentIndex]) {
                this.loadTrack(this.playlist[this.currentIndex]);
            }
            return;
        }
        
        try {
            const state = this.ytPlayer.getPlayerState();
            if (state === 1) { // Playing
                this.ytPlayer.pauseVideo();
            } else {
                this.ytPlayer.playVideo();
            }
        } catch (e) {
            console.error('Toggle hatası:', e);
        }
    }

    playNext() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            this.loadTrack(this.playlist[this.currentIndex]);
        } else {
            this.stopPlayback();
            console.log('📋 Liste sonu');
        }
    }

    playPrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.loadTrack(this.playlist[this.currentIndex]);
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
                    <p><strong>Çalma listesi boş</strong></p>
                    <p style="margin-top: 10px; font-size: 14px;">
                        1. YouTube'dan müzik linki kopyalayın<br>
                        2. "📋 Yapıştır" butonuna tıklayın
                    </p>
                </div>`;
            return;
        }
        
        this.playlist.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            if (index === this.currentIndex) li.classList.add('active');
            
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                    <img src="${track.thumbnail}" width="50" height="50" 
                         style="border-radius: 8px; object-fit: cover;"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect fill=%22%23333%22 width=%2250%22 height=%2250%22/><text fill=%22%23fff%22 x=%2225%22 y=%2230%22 text-anchor=%22middle%22>🎵</text></svg>'">
                    <div style="min-width: 0;">
                        <strong style="display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.title}</strong>
                        <small style="color: #aaa;">${track.artist}</small>
                    </div>
                </div>
                <button class="remove-btn" onclick="event.stopPropagation(); player.removeFromPlaylist(${index})" title="Kaldır">✕</button>
            `;
            
            li.addEventListener('click', () => this.loadTrack(track));
            playlistElement.appendChild(li);
        });
        
        this.updateButtons();
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

    updatePlaylistUI() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
        this.updateButtons();
    }

    updateButtons() {
        document.getElementById('prevBtn').disabled = this.currentIndex <= 0;
        document.getElementById('nextBtn').disabled = this.currentIndex >= this.playlist.length - 1;
    }

    savePlaylist() {
        localStorage.setItem('playlist', JSON.stringify(this.playlist));
    }

    saveLastPlayed(track) {
        localStorage.setItem('lastPlayed', JSON.stringify({
            track: track,
            index: this.currentIndex
        }));
    }

    showLoading(text) {
        document.getElementById('loadingText').textContent = text || 'Yükleniyor...';
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Sayfa yüklendiğinde başlat
let player;
window.addEventListener('load', () => {
    player = new YouTubeMusicPlayer();
});

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ SW kaydedildi'))
            .catch(err => console.log('SW:', err));
    });
}

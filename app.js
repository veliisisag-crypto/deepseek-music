class YouTubeMusicPlayer {
    constructor() {
        this.audioPlayer = document.getElementById('audioPlayer');
        this.playerContainer = document.getElementById('playerContainer');
        this.playlist = JSON.parse(localStorage.getItem('playlist')) || [];
        this.currentIndex = -1;
        this.ytPlayer = null;
        this.isPlaying = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderPlaylist();
        this.loadLastPlayed();
        this.loadYouTubeAPI();
    }

    loadYouTubeAPI() {
        // YouTube IFrame API'yi yükle
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        // Global callback
        window.onYouTubeIframeAPIReady = () => {
            console.log('✅ YouTube API hazır');
        };
    }

    setupEventListeners() {
        // Arama - YouTube'da ara
        document.getElementById('searchBtn').addEventListener('click', () => {
            const query = document.getElementById('searchInput').value.trim();
            if (query) {
                // YouTube'da aramaya yönlendir
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                window.open(searchUrl, '_blank');
                alert('YouTube\'da arama açıldı. Beğendiğiniz videonun linkini kopyalayıp buraya yapıştırın.');
            }
        });

        // Enter tuşu ile ara
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('searchBtn').click();
            }
        });

        // Panodan link yapıştır
        document.getElementById('pasteBtn').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                document.getElementById('searchInput').value = text;
                
                if (text.includes('youtube.com/watch') || text.includes('youtu.be')) {
                    const videoId = this.extractVideoId(text);
                    if (videoId) {
                        this.addAndPlay(videoId);
                    }
                } else {
                    alert('Lütfen geçerli bir YouTube linki yapıştırın!');
                }
            } catch (err) {
                // Manuel yapıştırma için input'u göster
                document.getElementById('searchInput').focus();
                alert('Lütfen YouTube linkini yapıştırın');
            }
        });

        // Müzik kontrolleri
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prevBtn').addEventListener('click', () => this.playPrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.playNext());

        // Ses kontrolü
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        const savedVolume = localStorage.getItem('volume') || 70;
        volumeSlider.value = savedVolume;
        if (this.audioPlayer) this.audioPlayer.volume = savedVolume / 100;
        volumeValue.textContent = `${savedVolume}%`;

        volumeSlider.addEventListener('input', (e) => {
            const vol = e.target.value / 100;
            if (this.ytPlayer && this.ytPlayer.setVolume) {
                this.ytPlayer.setVolume(e.target.value);
            }
            if (this.audioPlayer) this.audioPlayer.volume = vol;
            volumeValue.textContent = `${e.target.value}%`;
            localStorage.setItem('volume', e.target.value);
        });

        // Playlist temizleme
        document.getElementById('clearPlaylist').addEventListener('click', () => {
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
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&]+)/,
            /(?:youtu\.be\/)([^?]+)/,
            /(?:youtube\.com\/embed\/)([^?]+)/,
            /(?:youtube\.com\/shorts\/)([^?]+)/,
            /(?:youtube\.com\/v\/)([^?]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    async addAndPlay(videoId) {
        this.showLoading('Video bilgisi alınıyor...');
        
        try {
            // YouTube oEmbed API ile video bilgilerini al (ücretsiz, limitsiz)
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            
            if (!response.ok) {
                // oEmbed başarısız olursa manuel bilgi oluştur
                const track = {
                    id: videoId,
                    title: 'YouTube Videosu',
                    artist: 'Bilinmeyen Sanatçı',
                    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    url: `https://www.youtube.com/watch?v=${videoId}`
                };
                this.addToPlaylist(track);
                this.playTrack(track);
                return;
            }
            
            const data = await response.json();
            
            const track = {
                id: videoId,
                title: data.title.replace(' - YouTube', ''),
                artist: data.author_name || 'YouTube Sanatçısı',
                thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
            
            this.addToPlaylist(track);
            this.playTrack(track);
            document.getElementById('searchInput').value = '';
            
        } catch (error) {
            console.error('Bilgi alınamadı:', error);
            
            // Yine de ekle ve çal
            const track = {
                id: videoId,
                title: `Video: ${videoId}`,
                artist: 'YouTube',
                thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
            this.addToPlaylist(track);
            this.playTrack(track);
        } finally {
            this.hideLoading();
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
        this.showLoading('Yükleniyor...');
        
        // Önceki player'ı temizle
        this.destroyPlayer();
        
        // Player container'ı göster
        this.playerContainer.style.display = 'block';
        
        // Bilgileri güncelle
        document.getElementById('title').textContent = track.title;
        document.getElementById('artist').textContent = track.artist;
        document.getElementById('thumbnail').src = track.thumbnail;
        
        // Gizli bir div oluştur (YouTube player için)
        const playerDiv = document.createElement('div');
        playerDiv.id = 'yt-player';
        playerDiv.style.display = 'none';
        document.body.appendChild(playerDiv);
        
        // YouTube player'ı oluştur
        this.ytPlayer = new YT.Player('yt-player', {
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
                iv_load_policy: 3,
                rel: 0
            },
            events: {
                onReady: (event) => {
                    console.log('✅ Player hazır');
                    event.target.playVideo();
                    event.target.setVolume(localStorage.getItem('volume') || 70);
                    this.hideLoading();
                },
                onStateChange: (event) => {
                    // YT.PlayerState.ENDED = 0
                    if (event.data === 0) {
                        this.playNext();
                    }
                    // YT.PlayerState.PLAYING = 1
                    if (event.data === 1) {
                        this.isPlaying = true;
                        document.getElementById('playBtn').textContent = '⏸️';
                    }
                    // YT.PlayerState.PAUSED = 2
                    if (event.data === 2) {
                        this.isPlaying = false;
                        document.getElementById('playBtn').textContent = '▶️';
                    }
                },
                onError: (event) => {
                    console.error('Player hatası:', event.data);
                    this.hideLoading();
                    alert('Bu video çalınamıyor. Telif hakkı veya bölge kısıtlaması olabilir.');
                    this.playNext();
                }
            }
        });
        
        this.updatePlaylistUI();
        this.saveLastPlayed(track);
    }

    destroyPlayer() {
        if (this.ytPlayer) {
            try {
                this.ytPlayer.destroy();
            } catch (e) {
                console.log('Player destroy hatası:', e);
            }
            this.ytPlayer = null;
        }
        
        // Eski player div'leri temizle
        const oldPlayers = document.querySelectorAll('#yt-player');
        oldPlayers.forEach(el => el.remove());
        
        this.isPlaying = false;
        document.getElementById('playBtn').textContent = '▶️';
    }

    stopPlayback() {
        this.destroyPlayer();
        this.playerContainer.style.display = 'none';
        this.currentIndex = -1;
        localStorage.removeItem('lastPlayed');
    }

    togglePlay() {
        if (!this.ytPlayer) {
            if (this.currentIndex >= 0 && this.playlist[this.currentIndex]) {
                this.loadTrack(this.playlist[this.currentIndex]);
            }
            return;
        }
        
        try {
            if (this.isPlaying) {
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
            // Liste sonu
            this.stopPlayback();
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
            playlistElement.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Çalma listesi boş. YouTube linki yapıştırarak şarkı ekleyin.</p>';
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
        localStorage.setItem('playlist', JSON.stringify(this.playlist));
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

    saveLastPlayed(track) {
        localStorage.setItem('lastPlayed', JSON.stringify({
            track,
            index: this.currentIndex
        }));
    }

    loadLastPlayed() {
        const lastPlayed = JSON.parse(localStorage.getItem('lastPlayed'));
        if (lastPlayed && this.playlist.length > 0) {
            const track = this.playlist.find(t => t.id === lastPlayed.track.id);
            if (track) {
                document.getElementById('title').textContent = track.title;
                document.getElementById('artist').textContent = track.artist;
                document.getElementById('thumbnail').src = track.thumbnail;
            }
        }
    }

    showLoading(text) {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Uygulamayı başlat
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

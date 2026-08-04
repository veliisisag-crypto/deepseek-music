class YouTubeMusicPlayer {
    constructor() {
        this.audioPlayer = document.getElementById('audioPlayer');
        this.playlist = JSON.parse(localStorage.getItem('playlist')) || [];
        this.currentIndex = -1;
        
        // Çalışan Invidious instance'ları
        this.invidiousInstances = [
            'https://invidious.snopyta.org',
            'https://yewtu.be',
            'https://vid.puffyan.us',
            'https://invidious.namazso.eu',
            'https://inv.riverside.rocks'
        ];
        
        this.currentInstance = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderPlaylist();
        this.loadLastPlayed();
        this.findWorkingInstance();
    }

    async findWorkingInstance() {
        for (let i = 0; i < this.invidiousInstances.length; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const response = await fetch(`${this.invidiousInstances[i]}/api/v1/stats`, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    this.currentInstance = i;
                    console.log('✅ Aktif sunucu:', this.invidiousInstances[i]);
                    return;
                }
            } catch (e) {
                console.log('❌ Sunucu çalışmıyor:', this.invidiousInstances[i]);
            }
        }
    }

    setupEventListeners() {
        document.getElementById('searchBtn').addEventListener('click', () => this.search());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.search();
        });
        
        document.getElementById('pasteBtn').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                document.getElementById('searchInput').value = text;
                if (text.includes('youtube.com') || text.includes('youtu.be')) {
                    await this.search();
                }
            } catch (err) {
                alert('Panodan yapıştırma başarısız! Manuel yapıştırın.');
            }
        });
        
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prevBtn').addEventListener('click', () => this.playPrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.playNext());
        
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        const savedVolume = localStorage.getItem('volume') || 70;
        volumeSlider.value = savedVolume;
        this.audioPlayer.volume = savedVolume / 100;
        volumeValue.textContent = `${savedVolume}%`;
        
        volumeSlider.addEventListener('input', (e) => {
            this.audioPlayer.volume = e.target.value / 100;
            volumeValue.textContent = `${e.target.value}%`;
            localStorage.setItem('volume', e.target.value);
        });
        
        this.audioPlayer.addEventListener('ended', () => this.playNext());
        this.audioPlayer.addEventListener('error', () => this.handleAudioError());
        this.audioPlayer.addEventListener('play', () => {
            document.getElementById('playBtn').textContent = '⏸️';
        });
        this.audioPlayer.addEventListener('pause', () => {
            document.getElementById('playBtn').textContent = '▶️';
        });
        
        document.getElementById('clearPlaylist').addEventListener('click', () => {
            if (confirm('Çalma listesini temizlemek istediğinize emin misiniz?')) {
                this.playlist = [];
                this.currentIndex = -1;
                this.audioPlayer.src = '';
                document.getElementById('playerContainer').style.display = 'none';
                localStorage.setItem('playlist', JSON.stringify(this.playlist));
                this.renderPlaylist();
            }
        });
    }

    async search() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;
        
        this.showLoading('Aranıyor...');
        document.getElementById('searchResults').innerHTML = '';
        
        try {
            if (query.includes('youtube.com/watch') || query.includes('youtu.be')) {
                const videoId = this.extractVideoId(query);
                if (videoId) {
                    await this.getVideoInfo(videoId);
                }
            } else {
                await this.searchInvidious(query);
            }
        } catch (error) {
            console.error('Arama hatası:', error);
            alert('Arama başarısız. Lütfen tekrar deneyin veya direkt YouTube linki yapıştırın.');
        } finally {
            this.hideLoading();
        }
    }

    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&]+)/,
            /(?:youtu\.be\/)([^?]+)/,
            /(?:youtube\.com\/embed\/)([^?]+)/,
            /(?:youtube\.com\/shorts\/)([^?]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    async getVideoInfo(videoId) {
        try {
            const url = `${this.invidiousInstances[this.currentInstance]}/api/v1/videos/${videoId}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error('Video bilgisi alınamadı');
            
            const data = await response.json();
            
            const track = {
                id: videoId,
                title: data.title,
                artist: data.author,
                thumbnail: data.videoThumbnails?.[0]?.url || 
                          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                duration: data.lengthSeconds,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
            
            this.addToPlaylist(track);
            this.playTrack(track);
            
        } catch (error) {
            console.error('Video bilgisi hatası:', error);
            alert('Video bilgisi alınamadı. Farklı bir video deneyin.');
        }
    }

    async searchInvidious(query) {
        try {
            const url = `${this.invidiousInstances[this.currentInstance]}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error('Arama başarısız');
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                document.getElementById('searchResults').innerHTML = 
                    '<p style="text-align: center; color: #888; padding: 20px;">Sonuç bulunamadı</p>';
                return;
            }
            
            this.displaySearchResults(data);
            
        } catch (error) {
            await this.tryAlternativeInstance(query);
        }
    }

    async tryAlternativeInstance(query) {
        for (let i = 0; i < this.invidiousInstances.length; i++) {
            if (i === this.currentInstance) continue;
            
            try {
                const url = `${this.invidiousInstances[i]}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
                const response = await fetch(url);
                
                if (response.ok) {
                    this.currentInstance = i;
                    const data = await response.json();
                    this.displaySearchResults(data);
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        
        alert('Tüm sunucular şu anda yoğun. Lütfen direkt YouTube linki yapıştırın.');
    }

    displaySearchResults(items) {
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';
        
        items.forEach(item => {
            const videoId = item.videoId;
            const div = document.createElement('div');
            div.className = 'result-item';
            
            const thumbnail = item.videoThumbnails?.[0]?.url || 
                            `https://img.youtube.com/vi/${videoId}/default.jpg`;
            
            div.innerHTML = `
                <img src="${thumbnail}" alt="${item.title}" 
                     onerror="this.style.display='none'">
                <div style="flex: 1;">
                    <h4>${item.title}</h4>
                    <p>${item.author}</p>
                </div>
            `;
            
            div.addEventListener('click', () => {
                const track = {
                    id: videoId,
                    title: item.title,
                    artist: item.author,
                    thumbnail: item.videoThumbnails?.[1]?.url || 
                              `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    duration: item.lengthSeconds,
                    url: `https://www.youtube.com/watch?v=${videoId}`
                };
                
                this.addToPlaylist(track);
                this.playTrack(track);
                resultsContainer.innerHTML = '';
                document.getElementById('searchInput').value = '';
            });
            
            resultsContainer.appendChild(div);
        });
    }

    async getAudioStream(videoId) {
        const url = `${this.invidiousInstances[this.currentInstance]}/api/v1/videos/${videoId}`;
        const response = await fetch(url);
        const data = await response.json();
        
        const audioFormats = data.adaptiveFormats
            .filter(format => format.type.startsWith('audio/'))
            .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
        
        if (audioFormats.length === 0) {
            throw new Error('Ses formatı bulunamadı');
        }
        
        return audioFormats[0].url;
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

    async loadTrack(track) {
        this.showLoading('Şarkı yükleniyor...');
        
        try {
            document.getElementById('playerContainer').style.display = 'block';
            document.getElementById('title').textContent = track.title;
            document.getElementById('artist').textContent = track.artist;
            document.getElementById('thumbnail').src = track.thumbnail;
            
            const audioUrl = await this.getAudioStream(track.id);
            this.audioPlayer.crossOrigin = "anonymous";
            this.audioPlayer.src = audioUrl;
            
            await this.audioPlayer.play();
            
            this.updatePlaylistUI();
            this.saveLastPlayed(track);
            
        } catch (error) {
            console.error('Şarkı yüklenemedi:', error);
            alert('Bu şarkı şu anda çalınamıyor. Farklı bir şarkı deneyin.');
            document.getElementById('playerContainer').style.display = 'none';
        } finally {
            this.hideLoading();
        }
    }

    togglePlay() {
        if (this.audioPlayer.paused) {
            this.audioPlayer.play();
        } else {
            this.audioPlayer.pause();
        }
    }

    playNext() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            this.loadTrack(this.playlist[this.currentIndex]);
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
        
        this.playlist.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            if (index === this.currentIndex) li.classList.add('active');
            
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                    <img src="${track.thumbnail}" width="45" height="45" 
                         style="border-radius: 8px; object-fit: cover;"
                         onerror="this.style.display='none'">
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
            this.currentIndex = -1;
            this.audioPlayer.src = '';
            document.getElementById('playerContainer').style.display = 'none';
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
                document.getElementById('playerContainer').style.display = 'block';
                document.getElementById('title').textContent = track.title;
                document.getElementById('artist').textContent = track.artist;
                document.getElementById('thumbnail').src = track.thumbnail;
            }
        }
    }

    handleAudioError() {
        alert('Ses akışı başarısız. Sonraki şarkıya geçiliyor...');
        setTimeout(() => this.playNext(), 2000);
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
const player = new YouTubeMusicPlayer();

// Service Worker kaydı
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Service Worker kaydedildi'))
            .catch(err => console.log('Service Worker:', err));
    });
}
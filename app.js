// ============ KLASÖR SEÇME (561 DOSYA İÇİN OPTİMİZE) ============

function pickFolder() {
    document.getElementById('folderInput').click();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('folderInput').addEventListener('change', async (e) => {
        const allFiles = Array.from(e.target.files);
        
        if (allFiles.length === 0) {
            showStatus('❌ Klasör boş!');
            return;
        }
        
        const totalCount = allFiles.length;
        showStatus(`📂 ${totalCount} dosya bulundu, filtreleniyor...`);
        
        // UI'a nefes aldır
        await sleep(50);
        
        // Filtrele: sadece mp3, m4a, wav, flac, ogg, aac
        const musicFiles = allFiles.filter(f => {
            const name = f.name.toLowerCase();
            const ext = name.split('.').pop();
            const validExts = ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'aac', 'opus', 'wma'];
            
            // Geçerli uzantı kontrolü
            if (!validExts.includes(ext)) return false;
            
            // Sistem seslerini ELE
            const junkPatterns = [
                'ringtone', 'rington', 'alarm', 'notification', 'notify',
                'ui_sound', 'system', 'camera', 'screenshot',
                'whatsapp audio', 'whatsapp voice', 'ptt-', 'voice note',
                'call recording', 'callrecord'
            ];
            
            for (const pattern of junkPatterns) {
                if (name.includes(pattern)) return false;
            }
            
            // 10KB'dan küçük dosyaları ELE (ses efektleri)
            if (f.size < 10000) return false;
            
            return true;
        });
        
        showStatus(`📂 ${musicFiles.length} müzik dosyası bulundu (${totalCount - musicFiles.length} gereksiz elendi)`);
        await sleep(50);
        
        if (musicFiles.length === 0) {
            showStatus('❌ Müzik dosyası bulunamadı! Sadece mp3/m4a dosyalarını seçin.');
            return;
        }
        
        // Dosyaları parça parça işle (UI donmasını önle)
        localFiles = [];
        const chunkSize = 50; // Her seferde 50 dosya işle
        
        for (let i = 0; i < musicFiles.length; i += chunkSize) {
            const chunk = musicFiles.slice(i, i + chunkSize);
            
            for (const f of chunk) {
                localFiles.push({
                    name: f.name.replace(/\.[^.]+$/, ''),
                    fullName: f.name,
                    size: f.size,
                    type: f.type,
                    file: f
                });
            }
            
            // İlerleme göster
            const progress = Math.min(i + chunkSize, musicFiles.length);
            showStatus(`📂 ${progress}/${musicFiles.length} işleniyor...`);
            
            // UI'ın nefes alması için bekle
            await sleep(30);
        }
        
        // Klasör adını al
        const folderName = musicFiles[0].webkitRelativePath?.split('/')[0] || 'Müzik';
        
        // localStorage'a kaydet (sadece meta veri)
        localStorage.setItem('folderName_v14', folderName);
        
        try {
            // Önce tam liste kaydetmeyi dene
            const meta = localFiles.map(f => ({
                name: f.name,
                fullName: f.fullName,
                size: f.size,
                type: f.type
            }));
            localStorage.setItem('localFiles_v14', JSON.stringify(meta));
        } catch(e) {
            // localStorage dolarsa sadece isimleri kaydet
            try {
                const simple = localFiles.map(f => ({
                    name: f.name,
                    fullName: f.fullName
                }));
                localStorage.setItem('localFiles_v14', JSON.stringify(simple));
            } catch(e2) {
                showStatus('⚠️ Depolama alanı dolu, dosya listesi kaydedilemedi');
            }
        }
        
        // UI güncelle
        document.getElementById('folderInfo').textContent = `${folderName} (${localFiles.length} şarkı)`;
        document.getElementById('folderBtn').style.borderColor = '#0066ff';
        document.getElementById('folderBtn').style.color = '#0066ff';
        
        showStatus(`✅ ${localFiles.length} şarkı hazır!`);
        
        // Bellek temizliği
        e.target.value = '';
    });
});

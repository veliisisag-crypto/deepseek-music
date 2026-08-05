// Vercel Serverless Function - YouTube ses URL'sini döndürür
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'videoId gerekli' });

    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }
        });
        const html = await response.text();
        const jsonMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/);
        if (!jsonMatch) throw new Error('Ses verisi bulunamadı');
        
        const playerData = JSON.parse(jsonMatch[1]);
        const formats = playerData?.streamingData?.adaptiveFormats || [];
        const audioFormats = formats.filter(f => f.mimeType?.startsWith('audio/'));
        if (!audioFormats.length) throw new Error('Ses formatı yok');
        
        audioFormats.sort((a, b) => (a.bitrate || 128) - (b.bitrate || 128));
        const audioUrl = audioFormats[0].url;
        
        res.json({ url: audioUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
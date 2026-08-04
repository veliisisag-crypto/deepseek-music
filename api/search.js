// Vercel Serverless Function
// YouTube Data API v3 ile arama yapar
// API anahtarı sunucuda kalır, istemciye gitmez

export default async function handler(req, res) {
    // CORS header'ları
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const query = req.query.q?.trim();
    
    if (!query) {
        return res.status(400).json({ error: 'Arama terimi gerekli' });
    }
    
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ 
            error: 'API anahtarı tanımlı değil',
            hint: 'Vercel dashboard → Settings → Environment Variables → YOUTUBE_API_KEY ekleyin'
        });
    }
    
    try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('type', 'video');
        url.searchParams.set('videoCategoryId', '10'); // Müzik
        url.searchParams.set('maxResults', '20');
        url.searchParams.set('q', query);
        url.searchParams.set('key', apiKey);
        
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            return res.status(502).json({ error: `YouTube API hatası: ${response.status}` });
        }
        
        const data = await response.json();
        
        const results = (data.items || [])
            .filter(item => item.id?.videoId)
            .map(item => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnailUrl: item.snippet.thumbnails?.medium?.url || 
                             item.snippet.thumbnails?.default?.url || ''
            }));
        
        return res.status(200).json({ results });
        
    } catch (error) {
        return res.status(502).json({ error: 'YouTube\'a bağlanılamadı' });
    }
}
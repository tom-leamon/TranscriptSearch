"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const youtube_transcript_1 = __importDefault(require("youtube-transcript"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const db = new sqlite3_1.default.Database('transcripts.db');
// Setup database
db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS transcripts (videoId TEXT, transcript TEXT)');
});
// Function to Fetch and Store Transcript
async function fetchAndStoreTranscripts(videoUrls) {
    for (let url of videoUrls) {
        const videoId = url.split('v=')[1];
        try {
            const transcript = await youtube_transcript_1.default.YoutubeTranscript.fetchTranscript(url);
            const stmt = db.prepare('INSERT INTO transcripts VALUES (?, ?)');
            stmt.run(videoId, JSON.stringify(transcript));
            stmt.finalize();
        }
        catch (error) {
            console.error('Error fetching transcript:', error);
        }
    }
}
app.get('/search', (req, res) => {
    const searchTerm = req.query.search;
    const query = 'SELECT * FROM transcripts';
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).send('Internal Server Error');
            return;
        }
        const results = [];
        rows.forEach(row => {
            const transcript = JSON.parse(row.transcript);
            transcript.forEach((entry, index) => {
                if (entry.text.includes(searchTerm)) {
                    const contextStart = Math.max(0, index - 5);
                    const contextEnd = Math.min(transcript.length - 1, index + 5);
                    const context = transcript.slice(contextStart, contextEnd + 1).map((item) => item.text).join(' ');
                    results.push({
                        videoId: row.videoId,
                        timestamp: entry.offset,
                        context: context.replace(new RegExp(searchTerm, 'gi'), `<b>${searchTerm}</b>`) // highlight the search term
                    });
                }
            });
        });
        res.json(results);
    });
});
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
const videoUrls = [
    'https://www.youtube.com/watch?v=2H_0CM9Fa6A',
    // ... other video URLs
];
// fetchAndStoreTranscripts(videoUrls);
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

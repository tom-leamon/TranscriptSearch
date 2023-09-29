"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const YT = require('youtube-transcript');
const path_1 = __importDefault(require("path"));
// @ts-ignore
const youtube_metadata_from_url_1 = require("youtube-metadata-from-url");
const app = (0, express_1.default)();
const db = new sqlite3_1.default.Database('transcripts.db');
// Setup database
// Setup database
db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS transcripts (videoId TEXT UNIQUE, transcript TEXT, title TEXT, url TEXT, thumbnail_url TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS stats (totalWords INTEGER, totalHours REAL, totalVideos INTEGER)');
    db.run('INSERT OR IGNORE INTO stats VALUES (0, 0, 0)');
});
// Function to Fetch and Store Transcript
async function fetchAndStoreTranscripts(videoUrls) {
    for (let url of videoUrls) {
        const videoId = url.split('v=')[1];
        try {
            // Check if videoId already exists in the database
            db.get('SELECT videoId FROM transcripts WHERE videoId = ?', [videoId], async (err, row) => {
                if (!row) { // If not found, then insert and update stats
                    const transcript = await YT.YoutubeTranscript.fetchTranscript(url);
                    const videoData = await (0, youtube_metadata_from_url_1.metadata)(url);
                    let wordCount = 0;
                    let timeCount = 0;
                    transcript.forEach((entry) => {
                        wordCount += entry.text.split(' ').length;
                        timeCount += entry.duration;
                    });
                    const hours = timeCount / 3600;
                    // Update stats
                    db.run(`UPDATE stats SET totalWords = totalWords + ?, totalHours = totalHours + ?, totalVideos = totalVideos + 1`, [wordCount, hours]);
                    // Store transcript and metadata
                    const stmt = db.prepare('INSERT OR REPLACE INTO transcripts VALUES (?, ?, ?, ?, ?)');
                    stmt.run(videoId, JSON.stringify(transcript), videoData.title, url, videoData.thumbnail_url);
                    stmt.finalize();
                }
            });
        }
        catch (error) {
            console.error('Error fetching data:', error);
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
        const results = {};
        let totalQuotes = 0;
        let totalVideos = 0;
        rows.forEach(row => {
            const transcript = JSON.parse(row.transcript);
            let videoHasQuote = false;
            transcript.forEach((entry, index) => {
                if (entry.text.includes(searchTerm)) {
                    videoHasQuote = true;
                    totalQuotes++;
                    const contextStart = Math.max(0, index - 5);
                    const contextEnd = Math.min(transcript.length - 1, index + 5);
                    const context = transcript.slice(contextStart, contextEnd + 1).map((item) => item.text).join(' ');
                    const searchResult = {
                        videoId: row.videoId,
                        timestamp: entry.offset,
                        context: context.replace(new RegExp(searchTerm, 'gi'), `<b>${searchTerm}</b>`),
                        title: row.title,
                        thumbnail_url: row.thumbnail_url
                    };
                    if (!results[row.videoId]) {
                        results[row.videoId] = [];
                    }
                    results[row.videoId].push(searchResult);
                }
            });
            if (videoHasQuote) {
                totalVideos++;
            }
        });
        const summary = {
            totalQuotes,
            totalVideos
        };
        res.json({ results, summary });
    });
});
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
});
app.get('/stats', (req, res) => {
    db.get('SELECT * FROM stats', [], (err, row) => {
        if (err) {
            res.status(500).send('Internal Server Error');
            return;
        }
        res.json(row);
    });
});
const videoUrls = [
    'https://www.youtube.com/watch?v=2H_0CM9Fa6A',
];
// fetchAndStoreTranscripts(videoUrls);
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const YT = require('youtube-transcript');
const path_1 = __importDefault(require("path"));
const videoUrls_1 = require("./videoUrls");
// @ts-ignore
var fetchVideoInfo = require('updated-youtube-info');
const app = (0, express_1.default)();
const db = new sqlite3_1.default.Database('transcripts.db');
// Setup database
// Setup database
db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS transcripts (videoId TEXT UNIQUE, transcript TEXT, title TEXT, url TEXT, thumbnail_url TEXT, datePublished TEXT, duration INTEGER)');
    db.run('CREATE TABLE IF NOT EXISTS stats (totalWords INTEGER, totalSeconds INTEGER, totalVideos INTEGER)');
    db.run('INSERT OR IGNORE INTO stats VALUES (0, 0, 0)');
});
// Function to Fetch and Store Transcript
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getVideoIdFromDb(videoId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT videoId FROM transcripts WHERE videoId = ?', [videoId], (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
}
async function fetchAndStoreTranscripts(videoUrls) {
    const totalVideos = videoUrls.length;
    let processedVideos = 0;
    const startTime = Date.now();
    for (let url of videoUrls) {
        const videoId = url.split('v=')[1];
        try {
            const row = await getVideoIdFromDb(videoId);
            processedVideos++; // Increment the counter here
            if (row) {
                // Video already in database, skip to next iteration
                console.log(`Video ${videoId} already in database, skipping.`);
                console.log(`Processed ${processedVideos}/${totalVideos} videos.`);
                continue;
            }
            // If not found, then insert and update stats
            const transcript = await YT.YoutubeTranscript.fetchTranscript(url);
            console.log(`Transcript fetched for video ${videoId}.`); // Logging after fetching transcript
            const videoData = await fetchVideoInfo(videoId);
            let wordCount = 0;
            transcript.forEach((entry) => {
                wordCount += entry.text.split(' ').length;
            });
            // Update stats
            db.run(`UPDATE stats SET totalWords = totalWords + ?, totalSeconds = totalSeconds + ?, totalVideos = totalVideos + 1`, [wordCount, videoData.duration]);
            // Store transcript and metadata
            const stmt = db.prepare('INSERT OR REPLACE INTO transcripts VALUES (?, ?, ?, ?, ?, ?, ?)');
            stmt.run(videoId, JSON.stringify(transcript), videoData.title, url, videoData.thumbnailUrl, videoData.datePublished, videoData.duration);
            stmt.finalize();
        }
        catch (error) {
            console.error(`Error fetching data for video ${videoId}:`, error);
        }
        console.log(`Processed ${processedVideos}/${totalVideos} videos.`); // Log the processing status after each video
        await sleep(1000); // Adding a delay of 1 second to comply with rate limiting
    }
    const endTime = Date.now();
    console.log(`Total processing time: ${(endTime - startTime) / 1000} seconds.`);
}
app.get('/search', (req, res) => {
    const searchTerm = req.query.search.toLowerCase(); // Convert searchTerm to lowercase
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
                if (entry.text.toLowerCase().includes(searchTerm)) { // Convert entry.text to lowercase
                    videoHasQuote = true;
                    totalQuotes++;
                    const contextStart = Math.max(0, index - 5);
                    const contextEnd = Math.min(transcript.length - 1, index + 5);
                    const context = transcript.slice(contextStart, contextEnd + 1).map((item) => item.text).join(' ');
                    const searchResult = {
                        videoId: row.videoId,
                        timestamp: entry.offset,
                        context: context.replace(new RegExp(searchTerm, 'gi'), `<b class="match">${searchTerm}</b>`),
                        title: row.title,
                        thumbnail_url: row.thumbnail_url,
                        datePublished: row.datePublished // Include datePublished field
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
fetchAndStoreTranscripts(videoUrls_1.videoUrls);
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

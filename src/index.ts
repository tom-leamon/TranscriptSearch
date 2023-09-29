import express from 'express'
import sqlite3 from 'sqlite3'
const YT = require('youtube-transcript');
import path from 'path'
import { videoUrls } from './videoUrls';
// @ts-ignore
var fetchVideoInfo = require('updated-youtube-info')

const app = express()
const db = new sqlite3.Database('transcripts.db')

// Setup database
// Setup database
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS transcripts (videoId TEXT UNIQUE, transcript TEXT, title TEXT, url TEXT, thumbnail_url TEXT, datePublished TEXT, duration INTEGER)')
  db.run('CREATE TABLE IF NOT EXISTS stats (totalWords INTEGER, totalSeconds INTEGER, totalVideos INTEGER)')
  db.run('INSERT OR IGNORE INTO stats VALUES (0, 0, 0)')
})

// Function to Fetch and Store Transcript
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getVideoIdFromDb(videoId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get('SELECT videoId FROM transcripts WHERE videoId = ?', [videoId], (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

async function fetchAndStoreTranscripts(videoUrls: string[]) {
  const totalVideos = videoUrls.length
  let processedVideos = 0
  const startTime = Date.now()

  for (let url of videoUrls) {
    const videoId = url.split('v=')[1]

    try {
      const row = await getVideoIdFromDb(videoId)
      processedVideos++  // Increment the counter here
      if (row) {
        // Video already in database, skip to next iteration
        console.log(`Video ${videoId} already in database, skipping.`)
        console.log(`Processed ${processedVideos}/${totalVideos} videos.`)
        continue
      }

      // If not found, then insert and update stats
      const transcript = await YT.YoutubeTranscript.fetchTranscript(url)
      console.log(`Transcript fetched for video ${videoId}.`)  // Logging after fetching transcript
      const videoData = await fetchVideoInfo(videoId)
      
      let wordCount = 0
      transcript.forEach((entry: any) => {
        wordCount += entry.text.split(' ').length
      })

      // Update stats
      db.run(`UPDATE stats SET totalWords = totalWords + ?, totalSeconds = totalSeconds + ?, totalVideos = totalVideos + 1`, [wordCount, videoData.duration])
      
      // Store transcript and metadata
      const stmt = db.prepare('INSERT OR REPLACE INTO transcripts VALUES (?, ?, ?, ?, ?, ?, ?)')
      stmt.run(videoId, JSON.stringify(transcript), videoData.title, url, videoData.thumbnailUrl, videoData.datePublished, videoData.duration)
      stmt.finalize()

    } catch (error) {
      console.error(`Error fetching data for video ${videoId}:`, error)
    }

    console.log(`Processed ${processedVideos}/${totalVideos} videos.`)  // Log the processing status after each video

    await sleep(1000)  // Adding a delay of 1 second to comply with rate limiting
  }

  const endTime = Date.now()
  console.log(`Total processing time: ${(endTime - startTime) / 1000} seconds.`)
}

interface TranscriptRow {
  videoId: string
  transcript: string
  title: string
  thumbnail_url: string
  datePublished: string 
}

interface SearchResult {
  videoId: string
  timestamp: number
  context: string
  title: string
  thumbnail_url: string
  datePublished: string 
}

interface SearchSummary {
  totalQuotes: number
  totalVideos: number
}

app.get('/search', (req, res) => {
  const searchTerm = (req.query.search as string).toLowerCase()  // Convert searchTerm to lowercase
  const query = 'SELECT * FROM transcripts'

  db.all(query, [], (err, rows: TranscriptRow[]) => {
    if (err) {
      res.status(500).send('Internal Server Error')
      return
    }

    const results: { [key: string]: SearchResult[] } = {}
    let totalQuotes = 0
    let totalVideos = 0

    rows.forEach(row => {
      const transcript = JSON.parse(row.transcript)

      let videoHasQuote = false

      transcript.forEach((entry: any, index: number) => {
        if (entry.text.toLowerCase().includes(searchTerm)) {  // Convert entry.text to lowercase
          videoHasQuote = true
          totalQuotes++

          const contextStart = Math.max(0, index - 5)
          const contextEnd = Math.min(transcript.length - 1, index + 5)
          const context = transcript.slice(contextStart, contextEnd + 1).map((item: any) => item.text).join(' ')

          const searchResult: SearchResult = {
            videoId: row.videoId,
            timestamp: entry.offset,
            context: context.replace(new RegExp(searchTerm, 'gi'), `<b class="match">${searchTerm}</b>`),
            title: row.title,
            thumbnail_url: row.thumbnail_url,
            datePublished: row.datePublished  // Include datePublished field
          }

          if (!results[row.videoId]) {
            results[row.videoId] = []
          }

          results[row.videoId].push(searchResult)
        }
      })

      if (videoHasQuote) {
        totalVideos++
      }
    })

    const summary: SearchSummary = {
      totalQuotes,
      totalVideos
    }

    res.json({ results, summary })
  })
})


app.use(express.static(path.join(__dirname, '..', 'public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

app.get('/stats', (req, res) => {
  db.get('SELECT * FROM stats', [], (err, row) => {
    if (err) {
      res.status(500).send('Internal Server Error')
      return
    }
    res.json(row)
  })
})

fetchAndStoreTranscripts(videoUrls);

app.listen(3000, () => {
  console.log('Server is running on port 3000')
});
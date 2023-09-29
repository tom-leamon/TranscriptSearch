import express from 'express'
import sqlite3 from 'sqlite3'
const YT = require('youtube-transcript');
import path from 'path'
// @ts-ignore
import { metadata } from 'youtube-metadata-from-url'

const app = express()
const db = new sqlite3.Database('transcripts.db')

// Setup database
// Setup database
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS transcripts (videoId TEXT UNIQUE, transcript TEXT, title TEXT, url TEXT, thumbnail_url TEXT)')
  db.run('CREATE TABLE IF NOT EXISTS stats (totalWords INTEGER, totalHours REAL, totalVideos INTEGER)')
  db.run('INSERT OR IGNORE INTO stats VALUES (0, 0, 0)')
})

// Function to Fetch and Store Transcript
async function fetchAndStoreTranscripts(videoUrls: string[]) {
  for (let url of videoUrls) {
    const videoId = url.split('v=')[1]
    try {
      // Check if videoId already exists in the database
      db.get('SELECT videoId FROM transcripts WHERE videoId = ?', [videoId], async (err, row) => {
        if (!row) { // If not found, then insert and update stats
          const transcript = await YT.YoutubeTranscript.fetchTranscript(url)
          const videoData = await metadata(url)
          
          let wordCount = 0
          let timeCount = 0
          transcript.forEach((entry: any) => {
            wordCount += entry.text.split(' ').length
            timeCount += entry.duration
          })
          const hours = timeCount / 3600
          
          // Update stats
          db.run(`UPDATE stats SET totalWords = totalWords + ?, totalHours = totalHours + ?, totalVideos = totalVideos + 1`, [wordCount, hours])
          
          // Store transcript and metadata
          const stmt = db.prepare('INSERT OR REPLACE INTO transcripts VALUES (?, ?, ?, ?, ?)')
          stmt.run(videoId, JSON.stringify(transcript), videoData.title, url, videoData.thumbnail_url)
          stmt.finalize()
        }
      })
    }
    catch (error) {
      console.error('Error fetching data:', error)
    }
  }
}

interface TranscriptRow {
  videoId: string
  transcript: string
  title: string
  thumbnail_url: string
}

interface SearchResult {
  videoId: string
  timestamp: number
  context: string
  title: string
  thumbnail_url: string
}

interface SearchSummary {
  totalQuotes: number
  totalVideos: number
}

app.get('/search', (req, res) => {
  const searchTerm = req.query.search as string
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
        if (entry.text.includes(searchTerm)) {
          videoHasQuote = true
          totalQuotes++

          const contextStart = Math.max(0, index - 5)
          const contextEnd = Math.min(transcript.length - 1, index + 5)
          const context = transcript.slice(contextStart, contextEnd + 1).map((item: any) => item.text).join(' ')

          const searchResult: SearchResult = {
            videoId: row.videoId,
            timestamp: entry.offset,
            context: context.replace(new RegExp(searchTerm, 'gi'), `<b>${searchTerm}</b>`),
            title: row.title,
            thumbnail_url: row.thumbnail_url
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

const videoUrls = [
  'https://www.youtube.com/watch?v=2H_0CM9Fa6A',
]

fetchAndStoreTranscripts(videoUrls);

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
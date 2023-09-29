import express from 'express'
import sqlite3 from 'sqlite3'
import YT from 'youtube-transcript'
import path from 'path'

const app = express()
const db = new sqlite3.Database('transcripts.db')

// Setup database
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS transcripts (videoId TEXT, transcript TEXT)')
})

// Function to Fetch and Store Transcript
async function fetchAndStoreTranscripts(videoUrls: string[]) {
  for (let url of videoUrls) {
    const videoId = url.split('v=')[1]
    try {
      const transcript = await YT.YoutubeTranscript.fetchTranscript(url)
      const stmt = db.prepare('INSERT INTO transcripts VALUES (?, ?)')
      stmt.run(videoId, JSON.stringify(transcript))
      stmt.finalize()
    }
    catch (error) {
      console.error('Error fetching transcript:', error)
    }
  }
}

// REST API Endpoint
interface TranscriptRow {
  videoId: string
  transcript: string
}

// Define the interface for search results
interface SearchResult {
  videoId: string
  timestamp: number
  context: string
}

app.get('/search', (req, res) => {
  const searchTerm = req.query.search as string
  const query = 'SELECT * FROM transcripts'
  
  db.all(query, [], (err, rows: TranscriptRow[]) => {
    if (err) {
      res.status(500).send('Internal Server Error')
      return
    }
  
    const results: SearchResult[] = []
    
    rows.forEach(row => {
      const transcript = JSON.parse(row.transcript)
      
      transcript.forEach((entry: any, index: number) => {
        if (entry.text.includes(searchTerm)) {
          const contextStart = Math.max(0, index - 5)
          const contextEnd = Math.min(transcript.length - 1, index + 5)
          const context = transcript.slice(contextStart, contextEnd + 1).map((item: any) => item.text).join(' ')
          
          results.push({
            videoId: row.videoId,
            timestamp: entry.offset,
            context: context.replace(new RegExp(searchTerm, 'gi'), `<b>${searchTerm}</b>`) // highlight the search term
          })
        }
      })
    })
  
    res.json(results)
  })
})

app.use(express.static(path.join(__dirname, '..', 'public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

const videoUrls = [
  'https://www.youtube.com/watch?v=2H_0CM9Fa6A',
  // ... other video URLs
]

// fetchAndStoreTranscripts(videoUrls);

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})

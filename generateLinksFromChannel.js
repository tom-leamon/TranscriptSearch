const fs = require('fs')
const cheerio = require('cheerio')

async function extractYouTubeIDs(filePath) {
  try {
    // Read the HTML file
    const data = await fs.promises.readFile(filePath, 'utf8')
    
    // Load the HTML data into Cheerio
    const $ = cheerio.load(data)
    
    // Initialize an empty array to hold the YouTube video IDs
    const youtubeIDs = []
    
    // Look for all anchor tags with href attributes containing "/watch?v="
    $('a[href*="/watch?v="]').each((index, element) => {
      const link = $(element).attr('href')
      const videoID = link.split('v=')[1].split('&')[0]  // Extract the video ID from the URL
      youtubeIDs.push(`https://www.youtube.com/watch?v=${videoID}`)
    })
    
    // Eliminate duplicate YouTube IDs
    const uniqueYouTubeIDs = Array.from(new Set(youtubeIDs))
    
    // Write the array to a new file
    await fs.promises.writeFile('./src/videoUrls.ts', `export const videoUrls = [\n '${uniqueYouTubeIDs.join("',\n '")}'\n]`)
    console.log('YouTube IDs have been written to videoUrls.ts')
  }
  catch (error) {
    console.error('An error occurred:', error.message)
  }
}

// Call the function with the path to your HTML file
extractYouTubeIDs('./youtubechannel.html')

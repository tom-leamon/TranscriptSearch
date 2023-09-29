document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search)
  const query = urlParams.get('search')

  if (query) {
    document.getElementById('searchTerm').value = query
    search()
  }
})

var player
var playerReady = false
var firstResultToLoad = null

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '390',
    width: '640',
    videoId: '',
    events: {
      'onReady': onPlayerReady
    }
  })
}

function onPlayerReady(event) {
  playerReady = true
  
  if (firstResultToLoad) {
    player.cueVideoById({
      videoId: firstResultToLoad.videoId,
      startSeconds: firstResultToLoad.timestamp / 1000
    })
  }
  
  event.target.playVideo()
}

async function search() {
  const searchTerm = document.getElementById('searchTerm').value
  const response = await fetch('/search?search=' + searchTerm)
  const { results, summary } = await response.json()
  const resultsDiv = document.getElementById('results')
  const searchSummary = document.getElementById('searchSummary')

  searchSummary.textContent = `Found ${summary.totalQuotes} quotes in ${summary.totalVideos} videos`

  document.getElementById('playerContainer').style.display = 'block'

  resultsDiv.innerHTML = ''

  let firstVideoLoaded = false

  Object.keys(results).forEach(videoId => {
    const videoResults = results[videoId]
    const firstResult = videoResults[0]
    const resultHTML = videoResults.map(result => `
      <div onclick="goToTimestamp('${result.videoId}', ${result.timestamp})">
        <strong>Timestamp:</strong> ${new Date(result.timestamp * 1000).toISOString().substr(11, 8)} <br>
        <strong>Context:</strong> ${result.context}
      </div>
    `).join('<br>')

    resultsDiv.innerHTML += `
      <div>
        <h2>${firstResult.title}</h2>
        <img src="${firstResult.thumbnail_url}" alt="Thumbnail for ${firstResult.title}">
        ${resultHTML}
      </div>
      <hr>
    `

    if (!firstVideoLoaded) {
      firstResultToLoad = firstResult
      
      if (playerReady) {
        player.cueVideoById({
          videoId: firstResult.videoId,
          startSeconds: firstResult.timestamp / 1000
        })
      }
      
      firstVideoLoaded = true
    }
  })
}

function goToTimestamp(videoId, timestamp) {
  if (!playerReady) {
    console.error('Player is not ready yet.')
    return
  }

  player.loadVideoById({ videoId: videoId, startSeconds: timestamp / 1000 })
}
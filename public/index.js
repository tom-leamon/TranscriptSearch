async function fetchStats() {
  const response = await fetch('/stats')
  const stats = await response.json()
  const statsDiv = document.getElementById('stats')
  
  const totalHours = (stats.totalSeconds / 3600).toFixed(0)  // Convert seconds to hours
  statsDiv.textContent = `Searching ${stats.totalWords.toLocaleString()} words in ${totalHours} hours of ${stats.totalVideos} videos`
}

document.addEventListener('DOMContentLoaded', function() {
  parseUrlParamsAndCueVideo();
  fetchStats();
});

var player;
var playerReady = false;
var firstResultToLoad = null;

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: '',
    events: {
      'onReady': function(event) {
        playerReady = true;
        event.target.playVideo();
        parseUrlParamsAndCueVideo();  // Move this line here to ensure player is ready
      }
    }
  });
}

function parseUrlParamsAndCueVideo() {
  // Ensure that both the YouTube player is ready and the DOM content is loaded
  if (!playerReady || !document.readyState === 'complete') return;

  firstResultToLoad = null;  // Reset firstResultToLoad

  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('search');

  if (query) {
    document.getElementById('searchTerm').value = query;
    search();
  }

  const videoId = urlParams.get('videoId');
  const timestamp = urlParams.get('timestamp');

  if (videoId && timestamp) {
    firstResultToLoad = { videoId, timestamp: Number(timestamp) };
    player.cueVideoById({
      videoId: firstResultToLoad.videoId,
      startSeconds: firstResultToLoad.timestamp / 1000
    });
  }
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
  
  // Update the URL with the search query parameter
  const currentUrl = new URL(window.location.href)
  currentUrl.searchParams.set('search', searchTerm)
  window.history.pushState({}, null, currentUrl.toString())

  const response = await fetch('/search?search=' + searchTerm)
  const { results, summary } = await response.json()
  const resultsDiv = document.getElementById('results')
  const searchSummary = document.getElementById('searchSummary')

  searchSummary.textContent = `Found ${summary.totalQuotes} quotes in ${summary.totalVideos} videos`

  document.getElementById('playerContainer').style.display = 'flex'

  resultsDiv.innerHTML = ''

  let firstVideoLoaded = false

  Object.keys(results).forEach(videoId => {
    const videoResults = results[videoId]
    const firstResult = videoResults[0]
    const resultHTML = videoResults.map(result => `
      <div class="result" onclick="goToTimestamp('${result.videoId}', ${result.timestamp})">
        <div class="timestamp">${new Date(result.timestamp).toISOString().substr(11, 8)}</div><div class="context">${result.context}</div>
      </div>
    `).join('<br>')

    resultsDiv.innerHTML += `
      <div class="video">
        <div class="video-header">
          <h2>${firstResult.title}</h2>
          <div class="spacer"></div>
          <div class="date-published">${new Date(firstResult.datePublished).toLocaleDateString()}</div>
        </div>
        ${resultHTML}
      </div>
    `

    if (!firstVideoLoaded && !firstResultToLoad) {  // Check if firstResultToLoad is already set
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

  // Update URL with query parameters
  const currentUrl = new URL(window.location.href)
  currentUrl.searchParams.set('videoId', videoId)
  currentUrl.searchParams.set('timestamp', timestamp)
  window.history.pushState({}, null, currentUrl.toString())
  document.getElementById('player').scrollIntoView();
}
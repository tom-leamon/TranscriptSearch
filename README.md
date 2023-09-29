# TranscriptSearch

## Summary
TranscriptSearch is a web application that allows you to search within YouTube video transcripts, share timestamped links, and cue videos at specific points.

## Features

### Backend
- **YouTube API Integration**: Fetches video metadata and transcripts.
- **Database**: Stores parsed transcript data in a well-normalized and indexed database.
- **Search Algorithm**: Efficiently finds matches within transcripts.
- **Caching**: Speeds up frequent queries.

### URL Structure
- Query Parameters: `search`, `content_type`, `video_id`, `timestamp`
- Example: `https://transcriptsearch.com/?search=term&content_type=youtube&video_id=id&timestamp=time`

## Use Cases
- **Research**: Quickly find and cite specific points in a video.
- **Content Creation**: Reference particular segments for your own projects.
- **Collaboration**: Share timestamped video links with teammates or friends for discussion.

## Error Handling
Handles various edge cases including invalid `video_id`, missing transcripts, and YouTube API limitations or unavailability.

## Compliance
The application is designed to be in compliance with YouTube API usage policies and limitations.

## Additional Features
- **Custom Timestamps**: Create and share custom timestamps in URLs.
- **Cue First Result**: Automatically cues up the first result if a timestamp is not specified.
- **Fallback Behavior**: Provides an alternative approach for videos without transcripts.

## Getting Started
Follow the installation guide to set up the project locally.

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

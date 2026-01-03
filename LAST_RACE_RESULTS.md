# Last Race Results Storage System

## Overview
The system now stores and displays the results of completed races. When a race finishes, the final standings are captured and made available through the API and UI.

## Features

### Consumer Storage
- **Storage**: Final race results are stored in memory when a race finishes (on 'reset' event)
- **TTL**: Results are kept for 1 hour by default (configurable via `LAST_RESULTS_TTL_MS` environment variable)
- **Data Stored**: Position, name, distance, speed, status, profile, and total laps for each participant

### API Endpoint
- **GET /last-results**: Returns all stored race results, sorted by most recent first
- Response format:
  ```json
  [
    {
      "raceId": 1000,
      "finishedAt": 1704298800000,
      "leaderboard": [
        {
          "position": 1,
          "name": "Hamilton #0",
          "distance": 20915,
          "speed": 205.32,
          "status": "finished",
          "profile": "professional",
          "totalLaps": 5
        }
      ]
    }
  ]
  ```

### UI Display
- Results appear below the current race leaderboard
- Shows up to 3 most recent completed races
- Displays top 5 finishers per race
- Includes timestamp showing when the race finished (e.g., "5 minutes ago")
- Styled differently from live races to distinguish completed results
- Updates every 10 seconds

## Configuration

### Environment Variables
- `LAST_RESULTS_TTL_MS`: Time to keep results in memory (default: 3600000 ms = 1 hour)

## Implementation Details

### Consumer (src/consumer/app.js)
- `lastRaceResults` Map stores results keyed by race ID
- Results captured before clearing race data on reset event
- Periodic cleanup removes expired results
- New endpoint `/last-results` exposes stored data

### UI (src/ui/public/index.html)
- `fetchLastResults()`: Fetches results from API every 10 seconds
- `displayLastResults()`: Renders results below leaderboard
- `formatTimestamp()`: Formats completion time in human-readable format
- Trophy emoji (🏆) distinguishes the section

## Benefits
- **Race History**: Users can see results of recently completed races
- **No Persistence Required**: In-memory storage keeps the system simple
- **Automatic Cleanup**: Old results are automatically removed
- **Performance**: Minimal overhead with configurable TTL

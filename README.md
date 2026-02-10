# Planner
A flexible day routine planner to help regaining structure in my life.

## Server-side storage

This project includes a tiny Node.js server that persists tasks to a local JSON file.

### Run

1. Start the server:

	- `node server.js`

2. Open the app in your browser:

	- http://localhost:3000

Tasks are stored in `data/tasks.json`. If the server is not reachable, the app falls back to local storage.

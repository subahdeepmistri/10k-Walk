# WalkTracker Preview Run Doc

## How to reproduce artifacts

1. `cd` to the project root (where `package.json` lives)
2. `npm run build` — produces `dist/` with the production SPA

## How to run the server

```bash
cd /path/to/project/root
npx serve dist -l 5180 -s
```

Or with Vite dev server:

```bash
npx vite --host 0.0.0.0 --port 5173
```

### macOS detach recipe

```bash
nohup npx serve dist -l 5180 -s > .freebuff/preview.log 2>&1 < /dev/null &
echo "pid=$!"
disown
```

Then confirm alive: `kill -0 <pid>` after ~5s.

### If reaped by shell

```bash
launchctl submit -l com.walktracker.serve -- /bin/sh -c "exec npx serve dist -l 5180 -s > .freebuff/preview.log 2>&1"
launchctl print gui/$(id -u)/com.walktracker.serve | grep pid
# Clean up: launchctl remove com.walktracker.serve
```

### Port notes

- Default Vite port: 5173
- Static serve port: 5180
- If 5173 is occupied, Vite auto-increments to 5174, 5175, etc.

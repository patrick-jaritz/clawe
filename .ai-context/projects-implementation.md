# Projects Page Implementation

## Overview
Added a projects launcher page to the CLAWE dashboard that allows starting, stopping, and previewing web applications.

## Files Created

### Backend
- `apps/api/projects-config.ts` - Static registry of projects with metadata
- `apps/api/routes/projects.ts` - Express routes for project management
  - GET `/api/projects` - List all projects with running status
  - POST `/api/projects/:id/start` - Start a project dev server
  - POST `/api/projects/:id/stop` - Stop a running project

### Frontend
- `apps/web/src/app/(dashboard)/projects/page.tsx` - Projects dashboard page
  - Grid layout (2 columns on desktop, 1 on mobile)
  - Project cards with status badges, tech stack, and actions
  - Inline preview panel with iframe

## Files Modified
- `apps/api/index.ts` - Registered projects router
- `apps/web/src/lib/api/local.ts` - Added useProjects, startProject, stopProject functions
- `apps/web/src/app/(dashboard)/_components/dashboard-sidebar.tsx` - Added "Projects" nav item with LayoutGrid icon

## Features
- **Start/Stop**: Control project dev servers from the dashboard
- **Status Detection**: Automatic HTTP health checks (1s timeout)
- **Live Preview**: Embedded iframe preview at http://100.117.151.74:{port}
- **Status Badges**: Visual indicators (Running 🟢, Stopped ⚫, No UI 🚫, Planned 🔜)
- **Tech Stack Display**: Shows technologies used per project

## Testing
To test:
1. Start the dev servers: `pnpm dev`
2. Navigate to http://localhost:3000/projects
3. Try starting "Before You Leap" project
4. Once running, click "Preview" to see iframe
5. Click "Stop" to terminate the process

## API Example
```bash
# List all projects
curl http://localhost:3001/api/projects

# Start a project
curl -X POST http://localhost:3001/api/projects/byl/start

# Stop a project
curl -X POST http://localhost:3001/api/projects/byl/stop
```

## Notes
- Process spawning uses detached mode with unref() for background execution
- PATH is set explicitly for spawned processes to find npm/node
- Running status polls every 5 seconds for real-time updates
- Preview uses Tailscale IP (100.117.151.74) for network access

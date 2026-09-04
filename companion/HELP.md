# Multicam Systems Multicam Suite

This module will communicate with Multicam Systems' Multicam Suite software.

## Configuration

- Multicam Software Host/Computer IP
- Port for API as configured in Multicam Software
- Specify API Key
  - Enable this if using API Key as an authentication method in Multicam.
- API Key
- Enable Polling
  - Ability to disable polling for long-running installations, to prevent filling the drive with logs on the Multicam computer. Data can still be manually updated using the "Manually Refresh Data" action
- Polling Interval (ms)
- Enable Verbose Logging

## Actions

Deprecated API groups are intentionally excluded.

### Application

- Start, start with template, and start with room
- Retry a failed start
- Set or toggle Auto/Manual mode
- Manually refresh all API data

### Audio

- Select an audio mixer profile discovered from the API

### Camera

- Reset one or all cameras
- Toggle, enable, or disable automatic framing

### Composer

- Select a Composer file or composition, or untake the current composition
- Change a composition element source

### Conf

- Set a manual microphone, wide shot, or automatic microphone mode
- Set AI dynamism and Auto Frame Flow
- Select a preset bank
- Enable, disable, or reset automatic titling

### Insitu

- Activate or deactivate tags
- Activate layouts
- Recall PTZ presets
- Start or stop a live extract

### Medialist

- Create and select Medialists
- Add media by path or by full media-description JSON
- Play, stop, and pause the selected or a specified Medialist
- Select, play, update, or delete media by API-provided ID
- Set audio mode and after-play behavior
- Move media up, down, to an index, or between indexes
- Clear a Medialist

### Pilot

- Prepare, play, or stop an active-bank sequence
- Stop the running sequence for a camera

### Publisher

- Publish a recording with a fully automated workflow
- Rename or delete a recording
- Remove unavailable recording entries

### Radio

- Set a manual microphone, wide shot, or automatic microphone mode
- Set AI dynamism and Auto Frame Flow overrides
- Select a preset bank
- Enable, disable, or reset automatic titling
- Enable/disable automation and override the current program
- Merge, replace, or clear automation variables using JSON

### Recording

- Start, timed start, Tracking start, pause/resume, and stop
- Set recording split duration
- Start or stop a live extract
- Start or stop all ISO recordings or a recording on one source

### Scenes

- Select a Scene file and take a Scene

### Streaming

- Select a catalog
- Start or stop one profile or all profiles
- Update a profile; the module gets and merges its current model before sending the PUT request

### Studio

- Recall a PTZ preset, optionally allowing recall on a live camera
- Recall a preset and set the camera live
- Store a preset and run auto framing

### Titler

- Select a Titler file and take an element on or off
- Set or clear live Speaker/Panel rows
- Add, update, delete, or replace all Speaker/Panel rows
- Set social-media data and Ticker content
- Row updates get the current row before merging and sending a complete PUT model

### Video

- Change the live source using the fixed `Source 1`–`Source 40`, `PC Input`, or `Medialist` choices
- Restart the output

## SignalR state synchronization

- Connect automatically to `/signalr`, including API-key authentication and automatic reconnection
- Receive real-time events, read current hub state, and refresh dependent API data when needed
- SignalR is used only for state synchronization and is not exposed as a Companion command action

## Presets

- Ready-made buttons are organized by feature for the most common controls
- Presets based on API resources are refreshed when applications, profiles, files, scenes, Medialists, or Titler rows change
- Selection presets pair their action with the matching feedback whenever an observable state is available
- Video source presets select `Source 1`–`Source 40`, `PC Input`, or `Medialist` and turn red while that same source is live

## Feedbacks

### Composer

- Composer - File is currently selected file
- Composer - Composition is the currently selected composition

### Application / Audio / Conf / Insitu / Medialist / Radio

- Application Auto/Manual mode
- Selected audio profile
- Conf and Radio automation mode
- Active Insitu tag and layout
- Selected Medialist

### Scene

- Scene - File is currently selected file
- Scene - Scene is currently selected scene

### Titler

- Titler - File is currently selected file
- Titler - Element is currently visible
- Titler - Element's selected speaker row is live
- Titler - Element's selected panel row is live

### Recording / Streaming / Video

- Recording active and paused
- Streaming profile active
- Video source live

### SignalR

- AssistHub connection active

## Variables

Variables expose the polled and real-time state for Application, Audio, Conf, Insitu, Composer, Medialist, Publisher,
Radio, Recording, Scenes, Streaming, Titler, Video, and media constraints. SignalR variables expose the connection state,
last event and payload, record time, Publisher jobs, microphone and zoom state, crop zones, automation notifications,
social-media messages, live-source changes, piloted devices, and the Assist viewed scene. JSON variables are provided for
complex API models such as application templates, radio automation variables, Titler element structures, and media
constraints.

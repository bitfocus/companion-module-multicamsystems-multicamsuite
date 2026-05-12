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

### Application

- Application - Start
- Application - Start with Room
- Application - Set Auto Mode
- Application - Toggle Auto/Manual Mode
- Application - Manually Refresh Data

### Composer

- Composer - Select File
- Composer - Select Composition
- Composer - Change Element Source

### Medialist

- Medialist - Create
- Medialist - Select
- Medialist - Add Media
- Medialist - Play
- Medialist - Stop
- Medialist - Pause
- Medialist - Move to Index (Selected)

### Publisher

- Publisher - Publish Recording

### Recording

- Recording - Start
- Recording - Start (Duration)
- Recording - Pause/Resume
- Recording - Stop
- Recording - Start All ISO Recordings
- Recording - Stop All ISO Recordings
- Recording - Start ISO Recording
- Recording - Stop ISO Recording

### Scenes

- Scenes - Select Scene File
- Scenes - Take Scene

### Streaming

- Streaming – Select Catalog
- Streaming – Start Profile
- Streaming – Stop Profile
- Streaming – Start All Profiles in Selected Catalog
- Streaming – Stop All Profiles in Selected Catalog

### System

- System - Shutdown

### Titler

- Titler - Set Titler File
- Titler - Take Element Live
- Titler - Set Speaker Row Live
- Titler - Set Panel Row Live
- Titler - Clear Speaker Live Row
- Titler - Clear Panel Live Row
- Titler - Update Speaker Row
- Titler - Update Panel Row
- Titler - Delete Speaker Row
- Titler - Delete Panel Row
- Titler - Clear Speaker Entry (Live)
- Titler - Clear Panel Entry (Live)
- Titler - Add Speaker Entry
- Titler - Update All Speaker Entries
- Titler - Add Panel Entry
- Titler - Update All Panel Entries
- Titler - Set Ticker Content

### Video

- Video - Change Live Source
- Video - Restart Output

## Feedbacks

### Composer

- Composer - File is currently selected file
- Composer - Compostion is in currently selected comnposition

### Scene

- Scene - File is currently selected file
- Scene - Scene is currently selected scene

### Titler

- Titler - File is currently selected file
- Titler - Element is currently visible
- Titler - Element's selected speaker row is live
- Titler - Element's selected panel row is live

## Variables

- Computer Name
- Multicam Name
- Licensed Applications
- Application Version
- Running Application
- Application Auto/Manual State
- Application Snapshot
- Composer - Selected File Name
- Comnposer - Selected File ID
- Composer - Selected Composition Name
- Composer - Selected Composition ID
- Scene - Selected File Name
- Scene - Selected File ID
- Scene - Selected Scene Name
- Scene - Selected Scene ID
- Titler - Selected File Name
- Titler - Selected File ID

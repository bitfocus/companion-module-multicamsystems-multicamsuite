import type { CompanionVariableValues } from '@companion-module/base'

import type { MulticamInstance } from './main.js'

export type VariablesSchema = CompanionVariableValues

export function UpdateVariableDefinitions(self: MulticamInstance): void {
	const variables: Array<{ variableId: string; name: string }> = []

	//computer name
	variables.push({ variableId: 'computerName', name: 'Computer Name' })
	//multicam name
	variables.push({ variableId: 'multicamName', name: 'Multicam Name' })
	//licensed apps
	variables.push({ variableId: 'licensedApps', name: 'Licensed Applications' })
	//application version
	variables.push({ variableId: 'applicationVersion', name: 'Application Version' })

	//running application
	variables.push({ variableId: 'runningApp', name: 'Running Application' })
	//application auto/manual state
	variables.push({ variableId: 'applicationAutoState', name: 'Application Auto/Manual State' })
	variables.push({ variableId: 'rooms', name: 'Available Rooms' })
	variables.push({ variableId: 'selected_room', name: 'Selected Room' })
	variables.push({ variableId: 'selectedRoomId', name: 'Selected Room ID' })
	variables.push({ variableId: 'applicationTemplates', name: 'Application Templates (JSON)' })

	//audio variables
	variables.push({ variableId: 'audioProfiles', name: 'Audio - Available Profiles' })
	variables.push({ variableId: 'audioSelectedProfile', name: 'Audio - Selected Profile' })
	variables.push({ variableId: 'audioSelectedProfileId', name: 'Audio - Selected Profile ID' })

	//Conf variables
	variables.push({ variableId: 'confAutomationMode', name: 'Conf - Automation Mode' })
	variables.push({ variableId: 'confActiveMicrophones', name: 'Conf - Active Microphones' })
	variables.push({ variableId: 'confDynamism', name: 'Conf - Dynamism' })
	variables.push({ variableId: 'confPresetBank', name: 'Conf - Current Preset Bank' })
	variables.push({ variableId: 'confPresetBankId', name: 'Conf - Current Preset Bank ID' })
	variables.push({ variableId: 'confAutoTitling', name: 'Conf - Automatic Titling Enabled' })

	//Insitu variables
	variables.push({ variableId: 'insituActiveTags', name: 'Insitu - Active Tags' })
	variables.push({ variableId: 'insituActiveLayout', name: 'Insitu - Active Layout' })

	//composer variables
	//composer selected file name and id
	variables.push({ variableId: 'composerSelectedFileName', name: 'Composer - Selected File Name' })
	variables.push({ variableId: 'composerSelectedFileId', name: 'Composer - Selected File ID' })
	//composer selected scene name and id
	variables.push({ variableId: 'composerSelectedCompositionSceneName', name: 'Composer - Selected Composition Name' })
	variables.push({ variableId: 'composerSelectedCompositionSceneId', name: 'Composer - Selected Composition ID' })

	//Medialist variables
	variables.push({ variableId: 'medialistSelectedName', name: 'Medialist - Selected Name' })
	variables.push({ variableId: 'medialistSelectedId', name: 'Medialist - Selected ID' })
	variables.push({ variableId: 'medialistSelectedMedia', name: 'Medialist - Selected Media (JSON)' })
	variables.push({ variableId: 'medialistSelectedMediaName', name: 'Medialist - Selected Media Name' })
	variables.push({ variableId: 'medialistSelectedMediaId', name: 'Medialist - Selected Media ID' })
	variables.push({ variableId: 'medialistPlaying', name: 'Medialist - Playing' })
	variables.push({ variableId: 'medialistLoading', name: 'Medialist - Loading' })
	variables.push({ variableId: 'medialistPosition', name: 'Medialist - Playback Position' })

	//Publisher variables
	variables.push({ variableId: 'publisherRecordingCount', name: 'Publisher - Recording Count' })

	//Radio variables
	variables.push({ variableId: 'radioAutomationMode', name: 'Radio - Automation Mode' })
	variables.push({ variableId: 'radioActiveMicrophones', name: 'Radio - Active Microphones' })
	variables.push({ variableId: 'radioDynamism', name: 'Radio - Dynamism' })
	variables.push({ variableId: 'radioPresetBank', name: 'Radio - Current Preset Bank' })
	variables.push({ variableId: 'radioPresetBankId', name: 'Radio - Current Preset Bank ID' })
	variables.push({ variableId: 'radioAutoTitling', name: 'Radio - Automatic Titling Enabled' })
	variables.push({ variableId: 'radioAutomationVariables', name: 'Radio - Automation Variables (JSON)' })

	//Recording variables
	variables.push({ variableId: 'recording', name: 'Recording - Active' })
	variables.push({ variableId: 'recordingState', name: 'Recording - State' })
	variables.push({ variableId: 'recordingPaused', name: 'Recording - Paused' })
	variables.push({ variableId: 'recordingLiveExtract', name: 'Recording - Live Extract Active' })
	variables.push({
		variableId: 'recordingLiveExtractSecondsRemaining',
		name: 'Recording - Live Extract Seconds Remaining',
	})

	//SCENES
	//selected scene file
	variables.push({ variableId: 'sceneSelectedFileName', name: 'Scene - Selected File Name' })
	variables.push({ variableId: 'sceneSelectedFileId', name: 'Scene - Selected File ID' })
	//selected scene
	variables.push({ variableId: 'sceneSelectedSceneName', name: 'Scene - Selected Scene Name' })
	variables.push({ variableId: 'sceneSelectedSceneId', name: 'Scene - Selected Scene ID' })

	//Streaming variables
	variables.push({ variableId: 'streamingSelectedCatalog', name: 'Streaming - Selected Catalog' })
	variables.push({ variableId: 'streamingSelectedCatalogId', name: 'Streaming - Selected Catalog ID' })
	variables.push({ variableId: 'streamingActiveProfiles', name: 'Streaming - Active Profiles' })
	variables.push({ variableId: 'streamingActiveProfileCount', name: 'Streaming - Active Profile Count' })
	variables.push({ variableId: 'streamingAnyActive', name: 'Streaming - Any Profile Active' })

	//titler variables
	//selected file name and id
	variables.push({ variableId: 'titlerSelectedFileName', name: 'Titler - Selected File Name' })
	variables.push({ variableId: 'titlerSelectedFileId', name: 'Titler - Selected File ID' })
	variables.push({ variableId: 'titlerElementStructures', name: 'Titler - Element Structures (JSON)' })

	//Video / settings variables
	variables.push({ variableId: 'videoLiveSource', name: 'Video - Live Source' })
	variables.push({ variableId: 'videoMixerIsComposition', name: 'Video - Mixer is Composition' })
	variables.push({ variableId: 'mediaConstraints', name: 'Settings - Media Constraints (JSON)' })

	//SignalR
	variables.push({ variableId: 'signalrConnected', name: 'SignalR - Connected' })
	variables.push({ variableId: 'signalrLastEvent', name: 'SignalR - Last Event' })
	variables.push({ variableId: 'signalrLastPayload', name: 'SignalR - Last Event Payload (JSON)' })
	variables.push({ variableId: 'signalrRecordTime', name: 'SignalR - Recording Time' })
	variables.push({ variableId: 'signalrLastRecording', name: 'SignalR - Last Recording (JSON)' })
	variables.push({ variableId: 'signalrPublishingJobs', name: 'SignalR - Publishing Jobs (JSON)' })
	variables.push({ variableId: 'signalrSelectedMicrophone', name: 'SignalR - User Selected Microphone' })
	variables.push({ variableId: 'signalrMicrophoneState', name: 'SignalR - Microphone State (JSON)' })
	variables.push({ variableId: 'signalrZoomFeatureEnabled', name: 'SignalR - Zoom Feature Enabled' })
	variables.push({ variableId: 'signalrCropZones', name: 'SignalR - Crop Zones (JSON)' })
	variables.push({ variableId: 'signalrNetworkShare', name: 'SignalR - Network Share (JSON)' })
	variables.push({ variableId: 'signalrPagedRecordings', name: 'SignalR - Paged Recordings (JSON)' })
	variables.push({ variableId: 'signalrAutomationAssistMessage', name: 'SignalR - Automation Assist Message' })
	variables.push({ variableId: 'signalrAutoTitlingConfig', name: 'SignalR - Auto Titling Config (JSON)' })
	variables.push({ variableId: 'signalrAutomationNotification', name: 'SignalR - Automation Notification (JSON)' })
	variables.push({ variableId: 'signalrSocialMediaPost', name: 'SignalR - Social Media Post (JSON)' })
	variables.push({ variableId: 'signalrLiveSourceInfo', name: 'SignalR - Live Source Info (JSON)' })
	variables.push({ variableId: 'signalrLiveSourceChanging', name: 'SignalR - Pending Live Source Info (JSON)' })
	variables.push({ variableId: 'signalrPilotedDevice', name: 'SignalR - Piloted Device (JSON)' })
	variables.push({ variableId: 'signalrAssistViewedScene', name: 'SignalR - Assist Viewed Scene (JSON)' })

	self.setVariableDefinitions(Object.fromEntries(variables.map(({ variableId, name }) => [variableId, { name }])))
}

export function CheckVariables(self: MulticamInstance): void {
	const variableValues: CompanionVariableValues = {}

	self.setVariableValues(variableValues)
}

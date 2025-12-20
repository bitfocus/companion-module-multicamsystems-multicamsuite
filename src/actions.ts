import { CompanionActionDefinitions } from '@companion-module/base'

import type { MulticamInstance } from './main.js'

import { SendCommand } from './api.js'

export function UpdateActions(self: MulticamInstance): void {
	const actions: CompanionActionDefinitions = {}

	//APPLICATION
	actions.applicationStart = {
		name: 'APPLICATION | Start',
		description: 'Starts an application.',
		options: [
			{
				type: 'dropdown',
				label: 'Application Name',
				id: 'applicationName',
				default: self.CHOICES_APPLICATIONS[0].id,
				choices: self.CHOICES_APPLICATIONS,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/application/start?applicationName=${action.options.applicationName}`, 'POST')
		},
	}

	/*actions.applicationStartWithTemplate = {
		name: 'APPLICATION | Start with Template',
		description: 'Starts an application with a specified template.',
		options: [
			{
				type: 'dropdown',
				label: 'Application Name',
				id: 'applicationName',
				default: self.CHOICES_APPLICATIONS[0].id,
				choices: self.CHOICES_APPLICATIONS,
			},
			{
				type: 'textinput',
				label: 'Template Name',
				id: 'templateName',
				default: '',
				required: true,
			},
			{
				type: 'checkbox',
				label: 'Wait for initialization to complete',
				id: 'waitEndOfInit',
				default: false,
			},
		],
		callback: async (action) => {
			const { applicationName, templateName, waitEndOfInit } = action.options
			await SendCommand(
				self,
				`/api/application/startWithTemplate/${applicationName}/${templateName}?waitEndOfInit=${waitEndOfInit}`, 'POST'
			)
		},
	}*/

	actions.applicationStartWithRoom = {
		name: 'APPLICATION | Start with Room',
		description: 'Starts an application with a specified room.',
		options: [
			{
				type: 'textinput',
				label: 'Application Name',
				id: 'applicationName',
				default: 'Studio',
				required: true,
			},
			{
				type: 'textinput',
				label: 'Room ID',
				id: 'roomId',
				default: '',
				required: true,
			},
			{
				type: 'checkbox',
				label: 'Wait for initialization to complete',
				id: 'waitEndOfInit',
				default: false,
			},
		],
		callback: async (action) => {
			const { applicationName, roomId, waitEndOfInit } = action.options
			await SendCommand(
				self,
				`/api/application/startWithRoom/${applicationName}/${roomId}?waitEndOfInit=${waitEndOfInit}`,
				'POST',
			)
		},
	}

	/*actions.applicationRetryFailedStart = {
		name: 'APPLICATION | Retry Failed Start',
		description: 'Retry an application which has failed to start.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/application/retryFailedStart`)
		},
	}*/

	actions.applicationSetAutoMode = {
		name: 'APPLICATION | Set Auto Mode',
		description: 'Sets the auto/manual state of the application.',
		options: [
			{
				type: 'dropdown',
				label: 'Auto Mode',
				id: 'isAutoMode',
				default: 'true',
				choices: [
					{ id: 'true', label: 'Enable Auto Mode' },
					{ id: 'false', label: 'Disable Auto Mode' },
				],
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/application/auto?isAutoMode=${action.options.isAutoMode}`, 'POST')
		},
	}

	actions.applicationToggleAutoMode = {
		name: 'APPLICATION | Toggle Auto/Manual Mode',
		description: 'Toggle the auto/manual state of the application.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/application/auto/toggle`, 'POST')
		},
	}

	/*
	//AUDIO
	actions.audioSelectProfile = {
		name: 'Audio - Select Audio Mixer Profile',
		description: 'Select audio mixer profile',
		options: [
			{
				type: 'dropdown',
				label: 'Profile Name',
				id: 'profileName',
				default: self.CHOICES_AUDIO_PROFILES[0].id,
				choices: self.CHOICES_AUDIO_PROFILES,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v1/audio/profiles/selected?profileName=${action.options.profileName}`)
		},
	}

	//CAMERA
	actions.cameraResetAll = {
		name: 'Camera - Reset All',
		description: 'Performs a "reset" operation on all cameras.',
		options: [],
		callback: async () => {
			await SendCommand(self, '/api/v1/camera/reset/all')
		},
	}

	actions.cameraReset = {
		name: 'Camera - Reset Camera',
		description: 'Reset the specified camera.',
		options: [
			{
				type: 'textinput',
				label: 'Camera ID (e.g. CAM1)',
				id: 'camId',
				default: 'CAM1',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v1/camera/reset/${action.options.camId}`)
		},
	}*/

	//COMPOSER
	actions.composerSelectFile = {
		name: 'COMPOSER | Select File',
		description: 'Select a Composer file.',
		options: [
			{
				type: 'dropdown',
				label: 'Composer File',
				id: 'composerFileId',
				default: self.CHOICES_COMPOSER_FILES[0].id,
				choices: self.CHOICES_COMPOSER_FILES,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v3/composer/selected/${action.options.composerFileId}`, 'POST')
		},
	}

	actions.composerSelectComposition = {
		name: 'COMPOSER | Select Composition',
		description: 'Select a Composition.',
		options: [
			{
				type: 'dropdown',
				label: 'Composition',
				id: 'compositionId',
				default: self.CHOICES_COMPOSER_COMPOSITIONS[0].id,
				choices: self.CHOICES_COMPOSER_COMPOSITIONS,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v3/composer/selected/compositions/selected/${action.options.compositionId}`, 'POST')
		},
	}

	actions.composerChangeElementSource = {
		name: 'COMPOSER | Change Element Source',
		description: 'Changes the composition element source.',
		options: [
			{
				type: 'dropdown',
				label: 'Composition - Element',
				id: 'compositionElementId',
				default: self.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS[0].id,
				choices: self.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS,
			},
			{
				type: 'dropdown',
				label: 'Mixer Video Source (e.g. CAM1)',
				id: 'mixerVideoSource',
				default: 'CAM1',
				choices: self.CHOICES_VIDEO_SOURCES,
			},
		],
		callback: async (action) => {
			const id = action.options.compositionElementId as string
			const [compositionId, elementId] = id.split('_')
			const mixerVideoSource = action.options.mixerVideoSource as string
			await SendCommand(
				self,
				`/api/v3/composer/selected/compositions/selected/${compositionId}/${elementId}/${mixerVideoSource}`,
				'PATCH',
			)
		},
	}

	/*
	//CONF
	actions.confSetMicrophoneManual = {
		name: 'Conf - Set Microphone Manual',
		description: 'Sets manual mode and forces the active microphone.',
		options: [
			{
				type: 'textinput',
				label: 'Microphone ID',
				id: 'mic',
				default: 'MIC1',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/conf/microphones/man/${action.options.mic}`)
		},
	}

	actions.confSetMicrophoneWide = {
		name: 'Conf - Set Wide Shot',
		description: 'Forces wide shot in manual mode.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/conf/microphones/man/wide`)
		},
	}

	actions.confSetMicrophonesAuto = {
		name: 'Conf - Set Auto Mode',
		description: 'Sets microphone mode to automatic.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/conf/microphones/auto`)
		},
	}

	actions.confSetDynamism = {
		name: 'Conf - Set Dynamism Level',
		description: 'Sets the AI dynamism from 0 to 10.',
		options: [
			{
				type: 'number',
				label: 'Score (0–10)',
				id: 'score',
				default: 5,
				min: 0,
				max: 10,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/conf/dynamism?score=${action.options.score}`, 'POST')
		},
	}

	actions.confEnableAutoFrameFlow = {
		name: 'Conf - Enable Auto Frame Flow',
		description: 'Defines if AI should auto frame before setting a solo preset live.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/conf/autoFrameFlow/enable`, 'POST')
		},
	}

	actions.confSetCurrentPresetBank = {
		name: 'Conf - Set Current Preset Bank',
		description: 'Sets the current preset bank.',
		options: [
			{
				type: 'textinput',
				label: 'Bank ID',
				id: 'bankId',
				default: '1',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/conf/presetsbanks/current/${action.options.bankId}`, 'POST')
		},
	}

	actions.confSetAutotitlingState = {
		name: 'Conf - Set Autotitling State',
		description: 'Toggles the state of automatic titling.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/conf/autotitling`, 'POST')
		},
	}

	actions.confResetAutotitling = {
		name: 'Conf - Reset Autotitling',
		description: 'Resets the automatic titling configuration.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/conf/autotitling/reset`, 'POST')
		},
	}

	//INSITU
	actions.insituTagOn = {
		name: 'Insitu - Activate Tag',
		description: 'Activate the specified Insitu tag ("marker" is a synonym due to old days).',
		options: [
			{
				type: 'textinput',
				label: 'Tag Name',
				id: 'tag',
				default: '',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/insitu/tag/on?markerName=${action.options.tag}`, 'POST')
		},
	}

	actions.insituTagOff = {
		name: 'Insitu - Deactivate Tag',
		description: 'Deactivate the specified Insitu tag.',
		options: [
			{
				type: 'textinput',
				label: 'Tag Name',
				id: 'tag',
				default: '',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/insitu/tag/off?markerName=${action.options.tag}`, 'POST')
		},
	}

	actions.insituLayoutsOn = {
		name: 'Insitu - Activate Layout',
		description: 'Activate the specified Insitu layout.',
		options: [
			{
				type: 'textinput',
				label: 'Layout Name',
				id: 'layout',
				default: '',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/insitu/layouts/on?layoutName=${action.options.layout}`, 'POST')
		},
	}

	actions.insituPresetRecall = {
		name: 'Insitu - Recall PTZ Preset',
		description: 'Recalls a preset on a PTZ camera.',
		options: [
			{
				type: 'textinput',
				label: 'Camera Index',
				id: 'cameraIndex',
				default: '',
			},
			{
				type: 'textinput',
				label: 'Preset Index',
				id: 'presetIndex',
				default: '',
			},
		],
		callback: async (action) => {
			await SendCommand(
				self,
				`/api/insitu/preset/recall/${action.options.cameraIndex}/${action.options.presetIndex}`,
				'POST',
			)
		},
	}

	actions.insituLiveExtract = {
		name: 'Insitu - Start/Stop Live Extract',
		description: 'Starts or stops a live extract.',
		options: [
			{
				type: 'dropdown',
				label: 'Action',
				id: 'start',
				default: 'true',
				choices: [
					{ id: 'true', label: 'Start' },
					{ id: 'false', label: 'Stop' },
				],
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/insitu/liveextract?start=${action.options.start}`, 'POST')
		},
	}*/

	//MEDIALIST
	actions.medialistSelect = {
		name: 'Medialist - Select',
		description: 'Select a Medialist',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist',
				id: 'medialist',
				default: self.CHOICES_MEDIALISTS[0]?.id || '',
				choices: self.CHOICES_MEDIALISTS,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v3/medialist/selected/${action.options.medialist}/select`, 'POST')
		},
	}

	actions.medialistAddMedia = {
		name: 'Medialist - Add Media',
		description: 'Adds a media to the selected Medialist',
		options: [
			{
				type: 'textinput',
				label: 'Local Path to Media File',
				id: 'mediaId',
				default: '',
			},
		],
		callback: async (action) => {
			const path = await self.parseVariablesInString(String(action.options.mediaId))
			await SendCommand(self, `/api/v3/medialist/selected/media`, 'POST', path)
		},
	}

	actions.medialistPlay = {
		name: 'Medialist - Play',
		description: 'Plays the currently selected Medialist',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v3/medialist/selected/play`, 'POST')
		},
	}

	actions.medialistStop = {
		name: 'Medialist - Stop',
		description: 'Stops the currently selected Medialist',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v3/medialist/selected/stop`, 'POST')
		},
	}

	actions.medialistPause = {
		name: 'Medialist - Pause',
		description: 'Pauses the currently selected Medialist',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v3/medialist/selected/pause`, 'POST')
		},
	}

	actions.medialistMoveUp = {
		name: 'Medialist - Move Up (Selected)',
		description: 'Moves a media item up in the selected Medialist',
		options: [
			{
				type: 'dropdown',
				label: 'Media',
				id: 'mediaId',
				default: self.CHOICES_MEDIALIST_SELECTED_MEDIA[0]?.id || '',
				choices: self.CHOICES_MEDIALIST_SELECTED_MEDIA,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `medialist/selected/${action.options.mediaId}/moveup`)
		},
	}

	actions.medialistMoveDown = {
		name: 'Medialist - Move Down (Selected)',
		description: 'Moves a media item down in the selected Medialist',
		options: [
			{
				type: 'dropdown',
				label: 'Media',
				id: 'mediaId',
				default: self.CHOICES_MEDIALIST_SELECTED_MEDIA[0]?.id || '',
				choices: self.CHOICES_MEDIALIST_SELECTED_MEDIA,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `medialist/selected/${action.options.mediaId}/movedown`)
		},
	}

	/*

	//PUBLISHER
	actions.publisherPublishRecording = {
		name: 'Publisher - Publish Recording',
		description: 'Starts publishing a recording using the specified workflow',
		options: [
			{
				type: 'textinput',
				label: 'Workflow Name',
				id: 'workflowName',
				default: '',
			},
			{
				type: 'textinput',
				label: 'Recording ID',
				id: 'recordingId',
				default: '',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/publisher/publish/${action.options.workflowName}/${action.options.recordingId}`)
		},
	}

	//RADIO

	actions.radioSetManualMic = {
		name: 'Radio - Set Manual Mic',
		description: 'Forces a specific microphone to be manually active',
		options: [
			{
				type: 'textinput',
				label: 'Mic ID',
				id: 'mic',
				default: '',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/radio/microphones/man/${action.options.mic}`)
		},
	}

	actions.radioSetWideShot = {
		name: 'Radio - Wide Shot',
		description: 'Forces a wide shot manually',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/radio/microphones/man/wide`)
		},
	}

	actions.radioEnableAutoMic = {
		name: 'Radio - Enable Auto Mic',
		description: 'Enables automatic mic switching based on AI',
		options: [],
		callback: async () => {
			await SendCommand(self, '/api/v2/radio/microphones/auto')
		},
	}

	actions.radioSetDynamism = {
		name: 'Radio - Set AI Dynamism',
		description: 'Sets the AI dynamism (0 to 10)',
		options: [
			{
				type: 'number',
				label: 'Dynamism (0–10)',
				id: 'value',
				default: 5,
				min: 0,
				max: 10,
			},
		],
		callback: async (action) => {
			await SendCommand(self, '/api/v2/radio/dynamism?score=' + String(action.options.value), 'POST')
		},
	}

	actions.radioEnableAutoFrameFlow = {
		name: 'Radio - Enable/Disable Auto FrameFlow',
		description: 'Temporarily enables auto-framing before solos. Not persisted.',
		options: [
			{
				type: 'checkbox',
				label: 'Enable Auto FrameFlow',
				id: 'enable',
				default: true,
			},
		],
		callback: async (action) => {
			await SendCommand(
				self,
				`/api/v2/radio/autoFrameFlow/enable?desiredState=${Boolean(action.options.enable)}`,
				'POST',
			)
		},
	}

	actions.radioSetPresetBank = {
		name: 'Radio - Set Preset Bank',
		description: 'Sets the current preset bank',
		options: [
			{
				type: 'dropdown',
				label: 'Bank',
				id: 'bankId',
				default: self.CHOICES_RADIO_PRESET_BANKS[0]?.id || '1',
				choices: self.CHOICES_RADIO_PRESET_BANKS,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/radio/presetsbanks/current/${action.options.bankId}`)
		},
	}

	actions.radioSetAutoTitling = {
		name: 'Radio - Auto Titling On or Off',
		description: 'Sets the state of the automatic titling (on/off)',
		options: [
			{
				type: 'checkbox',
				label: 'Enable Auto Titling',
				id: 'enable',
				default: true,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/radio/api/conf/autotitling?enable=${Boolean(action.options.enable)}`, 'POST')
		},
	}

	actions.radioResetAutoTitling = {
		name: 'Radio - Reset Auto Titling',
		description: 'Resets the state of automatic titling',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/radio/api/conf/autotitling/reset`)
		},
	}

	actions.radioSetAutomationRunning = {
		name: 'Radio - Set Automation Running',
		description: 'Enable or disable running state of automation',
		options: [
			{
				type: 'checkbox',
				label: 'Running',
				id: 'running',
				default: true,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/radio/automation/running?enabled=${Boolean(action.options.running)}`, 'POST')
		},
	}

	actions.radioOverrideCurrentProgram = {
		name: 'Radio - Override Automation for Current Program',
		description: 'Temporarily disables automation until next scene/take notification',
		options: [
			{
				type: 'checkbox',
				label: 'Override Current Program',
				id: 'override',
				default: true,
			},
		],
		callback: async (action) => {
			await SendCommand(
				self,
				`/api/v2/radio/automation/override-current-program?enabled=${Boolean(action.options.override)}`,
				'POST',
			)
		},
	}

	actions.radioForceUpdateVariables = {
		name: 'Radio - Force Update Automation Variables',
		description: 'Triggers an update of declared automation variables',
		options: [],
		callback: async () => {
			await SendCommand(self, 'radio/automation/variables')
		},
	}

	//RECORDING
	actions.recordingStart = {
		name: 'Recording - Start',
		description: 'Starts recording using the currently launched application',
		options: [],
		callback: async () => {
			await SendCommand(self, 'api/recording/start')
		},
	}

	actions.recordingStartDuration = {
		name: 'Recording - Start (Duration)',
		description: 'Starts recording for a set duration using the currently launched app',
		options: [
			{
				type: 'textinput',
				label: 'Duration (00:00:00)',
				id: 'duration',
				default: '00:01:00',
				tooltip: 'Enter duration in HH:MM:SS format',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `api/recording/start/${action.options.duration}`)
		},
	}

	actions.recordingStartTracking = {
		name: 'Recording - Start (Tracking)',
		description: 'Starts recording using the Tracking application',
		options: [
			{
				type: 'textinput',
				label: 'Duration (00:00:00)',
				id: 'duration',
				default: '00:01:00',
				tooltip: 'Enter duration in HH:MM:SS format',
			},
		],
		callback: async (action) => {
			const duration = await self.parseVariablesInString(String(action.options.duration))
			await SendCommand(self, 'api/recording/startRecording', 'POST', duration)
		},
	}

	actions.recordingStop = {
		name: 'Recording - Stop',
		description: 'Stops the current recording',
		options: [],
		callback: async () => {
			await SendCommand(self, 'api/recording/stop')
		},
	}

	actions.recordingPause = {
		name: 'Recording - Pause/Resume',
		description: 'Pauses or resumes the current recording',
		options: [],
		callback: async () => {
			await SendCommand(self, 'api/recording/pause')
		},
	}

	actions.recordingLiveExtract = {
		name: 'Recording - Live Extract Start/Stop',
		description: 'Starts or stops a live extract recording',
		options: [
			{
				type: 'checkbox',
				label: 'Start Live Extract',
				id: 'start',
				default: true,
			},
			{
				type: 'textinput',
				label: 'Duration (in seconds)',
				id: 'duration',
				default: '0',
			},
		],
		callback: async (action) => {
			const duration = await self.parseVariablesInString(String(action.options.duration))
			await SendCommand(
				self,
				`/api/recording/liveextract/start=${Boolean(action.options.start)}&duration=${duration}`,
				'POST',
			)
		},
	}

	actions.recordingAuxStart = {
		name: 'Recording - Start Aux',
		description: 'Starts all configured auxiliary recordings',
		options: [],
		callback: async () => {
			await SendCommand(self, 'recording/aux/start')
		},
	}

	actions.recordingAuxStop = {
		name: 'Recording - Stop Aux',
		description: 'Stops all configured auxiliary recordings',
		options: [],
		callback: async () => {
			await SendCommand(self, 'recording/aux/stop')
		},
	}

	actions.recordingSplit = {
		name: 'Recording - Split',
		description: 'Updates the split settings',
		options: [
			{
				type: 'textinput',
				label: 'New Split Duration',
				id: 'duration',
				default: '0',
				tooltip: 'New duration of the split in minutes (5-320). If 0 or less, splitting is disabled.',
			},
		],
		callback: async (action) => {
			const duration = await self.parseVariablesInString(String(action.options.duration))
			await SendCommand(self, `/api/recording/split?newSplitDuration=${duration}`, 'POST')
		},
	}*/

	//SCENES

	actions.selectSceneFile = {
		name: 'SCENES | Select Scene File',
		description: 'Selects a scene file to be used for switching scenes.',
		options: [
			{
				type: 'dropdown',
				label: 'Scene File',
				id: 'fileId',
				default: self.CHOICES_SCENES_FILES[0]?.id || '',
				choices: self.CHOICES_SCENES_FILES,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/scenes/selected/${action.options.fileId}`, 'POST')
		},
	}

	actions.takeScene = {
		name: 'SCENES | Take Scene',
		description: 'Takes a scene. This pauses scene automation until the next program notification.',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'sceneId',
				default: self.CHOICES_SCENES_FILE_SELECTED_SCENES[0]?.id || '',
				choices: self.CHOICES_SCENES_FILE_SELECTED_SCENES,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/scenes/selected/${action.options.sceneId}/take`, 'POST')
		},
	}
	/*
	//STREAMING
	actions.selectStreamingCatalog = {
		name: 'Streaming - Select Catalog',
		options: [
			{
				type: 'dropdown',
				label: 'Catalog',
				id: 'catalogId',
				default: self.CHOICES_STREAMING_CATALOGS[0]?.id || '',
				choices: self.CHOICES_STREAMING_CATALOGS,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/streaming/selected/${action.options.catalogId}`)
		},
	}

	actions.streamingStartAll = {
		name: 'Streaming - Start All Profiles in Selected Catalog',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/streaming/selected/profiles/startall`)
		},
	}

	actions.streamingStopAll = {
		name: 'Streaming - Stop All Profiles in Selected Catalog',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/streaming/selected/profiles/stopall`)
		},
	}

	actions.streamingStartProfile = {
		name: 'Streaming - Start Profile',
		options: [
			{
				type: 'dropdown',
				label: 'Profile ID',
				id: 'profileId',
				default: self.CHOICES_STREAMING_PROFILES[0]?.id || '',
				choices: self.CHOICES_STREAMING_PROFILES,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/streaming/selected/profile/${action.options.profileId}/start`)
		},
	}

	actions.streamingStopProfile = {
		name: 'Streaming - Stop Profile',
		options: [
			{
				type: 'dropdown',
				label: 'Profile ID',
				id: 'profileId',
				default: self.CHOICES_STREAMING_PROFILES[0]?.id || '',
				choices: self.CHOICES_STREAMING_PROFILES,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/streaming/selected/profile/${action.options.profileId}/stop`)
		},
	}

	//STUDIO

	actions.storePreset = {
		name: 'Studio - Store Preset',
		options: [
			{
				type: 'textinput',
				label: 'Camera Index',
				id: 'cameraIndex',
				default: '0',
			},
			{
				type: 'textinput',
				label: 'Preset Index',
				id: 'presetIndex',
				default: '0',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/studio/preset/store/${action.options.cameraIndex}/${action.options.presetIndex}`)
		},
	}

	actions.autoframeCamera = {
		name: 'Studio - Auto-Frame Camera',
		options: [
			{
				type: 'textinput',
				label: 'Camera Index',
				id: 'cameraIndex',
				default: '0',
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/studio/autoframe/${action.options.cameraIndex}`)
		},
	}
		*/

	//SYSTEM

	actions.shutdownSystem = {
		name: 'SYSTEM | Shutdown',
		description: 'Applies the shutdown action. This will stop all ongoing recordings, streamings and publishings.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v1/system/shutdown`, 'POST')
		},
	}

	//TITLER

	actions.titlerSelectFile = {
		name: 'TITLER | Select Titler File',
		description: 'Selects a Titler file.',
		options: [
			{
				type: 'dropdown',
				label: 'Titler File',
				id: 'fileId',
				default: self.CHOICES_TITLER_FILES[0]?.id || '',
				choices: self.CHOICES_TITLER_FILES,
			},
		],
		callback: async (action) => {
			await SendCommand(self, `/api/v2/titler/selected/${action.options.fileId}`, 'POST')
		},
	}

	actions.titlerElementVisible = {
		name: 'TITLER | Set Element Visible/Invisible',
		description: 'Sets the visibility of a Titler element.',
		options: [
			{
				type: 'dropdown',
				label: 'Element',
				id: 'elementId',
				default: self.CHOICES_TITLER_ELEMENTS[0]?.id || '',
				choices: self.CHOICES_TITLER_ELEMENTS,
			},
			{
				type: 'checkbox',
				label: 'Is On',
				id: 'isOn',
				default: true,
			},
			{
				type: 'checkbox',
				label: 'Is Animated',
				id: 'isAnimate',
				default: true,
			},
		],
		callback: async (action) => {
			await SendCommand(
				self,
				`/api/v2/titler/selected/elements/${action.options.elementId}/visible?isOn=${Boolean(
					action.options.isOn,
				)}&isAnimate=${Boolean(action.options.isAnimate)}`,
				'POST',
			)
		},
	}

	//new action, Set Live Row of Speaker Entry of Element
	actions.titlerSetSpeakerEntryLiveRow = {
		name: 'TITLER | Set Titler Element Speaker Entry Live row',
		description: 'Sets the Speaker live row of the Titler Element.',
		options: [
			{
				type: 'dropdown',
				label: 'Element - Row',
				id: 'rowId',
				default: self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS[0]?.id || '',
				choices: self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS,
			},
		],
		callback: async (action) => {
			//get elementId from actions.options.rowId -- elementId_speaker_rowId
			const id: string = String(action.options.rowId)
			const elementId = id.split('_speaker_')[0]
			const rowId = id.split('_speaker_')[1]

			await SendCommand(self, `/api/v2/titler/selected/elements/${elementId}/speaker/entries/${rowId}/live`, 'POST')
		},
	}

	//Set Live Row of Panel Entry of Element
	actions.titlerSetPanelEntryLiveRow = {
		name: 'TITLER | Set Titler Element Panel Entry Live row',
		description: 'Sets the Panel live row of the Titler Element.',
		options: [
			{
				type: 'dropdown',
				label: 'Element - Row',
				id: 'rowId',
				default: self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS[0]?.id || '',
				choices: self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS,
			},
		],
		callback: async (action) => {
			//get elementId from actions.options.rowId -- elementId_panel_rowId
			const id: string = String(action.options.rowId)
			const elementId = id.split('_panel_')[0]
			const rowId = id.split('_panel_')[1]
			await SendCommand(self, `/api/v2/titler/selected/elements/${elementId}/panel/entries/${rowId}/live`, 'POST')
		},
	}

	/*
	//VIDEO

	actions.videoChangeLiveSource = {
		name: 'Video - Change Live Source',
		description: 'Changes the live video source.',
		options: [
			{
				type: 'textinput',
				label: "Name of the source (ie 'Source 1' or 'PC Input' or 'Medialist')",
				id: 'sourceName',
				default: 'Source 1',
				required: true,
			},
		],
		callback: async (action) => {
			const sourceName = await self.parseVariablesInString(String(action.options.sourceName))
			await SendCommand(self, `/api/video/live/source/${sourceName}`)
		},
	}

	actions.videoRestartOutput = {
		name: 'Video - Restart Output',
		description: 'Restarts the video output.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/video/restartoutput`)
		},
	}
*/
	self.setActionDefinitions(actions)
}

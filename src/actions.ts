import type {
	CompanionActionDefinitions,
	CompanionActionSchemaWithoutResult,
	CompanionOptionValues,
	SomeCompanionActionInputField,
} from '@companion-module/base'

import type { MulticamInstance } from './main.js'

import { SendCommand } from './api.js'
import { runPollCycle, runPollScopes, parseMedialistMediaGlobalChoiceId } from './polling.js'

export type ActionsSchema = Record<string, CompanionActionSchemaWithoutResult<CompanionOptionValues>>

function valueToString(value: unknown): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return `${value}`
	try {
		return JSON.stringify(value) ?? ''
	} catch (_error) {
		return ''
	}
}

function encodePathPart(value: unknown): string {
	return encodeURIComponent(valueToString(value))
}

const RECORDING_AUX_NON_CAMERA_SOURCES = [
	'Unknown',
	'VGA',
	'AUDIO1',
	'AUDIO2',
	'AUDIO3',
	'AUDIO4',
	'AUDIO5',
	'AUDIO6',
	'AUDIO7',
	'AUDIO8',
	'Playlist',
	'Output',
	'Composition',
	'File',
	'WebRTC',
] as const

function normalizeRecordingAuxSource(value: unknown): string | null {
	const source = valueToString(value).trim()
	const cameraMatch = /^(?:Source\s*|CAM)(\d+)$/i.exec(source)
	if (cameraMatch) {
		const cameraNumber = Number(cameraMatch[1])
		return Number.isInteger(cameraNumber) && cameraNumber >= 1 && cameraNumber <= 40 ? `CAM${cameraNumber}` : null
	}

	return RECORDING_AUX_NON_CAMERA_SOURCES.find((candidate) => candidate.toLowerCase() === source.toLowerCase()) ?? null
}

function parseCompositeChoiceId(value: unknown, expectedParts: number): string[] | null {
	try {
		const parsed = JSON.parse(valueToString(value))
		if (!Array.isArray(parsed) || parsed.length !== expectedParts || parsed.some((part) => typeof part !== 'string')) {
			return null
		}
		return parsed
	} catch (_error) {
		return null
	}
}

async function expandOption(_self: MulticamInstance, value: unknown): Promise<string> {
	return valueToString(value)
}

async function parseJsonOption<T>(self: MulticamInstance, value: unknown, label: string): Promise<T | undefined> {
	const expanded = await expandOption(self, value)
	try {
		return JSON.parse(expanded) as T
	} catch (error: any) {
		self.log('error', `${label} is not valid JSON: ${error?.message ?? error}`)
		return undefined
	}
}

function buildQuery(params: Record<string, unknown>): string {
	const query = new URLSearchParams()
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') {
			query.set(key, valueToString(value))
		}
	}
	const result = query.toString()
	return result ? `?${result}` : ''
}

async function sendAndRefresh(
	self: MulticamInstance,
	endpoint: string,
	method: string = 'POST',
	payload: unknown = undefined,
	refresh: boolean = true,
): Promise<any> {
	const result = await SendCommand(self, endpoint, method, payload)
	if (refresh) void runPollCycle(self)
	return result
}

export function UpdateActions(self: MulticamInstance): void {
	const actions: CompanionActionDefinitions<ActionsSchema> = {}

	//APPLICATION
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
			await SendCommand(self, `/api/application/auto?isAutoMode=${valueToString(action.options.isAutoMode)}`, 'POST')
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
			await SendCommand(self, `/api/v3/composer/selected/${valueToString(action.options.composerFileId)}`, 'POST')
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
			await SendCommand(
				self,
				`/api/v3/composer/selected/compositions/selected/${valueToString(action.options.compositionId)}`,
				'POST',
			)
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
				label: 'Source',
				id: 'mixerVideoSource',
				default: 'CAM1',
				choices: self.CHOICES_CAMERA_SOURCES.map((choice) => {
					const cameraNumber = /^CAM(\d+)$/.exec(String(choice.id))?.[1]
					return { id: choice.id, label: cameraNumber ? `Source ${cameraNumber}` : choice.label }
				}),
			},
		],
		callback: async (action) => {
			const id = action.options.compositionElementId as string
			const [compositionId, elementId] = id.split('_')
			const mixerVideoSource = encodeURIComponent(valueToString(action.options.mixerVideoSource))
			await SendCommand(
				self,
				`/api/v3/composer/selected/compositions/selected/${compositionId}/${elementId}/${mixerVideoSource}`,
				'PATCH',
			)
		},
	}

	//MEDIALIST
	actions.medialistSelect = {
		name: 'MEDIALIST | Select',
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
			await SendCommand(self, `/api/v3/medialist/selected/${valueToString(action.options.medialist)}/select`, 'POST')
			//Sync medialist items after selection
			void runPollScopes(self, ['medialist'], { forceSignalRRefresh: true })
		},
	}

	//RECORDING
	actions.recordingStart = {
		name: 'RECORDING | Start',
		description: 'Starts recording using the currently launched application',
		options: [],
		callback: async () => {
			await SendCommand(self, '/api/recording/start', 'POST')
		},
	}

	actions.recordingStartDuration = {
		name: 'RECORDING | Start (Duration)',
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
			const duration = encodeURIComponent(valueToString(action.options.duration))
			await SendCommand(self, `/api/recording/start/${duration}`, 'POST')
		},
	}

	actions.recordingStop = {
		name: 'RECORDING | Stop',
		description: 'Stops the current recording',
		options: [],
		callback: async () => {
			await SendCommand(self, '/api/recording/stop', 'POST')
		},
	}

	actions.recordingPause = {
		name: 'RECORDING | Pause/Resume',
		description: 'Pauses or resumes the current recording',
		options: [],
		callback: async () => {
			await SendCommand(self, '/api/recording/pause', 'POST')
		},
	}

	actions.recordingIsoStart = {
		name: 'RECORDING | Start All ISO Recordings',
		description: 'Starts all configured ISO recordings',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/recording/aux/start`, 'POST')
		},
	}

	actions.recordingIsoStop = {
		name: 'RECORDING | Stop All ISO Recordings',
		description: 'Stops all configured ISO recordings',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/recording/aux/stop`, 'POST')
		},
	}

	/* actions.recordingSplit = {
		name: 'RECORDING | Split',
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
			const duration = String(action.options.duration ?? '')
			await SendCommand(self, `/api/recording/split?newSplitDuration=${duration}`, 'POST')
		},
	} */

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
			await SendCommand(self, `/api/v2/scenes/selected/${valueToString(action.options.fileId)}`, 'POST')
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
			await SendCommand(self, `/api/v2/scenes/selected/${valueToString(action.options.sceneId)}/take`, 'POST')
		},
	}

	//STREAMING
	actions.selectStreamingCatalog = {
		name: 'STREAMING | Select Catalog',
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
			await SendCommand(self, `/api/v2/streaming/selected/${valueToString(action.options.catalogId)}`, 'POST')
		},
	}

	actions.streamingStartAll = {
		name: 'STREAMING | Start All Profiles in Selected Catalog',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/streaming/selected/profiles/startall`, 'POST')
		},
	}

	actions.streamingStopAll = {
		name: 'STREAMING | Stop All Profiles in Selected Catalog',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/v2/streaming/selected/profiles/stopall`, 'POST')
		},
	}

	actions.streamingStartProfile = {
		name: 'STREAMING | Start Profile',
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
			await SendCommand(
				self,
				`/api/v2/streaming/selected/profile/${valueToString(action.options.profileId)}/start`,
				'POST',
			)
		},
	}

	actions.streamingStopProfile = {
		name: 'STREAMING | Stop Profile',
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
			await SendCommand(
				self,
				`/api/v2/streaming/selected/profile/${valueToString(action.options.profileId)}/stop`,
				'POST',
			)
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
			await SendCommand(self, `/api/v2/titler/selected/${valueToString(action.options.fileId)}`, 'POST')
		},
	}

	//VIDEO
	actions.videoRestartOutput = {
		name: 'VIDEO | Restart Output',
		description: 'Restarts the video output.',
		options: [],
		callback: async () => {
			await SendCommand(self, `/api/video/restartoutput`, 'POST')
		},
	}

	//Manual Poll
	actions.manualPoll = {
		name: 'APPLICATION | Manually Refresh Data',
		description: 'Manually poll the application to update data.',
		options: [],
		callback: async () => {
			await runPollCycle(self, { forceSignalRRefresh: true })
			self.log('info', 'Manual poll completed')
		},
	}

	// API v1.4 actions are registered directly here and intentionally replace matching legacy definitions above.
	const BOOLEAN_CHOICES = [
		{ id: 'true', label: 'Enabled' },
		{ id: 'false', label: 'Disabled' },
	]

	function logInvalidChoice(self: MulticamInstance, label: string): void {
		self.log('error', `${label} is invalid. Refresh the module data and select it again.`)
	}

	function normalizeAutomationVariables(value: unknown): { Variables: { Key: string; Value: string }[] } | null {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
		const record = value as Record<string, unknown>
		if (Array.isArray(record.Variables)) {
			const variables = record.Variables.filter(
				(item): item is { Key: string; Value: string } =>
					typeof item === 'object' && item !== null && typeof item.Key === 'string' && typeof item.Value === 'string',
			)
			return { Variables: variables }
		}
		return {
			Variables: Object.entries(record).map(([Key, item]) => ({ Key, Value: valueToString(item) })),
		}
	}

	// APPLICATION
	actions.applicationStart = {
		name: 'APPLICATION | Start',
		description: 'Starts an application.',
		options: [
			{
				type: 'dropdown',
				label: 'Application',
				id: 'applicationName',
				default: self.CHOICES_APPLICATIONS[0]?.id ?? 'none',
				choices: self.CHOICES_APPLICATIONS,
			},
		],
		callback: async (action) => {
			await sendAndRefresh(self, `/api/application/start/${encodePathPart(action.options.applicationName)}`)
		},
	}

	actions.applicationStartWithTemplate = {
		name: 'APPLICATION | Start with Template',
		description: 'Starts an application with one of its available templates.',
		options: [
			{
				type: 'dropdown',
				label: 'Application - Template',
				id: 'applicationTemplate',
				default: self.CHOICES_APPLICATION_TEMPLATES[0]?.id ?? 'none',
				choices: self.CHOICES_APPLICATION_TEMPLATES,
			},
			{
				type: 'checkbox',
				label: 'Wait for initialization to complete',
				id: 'waitEndOfInit',
				default: false,
			},
		],
		callback: async (action) => {
			const parts = parseCompositeChoiceId(action.options.applicationTemplate, 2)
			if (!parts) return logInvalidChoice(self, 'Application template')
			await sendAndRefresh(
				self,
				`/api/application/startWithTemplate/${encodePathPart(parts[0])}/${encodePathPart(parts[1])}${buildQuery({
					waitEndOfInit: Boolean(action.options.waitEndOfInit),
				})}`,
			)
		},
	}

	actions.applicationStartWithRoom = {
		name: 'APPLICATION | Start with Room',
		description: 'Starts an application with a specified room.',
		options: [
			{
				type: 'dropdown',
				label: 'Application',
				id: 'applicationName',
				default: self.CHOICES_APPLICATIONS[0]?.id ?? 'none',
				choices: self.CHOICES_APPLICATIONS,
			},
			{
				type: 'dropdown',
				label: 'Room',
				id: 'roomId',
				default: self.CHOICES_ROOMS[0]?.id ?? 'none',
				choices: self.CHOICES_ROOMS,
			},
			{
				type: 'checkbox',
				label: 'Wait for initialization to complete',
				id: 'waitEndOfInit',
				default: false,
			},
		],
		callback: async (action) => {
			await sendAndRefresh(
				self,
				`/api/application/startWithRoom/${encodePathPart(action.options.applicationName)}/${encodePathPart(
					action.options.roomId,
				)}${buildQuery({ waitEndOfInit: Boolean(action.options.waitEndOfInit) })}`,
			)
		},
	}

	actions.applicationRetryFailedStart = {
		name: 'APPLICATION | Retry Failed Start',
		description: 'Retries an application module which failed to start.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/application/retryFailedStart'),
	}

	actions.composerUntakeComposition = {
		name: 'COMPOSER | Untake Composition',
		description: 'Untakes the current composition using the documented empty composition ID.',
		options: [],
		callback: async () =>
			sendAndRefresh(self, '/api/v3/composer/selected/compositions/selected/00000000-0000-0000-0000-000000000000'),
	}

	// AUDIO
	actions.audioSelectProfile = {
		name: 'AUDIO | Select Mixer Profile',
		description: 'Selects an audio mixer profile by its ID.',
		options: [
			{
				type: 'dropdown',
				label: 'Profile',
				id: 'profileId',
				default: self.CHOICES_AUDIO_PROFILES[0]?.id ?? 'none',
				choices: self.CHOICES_AUDIO_PROFILES,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v1/audio/profiles/selected/${encodePathPart(action.options.profileId)}`),
	}

	// CAMERA
	actions.cameraResetAll = {
		name: 'CAMERA | Reset All',
		description: 'Performs a reset operation on all initialized cameras.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v1/camera/reset/all'),
	}

	actions.cameraReset = {
		name: 'CAMERA | Reset Camera',
		description: 'Resets a specified camera.',
		options: [
			{
				type: 'dropdown',
				label: 'Camera',
				id: 'camId',
				default: self.CHOICES_CAMERA_SOURCES[0]?.id ?? 'CAM1',
				choices: self.CHOICES_CAMERA_SOURCES,
			},
		],
		callback: async (action) => sendAndRefresh(self, `/api/v1/camera/reset/${encodePathPart(action.options.camId)}`),
	}

	actions.cameraAutoFraming = {
		name: 'CAMERA | Set Auto Framing',
		description: 'Toggles, enables or disables auto framing on a camera.',
		options: [
			{
				type: 'dropdown',
				label: 'Camera',
				id: 'camId',
				default: self.CHOICES_CAMERA_SOURCES[0]?.id ?? 'CAM1',
				choices: self.CHOICES_CAMERA_SOURCES,
			},
			{
				type: 'dropdown',
				label: 'Operation',
				id: 'operation',
				default: 'toggle',
				choices: [
					{ id: 'toggle', label: 'Toggle' },
					{ id: 'enable', label: 'Enable' },
					{ id: 'disable', label: 'Disable' },
				],
			},
		],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v1/camera/api/video/autoframing/${encodePathPart(action.options.operation)}/${encodePathPart(
					action.options.camId,
				)}`,
			),
	}

	// CONF V2
	actions.confSetMicrophoneManual = {
		name: 'CONF | Set Manual Microphone',
		description: 'Sets manual mode and forces the selected microphone.',
		options: [
			{
				type: 'dropdown',
				label: 'Microphone',
				id: 'mic',
				default: self.CHOICES_CONF_MICROPHONES[0]?.id ?? 'none',
				choices: self.CHOICES_CONF_MICROPHONES,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v2/conf/microphones/man/${encodePathPart(action.options.mic)}`),
	}

	actions.confSetMicrophoneWide = {
		name: 'CONF | Force Wide Shot',
		description: 'Forces the wide shot in manual mode.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v2/conf/microphones/man/wide'),
	}

	actions.confSetMicrophonesAuto = {
		name: 'CONF | Set Microphones Auto',
		description: 'Sets microphone selection to automatic mode.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v2/conf/microphones/auto'),
	}

	actions.confSetDynamism = {
		name: 'CONF | Set Dynamism',
		description: 'Sets the AI dynamism from 0 to 10.',
		options: [{ type: 'number', label: 'Dynamism', id: 'score', default: 5, min: 0, max: 10 }],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v2/conf/dynamism${buildQuery({ score: Number(action.options.score) })}`),
	}

	actions.confEnableAutoFrameFlow = {
		name: 'CONF | Set Auto Frame Flow',
		description: 'Controls AI auto framing before setting a solo preset live.',
		options: [{ type: 'checkbox', label: 'Enable', id: 'desiredState', default: true }],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v2/conf/autoFrameFlow/enable${buildQuery({ desiredState: Boolean(action.options.desiredState) })}`,
			),
	}

	actions.confSetCurrentPresetBank = {
		name: 'CONF | Select Preset Bank',
		description: 'Sets the current preset bank by ID.',
		options: [
			{
				type: 'dropdown',
				label: 'Preset Bank',
				id: 'bankId',
				default: self.CHOICES_CONF_PRESET_BANKS[0]?.id ?? 'none',
				choices: self.CHOICES_CONF_PRESET_BANKS,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v2/conf/presetsbanks/current/${encodePathPart(action.options.bankId)}`),
	}

	actions.confSetAutotitlingState = {
		name: 'CONF | Set Automatic Titling',
		description: 'Sets automatic titling on or off.',
		options: [{ type: 'checkbox', label: 'Enable', id: 'enable', default: true }],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v2/conf/api/conf/autotitling${buildQuery({ enable: Boolean(action.options.enable) })}`,
			),
	}

	actions.confResetAutotitling = {
		name: 'CONF | Reset Automatic Titling',
		description: 'Resets automatic titling.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v2/conf/api/conf/autotitling/reset'),
	}

	// INSITU
	actions.insituTagOn = {
		name: 'INSITU | Activate Tag',
		description: 'Activates an available Insitu tag.',
		options: [
			{
				type: 'dropdown',
				label: 'Tag',
				id: 'tag',
				default: self.CHOICES_INSITU_TAGS[0]?.id ?? 'none',
				choices: self.CHOICES_INSITU_TAGS,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/insitu/tag/on${buildQuery({ markerName: action.options.tag })}`),
	}

	actions.insituTagOff = {
		name: 'INSITU | Deactivate Tag',
		description: 'Deactivates an Insitu tag.',
		options: [
			{
				type: 'dropdown',
				label: 'Tag',
				id: 'tag',
				default: self.CHOICES_INSITU_TAGS[0]?.id ?? 'none',
				choices: self.CHOICES_INSITU_TAGS,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/insitu/tag/off${buildQuery({ markerName: action.options.tag })}`),
	}

	actions.insituLayoutsOn = {
		name: 'INSITU | Activate Layout',
		description: 'Activates an available Insitu layout.',
		options: [
			{
				type: 'dropdown',
				label: 'Layout',
				id: 'layout',
				default: self.CHOICES_INSITU_LAYOUTS[0]?.id ?? 'none',
				choices: self.CHOICES_INSITU_LAYOUTS,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/insitu/layouts/on${buildQuery({ layoutName: action.options.layout })}`),
	}

	actions.insituPresetRecall = {
		name: 'INSITU | Recall PTZ Preset',
		description: 'Recalls one of the presets discovered from the active room cameras.',
		options: [
			{
				type: 'dropdown',
				label: 'Camera - Preset',
				id: 'preset',
				default: self.CHOICES_INSITU_PRESETS[0]?.id ?? 'none',
				choices: self.CHOICES_INSITU_PRESETS,
			},
		],
		callback: async (action) => {
			const parts = parseCompositeChoiceId(action.options.preset, 2)
			if (!parts) return logInvalidChoice(self, 'Insitu preset')
			await sendAndRefresh(self, `/api/insitu/preset/recall/${encodePathPart(parts[0])}/${encodePathPart(parts[1])}`)
		},
	}

	actions.insituLiveExtract = {
		name: 'INSITU | Start/Stop Live Extract',
		description: 'Starts or stops an Insitu live extract.',
		options: [{ type: 'checkbox', label: 'Start', id: 'start', default: true }],
		callback: async (action) =>
			sendAndRefresh(self, `/api/insitu/liveextract${buildQuery({ start: Boolean(action.options.start) })}`),
	}

	// PILOT
	const pilotSequenceOption = {
		type: 'dropdown' as const,
		label: 'Camera - Sequence',
		id: 'sequence',
		default: self.CHOICES_PILOT_SEQUENCES[0]?.id ?? 'none',
		choices: self.CHOICES_PILOT_SEQUENCES,
	}

	actions.pilotPrepareSequence = {
		name: 'PILOT | Prepare Sequence',
		description: 'Prepares a sequence from the active camera bank.',
		options: [pilotSequenceOption, { type: 'checkbox', label: 'Show in UI', id: 'showInUI', default: true }],
		callback: async (action) => {
			const parts = parseCompositeChoiceId(action.options.sequence, 2)
			if (!parts) return logInvalidChoice(self, 'Pilot sequence')
			await sendAndRefresh(
				self,
				`/api/v1/pilot/activebank/${encodePathPart(parts[0])}/sequence/${encodePathPart(
					parts[1],
				)}/prepare${buildQuery({ showInUI: Boolean(action.options.showInUI) })}`,
			)
		},
	}

	actions.pilotPlaySequence = {
		name: 'PILOT | Play Sequence',
		description: 'Plays a sequence from the active camera bank.',
		options: [
			pilotSequenceOption,
			{ type: 'checkbox', label: 'Prepare first', id: 'prepare', default: true },
			{ type: 'checkbox', label: 'Show in UI', id: 'showInUI', default: true },
			{
				type: 'dropdown',
				label: 'Ping-pong',
				id: 'pingPong',
				default: '',
				choices: [
					{ id: '', label: 'Use UI setting' },
					{ id: 'true', label: 'Enabled' },
					{ id: 'false', label: 'Disabled (one-shot)' },
				],
			},
		],
		callback: async (action) => {
			const parts = parseCompositeChoiceId(action.options.sequence, 2)
			if (!parts) return logInvalidChoice(self, 'Pilot sequence')
			await sendAndRefresh(
				self,
				`/api/v1/pilot/activebank/${encodePathPart(parts[0])}/sequence/${encodePathPart(parts[1])}/play${buildQuery({
					prepare: Boolean(action.options.prepare),
					showInUI: Boolean(action.options.showInUI),
					pingPong: action.options.pingPong,
				})}`,
			)
		},
	}

	actions.pilotStopSequence = {
		name: 'PILOT | Stop Sequence',
		description: 'Stops a specified sequence.',
		options: [pilotSequenceOption],
		callback: async (action) => {
			const parts = parseCompositeChoiceId(action.options.sequence, 2)
			if (!parts) return logInvalidChoice(self, 'Pilot sequence')
			await sendAndRefresh(
				self,
				`/api/v1/pilot/activebank/${encodePathPart(parts[0])}/sequence/${encodePathPart(parts[1])}/stop`,
			)
		},
	}

	actions.pilotStopRunningSequence = {
		name: 'PILOT | Stop Running Sequence',
		description: 'Stops the running sequence, if any, for a camera.',
		options: [
			{
				type: 'dropdown',
				label: 'Camera',
				id: 'cam',
				default: self.CHOICES_CAMERA_SOURCES[0]?.id ?? 'CAM1',
				choices: self.CHOICES_CAMERA_SOURCES,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v1/pilot/activebank/${encodePathPart(action.options.cam)}/sequence/running/stop`),
	}

	// PUBLISHER
	actions.publisherPublishRecording = {
		name: 'PUBLISHER | Publish Recording',
		description: 'Publishes a recording with a fully automated workflow.',
		options: [
			{
				type: 'dropdown',
				label: 'Workflow',
				id: 'workflowName',
				default: self.CHOICES_PUBLISHER_WORKFLOWS[0]?.id ?? 'none',
				choices: self.CHOICES_PUBLISHER_WORKFLOWS,
			},
			{
				type: 'dropdown',
				label: 'Recording',
				id: 'recordingId',
				default: self.CHOICES_PUBLISHER_RECORDINGS[0]?.id ?? 'none',
				choices: self.CHOICES_PUBLISHER_RECORDINGS,
			},
		],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/publisher/publish/${encodePathPart(action.options.workflowName)}/${encodePathPart(
					action.options.recordingId,
				)}`,
			),
	}

	actions.publisherDeleteRecording = {
		name: 'PUBLISHER | Delete Recording',
		description: 'Deletes the selected recording.',
		options: [
			{
				type: 'dropdown',
				label: 'Recording',
				id: 'recordingId',
				default: self.CHOICES_PUBLISHER_RECORDINGS[0]?.id ?? 'none',
				choices: self.CHOICES_PUBLISHER_RECORDINGS,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/publisher/recording/${encodePathPart(action.options.recordingId)}`, 'DELETE'),
	}

	actions.publisherDeleteUnavailableRecordings = {
		name: 'PUBLISHER | Delete Unavailable Recordings',
		description: 'Removes database entries whose recording files are no longer available.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/publisher/recording/unavailables', 'DELETE'),
	}

	actions.publisherRenameRecording = {
		name: 'PUBLISHER | Rename Recording',
		description: 'Renames the selected recording.',
		options: [
			{
				type: 'dropdown',
				label: 'Recording',
				id: 'recordingId',
				default: self.CHOICES_PUBLISHER_RECORDINGS[0]?.id ?? 'none',
				choices: self.CHOICES_PUBLISHER_RECORDINGS,
			},
			{ type: 'textinput', label: 'New Name', id: 'newName', default: '', useVariables: true },
		],
		callback: async (action) => {
			const newName = await expandOption(self, action.options.newName)
			await sendAndRefresh(
				self,
				`/api/publisher/recording/${encodePathPart(action.options.recordingId)}/${encodePathPart(newName)}`,
				'PUT',
			)
		},
	}

	// RADIO V2
	actions.radioSetManualMic = {
		name: 'RADIO | Set Manual Microphone',
		description: 'Sets manual mode and forces a microphone.',
		options: [
			{
				type: 'dropdown',
				label: 'Microphone',
				id: 'mic',
				default: self.CHOICES_RADIO_MICROPHONES[0]?.id ?? 'none',
				choices: self.CHOICES_RADIO_MICROPHONES,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v2/radio/microphones/man/${encodePathPart(action.options.mic)}`),
	}

	actions.radioSetWideShot = {
		name: 'RADIO | Force Wide Shot',
		description: 'Forces the wide shot in manual mode.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v2/radio/microphones/man/wide'),
	}

	actions.radioEnableAutoMic = {
		name: 'RADIO | Set Microphones Auto',
		description: 'Sets microphone selection to automatic mode.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v2/radio/microphones/auto'),
	}

	actions.radioSetDynamism = {
		name: 'RADIO | Set Dynamism',
		description: 'Sets the AI dynamism from 0 to 10.',
		options: [{ type: 'number', label: 'Dynamism', id: 'value', default: 5, min: 0, max: 10 }],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v2/radio/dynamism${buildQuery({ score: Number(action.options.value) })}`),
	}

	actions.radioEnableAutoFrameFlow = {
		name: 'RADIO | Set Auto Frame Flow',
		description: 'Controls AI auto framing before a solo preset is set live.',
		options: [{ type: 'checkbox', label: 'Enable', id: 'enable', default: true }],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v2/radio/autoFrameFlow/enable${buildQuery({ desiredState: Boolean(action.options.enable) })}`,
			),
	}

	actions.radioOverrideAutoFrameFlow = {
		name: 'RADIO | Override Continuous Auto Frame',
		description: 'Temporarily allows or prevents continuous auto framing.',
		options: [{ type: 'checkbox', label: 'Allow', id: 'doAllow', default: true }],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v2/radio/autoFrameFlow/override/${Boolean(action.options.doAllow)}`),
	}

	actions.radioSetPresetBank = {
		name: 'RADIO | Select Preset Bank',
		description: 'Sets the current preset bank.',
		options: [
			{
				type: 'dropdown',
				label: 'Preset Bank',
				id: 'bankId',
				default: self.CHOICES_RADIO_PRESET_BANKS[0]?.id ?? 'none',
				choices: self.CHOICES_RADIO_PRESET_BANKS,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v2/radio/presetsbanks/current/${encodePathPart(action.options.bankId)}`),
	}

	actions.radioSetAutoTitling = {
		name: 'RADIO | Set Automatic Titling',
		description: 'Sets automatic titling on or off.',
		options: [{ type: 'checkbox', label: 'Enable', id: 'enable', default: true }],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v2/radio/api/conf/autotitling${buildQuery({ enable: Boolean(action.options.enable) })}`,
			),
	}

	actions.radioResetAutoTitling = {
		name: 'RADIO | Reset Automatic Titling',
		description: 'Resets automatic titling.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v2/radio/api/conf/autotitling/reset'),
	}

	actions.radioSetAutomationRunning = {
		name: 'RADIO | Set Automation Running',
		description: 'Enables or disables playout automation.',
		options: [{ type: 'checkbox', label: 'Running', id: 'running', default: true }],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v2/radio/automation/running${buildQuery({ enabled: Boolean(action.options.running) })}`,
			),
	}

	actions.radioOverrideCurrentProgram = {
		name: 'RADIO | Override Current Program Automation',
		description: 'Temporarily disables or restores scene automation for the current program.',
		options: [{ type: 'checkbox', label: 'Override', id: 'override', default: true }],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v2/radio/automation/override-current-program${buildQuery({
					enabled: Boolean(action.options.override),
				})}`,
			),
	}

	actions.radioSetAutomationVariables = {
		name: 'RADIO | Set Automation Variables',
		description: 'Updates automation variables. Accepts either an object or the documented Variables payload.',
		options: [
			{
				type: 'dropdown',
				label: 'Update Mode',
				id: 'mode',
				default: 'PUT',
				choices: [
					{ id: 'PUT', label: 'Merge (keep undeclared variables)' },
					{ id: 'POST', label: 'Replace (clear undeclared variables)' },
				],
			},
			{
				type: 'textinput',
				label: 'Variables JSON',
				id: 'variables',
				default: '{"Example":"Value"}',
				useVariables: true,
				tooltip: 'Either {"Key":"Value"} or {"Variables":[{"Key":"Key","Value":"Value"}]}',
			},
		],
		callback: async (action) => {
			const parsed = await parseJsonOption<unknown>(self, action.options.variables, 'Automation variables')
			if (parsed === undefined) return
			const payload = normalizeAutomationVariables(parsed)
			if (!payload) {
				self.log('error', 'Automation variables JSON must be an object')
				return
			}
			await sendAndRefresh(self, '/api/v2/radio/automation/variables', valueToString(action.options.mode), payload)
		},
	}

	actions.radioClearAutomationVariables = {
		name: 'RADIO | Clear Automation Variables',
		description: 'Clears declared playout automation variables.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v2/radio/automation/variables', 'DELETE'),
	}

	// RECORDING
	actions.recordingSplit = {
		name: 'RECORDING | Set Split Duration',
		description: 'Sets the split duration to 5–320 minutes. Zero disables splitting.',
		options: [
			{
				type: 'number',
				label: 'Duration (0 = disabled, or 5–320 minutes)',
				id: 'duration',
				default: 0,
				min: 0,
				max: 320,
				step: 1,
				asInteger: true,
				tooltip: 'Use 0 to disable splitting. Values from 1 through 4 are not supported by Multicam.',
			},
		],
		callback: async (action) => {
			const duration = Number(action.options.duration)
			if (!Number.isInteger(duration) || (duration !== 0 && (duration < 5 || duration > 320))) {
				self.log('error', 'Split duration must be 0 (disabled) or an integer between 5 and 320 minutes.')
				return
			}
			await sendAndRefresh(self, `/api/recording/split${buildQuery({ newSplitDuration: duration })}`)
		},
	}

	actions.recordingStartTracking = {
		name: 'RECORDING | Start Tracking Recording',
		description: 'Starts a Tracking recording with a duration value in the request body.',
		options: [
			{
				type: 'textinput',
				label: 'Duration (HH:MM:SS)',
				id: 'duration',
				default: '00:01:00',
				useVariables: true,
			},
		],
		callback: async (action) => {
			const duration = await expandOption(self, action.options.duration)
			await sendAndRefresh(self, '/api/recording/startRecording', 'POST', duration)
		},
	}

	actions.recordingLiveExtract = {
		name: 'RECORDING | Start/Stop Live Extract',
		description: 'Starts or stops a live extract and optionally specifies its duration.',
		options: [
			{ type: 'checkbox', label: 'Start', id: 'start', default: true },
			{ type: 'number', label: 'Duration (seconds)', id: 'duration', default: 0, min: 0, max: 86400 },
		],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/recording/liveextract${buildQuery({
					start: Boolean(action.options.start),
					duration: Number(action.options.duration),
				})}`,
			),
	}

	for (const [id, name, endpoint] of [
		['recordingIsoStartSource', 'RECORDING | Start ISO Recording', '/api/recording/aux/start'],
		['recordingIsoStopSource', 'RECORDING | Stop ISO Recording', '/api/recording/aux/stop'],
	] as const) {
		actions[id] = {
			name,
			description: `${name} for a selected video source.`,
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'camId',
					default: self.CHOICES_RECORDING_AUX_SOURCES[0]?.id ?? 'Source 1',
					choices: self.CHOICES_RECORDING_AUX_SOURCES,
				},
			],
			callback: async (action) => {
				const camId = normalizeRecordingAuxSource(action.options.camId)
				if (!camId) {
					self.log('error', 'ISO recording source is invalid. Select Source 1–40 or another supported source.')
					return
				}
				await sendAndRefresh(self, `${endpoint}/${encodePathPart(camId)}`)
			},
		}
	}

	// STREAMING V2
	actions.streamingUpdateProfile = {
		name: 'STREAMING | Update Profile',
		description: 'Gets the current profile, merges the requested fields, then sends the complete PUT payload.',
		options: [
			{
				type: 'dropdown',
				label: 'Profile',
				id: 'profileId',
				default: self.CHOICES_STREAMING_PROFILES[0]?.id ?? 'none',
				choices: self.CHOICES_STREAMING_PROFILES,
			},
			{
				type: 'dropdown',
				label: 'Enabled',
				id: 'enabled',
				default: 'keep',
				choices: [{ id: 'keep', label: 'Keep current value' }, ...BOOLEAN_CHOICES],
			},
			{
				type: 'textinput',
				label: 'Profile Name (blank keeps current)',
				id: 'name',
				default: '',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Broadcast Server Hostname (blank keeps current)',
				id: 'hostname',
				default: '',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Broadcast Stream ID (blank keeps current)',
				id: 'streamId',
				default: '',
				useVariables: true,
			},
		],
		callback: async (action) => {
			const profileId = valueToString(action.options.profileId)
			const endpoint = `/api/v2/streaming/selected/profile/${encodePathPart(profileId)}`
			const current = await SendCommand(self, endpoint)
			if (typeof current !== 'object' || current === null || Array.isArray(current)) {
				self.log('error', `Unable to get streaming profile ${profileId} before update`)
				return
			}
			const payload = { ...current }
			if (action.options.enabled !== 'keep') payload.IsEnabled = action.options.enabled === 'true'
			const name = await expandOption(self, action.options.name)
			const hostname = await expandOption(self, action.options.hostname)
			const streamId = await expandOption(self, action.options.streamId)
			if (name) payload.Name = name
			if (hostname) payload.BroadcastServerHostname = hostname
			if (streamId) payload.BroadcastStreamID = streamId
			await sendAndRefresh(self, endpoint, 'PUT', payload)
		},
	}

	// STUDIO
	actions.studioRecallPresetAndSetLive = {
		name: 'STUDIO | Recall Preset and Set Live',
		description: 'Recalls a discovered preset and sets its camera live.',
		options: [
			{
				type: 'dropdown',
				label: 'Camera - Preset',
				id: 'preset',
				default: self.CHOICES_STUDIO_PRESETS[0]?.id ?? 'none',
				choices: self.CHOICES_STUDIO_PRESETS,
			},
		],
		callback: async (action) => {
			const parts = parseCompositeChoiceId(action.options.preset, 2)
			if (!parts) return logInvalidChoice(self, 'Studio preset')
			await sendAndRefresh(
				self,
				`/api/studio/recallpresetandsetlive/${encodePathPart(parts[0])}/${encodePathPart(parts[1])}`,
				'GET',
			)
		},
	}

	actions.studioRecallPreset = {
		name: 'STUDIO | Recall Preset',
		description: 'Recalls a discovered PTZ preset.',
		options: [
			{
				type: 'dropdown',
				label: 'Camera - Preset',
				id: 'preset',
				default: self.CHOICES_STUDIO_PRESETS[0]?.id ?? 'none',
				choices: self.CHOICES_STUDIO_PRESETS,
			},
			{ type: 'checkbox', label: 'Allow recall on live camera', id: 'allowLive', default: false },
		],
		callback: async (action) => {
			const parts = parseCompositeChoiceId(action.options.preset, 2)
			if (!parts) return logInvalidChoice(self, 'Studio preset')
			await sendAndRefresh(
				self,
				`/api/studio/preset/recall/${encodePathPart(parts[0])}/${encodePathPart(parts[1])}/${Boolean(
					action.options.allowLive,
				)}`,
				'GET',
			)
		},
	}

	actions.storePreset = {
		name: 'STUDIO | Store Preset',
		description: 'Stores the current camera position in a preset slot.',
		options: [
			{
				type: 'dropdown',
				label: 'Camera',
				id: 'cameraIndex',
				default: self.CHOICES_CAMERA_INDEXES[0]?.id ?? '0',
				choices: self.CHOICES_CAMERA_INDEXES,
			},
			{ type: 'number', label: 'Preset Index', id: 'presetIndex', default: 0, min: 0, max: 5 },
		],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/studio/preset/store/${encodePathPart(action.options.cameraIndex)}/${encodePathPart(
					action.options.presetIndex,
				)}`,
			),
	}

	actions.autoframeCamera = {
		name: 'STUDIO | Auto Frame Camera',
		description: 'Attempts auto framing on the selected camera.',
		options: [
			{
				type: 'dropdown',
				label: 'Camera',
				id: 'cameraIndex',
				default: self.CHOICES_CAMERA_INDEXES[0]?.id ?? '0',
				choices: self.CHOICES_CAMERA_INDEXES,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/studio/autoframe/${encodePathPart(action.options.cameraIndex)}`),
	}

	// VIDEO
	actions.videoChangeLiveSource = {
		name: 'VIDEO | Change Live Source',
		description: 'Changes the live source using the sources reported by the video mixer.',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'sourceName',
				default: self.CHOICES_VIDEO_SOURCES[0]?.id ?? 'Source 1',
				choices: self.CHOICES_VIDEO_SOURCES,
				disableAutoExpression: true,
			},
		],
		callback: async (action) => sendAndRefresh(self, `/api/video/live/${encodePathPart(action.options.sourceName)}`),
	}

	// Advanced API actions
	function invalidChoice(self: MulticamInstance, label: string): void {
		self.log('error', `${label} is invalid. Refresh module data and select it again.`)
	}

	function isRecord(value: unknown): value is Record<string, any> {
		return typeof value === 'object' && value !== null && !Array.isArray(value)
	}

	type TitlerEntryKind = 'speaker' | 'panel'

	type TitlerColumnDefinition = {
		name: string
		type: string
		isDisplayOptional: boolean
	}

	function getTitlerColumnDefinitions(structure: unknown): TitlerColumnDefinition[] {
		if (!isRecord(structure)) return []
		const definitions = structure.ColumnDefinitions ?? structure.columnDefinitions
		if (!Array.isArray(definitions)) return []

		return definitions.flatMap((definition: unknown) => {
			if (!isRecord(definition)) return []
			const name = String(definition.Name ?? definition.name ?? '').trim()
			if (!name) return []
			return [
				{
					name,
					type: String(definition.Type ?? definition.type ?? 'Text'),
					isDisplayOptional: Boolean(definition.IsDisplayOptional ?? definition.isDisplayOptional),
				},
			]
		})
	}

	function makeStableOptionToken(value: string): string {
		let hash = 0x811c9dc5
		for (let index = 0; index < value.length; index++) {
			hash ^= value.charCodeAt(index)
			hash = Math.imul(hash, 0x01000193)
		}
		return (hash >>> 0).toString(36)
	}

	function makeTitlerColumnOptionId(
		kind: TitlerEntryKind,
		elementId: string,
		columnName: string,
		columnIndex: number,
	): string {
		return `entry_${kind}_${columnIndex}_${makeStableOptionToken(`${elementId}\u0000${columnName}`)}`
	}

	function makeTitlerRowColumnOptionId(
		kind: TitlerEntryKind,
		elementId: string,
		rowId: string,
		columnName: string,
		columnIndex: number,
	): string {
		return `row_entry_${kind}_${columnIndex}_${makeStableOptionToken(`${elementId}\u0000${rowId}\u0000${columnName}`)}`
	}

	function makeTitlerRowDataLinkOptionId(kind: TitlerEntryKind, elementId: string, rowId: string): string {
		return `row_datalink_${kind}_${makeStableOptionToken(`${elementId}\u0000${rowId}`)}`
	}

	function visibleForElement(elementId: string): string {
		return `$(options:elementId) == ${JSON.stringify(elementId)}`
	}

	function visibleForRow(rowChoiceId: string): string {
		return `$(options:rowId) == ${JSON.stringify(rowChoiceId)}`
	}

	function parseTitlerRowChoice(value: unknown, kind: 'speaker' | 'panel'): [string, string] | null {
		const token = `_${kind}_`
		const id = valueToString(value)
		const separator = id.indexOf(token)
		if (separator <= 0 || separator + token.length >= id.length) return null
		return [id.slice(0, separator), id.slice(separator + token.length)]
	}

	function normalizeEntries(value: unknown, label: string): Record<string, string> | undefined {
		const entries = value
		if (!isRecord(entries)) {
			self.log('error', `${label} must be a JSON object`)
			return undefined
		}

		const normalized: Record<string, string> = {}
		for (const [name, entryValue] of Object.entries(entries)) {
			if (entryValue === null || entryValue === undefined) {
				normalized[name] = ''
			} else if (['string', 'number', 'boolean'].includes(typeof entryValue)) {
				normalized[name] = String(entryValue)
			} else {
				self.log('error', `${label} value "${name}" must be a text, number, boolean or null value`)
				return undefined
			}
		}
		return normalized
	}

	async function parseEntries(value: unknown): Promise<Record<string, string> | undefined> {
		const entries = await parseJsonOption<unknown>(self, value, 'Titler entries')
		return entries === undefined ? undefined : normalizeEntries(entries, 'Titler entries')
	}

	function getTitlerStructure(elementId: string, kind: TitlerEntryKind): Record<string, any> | undefined {
		const structure = self.TITLER_ELEMENT_STRUCTURES[`${elementId}:${kind}`]
		return isRecord(structure) ? structure : undefined
	}

	function getTitlerRows(elementId: string, kind: TitlerEntryKind): any[] {
		const element = self.TITLER_SELECTED_FILE_ELEMENTS.find(
			(candidate: any) => String(candidate?.Id ?? '') === elementId,
		)
		const rows = kind === 'panel' ? element?.PanelEntries : element?.SpeakerEntries
		return Array.isArray(rows) ? rows : []
	}

	function getTitlerRow(elementId: string, kind: TitlerEntryKind, rowId: string): Record<string, any> | undefined {
		const row = getTitlerRows(elementId, kind).find((candidate: any) => String(candidate?.Id ?? '') === rowId)
		return isRecord(row) ? row : undefined
	}

	function buildPanelEntryOptions(): SomeCompanionActionInputField[] {
		const options: SomeCompanionActionInputField[] = [
			{
				type: 'dropdown',
				label: 'Panel Element',
				id: 'elementId',
				default: self.CHOICES_TITLER_PANEL_ELEMENTS[0]?.id ?? 'none',
				choices: self.CHOICES_TITLER_PANEL_ELEMENTS,
				disableAutoExpression: true,
				description: 'Select a Panel to load its columns automatically.',
			},
		]

		for (const element of self.CHOICES_TITLER_PANEL_ELEMENTS) {
			const elementId = String(element.id)
			const structure = getTitlerStructure(elementId, 'panel')
			const columns = getTitlerColumnDefinitions(structure)
			const visibility = visibleForElement(elementId)
			const infoId = `panel_columns_${makeStableOptionToken(elementId)}`

			if (columns.length === 0) {
				options.push({
					type: 'static-text',
					label: 'Panel Columns',
					id: infoId,
					value:
						elementId.toLowerCase() === 'none'
							? 'No Panel is currently available.'
							: 'The Panel structure has not been loaded yet. Start Titler and wait for the module refresh.',
					isVisibleExpression: visibility,
				})
				continue
			}

			const dataLinkElement = String(structure?.DataLinkElement ?? structure?.dataLinkElement ?? '').trim()
			const isDataLinked = Boolean(structure?.IsDataLinked ?? structure?.isDataLinked)
			options.push({
				type: 'static-text',
				label: 'Panel Columns',
				id: infoId,
				value: `${columns.length} column${columns.length === 1 ? '' : 's'} detected automatically.${
					isDataLinked ? ` Data-linked${dataLinkElement ? ` to ${dataLinkElement}` : ''}.` : ''
				}`,
				isVisibleExpression: visibility,
			})

			for (const [columnIndex, column] of columns.entries()) {
				const isImage = column.type.toLowerCase() === 'image'
				options.push({
					type: 'textinput',
					label: `${column.name}${column.isDisplayOptional ? ' (display optional)' : ''}${isImage ? ' [Image]' : ''}`,
					id: makeTitlerColumnOptionId('panel', elementId, column.name, columnIndex),
					default: '',
					useVariables: true,
					description: isImage
						? 'Enter the image/media value expected by Multicam.'
						: 'The column name and Entries object are generated automatically.',
					isVisibleExpression: visibility,
				})
			}
		}

		options.push(
			{
				type: 'textinput',
				label: 'Data Link Parameter',
				id: 'dataLinkParameter',
				default: '',
				useVariables: true,
				description: 'Only needed by data-linked Panels.',
			},
			{
				type: 'checkbox',
				label: 'Show Advanced JSON Override',
				id: 'showAdvancedEntries',
				default: false,
				disableAutoExpression: true,
			},
			{
				type: 'textinput',
				label: 'Advanced Entries Override (JSON object)',
				id: 'entries',
				default: '{}',
				useVariables: true,
				isVisibleExpression: '$(options:showAdvancedEntries)',
				description: 'Optional. These values are merged over the automatically generated columns.',
			},
		)

		return options
	}

	function buildPanelUpdateRowOptions(
		rowChoices: Array<{ id: string; label: string }>,
	): SomeCompanionActionInputField[] {
		const options: SomeCompanionActionInputField[] = [
			{
				type: 'dropdown',
				label: 'Element - Row',
				id: 'rowId',
				default: rowChoices[0]?.id ?? 'none',
				choices: rowChoices,
				disableAutoExpression: true,
				description: 'Select a Panel row to load its current values automatically.',
			},
		]

		for (const rowChoice of rowChoices) {
			const rowChoiceId = String(rowChoice.id)
			const parts = parseTitlerRowChoice(rowChoiceId, 'panel')
			const visibility = visibleForRow(rowChoiceId)
			const infoId = `panel_update_row_${makeStableOptionToken(rowChoiceId)}`

			if (!parts) {
				options.push({
					type: 'static-text',
					label: 'Panel Row',
					id: infoId,
					value: 'No Panel row is currently available.',
					isVisibleExpression: visibility,
				})
				continue
			}

			const [elementId, rowId] = parts
			const columns = getTitlerColumnDefinitions(getTitlerStructure(elementId, 'panel'))
			const row = getTitlerRow(elementId, 'panel', rowId)
			options.push({
				type: 'static-text',
				label: 'Panel Row',
				id: infoId,
				value:
					columns.length > 0
						? `${columns.length} column${columns.length === 1 ? '' : 's'} loaded from the selected row.`
						: 'The Panel structure has not been loaded yet. Start Titler and wait for the module refresh.',
				isVisibleExpression: visibility,
			})

			for (const [columnIndex, column] of columns.entries()) {
				const isImage = column.type.toLowerCase() === 'image'
				options.push({
					type: 'textinput',
					label: `${column.name}${column.isDisplayOptional ? ' (display optional)' : ''}${isImage ? ' [Image]' : ''}`,
					id: makeTitlerRowColumnOptionId('panel', elementId, rowId, column.name, columnIndex),
					default: valueToString(row?.Entries?.[column.name] ?? ''),
					useVariables: true,
					isVisibleExpression: visibility,
				})
			}

			options.push({
				type: 'textinput',
				label: 'Data Link Parameter',
				id: makeTitlerRowDataLinkOptionId('panel', elementId, rowId),
				default: valueToString(row?.DataLinkParameter ?? ''),
				useVariables: true,
				isVisibleExpression: visibility,
			})
		}

		options.push(
			{ type: 'checkbox', label: 'Replace All Entries', id: 'replaceEntries', default: false },
			{
				type: 'checkbox',
				label: 'Show Advanced JSON Override',
				id: 'showAdvancedEntries',
				default: false,
				disableAutoExpression: true,
			},
			{
				type: 'textinput',
				label: 'Advanced Entries Override (JSON object)',
				id: 'entries',
				default: '{}',
				useVariables: true,
				isVisibleExpression: '$(options:showAdvancedEntries)',
			},
			{
				type: 'textinput',
				label: 'Advanced Data Link Parameter',
				id: 'dataLinkParameter',
				default: '',
				useVariables: true,
				isVisibleExpression: '$(options:showAdvancedEntries)',
			},
			{ type: 'checkbox', label: 'Reset Auto-Off Timer', id: 'resetTimer', default: true },
		)

		return options
	}

	function buildPanelUpdateAllOptions(): SomeCompanionActionInputField[] {
		const options: SomeCompanionActionInputField[] = [
			{
				type: 'dropdown',
				label: 'Panel Element',
				id: 'elementId',
				default: self.CHOICES_TITLER_PANEL_ELEMENTS[0]?.id ?? 'none',
				choices: self.CHOICES_TITLER_PANEL_ELEMENTS,
				disableAutoExpression: true,
				description: 'Select a Panel to load every existing row and column automatically.',
			},
		]

		for (const element of self.CHOICES_TITLER_PANEL_ELEMENTS) {
			const elementId = String(element.id)
			const visibility = visibleForElement(elementId)
			const columns = getTitlerColumnDefinitions(getTitlerStructure(elementId, 'panel'))
			const rows = getTitlerRows(elementId, 'panel')
			const infoId = `panel_update_all_${makeStableOptionToken(elementId)}`
			options.push({
				type: 'static-text',
				label: 'Panel Rows',
				id: infoId,
				value:
					columns.length === 0
						? 'The Panel structure has not been loaded yet. Start Titler and wait for the module refresh.'
						: rows.length === 0
							? 'This Panel has no existing rows. Use Add Panel Entry first.'
							: `${rows.length} row${rows.length === 1 ? '' : 's'} and ${columns.length} column${
									columns.length === 1 ? '' : 's'
								} loaded automatically.`,
				isVisibleExpression: visibility,
			})

			for (const [rowIndex, row] of rows.entries()) {
				const rowId = valueToString(row?.Id)
				if (!rowId) continue
				const currentValues = columns
					.map((column) => valueToString(row?.Entries?.[column.name]))
					.filter(Boolean)
					.join(' - ')
				options.push({
					type: 'static-text',
					label: `Row ${rowIndex + 1}`,
					id: `panel_update_all_row_${makeStableOptionToken(`${elementId}\u0000${rowId}`)}`,
					value: currentValues || rowId,
					isVisibleExpression: visibility,
				})

				for (const [columnIndex, column] of columns.entries()) {
					const isImage = column.type.toLowerCase() === 'image'
					options.push({
						type: 'textinput',
						label: `Row ${rowIndex + 1} - ${column.name}${
							column.isDisplayOptional ? ' (display optional)' : ''
						}${isImage ? ' [Image]' : ''}`,
						id: makeTitlerRowColumnOptionId('panel', elementId, rowId, column.name, columnIndex),
						default: valueToString(row?.Entries?.[column.name] ?? ''),
						useVariables: true,
						isVisibleExpression: visibility,
					})
				}

				options.push({
					type: 'textinput',
					label: `Row ${rowIndex + 1} - Data Link Parameter`,
					id: makeTitlerRowDataLinkOptionId('panel', elementId, rowId),
					default: valueToString(row?.DataLinkParameter ?? ''),
					useVariables: true,
					isVisibleExpression: visibility,
				})
			}
		}

		options.push(
			{
				type: 'checkbox',
				label: 'Use Advanced Rows JSON',
				id: 'showAdvancedRows',
				default: false,
				disableAutoExpression: true,
			},
			{
				type: 'textinput',
				label: 'Advanced Rows Override (JSON array)',
				id: 'rows',
				default: '[]',
				useVariables: true,
				isVisibleExpression: '$(options:showAdvancedRows)',
			},
			{ type: 'checkbox', label: 'Reset Auto-Off Timer', id: 'resetTimer', default: true },
		)

		return options
	}

	function normalizePanelRows(value: unknown): Record<string, unknown>[] | undefined {
		if (!Array.isArray(value)) {
			self.log('error', 'Panel rows must be a JSON array')
			return undefined
		}

		const normalizedRows: Record<string, unknown>[] = []
		for (const [rowIndex, row] of value.entries()) {
			if (!isRecord(row)) {
				self.log('error', `Panel row ${rowIndex + 1} must be a JSON object`)
				return undefined
			}
			const entries = normalizeEntries(row.Entries ?? row.entries ?? {}, `Panel row ${rowIndex + 1} Entries`)
			if (!entries) return undefined

			const normalizedRow: Record<string, unknown> = {
				Status: valueToString(row.Status ?? row.status) || 'Available',
				DataLinkParameter: valueToString(row.DataLinkParameter ?? row.dataLinkParameter),
				Entries: entries,
			}
			const id = valueToString(row.Id ?? row.id).trim()
			if (id) normalizedRow.Id = id
			normalizedRows.push(normalizedRow)
		}
		return normalizedRows
	}

	// MEDIALIST V3
	actions.medialistCreate = {
		name: 'MEDIALIST | Create',
		description: 'Creates a new empty Medialist with the documented settings.',
		options: [
			{ type: 'textinput', label: 'Name', id: 'name', default: 'New Medialist', useVariables: true },
			{ type: 'checkbox', label: 'Loop', id: 'isLooped', default: false },
			{ type: 'checkbox', label: 'Auto Take', id: 'isAutoTake', default: false },
			{ type: 'checkbox', label: 'Auto Play', id: 'isAutoPlay', default: false },
			{
				type: 'number',
				label: 'Transition Duration',
				id: 'transitionDuration',
				default: 0,
				min: 0,
				max: 3600,
			},
			{ type: 'checkbox', label: 'Generate Thumbnail at Load', id: 'generateThumbnail', default: true },
			{ type: 'checkbox', label: 'Persistent', id: 'isPersistent', default: true },
		],
		callback: async (action) => {
			const name = await expandOption(self, action.options.name)
			await sendAndRefresh(self, '/api/v3/medialist', 'POST', {
				Name: name,
				Items: [],
				IsLooped: Boolean(action.options.isLooped),
				IsAutoTake: Boolean(action.options.isAutoTake),
				IsAutoPlay: Boolean(action.options.isAutoPlay),
				TransitionDuration: Number(action.options.transitionDuration),
				GenerateThumbnailAtLoad: Boolean(action.options.generateThumbnail),
				IsPersistent: Boolean(action.options.isPersistent),
			})
		},
	}

	actions.medialistPlay = {
		name: 'MEDIALIST | Selected Medialist - Play',
		description: 'Plays the currently selected Medialist.',
		options: [{ type: 'checkbox', label: 'Take to PGM', id: 'take', default: true }],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v3/medialist/selected/play${buildQuery({ take: Boolean(action.options.take) })}`),
	}

	actions.medialistStop = {
		name: 'MEDIALIST | Selected Medialist - Stop',
		description: 'Stops the currently selected Medialist.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v3/medialist/selected/stop', 'POST', true),
	}

	actions.medialistPause = {
		name: 'MEDIALIST | Selected Medialist - Pause',
		description: 'Pauses the currently selected Medialist.',
		options: [],
		callback: async () => sendAndRefresh(self, '/api/v3/medialist/selected/pause'),
	}

	actions.medialistPlayMedia = {
		name: 'MEDIALIST | Selected Medialist - Select and Play Media',
		description: 'Selects and plays a media item from the selected Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Media',
				id: 'mediaId',
				default: self.CHOICES_MEDIALIST_SELECTED_MEDIA[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALIST_SELECTED_MEDIA,
			},
			{ type: 'checkbox', label: 'Play from Beginning', id: 'playFromBeginning', default: true },
		],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v3/medialist/selected/${encodePathPart(action.options.mediaId)}${buildQuery({
					playFromBeginning: Boolean(action.options.playFromBeginning),
				})}`,
			),
	}

	actions.medialistPlayMediaByIndex = {
		name: 'MEDIALIST | Selected Medialist - Select and Play by Index',
		description: 'Selects and plays a media item from the selected Medialist by zero-based index.',
		options: [
			{ type: 'textinput', label: 'Media Index', id: 'mediaIndex', default: '0', useVariables: true },
			{ type: 'checkbox', label: 'Play from Beginning', id: 'playFromBeginning', default: true },
		],
		callback: async (action) => {
			const mediaIndex = await expandOption(self, action.options.mediaIndex)
			await sendAndRefresh(
				self,
				`/api/v3/medialist/selected/${encodePathPart(mediaIndex)}${buildQuery({
					playFromBeginning: Boolean(action.options.playFromBeginning),
				})}`,
			)
		},
	}

	actions.medialistDeleteMedia = {
		name: 'MEDIALIST | Selected Medialist - Delete Media',
		description: 'Deletes a media item from the selected Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Media',
				id: 'mediaId',
				default: self.CHOICES_MEDIALIST_SELECTED_MEDIA[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALIST_SELECTED_MEDIA,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v3/medialist/selected/${encodePathPart(action.options.mediaId)}`, 'DELETE'),
	}

	actions.medialistAddMedia = {
		name: 'MEDIALIST | Selected Medialist - Add Media',
		description: 'Adds a local media path to the selected Medialist.',
		options: [
			{
				type: 'textinput',
				label: 'Local Path to Media File',
				id: 'mediaId',
				default: '',
				useVariables: true,
			},
		],
		callback: async (action) => {
			const path = await expandOption(self, action.options.mediaId)
			await sendAndRefresh(self, '/api/v3/medialist/selected/media', 'POST', path)
		},
	}

	actions.medialistPlayCustom = {
		name: 'MEDIALIST | Custom Medialist - Play',
		description: 'Plays a specified Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist',
				id: 'medialistId',
				default: self.CHOICES_MEDIALISTS[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALISTS,
			},
			{ type: 'checkbox', label: 'Take to PGM', id: 'take', default: true },
		],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(action.options.medialistId)}/play${buildQuery({
					take: Boolean(action.options.take),
				})}`,
			),
	}

	actions.medialistPlayMediaCustom = {
		name: 'MEDIALIST | Custom Medialist - Select and Play Media',
		description: 'Selects and plays a media item in a specified Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist - Media',
				id: 'medialistMedia',
				default: self.CHOICES_MEDIALISTS_MEDIA[0]?.id ?? 'None',
				choices: self.CHOICES_MEDIALISTS_MEDIA,
			},
			{ type: 'checkbox', label: 'Play from Beginning', id: 'playFromBeginning', default: true },
		],
		callback: async (action) => {
			const selected = parseMedialistMediaGlobalChoiceId(valueToString(action.options.medialistMedia))
			if (!selected) return invalidChoice(self, 'Medialist media')
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(selected.medialistId)}/${encodePathPart(selected.mediaId)}${buildQuery({
					playFromBeginning: Boolean(action.options.playFromBeginning),
				})}`,
			)
		},
	}

	actions.medialistPlayMediaCustomByIndex = {
		name: 'MEDIALIST | Custom Medialist - Select and Play by Index',
		description: 'Selects and plays a media item by zero-based index in a specified Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist',
				id: 'medialistId',
				default: self.CHOICES_MEDIALISTS[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALISTS,
			},
			{ type: 'textinput', label: 'Media Index', id: 'mediaIndex', default: '0', useVariables: true },
			{ type: 'checkbox', label: 'Play from Beginning', id: 'playFromBeginning', default: true },
		],
		callback: async (action) => {
			const mediaIndex = await expandOption(self, action.options.mediaIndex)
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(action.options.medialistId)}/${encodePathPart(mediaIndex)}${buildQuery({
					playFromBeginning: Boolean(action.options.playFromBeginning),
				})}`,
			)
		},
	}

	actions.medialistSelectMediaCustom = {
		name: 'MEDIALIST | Custom Medialist - Select Media',
		description: 'Selects a media item without starting playback.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist - Media',
				id: 'medialistMedia',
				default: self.CHOICES_MEDIALISTS_MEDIA[0]?.id ?? 'None',
				choices: self.CHOICES_MEDIALISTS_MEDIA,
			},
		],
		callback: async (action) => {
			const selected = parseMedialistMediaGlobalChoiceId(valueToString(action.options.medialistMedia))
			if (!selected) return invalidChoice(self, 'Medialist media')
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(selected.medialistId)}/${encodePathPart(selected.mediaId)}/select`,
			)
		},
	}

	actions.medialistDeleteMediaCustom = {
		name: 'MEDIALIST | Custom Medialist - Delete Media',
		description: 'Deletes a selected media item from its Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist - Media',
				id: 'medialistMedia',
				default: self.CHOICES_MEDIALISTS_MEDIA[0]?.id ?? 'None',
				choices: self.CHOICES_MEDIALISTS_MEDIA,
			},
		],
		callback: async (action) => {
			const selected = parseMedialistMediaGlobalChoiceId(valueToString(action.options.medialistMedia))
			if (!selected) return invalidChoice(self, 'Medialist media')
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(selected.medialistId)}/${encodePathPart(selected.mediaId)}`,
				'DELETE',
			)
		},
	}

	actions.medialistAddMediaCustom = {
		name: 'MEDIALIST | Custom Medialist - Add Media',
		description: 'Adds a local media path to a specified Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist',
				id: 'medialistId',
				default: self.CHOICES_MEDIALISTS[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALISTS,
			},
			{ type: 'textinput', label: 'Local Path to Media File', id: 'path', default: '', useVariables: true },
		],
		callback: async (action) => {
			const path = await expandOption(self, action.options.path)
			await sendAndRefresh(self, `/api/v3/medialist/${encodePathPart(action.options.medialistId)}/media`, 'POST', path)
		},
	}

	actions.medialistAddMediaDescription = {
		name: 'MEDIALIST | Custom Medialist - Add Media Description',
		description: 'Adds a full media description JSON object at an optional insertion index.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist',
				id: 'medialistId',
				default: self.CHOICES_MEDIALISTS[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALISTS,
			},
			{
				type: 'textinput',
				label: 'Insertion Index (blank = end)',
				id: 'insertionIndex',
				default: '',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Media Description JSON',
				id: 'description',
				default: '{"MediaName":"Media","FilePath":"C:\\\\path\\\\file.mp4"}',
				useVariables: true,
			},
		],
		callback: async (action) => {
			const payload = await parseJsonOption<Record<string, unknown>>(
				self,
				action.options.description,
				'Media description',
			)
			if (!isRecord(payload)) {
				if (payload !== undefined) self.log('error', 'Media description must be a JSON object')
				return
			}
			const insertionIndex = await expandOption(self, action.options.insertionIndex)
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(action.options.medialistId)}/mediadescription${buildQuery({
					insertionIndex,
				})}`,
				'POST',
				payload,
			)
		},
	}

	actions.medialistClear = {
		name: 'MEDIALIST | Custom Medialist - Clear',
		description: 'Clears all non-live items from the specified Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist',
				id: 'medialistId',
				default: self.CHOICES_MEDIALISTS[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALISTS,
			},
		],
		callback: async (action) =>
			sendAndRefresh(self, `/api/v3/medialist/${encodePathPart(action.options.medialistId)}/clear`),
	}

	actions.medialistUpdateMedia = {
		name: 'MEDIALIST | Update Media Description',
		description: 'Gets the current media model, merges the JSON fields, then sends the complete PUT payload.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist - Media',
				id: 'medialistMedia',
				default: self.CHOICES_MEDIALISTS_MEDIA[0]?.id ?? 'None',
				choices: self.CHOICES_MEDIALISTS_MEDIA,
			},
			{
				type: 'textinput',
				label: 'Fields to Merge (JSON)',
				id: 'patch',
				default: '{"InPoint":0,"OutPoint":0}',
				useVariables: true,
			},
		],
		callback: async (action) => {
			const selected = parseMedialistMediaGlobalChoiceId(valueToString(action.options.medialistMedia))
			if (!selected) return invalidChoice(self, 'Medialist media')
			const patch = await parseJsonOption<Record<string, unknown>>(self, action.options.patch, 'Media fields')
			if (!isRecord(patch)) {
				if (patch !== undefined) self.log('error', 'Media fields must be a JSON object')
				return
			}
			const medialist = await SendCommand(self, `/api/v3/medialist/${encodePathPart(selected.medialistId)}`)
			const current = Array.isArray(medialist?.Items)
				? medialist.Items.find((item: any) => String(item?.Id) === selected.mediaId)
				: undefined
			if (!isRecord(current)) {
				self.log('error', 'Unable to retrieve the selected media before update')
				return
			}
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(selected.medialistId)}/${encodePathPart(selected.mediaId)}`,
				'PUT',
				{ ...current, ...patch, Id: current.Id },
			)
		},
	}

	actions.medialistSetAudioMode = {
		name: 'MEDIALIST | Set Media Audio Mode',
		description: 'Sets a media item audio mode.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist - Media',
				id: 'medialistMedia',
				default: self.CHOICES_MEDIALISTS_MEDIA[0]?.id ?? 'None',
				choices: self.CHOICES_MEDIALISTS_MEDIA,
			},
			{
				type: 'dropdown',
				label: 'Audio Mode',
				id: 'audioMode',
				default: 'Mix',
				choices: [
					{ id: 'Mix', label: 'Mix' },
					{ id: 'Mute', label: 'Mute' },
					{ id: 'Solo', label: 'Solo' },
				],
			},
		],
		callback: async (action) => {
			const selected = parseMedialistMediaGlobalChoiceId(valueToString(action.options.medialistMedia))
			if (!selected) return invalidChoice(self, 'Medialist media')
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(selected.medialistId)}/${encodePathPart(
					selected.mediaId,
				)}/audiomode${buildQuery({ audioMode: action.options.audioMode })}`,
				'PUT',
			)
		},
	}

	actions.medialistSetAfterPlay = {
		name: 'MEDIALIST | Set Media After Play',
		description: 'Sets a media item after-play behavior.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist - Media',
				id: 'medialistMedia',
				default: self.CHOICES_MEDIALISTS_MEDIA[0]?.id ?? 'None',
				choices: self.CHOICES_MEDIALISTS_MEDIA,
			},
			{
				type: 'dropdown',
				label: 'After Play',
				id: 'afterPlay',
				default: 'Next',
				choices: [
					{ id: 'Next', label: 'Next' },
					{ id: 'Stop', label: 'Stop' },
					{ id: 'Loop', label: 'Loop' },
					{ id: 'PauseOnLastFrame', label: 'Pause on Last Frame' },
				],
			},
		],
		callback: async (action) => {
			const selected = parseMedialistMediaGlobalChoiceId(valueToString(action.options.medialistMedia))
			if (!selected) return invalidChoice(self, 'Medialist media')
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(selected.medialistId)}/${encodePathPart(
					selected.mediaId,
				)}/afterplay${buildQuery({ afterPlay: action.options.afterPlay })}`,
				'PUT',
			)
		},
	}

	for (const [id, label, suffix] of [
		['medialistMoveUp', 'Move Up', 'moveup'],
		['medialistMoveDown', 'Move Down', 'movedown'],
	] as const) {
		actions[id] = {
			name: `MEDIALIST | Selected Medialist - ${label}`,
			description: `${label}s a media item in the selected Medialist.`,
			options: [
				{
					type: 'dropdown',
					label: 'Media',
					id: 'mediaId',
					default: self.CHOICES_MEDIALIST_SELECTED_MEDIA[0]?.id ?? 'none',
					choices: self.CHOICES_MEDIALIST_SELECTED_MEDIA,
				},
			],
			callback: async (action) =>
				sendAndRefresh(self, `/api/v3/medialist/selected/${encodePathPart(action.options.mediaId)}/${suffix}`),
		}
	}

	actions.medialistMoveToIndex = {
		name: 'MEDIALIST | Selected Medialist - Move to Index',
		description: 'Moves a media item to a zero-based position.',
		options: [
			{
				type: 'dropdown',
				label: 'Media',
				id: 'mediaId',
				default: self.CHOICES_MEDIALIST_SELECTED_MEDIA[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALIST_SELECTED_MEDIA,
			},
			{ type: 'textinput', label: 'New Index', id: 'newIndex', default: '0', useVariables: true },
		],
		callback: async (action) => {
			const index = Number(await expandOption(self, action.options.newIndex))
			if (!Number.isInteger(index) || index < 0) {
				self.log('error', 'New media index must be a non-negative integer')
				return
			}
			await sendAndRefresh(
				self,
				`/api/v3/medialist/selected/${encodePathPart(action.options.mediaId)}/move`,
				'POST',
				index,
			)
		},
	}

	actions.medialistMoveIndexes = {
		name: 'MEDIALIST | Selected Medialist - Move by Indexes',
		description: 'Moves an item from an old zero-based index to a new index.',
		options: [
			{ type: 'textinput', label: 'Old Index', id: 'oldIndex', default: '0', useVariables: true },
			{ type: 'textinput', label: 'New Index', id: 'newIndex', default: '0', useVariables: true },
		],
		callback: async (action) => {
			const oldIndex = await expandOption(self, action.options.oldIndex)
			const newIndex = await expandOption(self, action.options.newIndex)
			await sendAndRefresh(
				self,
				`/api/v3/medialist/selected/media/move/${encodePathPart(oldIndex)}/${encodePathPart(newIndex)}`,
			)
		},
	}

	for (const [id, label, suffix] of [
		['medialistMoveUpCustom', 'Move Up', 'moveup'],
		['medialistMoveDownCustom', 'Move Down', 'movedown'],
	] as const) {
		actions[id] = {
			name: `MEDIALIST | Custom Medialist - ${label}`,
			description: `${label}s a selected media item in its Medialist.`,
			options: [
				{
					type: 'dropdown',
					label: 'Medialist - Media',
					id: 'medialistMedia',
					default: self.CHOICES_MEDIALISTS_MEDIA[0]?.id ?? 'None',
					choices: self.CHOICES_MEDIALISTS_MEDIA,
				},
			],
			callback: async (action) => {
				const selected = parseMedialistMediaGlobalChoiceId(valueToString(action.options.medialistMedia))
				if (!selected) return invalidChoice(self, 'Medialist media')
				await sendAndRefresh(
					self,
					`/api/v3/medialist/${encodePathPart(selected.medialistId)}/${encodePathPart(selected.mediaId)}/${suffix}`,
				)
			},
		}
	}

	actions.medialistMoveToIndexCustom = {
		name: 'MEDIALIST | Custom Medialist - Move to Index',
		description: 'Moves a media item to a zero-based position in its Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist - Media',
				id: 'medialistMedia',
				default: self.CHOICES_MEDIALISTS_MEDIA[0]?.id ?? 'None',
				choices: self.CHOICES_MEDIALISTS_MEDIA,
			},
			{ type: 'textinput', label: 'New Index', id: 'newIndex', default: '0', useVariables: true },
		],
		callback: async (action) => {
			const selected = parseMedialistMediaGlobalChoiceId(valueToString(action.options.medialistMedia))
			if (!selected) return invalidChoice(self, 'Medialist media')
			const index = Number(await expandOption(self, action.options.newIndex))
			if (!Number.isInteger(index) || index < 0) {
				self.log('error', 'New media index must be a non-negative integer')
				return
			}
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(selected.medialistId)}/${encodePathPart(selected.mediaId)}/move`,
				'POST',
				index,
			)
		},
	}

	actions.medialistMoveIndexesCustom = {
		name: 'MEDIALIST | Custom Medialist - Move by Indexes',
		description: 'Moves an item between zero-based indexes in a specified Medialist.',
		options: [
			{
				type: 'dropdown',
				label: 'Medialist',
				id: 'medialistId',
				default: self.CHOICES_MEDIALISTS[0]?.id ?? 'none',
				choices: self.CHOICES_MEDIALISTS,
			},
			{ type: 'textinput', label: 'Old Index', id: 'oldIndex', default: '0', useVariables: true },
			{ type: 'textinput', label: 'New Index', id: 'newIndex', default: '0', useVariables: true },
		],
		callback: async (action) => {
			const oldIndex = await expandOption(self, action.options.oldIndex)
			const newIndex = await expandOption(self, action.options.newIndex)
			await sendAndRefresh(
				self,
				`/api/v3/medialist/${encodePathPart(action.options.medialistId)}/media/move/${encodePathPart(
					oldIndex,
				)}/${encodePathPart(newIndex)}`,
			)
		},
	}

	// TITLER V2
	actions.titlerElementVisible = {
		name: 'TITLER | Set Element Visible/Invisible',
		description: 'Takes a Titler element on or off.',
		options: [
			{
				type: 'dropdown',
				label: 'Element',
				id: 'elementId',
				default: self.CHOICES_TITLER_ELEMENTS[0]?.id ?? 'none',
				choices: self.CHOICES_TITLER_ELEMENTS,
			},
			{ type: 'checkbox', label: 'Is On', id: 'isOn', default: true },
			{ type: 'checkbox', label: 'Use Animation', id: 'isAnimate', default: true },
		],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v2/titler/selected/elements/${encodePathPart(action.options.elementId)}/visible${buildQuery({
					isOn: Boolean(action.options.isOn),
					isAnimated: Boolean(action.options.isAnimate),
				})}`,
			),
	}

	actions.titlerSetSocialMediaData = {
		name: 'TITLER | Set Social Media Data',
		description: 'Sets the social media data payload for the selected Titler file.',
		options: [
			{ type: 'textinput', label: 'Username', id: 'username', default: '', useVariables: true },
			{ type: 'textinput', label: 'Date', id: 'date', default: '', useVariables: true },
			{ type: 'textinput', label: 'Content', id: 'content', default: '', useVariables: true },
			{ type: 'textinput', label: 'Logo', id: 'logo', default: '', useVariables: true },
			{ type: 'textinput', label: 'Avatar', id: 'avatar', default: '', useVariables: true },
			{ type: 'textinput', label: 'Attachment', id: 'attachment', default: '', useVariables: true },
		],
		callback: async (action) =>
			sendAndRefresh(self, '/api/v2/titler/selected/elements/socialmedia/data', 'PUT', {
				Username: await expandOption(self, action.options.username),
				Date: await expandOption(self, action.options.date),
				Content: await expandOption(self, action.options.content),
				Logo: await expandOption(self, action.options.logo),
				Avatar: await expandOption(self, action.options.avatar),
				Attachment: await expandOption(self, action.options.attachment),
			}),
	}

	for (const kind of ['speaker', 'panel'] as const) {
		const title = kind === 'speaker' ? 'Speaker' : 'Panel'
		const rowChoices =
			kind === 'speaker' ? self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS : self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS
		const elementChoices =
			kind === 'speaker' ? self.CHOICES_TITLER_SPEAKER_ELEMENTS : self.CHOICES_TITLER_PANEL_ELEMENTS

		actions[`titlerSet${title}EntryLiveRow`] = {
			name: `TITLER | Set ${title} Row Live`,
			description: `Sets a ${title.toLowerCase()} row live.`,
			options: [
				{
					type: 'dropdown',
					label: 'Element - Row',
					id: 'rowId',
					default: rowChoices[0]?.id ?? 'none',
					choices: rowChoices,
				},
				{ type: 'checkbox', label: 'Reset Auto-Off Timer', id: 'resetTimer', default: true },
			],
			callback: async (action) => {
				const parts = parseTitlerRowChoice(action.options.rowId, kind)
				if (!parts) return invalidChoice(self, `${title} row`)
				await sendAndRefresh(
					self,
					`/api/v2/titler/selected/elements/${encodePathPart(parts[0])}/${kind}/entries/${encodePathPart(
						parts[1],
					)}/live${buildQuery({ resetAutoOffTimer: Boolean(action.options.resetTimer) })}`,
				)
			},
		}

		actions[`titlerClear${title}LiveRow`] = {
			name: `TITLER | Clear ${title} Live Row`,
			description: `Clears the live row of a ${title.toLowerCase()} element.`,
			options: [
				{
					type: 'dropdown',
					label: `${title} Element`,
					id: 'elementId',
					default: elementChoices[0]?.id ?? 'none',
					choices: elementChoices,
				},
			],
			callback: async (action) =>
				sendAndRefresh(
					self,
					`/api/v2/titler/selected/elements/${encodePathPart(action.options.elementId)}/${kind}/entries/live/clear`,
				),
		}

		actions[`titlerUpdate${title}Row`] = {
			name: `TITLER | Update ${title} Row`,
			description:
				kind === 'panel'
					? 'Loads the selected Panel row values automatically, then sends the complete PUT payload.'
					: `Gets the selected ${title.toLowerCase()} row, merges its entry values, then sends the complete PUT payload.`,
			options:
				kind === 'panel'
					? buildPanelUpdateRowOptions(rowChoices)
					: [
							{
								type: 'dropdown',
								label: 'Element - Row',
								id: 'rowId',
								default: rowChoices[0]?.id ?? 'none',
								choices: rowChoices,
							},
							{
								type: 'textinput',
								label: 'Entries to Merge (JSON object)',
								id: 'entries',
								default: '{}',
								useVariables: true,
							},
							{ type: 'checkbox', label: 'Replace All Entries', id: 'replaceEntries', default: false },
							{
								type: 'textinput',
								label: 'Data Link Parameter (blank keeps current)',
								id: 'dataLinkParameter',
								default: '',
								useVariables: true,
							},
							{ type: 'checkbox', label: 'Reset Auto-Off Timer', id: 'resetTimer', default: true },
						],
			callback: async (action) => {
				const parts = parseTitlerRowChoice(action.options.rowId, kind)
				if (!parts) return invalidChoice(self, `${title} row`)
				const endpoint = `/api/v2/titler/selected/elements/${encodePathPart(parts[0])}/${kind}/entries/${encodePathPart(parts[1])}`
				const current = await SendCommand(self, endpoint)
				if (!isRecord(current)) {
					self.log('error', `Unable to retrieve ${title.toLowerCase()} row before update`)
					return
				}

				let entries: Record<string, string>
				let dataLinkParameter: string
				if (kind === 'panel') {
					const columns = getTitlerColumnDefinitions(getTitlerStructure(parts[0], kind))
					entries = {}
					for (const [columnIndex, column] of columns.entries()) {
						const optionId = makeTitlerRowColumnOptionId(kind, parts[0], parts[1], column.name, columnIndex)
						const currentValue = valueToString(current.Entries?.[column.name])
						entries[column.name] = Object.prototype.hasOwnProperty.call(action.options, optionId)
							? await expandOption(self, action.options[optionId])
							: currentValue
					}

					const advancedValue = valueToString(action.options.entries).trim()
					if (advancedValue) {
						const advancedEntries = await parseEntries(advancedValue)
						if (!advancedEntries) return
						Object.assign(entries, advancedEntries)
					}
					const dataLinkOptionId = makeTitlerRowDataLinkOptionId(kind, parts[0], parts[1])
					const legacyDataLink = await expandOption(self, action.options.dataLinkParameter)
					dataLinkParameter = Object.prototype.hasOwnProperty.call(action.options, dataLinkOptionId)
						? await expandOption(self, action.options[dataLinkOptionId])
						: legacyDataLink || valueToString(current.DataLinkParameter)
				} else {
					const parsedEntries = await parseEntries(action.options.entries)
					if (!parsedEntries) return
					entries = parsedEntries
					dataLinkParameter = await expandOption(self, action.options.dataLinkParameter)
				}

				const payload: Record<string, any> = {
					...current,
					Id: valueToString(current.Id).trim() || parts[1],
					Entries: action.options.replaceEntries ? entries : { ...(current.Entries ?? {}), ...entries },
				}
				if (kind === 'panel' || dataLinkParameter) payload.DataLinkParameter = dataLinkParameter
				await sendAndRefresh(
					self,
					`${endpoint}${buildQuery({ resetAutoOffTimer: Boolean(action.options.resetTimer) })}`,
					'PUT',
					payload,
				)
			},
		}

		actions[`titlerDelete${title}Row`] = {
			name: `TITLER | Delete ${title} Row`,
			description: `Deletes the selected ${title.toLowerCase()} row.`,
			options: [
				{
					type: 'dropdown',
					label: 'Element - Row',
					id: 'rowId',
					default: rowChoices[0]?.id ?? 'none',
					choices: rowChoices,
				},
			],
			callback: async (action) => {
				const parts = parseTitlerRowChoice(action.options.rowId, kind)
				if (!parts) return invalidChoice(self, `${title} row`)
				await sendAndRefresh(
					self,
					`/api/v2/titler/selected/elements/${encodePathPart(parts[0])}/${kind}/entries/${encodePathPart(parts[1])}`,
					'DELETE',
				)
			},
		}

		actions[`titlerAdd${title}Entry`] = {
			name: `TITLER | Add ${title} Entry`,
			description:
				kind === 'panel'
					? 'Adds a Panel row and builds its Entries object automatically from the selected element structure.'
					: 'Adds a row to a speaker element. Available column names are fetched from its structure.',
			options:
				kind === 'panel'
					? buildPanelEntryOptions()
					: [
							{
								type: 'dropdown',
								label: `${title} Element`,
								id: 'elementId',
								default: elementChoices[0]?.id ?? 'none',
								choices: elementChoices,
							},
							{
								type: 'textinput',
								label: 'Entries (JSON object)',
								id: 'entries',
								default: '{}',
								useVariables: true,
							},
							{
								type: 'textinput',
								label: 'Data Link Parameter',
								id: 'dataLinkParameter',
								default: '',
								useVariables: true,
							},
						],
			callback: async (action) => {
				const elementId = valueToString(action.options.elementId)
				let entries: Record<string, string>

				if (kind === 'panel') {
					let structure = getTitlerStructure(elementId, kind)
					let columns = getTitlerColumnDefinitions(structure)
					if (columns.length === 0) {
						const fetchedStructure = await SendCommand(
							self,
							`/api/v2/titler/selected/elements/${encodePathPart(elementId)}/${kind}/structure`,
						)
						if (isRecord(fetchedStructure)) {
							self.TITLER_ELEMENT_STRUCTURES[`${elementId}:${kind}`] = fetchedStructure
							structure = fetchedStructure
							columns = getTitlerColumnDefinitions(structure)
							self.updateActions()
						}
					}

					entries = {}
					for (const [columnIndex, column] of columns.entries()) {
						const optionId = makeTitlerColumnOptionId(kind, elementId, column.name, columnIndex)
						entries[column.name] = await expandOption(self, action.options[optionId] ?? '')
					}

					const advancedValue = valueToString(action.options.entries).trim()
					if (advancedValue) {
						const advancedEntries = await parseEntries(advancedValue)
						if (!advancedEntries) return
						Object.assign(entries, advancedEntries)
					}

					const dataLinkParameter = await expandOption(self, action.options.dataLinkParameter)
					if (Object.keys(entries).length === 0 && !dataLinkParameter) {
						self.log(
							'error',
							'No Panel columns are available. Start Titler, select a file containing this Panel, and wait for the module refresh.',
						)
						return
					}
				} else {
					const parsedEntries = await parseEntries(action.options.entries)
					if (!parsedEntries) return
					entries = parsedEntries
				}

				await sendAndRefresh(
					self,
					`/api/v2/titler/selected/elements/${encodePathPart(elementId)}/${kind}/entries`,
					'POST',
					{
						Status: 'Available',
						DataLinkParameter: await expandOption(self, action.options.dataLinkParameter),
						Entries: entries,
					},
				)
			},
		}

		actions[`titlerUpdateAll${title}Entries`] = {
			name: `TITLER | Update All ${title} Entries`,
			description:
				kind === 'panel'
					? 'Loads every existing Panel row and column automatically, then sends the complete PUT payload.'
					: `Replaces all rows of a ${title.toLowerCase()} element with a documented JSON array.`,
			options:
				kind === 'panel'
					? buildPanelUpdateAllOptions()
					: [
							{
								type: 'dropdown',
								label: `${title} Element`,
								id: 'elementId',
								default: elementChoices[0]?.id ?? 'none',
								choices: elementChoices,
							},
							{
								type: 'textinput',
								label: 'Rows (JSON array)',
								id: 'rows',
								default: '[]',
								useVariables: true,
							},
							{ type: 'checkbox', label: 'Reset Auto-Off Timer', id: 'resetTimer', default: true },
						],
			callback: async (action) => {
				const elementId = valueToString(action.options.elementId)
				let rows: unknown[]

				if (kind === 'panel') {
					let columns = getTitlerColumnDefinitions(getTitlerStructure(elementId, kind))
					if (columns.length === 0) {
						const fetchedStructure = await SendCommand(
							self,
							`/api/v2/titler/selected/elements/${encodePathPart(elementId)}/${kind}/structure`,
						)
						if (isRecord(fetchedStructure)) {
							self.TITLER_ELEMENT_STRUCTURES[`${elementId}:${kind}`] = fetchedStructure
							columns = getTitlerColumnDefinitions(fetchedStructure)
							self.updateActions()
						}
					}
					if (columns.length === 0) {
						self.log(
							'error',
							'Unable to load the Panel column definitions. Start Titler, select the file, and try again.',
						)
						return
					}

					const fetchedRows = await SendCommand(
						self,
						`/api/v2/titler/selected/elements/${encodePathPart(elementId)}/${kind}/entries`,
					)
					const currentRows = Array.isArray(fetchedRows) ? fetchedRows : getTitlerRows(elementId, kind)
					const generatedRows: Record<string, unknown>[] = []
					for (const row of currentRows) {
						if (!isRecord(row)) continue
						const rowId = valueToString(row.Id).trim()
						const entries: Record<string, string> = {}
						for (const [columnIndex, column] of columns.entries()) {
							const optionId = makeTitlerRowColumnOptionId(kind, elementId, rowId, column.name, columnIndex)
							const currentValue = valueToString(row.Entries?.[column.name])
							const enteredValue = Object.prototype.hasOwnProperty.call(action.options, optionId)
								? await expandOption(self, action.options[optionId])
								: ''
							entries[column.name] = enteredValue.trim() ? enteredValue : currentValue
						}

						const dataLinkOptionId = makeTitlerRowDataLinkOptionId(kind, elementId, rowId)
						const enteredDataLink = Object.prototype.hasOwnProperty.call(action.options, dataLinkOptionId)
							? await expandOption(self, action.options[dataLinkOptionId])
							: ''
						const dataLinkParameter = enteredDataLink.trim() ? enteredDataLink : valueToString(row.DataLinkParameter)
						const generatedRow: Record<string, unknown> = {
							Status: valueToString(row.Status) || 'Available',
							DataLinkParameter: dataLinkParameter,
							Entries: entries,
						}
						if (rowId) generatedRow.Id = rowId
						generatedRows.push(generatedRow)
					}

					const rawRows = valueToString(action.options.rows).trim()
					const useAdvancedRows = Boolean(action.options.showAdvancedRows) || (rawRows.length > 0 && rawRows !== '[]')
					if (useAdvancedRows) {
						const parsedRows = await parseJsonOption<unknown>(self, action.options.rows, `${title} rows`)
						const normalizedRows = normalizePanelRows(parsedRows)
						if (!normalizedRows) return
						rows = normalizedRows
					} else {
						if (generatedRows.length === 0) {
							self.log('error', 'This Panel has no existing rows. Use Add Panel Entry first.')
							return
						}
						rows = generatedRows
					}
				} else {
					const parsedRows = await parseJsonOption<unknown>(self, action.options.rows, `${title} rows`)
					if (!Array.isArray(parsedRows)) {
						if (parsedRows !== undefined) self.log('error', `${title} rows must be a JSON array`)
						return
					}
					rows = parsedRows
				}

				await sendAndRefresh(
					self,
					`/api/v2/titler/selected/elements/${encodePathPart(elementId)}/${kind}/entries${buildQuery({
						resetAutoOffTimer: Boolean(action.options.resetTimer),
					})}`,
					'PUT',
					rows,
				)
			},
		}
	}

	actions.titlerSetTickerContent = {
		name: 'TITLER | Set Ticker Content',
		description: 'Sets the content of a Ticker element.',
		options: [
			{
				type: 'dropdown',
				label: 'Ticker Element',
				id: 'elementId',
				default: self.CHOICES_TITLER_TICKER_ELEMENTS[0]?.id ?? 'none',
				choices: self.CHOICES_TITLER_TICKER_ELEMENTS,
			},
			{ type: 'textinput', label: 'Content', id: 'content', default: '', useVariables: true },
		],
		callback: async (action) =>
			sendAndRefresh(
				self,
				`/api/v2/titler/selected/elements/${encodePathPart(action.options.elementId)}/ticker/content`,
				'POST',
				{ Content: await expandOption(self, action.options.content) },
			),
	}

	self.setActionDefinitions(actions)
}

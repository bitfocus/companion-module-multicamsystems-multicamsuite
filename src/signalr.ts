import * as signalR from '@microsoft/signalr'
import type { DropdownChoice, MulticamInstance, StreamingProfile } from './main.js'
import { runPollCycle, runPollScopes, type PollScope } from './polling.js'

export const SIGNALR_STATE_METHODS = [
	'GetCurrentApplication',
	'GetRecordings',
	'GetLastRecording',
	'GetWorkflows',
	'GetPublishingJobs',
	'GetRecordingState',
	'GetLiveExtractState',
	'GetStreamingState',
	'GetUserSelectedMicrophone',
	'GetIsZoomFeatureEnabled',
	'GetCropZones',
] as const

export const SIGNALR_RECEIVER_METHODS = [
	'OnApplicationInitialized',
	'OnApplicationInitializedWithDetails',
	'OnApplicationExited',
	'OnAutomaticModeChanged',
	'OnRecordingStarting',
	'OnRecordStarted',
	'OnRecordTimeChanged',
	'OnRecordStopped',
	'OnRecordFinalized',
	'OnLiveExcerptStarted',
	'OnLiveExcerptFinished',
	'OnProfilesChanged',
	'OnStreamingStarted',
	'OnStreamingStopped',
	'OnStreamingProfileUpdated',
	'OnRecordingAdded',
	'OnRecordingDeleted',
	'OnRecordingUpdated',
	'OnPublishingJobAdded',
	'OnPublishingJobDeleted',
	'OnPublishingJobUpdated',
	'OnUserSelectedMicrophoneChanged',
	'OnLivePresetChanged',
	'OnMicrophoneStateChanged',
	'OnPresetsBankChanged',
	'OnAutomationAssistMessageNotified',
	'OnAutoTitlingConfigUpdated',
	'OnAutomationNotification',
	'OnLiveTitlerFileChanged',
	'OnTitlerElementUpdated',
	'OnTitlerStaticFileLiveRowChanged',
	'OnTitlerStaticFileRowDeleted',
	'OnTitlerStaticFileRowAdded',
	'OnTitlerStaticFileRowEdited',
	'OnTitlerSocialMediaMessageReceived',
	'OnLiveComposerFileChanged',
	'OnLiveComposerCompoChanged',
	'OnLiveComposerFileIdChanged',
	'OnLiveComposerCompoIdChanged',
	'OnLiveScenesFileChanged',
	'OnLiveScenesSceneChanged',
	'OnSceneSnapshotUpdated',
	'OnPlaylistPlay',
	'OnPlaylistStop',
	'OnLivePlaylistItemChanged',
	'OnLivePlaylistFileChanged',
	'OnLivePlaylistItemAdded',
	'OnLivePlaylistItemRemoved',
	'OnLivePlaylistItemIndexChanged',
	'OnLivePlaylistItemModified',
	'OnPlaylistItemModified',
	'OnPlaylistLoadingStateChanged',
	'OnLiveSourceChanged',
	'OnLiveSourceChanging',
	'OnPilotedDeviceChanged',
	'OnAssistViewedSceneChanged',
	'OnZoneAdded',
	'OnZoneDeleted',
	'OnZoneUpdated',
] as const

type SignalRStateMethod = (typeof SIGNALR_STATE_METHODS)[number]
type ReceiverMethod = (typeof SIGNALR_RECEIVER_METHODS)[number]
type RecordLike = Record<string, any>
type ReceiverConnection = Pick<signalR.HubConnection, 'on'>

const refreshTimers = new WeakMap<MulticamInstance, NodeJS.Timeout>()
const pendingRefreshes = new WeakMap<
	MulticamInstance,
	{ targets: Set<PollScope | 'all'>; forceSignalRRefresh: boolean }
>()
type SignalRReconnectState = {
	timer: NodeJS.Timeout | null
	attempts: number
}
const signalRReconnectStates = new WeakMap<MulticamInstance, SignalRReconnectState>()
const SIGNALR_RETRY_BASE_MS = 2000
const SIGNALR_RETRY_MAX_MS = 30000

function getSignalRReconnectState(instance: MulticamInstance): SignalRReconnectState {
	let state = signalRReconnectStates.get(instance)
	if (!state) {
		state = { timer: null, attempts: 0 }
		signalRReconnectStates.set(instance, state)
	}
	return state
}

export function cancelSignalRReconnect(instance: MulticamInstance): void {
	const state = signalRReconnectStates.get(instance)
	if (state?.timer) clearTimeout(state.timer)
	signalRReconnectStates.delete(instance)
}

export function cancelSignalRRefreshes(instance: MulticamInstance): void {
	const timer = refreshTimers.get(instance)
	if (timer) clearTimeout(timer)
	refreshTimers.delete(instance)
	pendingRefreshes.delete(instance)
}

function scheduleSignalRReconnect(instance: MulticamInstance, connection: signalR.HubConnection): void {
	if (instance._signalR !== connection || connection.state !== signalR.HubConnectionState.Disconnected) return

	const state = getSignalRReconnectState(instance)
	if (state.timer) return
	const delay = Math.min(SIGNALR_RETRY_BASE_MS * 2 ** Math.min(state.attempts, 4), SIGNALR_RETRY_MAX_MS)
	state.attempts++
	instance.log('warn', `SignalR unavailable; retrying in ${Math.ceil(delay / 1000)}s`)
	state.timer = setTimeout(() => {
		state.timer = null
		if (instance._signalR !== connection || connection.state !== signalR.HubConnectionState.Disconnected) return
		void startSignalRConnection(instance, connection)
	}, delay)
}

async function startSignalRConnection(instance: MulticamInstance, connection: signalR.HubConnection): Promise<void> {
	if (instance._signalR !== connection || connection.state !== signalR.HubConnectionState.Disconnected) return
	const isRetry = getSignalRReconnectState(instance).attempts > 0

	try {
		await connection.start()
		if (instance._signalR !== connection) {
			await connection.stop()
			return
		}
		cancelSignalRReconnect(instance)
		setConnectionState(instance, true)
		instance.log('info', isRetry ? 'SignalR reconnected' : 'SignalR connected')
		await SyncSignalRState(instance)
		if (isRetry && instance._signalR === connection) {
			// SignalR events aren't replayed after a disconnect, so reconcile all state once.
			await runPollCycle(instance, { forceSignalRRefresh: true })
		}
	} catch (error: any) {
		if (instance._signalR !== connection) return
		setConnectionState(instance, false)
		instance.log('error', `SignalR failed to start: ${error?.message ?? error}`)
		scheduleSignalRReconnect(instance, connection)
	}
}

function isRecord(value: unknown): value is RecordLike {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getField(value: unknown, ...keys: string[]): any {
	if (!isRecord(value)) return undefined
	for (const key of keys) {
		if (Object.prototype.hasOwnProperty.call(value, key)) return value[key]
	}
	return undefined
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value) ?? ''
	} catch (_error) {
		return '[Unserializable value]'
	}
}

function valueToString(value: unknown): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return `${value}`
	return safeStringify(value)
}

function stringId(value: unknown): string {
	const id = getField(value, 'id', 'Id')
	return id === undefined || id === null ? '' : String(id)
}

function displayName(value: unknown): string {
	const name = getField(
		value,
		'name',
		'Name',
		'mediaName',
		'MediaName',
		'title',
		'Title',
		'fileName',
		'FileName',
		'composerFileName',
		'ComposerFileName',
		'composerSceneName',
		'ComposerSceneName',
	)
	return name === undefined || name === null ? stringId(value) : String(name)
}

function choicesOrNone(choices: DropdownChoice[]): DropdownChoice[] {
	return choices.length > 0 ? choices : [{ id: 'none', label: 'None' }]
}

function choicesChanged(current: DropdownChoice[], next: DropdownChoice[]): boolean {
	return JSON.stringify(current) !== JSON.stringify(next)
}

function markSignalREvent(instance: MulticamInstance, eventName: string, args: unknown[]): void {
	const payload = safeStringify(args)
	instance.SIGNALR_LAST_EVENT = eventName
	instance.SIGNALR_LAST_PAYLOAD = payload
	instance.setVariableValues({
		signalrLastEvent: eventName,
		signalrLastPayload: payload,
	})
	instance.log('debug', `SignalR: ${eventName}: ${payload}`)
}

function setConnectionState(instance: MulticamInstance, connected: boolean): void {
	instance.SIGNALR_CONNECTED = connected
	instance.setVariableValues({ signalrConnected: connected })
	instance.checkFeedbacks('signalrConnected')
}

function queueDataRefresh(
	instance: MulticamInstance,
	targets: PollScope | 'all' | Array<PollScope | 'all'>,
	forceSignalRRefresh: boolean = false,
): void {
	let pending = pendingRefreshes.get(instance)
	if (!pending) {
		pending = { targets: new Set(), forceSignalRRefresh: false }
		pendingRefreshes.set(instance, pending)
	}
	for (const target of Array.isArray(targets) ? targets : [targets]) pending.targets.add(target)
	pending.forceSignalRRefresh ||= forceSignalRRefresh
	if (refreshTimers.has(instance)) return
	const timer = setTimeout(() => {
		refreshTimers.delete(instance)
		const request = pendingRefreshes.get(instance)
		pendingRefreshes.delete(instance)
		if (!request) return
		const options = { forceSignalRRefresh: request.forceSignalRRefresh }
		if (request.targets.has('all')) {
			void runPollCycle(instance, options)
			const scopedTargets = new Set([...request.targets].filter((target): target is PollScope => target !== 'all'))
			if (scopedTargets.size > 0) void runPollScopes(instance, scopedTargets, options)
		} else {
			void runPollScopes(instance, request.targets as Set<PollScope>, options)
		}
	}, 250)
	refreshTimers.set(instance, timer)
}

function upsertById(items: any[], item: unknown): any[] {
	const id = stringId(item)
	if (!id) return items
	const index = items.findIndex((candidate) => stringId(candidate) === id)
	if (index < 0) return [...items, item]
	const result = [...items]
	result[index] = item
	return result
}

function removeById(items: any[], itemOrId: unknown): any[] {
	const id = isRecord(itemOrId) ? stringId(itemOrId) : valueToString(itemOrId)
	return id ? items.filter((candidate) => stringId(candidate) !== id) : items
}

function setPublisherRecordings(instance: MulticamInstance, recordings: unknown): void {
	if (!Array.isArray(recordings)) return
	instance.PUBLISHER_RECORDINGS = recordings
	instance.setVariableValues({ publisherRecordingCount: recordings.length })
	const choices = choicesOrNone(
		recordings
			.filter((recording) => stringId(recording))
			.map((recording) => ({ id: stringId(recording), label: displayName(recording) })),
	)
	if (choicesChanged(instance.CHOICES_PUBLISHER_RECORDINGS, choices)) {
		instance.CHOICES_PUBLISHER_RECORDINGS = choices
		instance.updateActions()
	}
}

function setPublisherWorkflows(instance: MulticamInstance, workflows: unknown): void {
	if (!Array.isArray(workflows)) return
	instance.PUBLISHER_WORKFLOWS = workflows
	const choices = choicesOrNone(
		workflows
			.filter((workflow) => Boolean(getField(workflow, 'isFullyAutomated', 'IsFullyAutomated')))
			.map((workflow) => {
				const name = displayName(workflow)
				return { id: name, label: name }
			})
			.filter((choice) => choice.id),
	)
	if (choicesChanged(instance.CHOICES_PUBLISHER_WORKFLOWS, choices)) {
		instance.CHOICES_PUBLISHER_WORKFLOWS = choices
		instance.updateActions()
	}
}

function setPublishingJobs(instance: MulticamInstance, jobs: unknown): void {
	if (!Array.isArray(jobs)) return
	instance.SIGNALR_PUBLISHING_JOBS = jobs
	instance.setVariableValues({ signalrPublishingJobs: safeStringify(jobs) })
}

function setCropZones(instance: MulticamInstance, zones: unknown): void {
	if (!Array.isArray(zones)) return
	instance.SIGNALR_CROP_ZONES = zones
	instance.setVariableValues({ signalrCropZones: safeStringify(zones) })
	const choices = choicesOrNone(
		zones
			.filter((zone) => stringId(zone))
			.map((zone) => ({ id: stringId(zone), label: displayName(zone) || stringId(zone) })),
	)
	if (choicesChanged(instance.CHOICES_SIGNALR_CROP_ZONES, choices)) {
		instance.CHOICES_SIGNALR_CROP_ZONES = choices
		instance.updateActions()
	}
}

function normalizeStreamingProfile(profile: unknown, started?: boolean): StreamingProfile | null {
	if (!isRecord(profile)) return null
	const id = String(getField(profile, 'id', 'Id') ?? '')
	if (!id) return null
	return {
		id,
		name: String(getField(profile, 'name', 'Name') ?? id),
		isEnabled: Boolean(getField(profile, 'isEnabled', 'IsEnabled')),
		broadcastServerHostname: String(getField(profile, 'broadcastServerHostname', 'BroadcastServerHostname') ?? ''),
		broadcastStreamID: String(getField(profile, 'broadcastStreamID', 'BroadcastStreamID') ?? ''),
		isStarted: started ?? Boolean(getField(profile, 'isStarted', 'IsStarted')),
		canBeLaunchedRemotely: Boolean(getField(profile, 'canBeLaunchedRemotely', 'CanBeLaunchedRemotely')),
		errorMessage: String(getField(profile, 'errorMessage', 'ErrorMessage') ?? ''),
	}
}

function updateActiveStream(instance: MulticamInstance, profile: unknown, started?: boolean): void {
	const normalized = normalizeStreamingProfile(profile, started)
	if (!normalized) return
	const existing = instance.STREAMING_PROFILES.find((candidate) => stringId(candidate) === normalized.id)
	const cachedProfile = {
		...(isRecord(existing) ? existing : {}),
		...(isRecord(profile) ? profile : {}),
		Id: normalized.id,
		Name: normalized.name,
		IsStarted: normalized.isStarted,
	}
	instance.STREAMING_PROFILES = upsertById(instance.STREAMING_PROFILES, cachedProfile)
	const choices = choicesOrNone(
		instance.STREAMING_PROFILES.map((candidate) => ({ id: stringId(candidate), label: displayName(candidate) })),
	)
	if (choicesChanged(instance.CHOICES_STREAMING_PROFILES, choices)) {
		instance.CHOICES_STREAMING_PROFILES = choices
		instance.updateActions()
		instance.updateFeedbacks()
	}
	instance.ACTIVE_STREAMS = normalized.isStarted
		? upsertById(instance.ACTIVE_STREAMS, normalized)
		: removeById(instance.ACTIVE_STREAMS, normalized.id)
	instance.setVariableValues({
		streamingActiveProfiles: instance.ACTIVE_STREAMS.map((item) => item.name).join(', '),
		streamingActiveProfileCount: instance.ACTIVE_STREAMS.length,
		streamingAnyActive: instance.ACTIVE_STREAMS.length > 0,
	})
	instance.checkFeedbacks('streaming')
}

function updateLiveExtract(instance: MulticamInstance, info: unknown, inProgress?: boolean): void {
	const current = isRecord(info) ? info : {}
	const active = inProgress ?? Boolean(getField(current, 'isInProgress', 'IsInProgress'))
	const seconds = active ? Number(getField(current, 'secondsToAutomaticEnd', 'SecondsToAutomaticEnd') ?? 0) : 0
	instance.RECORDING_LIVE_EXTRACT = { ...current, IsInProgress: active, SecondsToAutomaticEnd: seconds }
	instance.setVariableValues({
		recordingLiveExtract: active,
		recordingLiveExtractSecondsRemaining: Number.isFinite(seconds) ? seconds : 0,
	})
}

function setApplicationSpecificVariable(
	instance: MulticamInstance,
	confVariable: string,
	radioVariable: string,
	value: any,
): void {
	const running = instance.RUNNING_APPLICATION.toLowerCase()
	if (running.includes('radio')) instance.setVariableValues({ [radioVariable]: value })
	else if (running.includes('conf')) instance.setVariableValues({ [confVariable]: value })
	else instance.setVariableValues({ [confVariable]: value, [radioVariable]: value })
}

function normalizeTitlerElement(element: unknown): unknown {
	if (!isRecord(element)) return element
	const normalized = { ...element }
	const id = getField(element, 'id', 'Id')
	const name = getField(element, 'name', 'Name')
	const elementType = getField(element, 'elementType', 'ElementType')
	const isVisible = getField(element, 'isVisible', 'IsVisible')
	if (id !== undefined) normalized.Id = id
	if (name !== undefined) normalized.Name = name
	if (elementType !== undefined) normalized.ElementType = elementType
	if (isVisible !== undefined) normalized.IsVisible = isVisible
	return normalized
}

function setTitlerLiveRow(instance: MulticamInstance, elementId: unknown, row: unknown): void {
	const element = instance.TITLER_SELECTED_FILE_ELEMENTS.find((item) => stringId(item) === valueToString(elementId))
	if (!element) return
	const rowId = stringId(row)
	const kind = String(getField(element, 'ElementType', 'elementType') ?? '').toLowerCase()
	if (kind === 'speaker') element.LiveSpeakerRowId = rowId
	else if (kind === 'panel') element.LivePanelRowId = rowId
	instance.checkFeedbacks('titlerElementSpeakerRowLive', 'titlerElementPanelRowLive')
}

function setMedialistState(instance: MulticamInstance, medialistId: unknown, item?: unknown, position?: unknown): void {
	const id = valueToString(medialistId)
	if (id) {
		instance.setVariableValues({ medialistSelectedId: id })
		if (stringId(instance.MEDIALIST_SELECTED) !== id) instance.MEDIALIST_SELECTED = { Id: id, id }
	}
	if (item !== undefined) {
		instance.MEDIALIST_SELECTED_MEDIA = item as any
		instance.setVariableValues({
			medialistSelectedMedia: safeStringify(item),
			medialistSelectedMediaName: displayName(item),
			medialistSelectedMediaId: stringId(item),
		})
	}
	if (position !== undefined) instance.setVariableValues({ medialistPosition: Number(position) || 0 })
}

function setSelectedMedialist(instance: MulticamInstance, medialist: unknown): void {
	const id = stringId(medialist)
	instance.MEDIALIST_SELECTED = isRecord(medialist) ? { ...medialist, Id: id } : id ? { Id: id, id } : {}
	if (isRecord(medialist)) instance.MEDIALISTS = upsertById(instance.MEDIALISTS, medialist)
	const items = getField(medialist, 'items', 'Items')
	const choices = choicesOrNone(
		(Array.isArray(items) ? items : [])
			.filter((item) => stringId(item))
			.map((item) => ({
				id: stringId(item),
				label: `${displayName(medialist)} - ${displayName(item)}`,
			})),
	)
	if (choicesChanged(instance.CHOICES_MEDIALIST_SELECTED_MEDIA, choices)) {
		instance.CHOICES_MEDIALIST_SELECTED_MEDIA = choices
		instance.updateActions()
		instance.updateFeedbacks()
	}
	instance.setVariableValues({
		medialistSelectedId: id || 'None',
		medialistSelectedName: displayName(medialist) || 'None',
	})
	instance.checkFeedbacks('medialistSelected')
}

export function registerSignalREvents(instance: MulticamInstance, connection: ReceiverConnection): void {
	const registered = new Set<string>()
	const on = (name: ReceiverMethod | string, handler: (...args: any[]) => void | Promise<void>): void => {
		registered.add(name)
		connection.on(name, async (...args: any[]) => {
			markSignalREvent(instance, name, args)
			try {
				await handler(...args)
			} catch (error: any) {
				instance.log('warn', `SignalR handler ${name} failed: ${error?.message ?? error}`)
			}
		})
	}

	on('OnApplicationInitialized', () => queueDataRefresh(instance, 'all', true))
	on('OnApplicationInitializedWithDetails', (moduleName: string, room: unknown) => {
		instance.RUNNING_APPLICATION = moduleName ?? ''
		if (isRecord(room)) instance.ROOM_SELECTED = room
		instance.setVariableValues({
			runningApp: moduleName || 'None',
			selected_room: getField(room, 'name', 'Name') ?? '',
			selectedRoomId: getField(room, 'id', 'Id') ?? '',
		})
		queueDataRefresh(instance, 'all', true)
	})
	on('OnApplicationExited', () => {
		instance.RUNNING_APPLICATION = ''
		instance.RECORDING = false
		instance.ACTIVE_STREAMS = []
		instance.setVariableValues({
			runningApp: 'None',
			recording: false,
			recordingState: 'Stopped',
			streamingActiveProfiles: '',
			streamingActiveProfileCount: 0,
			streamingAnyActive: false,
		})
		instance.checkAllFeedbacks()
		queueDataRefresh(instance, 'application')
	})
	on('OnAutomaticModeChanged', (isAuto: boolean) => {
		instance.setVariableValues({ applicationAutoState: isAuto ? 'Auto' : 'Manual' })
		instance.checkFeedbacks('applicationAutoMode')
	})
	on('OnRecordingStarting', () => {
		instance.setVariableValues({ recordingState: 'Starting' })
	})
	on('OnRecordStarted', () => {
		instance.RECORDING = true
		instance.setVariableValues({ recording: true, recordingState: 'Recording' })
		instance.checkFeedbacks('recording')
	})
	on('OnRecordTimeChanged', (currentTime: unknown) => {
		instance.setVariableValues({ signalrRecordTime: valueToString(currentTime) })
	})
	on('OnRecordStopped', () => {
		instance.RECORDING = false
		instance.setVariableValues({ recording: false, recordingState: 'Stopped' })
		instance.checkFeedbacks('recording')
	})
	on('OnRecordFinalized', () => {
		instance.setVariableValues({ recordingState: 'Finalized' })
		queueDataRefresh(instance, 'publisher', true)
	})
	on('OnLiveExcerptStarted', () => {
		updateLiveExtract(instance, instance.RECORDING_LIVE_EXTRACT, true)
		queueDataRefresh(instance, 'recording')
	})
	on('OnLiveExcerptFinished', () => updateLiveExtract(instance, instance.RECORDING_LIVE_EXTRACT, false))
	on('OnProfilesChanged', () => queueDataRefresh(instance, 'streaming'))
	on('OnStreamingStarted', (profile: unknown) => updateActiveStream(instance, profile, true))
	on('OnStreamingStopped', (profile: unknown) => updateActiveStream(instance, profile, false))
	on('OnStreamingProfileUpdated', (profile: unknown) => {
		updateActiveStream(instance, profile)
	})
	on('OnRecordingAdded', (recording: unknown) => {
		setPublisherRecordings(instance, upsertById(instance.PUBLISHER_RECORDINGS, recording))
	})
	on('OnRecordingDeleted', (recording: unknown) => {
		setPublisherRecordings(instance, removeById(instance.PUBLISHER_RECORDINGS, recording))
	})
	on('OnRecordingUpdated', (recording: unknown) => {
		setPublisherRecordings(instance, upsertById(instance.PUBLISHER_RECORDINGS, recording))
	})
	on('OnPublishingJobAdded', (job: unknown) => {
		setPublishingJobs(instance, upsertById(instance.SIGNALR_PUBLISHING_JOBS, job))
	})
	on('OnPublishingJobDeleted', (job: unknown) => {
		setPublishingJobs(instance, removeById(instance.SIGNALR_PUBLISHING_JOBS, job))
	})
	on('OnPublishingJobUpdated', (job: unknown) => {
		setPublishingJobs(instance, upsertById(instance.SIGNALR_PUBLISHING_JOBS, job))
	})
	on('OnUserSelectedMicrophoneChanged', (micNumber: number) => {
		instance.SIGNALR_SELECTED_MICROPHONE = Number(micNumber)
		instance.setVariableValues({ signalrSelectedMicrophone: Number(micNumber) })
	})
	on('OnLivePresetChanged', () => queueDataRefresh(instance, 'automation'))
	on('OnMicrophoneStateChanged', (micState: unknown) => {
		instance.setVariableValues({ signalrMicrophoneState: safeStringify(micState) })
		const mode = getField(micState, 'automationMode', 'AutomationMode')
		if (mode !== undefined) setApplicationSpecificVariable(instance, 'confAutomationMode', 'radioAutomationMode', mode)
		const running = instance.RUNNING_APPLICATION.toLowerCase()
		if (running.includes('radio')) instance.RADIO_STATE.microphones = micState
		else if (running.includes('conf')) instance.CONF_STATE.microphones = micState
		queueDataRefresh(instance, 'automation')
	})
	on('OnPresetsBankChanged', (bankName: string) => {
		setApplicationSpecificVariable(instance, 'confPresetBank', 'radioPresetBank', bankName ?? '')
		queueDataRefresh(instance, 'automation')
	})
	on('OnAutomationAssistMessageNotified', (message: string) => {
		instance.setVariableValues({ signalrAutomationAssistMessage: message ?? '' })
	})
	on('OnAutoTitlingConfigUpdated', (updatedInfo: unknown) => {
		instance.setVariableValues({ signalrAutoTitlingConfig: safeStringify(updatedInfo) })
		const enabled = getField(updatedInfo, 'isEnabled', 'IsEnabled', 'enabled', 'Enabled')
		if (typeof enabled === 'boolean') {
			setApplicationSpecificVariable(instance, 'confAutoTitling', 'radioAutoTitling', enabled)
			const running = instance.RUNNING_APPLICATION.toLowerCase()
			if (running.includes('radio')) instance.RADIO_STATE.autoTitling = updatedInfo
			else if (running.includes('conf')) instance.CONF_STATE.autoTitling = updatedInfo
		}
	})
	on('OnAutomationNotification', (notification: unknown) => {
		instance.setVariableValues({ signalrAutomationNotification: safeStringify(notification) })
	})
	on('OnLiveTitlerFileChanged', (apiFile: unknown) => {
		instance.TITLER_FILE_SELECTED = isRecord(apiFile) ? apiFile : {}
		instance.setVariableValues({
			titlerSelectedFileName: displayName(apiFile) || 'None',
			titlerSelectedFileId: stringId(apiFile) || 'None',
		})
		queueDataRefresh(instance, 'titler')
	})
	on('OnTitlerElementUpdated', (updatedElement: unknown) => {
		const normalized = normalizeTitlerElement(updatedElement)
		const id = stringId(normalized)
		const existing = instance.TITLER_SELECTED_FILE_ELEMENTS.find((element) => stringId(element) === id)
		const merged = isRecord(existing) && isRecord(normalized) ? { ...existing, ...normalized } : normalized
		instance.TITLER_SELECTED_FILE_ELEMENTS = upsertById(instance.TITLER_SELECTED_FILE_ELEMENTS, merged)
		instance.checkFeedbacks('titlerElementVisible')
		queueDataRefresh(instance, 'titler')
	})
	on('OnTitlerStaticFileLiveRowChanged', (elementId: unknown, newLiveRow: unknown) => {
		setTitlerLiveRow(instance, elementId, newLiveRow)
	})
	on('OnTitlerStaticFileRowDeleted', () => queueDataRefresh(instance, 'titler'))
	on('OnTitlerStaticFileRowAdded', () => queueDataRefresh(instance, 'titler'))
	on('OnTitlerStaticFileRowEdited', () => queueDataRefresh(instance, 'titler'))
	on('OnTitlerSocialMediaMessageReceived', (post: unknown) => {
		instance.setVariableValues({ signalrSocialMediaPost: safeStringify(post) })
	})
	on('OnLiveComposerFileChanged', (fileName: string | null) => {
		instance.setVariableValues({ composerSelectedFileName: fileName ?? 'None' })
	})
	on('OnLiveComposerCompoChanged', (compoName: string | null) => {
		instance.setVariableValues({ composerSelectedCompositionSceneName: compoName ?? 'None' })
	})
	on('OnLiveComposerFileIdChanged', (composerFileId: unknown) => {
		const id = valueToString(composerFileId)
		instance.COMPOSER_FILE_SELECTED = id
		const selected = instance.COMPOSER_FILES.find(
			(file) => String(getField(file, 'composerFileId', 'ComposerFileId', 'id', 'Id') ?? '') === id,
		)
		instance.setVariableValues({
			composerSelectedFileId: id || 'None',
			...(selected ? { composerSelectedFileName: displayName(selected) || 'None' } : {}),
		})
		instance.checkFeedbacks('composerSelectedFile')
		queueDataRefresh(instance, 'composer')
	})
	on('OnLiveComposerCompoIdChanged', (compoId: unknown) => {
		const id = valueToString(compoId)
		instance.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID = id
		const compositions = Array.isArray(instance.COMPOSER_FILE_SELECTED_COMPOSITIONS)
			? instance.COMPOSER_FILE_SELECTED_COMPOSITIONS
			: []
		const selected = compositions.find(
			(composition: unknown) =>
				String(getField(composition, 'composerSceneId', 'ComposerSceneId', 'id', 'Id') ?? '') === id,
		)
		if (selected) instance.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION = selected
		instance.setVariableValues({
			composerSelectedCompositionSceneId: id || 'None',
			...(selected ? { composerSelectedCompositionSceneName: displayName(selected) || 'None' } : {}),
		})
		instance.checkFeedbacks('composerSelectedComposition')
	})
	on('OnLiveScenesFileChanged', (scenesFileId: unknown) => {
		const id = valueToString(scenesFileId)
		const selected = instance.SCENE_FILES.find((file) => stringId(file) === id)
		instance.SCENES_FILE_SELECTED = selected ?? (id ? { Id: id } : {})
		instance.setVariableValues({
			sceneSelectedFileId: id || 'None',
			...(selected ? { sceneSelectedFileName: displayName(selected) || 'None' } : {}),
		})
		instance.checkFeedbacks('sceneSelectedFile')
		queueDataRefresh(instance, 'scenes')
	})
	on('OnLiveScenesSceneChanged', (liveSceneId: unknown) => {
		const id = valueToString(liveSceneId)
		instance.SCENES_FILE_SELECTED_SCENE_ID = id
		const selected = instance.SCENES_FILE_SELECTED_SCENES.find((scene) => stringId(scene) === id)
		instance.SCENES_FILE_SELECTED_SCENE = selected ?? (id ? { Id: id } : {})
		instance.setVariableValues({
			sceneSelectedSceneId: id || 'None',
			...(selected ? { sceneSelectedSceneName: displayName(selected) || 'None' } : {}),
		})
		instance.checkFeedbacks('sceneSelectedScene')
		queueDataRefresh(instance, 'scenes')
	})
	on('OnSceneSnapshotUpdated', () => queueDataRefresh(instance, 'scenes'))
	on('OnPlaylistPlay', (medialistId: unknown, item: unknown, position: number) => {
		setMedialistState(instance, medialistId, item, position)
		instance.setVariableValues({ medialistPlaying: true })
	})
	on('OnPlaylistStop', (medialistId: unknown) => {
		setMedialistState(instance, medialistId)
		instance.setVariableValues({ medialistPlaying: false })
	})
	on('OnLivePlaylistItemChanged', (medialistId: unknown, item: unknown, position: number) => {
		setMedialistState(instance, medialistId, item, position)
	})
	on('OnLivePlaylistFileChanged', (medialist: unknown) => {
		setSelectedMedialist(instance, medialist)
	})
	on('OnLivePlaylistItemAdded', () => queueDataRefresh(instance, 'medialist'))
	on('OnLivePlaylistItemRemoved', () => queueDataRefresh(instance, 'medialist'))
	on('OnLivePlaylistItemIndexChanged', () => queueDataRefresh(instance, 'medialist'))
	on('OnLivePlaylistItemModified', (item: unknown) => {
		setMedialistState(instance, '', item)
		queueDataRefresh(instance, 'medialist')
	})
	on('OnPlaylistItemModified', () => queueDataRefresh(instance, 'medialist'))
	on('OnPlaylistLoadingStateChanged', (medialist: unknown, isLoading: boolean) => {
		instance.setVariableValues({
			medialistLoading: Boolean(isLoading),
			medialistSelectedId: stringId(medialist) || 'None',
		})
	})
	on('OnLiveSourceChanged', (info: unknown) => {
		const source = getField(info, 'mainSource', 'MainSource', 'sourceName', 'SourceName', 'source', 'Source')
		const isComposition = getField(info, 'isComposition', 'IsComposition')
		instance.setVariableValues({ signalrLiveSourceInfo: safeStringify(info) })
		if (isRecord(info)) instance.VIDEO_MIXER = info
		if (source !== undefined) {
			instance.VIDEO_LIVE_SOURCE = String(source)
			instance.setVariableValues({ videoLiveSource: String(source) })
			instance.checkFeedbacks('videoLiveSource')
		}
		if (isComposition !== undefined) instance.setVariableValues({ videoMixerIsComposition: Boolean(isComposition) })
	})
	on('OnLiveSourceChanging', (info: unknown) => {
		instance.setVariableValues({ signalrLiveSourceChanging: safeStringify(info) })
	})
	on('OnPilotedDeviceChanged', (info: unknown) => {
		instance.setVariableValues({ signalrPilotedDevice: safeStringify(info) })
	})
	on('OnAssistViewedSceneChanged', (sceneInfo: unknown) => {
		instance.setVariableValues({ signalrAssistViewedScene: safeStringify(sceneInfo) })
	})
	on('OnZoneAdded', (zone: unknown) => setCropZones(instance, upsertById(instance.SIGNALR_CROP_ZONES, zone)))
	on('OnZoneDeleted', (zoneId: unknown) => setCropZones(instance, removeById(instance.SIGNALR_CROP_ZONES, zoneId)))
	on('OnZoneUpdated', (zone: unknown) => setCropZones(instance, upsertById(instance.SIGNALR_CROP_ZONES, zone)))

	for (const method of SIGNALR_RECEIVER_METHODS) {
		if (!registered.has(method)) on(method, () => queueDataRefresh(instance, 'all'))
	}

	// Older builds did not include complete payloads, so reconcile only their related resource through HTTP.
	const legacyRefreshTargets: Record<string, PollScope> = {
		OnMultipleDisplaySetupChanged: 'video',
		OnPreviewCompoChanged: 'composer',
		OnPreviewCompoIdChanged: 'composer',
		OnPreviewComposerFileChanged: 'composer',
		OnPreviewComposerFileIdChanged: 'composer',
		OnPreviewSceneChanged: 'scenes',
		OnRoomAdded: 'application',
		OnRoomDeleted: 'application',
		OnRoomUpdated: 'application',
		OnStaticTitleChanged: 'titler',
		OnTitlerElementAdded: 'titler',
		OnTitlerElementDeleted: 'titler',
		OnTitlerElementsCleared: 'titler',
		OnTitlerFileSelectedRowEdited: 'titler',
		OnTitlerFileSelectedRowSelectionChanged: 'titler',
		OnTitlerSelectedFileRowsCleared: 'titler',
		OnTitlerSelectedFileRowsUpdated: 'titler',
	}
	for (const [legacyMethod, target] of Object.entries(legacyRefreshTargets)) {
		on(legacyMethod, () => queueDataRefresh(instance, target, true))
	}
	on('OnSelectedZoneChanged', () => void SyncSignalRState(instance))
}

async function invokeForSync(
	instance: MulticamInstance,
	connection: signalR.HubConnection,
	method: SignalRStateMethod,
): Promise<{ ok: boolean; value?: any }> {
	try {
		return { ok: true, value: await connection.invoke(method) }
	} catch (error: any) {
		instance.log('debug', `SignalR sync ${method} unavailable: ${error?.message ?? error}`)
		return { ok: false }
	}
}

export async function SyncSignalRState(instance: MulticamInstance): Promise<void> {
	const connection = instance._signalR
	if (!connection || connection.state !== signalR.HubConnectionState.Connected) return

	const methods = SIGNALR_STATE_METHODS
	const results = await Promise.all(methods.map(async (method) => invokeForSync(instance, connection, method)))
	const values = new Map(methods.map((method, index) => [method, results[index]]))

	const application = values.get('GetCurrentApplication')
	if (application?.ok) {
		instance.RUNNING_APPLICATION = String(application.value ?? '')
		instance.setVariableValues({ runningApp: application.value || 'None' })
	}
	const recordings = values.get('GetRecordings')
	if (recordings?.ok) setPublisherRecordings(instance, recordings.value)
	const lastRecording = values.get('GetLastRecording')
	if (lastRecording?.ok) instance.setVariableValues({ signalrLastRecording: safeStringify(lastRecording.value) })
	const workflows = values.get('GetWorkflows')
	if (workflows?.ok) setPublisherWorkflows(instance, workflows.value)
	const jobs = values.get('GetPublishingJobs')
	if (jobs?.ok) setPublishingJobs(instance, jobs.value)
	const recording = values.get('GetRecordingState')
	if (recording?.ok) {
		instance.RECORDING = Boolean(recording.value)
		instance.setVariableValues({
			recording: instance.RECORDING,
			recordingState: instance.RECORDING ? 'Recording' : 'Stopped',
		})
	}
	const liveExtract = values.get('GetLiveExtractState')
	if (liveExtract?.ok) updateLiveExtract(instance, liveExtract.value)
	const streaming = values.get('GetStreamingState')
	if (streaming?.ok) instance.setVariableValues({ streamingAnyActive: Boolean(streaming.value) })
	const microphone = values.get('GetUserSelectedMicrophone')
	if (microphone?.ok) {
		instance.SIGNALR_SELECTED_MICROPHONE = Number(microphone.value)
		instance.setVariableValues({ signalrSelectedMicrophone: instance.SIGNALR_SELECTED_MICROPHONE })
	}
	const zoom = values.get('GetIsZoomFeatureEnabled')
	if (zoom?.ok) {
		instance.SIGNALR_ZOOM_ENABLED = Boolean(zoom.value)
		instance.setVariableValues({ signalrZoomFeatureEnabled: instance.SIGNALR_ZOOM_ENABLED })
	}
	const zones = values.get('GetCropZones')
	if (zones?.ok) setCropZones(instance, zones.value)
	instance.checkAllFeedbacks()
}

export async function InitSignalR(instance: MulticamInstance): Promise<void> {
	instance.log('debug', 'Initializing SignalR connection')
	cancelSignalRReconnect(instance)
	setConnectionState(instance, false)

	const url = `http://${instance.config.host}:${instance.config.port}/signalr`
	const options: signalR.IHttpConnectionOptions = {}
	if (instance.config.specifyApiKey && instance.secrets.apiKey) {
		options.headers = { 'x-apikey': instance.secrets.apiKey }
	}
	const connection = new signalR.HubConnectionBuilder()
		.withUrl(url, options)
		.withAutomaticReconnect({
			nextRetryDelayInMilliseconds: (context) => Math.min(1000 * 2 ** context.previousRetryCount, 30000),
		})
		.configureLogging(instance.config.verbose ? signalR.LogLevel.Information : signalR.LogLevel.Warning)
		.build()

	instance._signalR = connection
	registerSignalREvents(instance, connection)
	connection.onclose((error) => {
		if (instance._signalR !== connection) return
		setConnectionState(instance, false)
		instance.log('warn', `SignalR closed: ${error?.message ?? 'no error'}`)
		scheduleSignalRReconnect(instance, connection)
	})
	connection.onreconnecting((error) => {
		if (instance._signalR !== connection) return
		setConnectionState(instance, false)
		instance.log('warn', `SignalR reconnecting: ${error?.message ?? 'no error'}`)
	})
	connection.onreconnected((connectionId) => {
		if (instance._signalR !== connection) return
		cancelSignalRReconnect(instance)
		setConnectionState(instance, true)
		instance.log('info', `SignalR reconnected. connectionId=${connectionId ?? 'null'}`)
		void (async () => {
			await SyncSignalRState(instance)
			// Events emitted during the disconnect are not replayed. Reconcile once, including HTTP-only state.
			await runPollCycle(instance, { forceSignalRRefresh: true })
		})()
	})

	await startSignalRConnection(instance, connection)
}

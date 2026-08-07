import { InstanceStatus } from '@companion-module/base'
import * as signalR from '@microsoft/signalr'
import type { MulticamInstance, StreamingProfile } from './main.js'

function safeStringify(value: any): string {
	try {
		return JSON.stringify(value)
	} catch (_e) {
		return String(value)
	}
}

/** Keep retrying forever while Multicam is offline (e.g. overnight reboot). */
const SIGNALR_RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000, 15000, 30000]

export async function stopSignalR(instance: MulticamInstance): Promise<void> {
	const existing = instance._signalR
	instance._signalR = null
	if (!existing) return

	try {
		await existing.stop()
	} catch (e: any) {
		instance.log('debug', `SignalR stop ignored: ${e?.message ?? e}`)
	}
}

export function initSignalR(instance: MulticamInstance): void {
	void (async () => {
		instance.log('debug', 'Initializing SignalR connection')

		await stopSignalR(instance)

		const url = `http://${instance.config.host}:${instance.config.port}/signalr`

		const connection = new signalR.HubConnectionBuilder()
			.withUrl(url)
			.withAutomaticReconnect({
				nextRetryDelayInMilliseconds: (retryContext) => {
					const index = Math.min(retryContext.previousRetryCount, SIGNALR_RECONNECT_DELAYS_MS.length - 1)
					return SIGNALR_RECONNECT_DELAYS_MS[index]
				},
			})
			.configureLogging(signalR.LogLevel.Information)
			.build()

		connection.onclose((err) => {
			instance.log('warn', `SignalR closed: ${err?.message ?? 'no error'}`)
			// Only recover if this hub is still the active one (not an intentional stopSignalR)
			if (instance._signalR === connection) {
				instance._signalR = null
				instance.updateStatus(InstanceStatus.ConnectionFailure, 'SignalR disconnected')
				void import('./api.js').then(({ scheduleReconnect }) => {
					scheduleReconnect(instance, 'SignalR disconnected')
				})
			}
		})
		connection.onreconnecting((err) => {
			instance.log('warn', `SignalR reconnecting: ${err?.message ?? 'no error'}`)
			instance.updateStatus(InstanceStatus.Connecting, 'SignalR reconnecting...')
		})
		connection.onreconnected((connectionId) => {
			instance.log('info', `SignalR reconnected. connectionId=${connectionId ?? 'null'}`)
			instance.updateStatus(InstanceStatus.Ok)
		})

		// --- IAssistHubToClient (server -> client) ---

		connection.on('OnApplicationExited', () => {
			instance.log('info', 'SignalR: Application Exited')
			instance.setVariableValues({ runningApp: 'None' })
		})

		connection.on('OnApplicationInitialized', () => {
			instance.log('info', 'SignalR: Application Initialized')
		})

		connection.on('OnApplicationInitializedWithDetails', (moduleName: string, room: any) => {
			instance.log('info', `SignalR: Initialized (${moduleName})`)
			instance.log('debug', `Data: ${safeStringify(room)}`)
			instance.setVariableValues({ runningApp: moduleName })
		})

		connection.on('OnAssistViewedSceneChanged', (sceneInfo: any) => {
			instance.log('info', `SignalR: Assist Viewed Scene Changed: ${sceneInfo?.name ?? 'null'}`)
		})

		connection.on('OnAutoTitlingConfigUpdated', (updatedInfo: any) => {
			instance.log('debug', `SignalR: OnAutoTitlingConfigUpdated: ${safeStringify([updatedInfo])}`)
		})

		connection.on('OnAutomaticModeChanged', (isAuto: boolean) => {
			instance.log('info', `SignalR: Automatic Mode Changed: ${isAuto}`)
			instance.setVariableValues({
				applicationAutoState: isAuto ? 'Auto' : 'Manual',
			})
		})

		connection.on('OnAutomationAssistMessageNotified', (message: string) => {
			instance.log('debug', `SignalR: OnAutomationAssistMessageNotified: ${safeStringify([message])}`)
		})

		connection.on('OnAutomationNotification', (notification: any) => {
			instance.log('debug', `SignalR: OnAutomationNotification: ${safeStringify([notification])}`)
		})

		connection.on('OnLiveComposerCompoChanged', (compoName: string) => {
			instance.log('info', `SignalR: Composer Composition Changed: ${compoName}`)
			instance.setVariableValues({
				composerSelectedCompositionSceneName: compoName ?? 'None',
			})
		})

		connection.on('OnLiveComposerCompoIdChanged', (compoId: string) => {
			instance.log('info', `SignalR: Composer Composition ID Changed: ${compoId}`)
			instance.setVariableValues({
				composerSelectedCompositionSceneId: compoId ?? 'None',
			})
		})

		connection.on('OnLiveComposerFileChanged', (fileName: string | null) => {
			instance.log('info', `SignalR: Live Composer File Changed: ${fileName ?? 'null'}`)
			instance.setVariableValues({ composerSelectedFileName: fileName ?? 'None' })
		})

		connection.on('OnLiveComposerFileIdChanged', (composerFileId: string | null) => {
			instance.log('info', `SignalR: Live Composer File ID Changed: ${composerFileId ?? 'null'}`)
			instance.setVariableValues({ composerSelectedFileId: composerFileId ?? 'None' })
		})

		connection.on('OnLiveExcerptFinished', () => {
			instance.log('debug', 'SignalR: OnLiveExcerptFinished')
		})

		connection.on('OnLiveExcerptStarted', () => {
			instance.log('debug', 'SignalR: OnLiveExcerptStarted')
		})

		connection.on('OnLivePlaylistFileChanged', (medialist: any) => {
			instance.log('info', `SignalR: Live Playlist File Changed: ${medialist?.name ?? 'unknown'}`)
			instance.log('debug', `Playlist: ${safeStringify(medialist)}`)
		})

		connection.on('OnLivePlaylistItemAdded', (item: any) => {
			instance.log('debug', `SignalR: OnLivePlaylistItemAdded: ${safeStringify([item])}`)
		})

		connection.on('OnLivePlaylistItemChanged', (item: any) => {
			instance.log('debug', `SignalR: OnLivePlaylistItemChanged: ${safeStringify([item])}`)
		})

		connection.on('OnLivePlaylistItemIndexChanged', (itemId: string, newIndex: number) => {
			instance.log('debug', `SignalR: OnLivePlaylistItemIndexChanged: ${safeStringify([itemId, newIndex])}`)
		})

		connection.on('OnLivePlaylistItemModified', (item: any) => {
			instance.log('debug', `SignalR: OnLivePlaylistItemModified: ${safeStringify([item])}`)
		})

		connection.on('OnLivePlaylistItemRemoved', (itemId: string) => {
			instance.log('debug', `SignalR: OnLivePlaylistItemRemoved: ${safeStringify([itemId])}`)
		})

		connection.on('OnLiveScenesFileChanged', (sceneInfo: any | null) => {
			instance.log('info', `SignalR: Live Scenes File Changed: ${sceneInfo?.name ?? 'null'}`)

			instance.setVariableValues({
				sceneSelectedFileName: sceneInfo?.name ?? 'None',
				sceneSelectedFileId: sceneInfo?.id ?? 'None',
			})
		})

		connection.on('OnLiveTitlerFileChanged', (data: any | null) => {
			instance.log('info', `SignalR: Live Titler File Changed: ${data?.name ?? 'null'}`)
			instance.setVariableValues({
				titlerSelectedFileName: data?.name ?? 'None',
				titlerSelectedFileId: data?.id ?? 'None',
			})
		})

		connection.on('OnMultipleDisplaySetupChanged', (setup: any) => {
			instance.log('debug', `SignalR: OnMultipleDisplaySetupChanged: ${safeStringify([setup])}`)
		})

		connection.on('OnPreviewCompoChanged', (compoName: string) => {
			instance.log('debug', `SignalR: OnPreviewCompoChanged: ${safeStringify([compoName])}`)
		})

		connection.on('OnPreviewCompoIdChanged', (compoId: string) => {
			instance.log('debug', `SignalR: OnPreviewCompoIdChanged: ${safeStringify([compoId])}`)
		})

		connection.on('OnPreviewComposerFileChanged', (fileName: string) => {
			instance.log('debug', `SignalR: OnPreviewComposerFileChanged: ${safeStringify([fileName])}`)
		})

		connection.on('OnPreviewComposerFileIdChanged', (composerFileId: string) => {
			instance.log('debug', `SignalR: OnPreviewComposerFileIdChanged: ${safeStringify([composerFileId])}`)
		})

		connection.on('OnPreviewSceneChanged', (sceneInfo: any) => {
			instance.log('debug', `SignalR: OnPreviewSceneChanged: ${safeStringify([sceneInfo])}`)
		})

		connection.on('OnRoomAdded', (room: any) => {
			instance.log('debug', `SignalR: OnRoomAdded: ${safeStringify([room])}`)
		})

		connection.on('OnRoomDeleted', (roomId: string) => {
			instance.log('debug', `SignalR: OnRoomDeleted: ${safeStringify([roomId])}`)
		})

		connection.on('OnRoomUpdated', (room: any) => {
			instance.log('debug', `SignalR: OnRoomUpdated: ${safeStringify([room])}`)
		})

		connection.on('OnSelectedZoneChanged', (zoneId: string) => {
			instance.log('debug', `SignalR: OnSelectedZoneChanged: ${safeStringify([zoneId])}`)
		})

		connection.on('OnStaticTitleChanged', (title: any) => {
			instance.log('debug', `SignalR: OnStaticTitleChanged: ${safeStringify([title])}`)
		})

		connection.on('OnTitlerElementAdded', (element: any) => {
			instance.log('debug', `SignalR: OnTitlerElementAdded: ${safeStringify([element])}`)
		})

		connection.on('OnTitlerElementDeleted', (elementId: string) => {
			instance.log('debug', `SignalR: OnTitlerElementDeleted: ${safeStringify([elementId])}`)
		})

		connection.on('OnTitlerElementUpdated', (data: any) => {
			instance.log('info', 'SignalR: Titler Element Updated')
			instance.log('debug', `Data: ${safeStringify(data)}`)
		})

		connection.on('OnTitlerElementsCleared', () => {
			instance.log('debug', 'SignalR: OnTitlerElementsCleared')
		})

		connection.on('OnTitlerFileSelectedRowEdited', (rowIndex: number, row: any) => {
			instance.log('debug', `SignalR: OnTitlerFileSelectedRowEdited: ${safeStringify([rowIndex, row])}`)
		})

		connection.on('OnTitlerFileSelectedRowSelectionChanged', (rowIndex: number) => {
			instance.log('debug', `SignalR: OnTitlerFileSelectedRowSelectionChanged: ${safeStringify([rowIndex])}`)
		})

		connection.on('OnTitlerSelectedFileRowsCleared', () => {
			instance.log('debug', 'SignalR: OnTitlerSelectedFileRowsCleared')
		})

		connection.on('OnTitlerSelectedFileRowsUpdated', (rows: any[]) => {
			instance.log('debug', `SignalR: OnTitlerSelectedFileRowsUpdated: ${safeStringify([rows])}`)
		})

		connection.on('OnTitlerStaticFileRowEdited', (rowIndex: number, row: any) => {
			instance.log('debug', `SignalR: OnTitlerStaticFileRowEdited: ${safeStringify([rowIndex, row])}`)
		})

		connection.on('OnUserSelectedMicrophoneChanged', (microphoneId: string) => {
			instance.log('debug', `SignalR: OnUserSelectedMicrophoneChanged: ${safeStringify([microphoneId])}`)
		})

		connection.on('OnZoneAdded', (zone: any) => {
			instance.log('debug', `SignalR: OnZoneAdded: ${safeStringify([zone])}`)
		})

		connection.on('OnZoneDeleted', (zoneId: string) => {
			instance.log('debug', `SignalR: OnZoneDeleted: ${safeStringify([zoneId])}`)
		})

		connection.on('OnZoneUpdated', (zone: any) => {
			instance.log('debug', `SignalR: OnZoneUpdated: ${safeStringify([zone])}`)
		})

		connection.on('OnRecordStarted', (media: any) => {
			instance.log('debug', `SignalR: OnRecordStarted: ${safeStringify([media])}`)
			instance.setVariableValues({
				recording: true,
			})
			instance.checkFeedbacks('recording')
		})

		connection.on('OnRecordStopped', () => {
			instance.log('debug', 'SignalR: OnRecordStopped')
			instance.setVariableValues({
				recording: false,
			})
			instance.checkFeedbacks('recording')
		})

		connection.on('OnStreamingStarted', (profile: StreamingProfile) => {
			instance.log('debug', `SignalR: OnStreamingStarted: ${safeStringify([profile])}`)
			instance.ACTIVE_STREAMS.push(profile)
			instance.checkFeedbacks('streaming')
		})
		connection.on('OnStreamingStopped', (profile: StreamingProfile) => {
			instance.log('debug', `SignalR: OnStreamingStopped: ${safeStringify([profile])}`)
			instance.ACTIVE_STREAMS = instance.ACTIVE_STREAMS.filter((p) => p.id !== profile.id)
			instance.checkFeedbacks('streaming')
		})

		// ---- start ----
		instance._signalR = connection
		try {
			await connection.start()
			instance.log('info', 'SignalR connected')
		} catch (e: any) {
			instance.log('error', `SignalR failed to start: ${e?.message ?? e}`)
			if (instance._signalR === connection) {
				instance._signalR = null
				instance.updateStatus(InstanceStatus.ConnectionFailure, 'SignalR failed to start')
				void import('./api.js').then(({ scheduleReconnect }) => {
					scheduleReconnect(instance, 'SignalR failed to start')
				})
			}
		}
	})()
}

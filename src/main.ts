import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { InitConnection, ProbeConnection } from './api.js'
import type * as signalR from '@microsoft/signalr'
import { stopPolling } from './polling.js'
import { cancelSignalRReconnect } from './signalr.js'

const CONNECTION_HEALTH_CHECK_INTERVAL_MS = 5000
const CONNECTION_HEALTH_FAILURE_THRESHOLD = 2
const CONNECTION_RETRY_BASE_MS = 2000
const CONNECTION_RETRY_MAX_MS = 30000

export interface StreamingProfile {
	id: string
	name: string
	isEnabled: boolean
	broadcastServerHostname: string
	broadcastStreamID: string
	isStarted: boolean
	canBeLaunchedRemotely: boolean
	errorMessage: string
}

export interface DropdownChoice {
	id: string
	label: string
}

export type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export class MulticamInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // Setup in init()
	secrets: ModuleSecrets = { apiKey: '' }
	CHOICES_APPLICATIONS: DropdownChoice[]
	APPLICATIONS: any[] = [] //list of licensed applications
	APPLICATION_TEMPLATES: Record<string, any[]> = {}
	CHOICES_APPLICATION_TEMPLATES: DropdownChoice[] = []
	RUNNING_APPLICATION: string = ''
	ROOMS: any[] = [] //list of rooms
	CHOICES_ROOMS: DropdownChoice[] = [] //choices for rooms
	ROOM_SELECTED: any = {} //currently selected room
	AUDIO_PROFILES: any[] = [] //list of audio profiles
	AUDIO_PROFILE_SELECTED: any = {} //currently selected audio profile
	CHOICES_AUDIO_PROFILES: DropdownChoice[] = [] //choices for audio profiles

	//CAMERA / PILOT / STUDIO
	CHOICES_CAMERA_SOURCES: DropdownChoice[] = []
	CHOICES_CAMERA_INDEXES: DropdownChoice[] = []
	PILOT_SEQUENCES: any[] = []
	CHOICES_PILOT_SEQUENCES: DropdownChoice[] = []
	STUDIO_PRESETS: any[] = []
	CHOICES_STUDIO_PRESETS: DropdownChoice[] = []

	//CONF
	CONF_MICROPHONES: any[] = []
	CHOICES_CONF_MICROPHONES: DropdownChoice[] = []
	CONF_PRESET_BANKS: any[] = []
	CHOICES_CONF_PRESET_BANKS: DropdownChoice[] = []
	CONF_STATE: any = {}

	//INSITU
	INSITU_TAGS: any[] = []
	INSITU_ACTIVE_TAGS: any[] = []
	CHOICES_INSITU_TAGS: DropdownChoice[] = []
	INSITU_LAYOUTS: any[] = []
	INSITU_ACTIVE_LAYOUT: any = {}
	CHOICES_INSITU_LAYOUTS: DropdownChoice[] = []
	INSITU_PRESETS: any[] = []
	CHOICES_INSITU_PRESETS: DropdownChoice[] = []

	COMPOSER_FILES: any[] = [] //list of composer files
	COMPOSER_FILE_SELECTED: any = {} //currently selected composer file
	COMPOSER_FILE_SELECTED_COMPOSITIONS: any = {} //contents of selected composer file
	COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION: any = {} //currently selected composition in selected composer
	COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID: string = '' //id of currently selected composition in selected composer

	CHOICES_COMPOSER_FILES: DropdownChoice[] = [] //choices for composer files
	CHOICES_COMPOSER_COMPOSITIONS: DropdownChoice[] = [] //choices for compositions in selected composer file
	CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS: DropdownChoice[] = [] //choices for elements in selected composition

	CHOICES_VIDEO_SOURCES: DropdownChoice[] = []
	CHOICES_RECORDING_AUX_SOURCES: DropdownChoice[] = []

	CHOICES_MEDIALIST_SELECTED_MEDIA: DropdownChoice[] = [] //choices for media in selected medialist
	/** All media in all medialists; id is `medialistId|mediaId`, label `Medialist Name - Media Name`. */
	CHOICES_MEDIALISTS_MEDIA: DropdownChoice[] = []
	MEDIALISTS: any[] = [] //list of medialists
	CHOICES_MEDIALISTS: DropdownChoice[] = [] //choices for medialists
	MEDIALIST_SELECTED: any = {} //currently selected medialist
	MEDIALIST_SELECTED_MEDIA: any[] = [] //media items in selected medialist
	CHOICES_RADIO_PRESET_BANKS: DropdownChoice[] = [] //choices for radio preset banks
	RADIO_PRESET_BANKS: any[] = [] //list of radio preset banks
	RADIO_MICROPHONES: any[] = []
	CHOICES_RADIO_MICROPHONES: DropdownChoice[] = []
	RADIO_STATE: any = {}
	RADIO_AUTOMATION_VARIABLES: any[] = []

	//PUBLISHER
	PUBLISHER_RECORDINGS: any[] = []
	CHOICES_PUBLISHER_RECORDINGS: DropdownChoice[] = []
	PUBLISHER_WORKFLOWS: any[] = []
	CHOICES_PUBLISHER_WORKFLOWS: DropdownChoice[] = []
	SIGNALR_PUBLISHING_JOBS: any[] = []
	SIGNALR_CROP_ZONES: any[] = []
	CHOICES_SIGNALR_CROP_ZONES: DropdownChoice[] = []
	SIGNALR_NETWORK_SHARE: any = null
	SIGNALR_PAGED_RECORDINGS: any = null
	SIGNALR_SELECTED_MICROPHONE: number = -1
	SIGNALR_ZOOM_ENABLED: boolean = false
	SIGNALR_CONNECTED: boolean = false
	SIGNALR_LAST_EVENT: string = ''
	SIGNALR_LAST_PAYLOAD: string = ''

	//SCENES
	SCENE_FILES: any[] = [] //list of scene files
	SCENES_FILE_SELECTED: any = {} //currently selected scene file
	CHOICES_SCENES_FILES: DropdownChoice[] = [] //choices for scene files
	SCENES_FILE_SELECTED_SCENES: any[] = [] //scenes in currently selected scene file
	CHOICES_SCENES_FILE_SELECTED_SCENES: DropdownChoice[] = [] //choices for scenes in selected scene file
	SCENES_FILE_SELECTED_SCENE: any = {} //currently selected scene in selected scene file
	SCENES_FILE_SELECTED_SCENE_ID: string = '' //id of currently selected scene in selected scene file

	STREAMING_CATALOG_SELECTED: any = {}
	STREAMING_PROFILES: any[] = []
	CHOICES_STREAMING_CATALOGS: DropdownChoice[] = [] //choices for streaming catalogs
	CHOICES_STREAMING_PROFILES: DropdownChoice[] = [] //choices for streaming profiles

	//TITLER
	TITLER_FILES: any[] = [] //list of titler files
	TITLER_FILE_SELECTED: any = {} //currently selected titler file
	CHOICES_TITLER_FILES: DropdownChoice[] = [] //choices for titler files
	TITLER_SELECTED_FILE_ELEMENTS: any[] = [] //elements in currently selected titler file
	CHOICES_TITLER_ELEMENTS: DropdownChoice[] = [] //choices for titler elements
	CHOICES_TITLER_SPEAKER_ELEMENTS: DropdownChoice[] = []
	CHOICES_TITLER_PANEL_ELEMENTS: DropdownChoice[] = []
	CHOICES_TITLER_TICKER_ELEMENTS: DropdownChoice[] = []
	CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS: DropdownChoice[] = [] //choices for titler elements speaker rows
	CHOICES_TITLER_ELEMENTS_PANEL_ROWS: DropdownChoice[] = [] //choices for titler elements panel rows
	TITLER_ELEMENT_STRUCTURES: Record<string, any> = {}

	//STATUS
	RECORDING: boolean = false //recording is currently active
	RECORDING_PAUSED: boolean = false
	RECORDING_LIVE_EXTRACT: any = {}
	ACTIVE_STREAMS: StreamingProfile[] = [] //profiles in the selected streaming catalog
	VIDEO_LIVE_SOURCE: string = ''
	VIDEO_MIXER: any = {}
	MEDIA_CONSTRAINTS: any = {}

	pollInterval: NodeJS.Timeout | null = null
	_signalR: signalR.HubConnection | null = null
	private connectionAttempt = 0
	private isDestroyed = false
	private reconnectTimer: NodeJS.Timeout | null = null
	private healthCheckTimer: NodeJS.Timeout | null = null
	private healthCheckInFlightForAttempt: number | null = null
	private healthCheckFailures = 0
	private connectionRetryCount = 0

	constructor(internal: unknown) {
		super(internal)

		this.CHOICES_APPLICATIONS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_APPLICATION_TEMPLATES = [{ id: 'none', label: 'None' }]

		this.CHOICES_AUDIO_PROFILES = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_CAMERA_SOURCES = Array.from({ length: 40 }, (_, index) => ({
			id: `CAM${index + 1}`,
			label: `CAM${index + 1}`,
		}))
		this.CHOICES_CAMERA_INDEXES = Array.from({ length: 40 }, (_, index) => ({
			id: String(index),
			label: `Camera ${index + 1} (index ${index})`,
		}))
		this.CHOICES_PILOT_SEQUENCES = [{ id: 'none', label: 'None' }]
		this.CHOICES_STUDIO_PRESETS = [{ id: 'none', label: 'None' }]
		this.CHOICES_CONF_MICROPHONES = [{ id: 'none', label: 'None' }]
		this.CHOICES_CONF_PRESET_BANKS = [{ id: 'none', label: 'None' }]
		this.CHOICES_INSITU_TAGS = [{ id: 'none', label: 'None' }]
		this.CHOICES_INSITU_LAYOUTS = [{ id: 'none', label: 'None' }]
		this.CHOICES_INSITU_PRESETS = [{ id: 'none', label: 'None' }]

		this.CHOICES_COMPOSER_FILES = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_COMPOSER_COMPOSITIONS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_VIDEO_SOURCES = [
			...Array.from({ length: 40 }, (_, index) => ({
				id: `Source ${index + 1}`,
				label: `Source ${index + 1}`,
			})),
			{ id: 'PC Input', label: 'PC Input' },
			{ id: 'Medialist', label: 'Medialist' },
		]
		this.CHOICES_RECORDING_AUX_SOURCES = Array.from({ length: 40 }, (_, index) => ({
			id: `Source ${index + 1}`,
			label: `Source ${index + 1}`,
		}))

		this.CHOICES_MEDIALIST_SELECTED_MEDIA = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_MEDIALISTS_MEDIA = [{ id: 'None', label: 'None' }]

		this.CHOICES_RADIO_PRESET_BANKS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_RADIO_MICROPHONES = [{ id: 'none', label: 'None' }]
		this.CHOICES_PUBLISHER_RECORDINGS = [{ id: 'none', label: 'None' }]
		this.CHOICES_PUBLISHER_WORKFLOWS = [{ id: 'none', label: 'None' }]
		this.CHOICES_SIGNALR_CROP_ZONES = [{ id: 'none', label: 'None' }]

		this.CHOICES_SCENES_FILES = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_SCENES_FILE_SELECTED_SCENES = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_STREAMING_CATALOGS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_STREAMING_PROFILES = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_TITLER_FILES = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_TITLER_ELEMENTS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_TITLER_SPEAKER_ELEMENTS = [{ id: 'none', label: 'None' }]
		this.CHOICES_TITLER_PANEL_ELEMENTS = [{ id: 'none', label: 'None' }]
		this.CHOICES_TITLER_TICKER_ELEMENTS = [{ id: 'none', label: 'None' }]
		this.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_TITLER_ELEMENTS_PANEL_ROWS = [{ id: 'none', label: 'None' }] //default value
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets ?? { apiKey: '' }
		this.isDestroyed = false
		this.updateActions(false) // export actions; presets are exported after feedbacks
		this.updateFeedbacks() // export feedbacks
		this.updatePresets() // export presets
		this.updateVariableDefinitions() // export variable definitions
		this.startConnection()
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
		this.isDestroyed = true
		this.connectionAttempt++
		this.clearConnectionTimers()
		stopPolling(this)
		cancelSignalRReconnect(this)
		if (this._signalR) {
			const connection = this._signalR
			this._signalR = null
			await connection.stop()
		}
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets ?? { apiKey: '' }
		this.startConnection()
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(updatePresets: boolean = true): void {
		UpdateActions(this)
		if (updatePresets) this.updatePresets()
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	private startConnection(): void {
		const attempt = ++this.connectionAttempt
		this.clearConnectionTimers()
		this.connectionRetryCount = 0
		stopPolling(this)
		this.launchConnectionAttempt(attempt)
	}

	private launchConnectionAttempt(attempt: number): void {
		void this.initConnection(attempt).catch((error) => {
			if (this.isCurrentConnectionAttempt(attempt)) {
				this.log('error', `Failed to initialize connection: ${error}`)
				this.scheduleConnectionRetry(attempt)
			}
		})
	}

	private async initConnection(attempt: number): Promise<void> {
		const isCurrent = (): boolean => this.isCurrentConnectionAttempt(attempt)
		if (!isCurrent()) return

		cancelSignalRReconnect(this)
		if (this._signalR) {
			const connection = this._signalR
			this._signalR = null
			await connection.stop()
			if (!isCurrent()) return
		}

		const connected = await InitConnection(this, isCurrent)
		if (!isCurrent()) return

		if (connected) {
			this.connectionRetryCount = 0
			this.startConnectionHealthCheck(attempt)
		} else {
			this.scheduleConnectionRetry(attempt)
		}
	}

	private isCurrentConnectionAttempt(attempt: number): boolean {
		return !this.isDestroyed && attempt === this.connectionAttempt
	}

	private scheduleConnectionRetry(attempt: number): void {
		if (!this.isCurrentConnectionAttempt(attempt) || this.reconnectTimer || !this.config.host || !this.config.port) {
			return
		}

		const delay = Math.min(
			CONNECTION_RETRY_BASE_MS * 2 ** Math.min(this.connectionRetryCount, 4),
			CONNECTION_RETRY_MAX_MS,
		)
		this.connectionRetryCount++
		const delaySeconds = Math.ceil(delay / 1000)
		this.updateStatus(InstanceStatus.ConnectionFailure, `Multicam unavailable - retrying in ${delaySeconds}s`)
		this.log('warn', `Multicam unavailable; retrying /api/application/version in ${delaySeconds}s`)

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			if (this.isCurrentConnectionAttempt(attempt)) this.launchConnectionAttempt(attempt)
		}, delay)
	}

	private startConnectionHealthCheck(attempt: number): void {
		if (this.healthCheckTimer) clearInterval(this.healthCheckTimer)
		this.healthCheckFailures = 0
		this.healthCheckTimer = setInterval(() => {
			void this.checkConnectionHealth(attempt)
		}, CONNECTION_HEALTH_CHECK_INTERVAL_MS)
	}

	private async checkConnectionHealth(attempt: number): Promise<void> {
		if (!this.isCurrentConnectionAttempt(attempt) || this.healthCheckInFlightForAttempt === attempt) return

		this.healthCheckInFlightForAttempt = attempt
		let connected = false
		try {
			connected = await ProbeConnection(this)
		} finally {
			if (this.healthCheckInFlightForAttempt === attempt) this.healthCheckInFlightForAttempt = null
		}

		if (!this.isCurrentConnectionAttempt(attempt)) return
		if (connected) {
			this.healthCheckFailures = 0
			return
		}

		this.healthCheckFailures++
		if (this.healthCheckFailures < CONNECTION_HEALTH_FAILURE_THRESHOLD) {
			this.log('warn', 'Multicam health check failed once; waiting for confirmation')
			return
		}

		this.log('warn', 'Connection to Multicam lost; starting automatic reconnection')
		this.updateStatus(InstanceStatus.ConnectionFailure, 'Connection lost - reconnecting...')
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer)
			this.healthCheckTimer = null
		}
		stopPolling(this)
		this.connectionRetryCount = 0
		this.launchConnectionAttempt(attempt)
	}

	private clearConnectionTimers(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer)
			this.healthCheckTimer = null
		}
		this.healthCheckFailures = 0
	}
}

export default MulticamInstance

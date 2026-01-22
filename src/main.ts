import { InstanceBase, runEntrypoint, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdateVariableDefinitions } from './variables.js'
import { InitConnection } from './api.js'
import type * as signalR from '@microsoft/signalr'

export class MulticamInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()
	CHOICES_APPLICATIONS: { id: string; label: string }[]
	APPLICATIONS: any[] = [] //list of licensed applications
	ROOMS: any[] = [] //list of rooms
	ROOM_SELECTED: any = {} //currently selected room
	AUDIO_PROFILES: any[] = [] //list of audio profiles
	AUDIO_PROFILE_SELECTED: any = {} //currently selected audio profile
	CHOICES_AUDIO_PROFILES: { id: string; label: string }[] = [] //choices for audio profiles

	COMPOSER_FILES: any[] = [] //list of composer files
	COMPOSER_FILE_SELECTED: any = {} //currently selected composer file
	COMPOSER_FILE_SELECTED_COMPOSITIONS: any = {} //contents of selected composer file
	COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION: any = {} //currently selected composition in selected composer
	COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID: string = '' //id of currently selected composition in selected composer

	CHOICES_COMPOSER_FILES: { id: string; label: string }[] = [] //choices for composer files
	CHOICES_COMPOSER_COMPOSITIONS: { id: string; label: string }[] = [] //choices for compositions in selected composer file
	CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS: { id: string; label: string }[] = [] //choices for elements in selected composition

	CHOICES_VIDEO_SOURCES: { id: string; label: string }[] = []

	CHOICES_MEDIALIST_SELECTED_MEDIA: { id: string; label: string }[] = [] //choices for media in selected medialist
	MEDIALISTS: any[] = [] //list of medialists
	CHOICES_MEDIALISTS: { id: string; label: string }[] = [] //choices for medialists
	MEDIALIST_SELECTED: any = {} //currently selected medialist
	MEDIALIST_SELECTED_MEDIA: any[] = [] //media items in selected medialist
	CHOICES_RADIO_PRESET_BANKS: { id: string; label: string }[] = [] //choices for radio preset banks
	RADIO_PRESET_BANKS: any[] = [] //list of radio preset banks

	//SCENES
	SCENE_FILES: any[] = [] //list of scene files
	SCENES_FILE_SELECTED: any = {} //currently selected scene file
	CHOICES_SCENES_FILES: { id: string; label: string }[] = [] //choices for scene files
	SCENES_FILE_SELECTED_SCENES: any[] = [] //scenes in currently selected scene file
	CHOICES_SCENES_FILE_SELECTED_SCENES: { id: string; label: string }[] = [] //choices for scenes in selected scene file
	SCENES_FILE_SELECTED_SCENE: any = {} //currently selected scene in selected scene file
	SCENES_FILE_SELECTED_SCENE_ID: string = '' //id of currently selected scene in selected scene file

	CHOICES_STREAMING_CATALOGS: { id: string; label: string }[] = [] //choices for streaming catalogs
	CHOICES_STREAMING_PROFILES: { id: string; label: string }[] = [] //choices for streaming profiles

	//TITLER
	TITLER_FILES: any[] = [] //list of titler files
	CHOICES_TITLER_FILES: { id: string; label: string }[] = [] //choices for titler files
	TITLER_SELECTED_FILE_ELEMENTS: any[] = [] //elements in currently selected titler file
	CHOICES_TITLER_ELEMENTS: { id: string; label: string }[] = [] //choices for titler elements
	CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS: { id: string; label: string }[] = [] //choices for titler elements speaker rows
	CHOICES_TITLER_ELEMENTS_PANEL_ROWS: { id: string; label: string }[] = [] //choices for titler elements panel rows

	pollInterval: NodeJS.Timeout | null = null
	_signalR: signalR.HubConnection | null = null

	constructor(internal: unknown) {
		super(internal)

		this.CHOICES_APPLICATIONS = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_AUDIO_PROFILES = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_COMPOSER_FILES = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_COMPOSER_COMPOSITIONS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_VIDEO_SOURCES = [
			{ id: 'Unknown', label: 'Unknown' },
			{ id: 'VGA', label: 'VGA' },
			{ id: 'CAM1', label: 'CAM1' },
			{ id: 'CAM2', label: 'CAM2' },
			{ id: 'CAM3', label: 'CAM3' },
			{ id: 'CAM4', label: 'CAM4' },
			{ id: 'CAM5', label: 'CAM5' },
			{ id: 'CAM6', label: 'CAM6' },
			{ id: 'CAM7', label: 'CAM7' },
			{ id: 'CAM8', label: 'CAM8' },
			{ id: 'CAM9', label: 'CAM9' },
			{ id: 'CAM10', label: 'CAM10' },
			{ id: 'CAM11', label: 'CAM11' },
			{ id: 'CAM12', label: 'CAM12' },
			{ id: 'CAM13', label: 'CAM13' },
			{ id: 'CAM14', label: 'CAM14' },
			{ id: 'CAM15', label: 'CAM15' },
			{ id: 'CAM16', label: 'CAM16' },
			{ id: 'CAM17', label: 'CAM17' },
			{ id: 'CAM18', label: 'CAM18' },
			{ id: 'CAM19', label: 'CAM19' },
			{ id: 'CAM20', label: 'CAM20' },
			{ id: 'CAM21', label: 'CAM21' },
			{ id: 'CAM22', label: 'CAM22' },
			{ id: 'CAM23', label: 'CAM23' },
			{ id: 'CAM24', label: 'CAM24' },
			{ id: 'CAM25', label: 'CAM25' },
			{ id: 'CAM26', label: 'CAM26' },
			{ id: 'CAM27', label: 'CAM27' },
			{ id: 'CAM28', label: 'CAM28' },
			{ id: 'CAM29', label: 'CAM29' },
			{ id: 'CAM30', label: 'CAM30' },
			{ id: 'CAM31', label: 'CAM31' },
			{ id: 'CAM32', label: 'CAM32' },
			{ id: 'CAM33', label: 'CAM33' },
			{ id: 'CAM34', label: 'CAM34' },
			{ id: 'CAM35', label: 'CAM35' },
			{ id: 'CAM36', label: 'CAM36' },
			{ id: 'CAM37', label: 'CAM37' },
			{ id: 'CAM38', label: 'CAM38' },
			{ id: 'CAM39', label: 'CAM39' },
			{ id: 'CAM40', label: 'CAM40' },
			{ id: 'AUDIO1', label: 'AUDIO1' },
			{ id: 'AUDIO2', label: 'AUDIO2' },
			{ id: 'AUDIO3', label: 'AUDIO3' },
			{ id: 'AUDIO4', label: 'AUDIO4' },
			{ id: 'AUDIO5', label: 'AUDIO5' },
			{ id: 'AUDIO6', label: 'AUDIO6' },
			{ id: 'AUDIO7', label: 'AUDIO7' },
			{ id: 'AUDIO8', label: 'AUDIO8' },
			{ id: 'Playlist', label: 'Playlist' },
			{ id: 'Output', label: 'Output' },
			{ id: 'Composition', label: 'Composition' },
			{ id: 'File', label: 'File' },
			{ id: 'WebRTC', label: 'WebRTC' },
		] //choices for video sources (cameras, screen captures, etc.)

		this.CHOICES_MEDIALIST_SELECTED_MEDIA = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_RADIO_PRESET_BANKS = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_SCENES_FILES = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_SCENES_FILE_SELECTED_SCENES = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_STREAMING_CATALOGS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_STREAMING_PROFILES = [{ id: 'none', label: 'None' }] //default value

		this.CHOICES_TITLER_FILES = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_TITLER_ELEMENTS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS = [{ id: 'none', label: 'None' }] //default value
		this.CHOICES_TITLER_ELEMENTS_PANEL_ROWS = [{ id: 'none', label: 'None' }] //default value


	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions

		try {
			await this.initConnection()
		} catch (error) {
			this.log('error', `Failed to initialize connection: ${error}`)
		}
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config

		try {
			await this.initConnection()
		} catch (error) {
			this.log('error', `Failed to initialize connection: ${error}`)
		}
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	async initConnection(): Promise<void> {
		await InitConnection(this)
	}
}

runEntrypoint(MulticamInstance, UpgradeScripts)

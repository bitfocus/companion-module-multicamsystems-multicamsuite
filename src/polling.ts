import type { DropdownChoice, MulticamInstance, StreamingProfile } from './main.js'

type FetchErrorDedupeState = {
	suppressDuplicateMessage: string | null
}

export type PollScope =
	| 'application'
	| 'automation'
	| 'composer'
	| 'medialist'
	| 'publisher'
	| 'recording'
	| 'scenes'
	| 'streaming'
	| 'titler'
	| 'video'

export type PollOptions = {
	/** Also read state endpoints normally replaced by SignalR while it is connected. */
	forceSignalRRefresh?: boolean
}

type PollQueueState = {
	running: Promise<void> | null
	activeFull: boolean
	fullRequested: boolean
	forceSignalRRefresh: boolean
	scopes: Set<PollScope>
}

const pollQueueByInstance = new WeakMap<MulticamInstance, PollQueueState>()
const fetchErrorDedupeByInstance = new WeakMap<MulticamInstance, FetchErrorDedupeState>()
function getFetchErrorDedupeState(self: MulticamInstance) {
	let s = fetchErrorDedupeByInstance.get(self)
	if (!s) {
		s = { suppressDuplicateMessage: null }
		fetchErrorDedupeByInstance.set(self, s)
	}
	return s
}
function markFetchSucceeded(self: MulticamInstance) {
	const s = fetchErrorDedupeByInstance.get(self)
	if (s) {
		s.suppressDuplicateMessage = null
	}
}
export function startPolling(self: MulticamInstance): void {
	stopPolling(self)
	//poll once
	void runPollCycle(self)
	let interval = 30000
	if (!self.config.enablePolling) {
		self.log('info', 'Polling is disabled in config, use "Manually Refresh Data" action to update data')
	} else {
		interval = Number(self.config.pollingInterval || 5000)
		if (!interval || isNaN(interval)) {
			self.log('error', 'Invalid polling interval in config')
			return
		}
		self.pollInterval = setInterval(() => {
			void runPollCycle(self)
		}, interval)
		self.log('info', `Started polling every ${interval}ms`)
	}
}
export function stopPolling(self?: MulticamInstance): void {
	if (self?.pollInterval) {
		clearInterval(self.pollInterval)
		self.pollInterval = null
	}
}
export async function runPollCycle(self: MulticamInstance, options: PollOptions = {}): Promise<void> {
	return queuePollRequest(self, true, [], options)
}

/** Refresh only the HTTP resources whose SignalR event did not carry a complete payload. */
export async function runPollScopes(
	self: MulticamInstance,
	scopes: Iterable<PollScope>,
	options: PollOptions = {},
): Promise<void> {
	return queuePollRequest(self, false, scopes, options)
}

function getPollQueue(self: MulticamInstance): PollQueueState {
	let state = pollQueueByInstance.get(self)
	if (!state) {
		state = {
			running: null,
			activeFull: false,
			fullRequested: false,
			forceSignalRRefresh: false,
			scopes: new Set<PollScope>(),
		}
		pollQueueByInstance.set(self, state)
	}
	return state
}

async function queuePollRequest(
	self: MulticamInstance,
	full: boolean,
	scopes: Iterable<PollScope>,
	options: PollOptions,
): Promise<void> {
	const state = getPollQueue(self)
	if (full) {
		// Interval ticks are coalesced while a complete cycle is already running.
		if (state.activeFull && !options.forceSignalRRefresh) return state.running as Promise<void>
		state.fullRequested = true
	} else {
		for (const scope of scopes) state.scopes.add(scope)
	}
	state.forceSignalRRefresh ||= Boolean(options.forceSignalRRefresh)
	if (!state.running) state.running = Promise.resolve().then(async () => drainPollQueue(self, state))
	return state.running
}

async function drainPollQueue(self: MulticamInstance, state: PollQueueState): Promise<void> {
	try {
		while (state.fullRequested || state.scopes.size > 0) {
			const full = state.fullRequested
			const scopes = new Set(state.scopes)
			const forceSignalRRefresh = state.forceSignalRRefresh
			state.fullRequested = false
			state.forceSignalRRefresh = false
			state.scopes.clear()

			try {
				state.activeFull = full
				if (full) {
					await executeFullPoll(self, forceSignalRRefresh)
					if (scopes.size > 0) await executeScopedPoll(self, scopes, forceSignalRRefresh)
				} else {
					await executeScopedPoll(self, scopes, forceSignalRRefresh)
				}
			} catch (err) {
				self.log('error', `Polling failed: ${err}`)
			} finally {
				state.activeFull = false
			}
		}
	} finally {
		state.running = null
	}
}

async function executeFullPoll(self: MulticamInstance, forceSignalRRefresh: boolean): Promise<void> {
	// Capture this once: the initial cycle must remain a complete HTTP snapshot even if SignalR connects mid-cycle.
	const includeSignalRState = forceSignalRRefresh || !self.SIGNALR_CONNECTED
	await pollApplication(self, includeSignalRState)
	await pollConf(self)
	await pollComposer(self, includeSignalRState)
	await pollInsitu(self)
	await pollMedialist(self, includeSignalRState)
	await pollPublisher(self)
	await pollRadio(self)
	await pollRecording(self)
	await pollScenes(self, includeSignalRState)
	await pollStreaming(self, includeSignalRState)
	await pollStudio(self)
	await pollTitler(self, includeSignalRState)
	await pollVideo(self)
	await pollApiState(self, fetchData, updateVariable, includeSignalRState)
}

async function executeScopedPoll(
	self: MulticamInstance,
	scopes: Set<PollScope>,
	forceSignalRRefresh: boolean,
): Promise<void> {
	const includeSignalRState = forceSignalRRefresh || !self.SIGNALR_CONNECTED
	const flags: UpdateFlags = { actions: false, feedbacks: false }
	if (scopes.has('application')) await pollApplication(self, includeSignalRState)
	if (scopes.has('composer')) await pollComposer(self, includeSignalRState)
	if (scopes.has('medialist')) await pollMedialist(self, includeSignalRState)
	if (scopes.has('publisher')) await pollApiPublisher(self, fetchData, updateVariable, flags, includeSignalRState)
	if (scopes.has('recording')) await pollApiRecording(self, fetchData, updateVariable, includeSignalRState)
	if (scopes.has('scenes')) await pollScenes(self, includeSignalRState)
	if (scopes.has('streaming')) await pollStreaming(self, true)
	if (scopes.has('titler')) {
		await pollTitler(self, includeSignalRState)
		await pollTitlerStructures(self, fetchData, updateVariable, flags)
	}
	if (scopes.has('video')) await pollApiVideo(self, fetchData, updateVariable, flags, includeSignalRState)
	if (scopes.has('automation')) {
		const running = self.RUNNING_APPLICATION.toLowerCase().replace(/\s+/g, '')
		if (running.includes('conf')) await pollApiConf(self, fetchData, updateVariable, flags)
		if (running.includes('radio')) await pollApiRadio(self, fetchData, updateVariable, flags)
	}

	if (scopes.has('streaming')) syncActiveStreamsFromProfiles(self)
	if (flags.actions) self.updateActions()
	if (flags.feedbacks) self.updateFeedbacks()
	self.checkAllFeedbacks()
}

async function pollApplication(self: MulticamInstance, includeSignalRState: boolean = true) {
	//get system information
	self.log('debug', 'Polling application/system information')
	const data = await fetchData(self, '/api/application/system')
	if (data) {
		await updateVariable(self, 'computerName', data.ComputerName)
		await updateVariable(self, 'multicamName', data.MulticamName)
	}
	const licensedApps = await fetchData(self, '/api/application')
	if (Array.isArray(licensedApps)) {
		self.APPLICATIONS = licensedApps
		await updateVariable(self, 'licensedApps', licensedApps.join(', '))
		//build CHOICES_APPLICATIONS
		//it is just a string array
		const choices = []
		for (const app of licensedApps) {
			choices.push({ id: app, label: app })
		}
		//if no licensed apps, add 'None' choice
		if (choices.length === 0) {
			choices.push({ id: 'None', label: 'None' })
		}
		//only update if choices have changed
		if (JSON.stringify(self.CHOICES_APPLICATIONS) !== JSON.stringify(choices)) {
			self.CHOICES_APPLICATIONS = choices
			self.updateActions()
			self.updateFeedbacks()
		}
	}
	const version = await fetchData(self, '/api/application/version')
	if (version) {
		await updateVariable(self, 'applicationVersion', version)
	}
	//get templates for every licensed Application
	self.APPLICATION_TEMPLATES = {}
	const templateChoices = []
	for (const app of self.APPLICATIONS) {
		const templates = await fetchData(self, `/api/application/templates/${encodeURIComponent(String(app))}`)
		if (Array.isArray(templates)) {
			self.APPLICATION_TEMPLATES[String(app)] = templates
			for (const template of templates) {
				if (template?.Name) {
					templateChoices.push({
						id: JSON.stringify([String(app), String(template.Name)]),
						label: `${app} - ${template.Name}`,
					})
				}
			}
		}
	}
	await updateVariable(self, 'applicationTemplates', JSON.stringify(self.APPLICATION_TEMPLATES))
	if (templateChoices.length === 0) templateChoices.push({ id: 'none', label: 'None' })
	if (JSON.stringify(self.CHOICES_APPLICATION_TEMPLATES) !== JSON.stringify(templateChoices)) {
		self.CHOICES_APPLICATION_TEMPLATES = templateChoices
		self.updateActions()
	}
	//get rooms
	const rooms = await fetchData(self, '/api/application/rooms')
	if (Array.isArray(rooms)) {
		self.ROOMS = rooms
		await updateVariable(
			self,
			'rooms',
			rooms
				.map((room) => room?.Name)
				.filter(Boolean)
				.join(', '),
		)
		//Build CHOICES_ROOMS
		const choices = rooms.map((r) => {
			return { id: r.Id, label: r.Name }
		})
		if (choices.length === 0) {
			choices.push({ id: 'None', label: 'None' })
		}
		if (JSON.stringify(self.CHOICES_ROOMS) !== JSON.stringify(choices)) {
			self.CHOICES_ROOMS = choices
			self.updateActions()
		}
	}
	//get selected room
	const selectedRoom = await fetchData(self, '/api/application/rooms/selected')
	if (selectedRoom && typeof selectedRoom === 'object' && !Array.isArray(selectedRoom)) {
		self.ROOM_SELECTED = selectedRoom
		await updateVariable(self, 'selected_room', selectedRoom.Name || '')
		await updateVariable(self, 'selectedRoomId', selectedRoom.Id || '')
	}
	if (includeSignalRState) {
		// SignalR keeps these values current after the initial snapshot and after reconnect reconciliation.
		const runningApp = await fetchData(self, '/api/application/running')
		if (runningApp) {
			self.RUNNING_APPLICATION = String(runningApp)
			await updateVariable(self, 'runningApp', runningApp || 'None')
		} else {
			self.RUNNING_APPLICATION = ''
			await updateVariable(self, 'runningApp', 'None')
		}
		const appState = await fetchData(self, '/api/application/auto')
		if (typeof appState === 'boolean') {
			await updateVariable(self, 'applicationAutoState', appState ? 'Auto' : 'Manual')
		}
	}
}

async function pollComposer(self: MulticamInstance, includeSignalRState: boolean = true) {
	self.log('debug', 'Polling Composer')
	//get composer files
	const files = await fetchData(self, '/api/v3/composer')
	if (Array.isArray(files)) {
		self.COMPOSER_FILES = files
		if (!includeSignalRState) {
			const selectedId =
				typeof self.COMPOSER_FILE_SELECTED === 'string'
					? self.COMPOSER_FILE_SELECTED
					: String(self.COMPOSER_FILE_SELECTED?.ComposerFileId ?? self.COMPOSER_FILE_SELECTED?.Id ?? '')
			const selected = files.find((file) => String(file?.ComposerFileId ?? file?.Id ?? '') === selectedId)
			if (selected) {
				self.COMPOSER_FILE_SELECTED = selectedId
				await updateVariable(self, 'composerSelectedFileName', selected.ComposerFileName ?? selected.Name ?? '')
				await updateVariable(self, 'composerSelectedFileId', selectedId)
			}
		}
		//console.log('files', files)
		//build CHOICES_COMPOSER_FILES
		const choices = files.map((f) => {
			return { id: f.ComposerFileId, label: f.ComposerFileName }
		})
		if (choices.length === 0) {
			choices.push({ id: 'None', label: 'None' })
		}
		//only update if choices have changed
		if (JSON.stringify(self.CHOICES_COMPOSER_FILES) !== JSON.stringify(choices)) {
			self.CHOICES_COMPOSER_FILES = choices
			self.updateActions()
			self.updateFeedbacks()
		}
	} else {
		self.log('debug', 'Unable to fetch composer files, application not launched')
	}
	// The selected file is updated by SignalR while connected; HTTP remains the initial/fallback source.
	if (includeSignalRState) {
		const selectedFile = await fetchData(self, '/api/v3/composer/selected')
		if (selectedFile && typeof selectedFile === 'object' && !Array.isArray(selectedFile)) {
			self.COMPOSER_FILE_SELECTED = selectedFile.ComposerFileId
			await updateVariable(self, 'composerSelectedFileName', selectedFile.ComposerFileName || '')
			await updateVariable(self, 'composerSelectedFileId', selectedFile.ComposerFileId || '')
			self.log('debug', `Selected composer file ID: ${selectedFile.ComposerFileId}`)
			self.log('debug', `Selected composer file Name: ${selectedFile.ComposerFileName}`)
		} else {
			self.log('debug', 'Unable to fetch selected composer file, application not launched')
		}
	}
	//get selected composer file's content
	const content = await fetchData(self, '/api/v3/composer/selected/compositions')
	if (Array.isArray(content)) {
		if (content.length > 0) {
			self.COMPOSER_FILE_SELECTED_COMPOSITIONS = content
			if (!includeSignalRState) {
				const selectedId = self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID
				const selected = content.find(
					(composition) => String(composition?.ComposerSceneId ?? composition?.Id ?? '') === selectedId,
				)
				if (selected) {
					self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION = selected
					await updateVariable(
						self,
						'composerSelectedCompositionSceneName',
						selected.ComposerSceneName ?? selected.Name ?? '',
					)
					await updateVariable(self, 'composerSelectedCompositionSceneId', selectedId)
				}
			}
			//console.log('content', content)
			//build CHOICES_COMPOSER_COMPOSITIONS
			const choices = content.map((c) => {
				return { id: c.ComposerSceneId, label: c.ComposerSceneName }
			})
			if (choices.length === 0) {
				self.log('debug', 'No compositions found in selected composer file')
				choices.push({ id: 'None', label: 'None' })
			}
			//console.log('CHOICES_COMPOSER_COMPOSITIONS:', choices)
			//only update if choices have changed
			if (JSON.stringify(self.CHOICES_COMPOSER_COMPOSITIONS) !== JSON.stringify(choices)) {
				self.CHOICES_COMPOSER_COMPOSITIONS = choices
				self.updateActions()
				self.updateFeedbacks()
			}
			//also build CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS
			const tempChoicesElements = []
			for (const composition of content) {
				//console.log('composition', composition)
				if (composition.ComposerElements) {
					for (const element of composition.ComposerElements) {
						const id = `${composition.ComposerSceneId}_${element.Id}`
						tempChoicesElements.push({
							id,
							label: `${composition.ComposerSceneName} - ${element.Name} (${element.Source})`,
						})
					}
				}
			}
			if (tempChoicesElements.length === 0) {
				self.log('debug', 'No composition elements found in selected composer file')
				tempChoicesElements.push({ id: 'None', label: 'None' })
			}
			//console.log('CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS:', tempChoicesElements)
			//only update if choices have changed
			if (JSON.stringify(self.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS) !== JSON.stringify(tempChoicesElements)) {
				self.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS = tempChoicesElements
				self.updateActions()
				self.updateFeedbacks()
			}
		} else {
			self.log('debug', 'Unable to fetch composer file elements, no file selected')
		}
	} else {
		self.log('debug', 'Unable to fetch composer file content, application not launched')
	}
	if (includeSignalRState) {
		const composition = await fetchData(self, '/api/v3/composer/selected/compositions/selected')
		if (composition && typeof composition === 'object' && !Array.isArray(composition)) {
			self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION = composition
			self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID = composition.ComposerSceneId || ''
			await updateVariable(self, 'composerSelectedCompositionSceneName', composition.ComposerSceneName || '')
			await updateVariable(self, 'composerSelectedCompositionSceneId', composition.ComposerSceneId || '')
		} else {
			self.log('debug', 'Unable to fetch selected composition, application not launched')
		}
	}
}
async function pollConf(_self: MulticamInstance) {
	//self.log('info', 'Polling Conf')
	//get workspace information
	/*const workspace = await fetchData(self, '/api/v2/conf/workspace')
    if (workspace) {
        await updateVariable(self, 'workspace', JSON.stringify(workspace))
    }

    //get workspace image
    const workspaceImage = await fetchData(self, '/api/v2/conf/workspace/image')
    if (workspaceImage) {
        await updateVariable(self, 'workspace_image', workspaceImage || '')
    }

    //get the microphones automation mode and those targeted whether manually or by AI.
    const microphones = await fetchData(self, '/api/v2/conf/microphones')
    if (microphones) {
        await updateVariable(self, 'microphones', JSON.stringify(microphones))
    }

    //get ai dynamism score
    const dynamism = await fetchData(self, '/api/v2/conf/dynamism')
    if (dynamism) {
        await updateVariable(self, 'conf_dynamism', dynamism.Dynamism || '')
    }

    //get preset banks
    const presetBanks = await fetchData(self, '/api/v2/conf/presetsbanks')
    if (presetBanks) {
        await updateVariable(self, 'preset_banks', JSON.stringify(presetBanks))
    }

    //get current presets bank
    const currentPresetBank = await fetchData(self, '/api/v2/conf/presetsbanks/current')
    if (currentPresetBank) {
        await updateVariable(self, 'current_preset_bank', currentPresetBank || '')
    }

    //get automatic titling state
    const autoTitling = await fetchData(self, '/api/v2/conf/autotitling')
    if (autoTitling) {
        await updateVariable(self, 'autotitling', autoTitling.Enabled ? 'Enabled' : 'Disabled')
    }*/
}
async function pollInsitu(_self: MulticamInstance) {
	//self.log('info', 'Polling Insitu')
	/*
    //get tags
    const tags = await fetchData(self, '/api/insitu/tags')
    if (tags) {
        await updateVariable(self, 'insitu_tags', JSON.stringify(tags))
    }

    //get tags details
    const tagsDetails = await fetchData(self, '/api/insitu/tagsdetails')
    if (tagsDetails) {
        await updateVariable(self, 'insitu_tags_details', JSON.stringify(tagsDetails))
    }
*/
}
/** Separator between medialist id and media id in {@link MulticamInstance.CHOICES_MEDIALISTS_MEDIA} choice ids. */
const MEDIALIST_MEDIA_ID_SEP = '|'
/** Parse composite id from {@link buildMedialistsMediaChoices}. */
export function parseMedialistMediaGlobalChoiceId(choiceId: string): { medialistId: string; mediaId: string } | null {
	if (!choiceId || choiceId === 'None') return null
	const i = choiceId.indexOf(MEDIALIST_MEDIA_ID_SEP)
	if (i <= 0 || i === choiceId.length - 1) return null
	return { medialistId: choiceId.slice(0, i), mediaId: choiceId.slice(i + 1) }
}
async function buildMedialistsMediaChoices(self: MulticamInstance, medialists: any[]) {
	const buckets = await Promise.all(
		medialists.map(async (ml) => {
			const mlName = String(ml.Name ?? '')
			const mlId = String(ml.Id ?? '')
			let items = Array.isArray(ml.Items) ? ml.Items : []
			if (items.length === 0 && mlId) {
				const detail = await fetchData(self, `/api/v3/medialist/${encodeURIComponent(mlId)}`)
				if (detail && typeof detail === 'object' && Array.isArray(detail.Items)) {
					items = detail.Items
				}
			}
			return items.map((it: any) => {
				const mediaId = String(it.Id ?? '')
				const mediaName = String(it.MediaName ?? it.Name ?? '')
				return {
					id: `${mlId}${MEDIALIST_MEDIA_ID_SEP}${mediaId}`,
					label: `${mlName} - ${mediaName}`,
				}
			})
		}),
	)
	const choices = buckets.flat()
	if (choices.length === 0) {
		return [{ id: 'None', label: 'None' }]
	}
	choices.sort((a, b) => a.label.localeCompare(b.label))
	return choices
}

function updateSelectedMedialistChoices(self: MulticamInstance, selectedMedialist: any): void {
	const medialistName = String(selectedMedialist?.Name ?? selectedMedialist?.name ?? '')
	const items = Array.isArray(selectedMedialist?.Items)
		? selectedMedialist.Items
		: Array.isArray(selectedMedialist?.items)
			? selectedMedialist.items
			: []
	const choices = items.map((media: any) => ({
		id: String(media?.Id ?? media?.id ?? ''),
		label: `${medialistName} - ${media?.MediaName ?? media?.mediaName ?? media?.Name ?? media?.name ?? ''}`,
	}))
	if (choices.length === 0) choices.push({ id: 'None', label: 'None' })
	if (JSON.stringify(self.CHOICES_MEDIALIST_SELECTED_MEDIA) !== JSON.stringify(choices)) {
		self.CHOICES_MEDIALIST_SELECTED_MEDIA = choices
		self.updateActions()
		self.updateFeedbacks()
	}
}

async function pollMedialist(self: MulticamInstance, includeSignalRState: boolean = true) {
	self.log('debug', 'Polling Medialist')
	//get available medialists
	//api/v3/medialist
	const medialists = await fetchData(self, '/api/v3/medialist?includeMedias=true')
	if (Array.isArray(medialists)) {
		self.MEDIALISTS = medialists
		if (!includeSignalRState) {
			const selectedId = String(self.MEDIALIST_SELECTED?.Id ?? self.MEDIALIST_SELECTED?.id ?? '')
			const selected = medialists.find((medialist) => String(medialist?.Id ?? medialist?.id ?? '') === selectedId)
			if (selected) {
				self.MEDIALIST_SELECTED = selected
				updateSelectedMedialistChoices(self, selected)
				await updateVariable(self, 'medialistSelectedName', selected.Name ?? selected.name ?? '')
				await updateVariable(self, 'medialistSelectedId', selectedId)
			}
		}
		self.checkAllFeedbacks()
		//build temp array for CHOICES_MEDIALISTS, and then compare to existing array to see if we need to update
		const tempChoicesElements = medialists.map((m) => {
			return { id: m.Id, label: m.Name }
		})
		if (tempChoicesElements.length === 0) {
			tempChoicesElements.push({ id: 'None', label: 'None' })
		}
		//only update if choices have changed
		if (JSON.stringify(self.CHOICES_MEDIALISTS) !== JSON.stringify(tempChoicesElements)) {
			self.CHOICES_MEDIALISTS = tempChoicesElements
			self.updateActions()
			self.updateFeedbacks()
		}
		const allMediaChoices = await buildMedialistsMediaChoices(self, medialists)
		if (JSON.stringify(self.CHOICES_MEDIALISTS_MEDIA) !== JSON.stringify(allMediaChoices)) {
			self.CHOICES_MEDIALISTS_MEDIA = allMediaChoices
			self.updateActions()
			self.updateFeedbacks()
		}
	} else {
		self.log('debug', 'Unable to fetch medialists, application not launched')
		const emptyAllMedia = [{ id: 'None', label: 'None' }]
		if (JSON.stringify(self.CHOICES_MEDIALISTS_MEDIA) !== JSON.stringify(emptyAllMedia)) {
			self.CHOICES_MEDIALISTS_MEDIA = emptyAllMedia
			self.updateActions()
			self.updateFeedbacks()
		}
	}
	if (includeSignalRState) {
		// Selected medialist/media are event-driven while SignalR is connected.
		const selectedMedialist = await fetchData(self, '/api/v3/medialist/selected')
		if (selectedMedialist && typeof selectedMedialist === 'object' && !Array.isArray(selectedMedialist)) {
			self.MEDIALIST_SELECTED = selectedMedialist
			updateSelectedMedialistChoices(self, selectedMedialist)
			await updateVariable(self, 'medialistSelectedName', selectedMedialist.Name || '')
			await updateVariable(self, 'medialistSelectedId', selectedMedialist.Id || '')
		} else {
			self.log('debug', 'Unable to fetch selected medialist, application not launched')
		}
		const selectedMedia = await fetchData(self, '/api/v3/medialist/selected/media')
		if (selectedMedia && selectedMedia !== 'Application not launched!') {
			self.MEDIALIST_SELECTED_MEDIA = selectedMedia
			await updateVariable(self, 'medialistSelectedMedia', JSON.stringify(selectedMedia))
			await updateVariable(self, 'medialistSelectedMediaName', selectedMedia.MediaName ?? selectedMedia.Name ?? '')
			await updateVariable(self, 'medialistSelectedMediaId', selectedMedia.Id ?? '')
		} else {
			self.log('debug', 'Unable to fetch selected media, application not launched')
		}
	}
}
async function pollPublisher(_self: MulticamInstance) {
	//self.log('info', 'Polling publisher - not yet implemented')
}
async function pollRadio(_self: MulticamInstance) {
	//self.log('info', 'Polling radio - not yet implemented')
}
async function pollRecording(_self: MulticamInstance) {
	//self.log('info', 'Polling recording - not yet implemented')
}
async function pollScenes(self: MulticamInstance, includeSignalRState: boolean = true) {
	self.log('debug', 'Polling scenes')
	//get scenes files
	const sceneFiles = await fetchData(self, '/api/v2/scenes/files')
	if (Array.isArray(sceneFiles)) {
		self.SCENE_FILES = sceneFiles
		if (!includeSignalRState) {
			const selectedId = String(self.SCENES_FILE_SELECTED?.Id ?? self.SCENES_FILE_SELECTED?.id ?? '')
			const selected = sceneFiles.find((file) => String(file?.Id ?? file?.id ?? '') === selectedId)
			if (selected) {
				self.SCENES_FILE_SELECTED = selected
				await updateVariable(self, 'sceneSelectedFileName', selected.Name ?? selected.name ?? '')
				await updateVariable(self, 'sceneSelectedFileId', selectedId)
			}
		}
		//build CHOICES_SCENE_FILES
		const choices = sceneFiles.map((f) => {
			return { id: f.Id, label: f.Name }
		})
		if (choices.length === 0) {
			choices.push({ id: 'None', label: 'None' })
		}
		//only update if choices have changed
		if (JSON.stringify(self.CHOICES_SCENES_FILES) !== JSON.stringify(choices)) {
			self.CHOICES_SCENES_FILES = choices
			self.updateActions()
			self.updateFeedbacks()
		}
	} else {
		self.log('debug', 'Unable to fetch scene files, application not launched')
	}
	if (includeSignalRState) {
		const selectedSceneFile = await fetchData(self, '/api/v2/scenes/selected')
		if (selectedSceneFile && typeof selectedSceneFile === 'object' && !Array.isArray(selectedSceneFile)) {
			self.SCENES_FILE_SELECTED = selectedSceneFile
			await updateVariable(self, 'sceneSelectedFileName', selectedSceneFile.Name || '')
			await updateVariable(self, 'sceneSelectedFileId', selectedSceneFile.Id || '')
		} else {
			self.log('debug', 'Unable to fetch selected scene file, application not launched')
		}
	}
	//get selected scenes file content
	const selectedSceneFileContent = await fetchData(self, '/api/v2/scenes/selected/scenes')
	if (Array.isArray(selectedSceneFileContent)) {
		self.SCENES_FILE_SELECTED_SCENES = selectedSceneFileContent
		if (!includeSignalRState) {
			const selectedId = self.SCENES_FILE_SELECTED_SCENE_ID
			const selected = selectedSceneFileContent.find((scene) => String(scene?.Id ?? scene?.id ?? '') === selectedId)
			if (selected) {
				self.SCENES_FILE_SELECTED_SCENE = selected
				await updateVariable(self, 'sceneSelectedSceneName', selected.Name ?? selected.name ?? '')
				await updateVariable(self, 'sceneSelectedSceneId', selectedId)
			}
		}
		//build CHOICES_SCENES_FILE_SELECTED_SCENES
		const choices = selectedSceneFileContent.map((s) => {
			return { id: s.Id, label: s.Name }
		})
		if (choices.length === 0) {
			choices.push({ id: 'None', label: 'None' })
		}
		//only update if choices have changed
		if (JSON.stringify(self.CHOICES_SCENES_FILE_SELECTED_SCENES) !== JSON.stringify(choices)) {
			self.CHOICES_SCENES_FILE_SELECTED_SCENES = choices
			self.updateActions()
			self.updateFeedbacks()
		}
	} else {
		self.log('debug', 'Unable to fetch selected scene file content, application not launched')
	}
	if (includeSignalRState) {
		const selectedScene = await fetchData(self, '/api/v2/scenes/selected/livescene')
		if (selectedScene && typeof selectedScene === 'object' && !Array.isArray(selectedScene)) {
			self.SCENES_FILE_SELECTED_SCENE = selectedScene
			self.SCENES_FILE_SELECTED_SCENE_ID = selectedScene.Id || ''
			await updateVariable(self, 'sceneSelectedSceneName', selectedScene.Name || '')
			await updateVariable(self, 'sceneSelectedSceneId', selectedScene.Id || '')
		} else {
			self.log('debug', 'Unable to fetch selected scene, application not launched')
		}
	}
}
async function pollStreaming(self: MulticamInstance, includeSignalRState: boolean = true) {
	if (!includeSignalRState) return
	self.log('debug', 'Polling streaming')
	const streamingCatalogs = await fetchData(self, '/api/v2/streaming/catalogs')
	if (Array.isArray(streamingCatalogs)) {
		const choices = streamingCatalogs.map((c) => ({ id: String(c.Id), label: String(c.Name ?? c.Id) }))
		if (JSON.stringify(self.CHOICES_STREAMING_CATALOGS) !== JSON.stringify(choices)) {
			self.CHOICES_STREAMING_CATALOGS = choices
			self.updateActions()
		}
	}
	const selectedCatalog = await fetchData(self, '/api/v2/streaming/selected')
	if (selectedCatalog && typeof selectedCatalog === 'object' && !Array.isArray(selectedCatalog)) {
		self.STREAMING_CATALOG_SELECTED = selectedCatalog
		await updateVariable(self, 'streamingSelectedCatalog', selectedCatalog.Name ?? '')
		await updateVariable(self, 'streamingSelectedCatalogId', selectedCatalog.Id ?? '')
	}
	const streamingProfiles = await fetchData(self, '/api/v2/streaming/selected/profiles')
	if (Array.isArray(streamingProfiles)) {
		self.STREAMING_PROFILES = streamingProfiles
		const choices = streamingProfiles.map((p) => ({ id: String(p.Id), label: String(p.Name ?? p.Id) }))
		if (JSON.stringify(self.CHOICES_STREAMING_PROFILES) !== JSON.stringify(choices)) {
			self.CHOICES_STREAMING_PROFILES = choices
			self.updateActions()
		}
		const activeProfiles = streamingProfiles.filter((profile) => profile?.IsStarted)
		await updateVariable(self, 'streamingActiveProfiles', activeProfiles.map((profile) => profile.Name).join(', '))
		await updateVariable(self, 'streamingActiveProfileCount', activeProfiles.length)
	}
}
async function pollStudio(_self: MulticamInstance) {
	//self.log('info', 'Polling studio - not yet implemented')
}
async function pollTitler(self: MulticamInstance, includeSignalRState: boolean = true) {
	let needsUpdate = false
	const titlerFiles = await fetchData(self, '/api/v2/titler/files')
	if (Array.isArray(titlerFiles)) {
		self.TITLER_FILES = titlerFiles
		if (!includeSignalRState) {
			const selectedId = String(self.TITLER_FILE_SELECTED?.Id ?? self.TITLER_FILE_SELECTED?.id ?? '')
			const selected = titlerFiles.find((file) => String(file?.Id ?? file?.id ?? '') === selectedId)
			if (selected) {
				self.TITLER_FILE_SELECTED = selected
				await updateVariable(self, 'titlerSelectedFileName', selected.Name ?? selected.name ?? '')
				await updateVariable(self, 'titlerSelectedFileId', selectedId)
			}
			for (const file of titlerFiles) file.IsSelected = String(file.Id ?? file.id ?? '') === selectedId
		}
		const choices = titlerFiles.map((file) => ({ id: String(file.Id), label: String(file.Name ?? file.Id) }))
		if (choices.length === 0) choices.push({ id: 'none', label: 'None' })
		if (JSON.stringify(self.CHOICES_TITLER_FILES) !== JSON.stringify(choices)) {
			self.CHOICES_TITLER_FILES = choices
			needsUpdate = true
		}
	}
	if (includeSignalRState) {
		const selectedTitlerFile = await fetchData(self, '/api/v2/titler/selected')
		if (selectedTitlerFile && typeof selectedTitlerFile === 'object' && !Array.isArray(selectedTitlerFile)) {
			self.TITLER_FILE_SELECTED = selectedTitlerFile
			await updateVariable(self, 'titlerSelectedFileName', selectedTitlerFile.Name || '')
			await updateVariable(self, 'titlerSelectedFileId', selectedTitlerFile.Id || '')
			for (const file of self.TITLER_FILES) file.IsSelected = String(file.Id) === String(selectedTitlerFile.Id)
		} else {
			self.TITLER_FILE_SELECTED = {}
			await updateVariable(self, 'titlerSelectedFileName', 'None')
			await updateVariable(self, 'titlerSelectedFileId', 'None')
		}
	}
	const elements = await fetchData(self, '/api/v2/titler/selected/elements')
	if (!Array.isArray(elements)) {
		if (needsUpdate) {
			self.updateActions()
			self.updateFeedbacks()
		}
		return
	}
	const elementChoices = elements.map((element) => ({
		id: String(element.Id),
		label: String(element.Name ?? element.Id),
	}))
	if (elementChoices.length === 0) elementChoices.push({ id: 'none', label: 'None' })
	if (JSON.stringify(self.CHOICES_TITLER_ELEMENTS) !== JSON.stringify(elementChoices)) {
		self.CHOICES_TITLER_ELEMENTS = elementChoices
		needsUpdate = true
	}
	const rowBuckets = await Promise.all(
		elements.map(async (element) => {
			const elementId = encodeURIComponent(String(element.Id))
			const kind = String(element.ElementType ?? '').toLowerCase()
			if (kind !== 'speaker' && kind !== 'panel') return { speaker: [], panel: [] }
			const [entries, live] = await Promise.all([
				fetchData(self, `/api/v2/titler/selected/elements/${elementId}/${kind}/entries`),
				fetchData(self, `/api/v2/titler/selected/elements/${elementId}/${kind}/entries/live`),
			])
			const validEntries = Array.isArray(entries) ? entries : []
			if (kind === 'speaker') {
				element.SpeakerEntries = validEntries
				element.LiveSpeakerRowId = live && typeof live === 'object' ? String(live.Id ?? '') : ''
			} else {
				element.PanelEntries = validEntries
				element.LivePanelRowId = live && typeof live === 'object' ? String(live.Id ?? '') : ''
			}
			const choices = validEntries.map((entry) => {
				const entryValues = entry?.Entries && typeof entry.Entries === 'object' ? Object.values(entry.Entries) : []
				const valuesLabel = entryValues
					.map((value) => String(value))
					.filter(Boolean)
					.join(' - ')
				return {
					id: `${element.Id}_${kind}_${entry.Id}`,
					label: `${element.Name ?? element.Id} - ${valuesLabel || entry.Id}`,
				}
			})
			return kind === 'speaker' ? { speaker: choices, panel: [] } : { speaker: [], panel: choices }
		}),
	)
	const speakerChoices = rowBuckets.flatMap((bucket) => bucket.speaker)
	const panelChoices = rowBuckets.flatMap((bucket) => bucket.panel)
	if (speakerChoices.length === 0) speakerChoices.push({ id: 'none', label: 'None' })
	if (panelChoices.length === 0) panelChoices.push({ id: 'none', label: 'None' })
	if (JSON.stringify(self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS) !== JSON.stringify(speakerChoices)) {
		self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS = speakerChoices
		needsUpdate = true
	}
	if (JSON.stringify(self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS) !== JSON.stringify(panelChoices)) {
		self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS = panelChoices
		needsUpdate = true
	}
	self.TITLER_SELECTED_FILE_ELEMENTS = elements
	if (needsUpdate) {
		self.updateActions()
		self.updateFeedbacks()
	}
	self.checkAllFeedbacks()
}
async function pollVideo(_self: MulticamInstance) {
	//self.log('info', 'Polling video - not yet implemented')
}
export async function updateVariable(self: MulticamInstance, varName: string, value: unknown): Promise<void> {
	const variableObj: any = {}
	variableObj[varName] = value
	self.setVariableValues(variableObj)
}
export async function fetchData(
	self: MulticamInstance,
	endpoint: string,
	method?: string,
	payload?: unknown,
): Promise<any> {
	try {
		if (self.config.host && self.config.port) {
			const url = `http://${self.config.host}:${self.config.port}${endpoint}`
			if (self.config.verbose) {
				self.log('debug', `Fetching: ${url}`)
			}
			if (!method) {
				method = 'GET'
			}
			const headers: any = {
				'Content-Type': 'application/json',
			}
			//if api key is specified, add it to headers
			if (self.config.specifyApiKey && self.secrets.apiKey) {
				headers['x-apikey'] = self.secrets.apiKey
			}
			let body: string | undefined = undefined
			// If payload is provided, include it in the request without changing the requested method.
			if (payload !== undefined) {
				body = JSON.stringify(payload)
			}
			const response = await fetch(url, {
				method: method,
				headers: headers,
				body: body,
			})
			const contentType = response.headers.get('content-type') || ''
			const raw = await response.text()
			if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
				const parsed = JSON.parse(raw)
				markFetchSucceeded(self)
				return parsed
			} else {
				const trimmed = raw.trim()
				markFetchSucceeded(self)
				return trimmed
			}
		} else {
			self.log('error', 'Invalid host or port configuration')
			return null
		}
	} catch (error: any) {
		const message = String(error?.message ?? error)
		const dedupe = getFetchErrorDedupeState(self)
		if (dedupe.suppressDuplicateMessage !== message) {
			self.log('error', `Failed to fetch data: ${message}`)
			dedupe.suppressDuplicateMessage = message
		}
		return null
	}
}

// Additional HTTP API state polling
type FetchData = (self: MulticamInstance, endpoint: string, method?: string, payload?: unknown) => Promise<any>
type UpdateVariable = (self: MulticamInstance, variableId: string, value: unknown) => Promise<void>

type UpdateFlags = {
	actions: boolean
	feedbacks: boolean
}

const NONE_CHOICE: DropdownChoice[] = [{ id: 'none', label: 'None' }]

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProblem(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.status === 'number' &&
		(typeof value.detail === 'string' || typeof value.title === 'string')
	)
}

function choicesOrNone(choices: DropdownChoice[]): DropdownChoice[] {
	return choices.length > 0 ? choices : NONE_CHOICE
}

function updateChoices(
	current: DropdownChoice[],
	next: DropdownChoice[],
	assign: (choices: DropdownChoice[]) => void,
	flags: UpdateFlags,
	feedbacks: boolean = false,
): void {
	if (JSON.stringify(current) === JSON.stringify(next)) return
	assign(next)
	flags.actions = true
	if (feedbacks) flags.feedbacks = true
}

function compositeId(...parts: (string | number)[]): string {
	return JSON.stringify(parts.map((part) => `${part}`))
}

function getRoomCameraIndexes(self: MulticamInstance): number[] {
	const selectedInputs = Array.isArray(self.ROOM_SELECTED?.Inputs) ? self.ROOM_SELECTED.Inputs : []
	const roomInputs = selectedInputs.length
		? selectedInputs
		: self.ROOMS.flatMap((room: any) => (Array.isArray(room?.Inputs) ? room.Inputs : []))
	const indexes: number[] = roomInputs
		.filter((input: any) => input?.Camera && input.Camera.IsPilotable !== false)
		.map((input: any) => Number(input.Index))
		.filter((index: number) => Number.isInteger(index) && index >= 0 && index <= 39)
	return [...new Set<number>(indexes)].sort((a, b) => a - b)
}

async function pollApiAudio(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	flags: UpdateFlags,
): Promise<void> {
	const [profiles, selected] = await Promise.all([
		fetchData(self, '/api/v1/audio/profiles'),
		fetchData(self, '/api/v1/audio/profiles/selected'),
	])
	if (Array.isArray(profiles)) {
		self.AUDIO_PROFILES = profiles
		const choices = choicesOrNone(
			profiles
				.filter((profile: any) => profile?.Id !== undefined)
				.map((profile: any) => ({ id: String(profile.Id), label: String(profile.Name ?? profile.Id) })),
		)
		updateChoices(self.CHOICES_AUDIO_PROFILES, choices, (value) => (self.CHOICES_AUDIO_PROFILES = value), flags, true)
		await updateVariable(
			self,
			'audioProfiles',
			profiles
				.map((profile: any) => profile?.Name)
				.filter(Boolean)
				.join(', '),
		)
	}
	if (isRecord(selected) && !isProblem(selected)) {
		self.AUDIO_PROFILE_SELECTED = selected
		await updateVariable(self, 'audioSelectedProfile', selected.Name ?? '')
		await updateVariable(self, 'audioSelectedProfileId', selected.Id ?? '')
	}
}

async function pollApiConf(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	flags: UpdateFlags,
): Promise<void> {
	const [workspace, microphones, dynamism, banks, currentBank, autoTitling] = await Promise.all([
		fetchData(self, '/api/v2/conf/workspace'),
		fetchData(self, '/api/v2/conf/microphones'),
		fetchData(self, '/api/v2/conf/dynamism'),
		fetchData(self, '/api/v2/conf/presetsbanks'),
		fetchData(self, '/api/v2/conf/presetsbanks/current'),
		fetchData(self, '/api/v2/conf/api/conf/autotitling'),
	])

	if (isRecord(workspace) && !isProblem(workspace) && Array.isArray(workspace.Microphones)) {
		self.CONF_MICROPHONES = workspace.Microphones
		const choices = choicesOrNone(
			workspace.Microphones.filter((microphone: any) => !microphone.IsDisabled).map((microphone: any) => ({
				id: String(microphone.Number),
				label: String(microphone.Name ?? `Microphone ${microphone.Number}`),
			})),
		)
		updateChoices(self.CHOICES_CONF_MICROPHONES, choices, (value) => (self.CHOICES_CONF_MICROPHONES = value), flags)
	}
	if (isRecord(microphones) && !isProblem(microphones)) {
		self.CONF_STATE.microphones = microphones
		await updateVariable(self, 'confAutomationMode', microphones.AutomationMode ?? '')
		await updateVariable(
			self,
			'confActiveMicrophones',
			Array.isArray(microphones.ActiveMicrophones) ? microphones.ActiveMicrophones.join(', ') : '',
		)
	}
	if (isRecord(dynamism) && !isProblem(dynamism)) {
		self.CONF_STATE.dynamism = dynamism
		await updateVariable(self, 'confDynamism', dynamism.Dynamism ?? '')
	}
	if (Array.isArray(banks)) {
		self.CONF_PRESET_BANKS = banks
		const choices = choicesOrNone(
			banks.map((bank: any) => ({ id: String(bank.Id), label: String(bank.BankName ?? bank.Id) })),
		)
		updateChoices(self.CHOICES_CONF_PRESET_BANKS, choices, (value) => (self.CHOICES_CONF_PRESET_BANKS = value), flags)
	}
	if (isRecord(currentBank) && !isProblem(currentBank)) {
		self.CONF_STATE.currentBank = currentBank
		await updateVariable(self, 'confPresetBank', currentBank.BankName ?? '')
		await updateVariable(self, 'confPresetBankId', currentBank.Id ?? '')
	}
	if (isRecord(autoTitling) && !isProblem(autoTitling)) {
		self.CONF_STATE.autoTitling = autoTitling
		await updateVariable(self, 'confAutoTitling', Boolean(autoTitling.IsEnabled))
	}
}

async function pollApiInsitu(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	flags: UpdateFlags,
): Promise<void> {
	const [tagDetails, tagNames, activeTags, layouts, activeLayout] = await Promise.all([
		fetchData(self, '/api/insitu/tagsdetails'),
		fetchData(self, '/api/insitu/tags'),
		fetchData(self, '/api/insitu/tag/on'),
		fetchData(self, '/api/insitu/layouts'),
		fetchData(self, '/api/insitu/activelayout'),
	])
	const tags = Array.isArray(tagDetails)
		? tagDetails
		: Array.isArray(tagNames)
			? tagNames.map((name: unknown) => ({ Name: String(name) }))
			: null
	if (tags) {
		self.INSITU_TAGS = tags
		const choices = choicesOrNone(
			tags
				.map((tag: any) => String(tag?.Name ?? ''))
				.filter(Boolean)
				.map((name: string) => ({ id: name, label: name })),
		)
		updateChoices(self.CHOICES_INSITU_TAGS, choices, (value) => (self.CHOICES_INSITU_TAGS = value), flags, true)
	}
	if (Array.isArray(activeTags)) {
		self.INSITU_ACTIVE_TAGS = activeTags.map((tag: any) => (typeof tag === 'string' ? { Name: tag } : tag))
		await updateVariable(
			self,
			'insituActiveTags',
			self.INSITU_ACTIVE_TAGS.map((tag: any) => tag?.Name)
				.filter(Boolean)
				.join(', '),
		)
	}
	if (Array.isArray(layouts)) {
		self.INSITU_LAYOUTS = layouts
		const choices = choicesOrNone(
			layouts
				.map((layout: any) => String(layout?.Name ?? ''))
				.filter(Boolean)
				.map((name: string) => ({ id: name, label: name })),
		)
		updateChoices(self.CHOICES_INSITU_LAYOUTS, choices, (value) => (self.CHOICES_INSITU_LAYOUTS = value), flags, true)
	}
	if (isRecord(activeLayout) && !isProblem(activeLayout)) {
		self.INSITU_ACTIVE_LAYOUT = activeLayout
		await updateVariable(self, 'insituActiveLayout', activeLayout.Name ?? '')
	}

	const running = self.RUNNING_APPLICATION.toLowerCase().replace(/\s+/g, '')
	if (!running.includes('insitu')) return
	const cameraIndexes = getRoomCameraIndexes(self)
	const presetBuckets = await Promise.all(
		cameraIndexes.map(async (cameraIndex) => {
			const presets = await fetchData(self, `/api/insitu/presets/${cameraIndex}`)
			return Array.isArray(presets) ? presets : []
		}),
	)
	const presets = presetBuckets.flat()
	self.INSITU_PRESETS = presets
	const choices = choicesOrNone(
		presets.map((preset: any) => ({
			id: compositeId(preset.CameraIndex, preset.Index),
			label: `Camera ${Number(preset.CameraIndex) + 1} - Preset ${preset.Index}`,
		})),
	)
	updateChoices(self.CHOICES_INSITU_PRESETS, choices, (value) => (self.CHOICES_INSITU_PRESETS = value), flags)
}

async function pollPilot(self: MulticamInstance, fetchData: FetchData, flags: UpdateFlags): Promise<void> {
	if (!self.RUNNING_APPLICATION) return
	const cameraIndexes = getRoomCameraIndexes(self)
	const cameraSources = cameraIndexes.map((index) => `CAM${index + 1}`)
	const buckets = await Promise.all(
		cameraSources.map(async (camera) => {
			const sequences = await fetchData(self, `/api/v1/pilot/activebank/${camera}/sequences`)
			return Array.isArray(sequences) ? sequences.map((sequence: any) => ({ ...sequence, Camera: camera })) : []
		}),
	)
	const sequences = buckets.flat()
	self.PILOT_SEQUENCES = sequences
	const choices = choicesOrNone(
		sequences.map((sequence: any) => ({
			id: compositeId(sequence.Camera, sequence.Id),
			label: `${sequence.Camera} - ${sequence.Name ?? sequence.Id}`,
		})),
	)
	updateChoices(self.CHOICES_PILOT_SEQUENCES, choices, (value) => (self.CHOICES_PILOT_SEQUENCES = value), flags)
}

async function pollApiPublisher(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	flags: UpdateFlags,
	includeSignalRState: boolean = true,
): Promise<void> {
	const [recordings, workflows] = await Promise.all([
		includeSignalRState ? fetchData(self, '/api/publisher/recordings') : Promise.resolve(undefined),
		fetchData(self, '/api/publisher/workflows'),
	])
	if (Array.isArray(recordings)) {
		self.PUBLISHER_RECORDINGS = recordings
		const choices = choicesOrNone(
			recordings.map((recording: any) => ({
				id: String(recording.Id),
				label: `${recording.Title ?? recording.FileName ?? `Recording ${recording.Id}`} (${recording.Date ?? recording.Id})`,
			})),
		)
		updateChoices(
			self.CHOICES_PUBLISHER_RECORDINGS,
			choices,
			(value) => (self.CHOICES_PUBLISHER_RECORDINGS = value),
			flags,
		)
		await updateVariable(self, 'publisherRecordingCount', recordings.length)
	}
	if (Array.isArray(workflows)) {
		self.PUBLISHER_WORKFLOWS = workflows
		const choices = choicesOrNone(
			workflows
				.filter((workflow: any) => workflow.IsFullyAutomated)
				.map((workflow: any) => ({ id: String(workflow.Name), label: String(workflow.Name) })),
		)
		updateChoices(
			self.CHOICES_PUBLISHER_WORKFLOWS,
			choices,
			(value) => (self.CHOICES_PUBLISHER_WORKFLOWS = value),
			flags,
		)
	}
}

async function pollApiRadio(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	flags: UpdateFlags,
): Promise<void> {
	const [workspace, microphones, dynamism, banks, currentBank, autoTitling, variables] = await Promise.all([
		fetchData(self, '/api/v2/radio/workspace'),
		fetchData(self, '/api/v2/radio/microphones'),
		fetchData(self, '/api/v2/radio/dynamism'),
		fetchData(self, '/api/v2/radio/presetsbank'),
		fetchData(self, '/api/v2/radio/presetsbanks/current'),
		fetchData(self, '/api/v2/radio/api/conf/autotitling'),
		fetchData(self, '/api/v2/radio/automation/variables'),
	])
	if (isRecord(workspace) && !isProblem(workspace) && Array.isArray(workspace.Microphones)) {
		self.RADIO_MICROPHONES = workspace.Microphones
		const choices = choicesOrNone(
			workspace.Microphones.filter((microphone: any) => !microphone.IsDisabled).map((microphone: any) => ({
				id: String(microphone.Number),
				label: String(microphone.Name ?? `Microphone ${microphone.Number}`),
			})),
		)
		updateChoices(self.CHOICES_RADIO_MICROPHONES, choices, (value) => (self.CHOICES_RADIO_MICROPHONES = value), flags)
	}
	if (isRecord(microphones) && !isProblem(microphones)) {
		self.RADIO_STATE.microphones = microphones
		await updateVariable(self, 'radioAutomationMode', microphones.AutomationMode ?? '')
		await updateVariable(
			self,
			'radioActiveMicrophones',
			Array.isArray(microphones.ActiveMicrophones) ? microphones.ActiveMicrophones.join(', ') : '',
		)
	}
	if (isRecord(dynamism) && !isProblem(dynamism)) {
		self.RADIO_STATE.dynamism = dynamism
		await updateVariable(self, 'radioDynamism', dynamism.Dynamism ?? '')
	}
	if (Array.isArray(banks)) {
		self.RADIO_PRESET_BANKS = banks
		const choices = choicesOrNone(
			banks.map((bank: any) => ({ id: String(bank.Id), label: String(bank.BankName ?? bank.Id) })),
		)
		updateChoices(self.CHOICES_RADIO_PRESET_BANKS, choices, (value) => (self.CHOICES_RADIO_PRESET_BANKS = value), flags)
	}
	if (isRecord(currentBank) && !isProblem(currentBank)) {
		self.RADIO_STATE.currentBank = currentBank
		await updateVariable(self, 'radioPresetBank', currentBank.BankName ?? '')
		await updateVariable(self, 'radioPresetBankId', currentBank.Id ?? '')
	}
	if (isRecord(autoTitling) && !isProblem(autoTitling)) {
		self.RADIO_STATE.autoTitling = autoTitling
		await updateVariable(self, 'radioAutoTitling', Boolean(autoTitling.IsEnabled))
	}
	if (isRecord(variables) && !isProblem(variables) && Array.isArray(variables.Variables)) {
		self.RADIO_AUTOMATION_VARIABLES = variables.Variables
		await updateVariable(self, 'radioAutomationVariables', JSON.stringify(variables.Variables))
	}
}

async function pollApiRecording(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	includeSignalRState: boolean = true,
): Promise<void> {
	const liveExtractActive = Boolean(
		self.RECORDING_LIVE_EXTRACT?.IsInProgress ?? self.RECORDING_LIVE_EXTRACT?.isInProgress,
	)
	const [recording, paused, liveExtract] = await Promise.all([
		includeSignalRState ? fetchData(self, '/api/recording/status') : Promise.resolve(undefined),
		fetchData(self, '/api/recording/pause'),
		includeSignalRState || liveExtractActive
			? fetchData(self, '/api/recording/liveextract')
			: Promise.resolve(undefined),
	])
	if (typeof recording === 'boolean') {
		self.RECORDING = recording
		await updateVariable(self, 'recording', recording)
	}
	if (typeof paused === 'boolean') {
		self.RECORDING_PAUSED = paused
		await updateVariable(self, 'recordingPaused', paused)
	} else if (typeof paused === 'string') {
		const normalized = paused.trim().toLowerCase()
		if (
			['true', '1', 'paused', 'pause'].includes(normalized) ||
			['false', '0', 'running', 'recording'].includes(normalized)
		) {
			self.RECORDING_PAUSED = ['true', '1', 'paused', 'pause'].includes(normalized)
			await updateVariable(self, 'recordingPaused', self.RECORDING_PAUSED)
		}
	}
	if (isRecord(liveExtract) && !isProblem(liveExtract)) {
		self.RECORDING_LIVE_EXTRACT = liveExtract
		await updateVariable(self, 'recordingLiveExtract', Boolean(liveExtract.IsInProgress))
		await updateVariable(self, 'recordingLiveExtractSecondsRemaining', liveExtract.SecondsToAutomaticEnd ?? 0)
	}
}

async function pollSettings(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
): Promise<void> {
	const constraints = await fetchData(self, '/api/v1/settings/mediaconstraints')
	if (isRecord(constraints) && !isProblem(constraints)) {
		self.MEDIA_CONSTRAINTS = constraints
		await updateVariable(self, 'mediaConstraints', JSON.stringify(constraints))
	}
}

async function pollApiStudio(self: MulticamInstance, fetchData: FetchData, flags: UpdateFlags): Promise<void> {
	if (!self.RUNNING_APPLICATION.toLowerCase().includes('studio')) return
	const cameraIndexes = getRoomCameraIndexes(self)
	const buckets = await Promise.all(
		cameraIndexes.map(async (cameraIndex) => {
			const presets = await fetchData(self, `/api/studio/presets/${cameraIndex}`)
			return Array.isArray(presets) ? presets : []
		}),
	)
	const presets = buckets.flat()
	self.STUDIO_PRESETS = presets
	const choices = choicesOrNone(
		presets.map((preset: any) => ({
			id: compositeId(preset.CameraIndex, preset.Index),
			label: `Camera ${Number(preset.CameraIndex) + 1} - Preset ${preset.Index}`,
		})),
	)
	updateChoices(self.CHOICES_STUDIO_PRESETS, choices, (value) => (self.CHOICES_STUDIO_PRESETS = value), flags)
}

async function pollTitlerStructures(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	flags: UpdateFlags,
): Promise<void> {
	if (!Array.isArray(self.TITLER_SELECTED_FILE_ELEMENTS)) return
	const speakers = self.TITLER_SELECTED_FILE_ELEMENTS.filter(
		(element: any) => String(element?.ElementType ?? '').toLowerCase() === 'speaker',
	)
	const panels = self.TITLER_SELECTED_FILE_ELEMENTS.filter(
		(element: any) => String(element?.ElementType ?? '').toLowerCase() === 'panel',
	)
	const tickers = self.TITLER_SELECTED_FILE_ELEMENTS.filter(
		(element: any) => String(element?.ElementType ?? '').toLowerCase() === 'ticker',
	)
	updateChoices(
		self.CHOICES_TITLER_SPEAKER_ELEMENTS,
		choicesOrNone(
			speakers.map((element: any) => ({ id: String(element.Id), label: String(element.Name ?? element.Id) })),
		),
		(value) => (self.CHOICES_TITLER_SPEAKER_ELEMENTS = value),
		flags,
	)
	updateChoices(
		self.CHOICES_TITLER_PANEL_ELEMENTS,
		choicesOrNone(
			panels.map((element: any) => ({ id: String(element.Id), label: String(element.Name ?? element.Id) })),
		),
		(value) => (self.CHOICES_TITLER_PANEL_ELEMENTS = value),
		flags,
	)
	updateChoices(
		self.CHOICES_TITLER_TICKER_ELEMENTS,
		choicesOrNone(
			tickers.map((element: any) => ({ id: String(element.Id), label: String(element.Name ?? element.Id) })),
		),
		(value) => (self.CHOICES_TITLER_TICKER_ELEMENTS = value),
		flags,
	)

	await Promise.all([
		...speakers.map(async (element: any) => {
			const cached = self.TITLER_ELEMENT_STRUCTURES[`${element.Id}:speaker`]
			if (cached) {
				element.SpeakerStructure = cached
				return
			}
			const structure = await fetchData(
				self,
				`/api/v2/titler/selected/elements/${encodeURIComponent(String(element.Id))}/speaker/structure`,
			)
			if (isRecord(structure) && !isProblem(structure)) {
				self.TITLER_ELEMENT_STRUCTURES[`${element.Id}:speaker`] = structure
				element.SpeakerStructure = structure
				flags.actions = true
			}
		}),
		...panels.map(async (element: any) => {
			const cached = self.TITLER_ELEMENT_STRUCTURES[`${element.Id}:panel`]
			if (cached) {
				element.PanelStructure = cached
				return
			}
			const structure = await fetchData(
				self,
				`/api/v2/titler/selected/elements/${encodeURIComponent(String(element.Id))}/panel/structure`,
			)
			if (isRecord(structure) && !isProblem(structure)) {
				self.TITLER_ELEMENT_STRUCTURES[`${element.Id}:panel`] = structure
				element.PanelStructure = structure
				flags.actions = true
			}
		}),
		...tickers.map(async (element: any) => {
			const content = await fetchData(
				self,
				`/api/v2/titler/selected/elements/${encodeURIComponent(String(element.Id))}/ticker/content`,
			)
			if (isRecord(content) && !isProblem(content)) element.TickerContent = content.Content ?? ''
		}),
	])
	await updateVariable(self, 'titlerElementStructures', JSON.stringify(self.TITLER_ELEMENT_STRUCTURES))
}

async function pollApiVideo(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	flags: UpdateFlags,
	includeSignalRState: boolean = true,
): Promise<void> {
	const fixedVideoChoices: DropdownChoice[] = [
		...Array.from({ length: 40 }, (_, index) => ({
			id: `Source ${index + 1}`,
			label: `Source ${index + 1}`,
		})),
		{ id: 'PC Input', label: 'PC Input' },
		{ id: 'Medialist', label: 'Medialist' },
	]
	updateChoices(
		self.CHOICES_VIDEO_SOURCES,
		fixedVideoChoices,
		(value) => (self.CHOICES_VIDEO_SOURCES = value),
		flags,
		true,
	)
	if (!includeSignalRState) return
	const [liveSource, mixer] = await Promise.all([
		fetchData(self, '/api/video/live'),
		fetchData(self, '/api/video/mixer'),
	])
	if (typeof liveSource === 'string' && liveSource && !liveSource.includes('not initialized')) {
		self.VIDEO_LIVE_SOURCE = liveSource
		await updateVariable(self, 'videoLiveSource', liveSource)
	}
	if (isRecord(mixer) && !isProblem(mixer) && Array.isArray(mixer.AllSources)) {
		self.VIDEO_MIXER = mixer
		await updateVariable(self, 'videoMixerIsComposition', Boolean(mixer.IsComposition))
	}
}

async function pollApiState(
	self: MulticamInstance,
	fetchData: FetchData,
	updateVariable: UpdateVariable,
	includeSignalRState: boolean = true,
): Promise<void> {
	const flags: UpdateFlags = { actions: false, feedbacks: false }
	await pollApiAudio(self, fetchData, updateVariable, flags)
	const running = self.RUNNING_APPLICATION.toLowerCase().replace(/\s+/g, '')
	if (running.includes('conf')) await pollApiConf(self, fetchData, updateVariable, flags)
	if (running.includes('insitu')) await pollApiInsitu(self, fetchData, updateVariable, flags)
	await pollPilot(self, fetchData, flags)
	await pollApiPublisher(self, fetchData, updateVariable, flags, includeSignalRState)
	if (running.includes('radio')) await pollApiRadio(self, fetchData, updateVariable, flags)
	await pollApiRecording(self, fetchData, updateVariable, includeSignalRState)
	if (Object.keys(self.MEDIA_CONSTRAINTS).length === 0) await pollSettings(self, fetchData, updateVariable)
	await pollApiStudio(self, fetchData, flags)
	await pollTitlerStructures(self, fetchData, updateVariable, flags)
	await pollApiVideo(self, fetchData, updateVariable, flags, includeSignalRState)

	syncActiveStreamsFromProfiles(self)

	if (flags.actions) self.updateActions()
	if (flags.feedbacks) self.updateFeedbacks()
	self.checkAllFeedbacks()
}

function syncActiveStreamsFromProfiles(self: MulticamInstance): void {
	self.ACTIVE_STREAMS = self.STREAMING_PROFILES.filter((profile: any) => profile?.IsStarted).map(
		(profile: any): StreamingProfile => ({
			id: String(profile.Id),
			name: String(profile.Name ?? profile.Id),
			isEnabled: Boolean(profile.IsEnabled),
			broadcastServerHostname: String(profile.BroadcastServerHostname ?? ''),
			broadcastStreamID: String(profile.BroadcastStreamID ?? ''),
			isStarted: Boolean(profile.IsStarted),
			canBeLaunchedRemotely: Boolean(profile.CanBeLaunchedRemotely),
			errorMessage: String(profile.ErrorMessage ?? ''),
		}),
	)
	self.setVariableValues({
		streamingActiveProfiles: self.ACTIVE_STREAMS.map((profile) => profile.name).join(', '),
		streamingActiveProfileCount: self.ACTIVE_STREAMS.length,
		streamingAnyActive: self.ACTIVE_STREAMS.length > 0,
	})
	self.checkFeedbacks('streaming')
}

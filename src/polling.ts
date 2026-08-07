import type { MulticamInstance } from './main.js'

let pollInterval: NodeJS.Timeout | undefined = undefined

type PollLogState = {
	/** Suppress repeated identical fetch errors (e.g. many endpoints failing when Multicam closes) until a request succeeds. */
	suppressDuplicateMessage: string | null
	/** Last message logged per status key, so unchanged state is only reported once. */
	lastStatusByKey: Map<string, string>
}

const pollLogStateByInstance = new WeakMap<MulticamInstance, PollLogState>()

function getPollLogState(self: MulticamInstance): PollLogState {
	let s = pollLogStateByInstance.get(self)
	if (!s) {
		s = { suppressDuplicateMessage: null, lastStatusByKey: new Map() }
		pollLogStateByInstance.set(self, s)
	}
	return s
}

function markFetchSucceeded(self: MulticamInstance): void {
	const s = pollLogStateByInstance.get(self)
	if (s) {
		s.suppressDuplicateMessage = null
	}
}

/** Per-cycle chatter, only emitted when verbose logging is enabled in the config. */
function logVerbose(self: MulticamInstance, message: string): void {
	if (self.config.verbose) {
		self.log('debug', message)
	}
}

/** Log a status message only when it differs from the last one logged for the same key. */
function logStatusChange(self: MulticamInstance, key: string, message: string): void {
	if (self.config.verbose) {
		self.log('debug', message)
		return
	}

	const state = getPollLogState(self)
	if (state.lastStatusByKey.get(key) === message) return
	state.lastStatusByKey.set(key, message)
	self.log('debug', message)
}

/** Forget the last status for a key, so the same message is logged again if the state comes back. */
function clearStatus(self: MulticamInstance, key: string): void {
	getPollLogState(self).lastStatusByKey.delete(key)
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

	if (pollInterval) {
		clearInterval(pollInterval)
		pollInterval = undefined
	}
}

export async function runPollCycle(self: MulticamInstance): Promise<void> {
	try {
		await pollApplication(self)
		await pollAudio(self)
		await pollConf(self)
		await pollComposer(self)
		await pollInsitu(self)
		await pollMedialist(self)
		await pollPublisher(self)
		await pollRadio(self)
		await pollRecording(self)
		await pollScenes(self)
		await pollStreaming(self)
		await pollStudio(self)
		await pollTitler(self)
		await pollVideo(self)
	} catch (err) {
		self.log('error', `Polling failed: ${err}`)
		//console.log('log', `${err}`)
		//stopPolling()
	}
}

async function pollApplication(self: MulticamInstance) {
	//get system information
	logVerbose(self, 'Polling application/system information')

	const data = await fetchData(self, '/api/application/system')
	if (data) {
		await updateVariable(self, 'computerName', data.ComputerName)
		await updateVariable(self, 'multicamName', data.MulticamName)
	}

	const licensedApps = await fetchData(self, '/api/application')
	if (licensedApps) {
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
	for (const app of self.APPLICATIONS) {
		const templates = await fetchData(self, `/api/application/templates/${app}`)
		if (templates) {
			await updateVariable(self, `templates_${app}`, templates)
		}
	}

	//get rooms
	const rooms = await fetchData(self, '/api/application/rooms')
	if (rooms) {
		self.ROOMS = rooms
		await updateVariable(self, 'rooms', rooms.join(', '))
		//Build CHOICES_ROOMS
		const choices = rooms.map((r: any) => {
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
	if (selectedRoom) {
		self.ROOM_SELECTED = selectedRoom
		await updateVariable(self, 'selected_room', selectedRoom.Name || '')
	}

	//get running application
	const runningApp = await fetchData(self, '/api/application/running')
	if (runningApp) {
		await updateVariable(self, 'runningApp', runningApp || 'None')
	} else {
		await updateVariable(self, 'runningApp', 'None')
	}

	//get auto/manual state of application
	const appState = await fetchData(self, '/api/application/auto')
	if (appState) {
		await updateVariable(self, 'applicationAutoState', appState ? 'Auto' : 'Manual')
	}

	//get snapshot of application
	const snapshot = await fetchData(self, '/api/application/snapshot')
	if (snapshot) {
		await updateVariable(self, 'applicationSnapshot', snapshot || 'None')
	}
}

async function pollAudio(_self: MulticamInstance) {
	//get audio profiles
	//self.log('info', 'Polling audio profiles')
	/*const profiles = await fetchData(self, '/api/v1/audio/profiles')
	if (profiles) {
		self.AUDIO_PROFILES = profiles
		await updateVariable(self, 'audio_profiles', profiles.map((p: any) => p.Name).join(', '))

		//build CHOICES_AUDIO_PROFILES
		const choices = profiles.map((p: any) => {
			return { id: p.Name, label: p.Name }
		})
		if (choices.length === 0) {
			choices.push({ id: 'None', label: 'None' })
		}
		self.CHOICES_AUDIO_PROFILES = choices
		self.updateActions()
		self.updateFeedbacks()
	}

	//get selected audio profile
	const selectedProfile = await fetchData(self, '/api/v1/audio/profiles/selected')
	if (selectedProfile) {
		self.AUDIO_PROFILE_SELECTED = selectedProfile
		await updateVariable(self, 'selected_audio_profile', selectedProfile.Name || '')
	}*/
}

async function pollComposer(self: MulticamInstance) {
	logVerbose(self, 'Polling Composer')

	//get composer files
	const files = await fetchData(self, '/api/v3/composer')
	if (files && files !== 'Application not launched!') {
		clearStatus(self, 'composerFiles')
		self.COMPOSER_FILES = files

		//console.log('files', files)

		//build CHOICES_COMPOSER_FILES
		const choices = files.map((f: any) => {
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
		logStatusChange(self, 'composerFiles', 'Unable to fetch composer files, application not launched')
	}

	//get selected composer file
	const selectedFile = await fetchData(self, '/api/v3/composer/selected')
	if (selectedFile && selectedFile !== 'Application not launched!') {
		self.COMPOSER_FILE_SELECTED = selectedFile.ComposerFileId
		await updateVariable(self, 'composerSelectedFileName', selectedFile.ComposerFileName || '')
		await updateVariable(self, 'composerSelectedFileId', selectedFile.ComposerFileId || '')
		logStatusChange(
			self,
			'composerSelectedFile',
			`Selected composer file: ${selectedFile.ComposerFileName} (${selectedFile.ComposerFileId})`,
		)
	} else {
		logStatusChange(self, 'composerSelectedFile', 'Unable to fetch selected composer file, application not launched')
	}

	//get selected composer file's content
	const content = await fetchData(self, '/api/v3/composer/selected/compositions')
	if (content && content !== 'Application not launched!') {
		if (content !== 'No file selected!') {
			self.COMPOSER_FILE_SELECTED_COMPOSITIONS = content

			//console.log('content', content)

			clearStatus(self, 'composerFileContent')

			//build CHOICES_COMPOSER_COMPOSITIONS
			const choices = content.map((c: any) => {
				return { id: c.ComposerSceneId, label: c.ComposerSceneName }
			})
			if (choices.length === 0) {
				logStatusChange(self, 'composerCompositions', 'No compositions found in selected composer file')
				choices.push({ id: 'None', label: 'None' })
			} else {
				clearStatus(self, 'composerCompositions')
			}

			//console.log('CHOICES_COMPOSER_COMPOSITIONS:', choices)

			//only update if choices have changed
			if (JSON.stringify(self.CHOICES_COMPOSER_COMPOSITIONS) !== JSON.stringify(choices)) {
				self.CHOICES_COMPOSER_COMPOSITIONS = choices
				self.updateActions()
				self.updateFeedbacks()
			}

			//also build CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS
			const tempChoicesElements: any[] = []
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
				logStatusChange(self, 'composerCompositionElements', 'No composition elements found in selected composer file')
				tempChoicesElements.push({ id: 'None', label: 'None' })
			} else {
				clearStatus(self, 'composerCompositionElements')
			}

			//console.log('CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS:', tempChoicesElements)

			//only update if choices have changed
			if (JSON.stringify(self.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS) !== JSON.stringify(tempChoicesElements)) {
				self.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS = tempChoicesElements
				self.updateActions()
				self.updateFeedbacks()
			}
		} else {
			logStatusChange(self, 'composerFileContent', 'Unable to fetch composer file elements, no file selected')
		}
	} else {
		logStatusChange(self, 'composerFileContent', 'Unable to fetch composer file content, application not launched')
	}

	//get selected composition
	const composition = await fetchData(self, '/api/v3/composer/selected/compositions/selected')
	if (composition && composition !== 'Application not launched!') {
		clearStatus(self, 'composerSelectedComposition')
		self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION = composition
		self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID = composition.CompositionSceneId || ''
		await updateVariable(self, 'composerSelectedCompositionSceneName', composition.CompositionSceneName || '')
		await updateVariable(self, 'composerSelectedCompositionSceneId', composition.CompositionSceneId || '')
	} else {
		logStatusChange(
			self,
			'composerSelectedComposition',
			'Unable to fetch selected composition, application not launched',
		)
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

async function buildMedialistsMediaChoices(
	self: MulticamInstance,
	medialists: any[],
): Promise<{ id: string; label: string }[]> {
	const buckets = await Promise.all(
		medialists.map(async (ml: any) => {
			const mlName = String(ml.Name ?? '')
			const mlId = String(ml.Id ?? '')
			let items: any[] = Array.isArray(ml.Items) ? ml.Items : []
			if (items.length === 0 && mlId) {
				const detail = await fetchData(self, `/api/v3/medialist/${mlId}`)
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

async function pollMedialist(self: MulticamInstance) {
	logVerbose(self, 'Polling Medialist')

	//get available medialists
	//api/v3/medialist

	const medialists = await fetchData(self, '/api/v3/medialist')
	if (medialists && medialists !== 'Application not launched!') {
		clearStatus(self, 'medialists')
		self.MEDIALISTS = medialists

		self.checkFeedbacks()

		//build temp array for CHOICES_MEDIALISTS, and then compare to existing array to see if we need to update
		const tempChoicesElements = medialists.map((m: any) => {
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
		logStatusChange(self, 'medialists', 'Unable to fetch medialists, application not launched')
		const emptyAllMedia = [{ id: 'None', label: 'None' }]
		if (JSON.stringify(self.CHOICES_MEDIALISTS_MEDIA) !== JSON.stringify(emptyAllMedia)) {
			self.CHOICES_MEDIALISTS_MEDIA = emptyAllMedia
			self.updateActions()
			self.updateFeedbacks()
		}
	}

	//get selected medialist
	//api/v3/medialist/selected

	const selectedMedialist = await fetchData(self, '/api/v3/medialist/selected')
	if (selectedMedialist && selectedMedialist !== 'Application not launched!') {
		clearStatus(self, 'medialistSelected')
		self.MEDIALIST_SELECTED = selectedMedialist
		let nextSelectedMedia: { id: string; label: string }[]
		if (selectedMedialist.Items && selectedMedialist.Items.length > 0) {
			const mlName = String(selectedMedialist.Name ?? '')
			nextSelectedMedia = selectedMedialist.Items.map((m: any) => ({
				id: m.Id,
				label: `${mlName} - ${m.MediaName}`,
			}))
			if (nextSelectedMedia.length === 0) {
				nextSelectedMedia.push({ id: 'None', label: 'None' })
			}
		} else {
			nextSelectedMedia = [{ id: 'None', label: 'None' }]
		}
		if (JSON.stringify(self.CHOICES_MEDIALIST_SELECTED_MEDIA) !== JSON.stringify(nextSelectedMedia)) {
			self.CHOICES_MEDIALIST_SELECTED_MEDIA = nextSelectedMedia
			self.updateActions()
			self.updateFeedbacks()
		}
		await updateVariable(self, 'medialistSelectedName', selectedMedialist.Name || '')
		await updateVariable(self, 'medialistSelectedId', selectedMedialist.Id || '')
	} else {
		logStatusChange(self, 'medialistSelected', 'Unable to fetch selected medialist, application not launched')
	}

	//get selected media in selected medialist
	//api/v3/medialist/selected/media

	const selectedMedia = await fetchData(self, '/api/v3/medialist/selected/media')
	if (selectedMedia && selectedMedia !== 'Application not launched!') {
		clearStatus(self, 'medialistSelectedMedia')
		self.MEDIALIST_SELECTED_MEDIA = selectedMedia
		await updateVariable(self, 'medialistSelectedMedia', JSON.stringify(selectedMedia))
	} else {
		logStatusChange(self, 'medialistSelectedMedia', 'Unable to fetch selected media, application not launched')
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

async function pollScenes(self: MulticamInstance) {
	logVerbose(self, 'Polling scenes')

	//get scenes files
	const sceneFiles = await fetchData(self, '/api/v2/scenes/files')
	if (sceneFiles && sceneFiles !== 'Application not launched!') {
		clearStatus(self, 'sceneFiles')
		self.SCENE_FILES = sceneFiles

		//build CHOICES_SCENE_FILES
		const choices = sceneFiles.map((f: any) => {
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
		logStatusChange(self, 'sceneFiles', 'Unable to fetch scene files, application not launched')
	}

	//get selected secenes file
	const selectedSceneFile = await fetchData(self, '/api/v2/scenes/selected')
	if (selectedSceneFile && selectedSceneFile !== 'Application not launched!') {
		clearStatus(self, 'sceneSelectedFile')
		self.SCENES_FILE_SELECTED = selectedSceneFile
		await updateVariable(self, 'sceneSelectedFileName', selectedSceneFile.Name || '')
		await updateVariable(self, 'sceneSelectedFileId', selectedSceneFile.Id || '')
	} else {
		logStatusChange(self, 'sceneSelectedFile', 'Unable to fetch selected scene file, application not launched')
	}

	//get selected scenes file content
	const selectedSceneFileContent = await fetchData(self, '/api/v2/scenes/selected/scenes')
	if (selectedSceneFileContent && selectedSceneFileContent !== 'Application not launched!') {
		if (selectedSceneFileContent.status && selectedSceneFileContent.status === 404) {
			self.SCENES_FILE_SELECTED_SCENES = []
			self.SCENES_FILE_SELECTED_SCENES = [{ Id: 'None', Name: 'None' }]
			//log the error - .detail
			logStatusChange(
				self,
				'sceneFileContent',
				`Scenes file content error: ${selectedSceneFileContent.detail || 'Unknown error'}`,
			)
			return
		}

		clearStatus(self, 'sceneFileContent')
		self.SCENES_FILE_SELECTED_SCENES = selectedSceneFileContent

		//build CHOICES_SCENES_FILE_SELECTED_SCENES
		const choices = selectedSceneFileContent.map((s: any) => {
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
		logStatusChange(self, 'sceneFileContent', 'Unable to fetch selected scene file content, application not launched')
	}

	//get selected scene
	const selectedScene = await fetchData(self, '/api/v2/scenes/selected/livescene')
	if (selectedScene && selectedScene !== 'Application not launched!') {
		clearStatus(self, 'sceneSelected')
		self.SCENES_FILE_SELECTED_SCENE = selectedScene
		self.SCENES_FILE_SELECTED_SCENE_ID = selectedScene.Id || ''
		await updateVariable(self, 'sceneSelectedSceneName', selectedScene.Name || '')
		await updateVariable(self, 'sceneSelectedSceneId', selectedScene.Id || '')
	} else {
		logStatusChange(self, 'sceneSelected', 'Unable to fetch selected scene, application not launched')
	}
}

async function pollStreaming(self: MulticamInstance) {
	logVerbose(self, 'Polling streaming')
	const streamingCatalogs = await fetchData(self, '/api/v2/streaming/catalogs')
	if (Array.isArray(streamingCatalogs)) {
		const choices = streamingCatalogs.map((c: any) => ({ id: c.Id, label: c.Name }))
		if (JSON.stringify(self.CHOICES_STREAMING_CATALOGS) !== JSON.stringify(choices)) {
			self.CHOICES_STREAMING_CATALOGS = choices
			self.updateActions()
		}
	}

	const streamingProfiles = await fetchData(self, '/api/v2/streaming/selected/profiles')
	if (Array.isArray(streamingProfiles)) {
		const choices = streamingProfiles.map((p: any) => ({ id: p.Id, label: p.Name }))
		if (JSON.stringify(self.CHOICES_STREAMING_PROFILES) !== JSON.stringify(choices)) {
			self.CHOICES_STREAMING_PROFILES = choices
			self.updateActions()
		}
	}
}

async function pollStudio(_self: MulticamInstance) {
	//self.log('info', 'Polling studio - not yet implemented')
}

async function pollTitler(self: MulticamInstance) {
	logVerbose(self, 'Polling Titler')

	//get titler files
	const titlerFiles = await fetchData(self, '/api/v2/titler/files')
	if (titlerFiles) {
		self.TITLER_FILES = titlerFiles
		self.checkFeedbacks()

		//console.log('titler files', titlerFiles)

		//build temp array for CHOICES_TITLER_FILES, and then compare to existing array to see if we need to update
		const tempChoicesFiles: any[] = []
		for (const file of titlerFiles) {
			tempChoicesFiles.push({ id: file.Id, label: file.Name })
		}

		if (JSON.stringify(self.CHOICES_TITLER_FILES) !== JSON.stringify(tempChoicesFiles)) {
			self.CHOICES_TITLER_FILES = tempChoicesFiles
			self.updateActions()
			self.updateFeedbacks()
		}
	}

	//get selected titler file
	const selectedTitlerFile = await fetchData(self, '/api/v2/titler/selected')
	if (selectedTitlerFile && selectedTitlerFile !== 'Application not launched!') {
		//update name and id
		await updateVariable(self, 'titlerSelectedFileName', selectedTitlerFile.Name || '')
		await updateVariable(self, 'titlerSelectedFileId', selectedTitlerFile.Id || '')
		logStatusChange(
			self,
			'titlerSelectedFile',
			`Selected titler file: ${selectedTitlerFile.Name} (${selectedTitlerFile.Id})`,
		)
	} else {
		await updateVariable(self, 'titlerSelectedFileName', 'None')
		await updateVariable(self, 'titlerSelectedFileId', 'None')
		logStatusChange(self, 'titlerSelectedFile', 'Unable to fetch selected titler file, application not launched')
	}

	//get selected titler file elements
	const selectedTitlerFileElements = await fetchData(self, '/api/v2/titler/selected/elements')
	if (selectedTitlerFileElements && selectedTitlerFileElements !== 'Application not launched!') {
		if (selectedTitlerFileElements.status && selectedTitlerFileElements.status === 404) {
			logStatusChange(self, 'titlerElements', 'No elements found for selected titler file')
			return
		}

		clearStatus(self, 'titlerElements')

		let needsUpdate = false

		//build temp array for CHOICES_TITLER_ELEMENTS, and then compare to existing array to see if we need to update
		const tempChoicesElements: any[] = []
		for (const element of selectedTitlerFileElements) {
			tempChoicesElements.push({ id: element.Id, label: element.Name })
		}

		if (JSON.stringify(self.CHOICES_TITLER_ELEMENTS) !== JSON.stringify(tempChoicesElements)) {
			self.CHOICES_TITLER_ELEMENTS = tempChoicesElements
			needsUpdate = true
		}

		//loop through elements and grab each element's content via /api/v2/titler/selected/elements/{elementId}/speaker/entries
		for (const element of selectedTitlerFileElements) {
			logVerbose(self, `Processing element ${element.Id} (${element.Name}) of type ${element.ElementType}`)

			if (element.ElementType == 'Speaker') {
				logVerbose(self, `Fetching speaker entries for element ${element.Id} (${element.Name})`)

				// Build CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS
				const tempSpeakerChoicesRows: any[] = []

				const elementSpeakerEntries = await fetchData(
					self,
					`/api/v2/titler/selected/elements/${element.Id}/speaker/entries`,
				)
				if (elementSpeakerEntries) {
					if (elementSpeakerEntries.status && elementSpeakerEntries.status === 404) {
						element.SpeakerEntries = []
						//log the error - .detail
						logStatusChange(
							self,
							`titlerSpeakerEntries:${element.Id}`,
							`Titler element speaker entries error for element ${element.Id}: ${elementSpeakerEntries.detail || 'Unknown error'}`,
						)
					} else {
						clearStatus(self, `titlerSpeakerEntries:${element.Id}`)

						//append the speaker entries to the element object
						element.SpeakerEntries = elementSpeakerEntries

						for (const entry of elementSpeakerEntries) {
							if (entry.Entries && typeof entry.Entries === 'object') {
								const entriesLabel = Object.entries(entry.Entries)
									.map(([k, v]) => `${k}: ${v}`)
									.join(', ')

								tempSpeakerChoicesRows.push({
									id: `${element.Id}_speaker_${entry.Id}`,
									label: entriesLabel,
								})
							} /* else {
								// fallback: no Entries
								tempSpeakerChoicesRows.push({
									id: `${element.Id}_speaker`,
									label: '(no entries)',
								})
							}*/
						}
					}
				}

				//if tempSpeakerChoicesRows is empty, add a 'None' choice
				if (tempSpeakerChoicesRows.length === 0) {
					tempSpeakerChoicesRows.push({ id: 'None', label: 'None' })
				}

				if (JSON.stringify(self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS) !== JSON.stringify(tempSpeakerChoicesRows)) {
					self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS = tempSpeakerChoicesRows
					needsUpdate = true
				}

				//get element speaker live row id via /api/v2/titler/selected/elements/{elementId}/speaker/entries/live
				const elementLiveSpeakerRowId = await fetchData(
					self,
					`/api/v2/titler/selected/elements/${element.Id}/speaker/entries/live`,
				)
				if (elementLiveSpeakerRowId) {
					element.LiveSpeakerRowId = elementLiveSpeakerRowId.Id || ''
				}
			} else if (element.ElementType == 'Panel') {
				logVerbose(self, `Fetching panel entries for element ${element.Id} (${element.Name})`)

				//build CHOICES_TITLER_ELEMENTS_PANEL_ROWS
				const tempPanelChoicesRows: any[] = []

				//get each element's panel entries via /api/v2/titler/selected/elements/{elementId}/panel/entries
				const elementPanelEntries = await fetchData(
					self,
					`/api/v2/titler/selected/elements/${element.Id}/panel/entries`,
				)
				if (elementPanelEntries) {
					if (elementPanelEntries.status && elementPanelEntries.status === 404) {
						element.PanelEntries = []
						//log the error - .detail
						logStatusChange(
							self,
							`titlerPanelEntries:${element.Id}`,
							`Titler element panel entries error for element ${element.Id}: ${elementPanelEntries.detail || 'Unknown error'}`,
						)
					} else {
						clearStatus(self, `titlerPanelEntries:${element.Id}`)

						//append the panel entries to the element object
						element.PanelEntries = elementPanelEntries

						for (const entry of elementPanelEntries) {
							if (entry.Entries && typeof entry.Entries === 'object') {
								const entriesLabel = Object.entries(entry.Entries)
									.map(([k, v]) => `${k}: ${v}`)
									.join(', ')

								tempPanelChoicesRows.push({
									id: `${element.Id}_panel_${entry.Id}`,
									label: entriesLabel,
								})
							} /* else {
								// fallback: no Entries
								tempPanelChoicesRows.push({
									id: `${element.Id}_panel`,
									label: '(no entries)',
								})
							}*/
						}
					}
				}

				//if tempPanelChoicesRows is empty, add a 'None' choice
				if (tempPanelChoicesRows.length === 0) {
					tempPanelChoicesRows.push({ id: 'None', label: 'None' })
				}

				if (JSON.stringify(self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS) !== JSON.stringify(tempPanelChoicesRows)) {
					self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS = tempPanelChoicesRows
					needsUpdate = true
				}

				//get element speaker live row id via /api/v2/titler/selected/elements/{elementId}/panel/entries/live
				const elementLivePanelRowId = await fetchData(
					self,
					`/api/v2/titler/selected/elements/${element.Id}/panel/entries/live`,
				)
				if (elementLivePanelRowId) {
					element.LivePanelRowId = elementLivePanelRowId.Id || ''
				}
			}
		}

		self.TITLER_SELECTED_FILE_ELEMENTS = selectedTitlerFileElements

		if (needsUpdate) {
			self.updateActions()
			self.updateFeedbacks()
		}

		self.checkFeedbacks()
	} else {
		logStatusChange(self, 'titlerElements', 'Unable to fetch selected titler file elements, application not launched')
	}
}

async function pollVideo(_self: MulticamInstance) {
	//self.log('info', 'Polling video - not yet implemented')
}

export async function updateVariable(self: MulticamInstance, varName: string, value: unknown): Promise<void> {
	const variableObj: any = {}
	variableObj[varName] = value
	self.setVariableValues(variableObj)
}

async function fetchData(self: MulticamInstance, endpoint: string, method?: string, payload?: any): Promise<any> {
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
			if (self.config.specifyApiKey && self.config.apiKey) {
				headers['x-apikey'] = `${self.config.apiKey}`
			}

			let body: string | undefined = undefined

			// If payload is provided, include it in the request
			if (payload) {
				method = 'POST' //override to POST if we have a payload
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
		const dedupe = getPollLogState(self)
		if (dedupe.suppressDuplicateMessage !== message) {
			self.log('error', `Failed to fetch data: ${message}`)
			dedupe.suppressDuplicateMessage = message
		}
		return null
	}
}

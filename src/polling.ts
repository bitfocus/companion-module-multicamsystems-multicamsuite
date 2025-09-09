import type { MulticamInstance } from './main.js'

let pollInterval: NodeJS.Timeout | undefined = undefined

export function startPolling(self: MulticamInstance): void {
	stopPolling()

	const interval = Number(self.config.pollingInterval || 5000)

	if (!interval || isNaN(interval)) {
		self.log('error', 'Invalid polling interval in config')
		return
	}

	if (!self.config.enablePolling) {
		self.log('info', 'Polling is disabled in config')
		return
	}

	self.pollInterval = setInterval(() => {
		runPollCycle(self)
	}, interval)

	self.log('info', `Started polling every ${interval}ms`)
}

export function stopPolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval)
		pollInterval = undefined
	}
}

async function runPollCycle(self: MulticamInstance): Promise<void> {
	//try {
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
	/*} catch (err) {
		self.log('error', `Polling failed: ${err}`)
		console.log('log', `${err}`)
		stopPolling()
	}*/
}

async function pollApplication(self: MulticamInstance) {
	//get system information
	self.log('info', 'Polling application/system information')

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
		const choices = licensedApps.map((app: any) => {
			return { id: app.name, label: app.name }
		})
		//update actions, feedbacks
		if (choices.length === 0) {
			choices.push({ id: 'None', label: 'None' })
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

async function pollAudio(self: MulticamInstance) {
	//get audio profiles
	self.log('info', 'Polling audio profiles')

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
	self.log('info', 'Polling Composer')

	//get composer files
	const files = await fetchData(self, '/api/v3/composer')
	if (files) {
		self.COMPOSER_FILES = files

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
	}

	//get selected composer file
	const selectedFile = await fetchData(self, '/api/v3/composer/selected')
	if (selectedFile) {
		self.COMPOSER_FILE_SELECTED = selectedFile.ComposerFileId
		await updateVariable(self, 'composerSelectedFileName', selectedFile.ComposerFileName || '')
		await updateVariable(self, 'composerSelectedFileId', selectedFile.ComposerFileId || '')
	}

	//get selected composer file's content
	const content = await fetchData(self, '/api/v3/composer/selected/compositions')
	if (content) {
		self.COMPOSER_FILE_SELECTED_COMPOSITIONS = content

		//build CHOICES_COMPOSER_COMPOSITIONS
		const choices = content.map((c: any) => {
			return { id: c.CompositionSceneId, label: c.CompositionSceneName }
		})
		if (choices.length === 0) {
			choices.push({ id: 'None', label: 'None' })
		}
		//only update if choices have changed
		if (JSON.stringify(self.CHOICES_COMPOSER_COMPOSITIONS) !== JSON.stringify(choices)) {
			self.CHOICES_COMPOSER_COMPOSITIONS = choices
			self.updateActions()
			self.updateFeedbacks()
		}

		//also build CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS
		const tempChoicesElements: any[] = []
		for (const composition of content) {
			if (composition.Elements) {
				for (const element of composition.ComposerElements) {
					const id = `${composition.CompositionSceneId}_${element.Id}`
					tempChoicesElements.push({
						id,
						label: `${composition.CompositionSceneName} - ${element.Name} (${element.Source})`,
					})
				}
			}
		}

		if (tempChoicesElements.length === 0) {
			tempChoicesElements.push({ id: 'None', label: 'None' })
		}

		//only update if choices have changed
		if (JSON.stringify(self.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS) !== JSON.stringify(tempChoicesElements)) {
			self.CHOICES_COMPOSER_COMPOSITIONS_ELEMENTS = tempChoicesElements
			self.updateActions()
			self.updateFeedbacks()
		}
	}

	//get selected composition
	const composition = await fetchData(self, '/api/v3/composer/selected/compositions/selected')
	if (composition) {
		self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION = composition
		self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID = composition.CompositionSceneId || ''
		await updateVariable(self, 'composerSelectedCompositionSceneName', composition.CompositionSceneName || '')
		await updateVariable(self, 'composerSelectedCompositionSceneId', composition.CompositionSceneId || '')
	}
}

async function pollConf(self: MulticamInstance) {
	self.log('info', 'Polling Conf')

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

async function pollInsitu(self: MulticamInstance) {
	self.log('info', 'Polling Insitu')
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

async function pollMedialist(self: MulticamInstance) {
	self.log('info', 'Polling medialist - not yet implemented')
}

async function pollPublisher(self: MulticamInstance) {
	self.log('info', 'Polling publisher - not yet implemented')
}

async function pollRadio(self: MulticamInstance) {
	self.log('info', 'Polling radio - not yet implemented')
}

async function pollRecording(self: MulticamInstance) {
	self.log('info', 'Polling recording - not yet implemented')
}

async function pollScenes(self: MulticamInstance) {
	self.log('info', 'Polling scenes')

	//get scenes files
	const sceneFiles = await fetchData(self, '/api/v2/scenes/files')
	if (sceneFiles) {
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
	}

	//get selected secenes file
	const selectedSceneFile = await fetchData(self, '/api/v2/scenes/selected')
	if (selectedSceneFile) {
		self.SCENES_FILE_SELECTED = selectedSceneFile
		await updateVariable(self, 'sceneSelectedFileName', selectedSceneFile.Name || '')
		await updateVariable(self, 'sceneSelectedFileId', selectedSceneFile.Id || '')
	}

	//get selected scenes file content
	const selectedSceneFileContent = await fetchData(self, '/api/v2/scenes/selected/scenes')
	if (selectedSceneFileContent) {
		if (selectedSceneFileContent.status && selectedSceneFileContent.status === 404) {
			self.SCENES_FILE_SELECTED_SCENES = []
			self.SCENES_FILE_SELECTED_SCENES = [{ Id: 'None', Name: 'None' }]
			//log the error - .detail
			self.log('debug', `Scenes file content error: ${selectedSceneFileContent.detail || 'Unknown error'}`)
			return
		}

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
	}

	//get selected sceneq
	const selectedScene = await fetchData(self, '/api/v2/scenes/selected/livescene')
	if (selectedScene) {
		self.SCENES_FILE_SELECTED_SCENE = selectedScene
		self.SCENES_FILE_SELECTED_SCENE_ID = selectedScene.Id || ''
		await updateVariable(self, 'sceneSelectedSceneName', selectedScene.Name || '')
		await updateVariable(self, 'sceneSelectedSceneId', selectedScene.Id || '')
	}
}

async function pollStreaming(self: MulticamInstance) {
	self.log('info', 'Polling streaming - not yet implemented')
}

async function pollStudio(self: MulticamInstance) {
	self.log('info', 'Polling studio - not yet implemented')
}

async function pollTitler(self: MulticamInstance) {
	//get titler files
	const titlerFiles = await fetchData(self, '/api/v2/titler/files')
	if (titlerFiles) {
		self.TITLER_FILES = titlerFiles
		self.checkFeedbacks()

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
	if (selectedTitlerFile) {
		//update name and id
		await updateVariable(self, 'titlerSelectedFileName', selectedTitlerFile.Name || '')
		await updateVariable(self, 'titlerSelectedFileId', selectedTitlerFile.Id || '')
	} else {
		await updateVariable(self, 'titlerSelectedFileName', 'None')
		await updateVariable(self, 'titlerSelectedFileId', 'None')
	}

	//get selected titler file elements
	const selectedTitlerFileElements = await fetchData(self, '/api/v2/titler/selected/elements')
	if (selectedTitlerFileElements) {
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
			if (self.config.verbose) {
				self.log('debug', `Processing element ${element.Id} (${element.Name}) of type ${element.ElementType}`)
			}

			if (element.ElementType == 'Speaker') {
				if (self.config.verbose) {
					self.log('debug', `Fetching speaker entries for element ${element.Id} (${element.Name})`)
				}

				const elementSpeakerEntries = await fetchData(
					self,
					`/api/v2/titler/selected/elements/${element.Id}/speaker/entries`,
				)
				if (elementSpeakerEntries) {
					if (elementSpeakerEntries.status && elementSpeakerEntries.status === 404) {
						element.SpeakerEntries = []
						//log the error - .detail
						self.log(
							'debug',
							`Titler element speaker entries error for element ${element.Id}: ${elementSpeakerEntries.detail || 'Unknown error'}`,
						)
					} else {
						//append the speaker entries to the element object
						element.SpeakerEntries = elementSpeakerEntries

						// Build CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS
						const tempSpeakerChoicesRows: any[] = []

						for (const element of elementSpeakerEntries) {
							if (element.Entries && typeof element.Entries === 'object') {
								const entriesLabel = Object.entries(element.Entries)
									.map(([k, v]) => `${k}: ${v}`)
									.join(', ')

								tempSpeakerChoicesRows.push({
									id: `${element.Id}_speaker`,
									label: entriesLabel,
								})
							} else {
								// fallback: no Entries
								tempSpeakerChoicesRows.push({
									id: `${element.Id}_speaker`,
									label: '(no entries)',
								})
							}
						}

						if (JSON.stringify(self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS) !== JSON.stringify(tempSpeakerChoicesRows)) {
							self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS = tempSpeakerChoicesRows
							needsUpdate = true
						}
					}
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
				if (self.config.verbose) {
					self.log('debug', `Fetching panel entries for element ${element.Id} (${element.Name})`)
				}
				//get each element's panel entries via /api/v2/titler/selected/elements/{elementId}/panel/entries
				const elementPanelEntries = await fetchData(
					self,
					`/api/v2/titler/selected/elements/${element.Id}/panel/entries`,
				)
				if (elementPanelEntries) {
					console.log('log', elementPanelEntries)

					if (elementPanelEntries.status && elementPanelEntries.status === 404) {
						element.PanelEntries = []
						//log the error - .detail
						self.log(
							'debug',
							`Titler element panel entries error for element ${element.Id}: ${elementPanelEntries.detail || 'Unknown error'}`,
						)
					} else {
						//append the panel entries to the element object
						element.PanelEntries = elementPanelEntries

						//build CHOICES_TITLER_ELEMENTS_PANEL_ROWS
						const tempPanelChoicesRows: any[] = []
						for (const element of elementPanelEntries) {
							if (element.Entries && typeof element.Entries === 'object') {
								const entriesLabel = Object.entries(element.Entries)
									.map(([k, v]) => `${k}: ${v}`)
									.join(', ')

								tempPanelChoicesRows.push({
									id: `${element.Id}_panel`,
									label: entriesLabel,
								})
							} else {
								// fallback: no Entries
								tempPanelChoicesRows.push({
									id: `${element.Id}_panel`,
									label: '(no entries)',
								})
							}
						}

						if (JSON.stringify(self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS) !== JSON.stringify(tempPanelChoicesRows)) {
							self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS = tempPanelChoicesRows
							needsUpdate = true
						}
					}
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
	}
}

async function pollVideo(self: MulticamInstance) {
	self.log('info', 'Polling video - not yet implemented')
}

export async function updateVariable(self: MulticamInstance, varName: string, value: any) {
	const variableObj: any = {}
	variableObj[varName] = value
	await self.setVariableValues(variableObj)
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

			let headers: any = {
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
				return JSON.parse(raw)
			} else {
				return raw.trim()
			}
		} else {
			self.log('error', 'Invalid host or port configuration')
			return null
		}
	} catch (error: any) {
		self.log('error', `Failed to fetch data: ${error.message || error}`)
		return null
	}
}

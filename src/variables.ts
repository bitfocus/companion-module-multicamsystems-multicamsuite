import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'

import type { MulticamInstance } from './main.js'

export function UpdateVariableDefinitions(self: MulticamInstance): void {
	const variables: CompanionVariableDefinition[] = []

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
	//application snapshot
	variables.push({ variableId: 'applicationSnapshot', name: 'Application Snapshot' })

	//composer variables
	//composer selected file name and id
	variables.push({ variableId: 'composerSelectedFileName', name: 'Composer - Selected File Name' })
	variables.push({ variableId: 'composerSelectedFileId', name: 'Composer - Selected File ID' })
	//composer selected scene name and id
	variables.push({ variableId: 'composerSelectedCompositionSceneName', name: 'Composer - Selected Composition Name' })
	variables.push({ variableId: 'composerSelectedCompositionSceneId', name: 'Composer - Selected Composition ID' })

	//SCENES
	//selected scene file
	variables.push({ variableId: 'sceneSelectedFileName', name: 'Scene - Selected File Name' })
	variables.push({ variableId: 'sceneSelectedFileId', name: 'Scene - Selected File ID' })
	//selected scene
	variables.push({ variableId: 'sceneSelectedSceneName', name: 'Scene - Selected Scene Name' })
	variables.push({ variableId: 'sceneSelectedSceneId', name: 'Scene - Selected Scene ID' })

	//titler variables
	//selected file name and id
	variables.push({ variableId: 'titlerSelectedFileName', name: 'Titler - Selected File Name' })
	variables.push({ variableId: 'titlerSelectedFileId', name: 'Titler - Selected File ID' })

	self.setVariableDefinitions(variables)
}

export function CheckVariables(self: MulticamInstance): void {
	const variableValues: CompanionVariableValues = {}

	self.setVariableValues(variableValues)
}

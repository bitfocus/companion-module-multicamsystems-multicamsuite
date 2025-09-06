import { CompanionFeedbackDefinitions, combineRgb } from '@companion-module/base'
import type { MulticamInstance } from './main.js'

export function UpdateFeedbacks(self: MulticamInstance): void {
	const COLOR_WHITE = combineRgb(255, 255, 255)
	const COLOR_GREEN = combineRgb(0, 255, 0)

	const feedbacks: CompanionFeedbackDefinitions = {}

	//COMPOSER
	//file is the currently selected file
	feedbacks.composerSelectedFile = {
		type: 'boolean',
		name: 'COMPOSER | File is currently selected file',
		description: 'If the chosen file is currently selected, change color',
		options: [
			{
				type: 'dropdown',
				id: 'composerFileId',
				label: 'Composer File',
				default: self.CHOICES_COMPOSER_FILES[0]?.id || '',
				choices: self.CHOICES_COMPOSER_FILES,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			//if composerFileId is COMPOSER_FILE_SELECTED, return true
			if (self.COMPOSER_FILE_SELECTED === feedback.options.composerFileId) {
				return true
			}
			return false
		},
	}

	//composition is the currently selected composition in selected composer file
	feedbacks.composerSelectedComposition = {
		type: 'boolean',
		name: 'COMPOSER | Composition is currently selected composition',
		description: 'If the chosen composition is currently selected, change color',
		options: [
			{
				type: 'dropdown',
				id: 'composerCompositionId',
				label: 'Composer Composition',
				default: self.CHOICES_COMPOSER_COMPOSITIONS[0]?.id || '',
				choices: self.CHOICES_COMPOSER_COMPOSITIONS,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			//if composerCompositionId is COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID, return true
			if (self.COMPOSER_FILE_SELECTED_COMPOSITIONS_SELECTED_COMPOSITION_ID === feedback.options.composerCompositionId) {
				return true
			}
			return false
		},
	}

	//SCENES
	//file is the currently selected file
	feedbacks.sceneSelectedFile = {
		type: 'boolean',
		name: 'SCENE | File is currently selected file',
		description: 'If the chosen file is currently selected, change color',
		options: [
			{
				type: 'dropdown',
				id: 'sceneFileId',
				label: 'Scene File',
				default: self.CHOICES_SCENES_FILES[0]?.id || '',
				choices: self.CHOICES_SCENES_FILES,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			//if sceneFileId is SCENES_FILE_SELECTED.Id, return true
			if (self.SCENES_FILE_SELECTED.Id === feedback.options.sceneFileId) {
				return true
			}
			return false
		},
	}

	//scene is the currently selected scene in selected scene file
	feedbacks.sceneSelectedScene = {
		type: 'boolean',
		name: 'SCENE | Scene is currently selected scene',
		description: 'If the chosen scene is currently selected, change color',
		options: [
			{
				type: 'dropdown',
				id: 'sceneId',
				label: 'Scene',
				default: self.CHOICES_SCENES_FILE_SELECTED_SCENES[0]?.id || '',
				choices: self.CHOICES_SCENES_FILE_SELECTED_SCENES,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			//if sceneId is SCENES_FILE_SELECTED_SCENE_ID, return true
			if (self.SCENES_FILE_SELECTED_SCENE_ID === feedback.options.sceneId) {
				return true
			}
			return false
		},
	}

	//TITLER
	//file is the currently selected file
	feedbacks.titlerSelectedFile = {
		type: 'boolean',
		name: 'TITLER | File is currently selected file',
		description: 'If the chosen file is currently selected, change color',
		options: [
			{
				type: 'dropdown',
				id: 'titlerFileId',
				label: 'Titler File',
				default: self.CHOICES_TITLER_FILES[0]?.id || '',
				choices: self.CHOICES_TITLER_FILES,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			//if titlerFileId in self.TITLER_FILES is .IsSelected = true, return true
			const file = self.TITLER_FILES.find((f) => f.Id === feedback.options.titlerFileId)
			if (file && file.IsSelected === true) {
				return true
			}

			return false
		},
	}

	//element is currently visible
	feedbacks.titlerElementVisible = {
		type: 'boolean',
		name: 'Element is currently visible',
		description: 'If the chosen element is currently visible, change color',
		options: [
			{
				type: 'dropdown',
				id: 'titlerElementId',
				label: 'Titler Element',
				default: self.CHOICES_TITLER_ELEMENTS[0]?.id || '',
				choices: self.CHOICES_TITLER_ELEMENTS,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			//if titlerElementId in self.TITLER_SELECTED_FILE_ELEMENTS is .IsVisible = true, return true
			const element = self.TITLER_SELECTED_FILE_ELEMENTS.find((e) => e.Id === feedback.options.titlerElementId)
			if (element && element.IsVisible === true) {
				return true
			}

			return false
		},
	}

	//element's selected speaker row is live
	feedbacks.titlerElementSpeakerRowLive = {
		type: 'boolean',
		name: "Element's selected speaker row is live",
		description: "If the chosen element's selected speaker row is live, change color",
		options: [
			{
				type: 'dropdown',
				id: 'titlerElementRowId',
				label: 'Titler Element',
				default: self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS[0]?.id || '',
				choices: self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			const id: string = String(feedback.options.titlerElementRowId)
			const elementId = id.split('_speaker_')[0]
			const rowId = id.split('_speaker_')[1]

			//loop through TITLER_SELECTED_FILE_ELEMENTS to find element with elementId
			const element = self.TITLER_SELECTED_FILE_ELEMENTS.find((e) => e.Id === elementId)
			if (element && element.LiveSpeakerRowId === rowId) {
				return true
			}

			return false
		},
	}

	//element's selected panel row is live
	feedbacks.titlerElementPanelRowLive = {
		type: 'boolean',
		name: "Element's selected panel row is live",
		description: "If the chosen element's selected panel row is live, change color",
		options: [
			{
				type: 'dropdown',
				id: 'titlerElementRowId',
				label: 'Titler Element',
				default: self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS[0]?.id || '',
				choices: self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			const id: string = String(feedback.options.titlerElementRowId)
			const elementId = id.split('_panel_')[0]
			const rowId = id.split('_panel_')[1]

			const element = self.TITLER_SELECTED_FILE_ELEMENTS.find((e) => e.Id === elementId)
			if (element && element.LivePanelRowId === rowId) {
				return true
			}

			return false
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}

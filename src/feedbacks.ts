import { combineRgb } from '@companion-module/base'
import type { CompanionFeedbackDefinitions, CompanionOptionValues } from '@companion-module/base'
import type { MulticamInstance } from './main.js'

export type FeedbacksSchema = Record<string, { type: 'boolean'; options: CompanionOptionValues }>

function optionValueToString(value: unknown): string {
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean') return `${value}`
	return ''
}

export function UpdateFeedbacks(self: MulticamInstance): void {
	const COLOR_WHITE = combineRgb(255, 255, 255)
	const COLOR_GREEN = combineRgb(0, 255, 0)
	const COLOR_RED = combineRgb(255, 0, 0)

	const feedbacks: CompanionFeedbackDefinitions<FeedbacksSchema> = {}

	//APPLICATION
	feedbacks.applicationAutoMode = {
		type: 'boolean',
		name: 'APPLICATION | Auto/Manual mode matches',
		description: 'Changes color when the application is in the selected automation mode.',
		options: [
			{
				type: 'dropdown',
				id: 'mode',
				label: 'Mode',
				default: 'Auto',
				choices: [
					{ id: 'Auto', label: 'Auto' },
					{ id: 'Manual', label: 'Manual' },
				],
			},
		],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: (feedback) => self.getVariableValue('applicationAutoState') === feedback.options.mode,
	}

	feedbacks.signalrConnected = {
		type: 'boolean',
		name: 'SIGNALR | Hub is connected',
		description: 'Changes color while the AssistHub SignalR connection is active.',
		options: [],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: () => self.SIGNALR_CONNECTED,
	}

	//AUDIO
	feedbacks.audioSelectedProfile = {
		type: 'boolean',
		name: 'AUDIO | Profile is selected',
		description: 'Changes color when the chosen mixer profile is selected.',
		options: [
			{
				type: 'dropdown',
				id: 'profileId',
				label: 'Profile',
				default: self.CHOICES_AUDIO_PROFILES[0]?.id || '',
				choices: self.CHOICES_AUDIO_PROFILES,
			},
		],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: (feedback) => String(self.AUDIO_PROFILE_SELECTED?.Id ?? '') === feedback.options.profileId,
	}

	//CONF
	feedbacks.confAutomationMode = {
		type: 'boolean',
		name: 'CONF | Automation mode matches',
		description: 'Changes color when Conf is in the selected automation mode.',
		options: [
			{
				type: 'dropdown',
				id: 'mode',
				label: 'Mode',
				default: 'Auto',
				choices: [
					{ id: 'Auto', label: 'Auto' },
					{ id: 'Wide', label: 'Wide' },
					{ id: 'Man', label: 'Manual' },
				],
			},
		],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: (feedback) => self.CONF_STATE?.microphones?.AutomationMode === feedback.options.mode,
	}

	//INSITU
	feedbacks.insituTagActive = {
		type: 'boolean',
		name: 'INSITU | Tag is active',
		description: 'Changes color when an Insitu tag is active.',
		options: [
			{
				type: 'dropdown',
				id: 'tag',
				label: 'Tag',
				default: self.CHOICES_INSITU_TAGS[0]?.id || '',
				choices: self.CHOICES_INSITU_TAGS,
			},
		],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: (feedback) => self.INSITU_ACTIVE_TAGS.some((tag) => tag?.Name === feedback.options.tag),
	}

	feedbacks.insituLayoutActive = {
		type: 'boolean',
		name: 'INSITU | Layout is active',
		description: 'Changes color when an Insitu layout is active.',
		options: [
			{
				type: 'dropdown',
				id: 'layout',
				label: 'Layout',
				default: self.CHOICES_INSITU_LAYOUTS[0]?.id || '',
				choices: self.CHOICES_INSITU_LAYOUTS,
			},
		],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: (feedback) => self.INSITU_ACTIVE_LAYOUT?.Name === feedback.options.layout,
	}

	//MEDIALIST
	feedbacks.medialistSelected = {
		type: 'boolean',
		name: 'MEDIALIST | Medialist is selected',
		description: 'Changes color when the selected Medialist matches.',
		options: [
			{
				type: 'dropdown',
				id: 'medialistId',
				label: 'Medialist',
				default: self.CHOICES_MEDIALISTS[0]?.id || '',
				choices: self.CHOICES_MEDIALISTS,
			},
		],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: (feedback) => String(self.MEDIALIST_SELECTED?.Id ?? '') === feedback.options.medialistId,
	}

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
		name: 'TITLER | Element is currently visible',
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
		name: "TITLER | Element's selected speaker row is live",
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
			const id = optionValueToString(feedback.options.titlerElementRowId)
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
		name: "TITLER | Element's selected panel row is live",
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
			const id = optionValueToString(feedback.options.titlerElementRowId)
			const elementId = id.split('_panel_')[0]
			const rowId = id.split('_panel_')[1]

			const element = self.TITLER_SELECTED_FILE_ELEMENTS.find((e) => e.Id === elementId)
			if (element && element.LivePanelRowId === rowId) {
				return true
			}

			return false
		},
	}

	//recording
	feedbacks.recording = {
		type: 'boolean',
		name: 'RECORDING | Recording is currently active',
		description: 'If the recording is currently active, change color',
		options: [],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_RED,
		},
		callback: () => {
			return self.getVariableValue('recording') === true
		},
	}

	feedbacks.recordingPaused = {
		type: 'boolean',
		name: 'RECORDING | Recording is paused',
		description: 'Changes color while the active recording is paused.',
		options: [],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_RED },
		callback: () => self.RECORDING_PAUSED,
	}

	//RADIO
	feedbacks.radioAutomationMode = {
		type: 'boolean',
		name: 'RADIO | Automation mode matches',
		description: 'Changes color when Radio is in the selected automation mode.',
		options: [
			{
				type: 'dropdown',
				id: 'mode',
				label: 'Mode',
				default: 'Auto',
				choices: [
					{ id: 'Auto', label: 'Auto' },
					{ id: 'Wide', label: 'Wide' },
					{ id: 'Man', label: 'Manual' },
				],
			},
		],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: (feedback) => self.RADIO_STATE?.microphones?.AutomationMode === feedback.options.mode,
	}

	//streaming
	feedbacks.streaming = {
		type: 'boolean',
		name: 'STREAMING | Streaming is currently active',
		description: 'If the streaming is currently active, change color',
		options: [
			{
				type: 'dropdown',
				id: 'streamingProfileId',
				label: 'Streaming Profile',
				default: self.CHOICES_STREAMING_PROFILES[0]?.id || '',
				choices: self.CHOICES_STREAMING_PROFILES,
			},
		],
		defaultStyle: {
			color: COLOR_WHITE,
			bgcolor: COLOR_GREEN,
		},
		callback: (feedback) => {
			return self.ACTIVE_STREAMS.some((p) => p.id === feedback.options.streamingProfileId)
		},
	}

	//VIDEO
	feedbacks.videoLiveSource = {
		type: 'boolean',
		name: 'VIDEO | Source is live',
		description: 'Changes color when the selected video source is live.',
		options: [
			{
				type: 'dropdown',
				id: 'source',
				label: 'Source',
				default: self.CHOICES_VIDEO_SOURCES[0]?.id || '',
				choices: self.CHOICES_VIDEO_SOURCES,
			},
		],
		defaultStyle: { color: COLOR_WHITE, bgcolor: COLOR_GREEN },
		callback: (feedback) => self.VIDEO_LIVE_SOURCE === feedback.options.source,
	}
	self.setFeedbackDefinitions(feedbacks)
}

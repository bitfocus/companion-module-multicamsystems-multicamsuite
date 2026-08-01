import {
	combineRgb,
	type CompanionButtonStyleProps,
	type CompanionFeedbackButtonStyleResult,
	type CompanionPresetDefinitions,
	type CompanionPresetGroup,
	type CompanionPresetSection,
	type CompanionSimplePresetDefinition,
	type ExpressionOrValue,
	type JsonValue,
	type SomePresetActionEntry,
	type SomePresetSimpleFeedbackEntry,
} from '@companion-module/base'
import type { DropdownChoice, ModuleSchema, MulticamInstance } from './main.js'

type PresetOptionValue = JsonValue | ExpressionOrValue<JsonValue | undefined> | undefined
type PresetOptions = Record<string, PresetOptionValue>

const COLOR_BLACK = combineRgb(0, 0, 0)
const COLOR_WHITE = combineRgb(255, 255, 255)
const COLOR_GREEN = combineRgb(0, 255, 0)
const COLOR_RED = combineRgb(255, 0, 0)
const COLOR_YELLOW = combineRgb(255, 255, 0)
const COLOR_BLUE = combineRgb(0, 0, 255)
const COLOR_PURPLE = combineRgb(128, 0, 128)

const FEEDBACK_GREEN: CompanionFeedbackButtonStyleResult = { color: COLOR_WHITE, bgcolor: COLOR_GREEN }
const FEEDBACK_RED: CompanionFeedbackButtonStyleResult = { color: COLOR_BLACK, bgcolor: COLOR_RED }
const FEEDBACK_YELLOW: CompanionFeedbackButtonStyleResult = { color: COLOR_BLACK, bgcolor: COLOR_YELLOW }
const FEEDBACK_BLUE: CompanionFeedbackButtonStyleResult = { color: COLOR_WHITE, bgcolor: COLOR_BLUE }

interface SimplePresetOptions {
	name: string
	text: string
	actions?: SomePresetActionEntry<ModuleSchema>[]
	feedbacks?: SomePresetSimpleFeedbackEntry<ModuleSchema>[]
	keywords?: string[]
	color?: number
	bgcolor?: number
}

interface ChoicePresetOptions {
	prefix: string
	namePrefix: string
	textPrefix: string
	choices: DropdownChoice[]
	actionId: string
	actionOptions: (choice: DropdownChoice) => PresetOptions
	feedback?: (choice: DropdownChoice) => SomePresetSimpleFeedbackEntry<ModuleSchema>
	keywords?: string[]
	color?: number
	bgcolor?: number
}

function presetAction(actionId: string, options: PresetOptions = {}): SomePresetActionEntry<ModuleSchema> {
	return { actionId, options }
}

function presetFeedback(
	feedbackId: string,
	options: PresetOptions,
	style: CompanionFeedbackButtonStyleResult,
	isInverted: boolean = false,
): SomePresetSimpleFeedbackEntry<ModuleSchema> {
	return { feedbackId, options, style, ...(isInverted ? { isInverted: true } : {}) }
}

function simplePreset(options: SimplePresetOptions): CompanionSimplePresetDefinition<ModuleSchema> {
	const style: CompanionButtonStyleProps = {
		text: options.text,
		size: 'auto',
		color: options.color ?? COLOR_WHITE,
		bgcolor: options.bgcolor ?? COLOR_BLACK,
		show_topbar: false,
	}

	return {
		type: 'simple',
		name: options.name,
		...(options.keywords ? { keywords: options.keywords } : {}),
		style,
		steps: options.actions?.length ? [{ down: options.actions, up: [] }] : [],
		feedbacks: options.feedbacks ?? [],
	}
}

function localExpression(variableName: string): ExpressionOrValue<JsonValue | undefined> {
	return { isExpression: true, value: `$(local:${variableName})` }
}

function availableChoices(choices: DropdownChoice[]): DropdownChoice[] {
	const seen = new Set<string>()
	return choices.filter((choice) => {
		const id = choice.id.trim()
		if (!id || id.toLowerCase() === 'none' || seen.has(id)) return false
		seen.add(id)
		return true
	})
}

function stableChoiceKey(value: string): string {
	let hash = 2166136261
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	const slug =
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 28) || 'choice'
	return `${slug}_${(hash >>> 0).toString(36)}`
}

function addChoicePresets(presets: CompanionPresetDefinitions<ModuleSchema>, options: ChoicePresetOptions): string[] {
	return availableChoices(options.choices).map((choice) => {
		const presetId = `${options.prefix}_${stableChoiceKey(choice.id)}`
		presets[presetId] = simplePreset({
			name: `${options.namePrefix} ${choice.label}`,
			text: options.textPrefix ? `${options.textPrefix}\n${choice.label}` : choice.label,
			actions: [presetAction(options.actionId, options.actionOptions(choice))],
			feedbacks: options.feedback ? [options.feedback(choice)] : [],
			keywords: options.keywords,
			color: options.color,
			bgcolor: options.bgcolor,
		})
		return presetId
	})
}

function simpleGroup(
	id: string,
	name: string,
	presetIds: string[],
	description?: string,
): CompanionPresetGroup<ModuleSchema> | null {
	if (presetIds.length === 0) return null
	return { id, type: 'simple', name, presets: presetIds, ...(description ? { description } : {}) }
}

function addSection(
	structure: CompanionPresetSection<ModuleSchema>[],
	id: string,
	name: string,
	groups: Array<CompanionPresetGroup<ModuleSchema> | null>,
): void {
	const definitions = groups.filter((group): group is CompanionPresetGroup<ModuleSchema> => group !== null)
	if (definitions.length > 0) structure.push({ id, name, definitions })
}

export function UpdatePresets(self: MulticamInstance): void {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}
	const structure: CompanionPresetSection<ModuleSchema>[] = []

	presets.systemRefresh = simplePreset({
		name: 'SYSTEM | Refresh Module Data',
		text: 'REFRESH\nDATA',
		actions: [presetAction('manualPoll')],
		keywords: ['poll', 'refresh', 'sync'],
		bgcolor: COLOR_BLUE,
	})
	presets.systemSignalrStatus = simplePreset({
		name: 'SYSTEM | SignalR Connection Status',
		text: 'SIGNALR',
		feedbacks: [presetFeedback('signalrConnected', {}, FEEDBACK_GREEN)],
		keywords: ['signalr', 'connection', 'status'],
	})
	addSection(structure, 'system', 'System', [
		simpleGroup('system_status', 'Status and refresh', ['systemRefresh', 'systemSignalrStatus']),
	])

	presets.applicationAuto = simplePreset({
		name: 'APPLICATION | Automatic Mode',
		text: 'APP\nAUTO',
		actions: [presetAction('applicationSetAutoMode', { isAutoMode: 'true' })],
		feedbacks: [presetFeedback('applicationAutoMode', { mode: 'Auto' }, FEEDBACK_GREEN)],
		keywords: ['application', 'automatic', 'mode'],
	})
	presets.applicationManual = simplePreset({
		name: 'APPLICATION | Manual Mode',
		text: 'APP\nMANUAL',
		actions: [presetAction('applicationSetAutoMode', { isAutoMode: 'false' })],
		feedbacks: [presetFeedback('applicationAutoMode', { mode: 'Manual' }, FEEDBACK_YELLOW)],
		keywords: ['application', 'manual', 'mode'],
	})
	presets.applicationRetry = simplePreset({
		name: 'APPLICATION | Retry Failed Start',
		text: 'RETRY\nSTART',
		actions: [presetAction('applicationRetryFailedStart')],
		bgcolor: COLOR_PURPLE,
	})
	const applicationPresets = addChoicePresets(presets, {
		prefix: 'applicationStart',
		namePrefix: 'APPLICATION | Start',
		textPrefix: 'START',
		choices: self.CHOICES_APPLICATIONS,
		actionId: 'applicationStart',
		actionOptions: (choice) => ({ applicationName: choice.id }),
		keywords: ['application', 'start'],
		bgcolor: COLOR_GREEN,
	})
	addSection(structure, 'application', 'Application', [
		simpleGroup('application_start', 'Start an application', applicationPresets),
		simpleGroup('application_modes', 'Automation mode', ['applicationAuto', 'applicationManual']),
		simpleGroup('application_maintenance', 'Maintenance', ['applicationRetry']),
	])

	const audioPresets = addChoicePresets(presets, {
		prefix: 'audioProfile',
		namePrefix: 'AUDIO | Select Profile',
		textPrefix: 'AUDIO',
		choices: self.CHOICES_AUDIO_PROFILES,
		actionId: 'audioSelectProfile',
		actionOptions: (choice) => ({ profileId: choice.id }),
		feedback: (choice) => presetFeedback('audioSelectedProfile', { profileId: choice.id }, FEEDBACK_GREEN),
		keywords: ['audio', 'mixer', 'profile'],
	})
	addSection(structure, 'audio', 'Audio', [simpleGroup('audio_profiles', 'Mixer profiles', audioPresets)])

	presets.composerUntake = simplePreset({
		name: 'COMPOSER | Untake Composition',
		text: 'COMPOSITION\nOFF',
		actions: [presetAction('composerUntakeComposition')],
		bgcolor: COLOR_RED,
		color: COLOR_BLACK,
	})
	const composerFilePresets = addChoicePresets(presets, {
		prefix: 'composerFile',
		namePrefix: 'COMPOSER | Select File',
		textPrefix: 'COMPOSER',
		choices: self.CHOICES_COMPOSER_FILES,
		actionId: 'composerSelectFile',
		actionOptions: (choice) => ({ composerFileId: choice.id }),
		feedback: (choice) => presetFeedback('composerSelectedFile', { composerFileId: choice.id }, FEEDBACK_GREEN),
		keywords: ['composer', 'file'],
	})
	const compositionPresets = addChoicePresets(presets, {
		prefix: 'composerComposition',
		namePrefix: 'COMPOSER | Select Composition',
		textPrefix: 'COMPOSITION',
		choices: self.CHOICES_COMPOSER_COMPOSITIONS,
		actionId: 'composerSelectComposition',
		actionOptions: (choice) => ({ compositionId: choice.id }),
		feedback: (choice) =>
			presetFeedback('composerSelectedComposition', { composerCompositionId: choice.id }, FEEDBACK_GREEN),
		keywords: ['composer', 'composition'],
	})
	addSection(structure, 'composer', 'Composer', [
		simpleGroup('composer_files', 'Files', composerFilePresets),
		simpleGroup('composer_compositions', 'Compositions', compositionPresets),
		simpleGroup('composer_output', 'Output', ['composerUntake']),
	])

	presets.confAuto = simplePreset({
		name: 'CONF | Automatic Microphones',
		text: 'CONF\nAUTO',
		actions: [presetAction('confSetMicrophonesAuto')],
		feedbacks: [presetFeedback('confAutomationMode', { mode: 'Auto' }, FEEDBACK_GREEN)],
	})
	presets.confWide = simplePreset({
		name: 'CONF | Wide Shot',
		text: 'CONF\nWIDE',
		actions: [presetAction('confSetMicrophoneWide')],
		feedbacks: [presetFeedback('confAutomationMode', { mode: 'Wide' }, FEEDBACK_BLUE)],
	})
	const confMicrophonePresets = addChoicePresets(presets, {
		prefix: 'confMicrophone',
		namePrefix: 'CONF | Manual Microphone',
		textPrefix: 'CONF MIC',
		choices: self.CHOICES_CONF_MICROPHONES,
		actionId: 'confSetMicrophoneManual',
		actionOptions: (choice) => ({ mic: choice.id }),
		keywords: ['conference', 'microphone', 'manual'],
	})
	addSection(structure, 'conf', 'Conf', [
		simpleGroup('conf_modes', 'Automation mode', ['confAuto', 'confWide']),
		simpleGroup('conf_microphones', 'Manual microphones', confMicrophonePresets),
	])

	const insituTagPresets = addChoicePresets(presets, {
		prefix: 'insituTag',
		namePrefix: 'INSITU | Activate Tag',
		textPrefix: 'TAG',
		choices: self.CHOICES_INSITU_TAGS,
		actionId: 'insituTagOn',
		actionOptions: (choice) => ({ tag: choice.id }),
		feedback: (choice) => presetFeedback('insituTagActive', { tag: choice.id }, FEEDBACK_GREEN),
		keywords: ['insitu', 'tag'],
	})
	const insituLayoutPresets = addChoicePresets(presets, {
		prefix: 'insituLayout',
		namePrefix: 'INSITU | Activate Layout',
		textPrefix: 'LAYOUT',
		choices: self.CHOICES_INSITU_LAYOUTS,
		actionId: 'insituLayoutsOn',
		actionOptions: (choice) => ({ layout: choice.id }),
		feedback: (choice) => presetFeedback('insituLayoutActive', { layout: choice.id }, FEEDBACK_GREEN),
		keywords: ['insitu', 'layout'],
	})
	addSection(structure, 'insitu', 'Insitu', [
		simpleGroup('insitu_tags', 'Tags', insituTagPresets),
		simpleGroup('insitu_layouts', 'Layouts', insituLayoutPresets),
	])

	presets.medialistPlay = simplePreset({
		name: 'MEDIALIST | Play Selected',
		text: 'MEDIALIST\nPLAY',
		actions: [presetAction('medialistPlay', { take: true })],
		bgcolor: COLOR_GREEN,
	})
	presets.medialistPause = simplePreset({
		name: 'MEDIALIST | Pause Selected',
		text: 'MEDIALIST\nPAUSE',
		actions: [presetAction('medialistPause')],
		color: COLOR_BLACK,
		bgcolor: COLOR_YELLOW,
	})
	presets.medialistStop = simplePreset({
		name: 'MEDIALIST | Stop Selected',
		text: 'MEDIALIST\nSTOP',
		actions: [presetAction('medialistStop')],
		color: COLOR_BLACK,
		bgcolor: COLOR_RED,
	})
	const medialistSelectPresets = addChoicePresets(presets, {
		prefix: 'medialistSelect',
		namePrefix: 'MEDIALIST | Select',
		textPrefix: 'MEDIALIST',
		choices: self.CHOICES_MEDIALISTS,
		actionId: 'medialistSelect',
		actionOptions: (choice) => ({ medialist: choice.id }),
		feedback: (choice) => presetFeedback('medialistSelected', { medialistId: choice.id }, FEEDBACK_GREEN),
		keywords: ['medialist', 'select'],
	})
	addSection(structure, 'medialist', 'Medialist', [
		simpleGroup('medialist_select', 'Select a Medialist', medialistSelectPresets),
		simpleGroup('medialist_transport', 'Selected Medialist transport', [
			'medialistPlay',
			'medialistPause',
			'medialistStop',
		]),
	])

	presets.radioAuto = simplePreset({
		name: 'RADIO | Automatic Microphones',
		text: 'RADIO\nAUTO',
		actions: [presetAction('radioEnableAutoMic')],
		feedbacks: [presetFeedback('radioAutomationMode', { mode: 'Auto' }, FEEDBACK_GREEN)],
	})
	presets.radioWide = simplePreset({
		name: 'RADIO | Wide Shot',
		text: 'RADIO\nWIDE',
		actions: [presetAction('radioSetWideShot')],
		feedbacks: [presetFeedback('radioAutomationMode', { mode: 'Wide' }, FEEDBACK_BLUE)],
	})
	const radioMicrophonePresets = addChoicePresets(presets, {
		prefix: 'radioMicrophone',
		namePrefix: 'RADIO | Manual Microphone',
		textPrefix: 'RADIO MIC',
		choices: self.CHOICES_RADIO_MICROPHONES,
		actionId: 'radioSetManualMic',
		actionOptions: (choice) => ({ mic: choice.id }),
		keywords: ['radio', 'microphone', 'manual'],
	})
	addSection(structure, 'radio', 'Radio', [
		simpleGroup('radio_modes', 'Automation mode', ['radioAuto', 'radioWide']),
		simpleGroup('radio_microphones', 'Manual microphones', radioMicrophonePresets),
	])

	presets.recordingStart = simplePreset({
		name: 'RECORDING | Start',
		text: 'RECORD\nSTART',
		actions: [presetAction('recordingStart')],
		feedbacks: [presetFeedback('recording', {}, FEEDBACK_RED)],
		color: COLOR_BLACK,
		bgcolor: COLOR_RED,
	})
	presets.recordingPause = simplePreset({
		name: 'RECORDING | Pause/Resume',
		text: 'RECORD\nPAUSE',
		actions: [presetAction('recordingPause')],
		feedbacks: [presetFeedback('recordingPaused', {}, FEEDBACK_YELLOW)],
		color: COLOR_BLACK,
		bgcolor: COLOR_YELLOW,
	})
	presets.recordingStop = simplePreset({
		name: 'RECORDING | Stop',
		text: 'RECORD\nSTOP',
		actions: [presetAction('recordingStop')],
		feedbacks: [presetFeedback('recording', {}, FEEDBACK_RED)],
		color: COLOR_BLACK,
		bgcolor: COLOR_RED,
	})
	const recordingSourceExpression = localExpression('source')
	presets.recordingIsoStartSource = {
		...simplePreset({
			name: 'RECORDING | Start ISO Source',
			text: 'ISO START\n$(local:source)',
			actions: [presetAction('recordingIsoStartSource', { camId: recordingSourceExpression })],
			bgcolor: COLOR_GREEN,
		}),
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: 'Source 1' }],
	}
	presets.recordingIsoStopSource = {
		...simplePreset({
			name: 'RECORDING | Stop ISO Source',
			text: 'ISO STOP\n$(local:source)',
			actions: [presetAction('recordingIsoStopSource', { camId: recordingSourceExpression })],
			color: COLOR_BLACK,
			bgcolor: COLOR_RED,
		}),
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: 'Source 1' }],
	}
	const recordingSourceValues = availableChoices(self.CHOICES_RECORDING_AUX_SOURCES).map((choice) => ({
		name: `RECORDING | ${choice.label}`,
		value: choice.id,
	}))
	addSection(structure, 'recording', 'Recording', [
		simpleGroup('recording_transport', 'Transport', ['recordingStart', 'recordingPause', 'recordingStop']),
		{
			id: 'recording_iso_start_sources',
			type: 'template',
			name: 'Start one ISO source',
			presetId: 'recordingIsoStartSource',
			templateVariableName: 'source',
			templateValues: recordingSourceValues,
		},
		{
			id: 'recording_iso_stop_sources',
			type: 'template',
			name: 'Stop one ISO source',
			presetId: 'recordingIsoStopSource',
			templateVariableName: 'source',
			templateValues: recordingSourceValues,
		},
	])

	const sceneFilePresets = addChoicePresets(presets, {
		prefix: 'sceneFile',
		namePrefix: 'SCENES | Select File',
		textPrefix: 'SCENE FILE',
		choices: self.CHOICES_SCENES_FILES,
		actionId: 'selectSceneFile',
		actionOptions: (choice) => ({ fileId: choice.id }),
		feedback: (choice) => presetFeedback('sceneSelectedFile', { sceneFileId: choice.id }, FEEDBACK_GREEN),
		keywords: ['scene', 'file'],
	})
	const scenePresets = addChoicePresets(presets, {
		prefix: 'sceneTake',
		namePrefix: 'SCENES | Take',
		textPrefix: 'TAKE',
		choices: self.CHOICES_SCENES_FILE_SELECTED_SCENES,
		actionId: 'takeScene',
		actionOptions: (choice) => ({ sceneId: choice.id }),
		feedback: (choice) => presetFeedback('sceneSelectedScene', { sceneId: choice.id }, FEEDBACK_GREEN),
		keywords: ['scene', 'take'],
	})
	addSection(structure, 'scenes', 'Scenes', [
		simpleGroup('scene_files', 'Scene files', sceneFilePresets),
		simpleGroup('scene_take', 'Take a scene', scenePresets),
	])

	presets.streamingStartAll = simplePreset({
		name: 'STREAMING | Start All Profiles',
		text: 'STREAM\nSTART ALL',
		actions: [presetAction('streamingStartAll')],
		bgcolor: COLOR_GREEN,
	})
	presets.streamingStopAll = simplePreset({
		name: 'STREAMING | Stop All Profiles',
		text: 'STREAM\nSTOP ALL',
		actions: [presetAction('streamingStopAll')],
		color: COLOR_BLACK,
		bgcolor: COLOR_RED,
	})
	const streamingStartPresets = addChoicePresets(presets, {
		prefix: 'streamingStart',
		namePrefix: 'STREAMING | Start',
		textPrefix: 'STREAM START',
		choices: self.CHOICES_STREAMING_PROFILES,
		actionId: 'streamingStartProfile',
		actionOptions: (choice) => ({ profileId: choice.id }),
		feedback: (choice) => presetFeedback('streaming', { streamingProfileId: choice.id }, FEEDBACK_GREEN),
		keywords: ['streaming', 'profile', 'start'],
	})
	const streamingStopPresets = addChoicePresets(presets, {
		prefix: 'streamingStop',
		namePrefix: 'STREAMING | Stop',
		textPrefix: 'STREAM STOP',
		choices: self.CHOICES_STREAMING_PROFILES,
		actionId: 'streamingStopProfile',
		actionOptions: (choice) => ({ profileId: choice.id }),
		feedback: (choice) => presetFeedback('streaming', { streamingProfileId: choice.id }, FEEDBACK_RED),
		keywords: ['streaming', 'profile', 'stop'],
		color: COLOR_BLACK,
		bgcolor: COLOR_RED,
	})
	addSection(structure, 'streaming', 'Streaming', [
		simpleGroup('streaming_all', 'All profiles', ['streamingStartAll', 'streamingStopAll']),
		simpleGroup('streaming_start', 'Start a profile', streamingStartPresets),
		simpleGroup('streaming_stop', 'Stop a profile', streamingStopPresets),
	])

	const titlerFilePresets = addChoicePresets(presets, {
		prefix: 'titlerFile',
		namePrefix: 'TITLER | Select File',
		textPrefix: 'TITLER FILE',
		choices: self.CHOICES_TITLER_FILES,
		actionId: 'titlerSelectFile',
		actionOptions: (choice) => ({ fileId: choice.id }),
		feedback: (choice) => presetFeedback('titlerSelectedFile', { titlerFileId: choice.id }, FEEDBACK_GREEN),
		keywords: ['titler', 'file'],
	})
	const titlerElementPresets = addChoicePresets(presets, {
		prefix: 'titlerElement',
		namePrefix: 'TITLER | Show Element',
		textPrefix: 'TITLER ON',
		choices: self.CHOICES_TITLER_ELEMENTS,
		actionId: 'titlerElementVisible',
		actionOptions: (choice) => ({ elementId: choice.id, isOn: true, isAnimate: true }),
		feedback: (choice) => presetFeedback('titlerElementVisible', { titlerElementId: choice.id }, FEEDBACK_GREEN),
		keywords: ['titler', 'element', 'visible'],
	})
	const speakerRowPresets = addChoicePresets(presets, {
		prefix: 'titlerSpeakerRow',
		namePrefix: 'TITLER | Set Speaker Row Live',
		textPrefix: 'SPEAKER',
		choices: self.CHOICES_TITLER_ELEMENTS_SPEAKER_ROWS,
		actionId: 'titlerSetSpeakerEntryLiveRow',
		actionOptions: (choice) => ({ rowId: choice.id, resetTimer: true }),
		feedback: (choice) =>
			presetFeedback('titlerElementSpeakerRowLive', { titlerElementRowId: choice.id }, FEEDBACK_GREEN),
		keywords: ['titler', 'speaker', 'row'],
	})
	const panelRowPresets = addChoicePresets(presets, {
		prefix: 'titlerPanelRow',
		namePrefix: 'TITLER | Set Panel Row Live',
		textPrefix: 'PANEL',
		choices: self.CHOICES_TITLER_ELEMENTS_PANEL_ROWS,
		actionId: 'titlerSetPanelEntryLiveRow',
		actionOptions: (choice) => ({ rowId: choice.id, resetTimer: true }),
		feedback: (choice) =>
			presetFeedback('titlerElementPanelRowLive', { titlerElementRowId: choice.id }, FEEDBACK_GREEN),
		keywords: ['titler', 'panel', 'row'],
	})
	addSection(structure, 'titler', 'Titler', [
		simpleGroup('titler_files', 'Files', titlerFilePresets),
		simpleGroup('titler_elements', 'Show elements', titlerElementPresets),
		simpleGroup('titler_speaker_rows', 'Speaker rows', speakerRowPresets),
		simpleGroup('titler_panel_rows', 'Panel rows', panelRowPresets),
	])

	const videoSourceExpression = localExpression('source')
	presets.videoLiveSource = {
		...simplePreset({
			name: 'VIDEO | Select Live Source',
			text: '$(local:source)',
			actions: [presetAction('videoChangeLiveSource', { sourceName: videoSourceExpression })],
			feedbacks: [presetFeedback('videoLiveSource', { source: videoSourceExpression }, FEEDBACK_RED)],
			keywords: ['video', 'live', 'source', 'program'],
		}),
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: 'Source 1' }],
	}
	presets.videoRestartOutput = simplePreset({
		name: 'VIDEO | Restart Output',
		text: 'RESTART\nOUTPUT',
		actions: [presetAction('videoRestartOutput')],
		bgcolor: COLOR_PURPLE,
	})
	addSection(structure, 'video', 'Video', [
		{
			id: 'video_live_sources',
			type: 'template',
			name: 'Live sources',
			description: 'Select a source; the button turns red while that same source is live.',
			presetId: 'videoLiveSource',
			templateVariableName: 'source',
			templateValues: availableChoices(self.CHOICES_VIDEO_SOURCES).map((choice) => ({
				name: `VIDEO | ${choice.label}`,
				value: choice.id,
			})),
		},
		simpleGroup('video_output', 'Output', ['videoRestartOutput']),
	])

	self.setPresetDefinitions(structure, presets)
}

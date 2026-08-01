import type { CompanionMigrationAction, CompanionStaticUpgradeScript } from '@companion-module/base'
import type { ModuleConfig, ModuleSecrets } from './config.js'

type LegacyModuleConfig = ModuleConfig & {
	apiKey?: unknown
}

const migrateApiKeyToSecrets: CompanionStaticUpgradeScript<ModuleConfig, ModuleSecrets> = (context, props) => {
	const currentConfig = (props.config ?? context.currentConfig) as LegacyModuleConfig
	if (!Object.prototype.hasOwnProperty.call(currentConfig, 'apiKey')) {
		return {
			updatedConfig: null,
			updatedSecrets: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	}

	const { apiKey, ...configWithoutApiKey } = currentConfig
	const legacyApiKey = typeof apiKey === 'string' ? apiKey : ''
	const shouldMigrateApiKey = legacyApiKey.length > 0 && !props.secrets?.apiKey

	return {
		updatedConfig: configWithoutApiKey,
		updatedSecrets: shouldMigrateApiKey ? { ...(props.secrets ?? { apiKey: '' }), apiKey: legacyApiKey } : null,
		updatedActions: [],
		updatedFeedbacks: [],
	}
}

const ISO_SOURCE_ACTION_IDS = new Set(['recordingIsoStartSource', 'recordingIsoStopSource'])

function getLiteralStringOption(option: unknown): string | null {
	if (typeof option === 'string') return option
	if (
		typeof option !== 'object' ||
		option === null ||
		!('isExpression' in option) ||
		option.isExpression !== false ||
		!('value' in option) ||
		typeof option.value !== 'string'
	) {
		return null
	}

	return option.value
}

function migrateIsoSourceAction(action: CompanionMigrationAction): CompanionMigrationAction | null {
	if (!ISO_SOURCE_ACTION_IDS.has(action.actionId)) return null

	const legacyCamId = getLiteralStringOption(action.options.camId)
	if (legacyCamId === null) return null

	const match = /^CAM(\d+)$/i.exec(legacyCamId.trim())
	if (!match) return null

	const sourceNumber = Number(match[1])
	if (!Number.isInteger(sourceNumber) || sourceNumber < 1 || sourceNumber > 40) return null

	return {
		...action,
		options: {
			...action.options,
			camId: { value: `Source ${sourceNumber}`, isExpression: false },
		},
	}
}

const migrateIsoRecordingSources: CompanionStaticUpgradeScript<ModuleConfig, ModuleSecrets> = (_context, props) => ({
	updatedConfig: null,
	updatedSecrets: null,
	updatedActions: props.actions
		.map((action) => migrateIsoSourceAction(action))
		.filter((action): action is CompanionMigrationAction => action !== null),
	updatedFeedbacks: [],
})

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig, ModuleSecrets>[] = [
	migrateApiKeyToSecrets,
	migrateIsoRecordingSources,
]

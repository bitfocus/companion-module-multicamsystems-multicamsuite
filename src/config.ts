import type { SomeCompanionConfigField } from '@companion-module/base'
import { Regex } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: number
	specifyApiKey: boolean
	apiKey: string
	enablePolling: boolean
	pollingInterval: number
	verbose: boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: "This module will communicate with Multicam Systems' Multicam Suite API.",
		},
		{
			type: 'static-text',
			id: 'hr1',
			width: 12,
			label: ' ',
			value: '<hr />',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 5,
			default: '127.0.0.1',
			regex: Regex.IP,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port (Default: 80)',
			width: 3,
			default: '80',
			regex: Regex.PORT,
		},
		{
			type: 'static-text',
			id: 'hr2',
			width: 12,
			label: ' ',
			value: '<hr />',
		},
		{
			type: 'checkbox',
			id: 'specifyApiKey',
			label: 'Specify API Key',
			default: false,
			width: 4,
		},
		{
			type: 'textinput',
			id: 'apiKey',
			label: 'API Key',
			width: 8,
			default: '',
			isVisible: (config) => !!config.specifyApiKey,
		},
		{
			type: 'static-text',
			id: 'info2',
			width: 12,
			label: 'API Authorization',
			value:
				'You must use at least one authentication method (either by defining an API key or listing your Companion IP in the "Machine Address" section). Both methods can be set up in the Multicam Suite application under Settings > Systems > API.',
		},
		{
			type: 'static-text',
			id: 'hr3',
			width: 12,
			label: ' ',
			value: '<hr />',
		},
		{
			type: 'checkbox',
			id: 'enablePolling',
			label: 'Enable Polling',
			default: true,
			width: 4,
		},
		{
			type: 'number',
			id: 'pollingInterval',
			label: 'Polling Interval (ms)',
			default: 1000,
			min: 100,
			max: 60000,
			width: 8,
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Enable Verbose Logging',
			default: false,
			width: 4,
		},
	]
}

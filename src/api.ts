import { InstanceStatus } from '@companion-module/base'
import type { MulticamInstance } from './main.js'
import { startPolling, stopPolling } from './polling.js'
import { InitSignalR } from './signalr.js'

export async function InitConnection(self: MulticamInstance, isCurrent: () => boolean = () => true): Promise<void> {
	if (!isCurrent()) return
	self.updateStatus(InstanceStatus.Connecting, 'Connecting...')

	if (self.config.host && self.config.port) {
		const cmd = `/api/application/version`

		try {
			const results = await Promise.race([
				SendCommand(self, cmd),
				timeout(2000), // 2 second timeout
			])
			if (!isCurrent()) return

			if (!results) {
				self.updateStatus(InstanceStatus.ConnectionFailure, 'No response from Multicam')
				stopPolling(self)
				return
			}

			self.updateStatus(InstanceStatus.Ok)
			self.log('info', 'Connected successfully')
			startPolling(self)
			await InitSignalR(self)
		} catch (error: any) {
			if (!isCurrent()) return
			self.log('error', `Connection failed: ${error.message || error}`)
			self.updateStatus(InstanceStatus.ConnectionFailure, 'Failed to connect - check IP')
			stopPolling(self)
		}
	} else if (isCurrent()) {
		self.updateStatus(InstanceStatus.BadConfig, 'Missing host or port')
	}
}

async function timeout(ms: number): Promise<never> {
	return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
}

function formatApiError(result: unknown, statusText: string): string {
	if (typeof result !== 'object' || result === null || Array.isArray(result)) {
		if (typeof result === 'string') return result
		if (typeof result === 'number' || typeof result === 'boolean' || typeof result === 'bigint') return `${result}`
		return statusText
	}

	const response = result as Record<string, unknown>
	const errors = response.errors
	if (typeof errors === 'object' && errors !== null && !Array.isArray(errors)) {
		const messages = Object.entries(errors as Record<string, unknown>).flatMap(([field, value]) => {
			const fieldMessages = Array.isArray(value) ? value : [value]
			return fieldMessages.map((message) => {
				if (typeof message === 'string') return `${field}: ${message}`
				if (typeof message === 'number' || typeof message === 'boolean' || typeof message === 'bigint') {
					return `${field}: ${message}`
				}
				return `${field}: ${JSON.stringify(message)}`
			})
		})
		if (messages.length > 0) {
			const title = typeof response.title === 'string' ? `${response.title} ` : ''
			return `${title}${messages.join('; ')}`
		}
	}

	if (typeof response.detail === 'string') return response.detail
	if (typeof response.title === 'string') return response.title
	return JSON.stringify(response)
}

export async function SendCommand(
	self: MulticamInstance,
	cmd: string,
	method: string = 'GET',
	payload: unknown = undefined,
): Promise<any> {
	try {
		if (self.config.host && self.config.port) {
			const url = `http://${self.config.host}:${self.config.port}${cmd}`

			if (self.config.verbose) {
				self.log('debug', `Sending: ${url}`)
			}

			const headers: any = {
				'Content-Type': 'application/json',
			}

			//if api key is specified, add it to headers
			if (self.config.specifyApiKey == true && self.secrets.apiKey) {
				self.log('debug', 'Using configured API Key')
				headers['x-apikey'] = self.secrets.apiKey
			} else {
				self.log(
					'debug',
					`No API Key specified, relying on Companion IP being added to Multicam's Machine addresses list.`,
				)
			}

			let body: string | undefined = undefined

			// If payload is provided, include it in the request without changing the requested HTTP method.
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
			let result: any

			if (!raw) {
				result = undefined
			} else if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
				result = JSON.parse(raw)
			} else {
				result = raw.trim()
			}

			if (!response.ok) {
				const detail = formatApiError(result, response.statusText)
				self.log('warn', `${method} ${cmd} failed (${response.status}): ${detail}`)
				return undefined
			}

			return result
		} else {
			self.log('error', 'Invalid host or port configuration')
			return undefined
		}
	} catch (error: any) {
		self.log('error', `Failed to send command: ${error.message || error}`)
		return undefined
	}
}

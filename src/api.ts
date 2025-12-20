import { InstanceStatus } from '@companion-module/base'
import type { MulticamInstance } from './main.js'
import { startPolling, stopPolling } from './polling.js'

export async function InitConnection(self: MulticamInstance): Promise<void> {
	self.updateStatus(InstanceStatus.Connecting, 'Connecting...')

	if (self.config.host && self.config.port) {
		const cmd = `/api/application/version`

		try {
			const results = await Promise.race([
				SendCommand(self, cmd),
				timeout(2000), // 2 second timeout
			])

			if (!results) {
				self.updateStatus(InstanceStatus.ConnectionFailure, 'No response from Multicam')
				stopPolling()
				return
			}

			self.updateStatus(InstanceStatus.Ok)
			self.log('info', 'Connected successfully')
			startPolling(self)
		} catch (error: any) {
			self.log('error', `Connection failed: ${error.message || error}`)
			self.updateStatus(InstanceStatus.ConnectionFailure, 'Failed to connect - check IP')
			stopPolling()
		}
	} else {
		self.updateStatus(InstanceStatus.BadConfig, 'Missing host or port')
	}
}

function timeout(ms: number): Promise<never> {
	return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
}

export async function SendCommand(
	self: MulticamInstance,
	cmd: string,
	method: string = 'GET',
	payload: any = undefined,
): Promise<any> {
	try {
		if (self.config.host && self.config.port) {
			const url = `http://${self.config.host}:${self.config.port}${cmd}`

			if (self.config.verbose) {
				self.log('debug', `Sending: ${url}`)
			}

			let headers: any = {
				'Content-Type': 'application/json',
			}

			//if api key is specified, add it to headers
			if (self.config.specifyApiKey == true && self.config.apiKey) {
				self.log('debug', `Using API Key: ${self.config.apiKey}`)
				headers['x-apikey'] = `${self.config.apiKey}`
			} else {
				self.log(
					'debug',
					`No API Key specified, relying on Companion IP being added to Multicam\'s Machine addresses list.`,
				)
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

			if (contentType.includes('application/json')) {
				return JSON.parse(raw)
			} else {
				return raw.trim()
			}
		} else {
			self.log('error', 'Invalid host or port configuration')
			return undefined
		}
	} catch (error: any) {
		self.log('error', `Failed to send command: ${error.message || error}`)
		return undefined
	}
}

import * as signalR from '@microsoft/signalr'
import type { MulticamInstance } from './main.js'

export function InitSignalR(instance: MulticamInstance): void {
	void (async () => {
		instance.log('debug', 'Initializing SignalR connection')

		const url = `http://${instance.config.host}:${instance.config.port}/signalr`

		const connection = new signalR.HubConnectionBuilder()
			.withUrl(url)
			.withAutomaticReconnect()
			.configureLogging(signalR.LogLevel.Information)
			.build()

		// --- App lifecycle ---
		connection.on('OnApplicationInitialized', () => {
			instance.log('info', 'SignalR: Application Initialized')
		})

		// args: ["app name", data ]
		connection.on('OnApplicationInitializedWithDetails', (appName: string, data: any) => {
			instance.log('info', `SignalR: Initialized (${appName})`)
			instance.log('debug', `Data: ${JSON.stringify(data)}`)
            let variableObj = {
                runningApp: appName
            }
            instance.setVariableValues(variableObj);
        })
          
		connection.on('OnApplicationExited', () => {
			instance.log('info', 'SignalR: Application Exited')
            let variableObj = {
                runningApp: 'None'
            }
            instance.setVariableValues(variableObj);
		})

		// --- Live files ---
		// args: [ {id,name,isSelected} ] OR [null]
		connection.on('OnLiveTitlerFileChanged', (data: any) => {
			instance.log('info', `SignalR: Live Titler File Changed: ${data?.name ?? 'null'}`)
            let variableObj = {
                titlerSelectedFileName: data?.name ?? 'None',
                titlerSelectedFileId: data?.id ?? 'None'
            }
            console.log('setting variables', variableObj);
            instance.setVariableValues(variableObj);
		})

        //ontitlerelementupdated
        connection.on('OnTitlerElementUpdated', (data: any) => {
            instance.log('info', `SignalR: Titler Element Updated`)
            instance.log('debug', `Data: ${JSON.stringify(data)}`)
        })

		// args: ["EMISSION2"] OR [null]
		connection.on('OnLiveComposerFileChanged', (name: string | null) => {
			instance.log('info', `SignalR: Live Composer File Changed: ${name ?? 'null'}`)
            let variableObj = {
                composerSelectedFileName: name ?? 'None'
            }
            instance.setVariableValues(variableObj);
		})

		// args: ["guid"] OR ["0000..."] OR [null?]
		connection.on('OnLiveComposerFileIdChanged', (id: string | null) => {
			instance.log('info', `SignalR: Live Composer File ID Changed: ${id ?? 'null'}`)
            let variableObj = {
                composerSelectedFileId: id ?? 'None'
            }
            instance.setVariableValues(variableObj);
		})

		// args: [null] (at least in your captures)
		connection.on('OnLiveScenesFileChanged', (data: any | null) => {
			instance.log('info', `SignalR: Live Scenes File Changed: ${data === null ? 'null' : JSON.stringify(data)}`)
            let variableObj = {
                sceneSelectedFileName: data?.name ?? 'None',
                sceneSelectedFileId: data?.id ?? 'None'
            }
            instance.setVariableValues(variableObj);
		})

		// args: [ playlist object ]
		connection.on('OnLivePlaylistFileChanged', (data: any) => {
			instance.log('info', `SignalR: Live Playlist File Changed: ${data?.name ?? 'unknown'}`)
			instance.log('debug', `Playlist: ${JSON.stringify(data)}`)
		})

		try {
			await connection.start()
			instance.log('info', 'SignalR connected')
		} catch (e: any) {
			instance.log('error', `SignalR failed to start: ${e?.message ?? e}`)
		}

		;(instance as any)._signalr = connection
	})()
}
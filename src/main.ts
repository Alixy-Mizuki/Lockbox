import Eris, { ClientOptions } from "eris";
import { performance } from "perf_hooks";
import * as fs from "fs-extra";
import Event from "@util/events";
import path from "path";
import { AnyRequestData, GatewayServer, SlashCreator } from 'slash-create';
import Logger from "@util/Logger";

// we extending class Eris Client
export default class Lockbox extends Eris.Client {
    constructor(token: string) {
        super(token, {
            restMode: true,
            intents: [
                'guilds',
                'guildMessages'
            ]
        } as ClientOptions);
    }

    async launch() {
        await this.loadCommands();
        await this.loadEvents();
        await this.connect();
    }
    
    async loadEvents() {
        const oStart = performance.now();
/*
	here we called fs module with readdir method to read directory
	the given arguments uses another module called path, this module will try find any files/folder path on given arguments
	the given arguments is _dirname meaning we looking for directory name and the second arguments is 'events', 
	so in this case we want it to find the path for folder called events, and it'll return a string containing the path and then we use that string
	on fs method to get the files or folder inside the events folder,
	then after that we map Each element to get their path. and this will return an Array,
	this array now declared as List
*/
        const list = await fs.readdir(path.resolve(__dirname, 'events')).then(v => v.map(ev => `${path.resolve(__dirname, 'events')}/${ev}`));
    
// 	on this for Of loop, we will looping the every single path we got before hand
        for (const loc of list) {

		const start = performance.now();
		// we import the file as Event
		let event = await import(loc) as Event | { default: Event; };

		// if theres a "default" inside the file we will make the event as defaulted event
		if ("default" in event) event = event.default;
		/*
		this = reference to the client we extend
		now we use on method to listen the events, it has 2 arguments which the first is the Event name and the second is the listener
		for example 'MessageCreate' as event name and (message) as the listener
		*/
		this.on(event.name, event.listener.bind(this));
		const end = performance.now();
		// we log the event succesfully loaded with time load
	Logger.debug(`Loaded Event ${event.name}, in ${(end - start).toFixed(3)}ms.`)
	}
        const oEnd = performance.now();
				// we log all events succesfully loads with total time loading.
        Logger.debug(`Loaded ${list.length} Event(s), in ${(oEnd - oStart).toFixed(3)}ms.`)
    }

    async loadCommands() {
	/*
	here we declare creator variable consist of a class called SlashCreator with Object as arguments
	there we can see 3 elements
	applicationID = we can get this on discord developer portal from a the application we made
	token = this is the application TOKEN or a login Key for interacting with Discord API, this string also super super dangerous to be hardcoded to the code, 
					thats why we use ENVIRONMENT VARIABLES, so that way its safe from internet or people that wanted to use it for malicious purpose
	publicKey = we can get this on discord developer portal from a the application we made
	*/
        const creator = new SlashCreator({
            applicationID: process.env.APPLICATION_ID!,
            token: process.env.TOKEN!,
            publicKey: process.env.PUBLICKEY!
        })
				
        creator.withServer(new GatewayServer(
            (handler) => this.on('rawWS', (event) => {
                if (event.t === 'INTERACTION_CREATE') handler(event.d as AnyRequestData);
            })
        )).registerCommandsIn(path.join(__dirname, 'commands')).syncGlobalCommands();

        creator.syncCommandsIn('452518336627081236', true)

        creator.syncCommandPermissions()
        creator.on('synced', () => {
            Logger.info('Finished syncing Commands!');
        })
        creator.on('debug', (msg) => Logger.debug(`[DEBUG]: ${msg}`));
        creator.on('warn', (msg) => Logger.warn(`[WARN]: ${msg}`));
        creator.on('error', (msg) => Logger.error(`[ERROR]: ${msg}`));
        creator.on('rawREST', (req) => Logger.debug(`data: ${req.method} => ${req.url} `))
        creator.on('rawInteraction', (interaction) => Logger.debug(`RawInteraction: ${interaction.id} | type: ${interaction.type} | ${interaction.token}`))
        creator.on('unknownInteraction', (interaction) => Logger.warn(`Unknown Interaction: ${interaction}`))
        creator.on('commandRun', (cmd, _, ctx) => Logger.info(`${ctx.member!.user.username}#${ctx.member!.user.discriminator} (${ctx.member!.id}) ran command ${cmd.commandName}`));
        creator.on('commandRegister', (cmd) => Logger.debug(`Registered command ${cmd.commandName}`));
        creator.on('commandUnregister', (cmd) => Logger.warn(`Unregistered command ${cmd.commandName}`));
        creator.on('commandReregister', (cmd) => Logger.debug(`Reregistered command ${cmd.commandName}`));
        creator.on('commandError', (cmd, error) => Logger.error(`Command ${cmd.commandName}: ${
            error.stack ? error.message + '\n' + error.stack : error.message 
        }`));
        creator.on('commandBlock', (cmd, ctx, reason) => Logger.warn(`Command ${cmd.commandName} was blocked for ${ctx.member!.user.username}#${ctx.member!.user.discriminator}. Reason: ${reason}`));
    }

    async getMember(guildId: string, userId: string, forceRest = false) {
		if (!this.guilds.has(guildId)) return this.getRESTGuildMember(guildId, userId).catch(() => null);
		else {
			const g = this.guilds.get(guildId)!;
			const cur = g.members.get(userId);
			if (cur && forceRest === false) return cur;
			else {
				const m = await g.getRESTMember(userId).catch(() => null);
				if (m !== null) {
					// if (force && cur) g.members.remove(cur);
					g.members.add(m, g);
					return m;
				} else return null;
			}
		}
	}

    async addGuildUserRole(guildId: string, userId: string, roleId: string) {
        if (this.guilds.get(guildId)?.members.get(userId)?.roles.includes(roleId)) {
            return {
                success: false,
                message: 'User already has role'
            }
        }
        this.addGuildMemberRole(guildId, userId, roleId)
        
        if (this.guilds.get(guildId)?.members.get(userId)?.roles.includes(roleId)) {
            return {
                success: true,
                message: 'Added Role'
            }
        } else {
            return {
                success: false,
                message: 'Failed to add role'
            }
        }
    }

}

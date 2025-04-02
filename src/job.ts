import { App } from 'obsidian';
import CronLockManager from './lockManager';
import IACPlugin from './main';
import SyncChecker from './syncChecker';
import { parseExpression } from 'cron-parser';

export interface JobFunc {(app:App): Promise<void> | void}

export interface JobFrequency {
	hours?: number,
	mins?: number,
	secs?: number,
}

export interface JobSettings {
	enableMobile?: boolean
	disableSyncCheck?: boolean
	disableJobLock?: boolean
}

export default class Job {
	syncChecker: SyncChecker;
	plugin: IACPlugin
	app: App;

	lockManager: CronLockManager;
	settings: JobSettings
	job: JobFunc | string
	name: string
	id: string
	noRunReason: string
	frequency: JobFrequency

	public constructor(id: string, name: string, job: JobFunc | string, frequency: JobFrequency, settings: JobSettings, app: App, plugin: IACPlugin, syncChecker: SyncChecker) {
		this.syncChecker = syncChecker;
		this.plugin = plugin;
		this.app = app;

		this.lockManager = new CronLockManager(id, settings, plugin, syncChecker)
		this.name = name;
		this.id = id;
		this.job = job;
		this.frequency = frequency;
		this.settings = settings;

	}

	public async runJob(): Promise<void> {

		console.log(`Running ${this.name}`);

		await this.lockManager.lockJob()

		typeof this.job == "string" ? await this.runJobCommand() : await this.runJobFunction();

		await this.lockManager.updateLastrun()
		await this.lockManager.unlockJob()
	}

	public canRunJob(): boolean {
		if(this.lockManager.jobLocked() && !this.settings.disableJobLock) {
			this.noRunReason = "job locked"
			return false
		}

		if(this.app.isMobile && !this.settings.enableMobile){
			this.noRunReason = "disabled on mobile"
			return false
		}

		if(!this.jobIntervalPassed()) {
			this.noRunReason = "job interval hasnt passed"
			return false
		}

		return true
	}

	public clearJobLock(): void {
		this.lockManager.clearLock()
	}

	private jobIntervalPassed(): boolean {
		// job never ran
		const lastRun = this.lockManager.lastRun()
		if(!lastRun) return true

		// FIXME: define the intended outcome here better.
		// const prevRun = window.moment(parseExpression(this.frequency).prev().toDate())
		// return prevRun.isAfter(lastRun)
		return false
	}

	private async runJobFunction(): Promise<void> {
		if(typeof this.job !== 'function') { return }

		try {
			await this.job(this.app)
			console.log(`${this.name} completed`)
		} catch (error) {
			console.log(`${this.name} failed to run`)
			console.log(error)
		}
	}

	private async runJobCommand(): Promise<void> {
		if(typeof this.job !== 'string') { return }

		const jobCommand = this.app.commands.commands[this.job];

		if(!jobCommand) {
			console.log(`${this.name} failed to run: Command unknown`)
		}

		await this.app.commands.executeCommand(jobCommand)
	}

}

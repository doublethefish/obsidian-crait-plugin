import { Plugin } from 'obsidian';
import Job, { JobFrequency, JobFunc, JobSettings } from './job';
import { CronLock } from './lockManager';
import CronLockManager from './lockManager';
import CronSettingTab from './settings';
import SyncChecker from './syncChecker';
import InactivityCommandsAPI from './api';

export interface IACSettings {
	runOnStartup: boolean
	enableMobile: boolean
	watchObsidianSync: boolean
	jobs: Array<IACJob>,
	locks: { [key: string]: CronLock }
}

export interface IACJob {
	id: string
	name: string
	job: string
	frequency: {
		hours?: number
		mins?: number
		secs?: number
	}
	settings: JobSettings
}

const DEFAULT_SETTINGS: IACSettings = {
	runOnStartup: true,
	enableMobile: true,
	watchObsidianSync: true,
	jobs: [],
	locks: {}
}

export default class IACPlugin extends Plugin {
	static instance: IACPlugin
	settings: IACSettings;
	syncChecker: SyncChecker
	lockManager: CronLockManager
	jobs: { [key: string]: Job }
	api: InactivityCommandsAPI

	/** Called when the plugin is loaded. */
	async onload() {
		console.log("Loading Obsidian Inactivity Commands!");
		IACPlugin.instance = this;
		await this.loadSettings();

		this.addSettingTab(new CronSettingTab(this.app, this));
		this.syncChecker = new SyncChecker(this.app, this);

		this.jobs = {}

		// load our cronjobs
		this.loadJobs()
		this.api = InactivityCommandsAPI.get(this)
		this.app.workspace.onLayoutReady(() => {
			if(this.settings.runOnStartup) {
				if(this.app.isMobile && !this.settings.enableMobile)
				{ 
					return
				}
				this.runJobs()
			}
		})

		// Configure the timeouts
		this.resetTimeout();
		this.initInactivity();
	}

	public async runJobs() {
		// console.log("Running Obsidian Cron!")
		for (const [, job] of Object.entries(this.jobs)) {
			await this.syncChecker.waitForSync(job.settings)

			// reload the settings incase we've had a new lock come in via sync
			await this.loadSettings()

			if(!job.canRunJob()) {
				// console.log(`Can't run job: ${job.noRunReason}`)
				continue
			}

			await job.runJob()
		}
	}
	
	public initInactivity() {
		// Listen to common user interactions to reset the timer.
		this.registerDomEvent(window, 'mousemove', () => this.resetTimeout());
		this.registerDomEvent(window, 'keydown', () => this.resetTimeout());
		this.registerDomEvent(window, 'mousedown', () => this.resetTimeout());
	}

	public addJob(name: string, frequency: JobFrequency, settings: JobSettings, job: JobFunc) {
		const existingJob = this.getJob(name)
		if(existingJob) throw new Error("Inactivity Commands Job already exists")

		this.jobs[name] = new Job(name, name, job, frequency, settings, this.app, this, this.syncChecker)
	}

	public async runJob(name: string) {
		const job = this.getJob(name)
		if(!job) throw new Error("CRON Job doesn't exist")
		await job.runJob()
	}

	public clearJobLock(name: string) {
		const job = this.getJob(name)
		if(!job) throw new Error("CRON Job doesn't exist")
		job.clearJobLock()
	}

	public getJob(name: string): Job | null {
		for (const [, job] of Object.entries(this.jobs)) {
			if(job.name == name) return job
		}
		return null
	}

	public onunload() {
		if(this.settings.watchObsidianSync)	this.syncChecker.handleUnload()
		console.log("Cron unloaded")
	}

	public loadJobs() {
		this.settings.jobs.forEach(iacJob => {
			if (iacJob.job === "") {
				// empty job, nothing to do.
				return;
			}

			if((iacJob.frequency.hours === undefined) && (iacJob.frequency.mins === undefined) && (iacJob.frequency.secs === undefined)) {
				// no timeout config set
				return;
			}

			this.jobs[iacJob.id] = new Job(iacJob.id, iacJob.name, iacJob.job, iacJob.frequency, iacJob.settings, this.app, this, this.syncChecker)
		});
	}

	private clearTimeout() {
		for (const [, job] of Object.entries(this.jobs)) {
			job.clearTimeout()
		}
	}

	/** Resets the inactivity timer. */
	private resetTimeout() {
		this.clearTimeout();
		if(this.app.isMobile && !this.settings.enableMobile) {
			// we're disabled on mobile, do nothing.
			return;
		}
		for (const [, job] of Object.entries(this.jobs)) {
			job.resetTimeout()
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

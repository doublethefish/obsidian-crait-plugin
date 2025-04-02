import { Plugin } from 'obsidian';
import Job, { JobFrequency, JobFunc, JobSettings } from './job';
import { CronLock } from './lockManager';
import CronLockManager from './lockManager';
import CronSettingTab from './settings';
import SyncChecker from './syncChecker';
import CronAPI from './api';

export interface IACSettings {
	cronInterval: number;
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
	cronInterval: 15,
	runOnStartup: true,
	enableMobile: true,
	watchObsidianSync: true,
	jobs: [],
	locks: {}
}

export default class IACPlugin extends Plugin {
	static instance: IACPlugin
	interval: number;
	settings: IACSettings;
	syncChecker: SyncChecker
	lockManager: CronLockManager
	jobs: { [key: string]: Job }
	api: CronAPI

	async onload() {
		console.log("Loading Obsidian CRON!");
		IACPlugin.instance = this;
		await this.loadSettings();

		this.addSettingTab(new CronSettingTab(this.app, this));
		this.syncChecker = new SyncChecker(this.app, this);

		this.jobs = {}

		// load our cronjobs
		this.loadCrons()
		this.loadInterval()
		this.api = CronAPI.get(this)
		this.app.workspace.onLayoutReady(() => {
			if(this.settings.runOnStartup) {
				if(this.app.isMobile && !this.settings.enableMobile) { return }
				this.runCron()
			}
		})
	}

	public async runCron() {
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

	public loadCrons() {
		this.settings.jobs.forEach(cronjob => {
			if(cronjob.frequency === "" || cronjob.job === "") {
				return;
			}

			this.jobs[cronjob.id] = new Job(cronjob.id, cronjob.name, cronjob.job, cronjob.frequency, cronjob.settings, this.app, this, this.syncChecker)
		});
	}

	public loadInterval() {
		clearInterval(this.interval)
		if(this.app.isMobile && !this.settings.enableMobile) { return }
		this.interval = window.setInterval(async () => { await this.runCron()	}, this.settings.cronInterval * 60 * 1000)
		this.registerInterval(this.interval)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

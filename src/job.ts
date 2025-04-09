import { App, Notice } from "obsidian";
import CronLockManager from "./lockManager";
import CraitPlugin from "./main";
import SyncChecker from "./syncChecker";

export interface JobFunc {
  (app: App): Promise<void> | void;
}

export interface JobFrequency {
  hours?: number;
  mins?: number;
  secs?: number;
}

export interface JobSettings {
  enableMobile?: boolean;
  disableSyncCheck?: boolean;
  disableJobLock?: boolean;
}

export interface CraitJob {
  id: string;
  name: string;
  job: string; // TODO: better support of jobFunc `|JobFunc`
  frequency: {
    hours?: number;
    mins?: number;
    secs?: number;
  };
  settings: JobSettings;
}

export default class Job {
  syncChecker: SyncChecker;
  plugin: CraitPlugin;
  app: App;

  lockManager: CronLockManager;
  settings: JobSettings;
  job: string; // TODO: better support of jobFunc `|JobFunc`
  name: string;
  id: string;
  noRunReason: string;
  frequency: JobFrequency;
  timeoutId: number;

  public constructor(
    craitJob: CraitJob,
    app: App,
    plugin: CraitPlugin,
    syncChecker: SyncChecker
  ) {
    const {
      id,
      name,
      job,
      frequency,
      settings,
    }: {
      id: string;
      name: string;
      job: string;
      frequency: JobFrequency;
      settings: JobSettings;
    } = craitJob;
    this.syncChecker = syncChecker;
    this.plugin = plugin;
    this.app = app;

    this.lockManager = new CronLockManager(id, settings, plugin, syncChecker);
    this.name = name;
    this.id = id;
    this.job = job;
    this.frequency = frequency;
    this.settings = settings;
  }

  /** Removes the timer for this job **/
  public clearTimeout() {
    clearTimeout(this.timeoutId);
  }

  /** Called when Obsidian is restarted.
   *   We check for delta on timer and run the commands if the time has been exceded
   **/
  public onLoad(lastUpdatedMs: number | null) {
    if (lastUpdatedMs == null) {
      return;
    }

    const thresholdMs: number =
      ((this.frequency.hours || 0) * 3600 +
        (this.frequency.mins || 0) * 60 +
        (this.frequency.secs || 0)) *
      1000;

    // Get current time in milliseconds
    const nowMs = Date.now();

    // Check if more than the delta time has elapsed since lastUpdatedMs
    if (nowMs - lastUpdatedMs > thresholdMs) {
      this.runJob();
    }
  }

  /** Resets the timout for this job. */
  public resetTimeout() {
    // console.log(`Resetting timeout ${this.name}`);
    this.clearTimeout();
    // Set inactivity period.
    const hours: number = this.frequency.hours || 0;
    const mins: number = this.frequency.mins || 0;
    const secs: number = this.frequency.secs || 0;
    const timerMs: number = hours * 60 * 60 * 1000 + mins * 60 * 1000 + secs * 1000;
    if (timerMs < 1) {
      // console.log(`Timout is too small: ${this.id}: ${timerMs}`)
      return;
    }
    // console.log(`setting timeout for ${this.name} to ${timerMs}ms`);
    this.timeoutId = window.setTimeout(async () => {
      await this.runJob();
    }, timerMs);
  }

  public async runJob(): Promise<void> {
    new Notice(`Focus timers: Running ${this.name}`);

    await this.lockManager.lockJob();

    /* TODO: better support of jobFunc `|JobFunc`
    typeof this.job == "string" ? await this.runJobCommand() : await this.runJobFunction();
    */
    await this.runJobCommand(); // string version ONLY

    await this.lockManager.updateLastrun();
    await this.lockManager.unlockJob();
  }

  public canRunJob(): boolean {
    if (this.lockManager.jobLocked() && !this.settings.disableJobLock) {
      this.noRunReason = "job locked";
      return false;
    }

    if (this.app.isMobile && !this.settings.enableMobile) {
      this.noRunReason = "disabled on mobile";
      return false;
    }

    return true;
  }

  public clearJobLock(): void {
    this.lockManager.clearLock();
  }

  /* TODO: better support of jobFunc `|JobFunc`
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
  */

  private async runJobCommand(): Promise<void> {
    // console.log(`running: ${this.job}`)
    if (typeof this.job !== "string") {
      return;
    }

    const jobCommand = this.app.commands.commands[this.job];

    if (!jobCommand) {
      console.log(`${this.name} failed to run: Command unknown`);
    }

    await this.app.commands.executeCommand(jobCommand);
  }
}

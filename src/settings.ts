import { App, PluginSettingTab, Setting } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import { CommandSuggest } from './commandSuggest';
import type CraitPlugin from './main';

export default class CronSettingTab extends PluginSettingTab {
	plugin: CraitPlugin;

	constructor(app: App, plugin: CraitPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Inactivity Commands.' });

		// new Setting(containerEl)
		// 	.setName('Cron Interval')
		// 	.setDesc('The interval the cron will run in minutes')
		// 	.addText(text => text
		// 		.setValue(this.plugin.settings.cronInterval.toString())
		// 		.onChange(async (value) => {
		// 			if (value == "") { return }
		// 			this.plugin.settings.cronInterval = parseInt(value);
		// 			await this.plugin.saveSettings();
		// 			this.plugin.loadInterval();
		// 		})
		// 	);

		new Setting(containerEl)
			.setName('Run commands on startup')
			.setDesc('Run all jobs on Obsidian startup instead of waiting for the job intervals to pass')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.runOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.runOnStartup = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Enable Obsidian Sync Checker')
			.setDesc('Whether or not to wait for Obsidian sync before running any jobs globally.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.watchObsidianSync)
				.onChange(async (value) => {
					this.plugin.settings.watchObsidianSync = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Enable Obsidian on Mobile')
			.setDesc('Whether or not to load jobs at all on Mobile devices. If disabled even jobs with mobile enabled will not run.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableMobile)
				.onChange(async (value) => {
					this.plugin.settings.enableMobile = value;
					await this.plugin.saveSettings();
				})
			);

		const desc = document.createDocumentFragment();
		desc.append(
			"List of Jobs to run. TIP: use the `Commander` plugin or similar for complex tasks.",
		);

		new Setting(containerEl)
			.setName("Inactivity Jobs")
			.setDesc(desc)

		this.addCommandSearch()
	}

	addCommandSearch(): void {

		this.plugin.settings.jobs.forEach((craitJob, index) => {
			const jobSetting = new Setting(this.containerEl)
				.addText(text => text
					.setValue(craitJob.name)
					.setPlaceholder("Job name")
					.onChange(async (value) => {
						this.plugin.settings.jobs[index].name = value;
						await this.plugin.saveSettings();
						this.plugin.loadJobs();
					})
					.inputEl.addClass('cron-plugin-text-input')
				)
				.addSearch((cb) => {
					new CommandSuggest(cb.inputEl);
					cb.setPlaceholder("Command")
						.setValue(craitJob.job)
						.onChange(async (command) => {
							if (!command) { return }

							this.plugin.settings.jobs[index].job = command;
							await this.plugin.saveSettings();
							this.plugin.loadJobs();
						})
						.inputEl.addClass('inactivity-commands-job-command')
				})
				.addText(text => text
					.setPlaceholder("hours")
					.setValue(craitJob.frequency.hours?`${craitJob.frequency.hours}`:"")
					.onChange(async (value) => {
						this.plugin.settings.jobs[index].frequency.hours = Number(value);
						await this.plugin.saveSettings();
						this.plugin.loadJobs();
					})
					.inputEl.addClass('inactivity-commands-job-time')
				)
				.addText(text => text
					.setPlaceholder("mins")
					.setValue(craitJob.frequency.mins?`${craitJob.frequency.mins}`:"")
					.onChange(async (value) => {
						this.plugin.settings.jobs[index].frequency.mins = Number(value);
						await this.plugin.saveSettings();
						this.plugin.loadJobs();
					})
					.inputEl.addClass('inactivity-commands-job-time')
				)
				// .addText(text => text
				// 	.setPlaceholder("secs")
				// 	.setValue(craitJob.frequency.secs?`${craitJob.frequency.secs}`:"")
				// 	.onChange(async (value) => {
				// 		this.plugin.settings.jobs[index].frequency.secs = Number(value);
				// 		await this.plugin.saveSettings();
				// 		this.plugin.loadJobs();
				// 	})
				// 	.inputEl.addClass('inactivity-commands-plugin-text-input')
				// )
				.addExtraButton((button) => {
					button.setIcon(craitJob.settings.enableMobile ? "lucide-phone" : "lucide-phone-off")
						.setTooltip("Toggle job on mobile")
						.onClick(async () => {
							this.plugin.settings.jobs[index].settings.enableMobile = !craitJob.settings.enableMobile;
							await this.plugin.saveSettings();
							// refresh
							this.display()
						})
				})

			const jobLocked = this.plugin.settings.locks[craitJob.id] && this.plugin.settings.locks[craitJob.id].locked
			jobSetting.addExtraButton((button) => {
				button.setIcon(jobLocked ? "lucide-lock" : "lucide-unlock")
					.setTooltip("Toggle job lock (clear lock if accidentally left locked)")
					.onClick(() => {
						this.plugin.settings.locks[craitJob.id].locked = !jobLocked;
						this.plugin.saveSettings();
						// refresh
						this.display()
					})
			})

			jobSetting.addExtraButton((button) => {
				button.setIcon(craitJob.settings.disableSyncCheck ? "paused" : "lucide-check-circle-2")
					.setTooltip("Toggle Sync check for this job. Presently: " + (craitJob.settings.disableSyncCheck ? "disabled" : "enabled"))
					.onClick(() => {
						this.plugin.settings.jobs[index].settings.disableSyncCheck = !craitJob.settings.disableSyncCheck;
						this.plugin.saveSettings();
						// Force refresh
						this.display();
					});
			})
				.addExtraButton((button) => {
					button.setIcon("cross")
						.setTooltip("Delete Job")
						.onClick(() => {
							this.plugin.settings.jobs.splice(index, 1)
							delete this.plugin.jobs[craitJob.id]
							delete this.plugin.settings.locks[craitJob.id]
							this.plugin.saveSettings();
							// Force refresh
							this.display();
						});
				});

			jobSetting.controlEl.addClass("inactivity-commands-plugin-job")
		});

		new Setting(this.containerEl).addButton((cb) => {
			cb.setButtonText("Add job")
				.setCta()
				.onClick(() => {
					this.plugin.settings.jobs.push({
						id: uuidv4(),
						name: "",
						job: "",
						frequency: {},
						settings: {
							enableMobile: false
						}
					})
					this.plugin.saveSettings();
					// Force refresh
					this.display();
				});
		});
	}
}

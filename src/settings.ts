import { App, PluginSettingTab, Setting } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import { CommandSuggest } from './commandSuggest';
import type IACPlugin from './main';

export default class CronSettingTab extends PluginSettingTab {
	plugin: IACPlugin;

	constructor(app: App, plugin: IACPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Settings for Cron.' });

		new Setting(containerEl)
			.setName('Cron Interval')
			.setDesc('The interval the cron will run in minutes')
			.addText(text => text
				.setValue(this.plugin.settings.cronInterval.toString())
				.onChange(async (value) => {
					if (value == "") { return }
					this.plugin.settings.cronInterval = parseInt(value);
					await this.plugin.saveSettings();
					this.plugin.loadInterval();
				})
			);

		new Setting(containerEl)
			.setName('Run cron on startup')
			.setDesc('Do a cron run on startup instead of waiting for the first interval to pass')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.runOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.runOnStartup = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Enable Obsidian Sync Checker')
			.setDesc('Whether or not to wait for Obsidian sync before running any CRONs globally.')
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
			"List of CRON Jobs to run. Jobs will not be ran until all 3 fields have been filled",
			desc.createEl("br"),
			"Cron Frequency is a cron schedule expression. Use ",
			desc.createEl("a", {
				href: "https://crontab.guru/",
				text: "crontab guru",
			}),
			" for help with creating cron schedule expressions."
		);

		new Setting(containerEl)
			.setName("Cron Jobs")
			.setDesc(desc)

		this.addCommandSearch()
	}

	addCommandSearch(): void {

		this.plugin.settings.jobs.forEach((iacJob, index) => {
			const jobSetting = new Setting(this.containerEl)
				.addText(text => text
					.setValue(iacJob.name)
					.setPlaceholder("Job name")
					.onChange(async (value) => {
						this.plugin.settings.jobs[index].name = value;
						await this.plugin.saveSettings();
						this.plugin.loadCrons();
					})
					.inputEl.addClass('cron-plugin-text-input')
				)
				.addSearch((cb) => {
					new CommandSuggest(cb.inputEl);
					cb.setPlaceholder("Command")
						.setValue(iacJob.job)
						.onChange(async (command) => {
							if (!command) { return }

							this.plugin.settings.jobs[index].job = command;
							await this.plugin.saveSettings();
							this.plugin.loadCrons();
						})
						.inputEl.addClass('cron-plugin-text-input')
				})
				.addText(text => text
					.setPlaceholder("hours")
					.setValue(iacJob.frequency.hours?`${iacJob.frequency.hours}`:"")
					.onChange(async (value) => {
						this.plugin.settings.jobs[index].frequency.hours = Number(value);
						await this.plugin.saveSettings();
						this.plugin.loadCrons();
					})
					.inputEl.addClass('cron-plugin-text-input')
				)
				.addText(text => text
					.setPlaceholder("mins")
					.setValue(iacJob.frequency.mins?`${iacJob.frequency.mins}`:"")
					.onChange(async (value) => {
						this.plugin.settings.jobs[index].frequency.mins = Number(value);
						await this.plugin.saveSettings();
						this.plugin.loadCrons();
					})
					.inputEl.addClass('cron-plugin-text-input')
				)
				.addText(text => text
					.setPlaceholder("hours")
					.setValue(iacJob.frequency.secs?`${iacJob.frequency.secs}`:"")
					.onChange(async (value) => {
						this.plugin.settings.jobs[index].frequency.secs = Number(value);
						await this.plugin.saveSettings();
						this.plugin.loadCrons();
					})
					.inputEl.addClass('cron-plugin-text-input')
				)
				.addExtraButton((button) => {
					button.setIcon(iacJob.settings.enableMobile ? "lucide-phone" : "lucide-phone-off")
						.setTooltip("Toggle job on mobile")
						.onClick(async () => {
							this.plugin.settings.jobs[index].settings.enableMobile = !iacJob.settings.enableMobile;
							await this.plugin.saveSettings();
							// refresh
							this.display()
						})
				})

			const jobLocked = this.plugin.settings.locks[iacJob.id] && this.plugin.settings.locks[iacJob.id].locked
			jobSetting.addExtraButton((button) => {
				button.setIcon(jobLocked ? "lucide-lock" : "lucide-unlock")
					.setTooltip("Toggle job lock (clear lock if accidentally left locked)")
					.onClick(() => {
						this.plugin.settings.locks[iacJob.id].locked = !jobLocked;
						this.plugin.saveSettings();
						// refresh
						this.display()
					})
			})

			jobSetting.addExtraButton((button) => {
				button.setIcon(iacJob.settings.disableSyncCheck ? "paused" : "lucide-check-circle-2")
					.setTooltip("Toggle Sync check for this job. Presently: " + (iacJob.settings.disableSyncCheck ? "disabled" : "enabled"))
					.onClick(() => {
						this.plugin.settings.jobs[index].settings.disableSyncCheck = !iacJob.settings.disableSyncCheck;
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
							delete this.plugin.jobs[iacJob.id]
							delete this.plugin.settings.locks[iacJob.id]
							this.plugin.saveSettings();
							// Force refresh
							this.display();
						});
				});

			jobSetting.controlEl.addClass("cron-plugin-job")
		});

		new Setting(this.containerEl).addButton((cb) => {
			cb.setButtonText("Add cron job")
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

import { JobFrequency, JobFunc, JobSettings } from "./job";
import CraitPlugin from "./main";

export default class CraitAPI {
  static instance: CraitAPI;

  public static get(plugin: CraitPlugin) {
    return {
      addJob(
        name: string,
        frequency: JobFrequency,
        settings: JobSettings,
        job: JobFunc
      ) {
        return plugin.addJob(name, frequency, settings, job);
      },
      runJob(name: string) {
        return plugin.runJob(name);
      },
      clearJobLock(name: string) {
        return plugin.clearJobLock(name);
      },
      getJob(name: string) {
        return plugin.getJob(name);
      },
    };
  }
}

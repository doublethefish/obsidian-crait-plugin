import CraitPlugin from "./main";

export default class CraitAPI {
  static instance: CraitAPI;

  public static get(plugin: CraitPlugin) {
    return {
      // TODO: reintroduce: addJob(
      // TODO: reintroduce:   name: string,
      // TODO: reintroduce:   frequency: JobFrequency,
      // TODO: reintroduce:   settings: JobSettings,
      // TODO: reintroduce:   job: JobFunc
      // TODO: reintroduce: ) {
      // TODO: reintroduce:   return plugin.addJob(name, frequency, settings, job);
      // TODO: reintroduce: },
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

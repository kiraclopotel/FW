// FeelingWise - Cloud provider base interface
// All cloud providers implement: send(system, user) -> Promise<string>

export interface CloudProvider {
  name: string;
  send(system: string, user: string): Promise<string>;
}

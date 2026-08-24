import {store, emit, persist} from "./store.js";
import {sanitizeModuleParameters} from "../module-engine.js";
import {findBot} from "./productCatalog.js";
import {enrichProduct} from "./economics.js";
import {runModule} from "../modules/moduleRunner.js";
import {runProductLaunchWorkflow} from "./workflowEngine.js";
import {runCommerceCycle} from "./automationCycle.js";

export async function executeMasterCommand(command = {}) {
  const action = String(command.action || "");
  const moduleId = String(command.moduleId || command.botId || "");
  let result;
  if (action === "set_parameters") {
    if (!store.moduleConfigs[moduleId]) throw new Error("MODULE_NOT_FOUND");
    store.moduleConfigs[moduleId] = sanitizeModuleParameters(moduleId, {...store.moduleConfigs[moduleId], ...(command.parameters || {})});
    store.products.forEach(enrichProduct);
    result = {moduleId, parameters: store.moduleConfigs[moduleId], applied: true, mode: "PAPER"};
  } else if (action === "toggle_bot") {
    const bot = findBot(moduleId); if (!bot) throw new Error("BOT_NOT_FOUND");
    if (typeof command.active === "boolean") bot.active = command.active; else bot.active = !bot.active;
    bot.enabled = bot.active; bot.status = bot.active ? "STANDBY" : "PAUSED";
    result = {botId: bot.id, active: bot.active};
  } else if (action === "run_module") {
    const {result: moduleResult} = await runModule(moduleId, command.input || {}, {trigger: "master_command"});
    result = moduleResult;
  } else if (action === "run_workflow") {
    result = await runProductLaunchWorkflow(command.input || {});
  } else if (action === "run_cycle") {
    result = await runCommerceCycle({reason: "brain-master", ...(command.input || {})});
  } else throw new Error("MASTER_ACTION_NOT_ALLOWED");
  store.masterControl.lastCommandAt = new Date().toISOString();
  store.masterControl.lastCommand = {action, moduleId, mode: "PAPER"};
  emit("commerce_master_command_completed", {action, moduleId, result: {status: result?.status || "COMPLETED"}, mode: "PAPER"}, .85);
  persist();
  return result;
}

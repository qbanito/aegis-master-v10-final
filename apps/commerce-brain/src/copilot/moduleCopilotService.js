import {store, persist} from "../core/store.js";
import {moduleReadiness} from "../core/readiness.js";
import {listRuns} from "../core/runRegistry.js";
import {getModuleMode, permissionMatrixFor} from "../core/modeControl.js";
import {completeCopilotChat} from "./providerAdapter.js";

export function copilotContext(moduleId) {
  const bot = store.commerceBots.find(item => item.id === moduleId);
  const readiness = moduleReadiness(moduleId);
  const recentRuns = listRuns(moduleId, {limit: 5});
  const mode = getModuleMode(moduleId);
  return {
    moduleId, botName: bot?.name || moduleId,
    readiness, lastRun: readiness.lastRun,
    recentRuns: recentRuns.map(run => ({id: run.id, status: run.status, newSignal: run.newSignal, finishedAt: run.finishedAt, summary: run.summary})),
    mode, permissions: permissionMatrixFor(moduleId),
    policy: store.moduleConfigs[moduleId] || {}
  };
}

export async function chatWithModuleCopilot(moduleId, message, conversation) {
  const context = copilotContext(moduleId);
  const response = await completeCopilotChat(message, context, conversation);
  const session = store.copilotSessions[moduleId] || (store.copilotSessions[moduleId] = {messages: []});
  session.messages = [...session.messages, {role: "user", content: message, at: new Date().toISOString()}, {role: "assistant", content: response.reply, at: new Date().toISOString()}].slice(-24);
  persist();
  return {...response, context: {readiness: context.readiness.state, actionStage: context.mode.actionStage}};
}

export function copilotSnapshot(moduleId) {
  const context = copilotContext(moduleId);
  const session = store.copilotSessions[moduleId] || {messages: []};
  return {
    moduleId,
    status: {provider: process.env.OPENAI_API_KEY ? "openai" : "local_fallback", configured: Boolean(process.env.OPENAI_API_KEY)},
    readiness: context.readiness, lastRun: context.lastRun, recentEvidence: context.recentRuns,
    activePolicy: context.policy, permissions: context.permissions, mode: context.mode,
    history: session.messages.slice(-12), pendingProposals: []
  };
}

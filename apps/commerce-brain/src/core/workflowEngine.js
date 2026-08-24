import crypto from "node:crypto";
import {store, emit, persist} from "./store.js";
import {PAPER_MODE} from "./config.js";
import {findProduct, activeWorkflowForProduct} from "./productCatalog.js";
import {enrichProduct} from "./economics.js";
import {productCompliance} from "./compliance.js";
import {discoverProducts} from "./discovery.js";
import {mediaAsset} from "../connectors/mediaConnector.js";
import {connector} from "../connectors/connectorRegistry.js";
import {landingFor} from "../modules/creativeFactory.js";
import {campaignFor} from "../modules/traffic.js";

export function workflowStep(workflow, stage, status = "COMPLETED", details = {}) {
  const entry = {stage, status, at: new Date().toISOString(), details};
  workflow.stage = stage;
  workflow.stages[stage] = entry;
  workflow.history.unshift(entry);
  workflow.updatedAt = entry.at;
  emit("commerce_workflow_stage", {workflowId: workflow.id, productId: workflow.productId, stage, status, details}, .7);
  return entry;
}

export async function runProductLaunchWorkflow(input = {}) {
  let product = findProduct(input.productId);
  if (!product) {
    const discovery = await discoverProducts(input.sources || ["amazon", "aliexpress"]);
    product = store.products.filter(item => item.score !== undefined).sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
    if (!product) throw new Error(`PRODUCT_NOT_FOUND_AFTER_DISCOVERY_${discovery.discovered}`);
  }
  const existing = input.idempotencyKey ? store.workflows.find(item => item.idempotencyKey === input.idempotencyKey) : (!input.force ? activeWorkflowForProduct(product.id) : null);
  if (existing) return existing;
  enrichProduct(product);
  const workflow = {
    id: crypto.randomUUID(), type: "PRODUCT_LAUNCH", mode: PAPER_MODE ? "PAPER" : "LIVE_LOCKED", paperOnly: PAPER_MODE,
    idempotencyKey: input.idempotencyKey || `product-launch:${product.id}:${input.experimentId || "default"}`,
    productId: product.id, product: {id: product.id, name: product.name, source: product.source, sourceStatus: product.sourceStatus, monetizationModel: product.monetizationModel || "PHYSICAL_PRODUCT"},
    status: "RUNNING", stage: "DISCOVERED", stages: {}, history: [], blockers: [], warnings: [], approvals: [], artifacts: {}, metrics: {},
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  store.workflows.unshift(workflow); persist();
  workflowStep(workflow, "DISCOVERED", "COMPLETED", {source: product.source, sourceStatus: product.sourceStatus});
  workflowStep(workflow, "ENRICHED", "COMPLETED", {fields: ["price", "rating", "demandScore", "economics"]});
  workflow.artifacts.product = {id: product.id, name: product.name, source: product.source, sourceStatus: product.sourceStatus, monetizationModel: product.monetizationModel || "PHYSICAL_PRODUCT", providerUrl: product.providerUrl || null, affiliateUrl: product.affiliateUrl || null};
  workflowStep(workflow, "SCORED", "COMPLETED", {score: product.score, tier: product.tier, economics: product.economics});
  const compliance = productCompliance(product);
  workflow.compliance = compliance; workflow.blockers.push(...compliance.blockers); workflow.warnings.push(...compliance.warnings);
  workflowStep(workflow, "COMPLIANCE_REVIEW", compliance.blockers.length ? "REVIEW_REQUIRED" : "COMPLETED", compliance);
  workflow.artifacts.offer = {pricing: product.economics, createdAt: new Date().toISOString()};
  workflowStep(workflow, "OFFER_READY", product.economics?.contribution > 0 ? "COMPLETED" : "REVIEW_REQUIRED", {economics: product.economics});
  const shouldGenerateAssets = input.generateAssets === true || String(input.assetMode || "").toLowerCase() === "remote";
  const asset = shouldGenerateAssets ? await mediaAsset(`Hero product image for ${product.name}, category ${product.category}, premium ecommerce studio lighting, clean background, conversion-focused composition.`) : {mode: "brief", status: "NOT_REQUESTED", prompt: `Product launch asset package for ${product.name}`};
  const landing = landingFor(product, asset); landing.workflowId = workflow.id; store.landingPages.unshift(landing); workflow.artifacts.landingPage = {id: landing.id, status: landing.status, assetStatus: asset.status};
  if (asset.status === "DEGRADED") workflow.warnings.push("creative_provider_degraded");
  workflowStep(workflow, "CREATIVE_READY", asset.status === "DEGRADED" ? "REVIEW_REQUIRED" : "COMPLETED", {landingId: landing.id, asset});
  if (product.monetizationModel === "AMAZON_AFFILIATE") {
    workflow.artifacts.storeDraft = {status: "NOT_APPLICABLE", reason: "AMAZON_AFFILIATE_CONTENT_NOT_INVENTORY", shopify: connector("shopify")};
    workflowStep(workflow, "STORE_DRAFT_READY", "SKIPPED", {reason: "Amazon Affiliate uses editorial clickout; no Shopify inventory draft created."});
  } else {
    const storeDraft = {id: crypto.randomUUID(), workflowId: workflow.id, productId: product.id, status: "DRAFT_ONLY", paper: true, connector: connector("shopify"), product: {title: product.name, price: product.economics?.price || product.price, description: `Draft listing for ${product.name}`, imageUrl: product.imageUrl || null}, createdAt: new Date().toISOString()};
    store.storeDrafts.unshift(storeDraft); workflow.artifacts.storeDraft = {id: storeDraft.id, status: storeDraft.status};
    workflowStep(workflow, "STORE_DRAFT_READY", "COMPLETED", {draftId: storeDraft.id, shopify: storeDraft.connector});
  }
  const campaign = campaignFor(product, input); campaign.workflowId = workflow.id; store.campaigns.unshift(campaign); workflow.artifacts.campaign = {id: campaign.id, status: campaign.status, blockers: campaign.blockers};
  workflowStep(workflow, "CAMPAIGN_READY", campaign.blockers.length ? "REVIEW_REQUIRED" : "COMPLETED", {campaignId: campaign.id, blockers: campaign.blockers});
  const finalBlockers = [...new Set([...workflow.blockers, ...(product.tier === "TEST_READY" ? [] : ["product_not_test_ready"]), ...(campaign.blockers || [])])];
  workflow.blockers = finalBlockers;
  workflow.status = finalBlockers.length ? "REVIEW_REQUIRED" : "READY_FOR_PAPER_TEST";
  workflowStep(workflow, workflow.status, finalBlockers.length ? "REVIEW_REQUIRED" : "COMPLETED", {blockers: finalBlockers, paperOnly: true, publishAllowed: false, adSpendAllowed: false});
  workflow.metrics = {score: product.score, tier: product.tier, contribution: product.economics?.contribution || 0, marginPct: product.economics?.marginPct || 0};
  emit("commerce_product_launch_workflow_completed", {workflowId: workflow.id, productId: product.id, status: workflow.status, blockers: finalBlockers}, .85);
  persist(); return workflow;
}

export function approveWorkflow(workflow, input = {}) {
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
  if (workflow.status === "REJECTED") throw new Error("WORKFLOW_REJECTED");
  if (!PAPER_MODE) throw new Error("LIVE_WORKFLOW_APPROVAL_LOCKED");
  if (workflow.product?.sourceStatus === "PAPER_SAMPLE" && input.allowPaperSample !== true) throw new Error("PAPER_SAMPLE_APPROVAL_REQUIRED");
  const hardBlockers = workflow.blockers.filter(item => !["provider_data_required", "product_not_test_ready", "fulfillment_source_unverified"].includes(item));
  if (hardBlockers.length) throw new Error(`WORKFLOW_HARD_BLOCKERS:${hardBlockers.join(",")}`);
  workflow.approvals.unshift({id: crypto.randomUUID(), actor: input.actor || "operator", at: new Date().toISOString(), paperOnly: true});
  workflow.status = "READY_FOR_PAPER_TEST"; workflow.blockers = workflow.blockers.filter(item => ["provider_data_required", "product_not_test_ready", "fulfillment_source_unverified"].includes(item));
  workflowStep(workflow, "READY_FOR_PAPER_TEST", "COMPLETED", {manualApproval: true, paperOnly: true, publishAllowed: false, adSpendAllowed: false});
  emit("commerce_product_launch_approved", {workflowId: workflow.id, productId: workflow.productId, paperOnly: true}, .8); persist(); return workflow;
}

export function rejectWorkflow(workflow, input = {}) {
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
  workflow.status = "REJECTED";
  workflow.rejection = {reason: String(input?.reason || "operator_rejected"), actor: input?.actor || "operator", at: new Date().toISOString()};
  workflowStep(workflow, "REJECTED", "COMPLETED", workflow.rejection);
  emit("commerce_product_launch_rejected", {workflowId: workflow.id, productId: workflow.productId, reason: workflow.rejection.reason}, .8);
  persist();
  return workflow;
}

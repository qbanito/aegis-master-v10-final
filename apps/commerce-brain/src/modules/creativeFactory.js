import crypto from "node:crypto";
import {store, emit} from "../core/store.js";
import {findProduct, escapeHtml} from "../core/productCatalog.js";
import {mediaAsset} from "../connectors/mediaConnector.js";
import {connector} from "../connectors/connectorRegistry.js";

// Shared with core/workflowEngine.js (product-launch workflow) and the /api/products/:id/landing route.
export function landingFor(product, asset) {
  const price = Number(product.price || 0);
  const offerPrice = Number((price * 1.89).toFixed(2));
  const safeName = escapeHtml(product.name);
  const safeCategory = escapeHtml(product.category || "tu rutina");
  if (product.monetizationModel === "AMAZON_AFFILIATE") {
    const affiliateUrl = escapeHtml(product.affiliateUrl || product.providerUrl || "#");
    const priceLabel = price > 0 ? `$${price.toFixed(2)} ${escapeHtml(product.currency || "USD")}` : "ver precio actual";
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName}</title></head><body><main><section class="hero"><h1>${safeName}</h1><p>Selección editorial para ${safeCategory}, basada en datos observados de Amazon.</p><a href="${affiliateUrl}" target="_blank" rel="nofollow sponsored noopener">Ver disponibilidad y precio en Amazon · ${priceLabel}</a></section><section><h2>Por qué está en la selección</h2><ul><li>Ficha y atributos obtenidos mediante Amazon Creators API.</li><li>Precio y disponibilidad pueden cambiar; compruébalos en Amazon.</li><li>Contenido editorial separado de cualquier inventario de Shopify.</li></ul></section><section id="disclosure"><p>Como asociado de Amazon, podemos obtener ingresos por compras que cumplan los requisitos aplicables.</p></section></main></body></html>`;
    return {id: crypto.randomUUID(), productId: product.id, status: "DRAFT", createdAt: new Date().toISOString(), paper: true, monetizationModel: "AMAZON_AFFILIATE", headline: `${product.name}: selección editorial`, subheadline: `Descubre sus características y consulta el precio actual directamente en Amazon.`, offer: {observedPrice: price, currency: product.currency || "USD", affiliateUrl: product.affiliateUrl || product.providerUrl || null, planningOnly: true}, sections: ["Contexto y selección", "Características verificadas", "Precio y disponibilidad", "Disclosure de afiliación", "CTA a Amazon"], copy: ["Precio y disponibilidad sujetos a cambios.", "Consulta la ficha actual antes de comprar."], html, asset, affiliate: {status: product.affiliateUrl ? "READY_FOR_REVIEW" : "BLOCKED", disclosureRequired: true, shopify: "NOT_APPLICABLE"}, shopify: {status: "NOT_APPLICABLE", reason: "AMAZON_AFFILIATE_CONTENT_NOT_INVENTORY"}};
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName}</title></head><body><main><section class="hero"><h1>${safeName}: una mejora simple para tu día</h1><p>Diseñado para ${safeCategory}, con una oferta clara y una experiencia de compra sin fricción.</p><a href="#offer">Shop now · $${offerPrice.toFixed(2)}</a></section><section><h2>Why customers choose it</h2><ul><li>Resuelve el problema sin complicar tu rutina.</li><li>Materiales y uso explicados con claridad.</li><li>Compra segura, soporte y política de devolución visible.</li></ul></section><section id="offer"><h2>Oferta de lanzamiento</h2><strong>$${offerPrice.toFixed(2)}</strong><p>Draft generated in PAPER mode. Review before publishing.</p></section></main></body></html>`;
  return {
    id: crypto.randomUUID(), productId: product.id, status: "DRAFT", createdAt: new Date().toISOString(), paper: true,
    headline: `${product.name}: una mejora simple para tu día`,
    subheadline: `Diseñado para ${product.category || "tu rutina"}, con una oferta clara y una experiencia de compra sin fricción.`,
    offer: {price: offerPrice, compareAt: Number((offerPrice * 1.28).toFixed(2)), currency: "USD", marginBeforeAds: Number((offerPrice - Number(product.estimatedCost || price * .36)).toFixed(2))},
    sections: ["Problema y transformación", "Beneficios principales", "Prueba social y confianza", "Oferta limitada", "Preguntas frecuentes", "CTA de compra"],
    copy: ["Resuelve el problema sin complicar tu rutina.", "Materiales y uso explicados con claridad.", "Compra segura, soporte y política de devolución visible."], html,
    asset,
    shopify: {status: "NOT_PUBLISHED", connector: connector("shopify")}
  };
}

export async function run(input = {}) {
  const product = findProduct(input.productId) || store.products.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  if (!product) return {status: "BLOCKED", mode: "PAPER", blockers: ["NO_PRODUCT_FOR_CREATIVE"]};
  const channels = Array.isArray(input.channels) && input.channels.length ? input.channels.slice(0, 8) : store.moduleConfigs["creative-factory"].channels;
  const asset = input.generateAssets === true ? await mediaAsset(`Conversion-safe creative package for ${product.name}, category ${product.category}, channels ${channels.join(", ")}, no unsupported claims.`) : {mode: "brief", status: "NOT_REQUESTED", prompt: `Creative package for ${product.name}`};
  const landing = landingFor(product, asset);
  landing.createdBy = "creative-factory";
  landing.channels = channels;
  store.landingPages.unshift(landing);
  const result = {status: asset.status === "DEGRADED" ? "REVIEW_REQUIRED" : "READY", mode: "PAPER", productId: product.id, channels, landingId: landing.id, assetStatus: asset.status, disclosureRequired: product.monetizationModel === "AMAZON_AFFILIATE"};
  emit("commerce_creative_factory_completed", result, .7);
  return result;
}

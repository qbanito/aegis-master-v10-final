import {Actor, log} from "apify";
import {marketplaceRegion, normalizeAmazonItem} from "./scoring.js";

const MARKETPLACE_BY_REGION = {
  NA: {v2: "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token", v3: "https://api.amazon.com/auth/o2/token"},
  EU: {v2: "https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token", v3: "https://api.amazon.co.uk/auth/o2/token"},
  FE: {v2: "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token", v3: "https://api.amazon.co.jp/auth/o2/token"}
};
const API_BASE = "https://creatorsapi.amazon";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cleanList = value => (Array.isArray(value) ? value : String(value || "").split(",")).map(item => String(item).trim()).filter(Boolean).slice(0, 25);

function credentials(input) {
  return {
    clientId: input.clientId || process.env.AMAZON_CREATORS_CLIENT_ID || "",
    clientSecret: input.clientSecret || process.env.AMAZON_CREATORS_CLIENT_SECRET || "",
    partnerTag: input.partnerTag || process.env.AMAZON_PARTNER_TAG || "",
    credentialVersion: input.credentialVersion || process.env.AMAZON_CREATORS_CREDENTIAL_VERSION || "3.1"
  };
}

async function getAccessToken(creds, marketplace) {
  const region = marketplaceRegion(marketplace);
  const version = String(creds.credentialVersion);
  const isV2 = version.startsWith("2.");
  const endpoint = MARKETPLACE_BY_REGION[region][isV2 ? "v2" : "v3"];
  const headers = {"content-type": isV2 ? "application/x-www-form-urlencoded" : "application/json", accept: "application/json"};
  const body = isV2
    ? new URLSearchParams({grant_type: "client_credentials", client_id: creds.clientId, client_secret: creds.clientSecret, scope: "creatorsapi/default"}).toString()
    : JSON.stringify({grant_type: "client_credentials", client_id: creds.clientId, client_secret: creds.clientSecret, scope: "creatorsapi::default"});
  const response = await fetch(endpoint, {method: "POST", headers, body, signal: AbortSignal.timeout(15000)});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(`AMAZON_CREATORS_TOKEN_${response.status}`);
  return {token: payload.access_token, credentialVersion: version};
}

async function searchItems({token, credentialVersion}, input, keyword, page) {
  const marketplace = input.marketplace || "www.amazon.com";
  const resources = ["images.primary.large", "images.primary.medium", "itemInfo.title", "itemInfo.byLineInfo", "itemInfo.classifications", "itemInfo.features", "offersV2.listings.price", "offersV2.listings.availability", "parentASIN"];
  const body = {
    keywords: keyword,
    searchIndex: input.searchIndex || "All",
    itemCount: Math.min(10, Math.max(1, Number(input.maxItemsPerKeyword || 10))),
    itemPage: page,
    marketplace,
    partnerTag: credentials(input).partnerTag,
    partnerType: "Associates",
    resources
  };
  if (Number(input.minPrice) > 0) body.minPrice = Math.round(Number(input.minPrice) * 100);
  if (Number(input.maxPrice) > 0) body.maxPrice = Math.round(Number(input.maxPrice) * 100);
  const headers = {authorization: `Bearer ${token}${String(credentialVersion).startsWith("2.") ? `, Version ${credentialVersion}` : ""}`, "content-type": "application/json", "x-marketplace": marketplace, accept: "application/json"};
  const response = await fetch(`${API_BASE}/catalog/v1/searchItems`, {method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000)});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`AMAZON_CREATORS_SEARCH_${response.status}`);
  return payload?.searchResult?.items || [];
}

async function run(input) {
  const startedAt = new Date().toISOString();
  const marketplace = input.marketplace || "www.amazon.com";
  const keywords = cleanList(input.keywords || ["home organization", "travel gadgets", "wellness accessories"]);
  const creds = credentials(input);
  const summary = {recordType: "run_status", status: "READY", source: "amazon", monetizationModel: "AMAZON_AFFILIATE", marketplace, keywords, startedAt, products: 0, requests: 0, errors: [], blocked: []};
  if (!creds.clientId || !creds.clientSecret || !creds.partnerTag) {
    summary.status = "BLOCKED";
    summary.blocked.push("AMAZON_CREATORS_CREDENTIALS_MISSING");
    summary.message = "Configure Creators API client ID, client secret and Associates partner tag. No synthetic products are emitted.";
    await Actor.pushData(summary);
    await Actor.setValue("RUN_SUMMARY", summary);
    return summary;
  }
  let access;
  try { access = await getAccessToken(creds, marketplace); } catch (error) {
    summary.status = "DEGRADED";summary.errors.push(error.message);await Actor.pushData(summary);await Actor.setValue("RUN_SUMMARY", summary);return summary;
  }
  const seen = new Set();
  const maxRequests = Math.min(50, Math.max(1, Number(input.maxRequests || 10)));
  const pages = Math.min(10, Math.max(1, Number(input.maxPagesPerKeyword || 1)));
  outer: for (const keyword of keywords) {
    for (let page = 1; page <= pages; page += 1) {
      if (summary.requests >= maxRequests) break outer;
      try {
        summary.requests += 1;
        const items = await searchItems(access, input, keyword, page);
        for (const item of items) {
          const product = normalizeAmazonItem(item, {marketplace, partnerTag: creds.partnerTag, input});
          if (!product.asin || seen.has(product.asin)) continue;
          seen.add(product.asin);product.keyword = keyword;product.dataPolicy = "affiliate_content_only";product.refreshRequiredBeforePublish = true;
          await Actor.pushData(product);summary.products += 1;
        }
        await sleep(Math.max(100, Number(input.requestDelayMs || 300)));
      } catch (error) {
        summary.status = "DEGRADED";summary.errors.push(`${keyword}:${error.message}`);log.warning(`Search failed for ${keyword}: ${error.message}`);
      }
    }
  }
  if (!summary.products && !summary.errors.length) {summary.status = "NO_RESULTS";summary.blocked.push("NO_AMAZON_ITEMS_RETURNED");}
  summary.finishedAt = new Date().toISOString();
  await Actor.pushData(summary);await Actor.setValue("RUN_SUMMARY", summary);return summary;
}

await Actor.init();
try {
  const storedInput = await Actor.getInput();
  const localInput = process.env.ACTOR_INPUT_JSON ? JSON.parse(process.env.ACTOR_INPUT_JSON) : {};
  await run({...localInput, ...(storedInput || {})});
} catch (error) {
  log.exception(error, "Amazon Affiliate Product Scout failed");
  await Actor.pushData({recordType: "run_status", status: "FAILED", error: error.message, source: "amazon", monetizationModel: "AMAZON_AFFILIATE"});
  process.exitCode = 1;
} finally {
  await Actor.exit();
}

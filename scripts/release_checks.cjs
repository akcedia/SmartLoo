"use strict";

const REQUIRED = Object.freeze([
  "IBB source import checks", "Account deletion live integration", "AI Redis component checks",
  "SmartLoo review checks", "AI summary HTTP integration", "Free cloud image checks",
  "Admin panel live integration", "Admin import live integration", "Map review live integration",
]);

function validateSha(sha) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("A full lowercase commit SHA is required");
}

function verifyWorkflows(runs, sha) {
  validateSha(sha);
  return REQUIRED.map((name) => {
    const newest = runs.filter((run) => run.name === name && run.head_sha === sha &&
      run.head_branch === "main" && run.event === "push")
      .sort((a, b) => b.id - a.id)[0];
    if (!newest || newest.status !== "completed" || newest.conclusion !== "success") {
      throw new Error(`Required main workflow is not successful: ${name}`);
    }
    return { name, id: newest.id, url: newest.html_url };
  });
}

function deployHookUrl(raw, sha) {
  validateSha(sha);
  let url;
  try { url = new URL(raw); } catch { throw new Error("Missing or invalid Render deploy hook secret"); }
  if (url.protocol !== "https:" || url.hostname !== "api.render.com" || url.port ||
      url.username || url.password || url.hash ||
      url.pathname !== "/deploy/srv-dc1je3p42hec73ahcqj0" || !url.searchParams.get("key")) {
    throw new Error("Deploy hook must target the existing SmartLoo Render service");
  }
  url.searchParams.set("ref", sha);
  return url.href;
}

function isLiveRevision(health, sha) {
  validateSha(sha);
  return health?.status === "ok" && health?.revision === sha;
}

module.exports = { REQUIRED, verifyWorkflows, deployHookUrl, isLiveRevision };

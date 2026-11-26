const test = require("node:test");
const assert = require("node:assert/strict");
const { REQUIRED, verifyWorkflows, deployHookUrl, isLiveRevision } = require("../scripts/release_checks.cjs");
const sha = "a".repeat(40);
test("every required workflow actually runs on pushes to main", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const directory = path.join(__dirname, "../.github/workflows");
  for (const name of REQUIRED) {
    const source = fs.readdirSync(directory).filter(file => /\.ya?ml$/.test(file))
      .map(file => fs.readFileSync(path.join(directory, file), "utf8"))
      .find(text => text.split(/\r?\n/)[0] === `name: ${name}`);
    assert.ok(source, `Workflow exists: ${name}`);
    assert.match(source, /\n  push:\r?\n    branches: \[[^\]\r\n]*\bmain\b[^\]\r\n]*\]/,
      `Exact-main deployment evidence must be generated: ${name}`);
  }
});
const runs = () => REQUIRED.map((name, id) => ({ name, id, head_sha: sha, head_branch: "main",
  event: "push", status: "completed", conclusion: "success" }));

test("requires all nine successful main workflows for this exact SHA", () => {
  assert.equal(verifyWorkflows(runs(), sha).length, 9);
});
for (const [label, change] of [
  ["missing", (rows) => rows.pop()],
  ["old SHA", (rows) => { rows[0].head_sha = "b".repeat(40); }],
  ["PR result", (rows) => { rows[0].event = "pull_request"; }],
  ["pending", (rows) => { rows[0].status = "in_progress"; }],
  ["failed", (rows) => { rows[0].conclusion = "failure"; }],
]) test(`rejects ${label} evidence before deployment`, () => {
  const rows = runs(); change(rows); assert.throws(() => verifyWorkflows(rows, sha));
});
test("a newer failed attempt cannot hide behind older success", () => {
  const rows = runs(); rows.push({ ...rows[0], id: 100, conclusion: "failure" });
  assert.throws(() => verifyWorkflows(rows, sha));
});
test("pins the existing service hook to the selected SHA", () => {
  const url = new URL(deployHookUrl("https://api.render.com/deploy/srv-dc1je3p42hec73ahcqj0?key=synthetic-only", sha));
  assert.equal(url.searchParams.get("ref"), sha);
});
for (const raw of ["", "https://example.com/deploy?key=synthetic-only",
  "https://api.render.com/deploy/srv-other?key=synthetic-only",
  "https://api.render.com/deploy/srv-dc1je3p42hec73ahcqj0"]) {
  test("rejects an absent or wrong-service hook without disclosing it", () => {
    assert.throws(() => deployHookUrl(raw, sha));
  });
}
test("HTTP 200 from the previous release is not proof of deployment", () => {
  assert.equal(isLiveRevision({ status: "ok" }, sha), false);
  assert.equal(isLiveRevision({ status: "ok", revision: "b".repeat(40) }, sha), false);
  assert.equal(isLiveRevision({ status: "ok", revision: sha }, sha), true);
});

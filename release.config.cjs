// semantic-release configuration (CommonJS — the repo root is "type": "module").
// Runs on push to main via .github/workflows/release.yml.
// Version source of truth: git tags + GitHub Releases (package.json/CHANGELOG are synced when
// the protected-branch ruleset / RELEASE_PAT allows @semantic-release/git to push back to main).
module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    ["@semantic-release/npm", { npmPublish: false }],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    "@semantic-release/github",
  ],
};

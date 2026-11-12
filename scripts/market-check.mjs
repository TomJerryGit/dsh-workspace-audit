/** Public market metrics for dsh-workspace-audit. No plugin telemetry. */
const packageName = '@tomjerrygit/dsh-workspace-audit';
const repo = 'TomJerryGit/dsh-workspace-audit';
const hubIssue = 751;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'workspace-audit-market-check' };
if (token) headers.authorization = 'Bearer ' + token;
const get = async (url) => {
  const response = await fetch(url, { headers });
  if (!response.ok) return { error: response.status, url };
  return response.json();
};
const npm = await get('https://registry.npmjs.org/' + encodeURIComponent(packageName).replace('%40', '@'));
const downloads = await get('https://api.npmjs.org/downloads/point/last-week/' + encodeURIComponent(packageName));
const github = await get('https://api.github.com/repos/' + repo);
const release = await get('https://api.github.com/repos/' + repo + '/releases/latest');
const hub = await get('https://api.github.com/repos/dshplugin/dsh-plugin-hub/issues/' + hubIssue);
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  npm: npm.error ? { error: npm.error } : { latest: npm['dist-tags'] && npm['dist-tags'].latest },
  downloads: downloads.error ? { error: downloads.error } : { lastWeek: downloads.downloads },
  github: github.error ? { error: github.error } : { stars: github.stargazers_count, forks: github.forks_count, openItems: github.open_issues_count, pushedAt: github.pushed_at },
  release: release.error ? { error: release.error } : { tag: release.tag_name, publishedAt: release.published_at },
  hub: hub.error ? { error: hub.error } : { state: hub.state, comments: hub.comments },
}, null, 2));

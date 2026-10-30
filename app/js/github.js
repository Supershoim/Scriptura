// Reading and writing project files through the GitHub API, with the credentials of the lock (lock.js).
// Every save is a commit on main; the Pages workflow then rebuilds the site and refuses to publish a build
// with problems (the previous version stays online).
import { github } from './lock.js';

export const BRANCH = 'main';
export const GH_ERRORS = { 401: 'tokenul nu este valid sau a expirat', 403: 'tokenul nu are dreptul de scriere în acest depozit', 404: 'depozitul nu există sau tokenul nu are acces la el', 409: 'fișierul s-a schimbat între timp', 422: 'GitHub a refuzat modificarea' };
const fail = r => new Error('GitHub: ' + (GH_ERRORS[r.status] || r.status));

export const toBase64 = text => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
export const fromBase64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

export async function gh(path, init = {}) {
  const { repo, token } = github();
  return fetch(`https://api.github.com/repos/${repo}/${path}`, {
    cache: 'no-store', ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
  });
}

// A file as it is now on main: { text, sha }, or null when it does not exist.
export async function readFile(path, ref = BRANCH) {
  const r = await gh(`contents/${path}?ref=${ref}`);
  if (r.status === 404) {
    // 404 also means "no access": the repository itself must be readable.
    if ((await gh('')).ok) return null;
  }
  if (!r.ok) throw fail(r);
  const file = await r.json();
  return { text: fromBase64(file.content), sha: file.sha };
}

// Writes one file: edit(text or null) -> new text. A save from another device in between is redone once.
export async function writeFile(path, edit, message) {
  for (let attempt = 0; ; attempt++) {
    const old = await readFile(path), text = edit(old?.text ?? null);
    const r = await gh(`contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: toBase64(text), branch: BRANCH, ...old && { sha: old.sha } }) });
    if (r.ok) return { text, commit: (await r.json()).commit.sha };
    if (r.status !== 409 || attempt) throw fail(r);
  }
}

// Several files in one commit (Git Data API). files(read) -> [{ path, text }], where read(path) gives a file's
// text at the commit being built on (null if missing). A push from another device in between is retried once.
export async function commitFiles(files, message) {
  for (let attempt = 0; ; attempt++) {
    let r = await gh(`git/ref/heads/${BRANCH}`);
    if (!r.ok) throw fail(r);
    const head = (await r.json()).object.sha;
    r = await gh(`git/commits/${head}`);
    if (!r.ok) throw fail(r);
    const base = (await r.json()).tree.sha;
    const list = await files(async path => (await readFile(path, head))?.text ?? null);
    const tree = list.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.text }));
    r = await gh('git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base, tree }) });
    if (!r.ok) throw fail(r);
    r = await gh('git/commits', { method: 'POST', body: JSON.stringify({ message, tree: (await r.json()).sha, parents: [head] }) });
    if (!r.ok) throw fail(r);
    const sha = (await r.json()).sha;
    r = await gh(`git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha }) });
    if (r.ok) return { commit: sha };
    // 422: the branch moved (a comment saved meanwhile); start again from the new head, once.
    if (r.status !== 422 || attempt) throw fail(r);
  }
}

// The Pages build of a commit: 'pending', 'success', 'failure', or null when it cannot be seen
// (the token has no Actions: read permission, or the run has not started yet).
export async function buildOf(commit) {
  const r = await gh(`actions/runs?head_sha=${commit}&per_page=5`).catch(() => null);
  if (!r?.ok) return null;
  const run = (await r.json()).workflow_runs?.find(w => /pages/i.test(w.path || w.name));
  if (!run) return null;
  return run.status !== 'completed' ? 'pending' : run.conclusion === 'success' ? 'success' : 'failure';
}

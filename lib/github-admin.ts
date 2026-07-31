const API_VERSION = "2022-11-28";

function config() {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!owner || !repo || !token) throw new Error("GitHub configuration is incomplete");
  return { owner, repo, token, branch, baseUrl: `https://api.github.com/repos/${owner}/${repo}` };
}

async function githubRequest<T>(path: string, init: RequestInit = {}, retries = 2): Promise<T> {
  const { token, baseUrl } = config();
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": API_VERSION, ...init.headers },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok) return await response.json() as T;
      const retryable = response.status === 429 || response.status >= 500;
      const detail = await response.text();
      if (!retryable || attempt === retries) throw new Error(`GitHub ${response.status}: ${detail.slice(0, 300)}`);
      lastError = new Error(`GitHub ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries || (error instanceof Error && error.message.startsWith("GitHub 4"))) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt) + Math.floor(Math.random() * 150)));
  }
  throw lastError;
}

export function repositoryBranch() {
  return config().branch;
}

export async function createBlob(base64: string) {
  return githubRequest<{ sha: string }>("/git/blobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: base64, encoding: "base64" }) });
}

export async function getBlob(sha: string) {
  return githubRequest<{ content: string; encoding: string }>(`/git/blobs/${sha}`);
}

export async function currentCommit() {
  const { branch } = config();
  const ref = await githubRequest<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`);
  return githubRequest<{ sha: string; tree: { sha: string }; message: string }>(`/git/commits/${ref.object.sha}`);
}

export async function publishTree(entries: Array<{ path: string; sha: string }>, contentBase64: string, expectedCommit: string | null, publishId: string) {
  const { branch } = config();
  const current = await currentCommit();
  if (current.message.includes(`[publish:${publishId}]`)) return { commit: current.sha, alreadyPublished: true };
  if (expectedCommit && current.sha !== expectedCommit) {
    return { conflict: true as const, currentCommit: current.sha };
  }
  const contentBlob = await createBlob(contentBase64);
  const tree = await githubRequest<{ sha: string }>("/git/trees", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: current.tree.sha, tree: [...entries, { path: "content/site-content.json", mode: "100644", type: "blob", sha: contentBlob.sha }].map((entry) => ({ ...entry, mode: "100644", type: "blob" })) }),
  });
  const commit = await githubRequest<{ sha: string }>("/git/commits", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Admin: update website [publish:${publishId}]`, tree: tree.sha, parents: [current.sha] }),
  });
  try {
    await githubRequest(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sha: commit.sha, force: false }) }, 0);
  } catch (error) {
    const latest = await currentCommit();
    if (latest.sha === commit.sha || latest.message.includes(`[publish:${publishId}]`)) return { commit: latest.sha, alreadyPublished: true };
    throw error;
  }
  return { commit: commit.sha, alreadyPublished: false };
}

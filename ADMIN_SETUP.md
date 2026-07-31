# Admin setup

The admin is available at `/admin`. It publishes content and images by committing them to GitHub. Vercel's Git integration then deploys the commit.

## Vercel environment variables

Add these variables to the Production environment in **Vercel → Project → Settings → Environment Variables**:

- `ADMIN_PASSWORD`: the password used at `/admin`
- `ADMIN_SESSION_SECRET`: a separate long random value (at least 32 characters)
- `GITHUB_TOKEN`: a fine-grained GitHub personal access token
- `GITHUB_REPO_OWNER`: GitHub user or organization that owns the repository
- `GITHUB_REPO_NAME`: repository name only
- `GITHUB_BRANCH`: deployment branch, normally `main`

Redeploy once after adding the variables.

## GitHub token

Create a fine-grained personal access token restricted to this repository. Give it only **Repository permissions → Contents: Read and write**. Do not expose the token through a `NEXT_PUBLIC_` variable or commit it to the repository.

The repository branch must allow the token owner to commit. If the deployment branch is protected against direct commits, use a dedicated editable branch and configure Vercel to deploy that branch, or adjust the branch rule.

## Publishing behavior

- Images are optimized in the browser and staged individually, keeping every request below Vercel's request limit.
- Uploaded images are stored in `public/images/admin/` only when the final publish succeeds.
- Editable text and image references are stored in `content/site-content.json`.
- Each publish updates all images and content in one atomic Git commit, so partial updates cannot reach the deployment branch.
- The admin saves a local draft automatically and restores it after a refresh or expired session.
- A stale admin tab is rejected instead of overwriting a newer Git commit.
- Every publish has Git history, so changes can be audited or reverted.
- A successful publish means the commit is saved and Vercel has started building; it is not live instantly. The existing site remains live until deployment succeeds.
- Optimized images are limited to 3 MB each.

The review sections are intentionally not editable through the admin.

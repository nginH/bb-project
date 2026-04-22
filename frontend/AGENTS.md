<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Deployment and Cloud Run

This project uses GitHub Actions to build Docker images for both frontend and backend, pushes them to Google Artifact Registry, and deploys to Cloud Run.

- **Frontend Docker image:** asia-south1-docker.pkg.dev/bb-project-494105/frontentrepo/frontend:latest
- **Backend Docker image:** asia-south1-docker.pkg.dev/bb-project-494105/backend-repo/backend:latest

See `.github/workflows/deploy.yml` for the full CI/CD pipeline.

**Requirements:**
- Set the `GCP_SA_KEY` secret in your GitHub repository (Google Cloud service account key with permissions for Artifact Registry and Cloud Run).
- Cloud Run and Artifact Registry must be enabled in your GCP project.

**Dockerfiles:**
- `frontend/my-app/Dockerfile` (Next.js frontend)
- `backend/Dockerfile` (Node.js backend)

**How it works:**
1. On push to `main`, GitHub Actions builds and pushes Docker images for frontend and backend.
2. Images are pushed to Artifact Registry.
3. Cloud Run services are updated with the new images.

---
<!-- END:nextjs-agent-rules -->

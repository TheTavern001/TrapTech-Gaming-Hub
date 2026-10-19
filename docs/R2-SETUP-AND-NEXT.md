# R2 Setup and Next Actions

## Current status
- cosmetics.js is prepared to load assets from ASSET_CDN_URL
- Asset manifest exists in docs/ASSET-MANIFEST.md
- Code is ready for finished assets

## R2 bucket setup (do this in Cloudflare dashboard)
1. Go to Cloudflare dashboard → R2
2. Create bucket: gaming-hub-assets
3. Settings → Public access → Connect custom domain (assets.yourdomain.com)
4. Create R2 API token with Object Read & Write
5. Set environment variables on Deplexo:
   - ASSET_CDN_URL=https://assets.yourdomain.com/cosmetics/v1/
   - R2_ACCESS_KEY_ID=...
   - R2_SECRET_ACCESS_KEY=...
   - R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com

## Once R2 is ready
1. Upload assets under /cosmetics/v1/banner/<id>.png and /cosmetics/v1/frame/<id>.png
2. Redeploy the app
3. Verify shop, customize, and profile pages load the new assets
4. Expand the ID list in cosmetics.js from the original commit if needed

## Notes
I can push code changes to GitHub. Actual file uploads to R2 require the API credentials to be available in the environment or a connected tool.

# Distribution Build Releases

This document explains how to create and publish distribution builds to GitHub Releases.

## What is a Distribution Build?

A distribution build is a special version of Dyad that:
- Routes AI requests through the Vibeathon proxy (`https://app.vibeathon.us/api/v1`)
- Includes feature flags to customize the UI for distribution partners
- Is published separately from the standard Dyad releases

## Release Workflows

### Standard Release (`.github/workflows/release.yml`)
- Publishes the standard Dyad application
- Uses default AI provider routing
- Tagged as `v1.0.0`, `v1.1.0`, etc.

### Distribution Release (`.github/workflows/release-distribution.yml`)
- Publishes the Vibeathon distribution build
- Routes through Vibeathon proxy
- Tagged as `v1.0.0-vibeathon`, `v1.1.0-vibeathon`, etc. (configurable)

## How to Create a Distribution Release

### 1. Create a Git Tag

First, create and push a tag for the distribution release:

```bash
# Create a tag with the -vibeathon suffix
git tag v0.22.0-vibeathon

# Push the tag to GitHub
git push origin v0.22.0-vibeathon
```

### 2. Trigger the Workflow

1. Go to your repository on GitHub
2. Click on **Actions** tab
3. Select **Release Distribution Build** workflow from the left sidebar
4. Click **Run workflow** button (top right)
5. Optionally customize the tag suffix (default: "vibeathon")
6. Click **Run workflow**

### 3. Monitor the Build

The workflow will:
- Build for all platforms (Windows, macOS Intel, macOS ARM, Linux)
- Sign the builds (Windows via DigiCert, macOS via Apple)
- Create a draft GitHub Release
- Upload all platform binaries as release assets
- Verify all expected assets were uploaded

### 4. Publish the Release

Once the workflow completes:
1. Go to **Releases** section on GitHub
2. Find the draft release (e.g., `v0.22.0-vibeathon`)
3. Review the release notes and assets
4. Click **Publish release**

## Download Links

After publishing, users can download the distribution build from:

```
https://github.com/dyad-sh/dyad/releases/tag/v0.22.0-vibeathon
```

The release will include installers for:
- **Windows**: `.exe` (Squirrel installer)
- **macOS Intel**: `.zip` (Intel Macs)
- **macOS ARM**: `.zip` (Apple Silicon Macs)
- **Linux**: `.deb` (Debian/Ubuntu), `.rpm` (Fedora/RHEL)

## Environment Variables

The distribution build sets these environment variables during the build:

```bash
DYAD_DISTRIBUTION_BUILD=true
DYAD_DISTRIBUTION_PROXY_URL=https://app.vibeathon.us/api/v1
```

These are used by the application to:
- Enable distribution-specific features
- Route AI requests through the Vibeathon proxy
- Customize the UI for distribution partners

## Local Testing

To test the distribution build locally before releasing:

```bash
# Start in development mode (local proxy)
npm run start:distribution:dev

# Build for distribution (development)
npm run make:distribution:dev

# Build for distribution (production)
npm run make:distribution:prod
```

## Versioning Strategy

### Standard Releases
- `v1.0.0` - Major release
- `v1.1.0` - Minor release with new features
- `v1.0.1` - Patch release with bug fixes

### Distribution Releases
- `v1.0.0-vibeathon` - Distribution build based on v1.0.0
- `v1.1.0-vibeathon` - Distribution build based on v1.1.0

Keep the base version number synchronized with standard releases.

## Auto-Updates

The Electron auto-updater will work with distribution builds as long as:
1. The releases are published (not draft)
2. The version in `package.json` matches the git tag
3. Users have the distribution build installed

Distribution builds will only update to other distribution builds with the same suffix.

## Troubleshooting

### Build Fails on Code Signing
- **Windows**: Check DigiCert secrets (`SM_*` environment variables)
- **macOS**: Check Apple secrets (`APPLE_*` environment variables)

### Release Not Created
- Ensure you created and pushed a git tag first
- Check that the tag matches the version in `package.json`

### Missing Assets
- Check the "Verify Release Assets" job in the workflow
- Re-run failed jobs if needed

### Wrong Proxy URL
- Ensure `DYAD_DISTRIBUTION_PROXY_URL` is set correctly in the workflow
- For production releases, it should be `https://app.vibeathon.us/api/v1`

## Security Considerations

- Distribution builds use the same code signing certificates as standard releases
- All secrets are stored in GitHub Secrets (not committed to repository)
- The Vibeathon proxy URL is public and can be seen in the published builds
- API keys are provided by end users, not embedded in the build

## Related Files

- `.github/workflows/release-distribution.yml` - Distribution release workflow
- `.github/workflows/release.yml` - Standard release workflow
- `forge.config.ts` - Electron Forge configuration
- `package.json` - Build scripts and version
- `src/ipc/utils/get_model_client.ts` - Proxy routing logic

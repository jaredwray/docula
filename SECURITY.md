# Security Policy

<a href="https://app.aikido.dev/audit-report/external/lZAT2DfBsT11ZQfpYwClKi6s/request" target="_blank" rel="noopener noreferrer">
    <img src="https://app.aikido.dev/assets/badges/full-light-theme.svg" alt="Aikido Security Audit Report" height="40" />
</a>

## Reporting a Vulnerability

To report a security vulnerability, please create an issue and send an email to me@jaredwray.com. Once the issue has been validated, we will open a [Github Security Advisory](https://docs.github.com/en/code-security/repository-security-advisories/about-github-security-advisories-for-repositories), if necessary.

## Continuous Security Scanning

We take the security of Docula seriously and have multiple layers of automated scanning in place to detect vulnerabilities as early as possible:

- **Aikido Security**: We use [Aikido](https://www.aikido.dev/) to continuously scan our codebase, dependencies, and infrastructure for vulnerabilities. You can review our public audit report by clicking the badge above.
- **Pull Request Scans**: Every pull request opened against this repository is automatically scanned for security issues. This ensures that no new code is merged without first being reviewed for known vulnerabilities, insecure dependencies, and common security pitfalls.
- **CodeQL Analysis**: We run [GitHub CodeQL](https://codeql.github.com/) static analysis on the repository to identify potential security issues in our source code.

## npm Package Provenance

Docula is published to [npmjs.org](https://www.npmjs.com/package/docula) with [npm package provenance](https://docs.npmjs.com/generating-provenance-statements) enabled via GitHub Actions. Provenance statements provide cryptographically verifiable links between published packages and the source code and build process that produced them.

This means that when you install Docula from npm, you can verify:

- The exact source repository and commit the package was built from.
- The GitHub Actions workflow that built and published the package.
- That the package has not been tampered with between build and publish.

Our release workflow (`.github/workflows/release.yaml`) uses the `--provenance` flag when publishing, and the GitHub Actions runner is granted the `id-token: write` permission required to generate the signed provenance statement. You can verify the provenance of any published version directly on the [Docula npm page](https://www.npmjs.com/package/docula) or via `npm audit signatures`.

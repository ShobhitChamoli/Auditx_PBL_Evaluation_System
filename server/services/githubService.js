const axios = require('axios');

/**
 * Extract owner and repo name from a GitHub URL.
 * Returns { owner, repo } or null.
 */
const parseGithubUrl = (repoUrl) => {
    try {
        const parts = repoUrl.split('github.com/');
        if (parts.length < 2) return null;
        const [owner, repo] = parts[1].split('/').filter(Boolean);
        if (!owner || !repo) return null;
        return { owner, repo: repo.replace(/\.git$/, '') };
    } catch {
        return null;
    }
};

/**
 * Fetch a single raw file from a GitHub repo.
 * Tries main and master branches.
 */
const fetchFile = async (owner, repo, filePath) => {
    const branches = ['main', 'master', 'dev', 'develop'];
    for (const branch of branches) {
        try {
            const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
            const { data } = await axios.get(url, { timeout: 5000 });
            return { path: filePath, content: data };
        } catch {
            continue;
        }
    }
    return null;
};

/**
 * Fetch the README of the repo.
 */
const getReadme = async (repoUrl) => {
    const parsed = parseGithubUrl(repoUrl);
    if (!parsed) return '';
    const result = await fetchFile(parsed.owner, parsed.repo, 'README.md');
    return result ? result.content : '';
};

/**
 * Fetch repo context: README + tech-stack detection files
 * (requirements.txt, package.json, Pipfile, go.mod, pom.xml, etc.)
 * Returns a combined string with all fetched content.
 */
const getRepoContext = async (repoUrl) => {
    const parsed = parseGithubUrl(repoUrl);
    if (!parsed) return { summary: '', detectedFiles: [] };

    const { owner, repo } = parsed;

    // Files to try fetching for tech-stack detection
    const techStackFiles = [
        'requirements.txt',   // Python (pip)
        'Pipfile',            // Python (pipenv)
        'pyproject.toml',     // Python (poetry)
        'package.json',       // Node.js / React / Vue
        'go.mod',             // Go
        'pom.xml',            // Java Maven
        'build.gradle',       // Java Gradle
        'Gemfile',            // Ruby
        'composer.json',      // PHP
        'Cargo.toml',         // Rust
        'pubspec.yaml',       // Flutter/Dart
        'README.md',          // Readme for description
    ];

    const fetched = await Promise.all(
        techStackFiles.map(f => fetchFile(owner, repo, f))
    );

    const detectedFiles = fetched.filter(Boolean);
    const summary = detectedFiles
        .map(f => `=== ${f.path} ===\n${f.content.slice(0, 1500)}`) // Limit each file to 1500 chars
        .join('\n\n');

    return { summary, detectedFiles: detectedFiles.map(f => f.path) };
};

module.exports = { getReadme, getRepoContext };


import fs from 'fs-extra';

export class GithubPlugin {

    options = {
        github_url: 'https://api.github.com',
        data_path: 'data',
        repo: undefined
    }

    constructor(options: any) {
        this.options = options;

        if(!this.options.repo) {
            throw new Error('No repo specified');
        }
    }

    async execute(): Promise<void> {
        const data = {
            sponsors: {},
            releases: {},
            contributors: {}
        };
        data.sponsors = await this.getSponsors();
        data.releases = await this.getReleases();
        data.contributors = await this.getContributors();
        await fs.writeFile(`${this.options.data_path}/github.json`, JSON.stringify(data, null, 2));
        return;
    }

    async getSponsors(): Promise<object> {
        const response = await fetch(`${this.options.github_url}/repos/${this.options.repo}/community/profile`);
        const data = await response.json();
        return data;
    }

    async getReleases(): Promise<object> {
        const response = await fetch(`${this.options.github_url}/repos/${this.options.repo}/releases`);
        const data = await response.json();
        return data;
    }

    async getContributors(): Promise<object> {
        const response = await fetch(`${this.options.github_url}/repos/${this.options.repo}/contributors`);
        const data = await response.json();
        return data;
    }
}
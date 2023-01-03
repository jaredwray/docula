import fs from 'fs-extra';
import type {DoculaPlugin, Options, Runtime} from "../docula-plugin";
import type {Config} from '../config.js';

export type RobotsConfig = {
  allowedUrl: string;
  disallowedUrl: string;
}

export class RobotsPlugin implements DoculaPlugin {
  readonly options: Options = {
    sitemapPath: 'sitemap.xml',
    outputFile: 'robots.txt',
  };

  runtime: Runtime = 'after'

  constructor(config: Config) {
    this.options.outputPath = config.outputPath;
    const {allowedUrl, disallowedUrl} = config.pluginConfig.robots as RobotsConfig;
    this.options.allowedUrl = allowedUrl;
    this.options.disallowedUrl = disallowedUrl;
  }

  async execute(): Promise<void> {
    const data = `User-agent: *
      Allow: ${this.options.allowedUrl}
      Disallow: ${this.options.disallowedUrl}
      Sitemap: ${this.options.sitemapPath}
     `;

    const filePath = `${this.options.outputPath}/${this.options.outputFile}`;
    await fs.ensureDir(this.options.outputPath);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
}

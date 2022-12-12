import { existsSync, readFileSync } from 'fs';

type AlgoliaConfig = {
  algoliaAppId: '',
  algoliaKey: '',
  algoliaIndexName: '',
} | null;

export class Config {
  originPath: string = 'site';
  outputPath: string = 'dist';
  dataPath: string = 'data';
  templatePath: string = 'template';
  searchEngine: string = 'algolia';
  algolia: AlgoliaConfig = null;
  imagesPath: string = 'images';
  assetsPath: string = 'public';

  constructor(path: string | null) {
    const configFile = this.checkConfigFile(path);
    if(path) {
      if(configFile) {
        this.loadConfig(path);
      } else {
        throw new Error('Config file not found');
      }
    }
  }

  loadConfig(path: string) {
    const data = readFileSync(path, {encoding:'utf8'})
    const config = JSON.parse(data);
    this.originPath = config.originPath;
    this.outputPath = config.outputPath;
    this.dataPath = config.dataPath;
    this.templatePath = config.templatePath;
    this.searchEngine = config.searchEngine;
    this.algolia = {
      algoliaAppId: config.algoliaAppId,
      algoliaKey: config.algoliaKey,
      algoliaIndexName: config.algoliaIndexName,
    };
    this.imagesPath = config.imagesPath;
    this.assetsPath = config.assetsPath;
  }

  checkConfigFile(path: string | null): boolean {
    if(!path) return false;
    return existsSync(path);
  }
}

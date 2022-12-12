export type DoculaOptions = {
	sitePath?: string;
	dataPath?: string;
	outputPath?: string;
	github?: {
		api?: string;
		outputFile?: string;
		repo?: string;
		author?: string;
	};
};

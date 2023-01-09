
export type Runtime = 'before' | 'after';
export type Options = Record<string, string>;
export type Schema = Record<string, any>;

export type DoculaPlugin = {
	options: Record<string, string>;
	runtime: Runtime;
	execute(): Promise<void>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is fine in this generic
export type Has<K extends string | symbol> = Record<K, any>;

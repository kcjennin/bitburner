import { NS } from '@ns'

export function parseFlags<T extends readonly (readonly [string, unknown])[]>(ns: NS, schema: T) {
    type Widen<T> =
        T extends boolean ? boolean :
        T extends string ? string :
        T extends number ? number :
        T extends [] ? number[] :
        T;

    type FlagInput = [string, ScriptArg | string[]][];

    type FlagsType<T extends readonly (readonly [string, unknown])[]> = {
        [K in T[number] as K[0]]: Widen<K[1]>;
    } & { _: ScriptArg[] };

    const fullSchema = [['help', false], ...schema] as const;
    const usage = `usage: run ${ns.getScriptName()} ${fullSchema.map(f => `[--${f[0]}]`).join(' ')}`

    const flags = ns.flags(fullSchema as unknown as FlagInput) as FlagsType<typeof fullSchema>;

    return { flags, usage }
}

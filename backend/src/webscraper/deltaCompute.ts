import { Item } from "./fetcher";

type Delta = {
    added: Item[];
    removed: Item[];
};

export function computeDelta(prev: Item[], curr: Item[]): Delta {
    const prevMap = new Map(prev.map(i => [i.id, i]));
    const currMap = new Map(curr.map(i => [i.id, i]));

    const added: Item[] = [];
    const removed: Item[] = [];

    for (const [id, item] of currMap) {
        if (!prevMap.has(id)) added.push(item);
    }

    for (const [id, item] of prevMap) {
        if (!currMap.has(id)) removed.push(item);
    }

    return { added, removed };
}
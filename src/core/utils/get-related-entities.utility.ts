import { getMetadataArgsStorage } from 'typeorm';

export function getRelatedEntities(rootEntity: Function): Function[] {
  const storage = getMetadataArgsStorage();
  const result = new Set<Function>();
  const visited = new Set<Function>();

  function collect(entity: Function) {
    if (visited.has(entity)) return;
    visited.add(entity);
    result.add(entity);

    const relations = storage.relations.filter((r) => r.target === entity);
    for (const relation of relations) {
      let relatedEntity: Function;

      if (typeof relation.type === 'function') {
        const typeOrThunk = relation.type as { prototype: any } | (() => Function);

        relatedEntity =
          'prototype' in typeOrThunk
            ? (typeOrThunk as Function)
            : (typeOrThunk as () => Function)();

        collect(relatedEntity);
      }
    }
  }

  collect(rootEntity);
  return Array.from(result);
}

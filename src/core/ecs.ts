import { atomWithFactory } from "./atom"
import { Atom, Scope } from "./types"

export type Entity = { id: number }
export type World = Atom<Map<number, Entity>>
export type Attribute<V> = Atom<WeakMap<Entity, V>>

// Simplified attribute types for UI bindings (uses Map instead of WeakMap)
export type EntityId = string | number;
export type AttributeAtom<T> = Atom<Map<EntityId, T>>;

export function world() {
  return atomWithFactory<Map<number, Entity>>(() => new Map())
}

export function attribute<V>() {
  return atomWithFactory<WeakMap<Entity, V>>(() => new WeakMap())
}

export function aspect(s: Scope, world: World, id: number) {
  return {
    set<V>(attributeAtom: Attribute<V>, value: V) {
      const entity = s.get(world)?.get(id);
      if (entity) {
        const attrMap = s.get(attributeAtom)!;
        attrMap.set(entity, value);
        s.notify(attributeAtom);
      }
    },
    get<V>(attributeAtom: Attribute<V>): V | undefined {
      const entity = s.get(world)?.get(id);
      if (entity) {
        const attrMap = s.get(attributeAtom)!;
        return attrMap.get(entity);
      }
      return undefined;
    },
    apply<V>(commands: [Attribute<V>, V][]) {
      const entity = s.get(world)?.get(id);
      if (entity) {
        for (const [attributeAtom, value] of commands) {
          const attrMap = s.get(attributeAtom)!;
          attrMap.set(entity, value);
          s.notify(attributeAtom);
        }
      }
    },
    remove<V>(attributeAtom: Attribute<V>) {
      const entity = s.get(world)?.get(id);
      if (entity) {
        const attrMap = s.get(attributeAtom)!;
        attrMap.delete(entity);
        s.notify(attributeAtom);
      }
    }
  }
}

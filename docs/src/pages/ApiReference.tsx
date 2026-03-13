function T({ children }: { children: React.ReactNode }) {
  return <table>{children}</table>;
}

export function ApiReference() {
  return (
    <article className="prose">
      <h1>API Reference</h1>

      <h2 id="data">Data Layer</h2>
      <T>
        <thead>
          <tr><th>Function</th><th>Returns</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>atom(value)</code></td><td><code>Atom&lt;T&gt;</code></td><td>Create atom with initial value</td></tr>
          <tr><td><code>atomWithFactory(fn)</code></td><td><code>Atom&lt;T&gt;</code></td><td>Create atom with lazy factory</td></tr>
          <tr><td><code>createStore(name?)</code></td><td><code>Store</code></td><td>Create a store instance</td></tr>
          <tr><td><code>reactive(store)</code></td><td><code>Reactive</code></td><td>Get data operations (atoms, sets, maps)</td></tr>
          <tr><td><code>signal()</code></td><td><code>Signal&lt;T&gt;</code></td><td>Create event signal</td></tr>
          <tr><td><code>listen(store)</code></td><td><code>Listener</code></td><td>Get signal operations (on, emit)</td></tr>
        </tbody>
      </T>

      <h2>Reactive Namespaces</h2>
      <T>
        <thead>
          <tr><th>Namespace</th><th>Methods</th></tr>
        </thead>
        <tbody>
          <tr><td><code>atoms</code></td><td><code>get</code>, <code>set</code>, <code>notify</code></td></tr>
          <tr><td><code>sets</code></td><td><code>add</code>, <code>remove</code>, <code>has</code>, <code>clear</code>, <code>size</code>, <code>values</code></td></tr>
          <tr><td><code>maps</code></td><td><code>set</code>, <code>get</code>, <code>delete</code>, <code>has</code>, <code>clear</code>, <code>size</code>, <code>keys</code>, <code>values</code>, <code>entries</code></td></tr>
        </tbody>
      </T>

      <h2 id="system">System Layer</h2>
      <T>
        <thead>
          <tr><th>Function</th><th>Returns</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>effects(store)</code></td><td><code>Effects</code></td><td>Get reaction primitives</td></tr>
          <tr><td><code>system(setup)</code></td><td><code>System</code></td><td>Create system with auto-dispose</td></tr>
          <tr><td><code>ignite(store)</code></td><td><code>() =&gt; void</code></td><td>Start system orchestrator</td></tr>
        </tbody>
      </T>

      <h2 id="effects">Effects Methods</h2>
      <T>
        <thead>
          <tr><th>Method</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>effect(atoms, fn)</code></td><td>Reactive effect — runs when deps change</td></tr>
          <tr><td><code>compute(sources, target, fn)</code></td><td>Derived state — auto-computed atom</td></tr>
          <tr><td><code>batch(fn)</code></td><td>Batch updates — single notification</td></tr>
          <tr><td><code>debounce(atoms, ms, fn)</code></td><td>Debounced effect</td></tr>
          <tr><td><code>throttle(atoms, ms, fn)</code></td><td>Throttled effect</td></tr>
          <tr><td><code>interval(ms, fn)</code></td><td>Auto-cleanup interval</td></tr>
          <tr><td><code>timeout(ms, fn)</code></td><td>Auto-cleanup timeout</td></tr>
          <tr><td><code>onDispose(fn)</code></td><td>Register custom cleanup</td></tr>
          <tr><td><code>dispose()</code></td><td>Cleanup all effects</td></tr>
        </tbody>
      </T>

      <h2 id="ecs">ECS</h2>
      <T>
        <thead>
          <tr><th>Function</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>component()</code></td><td>Create component type</td></tr>
          <tr><td><code>componentWithFactory(fn)</code></td><td>Component with default factory</td></tr>
          <tr><td><code>entities()</code></td><td>Create entity registry</td></tr>
          <tr><td><code>world($entities)</code></td><td>Create world factory</td></tr>
        </tbody>
      </T>

      <h3>World API</h3>
      <T>
        <thead>
          <tr><th>Method</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>entity(id)</code></td><td>Get/create entity by ID</td></tr>
          <tr><td><code>add(entity)</code></td><td>Add to registry</td></tr>
          <tr><td><code>remove(entity)</code></td><td>Remove from registry</td></tr>
          <tr><td><code>has(entity)</code></td><td>Check existence</td></tr>
          <tr><td><code>all()</code></td><td>Get all entities</td></tr>
          <tr><td><code>get(entity, $comp)</code></td><td>Get component value</td></tr>
          <tr><td><code>set(entity, $comp, val)</code></td><td>Set component value</td></tr>
          <tr><td><code>delete(entity, $comp)</code></td><td>Remove component</td></tr>
          <tr><td><code>with($a, $b)</code></td><td>Query entities with components</td></tr>
          <tr><td><code>without($a)</code></td><td>Query entities without component</td></tr>
        </tbody>
      </T>

      <h2 id="attributes">Attributes</h2>
      <T>
        <thead>
          <tr><th>Function</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>registry()</code></td><td>Create object registry</td></tr>
          <tr><td><code>attribute($reg, default)</code></td><td>Create attribute with default</td></tr>
          <tr><td><code>attributeWithFactory($reg, fn)</code></td><td>Create attribute with factory</td></tr>
          <tr><td><code>attributes(store)</code></td><td>Get attribute operations</td></tr>
        </tbody>
      </T>
    </article>
  );
}

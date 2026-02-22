# Tree-sitter para Extracao de Imports/Exports em TypeScript/JavaScript

**Data**: 2026-02-22
**Nivel**: Medium research
**Objetivo**: Avaliar como usar tree-sitter em Node.js para extrair imports/exports de arquivos TS/JS, com foco em construir grafos de dependencia entre modulos.

---

## 1. Pacotes NPM: Qual Usar

### 1.1 Opcoes Disponiveis

| Pacote | Tipo | Downloads/semana | Uso principal |
|--------|------|-----------------|---------------|
| `tree-sitter` (node-tree-sitter) | Native (N-API) | ~7.1M | Node.js server-side, CLI tools |
| `web-tree-sitter` | WASM | ~7.3M | Browser, cross-platform, VSCode extensions |
| `tree-sitter-typescript` | Grammar | ~3.3M | Grammar definitions (TS + TSX) |
| `tree-sitter-javascript` | Grammar | ~3.3M | Grammar definition (JS) |

### 1.2 node-tree-sitter (`tree-sitter`)

```bash
npm install tree-sitter tree-sitter-typescript tree-sitter-javascript
```

**Pros:**
- Performance nativa via N-API bindings (C → Node)
- API sincrona — parse e query sao sync, sem overhead de async/WASM
- Linguagens carregam como modulos nativos (`.node` bindings)
- Usado pelo Aider, grep-ast, e ferramentas de analise de codigo

**Contras:**
- Requer compilacao nativa (node-gyp) — pode falhar em ambientes sem build tools
- Incompativel com VSCode extensions (conflito com Electron)
- Versao do Node.js precisa ser compativel com o pre-built binary (ou recompilar)
- Nao funciona no browser

**Confianca**: ███ (3+ fontes concordam)

### 1.3 web-tree-sitter

```bash
npm install web-tree-sitter
# + .wasm files para cada linguagem
```

**Pros:**
- Zero compilacao nativa — pure WASM, roda em qualquer ambiente
- Funciona em browser, Node.js, Deno, VSCode extensions
- Portavel entre plataformas sem rebuild
- Grammars carregam como `.wasm` files

**Contras:**
- API assincrona (init, language loading sao async)
- ~2-5x mais lento que bindings nativos para parsing
- Precisa de `.wasm` files pre-compilados para cada linguagem
- API ligeiramente diferente do node-tree-sitter (ex: `Language.load()` vs `require()`)

**Confianca**: ███ (3+ fontes concordam)

### 1.4 WASM Pre-built Packages

Para evitar compilar grammars para WASM manualmente:

| Pacote | Descricao |
|--------|-----------|
| `tree-sitter-wasms` | Pre-built WASMs por Gregoor/Menci, usado pelo RooCode |
| `@repomix/tree-sitter-wasms` | Fork do Repomix, subset de linguagens |
| `tree-sitter-wasm-prebuilt` | Original do Menci, 14 stars |

```ts
// Uso com web-tree-sitter + wasm pre-built
import { Parser, Language } from 'web-tree-sitter';
import treeSitterTypescript from 'tree-sitter-wasms/out/tree-sitter-typescript.wasm';

await Parser.init();
const TypeScript = await Language.load(treeSitterTypescript);
const parser = new Parser();
parser.setLanguage(TypeScript);
```

### 1.5 Recomendacao

**Para Sinapse (Node.js CLI/server)**: Usar `web-tree-sitter` + WASM pre-builts.

Justificativa:
- Zero friction de instalacao (sem node-gyp, sem compilacao nativa)
- Funciona identico no Windows, Linux, macOS sem ajuste
- Performance e suficiente para analise estatica de imports (nao e editor real-time)
- Futuro-proof: se precisar rodar no browser ou VSCode, ja funciona
- Aider usa node-tree-sitter via Python bindings, mas o ecossistema Node.js favorece WASM

**Confianca**: ██░ (2 fontes — decisao propria baseada em trade-offs)

---

## 2. AST Node Types para Import/Export

### 2.1 TypeScript/JavaScript Import Nodes

O tree-sitter-typescript (e tree-sitter-javascript) produzem os seguintes node types para imports:

```
import_statement
├── import_clause
│   ├── identifier                    → default import
│   ├── named_imports
│   │   └── import_specifier
│   │       ├── name: identifier      → imported name
│   │       └── alias: identifier     → local alias (optional)
│   └── namespace_import
│       └── identifier                → namespace alias (* as X)
├── source: string                    → module path
└── import_attribute                  → import assertions (optional)
```

### 2.2 Export Nodes

```
export_statement
├── declaration                       → export function/class/const/etc
├── export_clause
│   └── export_specifier
│       ├── name: identifier|string   → exported name
│       └── alias: identifier|string  → public alias (optional)
├── source: string                    → re-export source (optional)
├── namespace_export                  → export * from '...'
└── value                             → export default expression
```

### 2.3 Formas de Import Cobertas

| Forma | Node Type | Exemplo |
|-------|-----------|---------|
| Default import | `import_clause > identifier` | `import React from 'react'` |
| Named import | `import_clause > named_imports > import_specifier` | `import { useState } from 'react'` |
| Namespace import | `import_clause > namespace_import` | `import * as path from 'path'` |
| Side-effect import | `import_statement` (sem import_clause) | `import './styles.css'` |
| Aliased import | `import_specifier` com `alias` field | `import { foo as bar } from 'mod'` |
| Dynamic import | `call_expression` com `import` | `const m = await import('./mod')` |
| Require | `call_expression` com `require` | `const x = require('./mod')` |
| Type-only import | `import_statement` com `type` keyword | `import type { Foo } from './types'` |

### 2.4 Formas de Export Cobertas

| Forma | Node Type | Exemplo |
|-------|-----------|---------|
| Named export | `export_statement > declaration` | `export function foo() {}` |
| Default export | `export_statement` com `default` | `export default class Foo {}` |
| Re-export named | `export_statement > export_clause + source` | `export { foo } from './mod'` |
| Re-export all | `export_statement > namespace_export + source` | `export * from './mod'` |
| Re-export aliased | `export_specifier` com `alias` | `export { foo as bar } from './mod'` |
| Export assignment | `export_statement > value` | `export default 42` |
| Export type | `export_statement` com `type` keyword | `export type { Foo }` |

---

## 3. Tree-sitter Queries para Extracao

### 3.1 Query: Todos os Import Statements

```scheme
;; Captura import statements completos com source path
(import_statement
  source: (string) @import.source) @import.statement
```

### 3.2 Query: Default Imports

```scheme
(import_statement
  (import_clause
    (identifier) @import.default)
  source: (string) @import.source)
```

### 3.3 Query: Named Imports

```scheme
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @import.name
        alias: (identifier)? @import.alias)))
  source: (string) @import.source)
```

### 3.4 Query: Namespace Imports

```scheme
(import_statement
  (import_clause
    (namespace_import
      (identifier) @import.namespace))
  source: (string) @import.source)
```

### 3.5 Query: Side-effect Imports

```scheme
;; Imports sem import_clause (apenas side-effect)
(import_statement
  !import_clause
  source: (string) @import.source) @import.sideeffect
```

**Nota**: A negacao de campo (`!import_clause`) pode nao funcionar em todos os parsers. Alternativa: capturar todos os imports e filtrar programaticamente os que nao tem import_clause.

### 3.6 Query: Dynamic Imports

```scheme
;; import('...')
(call_expression
  function: (import)
  arguments: (arguments
    (string) @import.dynamic.source)) @import.dynamic

;; require('...')
(call_expression
  function: (identifier) @_fn
  arguments: (arguments
    (string) @import.require.source)
  (#eq? @_fn "require")) @import.require
```

### 3.7 Query: Export Declarations

```scheme
;; Named exports (export function, export class, export const, etc)
(export_statement
  declaration: (_) @export.declaration) @export.statement

;; Export default
(export_statement
  value: (_) @export.default) @export.statement.default

;; Re-exports: export { foo } from './mod'
(export_statement
  (export_clause
    (export_specifier
      name: (_) @export.name
      alias: (_)? @export.alias))
  source: (string) @export.source) @export.reexport

;; Namespace re-export: export * from './mod'
(export_statement
  (namespace_export)
  source: (string) @export.source) @export.reexport.all
```

### 3.8 Query Combinada Completa

```scheme
;; ============================================================
;; IMPORTS
;; ============================================================

;; Default import: import Foo from './foo'
(import_statement
  (import_clause
    (identifier) @import.default)
  source: (string) @import.source) @import.statement

;; Named imports: import { a, b as c } from './mod'
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @import.named
        alias: (identifier)? @import.alias)))
  source: (string) @import.source)

;; Namespace import: import * as Ns from './mod'
(import_statement
  (import_clause
    (namespace_import
      (identifier) @import.namespace))
  source: (string) @import.source)

;; Side-effect: import './styles.css'
(import_statement
  source: (string) @import.sideeffect.source) @import.sideeffect

;; Dynamic: const m = await import('./mod')
(call_expression
  function: (import)
  arguments: (arguments
    (string) @import.dynamic.source))

;; Require: const x = require('./mod')
(call_expression
  function: (identifier) @_req
  arguments: (arguments
    (string) @import.require.source)
  (#eq? @_req "require"))

;; ============================================================
;; EXPORTS
;; ============================================================

;; Named export declaration
(export_statement
  declaration: (_) @export.declaration)

;; Default export
(export_statement
  value: (_) @export.default.value)

;; Re-export named: export { foo } from './mod'
(export_statement
  (export_clause
    (export_specifier
      name: (_) @export.reexport.name))
  source: (string) @export.reexport.source)

;; Re-export all: export * from './mod'
(export_statement
  (namespace_export)
  source: (string) @export.star.source)
```

---

## 4. Implementacao em Node.js

### 4.1 Setup Basico com web-tree-sitter

```typescript
import { Parser, Language, Query, Tree, SyntaxNode } from 'web-tree-sitter';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Inicializacao (uma vez)
async function initParser(): Promise<Parser> {
  await Parser.init();
  const parser = new Parser();
  return parser;
}

async function loadLanguage(langPath: string): Promise<Language> {
  return Language.load(langPath);
}

// Parse de um arquivo
function parseFile(parser: Parser, filePath: string): Tree {
  const source = readFileSync(filePath, 'utf-8');
  return parser.parse(source);
}
```

### 4.2 Extracao de Imports

```typescript
interface ImportInfo {
  type: 'default' | 'named' | 'namespace' | 'side-effect' | 'dynamic' | 'require';
  source: string;        // module path (ex: './foo', 'react')
  names?: string[];      // imported names
  aliases?: Record<string, string>;  // original -> alias
  isTypeOnly?: boolean;
  line: number;
  column: number;
}

function extractImports(tree: Tree, sourceCode: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const root = tree.rootNode;

  // Walk all import_statement nodes
  for (let i = 0; i < root.namedChildCount; i++) {
    const node = root.namedChild(i);
    if (!node) continue;

    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source');
      if (!sourceNode) continue;

      // Remove quotes from source string
      const source = sourceNode.text.slice(1, -1);
      const importClause = node.namedChildren.find(c => c.type === 'import_clause');

      if (!importClause) {
        // Side-effect import: import './styles.css'
        imports.push({
          type: 'side-effect',
          source,
          line: node.startPosition.row,
          column: node.startPosition.column,
        });
        continue;
      }

      // Check for type-only import
      const isTypeOnly = sourceCode.substring(
        node.startIndex,
        node.startIndex + 20
      ).includes('import type');

      for (const child of importClause.namedChildren) {
        if (child.type === 'identifier') {
          // Default import
          imports.push({
            type: 'default',
            source,
            names: [child.text],
            isTypeOnly,
            line: node.startPosition.row,
            column: node.startPosition.column,
          });
        } else if (child.type === 'named_imports') {
          // Named imports
          const names: string[] = [];
          const aliases: Record<string, string> = {};

          for (const spec of child.namedChildren) {
            if (spec.type === 'import_specifier') {
              const nameNode = spec.childForFieldName('name');
              const aliasNode = spec.childForFieldName('alias');
              if (nameNode) {
                names.push(nameNode.text);
                if (aliasNode) {
                  aliases[nameNode.text] = aliasNode.text;
                }
              }
            }
          }

          imports.push({
            type: 'named',
            source,
            names,
            aliases: Object.keys(aliases).length > 0 ? aliases : undefined,
            isTypeOnly,
            line: node.startPosition.row,
            column: node.startPosition.column,
          });
        } else if (child.type === 'namespace_import') {
          // Namespace import: import * as X from '...'
          const nameNode = child.namedChildren.find(c => c.type === 'identifier');
          imports.push({
            type: 'namespace',
            source,
            names: nameNode ? [nameNode.text] : [],
            isTypeOnly,
            line: node.startPosition.row,
            column: node.startPosition.column,
          });
        }
      }
    }
  }

  // Dynamic imports (walk full tree)
  walkTree(root, (node) => {
    if (node.type === 'call_expression') {
      const fn = node.childForFieldName('function');
      const args = node.childForFieldName('arguments');

      if (fn?.type === 'import' && args) {
        const firstArg = args.namedChildren[0];
        if (firstArg?.type === 'string') {
          imports.push({
            type: 'dynamic',
            source: firstArg.text.slice(1, -1),
            line: node.startPosition.row,
            column: node.startPosition.column,
          });
        }
      }

      // require()
      if (fn?.type === 'identifier' && fn.text === 'require' && args) {
        const firstArg = args.namedChildren[0];
        if (firstArg?.type === 'string') {
          imports.push({
            type: 'require',
            source: firstArg.text.slice(1, -1),
            line: node.startPosition.row,
            column: node.startPosition.column,
          });
        }
      }
    }
  });

  return imports;
}

function walkTree(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child) walkTree(child, callback);
  }
}
```

### 4.3 Extracao de Exports

```typescript
interface ExportInfo {
  type: 'named' | 'default' | 'reexport' | 'reexport-all';
  name?: string;
  alias?: string;
  source?: string;      // only for re-exports
  isTypeOnly?: boolean;
  line: number;
  column: number;
}

function extractExports(tree: Tree, sourceCode: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const root = tree.rootNode;

  for (let i = 0; i < root.namedChildCount; i++) {
    const node = root.namedChild(i);
    if (!node || node.type !== 'export_statement') continue;

    const sourceNode = node.childForFieldName('source');
    const source = sourceNode ? sourceNode.text.slice(1, -1) : undefined;
    const isTypeOnly = sourceCode.substring(
      node.startIndex, node.startIndex + 20
    ).includes('export type');

    // export declaration (function, class, const, etc)
    const declaration = node.childForFieldName('declaration');
    if (declaration) {
      const nameNode = declaration.childForFieldName('name');
      exports.push({
        type: 'named',
        name: nameNode?.text ?? extractDeclarationName(declaration),
        isTypeOnly,
        line: node.startPosition.row,
        column: node.startPosition.column,
      });
      continue;
    }

    // export default
    const value = node.childForFieldName('value');
    if (value) {
      exports.push({
        type: 'default',
        name: 'default',
        isTypeOnly,
        line: node.startPosition.row,
        column: node.startPosition.column,
      });
      continue;
    }

    // export clause (named re-exports or bare exports)
    const exportClause = node.namedChildren.find(c => c.type === 'export_clause');
    if (exportClause) {
      for (const spec of exportClause.namedChildren) {
        if (spec.type === 'export_specifier') {
          const nameNode = spec.childForFieldName('name');
          const aliasNode = spec.childForFieldName('alias');
          exports.push({
            type: source ? 'reexport' : 'named',
            name: nameNode?.text,
            alias: aliasNode?.text,
            source,
            isTypeOnly,
            line: node.startPosition.row,
            column: node.startPosition.column,
          });
        }
      }
      continue;
    }

    // namespace re-export: export * from './mod'
    const nsExport = node.namedChildren.find(c => c.type === 'namespace_export');
    if (nsExport && source) {
      exports.push({
        type: 'reexport-all',
        source,
        line: node.startPosition.row,
        column: node.startPosition.column,
      });
    }
  }

  return exports;
}

function extractDeclarationName(node: SyntaxNode): string | undefined {
  // For variable declarations: export const foo = ...
  if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
    const declarator = node.namedChildren.find(
      c => c.type === 'variable_declarator'
    );
    return declarator?.childForFieldName('name')?.text;
  }
  return node.childForFieldName('name')?.text;
}
```

---

## 5. Gotchas e Limitacoes

### 5.1 Dynamic Imports (Confianca: ███)

**Problema**: Dynamic imports podem ter expressoes como source, nao apenas strings literais.

```typescript
// tree-sitter CAPTURA (string literal)
const mod = await import('./module');

// tree-sitter NAO CAPTURA o path (expressao dinamica)
const mod = await import(`./modules/${name}`);
const mod = await import(getPath());
```

**Mitigacao**: Capturar o node `call_expression` com `import` e verificar se o argumento e `string` ou `template_string`. Para template strings, extrair a parte estatica do prefix.

### 5.2 Barrel Files / Re-exports (Confianca: ███)

**Problema**: Barrel files (`index.ts`) re-exportam tudo de um diretorio. Para resolver o grafo completo, precisa seguir `export * from './sub'` recursivamente.

```typescript
// components/index.ts (barrel file)
export * from './Button';
export * from './Modal';
export { default as Card } from './Card';
```

**Impactos**:
- `export *` nao lista os nomes exportados — precisa parsear o arquivo source para descobri-los
- Circular re-exports sao possiveis e precisam de deteccao de ciclo
- Performance: Atlassian reportou 75% reducao no build time removendo barrel files
- Atlassian (Jira frontend, milhares de packages) fez automacao para remover barrels

**Mitigacao**:
1. Detectar barrel files: arquivo `index.ts` cujo corpo e APENAS exports
2. Para `export *`: follow the chain, parsear o source e extrair seus exports
3. Cache agressivo: parsear cada arquivo UMA vez, cachear o resultado
4. Deteccao de ciclo com set de "already visiting"

### 5.3 Path Aliases (Confianca: ███)

**Problema**: Tree-sitter so ve o texto literal do source path. Nao resolve aliases.

```typescript
// tree-sitter ve "@/components/Button" como string literal
import { Button } from '@/components/Button';
// Precisa de tsconfig.json para resolver para ./src/components/Button
```

**Mitigacao**:
1. Ler `tsconfig.json` → extrair `compilerOptions.paths`
2. Construir mapa de alias → real path
3. Aplicar resolucao de alias APOS a extracao do tree-sitter
4. Libs existentes: `tsconfig-paths`, `resolve-tsconfig-path`

```typescript
// Exemplo de resolucao
function resolveAlias(importPath: string, aliases: Record<string, string[]>): string {
  for (const [pattern, targets] of Object.entries(aliases)) {
    const prefix = pattern.replace('/*', '');
    if (importPath.startsWith(prefix)) {
      const rest = importPath.slice(prefix.length);
      return targets[0].replace('/*', '') + rest;
    }
  }
  return importPath; // nao e alias
}
```

### 5.4 Type-only Imports (Confianca: ██░)

**Problema**: `import type { Foo }` vs `import { type Foo }` sao sintaticamente diferentes no AST.

- `import type { ... }` → o `import_statement` inteiro tem keyword `type` antes do `{`
- `import { type Foo, Bar }` → cada `import_specifier` pode ter `type` keyword individual (TS 4.5+)

**Mitigacao**: Verificar se o texto entre `import` e `{` contem `type`, E se cada specifier individual tem `type` prefix. Importante para ferramentas que precisam distinguir runtime vs type-only dependencies.

### 5.5 CommonJS e require() (Confianca: ██░)

**Problema**: `require()` e uma funcao normal no AST. Pode ser: dynamica, condicional, dentro de try/catch, ou aliased.

```typescript
// Facil de capturar
const fs = require('fs');

// Dificil: destructured
const { readFile } = require('fs');

// Dificil: condicional
if (condition) { const x = require('./optional'); }

// Impossivel: aliased
const load = require;
load('./mod');
```

**Mitigacao**: Capturar `require()` somente no top-level ou como initializer de variable declarations. Ignorar usos deep-nested a menos que se queira analise completa.

### 5.6 Diferenca TypeScript vs TSX (Confianca: ███)

**Atencao**: `tree-sitter-typescript` define DUAS grammars separadas:
- `tree-sitter-typescript/typescript` → para `.ts`
- `tree-sitter-typescript/tsx` → para `.tsx`

Usar a grammar errada causa parse errors. Na pratica, a grammar TSX e superset e parseia `.ts` sem problemas na maioria dos casos, mas pode ter edge cases com generics (`<T>` vs JSX).

### 5.7 Encoding e BOM (Confianca: █░░)

Arquivos com BOM (Byte Order Mark) ou encoding nao-UTF-8 podem causar offsets incorretos no tree-sitter. Sempre normalizar para UTF-8 sem BOM antes de parsear.

---

## 6. Referencia: Aider repomap.py

### 6.1 Como o Aider Usa Tree-sitter

O Aider constroi um "repository map" — uma representacao compacta de todo o repositorio mostrando classes, funcoes e suas assinaturas. Isso ajuda LLMs a entender a codebase sem precisar carregar todos os arquivos.

**Stack do Aider**:
- `grep_ast` → wrapper Python para tree-sitter
- `tree-sitter-language-pack` ou `tree-sitter-languages` → grammars pre-compiladas
- `tree_sitter.Query` → execucao de queries S-expression
- `NetworkX` → grafo de dependencias + PageRank

### 6.2 Pipeline do Aider

```
1. Arquivo → filename_to_lang() → detecta linguagem
2. Linguagem → get_parser(lang) → parser tree-sitter
3. Linguagem → carrega tags.scm → query S-expression
4. Parse(source) → tree → query.captures(tree.rootNode) → tags
5. Tags classificados em "definition" vs "reference"
   - @name.definition.* → kind: "def"
   - @name.reference.* → kind: "ref"
6. Quando nao ha references no tags.scm → fallback para Pygments tokenizer
7. Grafo NetworkX: arquivo-A referencia simbolo de arquivo-B → edge(A→B)
8. PageRank → ranking de importancia dos arquivos
9. Binary search → selecionar tags que cabem no budget de tokens
```

### 6.3 tags.scm do JavaScript (Aider)

O tags.scm do JavaScript foca em **definicoes** (funcoes, classes, metodos) e **referencias** (calls, new expressions). NAO captura imports explicitamente — o Aider infere dependencias via nome de simbolos: se arquivo A usa `Foo` e arquivo B define `Foo`, cria edge A→B.

**Implicacao para Sinapse**: Se quisermos grafo de dependencias via IMPORTS (nao via uso de simbolos), precisamos escrever nossos proprios queries — os do Aider nao servem para isso.

### 6.4 tags.scm do TypeScript (Aider)

Foca em constructs especificos de TS:
- `function_signature` → `@name @definition.function`
- `method_signature` → `@name @definition.method`
- `abstract_method_signature` → `@name @definition.method`
- `abstract_class_declaration` → `@name @definition.class`
- `module` → `@name @definition.module`
- `interface_declaration` → `@name @definition.interface`
- `type_annotation > type_identifier` → `@name @reference.type`
- `new_expression > identifier` → `@name @reference.class`

Herda o tags.scm do JavaScript via `; inherits: javascript`.

### 6.5 Licoes do Aider para Sinapse

| Aspecto | Aider | Sinapse (proposta) |
|---------|-------|-------------------|
| Objetivo | Repo map para LLM context | Grafo de dependencias entre modulos |
| Granularidade | Simbolos (funcoes, classes) | Modulos (imports/exports) |
| Inferencia | Nome de simbolo → definicao | Import path → arquivo destino |
| Query base | tags.scm (defs + refs) | Custom queries (imports + exports) |
| Path resolution | N/A (trabalha com nomes) | Precisa resolver aliases, barrels |
| Grafo | Arquivo → arquivo (via simbolos) | Arquivo → arquivo (via imports) |
| Ranking | PageRank (importancia) | Dependencia direta + transitiva |

---

## 7. Abordagem Query-based vs Tree-walking

### 7.1 Query-based (S-expressions)

```typescript
// Usando queries
const query = language.query(`
  (import_statement
    source: (string) @source) @import
`);
const captures = query.captures(tree.rootNode);
```

**Pros**: Declarativo, composavel, mais legivel, mais facil de manter.
**Contras**: Menos flexivel para logica complexa, predicados limitados.

### 7.2 Tree-walking (Programatico)

```typescript
// Walking manual
function visit(node: SyntaxNode) {
  if (node.type === 'import_statement') {
    // logica customizada
  }
  for (let i = 0; i < node.namedChildCount; i++) {
    visit(node.namedChild(i)!);
  }
}
```

**Pros**: Flexibilidade total, pode combinar logica arbitraria.
**Contras**: Mais verbose, mais facil de ter bugs, precisa conhecer a estrutura do AST.

### 7.3 Recomendacao

**Usar abordagem hibrida**:
1. Queries para os padroes comuns (import statements, export statements)
2. Tree-walking para casos especiais (dynamic imports com template strings, require condicional)
3. Pos-processamento programatico para resolucao de paths, aliases, barrels

---

## 8. Performance

### 8.1 Benchmarks (Estimados)

| Operacao | web-tree-sitter | node-tree-sitter |
|----------|----------------|------------------|
| Init (uma vez) | ~50-100ms | ~5-10ms |
| Language load | ~20-50ms | ~1-5ms |
| Parse 1KB file | ~1-3ms | ~0.5-1ms |
| Parse 100KB file | ~10-30ms | ~5-10ms |
| Query execution | ~0.5-2ms | ~0.2-0.5ms |

Para um projeto de 1000 arquivos: ~5-30 segundos total com web-tree-sitter (incluindo I/O). Aceitavel para analise one-shot.

### 8.2 Otimizacoes

1. **Parser reuse**: Criar um parser, reusar para todos os arquivos da mesma linguagem
2. **Parallel parsing**: Nao funciona com tree-sitter (parser e single-threaded), mas I/O pode ser parallelizado
3. **Cache**: Cachear resultados por file hash — se arquivo nao mudou, nao re-parsear
4. **Incremental parsing**: tree-sitter suporta, mas so vale para editors com edits em tempo real

---

## 9. Alternativas Consideradas

| Ferramenta | Tipo | Pro | Contra |
|-----------|------|-----|--------|
| **tree-sitter** | Parser generator | Rapido, multi-linguagem, incremental | Complexidade setup, queries limitadas |
| **TypeScript Compiler API** | Full compiler | 100% preciso, resolve types | Lento, so TS/JS, pesado (~100MB) |
| **SWC** | Rust parser | Muito rapido, WASM disponivel | API menos ergonomica, menos documentado |
| **Babel** | JS parser | Ecossistema gigante, plugins | Lento, so JS/TS, visitor-based |
| **ast-grep** | Pattern matcher | Queries intuitivas (YAML), rapido | Dependency extra, menos flexivel |
| **Oxc** | Rust parser | Ultra rapido | Muito novo, API instavel |
| **Regex** | Pattern matching | Simples | Fragil, nao entende sintaxe |

**Decisao**: Tree-sitter e a melhor escolha para o caso de uso de Sinapse — multi-linguagem (futuro), rapido o suficiente, e a mesma ferramenta usada por Aider, Repomix, Zed, Neovim, e VSCode.

**Confianca**: ███ (amplamente validado pela industria)

---

## 10. Plano de Implementacao para Sinapse

### Fase 1: Core Parser
1. Instalar `web-tree-sitter` + WASM pre-builts (TS, TSX, JS)
2. Criar `ImportExtractor` class com `extractImports()` e `extractExports()`
3. Tree-walking approach (mais controle que queries puras)
4. Suportar todas as formas da secao 2

### Fase 2: Path Resolution
1. Ler `tsconfig.json` → extrair paths aliases
2. Resolver relative paths → absolute paths
3. Detectar e seguir barrel files (index.ts com re-exports)
4. Distinguir imports internos vs externos (node_modules)

### Fase 3: Dependency Graph
1. Construir grafo dirigido: arquivo → imports → arquivo target
2. Detectar ciclos
3. Calcular metricas: fan-in, fan-out, betweenness centrality
4. Output: JSON ou formato compativel com visualizacao

### Dependencias NPM

```json
{
  "dependencies": {
    "web-tree-sitter": "^0.25.0"
  },
  "devDependencies": {
    "tree-sitter-wasms": "^0.1.0"
  }
}
```

**Nota sobre WASM loading**: Com web-tree-sitter, os `.wasm` files precisam ser acessiveis em runtime. Para CLI Node.js, usar `path.join(__dirname, ...)` ou resolver via `import.meta.url`.

---

## Fontes

- [web-tree-sitter NPM](https://www.npmjs.com/package/web-tree-sitter) — docs oficiais, API reference
- [node-tree-sitter NPM](https://www.npmjs.com/package/tree-sitter) — bindings nativos Node.js
- [tree-sitter-typescript GitHub](https://github.com/tree-sitter/tree-sitter-typescript) — grammar TS/TSX
- [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html) — documentacao oficial
- [Tree-sitter Query Operators](https://tree-sitter.github.io/tree-sitter/using-parsers/queries/2-operators.html) — captures, quantifiers, anchors
- [Aider repomap.py](https://github.com/paul-gauthier/aider/blob/main/aider/repomap.py) — implementacao reference do repo map
- [Aider Blog: Building a better repository map](https://aider.chat/2023/10/22/repomap.html) — artigo explicando o design
- [ast-grep Import Catalog](https://ast-grep.github.io/catalog/typescript/find-import-identifiers.html) — queries YAML para imports TS
- [Atlassian: 75% Faster Builds Removing Barrel Files](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files) — impacto de barrels
- [API differences node/web tree-sitter](https://nachawati.me/blog/2023/08/17/tree-sitter-api-differences-node-and-web-workaround) — workaround para diferencas
- [tree-sitter-wasms](https://github.com/RooCodeInc/tree-sitter-wasms) — WASMs pre-compilados
- [@repomix/tree-sitter-wasms](https://github.com/repomix/tree-sitter-wasms) — WASMs do Repomix
- [Repomix](https://github.com/yamadashy/repomix) — tool que usa web-tree-sitter para analise de repos

---

*Pesquisa realizada por Jarvis v3.0 | Research Engine level: medium | 2026-02-22*

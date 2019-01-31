import { ResolverEngine } from "@resolver-engine/core";
import path from "path";
import { ImportFile } from "./parsers/importparser";

export function findImports(data: ImportFile): string[] {
  let result: string[] = [];
  // regex below matches all possible import statements, namely:
  // - import "somefile";
  // - import "somefile" as something;
  // - import something from "somefile"
  // (double that for single quotes)
  // and captures file names
  const regex: RegExp = /import\s+(?:(?:"([^;]*)"|'([^;]*)')(?:;|\s+as\s+[^;]*;)|.+from\s+(?:"(.*)"|'(.*)');)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(data.source))) {
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        result.push(match[i]);
        break;
      }
    }
  }
  return result;
}

interface ImportTreeNode extends ImportFile {
  uri: string;
  // uri and url the same as in rest of resolver-engine
  // it might mean github:user/repo/path.sol and raw link
  // or it might mean relative vs absolute file path
  imports: { uri: string; url: string }[];
}

/**
 * This function accepts root files to be searched for and resolves the sources, finds the imports in each source and traverses the whole dependency tree gathering absolute and uri paths
 * @param roots
 * @param workingDir
 * @param resolver
 */
async function gatherDepenencyTree(
  roots: string[],
  workingDir: string,
  resolver: ResolverEngine<ImportFile>,
): Promise<ImportTreeNode[]> {
  let result: ImportTreeNode[] = [];
  let alreadyImported = new Set();

  /**
   * This function traverses the depedency tree and calculates absolute paths for each import on the way storing each file in in a global array
   * @param file File in a depedency that should now be traversed
   * @returns An absolute path for the requested file
   */
  async function dfs(file: { searchCwd: string; uri: string }): Promise<string> {
    const url = await resolver.resolve(file.uri, file.searchCwd);
    if (alreadyImported.has(url)) {
      return url;
    }

    const resolvedFile = await resolver.require(file.uri, file.searchCwd);

    alreadyImported.add(url);

    const foundImportURIs = findImports(resolvedFile);

    const fileNode: ImportTreeNode = { uri: file.uri, imports: [], ...resolvedFile };

    const resolvedCwd = path.dirname(url);
    for (const importUri of foundImportURIs) {
      const importUrl = await dfs({ searchCwd: resolvedCwd, uri: importUri });
      fileNode.imports.push({ uri: importUri, url: importUrl });
    }

    result.push(fileNode);
    return resolvedFile.url;
  }

  await Promise.all(roots.map(what => dfs({ searchCwd: workingDir, uri: what })));

  return result;
}

function stripNodes(nodes: ImportTreeNode[]): ImportFile[] {
  return nodes.map(node => {
    return { url: node.url, source: node.source, provider: node.provider };
  });
}

/**
 * Starts with roots and traverses the whole depedency tree of imports, returning an array of sources
 * @param roots
 * @param workingDir What's the starting working dir for resolving relative imports in roots
 * @param resolver
 */
export async function gatherSources(
  roots: string[],
  workingDir: string,
  resolver: ResolverEngine<ImportFile>,
): Promise<ImportFile[]> {
  let result: ImportFile[] = [];
  let queue: { cwd: string; file: string; relativeTo: string }[] = [];
  let alreadyImported = new Set();

  // solc resolves relative paths starting from current file's path, so if we leave relative path then
  // imported path "../../a/b/c.sol" from file "file.sol" resolves to a/b/c.sol, which is wrong.
  // we start from file;s absolute path so relative path can resolve correctly
  const absoluteRoots = roots.map(what => path.resolve(workingDir, what));
  for (const absWhat of absoluteRoots) {
    queue.push({ cwd: workingDir, file: absWhat, relativeTo: workingDir });
    alreadyImported.add(absWhat);
  }
  while (queue.length > 0) {
    const fileData = queue.shift()!;
    const resolvedFile: ImportFile = await resolver.require(fileData.file, fileData.cwd);
    const foundImports = findImports(resolvedFile);

    // if imported path starts with '.' we assume it's relative and return it's
    // path relative to resolved name of the file that imported it
    // if not - return the same name it was imported with
    let relativePath: string;
    if (fileData.file[0] === ".") {
      relativePath = path.join(fileData.relativeTo, fileData.file);
      result.push({ url: relativePath, source: resolvedFile.source, provider: resolvedFile.provider });
    } else {
      relativePath = fileData.file;
      result.push({ url: relativePath, source: resolvedFile.source, provider: resolvedFile.provider });
    }

    const fileParentDir = path.dirname(resolvedFile.url);
    for (const i in foundImports) {
      let importName: string;
      if (i[0] === ".") {
        importName = path.join(relativePath, i);
      } else {
        importName = foundImports[i];
      }
      if (!alreadyImported.has(importName)) {
        alreadyImported.add(importName);
        queue.push({ cwd: fileParentDir, file: foundImports[i], relativeTo: path.dirname(relativePath) });
      }
    }
  }

  return result;
}

/**
 * This function gathers sources and **REWRITES IMPORTS** inside the source files into resolved, absolute paths instead of using shortcut forms
 * Because the remapping api in solc is not compatible with multiple existing projects and frameworks, changing relative paths to absolute paths
 * makes us avoid any need for finding imports after starting the solc compilation
 * @param roots
 * @param workingDir What's the starting working dir for resolving relative imports in roots
 * @param resolver
 */
export async function gatherSourcesAndCanonizeImports(
  roots: string[],
  workingDir: string,
  resolver: ResolverEngine<ImportFile>,
): Promise<ImportFile[]> {
  function canonizeFile(file: ImportTreeNode) {
    file.imports.forEach(i => (file.source = file.source.replace(i.uri, i.url)));
  }

  let sources = await gatherDepenencyTree(roots, workingDir, resolver);
  sources.forEach(canonizeFile);
  return stripNodes(sources);
}

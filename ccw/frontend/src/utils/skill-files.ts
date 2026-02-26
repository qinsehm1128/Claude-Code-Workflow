// ========================================
// Skill File Tree Utilities
// ========================================
// Convert flat supportingFiles array to tree structure

import type { FileSystemNode } from '@/types/file-explorer';

/**
 * Build a file tree from a flat array of file paths
 *
 * @param supportingFiles - Array of file paths (e.g., ['components/', 'components/Button.tsx'])
 * @returns Tree structure of files and directories
 */
export function buildSkillFileTree(supportingFiles: string[]): FileSystemNode[] {
  // Map to store all nodes by their path
  const nodeMap = new Map<string, FileSystemNode>();

  for (const entry of supportingFiles) {
    const isDirectoryMarker = entry.endsWith('/');
    const cleanPath = isDirectoryMarker ? entry.slice(0, -1) : entry;
    const parts = cleanPath.split('/');

    if (!cleanPath || parts.length === 0) continue;

    // Build the path hierarchy for this entry
    let currentPath = '';

    // Process all parts except the last one (these are intermediate directories)
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // Create directory node if it doesn't exist
      if (!nodeMap.has(currentPath)) {
        nodeMap.set(currentPath, {
          name: part,
          path: currentPath,
          type: 'directory',
          children: [],
        });
      }

      // Add to parent's children
      if (parentPath) {
        const parent = nodeMap.get(parentPath);
        if (parent && parent.type === 'directory') {
          const existingChild = parent.children!.find(c => c.path === currentPath);
          if (!existingChild) {
            parent.children!.push(nodeMap.get(currentPath)!);
          }
        }
      }
    }

    // Process the final part (file or empty directory marker)
    const finalName = parts[parts.length - 1];
    const finalPath = cleanPath;

    // Create or update the final node
    const existingNode = nodeMap.get(finalPath);
    const finalNode: FileSystemNode = existingNode
      ? { ...existingNode, name: finalName }  // Keep children if already exists
      : {
          name: finalName,
          path: finalPath,
          type: isDirectoryMarker ? 'directory' : 'file',
          children: isDirectoryMarker ? [] : undefined,
        };

    nodeMap.set(finalPath, finalNode);

    // Add final node to parent's children
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (parentPath) {
      const parent = nodeMap.get(parentPath);
      if (parent && parent.type === 'directory') {
        const existingChild = parent.children!.find(c => c.path === finalPath);
        if (!existingChild) {
          parent.children!.push(finalNode);
        } else {
          // Update existing child if this is a file (not just a directory marker)
          if (!isDirectoryMarker) {
            existingChild.type = 'file';
            existingChild.children = undefined;
          }
        }
      }
    }
  }

  // Collect root-level nodes (nodes with single-segment paths)
  const result: FileSystemNode[] = [];
  for (const [path, node] of nodeMap.entries()) {
    if (!path.includes('/')) {
      result.push(node);
    }
  }

  // Sort: directories first, then files, alphabetically
  result.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  // Sort children recursively
  const sortChildren = (node: FileSystemNode) => {
    if (node.type === 'directory' && node.children) {
      node.children.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };

  result.forEach(sortChildren);

  return result;
}

/**
 * Get default expanded paths for a file tree
 * Expands all directories by default for skill details
 *
 * @param nodes - File tree nodes
 * @returns Set of all directory paths
 */
export function getDefaultExpandedPaths(nodes: FileSystemNode[]): Set<string> {
  const expanded = new Set<string>();

  const collectDirectories = (node: FileSystemNode) => {
    if (node.type === 'directory') {
      expanded.add(node.path);
      node.children?.forEach(collectDirectories);
    }
  };

  nodes.forEach(collectDirectories);

  return expanded;
}

/**
 * Format file path for display
 */
export function formatFilePath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/**
 * Get file extension
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

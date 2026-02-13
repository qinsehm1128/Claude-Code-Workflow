/**
 * Language configurations and tree-sitter query definitions for outline parsing.
 */

import { extname } from 'path';

export interface LanguageConfig {
  grammarName: string;
  extensions: string[];
  symbolQuery: string;
}

export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  typescript: {
    grammarName: 'typescript',
    extensions: ['.ts'],
    symbolQuery: [
      '(function_declaration name: (identifier) @name) @definition.function',
      '(class_declaration name: (type_identifier) @name) @definition.class',
      '(method_definition name: (property_identifier) @name) @definition.method',
      '(abstract_method_signature name: (property_identifier) @name) @definition.method',
      '(interface_declaration name: (type_identifier) @name) @definition.interface',
      '(type_alias_declaration name: (type_identifier) @name) @definition.type',
      '(enum_declaration name: (identifier) @name) @definition.enum',
      '(variable_declarator name: (identifier) @name value: (arrow_function)) @definition.function',
      '(variable_declarator name: (identifier) @name value: (function_expression)) @definition.function',
    ].join('\n'),
  },
  tsx: {
    grammarName: 'tsx',
    extensions: ['.tsx'],
    symbolQuery: [
      '(function_declaration name: (identifier) @name) @definition.function',
      '(class_declaration name: (type_identifier) @name) @definition.class',
      '(method_definition name: (property_identifier) @name) @definition.method',
      '(interface_declaration name: (type_identifier) @name) @definition.interface',
      '(type_alias_declaration name: (type_identifier) @name) @definition.type',
      '(enum_declaration name: (identifier) @name) @definition.enum',
      '(variable_declarator name: (identifier) @name value: (arrow_function)) @definition.function',
      '(variable_declarator name: (identifier) @name value: (function_expression)) @definition.function',
    ].join('\n'),
  },
  javascript: {
    grammarName: 'javascript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    symbolQuery: [
      '(function_declaration name: (identifier) @name) @definition.function',
      '(class_declaration name: (identifier) @name) @definition.class',
      '(method_definition name: (property_identifier) @name) @definition.method',
      '(variable_declarator name: (identifier) @name value: (arrow_function)) @definition.function',
      '(variable_declarator name: (identifier) @name value: (function_expression)) @definition.function',
    ].join('\n'),
  },
  python: {
    grammarName: 'python',
    extensions: ['.py'],
    symbolQuery: [
      '(function_definition name: (identifier) @name) @definition.function',
      '(class_definition name: (identifier) @name) @definition.class',
    ].join('\n'),
  },
  go: {
    grammarName: 'go',
    extensions: ['.go'],
    symbolQuery: [
      '(function_declaration name: (identifier) @name) @definition.function',
      '(method_declaration name: (field_identifier) @name) @definition.method',
      '(type_spec name: (type_identifier) @name) @definition.type',
    ].join('\n'),
  },
  rust: {
    grammarName: 'rust',
    extensions: ['.rs'],
    symbolQuery: [
      '(function_item name: (identifier) @name) @definition.function',
      '(struct_item name: (type_identifier) @name) @definition.class',
      '(enum_item name: (type_identifier) @name) @definition.enum',
      '(trait_item name: (type_identifier) @name) @definition.interface',
      '(impl_item type: (type_identifier) @name) @definition.class',
    ].join('\n'),
  },
  java: {
    grammarName: 'java',
    extensions: ['.java'],
    symbolQuery: [
      '(class_declaration name: (identifier) @name) @definition.class',
      '(method_declaration name: (identifier) @name) @definition.method',
      '(interface_declaration name: (identifier) @name) @definition.interface',
      '(enum_declaration name: (identifier) @name) @definition.enum',
      '(constructor_declaration name: (identifier) @name) @definition.method',
    ].join('\n'),
  },
  csharp: {
    grammarName: 'c_sharp',
    extensions: ['.cs'],
    symbolQuery: [
      '(class_declaration name: (identifier) @name) @definition.class',
      '(method_declaration name: (identifier) @name) @definition.method',
      '(interface_declaration name: (identifier) @name) @definition.interface',
      '(enum_declaration name: (identifier) @name) @definition.enum',
      '(constructor_declaration name: (identifier) @name) @definition.method',
    ].join('\n'),
  },
  c: {
    grammarName: 'c',
    extensions: ['.c', '.h'],
    symbolQuery: [
      '(function_definition declarator: (function_declarator declarator: (identifier) @name)) @definition.function',
      '(struct_specifier name: (type_identifier) @name) @definition.class',
      '(enum_specifier name: (type_identifier) @name) @definition.enum',
    ].join('\n'),
  },
  cpp: {
    grammarName: 'cpp',
    extensions: ['.cpp', '.hpp', '.cc', '.cxx'],
    symbolQuery: [
      '(function_definition declarator: (function_declarator declarator: (identifier) @name)) @definition.function',
      '(function_definition declarator: (function_declarator declarator: (qualified_identifier name: (identifier) @name))) @definition.function',
      '(class_specifier name: (type_identifier) @name) @definition.class',
      '(struct_specifier name: (type_identifier) @name) @definition.class',
      '(enum_specifier name: (type_identifier) @name) @definition.enum',
    ].join('\n'),
  },
};

// Build extension → language name lookup map
const EXTENSION_MAP = new Map<string, string>();
for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
  for (const ext of config.extensions) {
    EXTENSION_MAP.set(ext, lang);
  }
}

/**
 * Detect language config from file path extension or explicit hint.
 * Returns null if language is not supported.
 */
export function detectLanguage(filePath: string, hint?: string): LanguageConfig | null {
  if (hint) {
    const normalized = hint.toLowerCase();
    const config = LANGUAGE_CONFIGS[normalized];
    if (config) return config;
  }

  const ext = extname(filePath).toLowerCase();
  const lang = EXTENSION_MAP.get(ext);
  if (lang) return LANGUAGE_CONFIGS[lang];

  return null;
}

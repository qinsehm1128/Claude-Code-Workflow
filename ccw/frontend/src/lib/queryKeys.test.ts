// ========================================
// Query Keys Tests
// ========================================
// Tests for workspace query keys factory

import { describe, it, expect } from 'vitest';
import { workspaceQueryKeys, apiSettingsKeys } from './queryKeys';

describe('queryKeys', () => {
  const projectPath = '/test/project';

  describe('workspaceQueryKeys', () => {
    describe('base key', () => {
      it('should create base key with projectPath', () => {
        const result = workspaceQueryKeys.all(projectPath);
        expect(result).toEqual(['workspace', projectPath]);
      });
    });

    describe('sessions keys', () => {
      it('should create sessions list key', () => {
        const result = workspaceQueryKeys.sessionsList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'sessions', 'list']);
      });

      it('should create session detail key with sessionId', () => {
        const sessionId = 'session-123';
        const result = workspaceQueryKeys.sessionDetail(projectPath, sessionId);
        expect(result).toEqual(['workspace', projectPath, 'sessions', 'detail', sessionId]);
      });
    });

    describe('tasks keys', () => {
      it('should create tasks list key with sessionId', () => {
        const sessionId = 'session-456';
        const result = workspaceQueryKeys.tasksList(projectPath, sessionId);
        expect(result).toEqual(['workspace', projectPath, 'tasks', 'list', sessionId]);
      });

      it('should create task detail key with taskId', () => {
        const taskId = 'task-789';
        const result = workspaceQueryKeys.taskDetail(projectPath, taskId);
        expect(result).toEqual(['workspace', projectPath, 'tasks', 'detail', taskId]);
      });
    });

    describe('issues keys', () => {
      it('should create issues list key', () => {
        const result = workspaceQueryKeys.issuesList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'issues', 'list']);
      });

      it('should create issue queue key', () => {
        const result = workspaceQueryKeys.issueQueue(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'issues', 'queue']);
      });

      it('should create issue queue by id key', () => {
        const queueId = 'queue-123';
        const result = workspaceQueryKeys.issueQueueById(projectPath, queueId);
        expect(result).toEqual(['workspace', projectPath, 'issues', 'queueById', queueId]);
      });
    });

    describe('memory keys', () => {
      it('should create memory list key', () => {
        const result = workspaceQueryKeys.memoryList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'memory', 'list']);
      });

      it('should create memory detail key with memoryId', () => {
        const memoryId = 'memory-abc';
        const result = workspaceQueryKeys.memoryDetail(projectPath, memoryId);
        expect(result).toEqual(['workspace', projectPath, 'memory', 'detail', memoryId]);
      });
    });

    describe('skills keys', () => {
      it('should create skills list key', () => {
        const result = workspaceQueryKeys.skillsList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'skills', 'list']);
      });

      it('should create codex skills list key', () => {
        const result = workspaceQueryKeys.codexSkillsList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'codexSkills', 'list']);
      });
    });

    describe('hooks keys', () => {
      it('should create hooks list key', () => {
        const result = workspaceQueryKeys.hooksList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'hooks', 'list']);
      });
    });

    describe('mcp servers keys', () => {
      it('should create mcp servers list key', () => {
        const result = workspaceQueryKeys.mcpServersList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'mcpServers', 'list']);
      });
    });

    describe('project overview keys', () => {
      it('should create project overview key', () => {
        const result = workspaceQueryKeys.projectOverview(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'projectOverview']);
      });
    });

    describe('lite tasks keys', () => {
      it('should create lite tasks list key without type', () => {
        const result = workspaceQueryKeys.liteTasksList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'liteTasks', 'list', undefined]);
      });

      it('should create lite tasks list key with type', () => {
        const result = workspaceQueryKeys.liteTasksList(projectPath, 'lite-plan');
        expect(result).toEqual(['workspace', projectPath, 'liteTasks', 'list', 'lite-plan']);
      });
    });

    describe('explorer keys', () => {
      it('should create explorer tree key with rootPath', () => {
        const rootPath = '/src';
        const result = workspaceQueryKeys.explorerTree(projectPath, rootPath);
        expect(result).toEqual(['workspace', projectPath, 'explorer', 'tree', rootPath]);
      });

      it('should create explorer file key with filePath', () => {
        const filePath = '/src/index.ts';
        const result = workspaceQueryKeys.explorerFile(projectPath, filePath);
        expect(result).toEqual(['workspace', projectPath, 'explorer', 'file', filePath]);
      });
    });

    describe('graph keys', () => {
      it('should create graph dependencies key with options', () => {
        const options = { maxDepth: 3 };
        const result = workspaceQueryKeys.graphDependencies(projectPath, options);
        expect(result).toEqual(['workspace', projectPath, 'graph', 'dependencies', options]);
      });

      it('should create graph impact key with nodeId', () => {
        const nodeId = 'node-123';
        const result = workspaceQueryKeys.graphImpact(projectPath, nodeId);
        expect(result).toEqual(['workspace', projectPath, 'graph', 'impact', nodeId]);
      });
    });

    describe('cli history keys', () => {
      it('should create cli history list key', () => {
        const result = workspaceQueryKeys.cliHistoryList(projectPath);
        expect(result).toEqual(['workspace', projectPath, 'cliHistory', 'list']);
      });

      it('should create cli execution detail key', () => {
        const executionId = 'exec-123';
        const result = workspaceQueryKeys.cliExecutionDetail(projectPath, executionId);
        expect(result).toEqual(['workspace', projectPath, 'cliHistory', 'detail', executionId]);
      });
    });

    describe('unified memory keys', () => {
      it('should create unified search key', () => {
        const query = 'test query';
        const result = workspaceQueryKeys.unifiedSearch(projectPath, query);
        expect(result).toEqual(['workspace', projectPath, 'unifiedMemory', 'search', query, undefined]);
      });

      it('should create unified search key with categories', () => {
        const query = 'test query';
        const categories = 'core,workflow';
        const result = workspaceQueryKeys.unifiedSearch(projectPath, query, categories);
        expect(result).toEqual(['workspace', projectPath, 'unifiedMemory', 'search', query, categories]);
      });
    });

    describe('key isolation', () => {
      it('should produce different keys for different project paths', () => {
        const path1 = '/project/one';
        const path2 = '/project/two';

        const key1 = workspaceQueryKeys.sessionsList(path1);
        const key2 = workspaceQueryKeys.sessionsList(path2);

        expect(key1).not.toEqual(key2);
      });
    });
  });

  describe('apiSettingsKeys', () => {
    describe('base key', () => {
      it('should create base key', () => {
        const result = apiSettingsKeys.all;
        expect(result).toEqual(['apiSettings']);
      });
    });

    describe('providers keys', () => {
      it('should create providers list key', () => {
        const result = apiSettingsKeys.providers();
        expect(result).toEqual(['apiSettings', 'providers']);
      });

      it('should create provider detail key with id', () => {
        const id = 'provider-123';
        const result = apiSettingsKeys.provider(id);
        expect(result).toEqual(['apiSettings', 'providers', id]);
      });
    });

    describe('endpoints keys', () => {
      it('should create endpoints list key', () => {
        const result = apiSettingsKeys.endpoints();
        expect(result).toEqual(['apiSettings', 'endpoints']);
      });

      it('should create endpoint detail key with id', () => {
        const id = 'endpoint-456';
        const result = apiSettingsKeys.endpoint(id);
        expect(result).toEqual(['apiSettings', 'endpoints', id]);
      });
    });

    describe('model pools keys', () => {
      it('should create model pools list key', () => {
        const result = apiSettingsKeys.modelPools();
        expect(result).toEqual(['apiSettings', 'modelPools']);
      });

      it('should create model pool detail key with id', () => {
        const id = 'pool-789';
        const result = apiSettingsKeys.modelPool(id);
        expect(result).toEqual(['apiSettings', 'modelPools', id]);
      });
    });

    describe('cache key', () => {
      it('should create cache key', () => {
        const result = apiSettingsKeys.cache();
        expect(result).toEqual(['apiSettings', 'cache']);
      });
    });
  });
});

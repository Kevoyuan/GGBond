
/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'path';
import fs from 'fs';
import { readFile } from 'fs/promises';
import {
    isPathTrusted,
    isIgnoredByGeminiIgnore,
} from './config-service';
import {
    Config,
    Scheduler,
    ROOT_SCHEDULER_ID,
    GeminiEventType,
    CoreEvent,
    coreEvents,
    MessageBus,
    MessageBusType,
    FileDiscoveryService,
    AuthType,
    ApprovalMode,
    ToolConfirmationOutcome,
    createPolicyUpdater,
    createPolicyEngineConfig,
    resolveTelemetrySettings,
    Storage,
    ToolErrorType,
    WriteTodosTool,
} from '@google/gemini-cli-core';
import type {
    CompletedToolCall,
    ToolCall,
    ToolCallRequestInfo,
    ToolConfirmationPayload,
    WaitingToolCall,
    SerializableConfirmationDetails,
    PolicySettings,
} from '@google/gemini-cli-core';
import type { GeminiChat } from '@google/gemini-cli-core';
import { resolveGeminiConfigDir, resolveRuntimeHome } from '@/lib/runtime-home';

const MAX_TURNS = 100;

function isGitWorkspace(startDir: string): boolean {
    let current = path.resolve(startDir);

    while (true) {
        if (fs.existsSync(path.join(current, '.git'))) {
            return true;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return false;
        }
        current = parent;
    }
}

// Type definition for Global to support HMR in Next.js
declare global {
    var __gemini_core_service: CoreService | undefined;
}

export interface InitParams {
    sessionId: string;
    model: string;
    cwd: string;
    approvalMode?: ApprovalMode | string; // Use the Enum directly if possible, or string
    systemInstruction?: string;
    modelSettings?: RuntimeModelSettings;
}

export interface RuntimeModelSettings {
    compressionThreshold?: number;
    maxSessionTurns?: number;
    tokenBudget?: number;
}

type PendingConfirmationRequest = {
    correlationId: string;
    details: SerializableConfirmationDetails;
    toolCall: {
        name: string;
        args: Record<string, unknown>;
    };
    serverName?: string;
};

type PendingConfirmation = {
    callId: string;
    correlationId: string;
};

type UndoCheckpointResult =
    | { success: true; restoreId: string }
    | { success: false; error: string };

// Hook event types matching gemini-cli-core HookEventName
export type HookEventName =
    | 'BeforeTool'
    | 'AfterTool'
    | 'BeforeAgent'
    | 'AfterAgent'
    | 'SessionStart'
    | 'SessionEnd'
    | 'PreCompress'
    | 'BeforeModel'
    | 'AfterModel'
    | 'BeforeToolSelection'
    | 'Notification';

export interface HookEventPayload {
    eventName: HookEventName;
    timestamp: number;
    data?: Record<string, unknown>;
    sessionId?: string;
}

// Tool execution real-time output payload
export interface ToolExecutionOutputPayload {
    toolCallId: string;
    toolName: string;
    output: string;
    isStderr: boolean;
    timestamp: number;
}

export class CoreService {
    private static _instance: CoreService;
    private static readonly SERVICE_VERSION = 4;
    private static coreEventsRegistered = false;
    public config: Config | null = null;
    public chat: GeminiChat | null = null;
    public messageBus: MessageBus | null = null;
    private initialized = false;
    private pendingConfirmations = new Map<string, PendingConfirmation>();
    private pendingConfirmationByCallId = new Map<string, string>();
    private confirmationSubscribers = new Set<(request: PendingConfirmationRequest) => void>();
    private readonly serviceVersion = CoreService.SERVICE_VERSION;
    private systemEventsRegistered = false;
    private policyUpdaterMessageBus: MessageBus | null = null;
    private systemListenerMessageBus: MessageBus | null = null;
    private sessionsCache: {
        key: string;
        timestamp: number;
        data: Array<{
            id: string;
            title: string;
            updated_at: number;
            created_at: number;
            isCore: boolean;
        }>;
    } | null = null;
    // Hook event subscribers
    private hookEventSubscribers = new Set<(payload: HookEventPayload) => void>();
    // Tool execution output subscribers
    private toolExecutionOutputSubscribers = new Set<(payload: ToolExecutionOutputPayload) => void>();

    private constructor() { }

    public static getInstance(): CoreService {
        if (process.env.NODE_ENV === 'development') {
            const isStaleInstance =
                !!global.__gemini_core_service &&
                (
                    typeof (global.__gemini_core_service as unknown as {
                        subscribeConfirmationRequests?: unknown;
                        clearConfirmationSubscribers?: unknown;
                        submitConfirmation?: unknown;
                        serviceVersion?: unknown;
                        subscribeHookEvents?: unknown;
                    }).subscribeConfirmationRequests !== 'function' ||
                    typeof (global.__gemini_core_service as unknown as {
                        subscribeHookEvents?: unknown;
                    }).subscribeHookEvents !== 'function'
                );
            const hasLatestVersion =
                !!global.__gemini_core_service &&
                (global.__gemini_core_service as unknown as { serviceVersion?: unknown }).serviceVersion === CoreService.SERVICE_VERSION;

            if (!global.__gemini_core_service || isStaleInstance || !hasLatestVersion) {
                global.__gemini_core_service = new CoreService();
            }
            return global.__gemini_core_service;
        }
        if (!CoreService._instance) {
            CoreService._instance = new CoreService();
        }
        return CoreService._instance;
    }

    private static readonly NATIVE_PLAN_MODE_INSTRUCTION = `
# Native Plan Mode Guideline
When you are in planning phase:
1. ALWAYS use the 'write_todos' tool to present your step-by-step plan directly in the chat.
2. DO NOT use 'write_file', 'planning-with-files', or any other tool to create external markdown files for the plan.
3. Your plan should use standard markdown checkboxes (e.g., - [ ] Task).
4. Once the plan is complete and presented via 'write_todos', call 'exit_plan_mode' (with an empty planPath) to wait for user approval.
`;

    public async initialize(params: InitParams) {
        // Check for headless mode - force YOLO mode
        const isHeadless = process.env.GEMINI_HEADLESS === '1' ||
            process.env.GEMINI_HEADLESS === 'true';

        const normalizedApprovalMode = (() => {
            // Headless mode always uses YOLO (auto-approve)
            if (isHeadless) {
                console.log('[CoreService] Headless mode detected, forcing YOLO approval mode');
                return ApprovalMode.YOLO;
            }
            if (params.approvalMode === 'auto') {
                return ApprovalMode.YOLO;
            }
            if (params.approvalMode === ApprovalMode.AUTO_EDIT) {
                return ApprovalMode.AUTO_EDIT;
            }
            return (params.approvalMode as ApprovalMode) ?? ApprovalMode.DEFAULT;
        })();
        const normalizedModelSettings = this.normalizeRuntimeModelSettings(params.modelSettings);

        if (this.initialized && this.config?.getSessionId() === params.sessionId) {
            console.log('[CoreService] Already initialized for session:', params.sessionId);
            // Update model if changed
            if (params.model && this.config.getModel() !== params.model) {
                console.log(`[CoreService] Switching model from ${this.config.getModel()} to ${params.model}`);
                this.config.setModel(params.model);
            }
            if (this.config.getApprovalMode() !== normalizedApprovalMode) {
                try {
                    this.config.setApprovalMode(normalizedApprovalMode);
                } catch (error) {
                    console.warn('[CoreService] setApprovalMode failed, forcing PolicyEngine mode:', error);
                    this.config.getPolicyEngine().setApprovalMode(normalizedApprovalMode);
                }
            }
            // Ensure mode is applied even when Config guards reject privileged modes.
            this.config.getPolicyEngine().setApprovalMode(normalizedApprovalMode);
            this.applyRuntimeModelSettings(normalizedModelSettings);
            console.log('[CoreService] Approval mode (existing session):', this.config.getApprovalMode());
            if (this.messageBus && this.policyUpdaterMessageBus !== this.messageBus) {
                createPolicyUpdater(this.config.getPolicyEngine(), this.messageBus);
                this.policyUpdaterMessageBus = this.messageBus;
            }
            if (this.messageBus && this.systemListenerMessageBus !== this.messageBus) {
                this.registerSystemEvents();
            }
            // IMPORTANT: Refresh tools even for same session.
            // Otherwise a chat instance created before a tools-format fix can keep stale invalid schemas.
            try {
                const geminiClient = this.config.getGeminiClient();
                this.ensureWriteTodosToolEnabled();
                await this.registerCustomTools();
                await geminiClient.setTools();
                this.chat = geminiClient.getChat();
                
                const fullSystemInstruction = (params.systemInstruction || '') + CoreService.NATIVE_PLAN_MODE_INSTRUCTION;
                geminiClient.getChat().setSystemInstruction(fullSystemInstruction);
            } catch (error) {
                console.warn('[CoreService] Failed to refresh tools for existing session:', error);
            }
            return;
        }

        console.log('[CoreService] Initializing...', params);

        const projectRoot = params.cwd || process.cwd();
        const checkpointingEnabled = isGitWorkspace(projectRoot);
        const runtimeHome = resolveRuntimeHome();
        if (process.env.GEMINI_CLI_HOME !== runtimeHome) {
            process.env.GEMINI_CLI_HOME = runtimeHome;
        }
        if (process.env.GGBOND_DATA_HOME !== runtimeHome) {
            process.env.GGBOND_DATA_HOME = runtimeHome;
        }
        console.log(`[CoreService] Using GEMINI_CLI_HOME=${runtimeHome}`);

        const settingsCandidates = [
            process.env.GEMINI_CLI_HOME ? path.join(resolveGeminiConfigDir(process.env.GEMINI_CLI_HOME), 'settings.json') : null,
            Storage.getGlobalSettingsPath()
        ].filter(Boolean) as string[];

        const settingsPath = settingsCandidates.find((p) => fs.existsSync(p)) || settingsCandidates[0];
        let settings: Record<string, unknown> | undefined;
        let authType: AuthType | undefined;
        if (settingsPath && fs.existsSync(settingsPath)) {
            try {
                console.log(`[CoreService] Loading settings from: ${settingsPath}`);
                const settingsContent = await readFile(settingsPath, 'utf-8');
                settings = JSON.parse(settingsContent) as Record<string, unknown>;
                const selectedType =
                    (settings.security as { auth?: { selectedType?: string } } | undefined)?.auth?.selectedType ||
                    (settings.selectedAuthType as string | undefined);
                if (selectedType) {
                    authType = selectedType as AuthType;
                    console.log(`[CoreService] Detected auth type from settings: ${authType}`);
                }
            } catch (error) {
                console.warn('[CoreService] Failed to load settings.json:', error);
            }
        }

        const policySettings: PolicySettings = {
            mcp: (settings?.mcp as PolicySettings['mcp']) ?? undefined,
            tools: (settings?.tools as PolicySettings['tools']) ?? undefined,
            mcpServers: (settings?.mcpServers as PolicySettings['mcpServers']) ?? undefined,
        };
        const policyEngineConfig = await createPolicyEngineConfig(
            policySettings,
            normalizedApprovalMode
        );
        const telemetrySettings = await resolveTelemetrySettings({
            env: process.env,
            settings:
                settings && typeof settings.telemetry === 'object'
                    ? (settings.telemetry as any)
                    : undefined,
        });

        // 1. Initialize Config
        // Cast approvalMode to any to avoid Enum type issues if not exported correctly
        const baseConfigOptions = {
            sessionId: params.sessionId,
            model: params.model,
            targetDir: projectRoot,
            cwd: projectRoot,
            debugMode: false,
            interactive: true,
            checkpointing: checkpointingEnabled,
            approvalMode: normalizedApprovalMode,
            policyEngineConfig,
            recordResponses: '',
            telemetry: telemetrySettings,
            // auth info is auto-detected from env/files by Config internal logic or we can pass explicit
            // For now let Config handle standard auth
        };
        console.log(`[CoreService] Checkpointing: ${checkpointingEnabled ? 'enabled' : 'disabled'} (git workspace: ${checkpointingEnabled})`);

        this.config = new Config(baseConfigOptions);
        try {
            await this.config.initialize();
        } catch (error) {
            if (!checkpointingEnabled) {
                throw error;
            }
            console.warn('[CoreService] Failed to initialize with checkpointing enabled, retrying without checkpointing:', error);
            this.config = new Config({
                ...baseConfigOptions,
                checkpointing: false,
            });
            await this.config.initialize();
        }
        try {
            if (this.config.getApprovalMode() !== normalizedApprovalMode) {
                this.config.setApprovalMode(normalizedApprovalMode);
            }
        } catch (error) {
            console.warn('[CoreService] setApprovalMode failed after initialize, forcing PolicyEngine mode:', error);
        }
        this.config.getPolicyEngine().setApprovalMode(normalizedApprovalMode);
        this.applyRuntimeModelSettings(normalizedModelSettings);
        console.log('[CoreService] Approval mode (post-init):', this.config.getApprovalMode());

        // Initialize Authentication (Required to create ContentGenerator)
        // Explicitly load settings to determine auth type because Config doesn't auto-detect it well
        try {
            if (authType) {
                console.log(`[CoreService] Refreshing auth with ${authType}...`);
                await this.config.refreshAuth(authType);
            } else {
                console.log('[CoreService] No auth type in settings, trying USE_GEMINI default...');
                await this.config.refreshAuth(AuthType.USE_GEMINI);
            }
        } catch (error) {
            console.warn(`[CoreService] Failed to refresh auth with ${authType || 'USE_GEMINI'}, trying fallback:`, error);
            try {
                // Fallback: if we tried LOGIN_WITH_GOOGLE and failed, try USE_GEMINI
                if (authType === AuthType.LOGIN_WITH_GOOGLE) {
                    await this.config.refreshAuth(AuthType.USE_GEMINI);
                } else {
                    // If we tried USE_GEMINI (or something else) and failed, try LOGIN_WITH_GOOGLE?
                    await this.config.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);
                }
            } catch (e) {
                console.error('[CoreService] Failed to refresh auth (fallback):', e);
            }
        }

        // 2. Setup / refresh tools on the core GeminiClient (CLI-aligned path)
        this.ensureWriteTodosToolEnabled();
        await this.registerCustomTools();
        const registry = this.config.getToolRegistry();
        const toolDeclarations = registry.getFunctionDeclarations();
        console.log(
            '[CoreService] Loaded tools:',
            toolDeclarations
                .map((t: { name?: string }) => t.name || '<unnamed>')
                .join(', ')
        );
        const geminiClient = this.config.getGeminiClient();
        this.ensureWriteTodosToolEnabled();
        await this.registerCustomTools();
        
        const fullSystemInstruction = (params.systemInstruction || '') + CoreService.NATIVE_PLAN_MODE_INSTRUCTION;

        await geminiClient.setTools();
        geminiClient.getChat().setSystemInstruction(fullSystemInstruction);

        this.messageBus = this.config.getMessageBus();
        if (this.messageBus && this.policyUpdaterMessageBus !== this.messageBus) {
            createPolicyUpdater(this.config.getPolicyEngine(), this.messageBus);
            this.policyUpdaterMessageBus = this.messageBus;
        }

        // 3. Use chat managed by GeminiClient (matches CLI architecture)
        this.chat = geminiClient.getChat();

        // 4. Register Event Listeners
        this.registerSystemEvents();

        // 5. Emit SessionStart hook event
        this.emitHookEvent('SessionStart', {
            sessionId: params.sessionId,
            model: params.model,
            cwd: params.cwd,
        });

        this.initialized = true;
        console.log('[CoreService] Initialization complete.');
    }

    private normalizeRuntimeModelSettings(settings?: RuntimeModelSettings): RuntimeModelSettings | undefined {
        if (!settings || typeof settings !== 'object') {
            return undefined;
        }

        const normalized: RuntimeModelSettings = {};

        if (typeof settings.maxSessionTurns === 'number' && Number.isFinite(settings.maxSessionTurns)) {
            normalized.maxSessionTurns = Math.max(-1, Math.floor(settings.maxSessionTurns));
        }

        if (typeof settings.compressionThreshold === 'number' && Number.isFinite(settings.compressionThreshold)) {
            normalized.compressionThreshold = Math.max(0, Math.min(1, settings.compressionThreshold));
        }

        if (typeof settings.tokenBudget === 'number' && Number.isFinite(settings.tokenBudget)) {
            normalized.tokenBudget = Math.max(1, Math.floor(settings.tokenBudget));
        }

        return Object.keys(normalized).length > 0 ? normalized : undefined;
    }

    private applyRuntimeModelSettings(settings?: RuntimeModelSettings) {
        if (!this.config || !settings) {
            return;
        }

        console.log('[CoreService] Applying runtime model settings:', JSON.stringify(settings));

        const runtimeConfig = this.config as unknown as {
            maxSessionTurns?: number;
            compressionThreshold?: number;
            summarizeToolOutput?: Record<string, { tokenBudget?: number }>;
        };

        if (settings.maxSessionTurns !== undefined) {
            runtimeConfig.maxSessionTurns = settings.maxSessionTurns;
        }

        if (settings.compressionThreshold !== undefined) {
            runtimeConfig.compressionThreshold = settings.compressionThreshold;
        }

        if (settings.tokenBudget !== undefined) {
            const summarizeToolOutput = runtimeConfig.summarizeToolOutput ?? {};
            runtimeConfig.summarizeToolOutput = {
                ...summarizeToolOutput,
                shell: {
                    ...(summarizeToolOutput.shell ?? {}),
                    tokenBudget: settings.tokenBudget,
                },
                run_shell_command: {
                    ...(summarizeToolOutput.run_shell_command ?? {}),
                    tokenBudget: settings.tokenBudget,
                },
            };
        }
    }

    private ensureWriteTodosToolEnabled() {
        if (!this.config) return;

        const configWithWriteTodos = this.config as unknown as {
            useWriteTodos?: boolean;
        };
        configWithWriteTodos.useWriteTodos = true;

        const registry = this.config.getToolRegistry() as unknown as {
            getTool?: (name: string) => unknown;
            registerTool?: (tool: unknown) => void;
            sortTools?: () => void;
        };

        if (registry.getTool?.('write_todos')) {
            return;
        }

        try {
            registry.registerTool?.(new WriteTodosTool(this.config.getMessageBus()));
            registry.sortTools?.();
            console.log(`[CoreService] Enabled write_todos for model ${this.config.getModel()}`);
        } catch (error) {
            console.warn('[CoreService] Failed to force-enable write_todos tool:', error);
        }
    }

    // Register custom tools from settings
    private async registerCustomTools() {
        if (!this.config) return;

        try {
            // Dynamically import to avoid circular dependencies
            const { getCustomTools } = await import('@/lib/gemini-service');
            const customTools = await getCustomTools();

            if (!customTools || customTools.length === 0) {
                return;
            }

            const enabledTools = customTools.filter(tool => tool.enabled);
            if (enabledTools.length === 0) {
                return;
            }

            const registry = this.config.getToolRegistry() as unknown as {
                getTool?: (name: string) => unknown;
                registerTool?: (tool: unknown) => void;
                sortTools?: () => void;
                getAllDefinitions?: () => unknown[];
            };

            for (const customTool of enabledTools) {
                // Check if tool already exists
                if (registry.getTool?.(customTool.name)) {
                    console.log(`[CoreService] Custom tool ${customTool.name} already exists, skipping`);
                    continue;
                }

                // Create a simple wrapper tool for custom tools
                // Note: Full implementation would require proper tool definition with execute method
                const toolWrapper = this.createCustomToolWrapper(customTool);
                if (toolWrapper) {
                    try {
                        registry.registerTool?.(toolWrapper);
                        console.log(`[CoreService] Registered custom tool: ${customTool.name}`);
                    } catch (error) {
                        console.warn(`[CoreService] Failed to register custom tool ${customTool.name}:`, error);
                    }
                }
            }

            registry.sortTools?.();
        } catch (error) {
            console.warn('[CoreService] Failed to register custom tools:', error);
        }
    }

    // Create a simple tool wrapper for custom tools
    private createCustomToolWrapper(customTool: { name: string; description: string; schema?: Record<string, unknown> }) {
        // Create a minimal tool definition that can be called
        // The actual execution would be handled through a callback or handler
        return {
            name: customTool.name,
            description: customTool.description,
            schema: customTool.schema || {},
            execute: async (args: Record<string, unknown>) => {
                // Custom tool execution would go through the MCP or custom handler
                console.log(`[CoreService] Custom tool ${customTool.name} called with args:`, args);
                return { result: 'Custom tool execution not fully implemented' };
            },
        };
    }

    private registerSystemEvents() {
        if (!CoreService.coreEventsRegistered) {
            // User Feedback
            coreEvents.on(CoreEvent.UserFeedback, (payload) => {
                console.log('[CoreEvent:UserFeedback]', payload);
            });

            // Model Changed
            coreEvents.on(CoreEvent.ModelChanged, (payload) => {
                console.log('[CoreEvent:ModelChanged]', payload);
            });
            CoreService.coreEventsRegistered = true;
        }

        if (!this.messageBus || this.systemListenerMessageBus === this.messageBus) {
            return;
        }
        this.systemEventsRegistered = true;
        this.systemListenerMessageBus = this.messageBus;
    }

    public subscribeConfirmationRequests(
        listener: (request: PendingConfirmationRequest) => void
    ): () => void {
        this.confirmationSubscribers.add(listener);
        return () => {
            this.confirmationSubscribers.delete(listener);
        };
    }

    public clearConfirmationSubscribers() {
        this.confirmationSubscribers.clear();
    }

    // Hook event subscription methods
    public subscribeHookEvents(listener: (payload: HookEventPayload) => void): () => void {
        this.hookEventSubscribers.add(listener);
        return () => {
            this.hookEventSubscribers.delete(listener);
        };
    }

    public clearHookEventSubscribers() {
        this.hookEventSubscribers.clear();
    }

    // Public method to emit hook events from external code (e.g., API routes)
    public emitHookEvent(eventName: HookEventName, data?: Record<string, unknown>) {
        const payload: HookEventPayload = {
            eventName,
            timestamp: Date.now(),
            data,
            sessionId: this.config?.getSessionId(),
        };

        for (const listener of Array.from(this.hookEventSubscribers)) {
            try {
                listener(payload);
            } catch (error) {
                console.error('[CoreService] Hook event subscriber error:', error);
                this.hookEventSubscribers.delete(listener);
            }
        }
    }

    // Convenience method to send notification events
    public sendNotification(title: string, message: string, level: 'info' | 'warning' | 'error' | 'success' = 'info') {
        this.emitHookEvent('Notification', {
            title,
            message,
            level,
        });
    }

    private emitConfirmationRequest(request: PendingConfirmationRequest) {
        for (const listener of Array.from(this.confirmationSubscribers)) {
            try {
                listener(request);
            } catch (error) {
                console.error('[CoreService] Confirmation subscriber error:', error);
                // Drop broken subscribers (e.g. closed stream controllers) to avoid repeated failures.
                this.confirmationSubscribers.delete(listener);
            }
        }
    }

    // Subscribe to real-time tool execution output
    public subscribeToolExecutionOutput(callback: (payload: ToolExecutionOutputPayload) => void): () => void {
        this.toolExecutionOutputSubscribers.add(callback);
        return () => {
            this.toolExecutionOutputSubscribers.delete(callback);
        };
    }

    private emitToolExecutionOutput(payload: ToolExecutionOutputPayload) {
        for (const listener of Array.from(this.toolExecutionOutputSubscribers)) {
            try {
                listener(payload);
            } catch (error) {
                console.error('[CoreService] Tool execution output subscriber error:', error);
                this.toolExecutionOutputSubscribers.delete(listener);
            }
        }
    }

    private toSerializableConfirmationDetails(
        details: unknown,
        request: ToolCallRequestInfo
    ): SerializableConfirmationDetails {
        const fallbackTitle = `Confirm ${request.name}`;
        const fallbackPrompt = 'Please confirm this tool call.';
        const data = (details && typeof details === 'object')
            ? (details as Record<string, unknown>)
            : {};
        const type = typeof data.type === 'string' ? data.type : 'info';

        if (type === 'exec') {
            const command = typeof data.command === 'string'
                ? data.command
                : String((request.args as { command?: unknown })?.command ?? '');
            const rootCommand = typeof data.rootCommand === 'string'
                ? data.rootCommand
                : (command.trim().split(/\s+/)[0] || 'shell command');
            const rootCommands = Array.isArray(data.rootCommands)
                ? data.rootCommands.map((value) => String(value))
                : [rootCommand];

            return {
                type: 'exec',
                title: typeof data.title === 'string' ? data.title : fallbackTitle,
                command,
                rootCommand,
                rootCommands,
                commands: Array.isArray(data.commands)
                    ? data.commands.map((value) => String(value))
                    : undefined,
            };
        }

        if (type === 'edit') {
            return {
                type: 'edit',
                title: typeof data.title === 'string' ? data.title : fallbackTitle,
                fileName: typeof data.fileName === 'string' ? data.fileName : 'unknown',
                filePath: typeof data.filePath === 'string' ? data.filePath : '',
                fileDiff: typeof data.fileDiff === 'string' ? data.fileDiff : '',
                originalContent: typeof data.originalContent === 'string' || data.originalContent === null
                    ? data.originalContent as string | null
                    : null,
                newContent: typeof data.newContent === 'string' ? data.newContent : '',
                isModifying: Boolean(data.isModifying),
            };
        }

        if (type === 'mcp') {
            return {
                type: 'mcp',
                title: typeof data.title === 'string' ? data.title : fallbackTitle,
                serverName: typeof data.serverName === 'string' ? data.serverName : 'unknown',
                toolName: typeof data.toolName === 'string' ? data.toolName : request.name,
                toolDisplayName: typeof data.toolDisplayName === 'string'
                    ? data.toolDisplayName
                    : (typeof data.toolName === 'string' ? data.toolName : request.name),
            };
        }

        if (type === 'ask_user') {
            return {
                type: 'ask_user',
                title: typeof data.title === 'string' ? data.title : 'Ask User',
                questions: Array.isArray(data.questions) ? data.questions as any[] : [],
            };
        }

        if (type === 'exit_plan_mode') {
            return {
                type: 'exit_plan_mode',
                title: typeof data.title === 'string' ? data.title : 'Plan Approval',
                planPath: typeof data.planPath === 'string' ? data.planPath : '',
            };
        }

        return {
            type: 'info',
            title: typeof data.title === 'string' ? data.title : fallbackTitle,
            prompt: typeof data.prompt === 'string' ? data.prompt : fallbackPrompt,
            urls: Array.isArray(data.urls) ? data.urls.map((value) => String(value)) : undefined,
        };
    }

    private registerPendingConfirmation(waitingCall: WaitingToolCall) {
        const callId = waitingCall.request.callId;
        const rawDetails = (waitingCall.confirmationDetails && typeof waitingCall.confirmationDetails === 'object')
            ? (waitingCall.confirmationDetails as Record<string, unknown>)
            : {};
        const serializableDetails = this.toSerializableConfirmationDetails(rawDetails, waitingCall.request);
        const existingCorrelationId = this.pendingConfirmationByCallId.get(callId);
        const correlationIdFromScheduler =
            typeof waitingCall.correlationId === 'string' ? waitingCall.correlationId : undefined;
        const correlationId = correlationIdFromScheduler || existingCorrelationId || crypto.randomUUID();

        if (existingCorrelationId && existingCorrelationId === correlationId) {
            return;
        }

        if (existingCorrelationId && existingCorrelationId !== correlationId) {
            this.pendingConfirmations.delete(existingCorrelationId);
        }

        this.pendingConfirmations.set(correlationId, {
            callId,
            correlationId,
        });
        this.pendingConfirmationByCallId.set(callId, correlationId);

        this.emitConfirmationRequest({
            correlationId,
            details: serializableDetails,
            toolCall: {
                name: waitingCall.request.name,
                args: waitingCall.request.args,
            },
            serverName:
                serializableDetails.type === 'mcp'
                    ? serializableDetails.serverName
                    : undefined,
        });
    }

    private cleanupPendingConfirmationByCallId(callId: string) {
        const correlationId = this.pendingConfirmationByCallId.get(callId);
        if (!correlationId) return;
        this.pendingConfirmationByCallId.delete(callId);
        this.pendingConfirmations.delete(correlationId);
    }

    private syncPendingConfirmations(toolCalls: ToolCall[]) {
        const awaitingCalls = toolCalls.filter(
            (toolCall): toolCall is WaitingToolCall => toolCall.status === 'awaiting_approval'
        );
        const awaitingCallIds = new Set(awaitingCalls.map((toolCall) => toolCall.request.callId));

        for (const [callId] of this.pendingConfirmationByCallId) {
            if (!awaitingCallIds.has(callId)) {
                this.cleanupPendingConfirmationByCallId(callId);
            }
        }

        for (const waitingCall of awaitingCalls) {
            this.registerPendingConfirmation(waitingCall);
        }
    }

    public async *runTurn(message: string, signal?: AbortSignal, images?: Array<{ dataUrl: string; type: string; name: string }>) {
        if (!this.config) throw new Error('Config not initialized');
        this.pendingConfirmations.clear();
        this.pendingConfirmationByCallId.clear();
        let geminiClient = this.config.getGeminiClient();
        const promptId = crypto.randomUUID();
        const displayContent = message;
        const abortSignal = signal || new AbortController().signal;

        // Emit BeforeAgent hook event
        const agentStartTime = Date.now();
        this.emitHookEvent('BeforeAgent', {
            message: displayContent,
            model: this.config.getModel(),
            turnCount: 0,
        });

        // Build content array with text and optional images
        const content: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

        // Add images if provided
        if (images && images.length > 0) {
            for (const img of images) {
                // Extract base64 data from dataUrl
                const base64Data = img.dataUrl.split(',')[1];
                if (base64Data) {
                    content.push({
                        inlineData: {
                            mimeType: img.type,
                            data: base64Data,
                        },
                    });
                }
            }
        }

        // Add text message
        content.push({ text: message });

        let currentRequest: unknown = content;
        let turnCount = 0;
        const isCapacityExhaustedError = (error: unknown) => {
            const err = error as {
                status?: number;
                message?: string;
                response?: { error?: { message?: string; status?: string; details?: Array<{ reason?: string }> } };
            };
            const message = `${err?.message || ''} ${err?.response?.error?.message || ''}`.toLowerCase();
            const reason = err?.response?.error?.details?.[0]?.reason || '';
            const hasCapacitySignal =
                message.includes('no capacity available') ||
                message.includes('model_capacity_exhausted') ||
                message.includes('resource_exhausted') ||
                reason === 'MODEL_CAPACITY_EXHAUSTED' ||
                err?.response?.error?.status === 'RESOURCE_EXHAUSTED';

            // Some SDK retries wrap the final error and lose numeric status.
            return (err?.status === 429) || hasCapacitySignal;
        };
        const isModelNotFoundError = (error: unknown) => {
            const err = error as {
                code?: number | string;
                status?: number;
                message?: string;
                response?: { error?: { message?: string } };
            };
            const message = `${err?.message || ''} ${err?.response?.error?.message || ''}`.toLowerCase();
            return (
                err?.code === 404 ||
                err?.status === 404 ||
                message.includes('modelnotfounderror') ||
                message.includes('requested entity was not found')
            );
        };
        const fallbackModelForCapacity = () => {
            const currentModel = this.config?.getModel() || '';
            if (currentModel === 'gemini-3-pro' || currentModel === 'gemini-3-pro-preview') {
                return 'gemini-3-flash-preview';
            }
            if (currentModel === 'gemini-3-flash' || currentModel === 'gemini-3-flash-preview') {
                return 'gemini-2.5-pro';
            }
            return null;
        };

        console.log(`[CoreService] Running turn with model: ${this.config.getModel()}`);

        try {
            while (true) {
                turnCount += 1;
                if (
                    (this.config.getMaxSessionTurns() >= 0 && turnCount > this.config.getMaxSessionTurns()) ||
                    turnCount > MAX_TURNS
                ) {
                    yield { type: GeminiEventType.MaxSessionTurns };
                    break;
                }

                const toolCallRequests: ToolCallRequestInfo[] = [];

                // Emit BeforeModel hook event
                this.emitHookEvent('BeforeModel', {
                    turnCount,
                    model: this.config.getModel(),
                    message: displayContent,
                });

                try {
                    const responseStream = geminiClient.sendMessageStream(
                        currentRequest as never,
                        abortSignal,
                        promptId,
                        undefined,
                        false,
                        turnCount === 1 ? displayContent : undefined
                    );

                    for await (const event of responseStream) {
                        if (event.type === GeminiEventType.ToolCallRequest) {
                            toolCallRequests.push(event.value as ToolCallRequestInfo);
                        }
                        yield event;
                    }
                } catch (error) {
                    const fallbackModel = fallbackModelForCapacity();
                    if (fallbackModel && isCapacityExhaustedError(error)) {
                        console.warn(
                            `[CoreService] Model capacity exhausted for ${this.config.getModel()}. Falling back to ${fallbackModel}.`
                        );
                        this.config.setModel(fallbackModel);
                        geminiClient = this.config.getGeminiClient();
                        // Retry the same turn with fallback model.
                        turnCount -= 1;
                        continue;
                    }
                    if (isModelNotFoundError(error)) {
                        const currentModel = this.config.getModel();
                        let fallbackModel: string | null = null;
                        if (currentModel === 'gemini-3.1-pro-preview') {
                            fallbackModel = 'gemini-3-pro-preview';
                        } else if (currentModel === 'gemini-3-pro-preview') {
                            fallbackModel = 'gemini-3-flash-preview';
                        } else if (currentModel === 'gemini-3-flash-preview') {
                            fallbackModel = 'gemini-2.5-pro';
                        }
                        if (fallbackModel) {
                            console.warn(
                                `[CoreService] Model not found for ${currentModel}. Falling back to ${fallbackModel}.`
                            );
                            this.config.setModel(fallbackModel);
                            geminiClient = this.config.getGeminiClient();
                            turnCount -= 1;
                            continue;
                        }
                    }
                    throw error;
                }

                // Emit AfterModel hook event
                this.emitHookEvent('AfterModel', {
                    turnCount,
                    model: this.config.getModel(),
                    toolCallCount: toolCallRequests.length,
                });

                if (!toolCallRequests.length) {
                    break;
                }

                // Emit BeforeToolSelection hook event before executing tools
                this.emitHookEvent('BeforeToolSelection', {
                    turnCount,
                    toolNames: toolCallRequests.map(req => req.name),
                    toolCount: toolCallRequests.length,
                });

                const completedCalls = await this.executeToolCalls(toolCallRequests, abortSignal);
                if (!completedCalls.length) {
                    break;
                }

                // Emit tool responses for frontend rendering and append to chat history.
                const responseParts = [];
                let stopExecutionRequested = false;
                for (const call of completedCalls) {
                    yield { type: GeminiEventType.ToolCallResponse, value: call.response };
                    if (call.response.errorType === ToolErrorType.STOP_EXECUTION && call.response.error) {
                        stopExecutionRequested = true;
                    }
                    if (call.response.responseParts?.length) {
                        responseParts.push(...call.response.responseParts);
                    }
                }

                const currentModel = geminiClient.getCurrentSequenceModel() ?? this.config.getModel();
                geminiClient.getChat().recordCompletedToolCalls(currentModel, completedCalls);

                if (stopExecutionRequested) {
                    break;
                }

                if (!responseParts.length) {
                    break;
                }

                currentRequest = responseParts;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[CoreService] Turn error:', message);
            yield { type: 'error', value: { error: { message } } };
        } finally {
            // Emit AfterAgent hook event
            this.emitHookEvent('AfterAgent', {
                duration: Date.now() - agentStartTime,
                turnCount,
            });
        }
    }

    private async executeToolCalls(requests: ToolCallRequestInfo[], signal: AbortSignal): Promise<CompletedToolCall[]> {
        if (!this.config || !this.messageBus) {
            return [];
        }

        // Get workspace directory for ignore checks
        const workspaceDir = this.config.getWorkingDir();

        // Filter requests based on trusted folders and .geminiignore patterns
        const filteredRequests: ToolCallRequestInfo[] = [];
        for (const request of requests) {
            const args = request.args as Record<string, unknown>;
            const filePath = (args.path as string) || (args.filePath as string) || (args.file as string) || '';

            if (filePath) {
                // Check if path is in a trusted folder (skip confirmation if trusted)
                const isTrusted = await isPathTrusted(filePath);

                // Check if path should be ignored by .geminiignore
                const isIgnored = await isIgnoredByGeminiIgnore(filePath, workspaceDir);

                // Log the trust/ignore status for debugging
                if (isTrusted) {
                    console.log(`[CoreService] Tool ${request.name} path ${filePath} is in trusted folder`);
                }
                if (isIgnored) {
                    console.log(`[CoreService] Tool ${request.name} path ${filePath} is ignored by .geminiignore`);
                }
            }

            filteredRequests.push(request);
        }

        // Emit BeforeTool hook event for each tool
        for (const request of filteredRequests) {
            this.emitHookEvent('BeforeTool', {
                toolName: request.name,
                toolInput: request.args,
            });
        }

        const scheduler = new Scheduler({
            config: this.config,
            messageBus: this.messageBus,
            getPreferredEditor: () => undefined,
            schedulerId: ROOT_SCHEDULER_ID,
        });

        // Track previous tool call states to detect changes
        const previousToolCalls = new Map<string, ToolCall>();

        const onToolCallsUpdate = (message: {
            toolCalls: ToolCall[];
            schedulerId: string;
        }) => {
            if (message.schedulerId !== ROOT_SCHEDULER_ID) {
                return;
            }
            this.syncPendingConfirmations(message.toolCalls);

            // Emit real-time output updates for tool execution
            for (const toolCall of message.toolCalls) {
                const prevCall = previousToolCalls.get(toolCall.request.callId);
                const currentCall = toolCall;

                // Check if there's new live output
                if (currentCall.status === 'executing' && 'liveOutput' in currentCall && currentCall.liveOutput) {
                    const outputStr = typeof currentCall.liveOutput === 'string'
                        ? currentCall.liveOutput
                        : (currentCall.liveOutput as { text?: string }).text || JSON.stringify(currentCall.liveOutput);

                    // Only emit if output is new
                    const prevOutput = prevCall && 'liveOutput' in prevCall ? prevCall.liveOutput : null;
                    const prevOutputStr = prevOutput
                        ? (typeof prevOutput === 'string' ? prevOutput : (prevOutput as { text?: string }).text || JSON.stringify(prevOutput))
                        : '';

                    if (outputStr !== prevOutputStr) {
                        this.emitToolExecutionOutput({
                            toolCallId: toolCall.request.callId,
                            toolName: toolCall.request.name,
                            output: outputStr,
                            isStderr: false,
                            timestamp: Date.now(),
                        });
                    }
                }

                previousToolCalls.set(toolCall.request.callId, toolCall);
            }
        };

        this.messageBus.subscribe(
            MessageBusType.TOOL_CALLS_UPDATE,
            onToolCallsUpdate as never
        );

        let completedCalls: CompletedToolCall[] = [];
        try {
            completedCalls = await scheduler.schedule(requests, signal);
        } finally {
            this.messageBus.unsubscribe(
                MessageBusType.TOOL_CALLS_UPDATE,
                onToolCallsUpdate as never
            );
            this.syncPendingConfirmations([]);
        }

        // Emit AfterTool hook event for each completed tool
        for (const call of completedCalls) {
            this.emitHookEvent('AfterTool', {
                toolName: call.request.name,
                toolInput: call.request.args,
                toolResponse: call.response,
                error: call.response.error,
            });
        }

        return completedCalls;
    }

    public async submitConfirmation(
        correlationId: string,
        confirmed: boolean,
        outcome?: ToolConfirmationOutcome,
        payload?: ToolConfirmationPayload
    ): Promise<boolean> {
        console.log('[CoreService] Submitting confirmation:', { correlationId, confirmed });

        const resolvedOutcome =
            outcome ??
            (confirmed
                ? ToolConfirmationOutcome.ProceedOnce
                : ToolConfirmationOutcome.Cancel);

        const pending = this.pendingConfirmations.get(correlationId);

        if (pending) {
            this.cleanupPendingConfirmationByCallId(pending.callId);
            this.publishConfirmationResponse(correlationId, confirmed, resolvedOutcome, payload);
            return true;
        }

        console.warn('[CoreService] No pending scheduler confirmation found; publishing raw confirmation response', {
            correlationId,
            pendingCount: this.pendingConfirmations.size,
            pendingCorrelationIds: Array.from(this.pendingConfirmations.keys()),
        });

        this.publishConfirmationResponse(correlationId, confirmed, resolvedOutcome, payload);
        return false;
    }

    private publishConfirmationResponse(
        correlationId: string,
        confirmed: boolean,
        outcome: ToolConfirmationOutcome,
        payload?: ToolConfirmationPayload
    ) {
        if (!this.messageBus) {
            console.warn('[CoreService] MessageBus not initialized');
            return;
        }
        this.messageBus.publish({
            type: MessageBusType.TOOL_CONFIRMATION_RESPONSE,
            correlationId,
            confirmed,
            outcome,
            payload,
        } as any);
    }

    public submitQuestionResponse(correlationId: string, answers: any[]) {
        if (!this.messageBus) {
            console.warn('[CoreService] MessageBus not initialized');
            return;
        }

        console.log('[CoreService] Submitting question response:', { correlationId, answers });

        // MessageBusType.ASK_USER_RESPONSE
        this.messageBus.publish({
            type: MessageBusType.ASK_USER_RESPONSE,
            correlationId,
            answers
        } as any);
    }

    public getFileDiscoveryService() {
        return new FileDiscoveryService(this.config?.getTargetDir() || process.cwd(), this.config?.getFileFilteringOptions());
    }

    public getMcpServers() {
        if (!this.config) return {};
        return this.config.getMcpServers();
    }

    public getMcpServersWithStatus() {
        if (!this.config) {
            return {
                discoveryState: 'not_started',
                servers: {} as Record<string, Record<string, unknown>>,
            };
        }

        const manager = this.config.getMcpClientManager();
        const discoveryState = manager?.getDiscoveryState?.() ?? 'not_started';
        const configs = this.config.getMcpServers() ?? {};
        const servers: Record<string, Record<string, unknown>> = {};

        for (const [name, config] of Object.entries(configs)) {
            const status = manager?.getClient(name)?.getStatus?.() ?? 'disconnected';
            const includeTools = Array.isArray(config.includeTools) ? config.includeTools.length : null;
            const excludeTools = Array.isArray(config.excludeTools) ? config.excludeTools.length : null;

            servers[name] = {
                ...config,
                status,
                includeToolsCount: includeTools,
                excludeToolsCount: excludeTools,
                kind: config.command
                    ? 'stdio'
                    : ((config.type === 'http' || config.httpUrl) ? 'http' : 'sse'),
            };
        }

        return { discoveryState, servers };
    }

    public async restartMcpServer(name: string) {
        if (!this.config) {
            throw new Error('Core service is not initialized.');
        }

        const manager = this.config.getMcpClientManager();
        if (!manager) {
            throw new Error('MCP client manager is unavailable.');
        }

        await manager.restartServer(name);
    }

    public async restartAllMcpServers() {
        if (!this.config) {
            throw new Error('Core service is not initialized.');
        }

        const manager = this.config.getMcpClientManager();
        if (!manager) {
            throw new Error('MCP client manager is unavailable.');
        }

        await manager.restart();
    }

    public async addMcpServer(name: string, serverConfig: Record<string, unknown>) {
        if (!this.config) {
            throw new Error('Core service is not initialized.');
        }

        const trimmedName = String(name || '').trim();
        if (!trimmedName) {
            throw new Error('Server name is required.');
        }

        const currentServers = this.config.getMcpServers() ?? {};
        this.config.setMcpServers({
            ...currentServers,
            [trimmedName]: serverConfig as any,
        });

        const manager = this.config.getMcpClientManager();
        if (manager) {
            // Directly register the server config in allServerConfigs to ensure it's available
            const serverConfigs = (manager as any).allServerConfigs;
            if (serverConfigs) {
                serverConfigs.set(trimmedName, serverConfig);
            }
            try {
                await manager.restartServer(trimmedName);
            } catch (err) {
                console.warn('[addMcpServer] restartServer error:', err);
            }
        }
        await this.config.refreshMcpContext();
    }

    public async listSessions() {
        if (!this.config) return [];
        const chatsDir = path.join(this.config.storage.getProjectTempDir(), 'chats');
        if (!fs.existsSync(chatsDir)) return [];

        const cacheKey = chatsDir;
        const now = Date.now();
        // Cache sessions for 30 seconds to reduce file system reads
        if (this.sessionsCache && this.sessionsCache.key === cacheKey && now - this.sessionsCache.timestamp < 30000) {
            return this.sessionsCache.data;
        }

        const files = await fs.promises.readdir(chatsDir);
        const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));

        const sessions = (await Promise.all(sessionFiles.map(async (file) => {
            try {
                const content = await fs.promises.readFile(path.join(chatsDir, file), 'utf-8');
                const data = JSON.parse(content) as {
                    sessionId?: string;
                    summary?: string;
                    lastUpdated?: string;
                    startTime?: string;
                };
                if (!data.sessionId) return null;
                return {
                    id: data.sessionId,
                    title: data.summary || `Session ${data.sessionId.slice(0, 8)}`,
                    updated_at: new Date(data.lastUpdated || 0).getTime(),
                    created_at: new Date(data.startTime || 0).getTime(),
                    isCore: true
                };
            } catch (e) {
                console.error('Failed to read session file:', file, e);
                return null;
            }
        }))).filter((session): session is {
            id: string;
            title: string;
            updated_at: number;
            created_at: number;
            isCore: true;
        } => session !== null).sort((a, b) => b.updated_at - a.updated_at);

        this.sessionsCache = {
            key: cacheKey,
            timestamp: now,
            data: sessions,
        };
        return sessions;
    }

    public async getSession(sessionId: string) {
        if (!this.chat || !this.config) return null;
        const chatsDir = path.join(this.config.storage.getProjectTempDir(), 'chats');
        const sessionPath = path.join(chatsDir, `session-${sessionId}.json`);

        if (!fs.existsSync(sessionPath)) return null;
        const content = await fs.promises.readFile(sessionPath, 'utf-8');
        return JSON.parse(content);
    }

    public deleteSession(sessionId: string) {
        if (!this.chat) return;
        this.chat.getChatRecordingService().deleteSession(sessionId);
    }

    public getAgents() {
        if (!this.config) return [];
        return this.config.getAgentRegistry().getAllDefinitions();
    }

    public getAgentDefinition(name: string) {
        if (!this.config) return null;
        return this.config.getAgentRegistry().getDefinition(name) ?? null;
    }

    public setSystemInstruction(systemInstruction?: string) {
        if (!this.config) {
            return;
        }

        const geminiClient = this.config.getGeminiClient();
        if (!geminiClient) {
            return;
        }

        geminiClient.getChat().setSystemInstruction(systemInstruction || '');
        this.chat = geminiClient.getChat();
    }

    public async getQuota() {
        if (!this.config) return null;
        return await this.config.refreshUserQuota();
    }

    public getMemoryFiles() {
        if (!this.config) return [];
        const contextManager = this.config.getContextManager();
        if (!contextManager) return [];
        return Array.from(contextManager.getLoadedPaths());
    }

    public async refreshMemory() {
        if (!this.config) return;
        const contextManager = this.config.getContextManager();
        if (contextManager) {
            await contextManager.refresh();
        }
    }

    public rewindLastUserMessage() {
        if (!this.chat) {
            return { success: false, error: 'Chat service is not initialized.' };
        }

        const recording = this.chat.getChatRecordingService();
        const conversation = recording.getConversation();
        const messages = conversation?.messages || [];
        const target = [...messages].reverse().find((msg) => msg.type === 'user');

        if (!target) {
            return { success: false, error: 'No user message found to rewind.' };
        }

        const rewound = recording.rewindTo(target.id);
        if (!rewound) {
            return { success: false, error: 'Failed to rewind conversation history.' };
        }

        return {
            success: true,
            rewoundMessageId: target.id,
            remainingMessages: rewound.messages.length,
        };
    }

    public async restoreCheckpoint(checkpointId: string) {
        if (!this.config) {
            return { success: false, error: 'Core service is not initialized.' };
        }

        const gitService = await this.config.getGitService();
        if (!gitService) {
            return { success: false, error: 'Git service is unavailable. Please run in a git repository.' };
        }

        const checkpointsDir = this.config.storage.getProjectTempCheckpointsDir();

        if (!fs.existsSync(checkpointsDir)) {
            return { success: false, error: 'No checkpoint directory found for this workspace/session.' };
        }

        const files = await fs.promises.readdir(checkpointsDir);
        const normalizedCheckpointId = checkpointId.trim();
        const directCandidates = [
            normalizedCheckpointId.endsWith('.json')
                ? normalizedCheckpointId
                : `${normalizedCheckpointId}.json`,
            normalizedCheckpointId,
        ];
        const checkpointFile =
            files.find((file) => directCandidates.includes(file)) ||
            files.find((file) => file.startsWith(`${normalizedCheckpointId}.`));

        if (!checkpointFile) {
            return { success: false, error: `Checkpoint not found: ${normalizedCheckpointId}` };
        }

        const fullPath = path.join(checkpointsDir, checkpointFile);
        const raw = await fs.promises.readFile(fullPath, 'utf-8');
        const parsed = JSON.parse(raw) as {
            commitHash?: string;
            clientHistory?: unknown;
            messageId?: unknown;
        };

        if (!parsed.commitHash) {
            return { success: false, error: 'Checkpoint exists but is missing commit hash.' };
        }

        await gitService.restoreProjectFromSnapshot(parsed.commitHash);
        let historyRestored = false;
        if (Array.isArray(parsed.clientHistory)) {
            try {
                this.config.getGeminiClient().setHistory(parsed.clientHistory as never[]);
                historyRestored = true;
            } catch (error) {
                console.warn('[CoreService] Failed to restore chat history from checkpoint:', error);
            }
        }

        const restoredMessageId = typeof parsed.messageId === 'string' ? parsed.messageId : undefined;
        let conversationRewound = false;
        if (restoredMessageId && this.chat) {
            try {
                const recording = this.chat.getChatRecordingService();
                const beforeLength = recording.getConversation()?.messages.length ?? 0;
                const rewound = recording.rewindTo(restoredMessageId);
                const afterLength = rewound?.messages.length ?? beforeLength;
                conversationRewound = afterLength < beforeLength;
            } catch (error) {
                console.warn('[CoreService] Failed to rewind chat recording from checkpoint message id:', error);
            }
        }

        return {
            success: true,
            checkpoint: checkpointFile.replace(/\.json$/, ''),
            commitHash: parsed.commitHash,
            messageId: restoredMessageId,
            historyRestored,
            conversationRewound,
        };
    }

    public async createUndoCheckpoint(label?: string): Promise<UndoCheckpointResult> {
        if (!this.config) {
            return { success: false, error: 'Core service is not initialized.' };
        }

        try {
            const gitService = await this.config.getGitService();
            if (!gitService) {
                return { success: false, error: 'Git service is unavailable.' };
            }

            const commitHash = await gitService.createFileSnapshot(
                label || `Undo snapshot ${new Date().toISOString()}`
            );
            if (!commitHash) {
                return { success: false, error: 'Failed to create git snapshot.' };
            }

            const restoreId = `undo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
            const checkpointsDir = this.config.storage.getProjectTempCheckpointsDir();
            await fs.promises.mkdir(checkpointsDir, { recursive: true });

            const conversation = this.chat?.getChatRecordingService().getConversation();
            const recordingMessageId = conversation?.messages.at(-1)?.id;
            const checkpointData = {
                commitHash,
                clientHistory: this.config.getGeminiClient().getHistory(),
                messageId: typeof recordingMessageId === 'string' ? recordingMessageId : undefined,
            };

            await fs.promises.writeFile(
                path.join(checkpointsDir, `${restoreId}.json`),
                JSON.stringify(checkpointData, null, 2),
                'utf-8'
            );

            return { success: true, restoreId };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create undo checkpoint.',
            };
        }
    }
}

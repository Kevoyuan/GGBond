
import path from 'path';
import os from 'os';
import fs from 'fs';
import { readFile } from 'fs/promises';
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
    getProjectHash,
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

const MAX_TURNS = 100;

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

export class CoreService {
    private static _instance: CoreService;
    private static readonly SERVICE_VERSION = 2;
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

    private constructor() { }

    public static getInstance(): CoreService {
        if (process.env.NODE_ENV === 'development') {
            const isStaleInstance =
                !!global.__gemini_core_service &&
                typeof (global.__gemini_core_service as unknown as {
                    subscribeConfirmationRequests?: unknown;
                    clearConfirmationSubscribers?: unknown;
                    submitConfirmation?: unknown;
                    serviceVersion?: unknown;
                }).subscribeConfirmationRequests !== 'function';
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

    public async initialize(params: InitParams) {
        const normalizedApprovalMode = (() => {
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
                await geminiClient.setTools();
                this.chat = geminiClient.getChat();
                if (params.systemInstruction) {
                    geminiClient.getChat().setSystemInstruction(params.systemInstruction);
                }
            } catch (error) {
                console.warn('[CoreService] Failed to refresh tools for existing session:', error);
            }
            return;
        }

        console.log('[CoreService] Initializing...', params);

        const projectRoot = params.cwd || process.cwd();
        const projectGeminiHome = path.join(process.cwd(), 'gemini-home');
        const projectGeminiSettings = path.join(projectGeminiHome, '.gemini', 'settings.json');

        // Keep auth/config path consistent with this app's local workspace snapshot when available.
        if (!process.env.GEMINI_CLI_HOME && fs.existsSync(projectGeminiSettings)) {
            process.env.GEMINI_CLI_HOME = projectGeminiHome;
            console.log(`[CoreService] Using GEMINI_CLI_HOME=${projectGeminiHome}`);
        }

        const settingsCandidates = [
            process.env.GEMINI_CLI_HOME ? path.join(process.env.GEMINI_CLI_HOME, '.gemini', 'settings.json') : null,
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
        this.config = new Config({
            sessionId: params.sessionId,
            model: params.model,
            targetDir: projectRoot,
            cwd: projectRoot,
            debugMode: false,
            interactive: true,
            approvalMode: normalizedApprovalMode,
            policyEngineConfig,
            recordResponses: '',
            telemetry: telemetrySettings,
            // auth info is auto-detected from env/files by Config internal logic or we can pass explicit
            // For now let Config handle standard auth
        });

        await this.config.initialize();
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
        const registry = this.config.getToolRegistry();
        const toolDeclarations = registry.getFunctionDeclarations();
        console.log(
            '[CoreService] Loaded tools:',
            toolDeclarations
                .map((t: { name?: string }) => t.name || '<unnamed>')
                .join(', ')
        );
        const geminiClient = this.config.getGeminiClient();
        await geminiClient.setTools();
        if (params.systemInstruction) {
            geminiClient.getChat().setSystemInstruction(params.systemInstruction);
        }

        this.messageBus = this.config.getMessageBus();
        if (this.messageBus && this.policyUpdaterMessageBus !== this.messageBus) {
            createPolicyUpdater(this.config.getPolicyEngine(), this.messageBus);
            this.policyUpdaterMessageBus = this.messageBus;
        }

        // 3. Use chat managed by GeminiClient (matches CLI architecture)
        this.chat = geminiClient.getChat();

        // 4. Register Event Listeners
        this.registerSystemEvents();

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

    public async *runTurn(message: string, signal?: AbortSignal) {
        if (!this.config) throw new Error('Config not initialized');
        this.pendingConfirmations.clear();
        this.pendingConfirmationByCallId.clear();
        const geminiClient = this.config.getGeminiClient();
        const promptId = crypto.randomUUID();
        const displayContent = message;
        const abortSignal = signal || new AbortController().signal;
        let currentRequest: unknown = [{ text: message }];
        let turnCount = 0;

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

                if (!toolCallRequests.length) {
                    break;
                }

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
        }
    }

    private async executeToolCalls(requests: ToolCallRequestInfo[], signal: AbortSignal): Promise<CompletedToolCall[]> {
        if (!this.config || !this.messageBus) {
            return [];
        }

        const scheduler = new Scheduler({
            config: this.config,
            messageBus: this.messageBus,
            getPreferredEditor: () => undefined,
            schedulerId: ROOT_SCHEDULER_ID,
        });

        const onToolCallsUpdate = (message: {
            toolCalls: ToolCall[];
            schedulerId: string;
        }) => {
            if (message.schedulerId !== ROOT_SCHEDULER_ID) {
                return;
            }
            this.syncPendingConfirmations(message.toolCalls);
        };

        this.messageBus.subscribe(
            MessageBusType.TOOL_CALLS_UPDATE,
            onToolCallsUpdate as never
        );

        try {
            return await scheduler.schedule(requests, signal);
        } finally {
            this.messageBus.unsubscribe(
                MessageBusType.TOOL_CALLS_UPDATE,
                onToolCallsUpdate as never
            );
            this.syncPendingConfirmations([]);
        }
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
            await manager.restartServer(trimmedName);
        }
        await this.config.refreshMcpContext();
    }

    public async listSessions() {
        if (!this.config) return [];
        const chatsDir = path.join(os.homedir(), '.gemini', 'tmp', getProjectHash(this.config.getWorkingDir()), 'chats');
        if (!fs.existsSync(chatsDir)) return [];

        const cacheKey = chatsDir;
        const now = Date.now();
        if (this.sessionsCache && this.sessionsCache.key === cacheKey && now - this.sessionsCache.timestamp < 3000) {
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
        if (!this.chat) return null;
        const recording = this.chat.getChatRecordingService();
        // Since initialize handles loading if passed resumedSessionData, 
        // we might need a way to just read it.
        // For now, let's manually read it or assume initialize will be called with it.
        const chatsDir = path.join(os.homedir(), '.gemini', 'tmp', getProjectHash(this.config!.getWorkingDir()), 'chats');
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

    public async restoreCheckpoint(toolId: string) {
        if (!this.config) {
            return { success: false, error: 'Core service is not initialized.' };
        }

        const gitService = await this.config.getGitService();
        if (!gitService) {
            return { success: false, error: 'Git service is unavailable. Please run in a git repository.' };
        }

        const checkpointsDir = path.join(
            os.homedir(),
            '.gemini',
            'tmp',
            getProjectHash(this.config.getWorkingDir()),
            'checkpoints'
        );

        if (!fs.existsSync(checkpointsDir)) {
            return { success: false, error: 'No checkpoint directory found for this workspace/session.' };
        }

        const files = await fs.promises.readdir(checkpointsDir);
        const checkpointFile = files.find((file) => file === `${toolId}.json`) || files.find((file) => file.startsWith(`${toolId}.`));

        if (!checkpointFile) {
            return { success: false, error: `Checkpoint not found for tool id: ${toolId}` };
        }

        const fullPath = path.join(checkpointsDir, checkpointFile);
        const raw = await fs.promises.readFile(fullPath, 'utf-8');
        const parsed = JSON.parse(raw) as { commitHash?: string };

        if (!parsed.commitHash) {
            return { success: false, error: 'Checkpoint exists but is missing commit hash.' };
        }

        await gitService.restoreProjectFromSnapshot(parsed.commitHash);

        return {
            success: true,
            checkpoint: checkpointFile.replace(/\.json$/, ''),
            commitHash: parsed.commitHash,
        };
    }
}

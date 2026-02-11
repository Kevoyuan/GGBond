
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Storage } from '@google/gemini-cli-core/dist/src/config/storage.js';
import { readFile } from 'fs/promises';
import {
    Config,
    CoreToolScheduler,
    GeminiEventType,
    GeminiChat,
    Turn,
    CoreEvent,
    coreEvents,
    MessageBus,
    MessageBusType,
    FileDiscoveryService,
    ChatRecordingService,
    getProjectHash,
    AuthType,
    ApprovalMode,
    TelemetrySettings
} from '@google/gemini-cli-core';
import type { Tool } from '@google/genai';
import type { CompletedToolCall, ToolCallRequestInfo } from '@google/gemini-cli-core/dist/src/scheduler/types.js';

// Monkey patch debugLogger to prevent circular JSON errors in Next.js environment
import { debugLogger } from '@google/gemini-cli-core/dist/src/utils/debugLogger.js';

const originalError = debugLogger.error.bind(debugLogger);
debugLogger.error = (...args: any[]) => {
    const sanitizedArgs = args.map(arg => {
        if (arg instanceof Error) {
            return arg.message + (arg.stack ? `\n${arg.stack}` : '');
        }
        if (typeof arg === 'object' && arg !== null) {
            try {
                // Check for circular references by trying simple stringify
                JSON.stringify(arg);
                return arg;
            } catch (e) {
                // If it fails, return a safe string representation
                return '[Circular/Complex Object] ' + (arg.constructor ? arg.constructor.name : typeof arg);
            }
        }
        return arg;
    });
    originalError(...sanitizedArgs);
};

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
}

export class CoreService {
    private static _instance: CoreService;
    public config: Config | null = null;
    public chat: GeminiChat | null = null;
    public messageBus: MessageBus | null = null;
    private initialized = false;

    private constructor() { }

    public static getInstance(): CoreService {
        if (process.env.NODE_ENV === 'development') {
            if (!global.__gemini_core_service) {
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
        if (this.initialized && this.config?.getSessionId() === params.sessionId) {
            console.log('[CoreService] Already initialized for session:', params.sessionId);
            // Update model if changed
            if (params.model && this.config.getModel() !== params.model) {
                console.log(`[CoreService] Switching model from ${this.config.getModel()} to ${params.model}`);
                this.config.setModel(params.model);
            }
            // IMPORTANT: Refresh tools even for same session.
            // Otherwise a chat instance created before a tools-format fix can keep stale invalid schemas.
            try {
                const registry = this.config.getToolRegistry();
                const toolDeclarations = registry.getFunctionDeclarations();
                const tools: Tool[] = [{ functionDeclarations: toolDeclarations }];
                this.chat?.setTools(tools);
                if (params.systemInstruction) {
                    this.chat?.setSystemInstruction(params.systemInstruction);
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

        // 1. Initialize Config
        // Cast approvalMode to any to avoid Enum type issues if not exported correctly
        this.config = new Config({
            sessionId: params.sessionId,
            model: params.model,
            targetDir: projectRoot,
            cwd: projectRoot,
            debugMode: false,
            interactive: true,
            approvalMode: (params.approvalMode as ApprovalMode) ?? ApprovalMode.DEFAULT,
            recordResponses: '',
            telemetry: {
                enabled: false,
                logPrompts: false,
                useCollector: false
            }
            // auth info is auto-detected from env/files by Config internal logic or we can pass explicit
            // For now let Config handle standard auth
        });

        await this.config.initialize();

        // Initialize Authentication (Required to create ContentGenerator)
        // Explicitly load settings to determine auth type because Config doesn't auto-detect it well
        let authType: AuthType | undefined;
        try {
            const settingsCandidates = [
                process.env.GEMINI_CLI_HOME ? path.join(process.env.GEMINI_CLI_HOME, '.gemini', 'settings.json') : null,
                Storage.getGlobalSettingsPath()
            ].filter(Boolean) as string[];

            const settingsPath = settingsCandidates.find((p) => fs.existsSync(p)) || settingsCandidates[0];
            console.log(`[CoreService] Loading auth settings from: ${settingsPath}`);
            const settingsContent = await readFile(settingsPath, 'utf-8');
            const settings = JSON.parse(settingsContent);
            const selectedType = settings.security?.auth?.selectedType || settings.selectedAuthType;
            if (selectedType) {
                authType = selectedType as AuthType;
                console.log(`[CoreService] Detected auth type from settings: ${authType}`);
            }
        } catch (error) {
            console.warn('[CoreService] Failed to load settings.json:', error);
        }

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

        // CRITICAL FIX: Unwrap LoggingContentGenerator to avoid "Converting circular structure to JSON" error.
        // LoggingContentGenerator unconditionally JSON.stringifies request/response objects which contain circular references (Config).
        // This unwrapping effectively disables the problematic logging while preserving core functionality.
        try {
            const generator = this.config.getContentGenerator();
            // Check if generator is LoggingContentGenerator by checking for 'wrapped' property
            // We use 'any' casting because 'wrapped' is not exposed in the interface
            if (generator && (generator as any).wrapped) {
                console.log('[CoreService] Unwrapping LoggingContentGenerator to avoid circular JSON error...');
                (this.config as any).contentGenerator = (generator as any).wrapped;
            }
        } catch (e) {
            console.warn('[CoreService] Failed to unwrap content generator:', e);
        }

        // 2. Setup Tools
        const registry = this.config.getToolRegistry();
        // Use getFunctionDeclarations() to get serializable tool schemas
        // This avoids circular JSON errors when serializing the API request
        const toolDeclarations = registry.getFunctionDeclarations();
        console.log(
            '[CoreService] Loaded tools:',
            toolDeclarations
                .map((t: { name?: string }) => t.name || '<unnamed>')
                .join(', ')
        );

        // GeminiChat expects Tool[] (e.g. [{ functionDeclarations: [...] }]),
        // not a raw FunctionDeclaration[].
        const tools: Tool[] = [{ functionDeclarations: toolDeclarations }];

        this.messageBus = this.config.getMessageBus();

        // 3. Initialize Chat
        const history: any[] = [];
        // TODO: Load history from persistence if needed

        this.chat = new GeminiChat(
            this.config,
            params.systemInstruction || '',
            tools,
            history
        );

        // 4. Register Event Listeners
        this.registerSystemEvents();

        this.initialized = true;
        console.log('[CoreService] Initialization complete.');
    }

    private registerSystemEvents() {
        // User Feedback
        coreEvents.on(CoreEvent.UserFeedback, (payload) => {
            console.log('[CoreEvent:UserFeedback]', payload);
        });

        // Model Changed
        coreEvents.on(CoreEvent.ModelChanged, (payload) => {
            console.log('[CoreEvent:ModelChanged]', payload);
        });

        // Tool Confirmation (We also need to expose this via API/SSE)
        // Subscription to TOOL_CONFIRMATION_REQUEST
        this.messageBus?.subscribe(MessageBusType.TOOL_CONFIRMATION_REQUEST, async (request) => {
            console.log('[MessageBus] Tool Confirmation Request:', request);
            // Temporary unblock for common QA/search flows in GUI:
            // auto-approve web search so chat won't hang on unanswered confirmation.
            try {
                const toolName = (request as { toolCall?: { name?: string } })?.toolCall?.name;
                if (toolName === 'google_web_search') {
                    this.messageBus?.publish({
                        type: MessageBusType.TOOL_CONFIRMATION_RESPONSE,
                        correlationId: (request as { correlationId: string }).correlationId,
                        confirmed: true,
                        outcome: 'allow'
                    } as never);
                    return;
                }
            } catch (error) {
                console.warn('[CoreService] Auto-confirm failed:', error);
            }
        });
    }

    public async *runTurn(message: string, signal?: AbortSignal) {
        if (!this.chat) throw new Error('Chat not initialized');

        // Runtime guard: some integration paths may accidentally set tools
        // to FunctionDeclaration[] instead of Tool[].
        // Normalize to Tool[] before each turn to avoid INVALID_ARGUMENT on request.tools.
        try {
            const runtimeChat = this.chat as unknown as { tools?: unknown; setTools?: (tools: Tool[]) => void };
            const runtimeTools = Array.isArray(runtimeChat.tools) ? runtimeChat.tools : [];
            const first = runtimeTools[0] as Record<string, unknown> | undefined;
            const looksLikeRawFunctionDeclarations =
                runtimeTools.length > 0 &&
                !!first &&
                typeof first === 'object' &&
                ('name' in first || 'parametersJsonSchema' in first || 'description' in first) &&
                !('functionDeclarations' in first);

            if (looksLikeRawFunctionDeclarations) {
                console.warn('[CoreService] Detected raw FunctionDeclaration[] in chat.tools, auto-wrapping to Tool[]');
                runtimeChat.setTools?.([{ functionDeclarations: runtimeTools as unknown as NonNullable<Tool['functionDeclarations']> }]);
            }
        } catch (error) {
            console.warn('[CoreService] Runtime tools normalization failed:', error);
        }

        const promptId = crypto.randomUUID();
        const modelKey = { model: this.config!.getModel() };
        const abortSignal = signal || new AbortController().signal;
        let currentRequest: unknown = message;

        console.log(`[CoreService] Running turn with model: ${modelKey.model}`);

        try {
            while (true) {
                const turn = new Turn(this.chat, promptId);
                const generator = turn.run(
                    modelKey,
                    currentRequest as never,
                    abortSignal
                );

                for await (const event of generator) {
                    yield event;
                }

                const pendingCalls = turn.pendingToolCalls as ToolCallRequestInfo[];
                if (!pendingCalls.length) {
                    break;
                }

                const completedCalls = await this.executeToolCalls(pendingCalls, abortSignal);
                if (!completedCalls.length) {
                    break;
                }

                // Emit tool responses for frontend rendering and append to chat history.
                const responseParts = [];
                for (const call of completedCalls) {
                    yield { type: GeminiEventType.ToolCallResponse, value: call.response };
                    if (call.response.responseParts?.length) {
                        responseParts.push(...call.response.responseParts);
                    }
                }

                if (!responseParts.length) {
                    break;
                }

                this.chat.addHistory({
                    role: 'user',
                    parts: responseParts
                });

                this.chat.recordCompletedToolCalls(modelKey.model, completedCalls);
                currentRequest = [{ text: 'Please continue.' }];
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[CoreService] Turn error:', message);
            yield { type: 'error', value: { error: { message } } };
        }
    }

    private async executeToolCalls(requests: ToolCallRequestInfo[], signal: AbortSignal): Promise<CompletedToolCall[]> {
        return await new Promise<CompletedToolCall[]>((resolve, reject) => {
            const scheduler = new CoreToolScheduler({
                config: this.config!,
                getPreferredEditor: () => undefined,
                onAllToolCallsComplete: async (completedCalls) => {
                    resolve(completedCalls);
                }
            });

            scheduler.schedule(requests, signal).catch(reject);
        });
    }

    public submitConfirmation(correlationId: string, confirmed: boolean) {
        if (!this.messageBus) {
            console.warn('[CoreService] MessageBus not initialized');
            return;
        }

        console.log('[CoreService] Submitting confirmation:', { correlationId, confirmed });

        // MessageBusType.TOOL_CONFIRMATION_RESPONSE
        this.messageBus.publish({
            type: MessageBusType.TOOL_CONFIRMATION_RESPONSE,
            correlationId,
            confirmed,
            outcome: confirmed ? 'allow' : 'deny'
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

    public async listSessions() {
        if (!this.config) return [];
        const chatsDir = path.join(os.homedir(), '.gemini', 'tmp', getProjectHash(this.config.getWorkingDir()), 'chats');
        if (!fs.existsSync(chatsDir)) return [];

        const files = await fs.promises.readdir(chatsDir);
        const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));

        const sessions = [];
        for (const file of sessionFiles) {
            try {
                const content = await fs.promises.readFile(path.join(chatsDir, file), 'utf-8');
                const data = JSON.parse(content);
                sessions.push({
                    id: data.sessionId,
                    title: data.summary || `Session ${data.sessionId.slice(0, 8)}`,
                    updated_at: new Date(data.lastUpdated).getTime(),
                    created_at: new Date(data.startTime).getTime(),
                    isCore: true
                });
            } catch (e) {
                console.error('Failed to read session file:', file, e);
            }
        }

        return sessions.sort((a, b) => b.updated_at - a.updated_at);
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
}

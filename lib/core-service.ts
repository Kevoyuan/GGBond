
import {
    Config,
    GeminiChat,
    Turn,
    ApprovalMode,
    CoreEvent,
    coreEvents,
    MessageBus,
    ToolRegistry,
    AuthType,
    Tool,
    Content
} from '@google/gemini-cli-core';
import { createContentGenerator } from '@google/gemini-cli-core';
import path from 'path';
import os from 'os';

// Type definition for Global to support HMR in Next.js
declare global {
    var __gemini_core_service: CoreService | undefined;
}

export interface InitParams {
    sessionId: string;
    model: string;
    cwd: string;
    approvalMode?: ApprovalMode;
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
            return;
        }

        console.log('[CoreService] Initializing...', params);

        const projectRoot = params.cwd || process.cwd();

        // 1. Initialize Config
        this.config = new Config({
            sessionId: params.sessionId,
            model: params.model,
            targetDir: projectRoot,
            cwd: projectRoot,
            debugMode: true,
            interactive: true,
            approvalMode: params.approvalMode ?? ApprovalMode.ALWAYS_CONFIRM,
            // auth info is auto-detected from env/files by Config internal logic or we can pass explicit
            // For now let Config handle standard auth
        });

        await this.config.initialize();

        // 2. Setup Tools
        const registry = this.config.getToolRegistry();
        // Built-in tools are registered by Config.initialize() usually, 
        // or we need to manually register if we want custom ones.
        // In CLI Core v0.30+, Config.initialize() should load basics.
        // Let's check available tools
        const toolsMap = registry.getAllTools();
        const tools: Tool[] = Array.from(toolsMap.values());
        console.log('[CoreService] Loaded tools:', tools.map(t => t.name).join(', '));

        this.messageBus = this.config.getMessageBus();

        // 3. Initialize Chat
        // We need to load history if resuming, but for now specific session history handling 
        // acts as a simple start.
        // In a real app, we'd use ChatRecordingService to load history.
        // For project 1, let's start fresh or use what's provided.

        const history: Content[] = [];
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
        this.messageBus?.subscribe(1, async (request) => { // 1 = TOOL_CONFIRMATION_REQUEST (Enum value check needed)
            console.log('[MessageBus] Tool Confirmation Request:', request);
            // In a real implementation this would hold the execution until approved via API
        });
    }

    public async *runTurn(message: string, signal?: AbortSignal) {
        if (!this.chat) throw new Error('Chat not initialized');

        // Create a turn
        const turn = new Turn(
            this.chat,
            message, // promptId - usually UUID, but here we can use a random one
        );

        // Run the turn
        // The Turn.run signature in v0.30 might vary slightly, 
        // but based on API doc: run(modelKey, userContent, signal, ...)

        // We need to construct the user content Part
        const userContentPart = { role: 'user', parts: [{ text: message }] };

        // Use 'default' or actual model key if managed
        try {
            const generator = turn.run(
                'default',
                { role: 'user' as const, parts: [{ text: message }] },
                signal || new AbortController().signal
            );

            for await (const event of generator) {
                yield event;
            }
        } catch (error) {
            console.error('[CoreService] Turn error:', error);
            yield { type: 'error', value: { error } };
        }
    }
}

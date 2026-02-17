import React, { useEffect, useMemo, useRef, useState, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

export type SkillMeta = {
    id: string;
    name: string;
    description: string;
};

export type SkillMetaMap = Record<string, SkillMeta>;

export type SkillSpan = {
    start: number;
    end: number;
    skillId: string;
    source: 'path' | 'token';
    path?: string;
};

const SKILL_REGEX = {
    PATH: /(?:~?\/[^\s`'"]*\/([A-Za-z0-9._-]+)\/SKILL\.md)/g,
    DOLLAR: /\$([A-Za-z0-9._-]+)/g,
    CMD: /\/skills\s+([A-Za-z0-9._-]+)/gi,
    USE: /\buse skill\s+([A-Za-z0-9._-]+)\b/gi,
    ACTIVATE: /\bactivate_skill\s+([A-Za-z0-9._-]+)\b/gi,
    TOKEN: /\b([A-Za-z0-9._-]+)\b/g
};

let skillMetaCache: SkillMetaMap | null = null;
let skillMetaPromise: Promise<SkillMetaMap> | null = null;

export function toTitleCaseSkill(skillId: string): string {
    return skillId
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export async function loadSkillMetaMap(): Promise<SkillMetaMap> {
    if (skillMetaCache) return skillMetaCache;
    if (skillMetaPromise) return skillMetaPromise;

    skillMetaPromise = fetch('/api/skills')
        .then(async (res) => {
            if (!res.ok) return {} as SkillMetaMap;
            const skills = await res.json() as Array<{ id: string; name?: string; description?: string }>;
            const map: SkillMetaMap = {};
            for (const skill of skills) {
                const id = String(skill.id || '').trim();
                if (!id) continue;
                map[id] = {
                    id,
                    name: String(skill.name || id),
                    description: String(skill.description || '').trim(),
                };
            }
            skillMetaCache = map;
            return map;
        })
        .catch(() => ({} as SkillMetaMap))
        .finally(() => {
            skillMetaPromise = null;
        });

    return skillMetaPromise;
}

export function collectSkillSpans(text: string, skillMetaMap?: SkillMetaMap): SkillSpan[] {
    if (!text || !skillMetaMap) return [];

    const spans: SkillSpan[] = [];
    const knownSkillIds = Object.keys(skillMetaMap);
    if (knownSkillIds.length === 0) return [];

    const knownSkillIdByLower = new Map<string, string>();
    for (const skillId of knownSkillIds) {
        knownSkillIdByLower.set(skillId.toLowerCase(), skillId);
    }

    const resolveKnownSkillId = (rawSkillId: string) => {
        const normalized = String(rawSkillId || '').trim().toLowerCase();
        if (!normalized) return null;
        return knownSkillIdByLower.get(normalized) || null;
    };

    let match: RegExpExecArray | null;

    SKILL_REGEX.PATH.lastIndex = 0;
    SKILL_REGEX.DOLLAR.lastIndex = 0;
    SKILL_REGEX.CMD.lastIndex = 0;
    SKILL_REGEX.USE.lastIndex = 0;
    SKILL_REGEX.ACTIVATE.lastIndex = 0;

    while ((match = SKILL_REGEX.PATH.exec(text)) !== null) {
        const full = match[0];
        const skillId = resolveKnownSkillId(match[1]);
        if (!skillId) continue;
        spans.push({
            start: match.index,
            end: match.index + full.length,
            skillId,
            source: 'path',
            path: full,
        });
    }

    while ((match = SKILL_REGEX.DOLLAR.exec(text)) !== null) {
        const full = match[0];
        const skillId = resolveKnownSkillId(match[1]);
        if (!skillId) continue;
        spans.push({
            start: match.index,
            end: match.index + full.length,
            skillId,
            source: 'token',
        });
    }

    while ((match = SKILL_REGEX.CMD.exec(text)) !== null) {
        const full = match[0];
        const skillId = resolveKnownSkillId(match[1]);
        if (!skillId) continue;
        const localIndex = full.lastIndexOf(skillId);
        const start = match.index + (localIndex >= 0 ? localIndex : 0);
        spans.push({
            start,
            end: start + skillId.length,
            skillId,
            source: 'token',
        });
    }

    while ((match = SKILL_REGEX.USE.exec(text)) !== null) {
        const full = match[0];
        const skillId = resolveKnownSkillId(match[1]);
        if (!skillId) continue;
        const localIndex = full.lastIndexOf(skillId);
        const start = match.index + (localIndex >= 0 ? localIndex : 0);
        spans.push({
            start,
            end: start + skillId.length,
            skillId,
            source: 'token',
        });
    }

    while ((match = SKILL_REGEX.ACTIVATE.exec(text)) !== null) {
        const full = match[0];
        const skillId = resolveKnownSkillId(match[1]);
        if (!skillId) continue;
        const localIndex = full.lastIndexOf(skillId);
        const start = match.index + (localIndex >= 0 ? localIndex : 0);
        spans.push({
            start,
            end: start + skillId.length,
            skillId,
            source: 'token',
        });
    }

    if (knownSkillIds.length > 0) {
        SKILL_REGEX.TOKEN.lastIndex = 0;
        while ((match = SKILL_REGEX.TOKEN.exec(text)) !== null) {
            const skillId = resolveKnownSkillId(match[1]);
            if (!skillId) continue;
            if (!skillId.includes('-') && !skillId.includes('_') && !skillId.includes('.')) continue;
            spans.push({
                start: match.index,
                end: match.index + skillId.length,
                skillId,
                source: 'token',
            });
        }
    }

    if (spans.length === 0) return spans;

    spans.sort((a, b) => a.start - b.start);
    const nonOverlapping: SkillSpan[] = [];
    for (const span of spans) {
        const prev = nonOverlapping[nonOverlapping.length - 1];
        if (!prev || span.start >= prev.end) {
            nonOverlapping.push(span);
        }
    }
    return nonOverlapping;
}

export function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
    const frontmatterMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
    if (!frontmatterMatch) return {};

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/name:\s*(.+)/);
    const descriptionMatch = frontmatter.match(/description:\s*(.+)/);

    return {
        name: nameMatch?.[1]?.trim(),
        description: descriptionMatch?.[1]?.trim(),
    };
}

export const SkillBadge = React.memo(function SkillBadge({
    skillId,
    source,
    meta,
}: {
    skillId: string;
    source: 'path' | 'token';
    meta?: SkillMeta;
}) {
    const label = source === 'path'
        ? 'SKILL.md'
        : (meta?.name || toTitleCaseSkill(skillId));
    const description = meta?.description || `Skill: ${skillId}`;

    return (
        <span className="group/skillref relative inline-flex align-baseline">
            <span className="inline-flex items-center rounded-md border border-violet-200 dark:border-violet-400/30 bg-violet-50 dark:bg-violet-500/20 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-white shadow-sm">
                {label}
            </span>
            <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-border/60 bg-card px-2.5 py-2 text-[11px] leading-snug text-foreground shadow-xl transition-opacity duration-150 opacity-0 group-hover/skillref:opacity-100">
                {description}
            </span>
        </span>
    );
});

export function renderTextWithSkillRefs(text: string, skillMetaMap: SkillMetaMap): ReactNode {
    const spans = collectSkillSpans(text, skillMetaMap);
    if (spans.length === 0) return text;

    const nodes: ReactNode[] = [];
    let cursor = 0;

    spans.forEach((span, index) => {
        if (span.start > cursor) {
            nodes.push(text.slice(cursor, span.start));
        }
        nodes.push(
            <SkillBadge
                key={`skill-ref-${span.skillId}-${span.start}-${index}`}
                skillId={span.skillId}
                source={span.source}
                meta={skillMetaMap[span.skillId]}
            />
        );
        cursor = span.end;
    });

    if (cursor < text.length) {
        nodes.push(text.slice(cursor));
    }

    return nodes;
}

export function injectSkillRefs(children: ReactNode, skillMetaMap: SkillMetaMap): ReactNode {
    return React.Children.map(children, (child) => {
        if (typeof child === 'string') {
            return renderTextWithSkillRefs(child, skillMetaMap);
        }

        if (React.isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
            const element = child as ReactElement<{ children?: ReactNode }>;
            return React.cloneElement(element, {
                children: injectSkillRefs(element.props.children, skillMetaMap),
            });
        }

        return child;
    });
}

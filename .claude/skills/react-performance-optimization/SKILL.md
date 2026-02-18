---
name: react-performance-optimization
description: React 应用性能优化技术，包括 React.memo、useCallback、useMemo、Context 优化、CSS 动画性能等
---

# React Performance Optimization

提供 React 应用性能优化指南和可复用的代码模式。

## 使用场景

当用户请求以下内容时使用此 skill：
- "优化 React 性能"
- "减少组件重渲染"
- "主题切换卡顿"
- "优化动画性能"
- "React 性能最佳实践"

## 优化技术

### 1. React.memo 避免不必要重渲染

对高频更新的组件使用 React.memo：

```tsx
import { memo } from 'react';

// 组件包装
export const Sidebar = memo(function Sidebar({ sessions, onSelectSession, ... }) {
  // ...
});
```

**适用场景**：
- 接收大量 props 的组件
- 父组件频繁重渲染的子组件
- 纯展示组件

### 2. useCallback 稳定函数引用

避免 JSX 内联函数创建新实例：

```tsx
// ❌ 内联函数 - 每次渲染创建新函数
<Sidebar onToggleCollapse={() => setCollapsed(!collapsed)} />

// ✅ useCallback - 稳定引用
const handleToggleCollapse = useCallback(() => {
  setCollapsed(prev => !prev);
}, []);

<Sidebar onToggleCollapse={handleToggleCollapse} />
```

### 3. Context 优化

使用 useMemo 稳定 Context value：

```tsx
const value = useMemo(() => ({
  toasts,
  showToast,
  showError,
  dismissToast,
}), [toasts, showToast, showError, dismissToast]);

<ToastContext.Provider value={value}>
```

### 4. CSS 动画性能

**原则**：只动画 `transform` 和 `opacity`，避免触发布局重排

```tsx
// ❌ transition-all 动画所有属性
className="transition-all duration-300"

// ✅ 具体属性
className="transition-colors duration-200"
className="transition-transform duration-150"
```

**UI/UX Pro Max 建议**：
- 使用 150-300ms 作为微交互时长
- 添加 `will-change` 优化需要动画的元素
- 交互元素（按钮、输入框）禁用 transition

### 5. 滚动性能

避免 smooth scroll 在高频更新场景：

```tsx
// ❌ CPU 密集型
scrollTo({ top: scrollHeight, behavior: 'smooth' });

// ✅ 即时滚动
scrollTo({ top: scrollHeight, behavior: 'auto' });
```

### 6. next-themes 主题切换

使用 next-themes 避免 React 重渲染：

```tsx
// layout.tsx
<ThemeProvider
  attribute="class"
  defaultTheme="light"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>

// 组件中
const { theme, setTheme } = useTheme();
const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
```

## 常见性能问题

| 问题 | 解决方案 |
|------|----------|
| 主题切换卡顿 | 使用 next-themes 而非 React state |
| 组件无条件重渲染 | 添加 React.memo |
| JSX 内联函数 | 提取为 useCallback |
| Context 每次重建 | 使用 useMemo |
| 滚动动画卡顿 | smooth → auto |
| transition-all 性能差 | 使用具体属性 |
| Terminal 输出卡顿 | 避免 smooth scroll + 考虑虚拟滚动 |

## 验证方式

1. 运行 `npm run build` 确保无报错
2. 使用 DevTools Performance 面板测试
3. 观察 FPS 和渲染时间

## 完整优化流程示例

以 SkillsManager 组件为例，展示完整的性能优化流程：

### 1. 识别性能问题

当用户拖拽调整 Sidebar 高度时，SkillsManager 组件出现卡顿。原因是 Sidebar 的 `navHeight` 状态变化导致 SkillsManager 及其所有子组件重新渲染。

### 2. 使用 React.memo 包装组件

```tsx
import { memo } from 'react';

// ❌ 函数声明 - 每次父组件渲染都会重渲染
export function SkillsManager({ ... }) { }

// ✅ memo 包装 - 仅在 props 变化时重渲染
export const SkillsManager = memo(function SkillsManager({ ... }) { });
```

### 3. useCallback 稳定回调函数

```tsx
import { useCallback } from 'react';

const handleAction = useCallback(async (action: string, name?: string) => {
  // ...处理逻辑
}, [installSource, linkSource, fetchSkills]); // 依赖项

const handleUseSkill = useCallback((e: React.MouseEvent, skillId: string) => {
  // ...处理逻辑
}, []); // 无依赖项

const handleEditSkill = useCallback(async (e: React.MouseEvent, location: string) => {
  // ...处理逻辑
}, []);
```

### 4. useMemo 缓存计算结果

```tsx
import { useMemo } from 'react';

const scopeFilteredSkills = useMemo(() =>
  skills.filter((skill) => {
    return scopeFilter === 'all' ? true : skill.scope === scopeFilter;
  }),
  [skills, scopeFilter]
);

const filteredSkills = useMemo(() =>
  scopeFilteredSkills.filter((skill) => {
    // ...过滤逻辑
  }),
  [scopeFilteredSkills, statusFilter, search]
);

const enabledCount = useMemo(() =>
  scopeFilteredSkills.filter((s) => s.status === 'Enabled').length,
  [scopeFilteredSkills]
);
```

### 5. 代码审查

使用 clean-code skill 进行代码审查：
```bash
npm run lint
```

### 6. 测试验证

```bash
npm run test
```

### 7. 提交代码

```bash
git add <file> && git commit -m "perf: optimize SkillsManager to prevent re-renders during sidebar drag"
```

## 参考资源

- UI/UX Pro Max: `animation transform opacity performance` 规则
- Senior Architect: 性能优化最佳实践

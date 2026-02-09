import { readSettingsJson, writeSettingsJson } from '@/lib/settings';
import { NextResponse } from 'next/server';

export async function GET() {
  const settings = await readSettingsJson();
  const disabledList: string[] = settings.hooksConfig?.disabled || [];
  
  // 将 hooks 转为前端友好的格式
  const hooks = Object.entries(settings.hooks || {}).map(
    ([name, configs]: [string, unknown]) => ({
      name,
      configs: Array.isArray(configs) ? configs : [],
      enabled: !disabledList.includes(name),
    })
  );

  return NextResponse.json({
    globalEnabled: settings.hooksConfig?.enabled ?? true,
    notifications: settings.hooksConfig?.notifications ?? true,
    hooks,
  });
}

export async function POST(req: Request) {
  const { action, hookName, hookConfigs, enabled } = await req.json();
  const settings = await readSettingsJson();
  settings.hooks = settings.hooks || {};
  settings.hooksConfig = settings.hooksConfig || { enabled: true, disabled: [], notifications: true };
  settings.hooksConfig.disabled = settings.hooksConfig.disabled || [];

  switch (action) {
    case 'toggle': {
      const idx = settings.hooksConfig.disabled.indexOf(hookName);
      if (enabled && idx !== -1) {
        // 启用：从 disabled 数组移除
        settings.hooksConfig.disabled.splice(idx, 1);
      } else if (!enabled && idx === -1) {
        // 禁用：添加到 disabled 数组
        settings.hooksConfig.disabled.push(hookName);
      }
      break;
    }

    case 'toggle-global':
      settings.hooksConfig.enabled = enabled;
      break;

    case 'add':
      if (hookName && hookConfigs) {
        settings.hooks[hookName] = hookConfigs;
      }
      break;

    case 'update':
      if (hookName && hookConfigs) {
        settings.hooks[hookName] = hookConfigs;
      }
      break;

    case 'remove':
      delete settings.hooks[hookName];
      // 同时从 disabled 列表清理
      const removeIdx = settings.hooksConfig.disabled.indexOf(hookName);
      if (removeIdx !== -1) {
        settings.hooksConfig.disabled.splice(removeIdx, 1);
      }
      break;

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  await writeSettingsJson(settings);
  return NextResponse.json({ success: true });
}

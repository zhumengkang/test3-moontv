/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getStorage } from '@/lib/db';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  // 仅支持非 localstorage 模式（需要可写存储）
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: '当前模式不支持修改站点密码' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { newPassword } = body as { newPassword?: string };

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: '新密码不得为空' }, { status: 400 });
    }

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminConfig = await getConfig();
    const storage = getStorage();

    // 权限校验：站长或管理员
    const isOwner = authInfo.username === process.env.USERNAME;
    const isAdmin = adminConfig.UserConfig.Users.some(
      (u) => u.username === authInfo.username && u.role === 'admin'
    );
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    // 写入到管理员配置中（DB）
    (adminConfig as any).SiteConfig = {
      ...adminConfig.SiteConfig,
      HomepagePassword: newPassword,
    };

    if (storage && typeof (storage as any).setAdminConfig === 'function') {
      await (storage as any).setAdminConfig(adminConfig);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('修改站点密码失败:', error);
    return NextResponse.json(
      { error: '修改站点密码失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}



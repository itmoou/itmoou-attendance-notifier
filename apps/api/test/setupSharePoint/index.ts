/**
 * SharePoint 폴더 구조 설정 테스트
 * GET/POST /api/test/setup-sharepoint
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import sharepointClient from '../../shared/sharepointClient';

async function setupSharePointHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[Test] SharePoint 폴더 구조 설정 시작');

  try {
    // SharePoint 폴더 구조 생성
    await sharepointClient.setupFolderStructure();

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'SharePoint 폴더 구조가 성공적으로 생성되었습니다.',
        siteUrl: 'https://itmoou.sharepoint.com/sites/itmoou-groupware',
      }, null, 2),
    };
  } catch (error: any) {
    context.error('[Test] SharePoint 설정 실패:', error);

    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.response?.data || null,
      }, null, 2),
    };
  }
}

app.http('setupSharePoint', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'test/setup-sharepoint',
  handler: setupSharePointHandler,
});

export default setupSharePointHandler;

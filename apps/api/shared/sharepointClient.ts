/**
 * SharePoint Client
 * Microsoft Graph API를 통한 SharePoint 문서 관리
 */

import axios, { AxiosInstance } from 'axios';
import { getGraphAccessToken } from './graphClient';

// SharePoint 사이트 정보
const SHAREPOINT_SITE_URL = 'https://itmoou.sharepoint.com/sites/itmoou-groupware';
const SHAREPOINT_HOSTNAME = 'itmoou.sharepoint.com';
const SITE_PATH = '/sites/itmoou-groupware';

export interface SharePointFolder {
  id: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
}

export interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

class SharePointClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 요청 인터셉터: Access Token 자동 추가
    this.client.interceptors.request.use(
      async (config) => {
        const token = await getGraphAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * SharePoint 사이트 ID 가져오기
   */
  async getSiteId(): Promise<string> {
    try {
      const response = await this.client.get(
        `/sites/${SHAREPOINT_HOSTNAME}:${SITE_PATH}`
      );
      return response.data.id;
    } catch (error: any) {
      console.error('[SharePoint] 사이트 ID 조회 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 문서 라이브러리(Drive) ID 가져오기
   */
  async getDriveId(): Promise<string> {
    try {
      const siteId = await this.getSiteId();
      const response = await this.client.get(`/sites/${siteId}/drive`);
      return response.data.id;
    } catch (error: any) {
      console.error('[SharePoint] Drive ID 조회 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 폴더 생성
   * @param parentPath 부모 폴더 경로 (예: "attendance_reports" 또는 "attendance_reports/2025")
   * @param folderName 생성할 폴더 이름 (예: "01")
   */
  async createFolder(parentPath: string, folderName: string): Promise<SharePointFolder> {
    try {
      const driveId = await this.getDriveId();

      // 루트 폴더인 경우
      const parentItemPath = parentPath ? `/root:/${parentPath}:` : '/root';

      const response = await this.client.post(
        `/drives/${driveId}${parentItemPath}/children`,
        {
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail', // 이미 존재하면 실패
        }
      );

      console.log(`[SharePoint] 폴더 생성 성공: ${parentPath}/${folderName}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.log(`[SharePoint] 폴더가 이미 존재함: ${parentPath}/${folderName}`);
        // 이미 존재하는 경우 조회
        return await this.getFolder(`${parentPath}/${folderName}`);
      }
      console.error('[SharePoint] 폴더 생성 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 폴더 조회
   * @param folderPath 폴더 경로 (예: "attendance_reports/2025/01")
   */
  async getFolder(folderPath: string): Promise<SharePointFolder> {
    try {
      const driveId = await this.getDriveId();
      const response = await this.client.get(
        `/drives/${driveId}/root:/${folderPath}`
      );
      return response.data;
    } catch (error: any) {
      console.error('[SharePoint] 폴더 조회 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 파일 업로드
   * @param folderPath 업로드할 폴더 경로
   * @param fileName 파일 이름
   * @param content 파일 내용 (Buffer 또는 string)
   */
  async uploadFile(
    folderPath: string,
    fileName: string,
    content: Buffer | string
  ): Promise<SharePointFile> {
    try {
      const driveId = await this.getDriveId();

      const response = await this.client.put(
        `/drives/${driveId}/root:/${folderPath}/${fileName}:/content`,
        content,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        }
      );

      console.log(`[SharePoint] 파일 업로드 성공: ${folderPath}/${fileName}`);
      return response.data;
    } catch (error: any) {
      console.error('[SharePoint] 파일 업로드 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 파일 목록 조회
   * @param folderPath 폴더 경로
   */
  async listFiles(folderPath: string): Promise<SharePointFile[]> {
    try {
      const driveId = await this.getDriveId();
      const response = await this.client.get(
        `/drives/${driveId}/root:/${folderPath}:/children`
      );
      return response.data.value;
    } catch (error: any) {
      console.error('[SharePoint] 파일 목록 조회 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 폴더 구조 일괄 생성
   */
  async setupFolderStructure(): Promise<void> {
    console.log('[SharePoint] 폴더 구조 생성 시작...');

    const folders = [
      { parent: '', name: 'attendance_reports' },
      { parent: 'attendance_reports', name: '2025' },
      { parent: 'attendance_reports/2025', name: '01' },
      { parent: 'attendance_reports/2025', name: '02' },
      { parent: 'attendance_reports/2025', name: '03' },
      { parent: 'attendance_reports/2025', name: '04' },
      { parent: 'attendance_reports/2025', name: '05' },
      { parent: 'attendance_reports/2025', name: '06' },
      { parent: 'attendance_reports/2025', name: '07' },
      { parent: 'attendance_reports/2025', name: '08' },
      { parent: 'attendance_reports/2025', name: '09' },
      { parent: 'attendance_reports/2025', name: '10' },
      { parent: 'attendance_reports/2025', name: '11' },
      { parent: 'attendance_reports/2025', name: '12' },
      { parent: 'attendance_reports', name: '2024' },
      { parent: '', name: 'vacation_status' },
      { parent: 'vacation_status', name: '2025' },
      { parent: 'vacation_status/2025', name: '01' },
      { parent: 'vacation_status/2025', name: '02' },
      { parent: 'vacation_status/2025', name: '03' },
      { parent: 'vacation_status/2025', name: '04' },
      { parent: 'vacation_status/2025', name: '05' },
      { parent: 'vacation_status/2025', name: '06' },
      { parent: 'vacation_status/2025', name: '07' },
      { parent: 'vacation_status/2025', name: '08' },
      { parent: 'vacation_status/2025', name: '09' },
      { parent: 'vacation_status/2025', name: '10' },
      { parent: 'vacation_status/2025', name: '11' },
      { parent: 'vacation_status/2025', name: '12' },
      { parent: 'vacation_status', name: '2024' },
      { parent: '', name: 'monthly_summary' },
      { parent: 'monthly_summary', name: '2025' },
      { parent: 'monthly_summary', name: '2024' },
      { parent: '', name: 'employee_documents' },
    ];

    let created = 0;
    let skipped = 0;

    for (const folder of folders) {
      try {
        await this.createFolder(folder.parent, folder.name);
        created++;
        // API 호출 제한을 위한 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        if (error.response?.status === 409) {
          skipped++;
        } else {
          console.error(`[SharePoint] 폴더 생성 실패: ${folder.parent}/${folder.name}`);
        }
      }
    }

    console.log(`[SharePoint] 폴더 구조 생성 완료 - 생성: ${created}, 건너뜀: ${skipped}`);
  }
}

// 싱글톤 인스턴스
const sharepointClient = new SharePointClient();

export default sharepointClient;

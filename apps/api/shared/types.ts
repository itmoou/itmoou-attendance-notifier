/**
 * Types Definitions
 * 공통 타입 정의
 */

// Flex API Types
export interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string;
  position?: string;
  teamsUserId?: string;
  active?: boolean;
}

export interface AttendanceRecord {
  employeeId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: 'present' | 'absent' | 'vacation' | 'sick_leave';
  workHours?: string;
}

export interface VacationInfo {
  employeeId: string;
  employeeName?: string;
  startDate: string;
  endDate: string;
  type: 'annual' | 'sick' | 'other';
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

// Token Types
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

// Notification Types
export interface NotificationMessage {
  userId: string;
  message: string;
  messageType?: 'text' | 'html';
}

export interface EmailMessage {
  to: string[];
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
  cc?: string[];
  bcc?: string[];
  from?: string;
}

// Microsoft Graph Types
export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface GraphChat {
  id: string;
  chatType: 'oneOnOne' | 'group';
  members: GraphChatMember[];
}

export interface GraphChatMember {
  '@odata.type': string;
  id: string;
  userId: string;
  displayName: string;
  roles: string[];
}

// Function Context Types
export interface FunctionExecutionContext {
  invocationId: string;
  functionName: string;
  executionTime: Date;
}

// Error Types
export class FlexAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseData?: any
  ) {
    super(message);
    this.name = 'FlexAPIError';
  }
}

export class GraphAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseData?: any
  ) {
    super(message);
    this.name = 'GraphAPIError';
  }
}

export class TokenExpiredError extends Error {
  constructor(message: string = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

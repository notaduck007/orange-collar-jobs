export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

export interface MessageResponse {
  message: string;
}

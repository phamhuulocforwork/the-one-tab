export interface Tab {
  id: string;
  title: string;
  url: string;
  favIconUrl?: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  tabs: Tab[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  closeAndSave: boolean;
  oauthToken?: string; // OAuth access token
  gistId?: string;
  githubClientId?: string; // GitHub OAuth App Client ID
  githubClientSecret?: string; // GitHub OAuth App Client Secret (required for token exchange)
}

export interface UserInfo {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface AuthState {
  isSignedIn: boolean;
  login: string;
  userInfo: UserInfo | null;
  token: string | undefined;
}

export interface StorageData {
  groups: Group[];
  settings: Settings;
}

export interface ServerConfig {
  port: number;
  host: string;
  open: boolean;
}

export interface McpConfig {
  enabledTools: string[] | null;
  serverName: string;
  serverVersion: string;
}

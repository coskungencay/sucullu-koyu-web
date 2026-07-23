export type CameraConfig = {
  id: string;
  streamPath: string;
  homeOrder: number;
  wallOrder: number;
  homeLabel: string;
  wallLabel: string;
  enabled: boolean;
};

export type CameraPlayerState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'stalled'
  | 'retry-wait'
  | 'offline';

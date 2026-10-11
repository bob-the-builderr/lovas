export interface DeviceIdentity {
  deviceId: string;
  createdAt: number;
}

export type PairCode = string;

export interface Couple {
  id: string;
  pairCode: PairCode;
  createdBy: string;
  createdAt: string;
}

export interface CoupleMember {
  coupleId: string;
  deviceId: string;
  joinedAt: string;
}

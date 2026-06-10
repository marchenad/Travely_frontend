export type WaypointType = 'DEPARTURE' | 'DESTINATION' | 'STOP' | 'POINT_OF_INTEREST';

export interface Waypoint {
  id: number;
  tripId: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  type: WaypointType;
  order: number;
  visitedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaypointRequest {
  tripId: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  type: WaypointType;
  order: number;
}

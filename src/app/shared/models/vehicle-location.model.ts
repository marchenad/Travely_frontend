export interface VehicleLocation {
  id: number;
  vehicleId: number;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export interface VehicleLocationRequest {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
}

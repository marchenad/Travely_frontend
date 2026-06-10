export interface Vehicle {
  id: number;
  name: string;
  licensePlate: string;
  color?: string;
  driverId?: number;
  driverName?: string;
  driverPhone?: string;
  driverProfilePicture?: string;
  tripId: number;
  tripTitle?: string;
  tripStatus?: string;
  tripDestinationName?: string;
  tripDestinationLatitude?: number;
  tripDestinationLongitude?: number;
  tripCreatorId?: number;
  tripCreatorName?: string;
  tripUpdatedAt?: string;
  tripNavigationVersion?: number;
  currentLat?: number;
  currentLng?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleRequest {
  name: string;
  licensePlate: string;
  color?: string;
  driverId?: number;
  tripId: number;
}
